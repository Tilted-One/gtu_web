#!/usr/bin/env python3
"""Copy the newest timetable SQLite file into data/ and describe it in data/current.json.

Usage:
    python3 scripts/update_data.py                  # newest file in ../gtu_timetable_parser/output
    python3 scripts/update_data.py path/to/file.sqlite
    python3 scripts/update_data.py path/to/output_dir

The app reads data/current.json first; its "version" (a hash of the file) tells the app
whether the copy it has cached for offline use is still current.
"""

import hashlib
import json
import shutil
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DEFAULT_SOURCE = ROOT.parent / "gtu_timetable_parser" / "output"


def pick(source: Path) -> Path:
    if source.is_file():
        return source
    files = sorted(source.glob("*.sqlite"), key=lambda p: p.stat().st_mtime)
    if not files:
        sys.exit(f"no .sqlite files in {source}")
    return files[-1]


def main() -> None:
    src = pick(Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE)
    con = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    meta = dict(con.execute("SELECT key, value FROM meta"))
    lessons = con.execute("SELECT count(*) FROM lesson").fetchone()[0]
    con.close()

    raw = src.read_bytes()
    DATA.mkdir(exist_ok=True)
    for old in DATA.glob("*.sqlite"):
        if old.name != src.name:
            old.unlink()
    shutil.copyfile(src, DATA / src.name)

    current = {
        "file": src.name,
        "version": hashlib.sha256(raw).hexdigest()[:16],
        "size": len(raw),
        "lessons": lessons,
        **{k: meta.get(k) for k in (
            "period", "academic_year", "semester", "week", "week_label", "generated_at",
            "schema_version",
        )},
    }
    (DATA / "current.json").write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n",
                                       encoding="utf-8")
    print(f"data/{src.name}  version {current['version']}  week {current['week']}  "
          f"{lessons} lessons")


if __name__ == "__main__":
    main()
