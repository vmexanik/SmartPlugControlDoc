#!/usr/bin/env python3
"""Заморожує поточну документацію перед мажорним оновленням прошивки.

    python archive-docs.py 3.x            # нова лінія 3.x, тег-маска ^v?3\\.
    python archive-docs.py 3.x --dry-run

Що робить:
  * копіює сайт із кореня (поточна лінія, напр. 2.x) у теку 2.x/;
  * у копії assets/site.js ставить ROOT = '../' (DOC_ID лишається 2.x);
  * у кореневому assets/site.js ставить DOC_ID = нова лінія;
  * versions.json: стара лінія -> path "2.x/", latest false; нова лінія -> path "", latest true.

Після цього редагуйте сторінки в корені під нову версію; адреси поточної
документації не змінюються, стара назавжди лишається за /2.x/.
"""
import argparse
import json
import re
import shutil
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent
SKIP = {".git", ".github", ".claude", "README.md", "versions.json", ".nojekyll", "archive-docs.py", "sync-demo.py"}


def fail(msg: str) -> None:
    print(f"ПОМИЛКА: {msg}", file=sys.stderr)
    sys.exit(1)


def set_var(js: str, name: str, value: str) -> str:
    new, n = re.subn(rf"(var {name} = )'[^']*';", rf"\g<1>'{value}';", js, count=1)
    if n != 1:
        fail(f"не знайдено var {name} у assets/site.js")
    return new


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("new_id", help="нова лінія, напр. 3.x")
    ap.add_argument("--match", help="regex тегів релізів нової лінії (за замовчуванням ^v?<major>\\.)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    vfile = SITE / "versions.json"
    data = json.loads(vfile.read_text(encoding="utf-8"))
    docs = data["docs"]
    cur = next((d for d in docs if d.get("latest")), None)
    if not cur:
        fail("у versions.json немає запису з latest: true")
    old_id = cur["id"]
    if a.new_id == old_id or any(d["id"] == a.new_id for d in docs):
        fail(f"лінія {a.new_id} вже є у versions.json")

    site_js = SITE / "assets" / "site.js"
    js = site_js.read_text(encoding="utf-8")
    m = re.search(r"var DOC_ID = '([^']*)';", js)
    if not m or m.group(1) != old_id:
        fail(f"DOC_ID у assets/site.js ({m and m.group(1)}) не збігається з поточною лінією {old_id}")

    dest = SITE / old_id
    if dest.exists():
        fail(f"тека {dest} вже існує")
    archived = {d["path"].strip("/") for d in docs if d.get("path")}
    items = [p for p in SITE.iterdir() if p.name not in SKIP and p.name not in archived]

    major = re.match(r"\d+", a.new_id)
    match = a.match or (rf"^v?{major.group(0)}\." if major else None)
    if not match:
        fail("вкажіть --match для нової лінії")

    print(f"Архівую {old_id} -> {dest.name}/ ({len(items)} елементів), нова поточна лінія {a.new_id} ({match})")
    if a.dry_run:
        for p in items:
            print("  ", p.name)
        return

    dest.mkdir()
    for p in items:
        (shutil.copytree if p.is_dir() else shutil.copy2)(p, dest / p.name)

    arch_js = dest / "assets" / "site.js"
    arch_js.write_text(set_var(arch_js.read_text(encoding="utf-8"), "ROOT", "../"), encoding="utf-8", newline="\n")
    site_js.write_text(set_var(js, "DOC_ID", a.new_id), encoding="utf-8", newline="\n")

    cur["path"] = f"{old_id}/"
    cur["latest"] = False
    docs.insert(0, {"id": a.new_id, "label": a.new_id, "path": "", "match": match, "latest": True})
    vfile.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print("Готово. Тепер оновіть сторінки в корені під", a.new_id)


if __name__ == "__main__":
    main()
