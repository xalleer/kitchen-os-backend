#!/usr/bin/env python3
import argparse
import json
import os
import time
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple


ALLOWED_CATEGORIES: List[str] = [
    "овочі та фрукти",
    "бакалія",
    "молочна продукція та яйця",
    "напої",
    "м'ясо",
    "сири",
    "кондитерські вироби",
    "риба і морепродукти",
    "хлібобулочни вироби",
    "заморожені продукти",
    "ковбаси і м'ясні делікатеси",
]


def _chunks(items: Sequence[str], size: int) -> List[List[str]]:
    out: List[List[str]] = []
    buf: List[str] = []
    for it in items:
        buf.append(it)
        if len(buf) >= size:
            out.append(buf)
            buf = []
    if buf:
        out.append(buf)
    return out


def _build_prompt(old_categories: List[str]) -> str:
    allowed = "\n".join([f"- {c}" for c in ALLOWED_CATEGORIES])
    olds = "\n".join([f"- {c}" for c in old_categories])

    return (
        "Ти класифікатор категорій продуктів українською. "
        "Потрібно замапити наявні категорії до одного з дозволених значень. "
        "ПОВЕРНИ ТІЛЬКИ JSON-об'єкт без markdown.\n\n"
        "Правила:\n"
        "- значення мапи повинні бути ТІЛЬКИ з дозволеного списку\n"
        "- ключі повинні бути точними як у вхідному списку\n"
        "- якщо не впевнений, обирай найближчу за змістом\n\n"
        f"Дозволені категорії:\n{allowed}\n\n"
        f"Вхідні категорії для мапінгу:\n{olds}\n"
    )


def _openai_map_categories(
    api_key: str,
    model: str,
    old_categories: List[str],
    timeout_sec: int,
    max_retries: int,
    retry_sleep_sec: float,
) -> Dict[str, str]:
    prompt = _build_prompt(old_categories)

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 1000,
    }

    data = json.dumps(payload).encode("utf-8")

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
            with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                body = resp.read().decode("utf-8")

            parsed = json.loads(body)
            content = (
                parsed.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
            if not isinstance(content, str) or not content.strip():
                raise ValueError("Empty OpenAI response content")

            # The assistant is instructed to return ONLY a JSON object
            mapping = json.loads(content)
            if not isinstance(mapping, dict):
                raise ValueError("OpenAI did not return a JSON object")

            out: Dict[str, str] = {}
            for k, v in mapping.items():
                if not isinstance(k, str):
                    continue
                if not isinstance(v, str):
                    continue
                kk = k.strip()
                vv = v.strip()
                if not kk:
                    continue
                if vv not in ALLOWED_CATEGORIES:
                    raise ValueError(f"Invalid mapped category '{vv}' for key '{kk}'")
                out[kk] = vv

            return out
        except Exception as e:
            last_err = e
            if attempt < max_retries:
                time.sleep(retry_sleep_sec)
                continue
            raise

    raise last_err or RuntimeError("Unknown OpenAI error")


def _validate_and_fill(mapping: Dict[str, str], expected_keys: List[str]) -> Tuple[Dict[str, str], List[str]]:
    missing: List[str] = []
    for k in expected_keys:
        if k not in mapping:
            missing.append(k)

    return mapping, missing


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="in_path", default="product_data.json")
    parser.add_argument("--out", dest="out_path", default="product_data_recategorized.json")
    parser.add_argument("--model", default="gpt-4o-mini")
    parser.add_argument("--batch-size", type=int, default=60)
    parser.add_argument("--timeout-sec", type=int, default=60)
    parser.add_argument("--max-retries", type=int, default=3)
    parser.add_argument("--retry-sleep-sec", type=float, default=2.0)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY env var is required")

    base_dir = Path(__file__).resolve().parent
    in_file = (base_dir / args.in_path).resolve()
    out_file = (base_dir / args.out_path).resolve()

    products: List[Dict[str, Any]] = json.loads(in_file.read_text(encoding="utf-8"))

    # collect unique existing categories
    old_categories_set = set()
    for p in products:
        c = p.get("category")
        if isinstance(c, str) and c.strip():
            old_categories_set.add(c.strip())

    old_categories = sorted(old_categories_set)
    print(f"Products: {len(products)}")
    print(f"Unique old categories: {len(old_categories)}")

    batches = _chunks(old_categories, args.batch_size)

    full_mapping: Dict[str, str] = {}
    for i, batch in enumerate(batches, start=1):
        print(f"Mapping batch {i}/{len(batches)} (size={len(batch)})...")
        m = _openai_map_categories(
            api_key=api_key,
            model=args.model,
            old_categories=batch,
            timeout_sec=args.timeout_sec,
            max_retries=args.max_retries,
            retry_sleep_sec=args.retry_sleep_sec,
        )
        full_mapping.update(m)

        # light delay to avoid rate limits
        if i < len(batches):
            time.sleep(0.7)

    full_mapping, missing = _validate_and_fill(full_mapping, old_categories)
    if missing:
        print("Unmapped categories (will remain unchanged):")
        for c in missing:
            print(f"- {c}")

    # apply mapping (change only category)
    changed = 0
    out_products: List[Dict[str, Any]] = []
    for p in products:
        if not isinstance(p, dict):
            out_products.append(p)
            continue

        c = p.get("category")
        if isinstance(c, str):
            old = c.strip()
            new = full_mapping.get(old)
            if isinstance(new, str) and new != c:
                pp = dict(p)
                pp["category"] = new
                out_products.append(pp)
                changed += 1
                continue

        out_products.append(p)

    print(f"Changed categories: {changed}")

    if args.dry_run:
        print("Dry-run: not writing output")
        return 0

    out_file.write_text(json.dumps(out_products, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote: {out_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
