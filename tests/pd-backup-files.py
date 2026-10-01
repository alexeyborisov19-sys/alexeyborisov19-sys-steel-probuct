import importlib.util
import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location("backup", Path(__file__).resolve().parents[1] / "deploy/pd-backup-files.py")
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTest(unittest.TestCase):
    def test_live_wal_snapshot_includes_committed_rows_without_wal(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "source"
            source.mkdir()
            db = sqlite3.connect(source / "personal-data.sqlite")
            try:
                db.execute("PRAGMA journal_mode=WAL")
                db.execute("CREATE TABLE evidence(value TEXT)")
                db.execute("INSERT INTO evidence VALUES ('committed')")
                db.commit()
                db.execute("INSERT INTO evidence VALUES ('uncommitted')")
                backup.stage(source, root / "snapshot")
                with sqlite3.connect(root / "snapshot/personal-data.sqlite") as restored:
                    self.assertEqual(restored.execute("SELECT * FROM evidence").fetchall(), [("committed",)])
                    self.assertEqual(restored.execute("PRAGMA integrity_check").fetchone(), ("ok",))
                self.assertFalse((root / "snapshot/personal-data.sqlite-wal").exists())
            finally:
                db.close()

    def test_symlink_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "secret").write_text("private")
            (root / "link").symlink_to(root / "secret")
            with self.assertRaises(ValueError):
                backup.stage(root / "link", root / "copy")

    def test_prune_keeps_current_recent_and_unrelated_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            old = "steelprodukt-pd-20260101T000000Z"
            keep = "steelprodukt-pd-20260102T000000Z.tar.gz.enc"
            recent = "steelprodukt-pd-20260930T000000Z.tar.gz.enc"
            for name in [old + ".tar.gz.enc", old + ".tar.gz.enc.sha256", old + ".json", keep, recent, "env.production.before"]:
                (root / name).write_text("fixture")
            self.assertEqual(backup.prune(root, keep, 30, datetime(2026, 10, 1, tzinfo=timezone.utc)), 1)
            self.assertEqual({p.name for p in root.iterdir()}, {keep, recent, "env.production.before"})

    def test_prune_rejects_symlink_companion_before_removing_archive(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            keep = "steelprodukt-pd-20261001T000000Z.tar.gz.enc"
            old = root / "steelprodukt-pd-20260101T000000Z.tar.gz.enc"
            (root / keep).write_text("fixture")
            old.write_text("fixture")
            Path(str(old) + ".sha256").symlink_to(root / keep)
            with self.assertRaises(ValueError):
                backup.prune(root, keep, 30, datetime(2026, 10, 1, tzinfo=timezone.utc))
            self.assertTrue(old.exists())


unittest.main()
