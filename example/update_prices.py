#!/usr/bin/env python3
import argparse
import json
import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


_STOPWORDS = {
    "і",
    "й",
    "та",
    "з",
    "із",
    "зі",
    "в",
    "у",
    "на",
    "для",
    "по",
    "без",
    "до",
    "від",
    "про",
    "або",
}


def _stem_uk_token(t: str) -> str:
    # Very light stemming to reduce inflection noise. Not linguistic-perfect,
    # but helps align tokens like "куряча"/"куряче", "сушені"/"сушений".
    t = t.strip("'")
    if len(t) <= 4:
        return t

    for suf in (
        "ими",
        "ими",
        "ами",
        "ями",
        "ого",
        "ому",
        "ими",
        "ими",
        "ий",
        "ій",
        "ою",
        "ею",
        "ая",
        "яя",
        "ое",
        "є",
        "е",
        "а",
        "я",
        "и",
        "і",
        "у",
        "ю",
        "о",
    ):
        if t.endswith(suf) and len(t) - len(suf) >= 3:
            return t[: -len(suf)]
    return t


def _normalize_title(s: str) -> str:
    s = s.lower().strip()

    # unify apostrophes
    s = s.replace("`", "'").replace("’", "'").replace("ʼ", "'")

    # remove common weight/volume patterns and percentages
    s = re.sub(r"\b\d+(?:[\.,]\d+)?\s*(?:кг|г|гр|л|мл|шт|pcs)\b", " ", s, flags=re.IGNORECASE)
    s = re.sub(r"\b\d+(?:[\.,]\d+)?\s*%\b", " ", s)

    # remove standalone numbers (often part of packaging)
    s = re.sub(r"\b\d+(?:[\.,]\d+)?\b", " ", s)

    # keep letters (latin/cyrillic) and spaces
    s = re.sub(r"[^a-zа-яіїєґ'\s]", " ", s, flags=re.IGNORECASE)

    # collapse spaces
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _tokenize(norm: str) -> List[str]:
    if not norm:
        return []
    toks = [t for t in norm.split(" ") if t]
    toks = [t for t in toks if t not in _STOPWORDS]
    toks = [_stem_uk_token(t) for t in toks]
    toks = [t for t in toks if t and t not in _STOPWORDS]
    return toks


@dataclass(frozen=True)
class PriceCandidate:
    raw_title: str
    norm_title: str
    price: float
    base_unit: Optional[str]
    has_explicit_qty: bool


def _has_explicit_quantity_in_title(title: str) -> bool:
    # If a listing contains explicit weight/volume/count, it's likely a pack price.
    # Example: "950г", "1л", "320г", "8шт".
    return bool(
        re.search(
            r"\b\d+(?:[\.,]\d+)?\s*(?:кг|г|гр|л|мл|шт|pcs)\b",
            title.lower(),
            flags=re.IGNORECASE,
        )
    )


def _extract_quantities(title: str) -> Dict[str, float]:
    """Extract quantities from title.

    Returns a dict with optional keys:
    - "kg": quantity in kilograms
    - "l": quantity in liters
    - "pcs": count of pieces
    If multiple occur, sums them (rare but possible).
    """
    t = title.lower()
    out: Dict[str, float] = {"kg": 0.0, "l": 0.0, "pcs": 0.0}

    for m in re.finditer(r"\b(\d+(?:[\.,]\d+)?)\s*(кг|г|гр)\b", t, flags=re.IGNORECASE):
        num = float(m.group(1).replace(",", "."))
        unit = m.group(2).lower()
        if unit == "кг":
            out["kg"] += num
        else:
            out["kg"] += num / 1000.0

    for m in re.finditer(r"\b(\d+(?:[\.,]\d+)?)\s*(л|мл)\b", t, flags=re.IGNORECASE):
        num = float(m.group(1).replace(",", "."))
        unit = m.group(2).lower()
        if unit == "л":
            out["l"] += num
        else:
            out["l"] += num / 1000.0

    for m in re.finditer(r"\b(\d+(?:[\.,]\d+)?)\s*(шт|pcs)\b", t, flags=re.IGNORECASE):
        num = float(m.group(1).replace(",", "."))
        out["pcs"] += num

    # Clean zeros
    return {k: v for k, v in out.items() if v > 0}


def _convert_price_to_unit(target_unit: str, cand: PriceCandidate) -> Optional[float]:
    tu = (target_unit or "").upper()
    qs = _extract_quantities(cand.raw_title)

    if tu == "KG":
        qkg = qs.get("kg")
        if qkg and qkg > 0:
            return cand.price / qkg
        return None

    if tu == "L":
        ql = qs.get("l")
        if ql and ql > 0:
            return cand.price / ql
        return None

    if tu == "ML":
        ql = qs.get("l")
        if ql and ql > 0:
            return cand.price / (ql * 1000.0)
        return None

    if tu == "PCS":
        qpcs = qs.get("pcs")
        if qpcs and qpcs > 0:
            return cand.price / qpcs
        return None

    # For G we don't have a reliable rule; keep original.
    if tu == "G":
        return cand.price

    return cand.price


def _is_unit_compatible(target_unit: str, cand: PriceCandidate) -> bool:
    tu = (target_unit or "").upper()
    bu = (cand.base_unit or "").upper()

    qs = _extract_quantities(cand.raw_title) if cand.has_explicit_qty else {}

    # If product expects KG price, reject obvious pack listings.
    if tu == "KG":
        if cand.has_explicit_qty:
            # Allow only if we can convert using weight.
            return "kg" in qs
        # ATB weighted items usually come as baseUnit=G with price per KG.
        return bu in {"", "G", "KG"}

    # If product expects ML, prefer listings that clearly represent liquids.
    if tu in {"ML", "L"}:
        if bu == "PCS":
            return False
        if cand.has_explicit_qty:
            return "l" in qs
        return bu in {"ML", "L"}

    if tu == "PCS":
        if bu == "PCS":
            return True
        if cand.has_explicit_qty:
            return "pcs" in qs
        return False

    # For G (generic grams in your file), allow both weighted and pack.
    if tu == "G":
        return True

    return True


def _build_candidates(
    items: Iterable[Dict[str, Any]],
    title_keys: List[str],
    price_key: str,
    base_unit_key: Optional[str] = None,
) -> List[PriceCandidate]:
    out: List[PriceCandidate] = []
    for it in items:
        title_val: Optional[str] = None
        for k in title_keys:
            v = it.get(k)
            if isinstance(v, str) and v.strip():
                title_val = v
                break
        if not title_val:
            continue

        p = it.get(price_key)
        if not isinstance(p, (int, float)):
            continue

        base_unit: Optional[str] = None
        if base_unit_key:
            bu = it.get(base_unit_key)
            if isinstance(bu, str) and bu.strip():
                base_unit = bu.strip()

        out.append(
            PriceCandidate(
                raw_title=title_val,
                norm_title=_normalize_title(title_val),
                price=float(p),
                base_unit=base_unit,
                has_explicit_qty=_has_explicit_quantity_in_title(title_val),
            )
        )
    return out


def _build_inverted_index(candidates: List[PriceCandidate]) -> Dict[str, List[int]]:
    idx: Dict[str, List[int]] = {}
    for i, c in enumerate(candidates):
        for tok in set(_tokenize(c.norm_title)):
            idx.setdefault(tok, []).append(i)
    return idx


def _score(a_norm: str, b_norm: str) -> float:
    if not a_norm or not b_norm:
        return 0.0

    a_toks = set(_tokenize(a_norm))
    b_toks = set(_tokenize(b_norm))
    if not a_toks or not b_toks:
        return 0.0

    jacc = len(a_toks & b_toks) / len(a_toks | b_toks)
    seq = SequenceMatcher(None, a_norm, b_norm).ratio()

    # weighted score, token overlap matters more
    return 0.65 * jacc + 0.35 * seq


def _find_best_price(
    query_title: str,
    query_unit: str,
    candidates: List[PriceCandidate],
    inv: Dict[str, List[int]],
    min_score: float,
    min_token_overlap: int,
    min_score_gap: float,
) -> Tuple[Optional[PriceCandidate], float]:
    q_norm = _normalize_title(query_title)
    q_toks = set(_tokenize(q_norm))
    if not q_toks:
        return None, 0.0

    # Dynamic overlap: single-token queries are ambiguous, require tighter match.
    effective_min_overlap = min_token_overlap
    if len(q_toks) >= 3:
        effective_min_overlap = max(effective_min_overlap, 2)
    if len(q_toks) == 1:
        effective_min_overlap = max(effective_min_overlap, 1)

    # collect candidate ids by shared tokens
    ids: List[int] = []
    for t in q_toks:
        ids.extend(inv.get(t, []))

    if not ids:
        return None, 0.0

    # count overlaps to prune aggressively
    overlap_count: Dict[int, int] = {}
    for i in ids:
        overlap_count[i] = overlap_count.get(i, 0) + 1

    # take top by overlap (speed)
    ranked = sorted(overlap_count.items(), key=lambda x: x[1], reverse=True)
    ranked = [pair for pair in ranked if pair[1] >= effective_min_overlap][:200]

    best: Optional[PriceCandidate] = None
    best_score = 0.0
    second_best = 0.0
    for i, _ov in ranked:
        c = candidates[i]
        sc = _score(q_norm, c.norm_title)
        if sc > best_score:
            second_best = best_score
            best_score = sc
            best = c
        elif sc > second_best:
            second_best = sc

    # Extra safety for short/generic names: require near-exact match.
    if len(q_toks) == 1 and best is not None:
        # The best candidate must contain the same single token.
        if next(iter(q_toks)) not in set(_tokenize(best.norm_title)):
            return None, best_score
        # Also require a higher score threshold for single-token queries.
        if best_score < max(min_score, 0.88):
            return None, best_score

    if best is None or best_score < min_score:
        return None, best_score

    if not _is_unit_compatible(query_unit, best):
        return None, best_score

    # Ambiguity guard: if runner-up is too close, skip.
    if best_score - second_best < min_score_gap:
        return None, best_score

    return best, best_score


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--product-data", default="product_data.json")
    parser.add_argument("--atb", default="atb_products.json")
    parser.add_argument("--metro", default="metro_full_catalog_all_pages.json")
    parser.add_argument("--write", action="store_true", help="Actually overwrite product_data.json. Without this flag, only prints a report.")
    parser.add_argument("--min-score", type=float, default=0.62)
    parser.add_argument("--min-token-overlap", type=int, default=1)
    parser.add_argument("--min-score-gap", type=float, default=0.06)
    parser.add_argument("--convert-packs", action="store_true", help="Convert pack prices (e.g. 950г/1л/8шт) into target unit price.")
    parser.add_argument("--report", choices=["changed", "skipped", "none"], default="changed")
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent
    product_path = (base_dir / args.product_data).resolve()
    atb_path = (base_dir / args.atb).resolve()
    metro_path = (base_dir / args.metro).resolve()

    product_data: List[Dict[str, Any]] = json.loads(product_path.read_text(encoding="utf-8"))

    atb_root: Dict[str, Any] = json.loads(atb_path.read_text(encoding="utf-8"))
    atb_products: List[Dict[str, Any]] = atb_root.get("products") or []

    metro_items: List[Dict[str, Any]] = json.loads(metro_path.read_text(encoding="utf-8"))

    atb_candidates = _build_candidates(
        atb_products,
        title_keys=["name", "originalTitle"],
        price_key="price",
        base_unit_key="baseUnit",
    )
    metro_candidates = _build_candidates(metro_items, title_keys=["title"], price_key="price")

    atb_inv = _build_inverted_index(atb_candidates)
    metro_inv = _build_inverted_index(metro_candidates)

    updated_from_atb = 0
    updated_from_metro = 0
    skipped = 0

    changes: List[Tuple[str, float, float, str, float]] = []
    skipped_titles: List[str] = []

    for p in product_data:
        title = p.get("title")
        if not isinstance(title, str) or not title.strip():
            skipped += 1
            skipped_titles.append(str(title))
            continue

        old_price = p.get("price")
        old_price_num = float(old_price) if isinstance(old_price, (int, float)) else None
        unit = p.get("unit")
        unit_str = unit if isinstance(unit, str) else ""

        cand, sc = _find_best_price(
            title,
            unit_str,
            atb_candidates,
            atb_inv,
            args.min_score,
            args.min_token_overlap,
            args.min_score_gap,
        )
        source = "ATB"
        if cand is None:
            cand, sc = _find_best_price(
                title,
                unit_str,
                metro_candidates,
                metro_inv,
                args.min_score,
                args.min_token_overlap,
                args.min_score_gap,
            )
            source = "METRO"

        if cand is None:
            skipped += 1
            skipped_titles.append(title)
            continue

        new_price = cand.price
        if args.convert_packs and cand.has_explicit_qty:
            converted = _convert_price_to_unit(unit_str, cand)
            if converted is not None:
                new_price = converted
        if old_price_num is None or abs(new_price - old_price_num) > 1e-9:
            p["price"] = new_price
            changes.append((title, old_price_num if old_price_num is not None else float("nan"), new_price, source, sc))
            if source == "ATB":
                updated_from_atb += 1
            else:
                updated_from_metro += 1

    total = len(product_data)
    print(f"Products: {total}")
    print(f"Updated from ATB: {updated_from_atb}")
    print(f"Updated from METRO: {updated_from_metro}")
    print(f"Skipped (no confident match): {skipped}")
    print(f"Changed prices: {len(changes)}")

    if args.report == "skipped":
        for t in skipped_titles:
            print(f"- {t}")
    elif args.report == "changed":
        for title, oldp, newp, source, sc in changes:
            oldp_str = "?" if oldp != oldp else f"{oldp:g}"  # NaN check
            print(f"- [{source} score={sc:.3f}] {title}: {oldp_str} -> {newp:g}")

    if args.write:
        product_path.write_text(json.dumps(product_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\nWrote: {product_path}")
    else:
        print("\nDry-run only. Add --write to overwrite product_data.json")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
