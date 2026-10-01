#!/usr/bin/env python3
"""Private staging and narrowly scoped retention for verified PD backups."""
import argparse
import os
import re
import shutil
import sqlite3
from contextlib import closing
from datetime import datetime, timezone, timedelta
from pathlib import Path


def regular(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError("Unsafe backup file")


def is_sqlite(path):
    regular(path)
    with path.open("rb") as source:
        return source.read(16) == b"SQLite format 3\x00"


def stage(source, target):
    if source.is_symlink():
        raise ValueError("Symlink in source")
    if source.is_dir():
        target.mkdir(parents=True, mode=0o700, exist_ok=False)
        entries = list(source.iterdir())
        databases = {p.name for p in entries if p.is_file() and is_sqlite(p)}
        for child in entries:
            if child.is_symlink():
                raise ValueError("Symlink in source")
            if any(child.name == name + suffix for name in databases for suffix in ("-wal", "-shm", "-journal")):
                continue
            stage(child, target / child.name)
        return
    regular(source)
    target.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
    if target.exists() or target.is_symlink():
        raise ValueError("Staging target already exists")
    if is_sqlite(source):
        with closing(sqlite3.connect(source.resolve().as_uri() + "?mode=ro", uri=True)) as db:
            with closing(sqlite3.connect(target)) as snapshot:
                db.backup(snapshot)
                snapshot.execute("PRAGMA journal_mode=DELETE")
                if snapshot.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
                    raise ValueError("SQLite snapshot integrity failed")
    else:
        shutil.copyfile(source, target, follow_symlinks=False)
    target.chmod(0o600)


def prune(root, keep, days, now=None):
    if root.is_symlink() or not root.is_dir() or not 1 <= days <= 3650:
        raise ValueError("Invalid retention configuration")
    regular(root / keep)
    pattern = re.compile(r"steelprodukt-pd-(\d{8}T\d{6}Z)\.tar\.gz\.enc")
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=days)
    removed = 0
    for archive in root.iterdir():
        match = pattern.fullmatch(archive.name)
        if not match or archive.name == keep:
            continue
        created = datetime.strptime(match[1], "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
        if created >= cutoff:
            continue
        members = [archive, Path(str(archive) + ".sha256"), root / (archive.name[:-11] + ".json")]
        # Do not remove arbitrary files, directories, deployment snapshots or symlinks.
        for member in members:
            if member.exists() or member.is_symlink():
                regular(member)
        for member in members:
            if member.exists():
                member.unlink()
        removed += 1
    return removed


if __name__ == "__main__":
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["stage", "prune"])
    parser.add_argument("source", type=Path)
    parser.add_argument("target")
    parser.add_argument("--days", type=int, default=30)
    args = parser.parse_args()
    try:
        if args.operation == "stage":
            stage(args.source, Path(args.target))
        else:
            print("expired_local_archives_removed=" + str(prune(args.source, args.target, args.days)))
    except Exception:
        raise SystemExit("PD backup staging/retention failed; inspect protected source locally") from None
