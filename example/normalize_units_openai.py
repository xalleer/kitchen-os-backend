#!/usr/bin/env python3
import argparse
import json
import os
import ssl
import time
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Sequence


ALLOWED_UNITS: List[str] = ["KG", "L", "PCS"]


def _chunks(items: Sequence[Any], size: int) -> List[List[Any]]:
    out: List[List[Any]] = []
    buf: List[Any] = []
    for it in items:
        buf.append(it)
        if len(buf) >= size:
            out.append(buf)
            buf = []
    if buf:
        out.append(buf)
    return out


def _heuristic_unit_from_existing(unit: Any) -> str | None:
    if not isinstance(unit, str):
        return None
    u = unit.strip().upper()

    if u in {"PCS", "ШТ", "ШТ.", "PIECE", "PIECES"}:
        return "PCS"

    if u in {"KG", "КГ"}:
        return "KG"

    # In your dataset these appear frequently, but you want price per KG/L.
    if u in {"G", "Г", "GR", "ГР"}:
        return "KG"

    if u in {"L", "Л"}:
        return "L"

    if u in {"ML", "МЛ"}:
        return "L"

    return None


def _build_prompt(items: List[Dict[str, Any]]) -> str:
    allowed = "\n".join([f"- {u}" for u in ALLOWED_UNITS])

    lines: List[str] = []
    for i, p in enumerate(items, start=1):
        title = p.get("title")
        unit = p.get("unit")
        lines.append(f"{i}. title=\"{title}\"; unit=\"{unit}\"")

    inp = "\n".join(lines)

    return (
        "Ти нормалізатор одиниць виміру товарів українською. "
        "Потрібно для кожного товару визначити базову одиницю з переліку. "
        "ЦІНА (price) ВЖЕ є ціною за КГ/Л/ШТ — її НЕ потрібно змінювати, лише визначити unit. "
        "ПОВЕРНИ ТІЛЬКИ JSON-масив без markdown.\n\n"
        "Правила:\n"
        "- дозволені значення unit: тільки з дозволеного списку\n"
        "- KG: для вагових продуктів (фрукти, м'ясо, крупи тощо)\n"
        "- L: для рідин (молоко, олія, соки тощо)\n"
        "- PCS: для штучних товарів (яйця, банани якщо рахують поштучно, тощо)\n"
        "- якщо в назві є явні підказки типу 'мл', 'л', 'кг', 'г', 'шт', врахуй їх\n"
        "- якщо не впевнений, обирай найбільш типову одиницю для такого товару\n\n"
        f"Дозволені unit:\n{allowed}\n\n"
        "Вхідні товари (пронумеровані):\n"
        f"{inp}\n\n"
        "Формат відповіді: JSON-масив об'єктів [{index: number, unit: string}] з усіма індексами."
    )


def _openai_normalize_units(
    api_key: str,
    model: str,
    items: List[Dict[str, Any]],
    timeout_sec: int,
    max_retries: int,
    retry_sleep_sec: float,
    cafile: str | None,
    insecure: bool,
) -> Dict[int, str]:
    prompt = _build_prompt(items)

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 1500,
    }

    data = json.dumps(payload).encode("utf-8")

    if insecure:
        ssl_context = ssl._create_unverified_context()
    else:
        if cafile:
            ssl_context = ssl.create_default_context(cafile=cafile)
        else:
            try:
                import certifi  # type: ignore

                ssl_context = ssl.create_default_context(cafile=certifi.where())
            except Exception:
                ssl_context = ssl.create_default_context()

    last_err: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            req = urllib.request.Request(
                "https://api.openai.com/v1/chat/completions",
                data=data,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=timeout_sec, context=ssl_context) as resp:
                body = resp.read().decode("utf-8")

            parsed = json.loads(body)
            content = (
                parsed.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
            if not isinstance(content, str) or not content.strip():
                raise ValueError("Empty OpenAI response content")

            arr = json.loads(content)
            if not isinstance(arr, list):
                raise ValueError("OpenAI did not return a JSON array")

            out: Dict[int, str] = {}
            for row in arr:
                if not isinstance(row, dict):
                    continue
                idx = row.get("index")
                unit = row.get("unit")
                if not isinstance(idx, int):
                    continue
                if not isinstance(unit, str):
                    continue
                u = unit.strip().upper()
                if u not in ALLOWED_UNITS:
                    raise ValueError(f"Invalid unit '{u}' for index {idx}")
                out[idx] = u

            return out
        except Exception as e:
            last_err = e
            if attempt < max_retries:
                time.sleep(retry_sleep_sec)
                continue
            raise

    raise last_err or RuntimeError("Unknown OpenAI error")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="in_path", default="product_data_new.json")
    parser.add_argument("--out", dest="out_path", default="product_data_new_units.json")
    parser.add_argument("--model", default="gpt-4o-mini")
    parser.add_argument("--batch-size", type=int, default=80)
    parser.add_argument("--timeout-sec", type=int, default=60)
    parser.add_argument("--max-retries", type=int, default=3)
    parser.add_argument("--retry-sleep-sec", type=float, default=2.0)
    parser.add_argument("--cafile", default=None)
    parser.add_argument("--insecure", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--openai-only",
        action="store_true",
        help="Do not apply heuristic mapping, send everything to OpenAI.",
    )
    args = parser.parse_args()

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY env var is required")

    base_dir = Path(__file__).resolve().parent
    in_file = (base_dir / args.in_path).resolve()
    out_file = (base_dir / args.out_path).resolve()

    products: List[Dict[str, Any]] = json.loads(in_file.read_text(encoding="utf-8"))

    out_products: List[Any] = [None] * len(products)
    unresolved: List[Dict[str, Any]] = []

    for pos, p in enumerate(products):
        if not isinstance(p, dict):
            out_products[pos] = p
            continue

        mapped = None if args.openai_only else _heuristic_unit_from_existing(p.get("unit"))
        if mapped is not None:
            pp = dict(p)
            pp["unit"] = mapped
            out_products[pos] = pp
        else:
            marker = dict(p)
            marker["__pos"] = pos
            unresolved.append(marker)

    print(f"Products: {len(products)}")
    print(f"Heuristically mapped: {len(products) - len(unresolved)}")
    print(f"Needs OpenAI: {len(unresolved)}")

    if unresolved:
        batches = _chunks(unresolved, args.batch_size)
        for bi, batch in enumerate(batches, start=1):
            print(f"OpenAI batch {bi}/{len(batches)} (size={len(batch)})...")

            # Indices in the prompt are per-batch (1..N). Keep __pos stable for writing back.
            batch_for_openai: List[Dict[str, Any]] = []
            for i, row in enumerate(batch, start=1):
                rr = dict(row)
                rr["__needs_openai_index"] = i
                batch_for_openai.append(rr)

            mapping = _openai_normalize_units(
                api_key=api_key,
                model=args.model,
                items=batch_for_openai,
                timeout_sec=args.timeout_sec,
                max_retries=args.max_retries,
                retry_sleep_sec=args.retry_sleep_sec,
                cafile=args.cafile,
                insecure=args.insecure,
            )

            mapped_by_marker: Dict[int, str] = {k: v for k, v in mapping.items()}

            expected_indices = {
                row.get("__needs_openai_index")
                for row in batch_for_openai
                if isinstance(row.get("__needs_openai_index"), int)
            }
            if expected_indices != set(mapped_by_marker.keys()):
                missing = sorted(expected_indices - set(mapped_by_marker.keys()))
                extra = sorted(set(mapped_by_marker.keys()) - expected_indices)
                raise SystemExit(f"OpenAI batch mismatch. missing={missing} extra={extra}")

            for row in batch_for_openai:
                idx = row.get("__needs_openai_index")
                pos = row.get("__pos")
                if not isinstance(idx, int) or not isinstance(pos, int):
                    continue
                u = mapped_by_marker[idx]

                pp = dict(row)
                pp.pop("__needs_openai_index", None)
                pp.pop("__pos", None)
                pp["unit"] = u
                out_products[pos] = pp

            if bi < len(batches):
                time.sleep(0.7)

    if args.dry_run:
        print("Dry-run: not writing output")
        return 0

    out_file.write_text(json.dumps(out_products, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote: {out_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
