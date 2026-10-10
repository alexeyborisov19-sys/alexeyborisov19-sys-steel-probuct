"""Synthetic fixtures only: no production paths or external commands are used."""
import contextlib
from dataclasses import replace
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("offsite_recovery", ROOT / "deploy/verify-offsite-recovery.py")
recovery = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = recovery
SPEC.loader.exec_module(recovery)
NEW = (ROOT / "deploy/backup-personal-data-offsite.sh").read_bytes()
OLD = NEW.replace(b"# Drain the sorted listing so large backup directories do not trigger SIGPIPE.\n", b"").replace(b"| sed -n '1p' |", b"| head -1 |")
NOW = 1791655200  # 2026-10-10 18:00 UTC, independent of the test machine's clock.
STAMP = "20261010T160000Z"
PRIVATE = "private-contact-secret-never-logged"


class FakeCommands:
    def __init__(self, fixture):
        self.fixture = fixture
        self.calls = []
        self.remote_code = 0
        self.remote = {"Name": fixture.archive.name, "Path": fixture.archive.name,
                       "IsDir": False, "Size": len(fixture.ciphertext)}
        self.download = fixture.ciphertext
        self.download_code = 0
        self.stream_error = None
        self.on_download = None
        self.service_changes = {}
        self.service_code = 0
        self.typed_outputs = {"ExecStartPre": b"a(sasbttttuii) 0\n", "ExecStartPost": b"a(sasbttttuii) 0\n",
                              "EnvironmentFiles": b"a(sb) 0\n"}
        self.typed_codes = {}
        self.typed_error = None
        self.next_run = "Sat 2026-10-10 23:30:00 UTC"
        self.syntax_code = 0

    def run(self, args, **kwargs):
        self.calls.append((args, kwargs))
        if args[:2] == ["/usr/bin/systemctl", "show"]:
            if args[2].endswith(".timer"):
                return 0, ("ActiveState=active\nSubState=waiting\nNextElapseUSecRealtime=" + self.next_run + "\n").encode()
            values = {
                "ActiveState": "failed", "SubState": "failed", "MainPID": "0",
                "ExecStart": "{ path=" + str(self.fixture.policy.installed) + " ; argv[]=" + str(self.fixture.policy.installed) + " ; ignore_errors=no ; }",
                "ExecStartPre": "", "ExecStartPost": "", "Environment": "PD_OFFSITE_RETENTION_DAYS=30",
                "EnvironmentFiles": "", "DropInPaths": "", "User": "root", "Group": "root",
            }
            values.update(self.service_changes)
            # systemd v249's custom STRUCT ARRAY printer emits these three
            # fields only per entry, so their empty arrays have no text line.
            values = {key: value for key, value in values.items()
                      if value or key not in {"ExecStartPre", "ExecStartPost", "EnvironmentFiles"}}
            return self.service_code, "\n".join(k + "=" + v for k, v in values.items()).encode()
        if args[:5] == ["/usr/bin/busctl", "--system", "--no-pager", "--timeout=10", "get-property"]:
            self.fixture.assertEqual(args[5:8], ["org.freedesktop.systemd1",
                                                "/org/freedesktop/systemd1/unit/steelprodukt_2dpd_2doffsite_2dbackup_2eservice",
                                                "org.freedesktop.systemd1.Service"])
            self.fixture.assertEqual(len(args), 9)
            self.fixture.assertIn(args[8], self.typed_outputs)
            self.fixture.assertEqual(kwargs, {"timeout": 20, "maximum": 4096})
            if self.typed_error:
                raise self.typed_error
            return self.typed_codes.get(args[8], 0), self.typed_outputs[args[8]]
        if args[:2] == ["/usr/bin/bash", "-n"]:
            return self.syntax_code, PRIVATE.encode()
        if args[:2] == ["/usr/bin/rclone", "--config"]:
            command = args[3]
            if command == "lsjson":
                return self.remote_code, (json.dumps(self.remote).encode() if self.remote_code == 0 else PRIVATE.encode())
            if command == "copyto":
                self.fixture.assertTrue(args[4].startswith(self.fixture.policy.remote + "/"))
                destination = Path(args[5])
                self.fixture.assertEqual(destination.parent.parent, self.fixture.policy.backups)
                self.fixture.assertTrue(destination.parent.name.startswith(".offsite-readonly-"))
                self.fixture.assertEqual(stat.S_IMODE(destination.parent.stat().st_mode), 0o700)
                self.fixture.assertEqual(kwargs["file_limit"], len(self.fixture.ciphertext))
                destination.write_bytes(self.download)
                destination.chmod(0o600)
                if self.on_download:
                    self.on_download()
                return self.download_code, PRIVATE.encode()
        raise AssertionError("Command outside the read-only allowlist")

    def stream_count(self, archive_fd, key_fd):
        self.calls.append((["STREAM_COUNT"], {}))
        self.fixture.assertEqual(os.pread(archive_fd, 1024, 0), self.fixture.ciphertext)
        self.fixture.assertEqual(os.pread(key_fd, 1024, 0), PRIVATE.encode())
        if self.stream_error:
            raise self.stream_error
        return 37


class FakeUploadCommands(FakeCommands):
    """In-memory S3 boundary; conditional conflicts never mutate stored data."""
    def __init__(self, fixture):
        super().__init__(fixture)
        self.version = b"rclone v1.72.0\n- os/version: " + PRIVATE.encode() + b"\n"
        self.family = {fixture.archive.name: fixture.ciphertext,
                       fixture.hashfile.name: fixture.hashfile.read_bytes(),
                       fixture.report.name: fixture.report.read_bytes()}
        self.objects = {name: None for name in self.family}
        self.uploads = []
        self.downloads = []
        self.download_paths = []
        self.metadata_codes = {}
        self.metadata_overrides = {}
        self.upload_failure_at = None
        self.write_before_failure = False
        self.race_before_upload = None
        self.after_metadata = None

    def run(self, args, **kwargs):
        if args == ["/usr/bin/rclone", "version"]:
            self.calls.append((args, kwargs))
            return 0, self.version
        if args[:2] != ["/usr/bin/rclone", "--config"]:
            return super().run(args, **kwargs)
        self.calls.append((args, kwargs))
        self.fixture.assertNotIn("--header", args)
        self.fixture.assertEqual(args.count("--retries"), 1)
        self.fixture.assertEqual(args[args.index("--retries") + 1], "1")
        self.fixture.assertEqual(args[args.index("--low-level-retries") + 1], "1")
        if args[3] == "lsjson":
            name = args[5].removeprefix(self.fixture.policy.remote + "/")
            self.fixture.assertIn(name, self.family)
            payload = self.objects[name]
            metadata = {"Name": "" if payload is None else name, "Path": "" if payload is None else name, "IsDir": payload is None,
                        "Size": -1 if payload is None else len(payload)}
            metadata.update(self.metadata_overrides.get(name, {}))
            if self.after_metadata:
                self.after_metadata()
            return self.metadata_codes.get(name, 0), json.dumps(metadata).encode()
        self.fixture.assertEqual(args[3], "copyto")
        if args[4].startswith(self.fixture.policy.remote + "/"):
            self.fixture.assertNotIn("--header-upload", args)
            name = args[4].removeprefix(self.fixture.policy.remote + "/")
            self.fixture.assertIn(name, self.family)
            payload = self.objects[name]
            self.fixture.assertIsNotNone(payload)
            target = Path(args[5])
            self.fixture.assertFalse(target.exists())
            self.fixture.assertNotIn(target, self.download_paths)
            self.download_paths.append(target)
            self.fixture.assertEqual(target.parent.parent, self.fixture.backups)
            self.fixture.assertEqual(stat.S_IMODE(target.parent.stat().st_mode), 0o700)
            self.fixture.assertEqual(kwargs["file_limit"], len(self.family[name]))
            target.write_bytes(payload)
            target.chmod(0o600)
            self.downloads.append(name)
            if self.on_download:
                self.on_download()
            return self.download_code, PRIVATE.encode()
        name = args[5].removeprefix(self.fixture.policy.remote + "/")
        self.fixture.assertIn(name, self.family)
        source = Path(args[4])
        self.fixture.assertEqual(source.parent.parent, self.fixture.backups)
        self.fixture.assertEqual(stat.S_IMODE(source.parent.stat().st_mode), 0o700)
        self.fixture.assertEqual(stat.S_IMODE(source.stat().st_mode), 0o400)
        self.fixture.assertEqual(source.read_bytes(), self.family[name])
        for required in ("--ignore-existing", "--no-update-modtime", "--inplace", "--ignore-size", "--ignore-checksum"):
            self.fixture.assertIn(required, args)
        for flag, value in (("--header-upload", "If-None-Match:*"), ("--s3-upload-cutoff", "64M"),
                            ("--multi-thread-streams", "0"), ("--s3-acl", "private")):
            self.fixture.assertEqual(args[args.index(flag) + 1], value)
        self.fixture.assertNotIn("--s3-no-head", args)
        self.uploads.append(name)
        if self.race_before_upload:
            self.race_before_upload(name)
        if self.upload_failure_at == len(self.uploads):
            if self.write_before_failure and self.objects[name] is None:
                self.objects[name] = source.read_bytes()
            return 1, ("412 " + PRIVATE).encode()
        # --ignore-existing skips a race winner, even if its content differs.
        if self.objects[name] is None:
            self.objects[name] = source.read_bytes()
        return 0, PRIVATE.encode()


class RecoveryTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.bin = self.root / "sbin"
        self.bin.mkdir(mode=0o700)
        self.backups = self.root / "backups"
        self.backups.mkdir(mode=0o700)
        self.config = self.root / "rclone.conf"
        self.key = self.root / "key"
        self.source = self.root / "trusted-script"
        self.installed = self.bin / "installed-script"
        self.archive = self.backups / ("steelprodukt-pd-" + STAMP + ".tar.gz.enc")
        self.hashfile = Path(str(self.archive) + ".sha256")
        self.report = self.backups / ("steelprodukt-pd-" + STAMP + ".json")
        self.ciphertext = b"Salted__synthetic-ciphertext-no-records"
        self.expected = hashlib.sha256(self.ciphertext).hexdigest()
        self.policy = recovery.Policy(installed=self.installed, backups=self.backups, config=self.config,
                                      key=self.key, uid=os.geteuid(), gid=os.getegid())
        self.write(self.config, ("[beget_pd_backup]\ntype = s3\nprovider = Other\nregion = ru1\n"
                                 "endpoint = https://s3.ru1.storage.beget.cloud\naccess_key_id = " + PRIVATE + "\nsecret_access_key = " + PRIVATE + "\n").encode())
        self.write(self.key, PRIVATE.encode())
        self.write(self.source, NEW)
        self.write(self.installed, OLD, 0o750)
        self.write(self.backups / ".backup.lock", b"")
        self.write(self.archive, self.ciphertext)
        os.utime(self.archive, (NOW - 7200, NOW - 7190))
        self.write(self.hashfile, (self.expected + "  " + str(self.archive) + "\n").encode())
        self.write(self.report, json.dumps({"restore_tested": True, "encrypted": True, "created_at": STAMP,
                                           "archive_bytes": len(self.ciphertext), "archive_sha256": self.expected}).encode())
        self.commands = FakeCommands(self)

    @staticmethod
    def write(path, data, mode=0o600):
        path.write_bytes(data)
        path.chmod(mode)

    def run_recovery(self, expected="OK", mode="repair_readonly"):
        with contextlib.redirect_stdout(io.StringIO()) as stdout, contextlib.redirect_stderr(io.StringIO()) as stderr:
            code, result = recovery.execute(self.source, self.policy, self.commands, NOW, mode=mode)
        self.assertEqual(result["status"], expected, result)
        self.assertEqual(code, 0 if expected == "OK" else 1)
        self.assertEqual(stdout.getvalue(), "")
        self.assertEqual(stderr.getvalue(), "")
        encoded = json.dumps(result)
        for sensitive in (PRIVATE, self.expected, self.archive.name, str(self.root), recovery.OLD_SHA256, recovery.NEW_SHA256):
            self.assertNotIn(sensitive, encoded)
        if mode == "upload_approved_existing":
            self.assertNotIn("upload_performed", result)
            self.assertLessEqual(result["upload_objects_attempted"], 3)
            self.assertIn(result["upload_outcome"], {"not_attempted", "attempted_unverified", "verified_matching"})
        else:
            self.assertFalse(result["upload_performed"])
        self.assertFalse(result["deletion_performed"])
        self.assertEqual(list(self.backups.glob(".offsite-readonly-*")), [])
        self.assertEqual(list(self.bin.glob(".offsite-replacement-*")), [])
        return result

    def enable_upload(self):
        self.write(self.installed, NEW, 0o750)
        self.policy = replace(self.policy, approved_archive_bytes=len(self.ciphertext),
                              approved_window_start=STAMP, approved_window_end=STAMP)
        self.commands = FakeUploadCommands(self)

    def run_upload(self, expected="OK"):
        return self.run_recovery(expected, mode="upload_approved_existing")

    def test_verify_only_accepts_exact_current_script_without_replacing(self):
        self.write(self.installed, NEW, 0o750)
        inode = self.installed.stat().st_ino
        result = self.run_recovery(mode="verify_only")
        self.assertEqual(result["installed_script"], "already_current")
        self.assertEqual(self.installed.stat().st_ino, inode)
        self.assertEqual(list(self.backups.glob(".offsite-repair-*")), [])

    def test_verify_only_rejects_old_script_without_repair_or_s3_access(self):
        self.run_recovery("SCRIPT_HASH_MISMATCH", mode="verify_only")
        self.assertEqual(self.installed.read_bytes(), OLD)
        self.assert_no_remote()
        self.assertEqual(list(self.backups.glob(".offsite-repair-*")), [])

    def test_upload_requires_explicit_mode_default_stays_read_only(self):
        self.enable_upload()
        self.run_recovery("REMOTE_MISSING")
        self.assertEqual(self.commands.uploads, [])
        self.assertFalse(any(args == ["/usr/bin/rclone", "version"] for args, _ in self.commands.calls))

    def test_approved_upload_sends_exact_three_objects_then_verifies(self):
        self.enable_upload()
        result = self.run_upload()
        self.assertEqual(self.commands.uploads, list(self.commands.family))
        self.assertEqual(self.commands.objects, self.commands.family)
        self.assertEqual(result["upload_objects_attempted"], 3)
        self.assertTrue(result["upload_attempted"])
        self.assertTrue(result["conditional_upload_client_supported"])
        self.assertTrue(result["remote_sidecars_verified"])
        self.assertEqual(result["remote_objects_verified"], 3)
        self.assertEqual(result["upload_outcome"], "verified_matching")
        self.assertEqual(self.archive.read_bytes(), self.ciphertext)
        self.assertEqual(list(self.backups.glob(".offsite-repair-*")), [])

    def test_all_existing_matching_objects_are_verified_without_upload(self):
        self.enable_upload()
        self.commands.objects = dict(self.commands.family)
        result = self.run_upload()
        self.assertEqual(self.commands.uploads, [])
        self.assertEqual(len(self.commands.downloads), 3)
        self.assertFalse(result["upload_attempted"])
        self.assertEqual(result["remote_objects_verified"], 3)

    def test_matching_rerun_does_not_upload_again(self):
        self.enable_upload()
        self.run_upload()
        self.commands.uploads.clear()
        self.commands.downloads.clear()
        self.run_upload()
        self.assertEqual(self.commands.uploads, [])
        self.assertEqual(len(self.commands.downloads), 3)

    def test_all_existing_hashes_are_checked_before_any_missing_object_upload(self):
        self.enable_upload()
        self.commands.objects[self.report.name] = b"x" * len(self.commands.family[self.report.name])
        self.run_upload("REMOTE_HASH_MISMATCH")
        self.assertEqual(self.commands.uploads, [])
        self.assertIsNone(self.commands.objects[self.archive.name])

    def test_existing_size_mismatch_blocks_all_uploads(self):
        self.enable_upload()
        self.commands.objects[self.hashfile.name] = b"wrong-size"
        self.run_upload("REMOTE_SIZE_MISMATCH")
        self.assertEqual(self.commands.uploads, [])

    def test_old_prerelease_or_unrecognized_rclone_never_uploads(self):
        self.enable_upload()
        for version in (b"rclone v1.71.9\n", b"rclone v1.72.1\n", b"rclone v1.73.0\n", b"rclone v1.75.2\n",
                        b"rclone v2.0.0\n", b"rclone v1.72.0-beta\n", b"rclone v1.72.0-DEV\n", PRIVATE.encode()):
            with self.subTest(version=version):
                self.commands.version = version
                result = self.run_upload("RCLONE_VERSION_UNSUPPORTED")
                self.assertFalse(result["conditional_upload_client_supported"])
                self.assertEqual(self.commands.uploads, [])
                self.assertEqual(self.commands.downloads, [])

    def test_mixed_family_uses_fresh_download_paths_for_final_readback(self):
        self.enable_upload()
        self.commands.objects[self.archive.name] = self.ciphertext
        self.run_upload()
        self.assertEqual(self.commands.downloads.count(self.archive.name), 2)
        self.assertEqual(len(self.commands.download_paths), len(set(self.commands.download_paths)))
        self.assertEqual(self.commands.uploads, [self.hashfile.name, self.report.name])

    def test_singlepart_size_limit_is_strict_before_any_remote_access(self):
        self.enable_upload()
        size = 64 * 1024 * 1024
        with self.archive.open("wb") as archive:
            archive.truncate(size)
        os.utime(self.archive, (NOW - 7200, NOW - 7190))
        value = hashlib.sha256()
        for _ in range(64):
            value.update(bytes(1024 * 1024))
        self.expected = value.hexdigest()
        self.write(self.hashfile, (self.expected + "  " + str(self.archive) + "\n").encode())
        metadata = json.loads(self.report.read_bytes())
        metadata.update(archive_bytes=size, archive_sha256=self.expected)
        self.write(self.report, json.dumps(metadata).encode())
        self.policy = replace(self.policy, approved_archive_bytes=size)
        self.run_upload("BOUNDS_EXCEEDED")
        self.assertFalse(any(args[:2] == ["/usr/bin/rclone", "--config"] for args, _ in self.commands.calls))

    def test_config_mutation_before_upload_stops_without_sending(self):
        self.enable_upload()
        self.commands.after_metadata = lambda: self.config.write_bytes(PRIVATE.encode())
        self.run_upload("LOCAL_CHANGED")
        self.assertEqual(self.commands.uploads, [])

    def test_nonzero_or_ambiguous_remote_metadata_never_means_missing(self):
        self.enable_upload()
        self.commands.metadata_codes[self.archive.name] = 7
        self.run_upload("REMOTE_METADATA_FAILED")
        self.commands.metadata_codes.clear()
        self.commands.metadata_overrides[self.archive.name] = {"Size": 0}
        self.run_upload("REMOTE_METADATA_FAILED")
        self.commands.metadata_overrides[self.archive.name] = {"Name": PRIVATE}
        self.run_upload("REMOTE_METADATA_FAILED")
        self.assertEqual(self.commands.uploads, [])

    def test_approved_selection_ignores_newer_unapproved_archive(self):
        self.enable_upload()
        newer = self.backups / "steelprodukt-pd-20261010T170000Z.tar.gz.enc"
        self.write(newer, self.ciphertext)
        self.run_upload()
        self.assertNotIn(newer.name, self.commands.uploads)

    def test_approved_selection_rejects_missing_or_ambiguous_candidates(self):
        self.enable_upload()
        self.policy = replace(self.policy, approved_archive_bytes=len(self.ciphertext) + 1)
        self.run_upload("APPROVED_ARCHIVE_MISSING")
        self.policy = replace(self.policy, approved_archive_bytes=len(self.ciphertext), approved_window_end="20261010T160005Z")
        self.write(self.backups / "steelprodukt-pd-20261010T160001Z.tar.gz.enc", self.ciphertext)
        self.run_upload("APPROVED_ARCHIVE_AMBIGUOUS")
        self.assertEqual(self.commands.uploads, [])

    def test_local_mutation_before_upload_stops_without_sending(self):
        self.enable_upload()
        self.commands.after_metadata = lambda: self.report.write_bytes(b"{}")
        self.run_upload("LOCAL_CHANGED")
        self.assertEqual(self.commands.uploads, [])

    def test_local_decryption_failure_blocks_upload(self):
        self.enable_upload()
        self.commands.stream_error = recovery.Stop("STREAM_FAILED")
        self.run_upload("STREAM_FAILED")
        self.assertEqual(self.commands.uploads, [])

    def test_conditional_conflict_stops_with_no_retry_or_fallback(self):
        self.enable_upload()
        self.commands.upload_failure_at = 1
        result = self.run_upload("UPLOAD_FAILED_UNCERTAIN")
        self.assertEqual(len(self.commands.uploads), 1)
        self.assertEqual(result["upload_outcome"], "attempted_unverified")
        self.assertTrue(result["upload_attempted"])
        self.assertEqual(result["remote_objects_verified"], 0)

    def test_partial_or_uncertain_success_is_reported_truthfully_and_preserved(self):
        self.enable_upload()
        self.commands.upload_failure_at = 2
        self.commands.write_before_failure = True
        result = self.run_upload("UPLOAD_FAILED_UNCERTAIN")
        self.assertEqual(result["upload_objects_attempted"], 2)
        self.assertEqual(self.commands.objects[self.archive.name], self.ciphertext)
        self.assertEqual(self.commands.objects[self.hashfile.name], self.commands.family[self.hashfile.name])
        self.assertIsNone(self.commands.objects[self.report.name])
        self.assertEqual(result["upload_outcome"], "attempted_unverified")

    def test_raced_existing_object_is_not_overwritten_and_mismatch_fails_readback(self):
        self.enable_upload()
        def race(name):
            if name == self.archive.name:
                self.commands.objects[name] = b"x" * len(self.ciphertext)
        self.commands.race_before_upload = race
        self.run_upload("REMOTE_HASH_MISMATCH")
        self.assertEqual(self.commands.objects[self.archive.name], b"x" * len(self.ciphertext))
        self.assertEqual(len(self.commands.uploads), 1)

    def test_upload_refuses_old_installed_script_without_repair(self):
        self.enable_upload()
        self.write(self.installed, OLD, 0o750)
        self.run_upload("SCRIPT_HASH_MISMATCH")
        self.assertEqual(self.installed.read_bytes(), OLD)
        self.assertEqual(self.commands.uploads, [])

    def assert_no_remote(self):
        self.assertFalse(any(args[0] == "/usr/bin/rclone" for args, _ in self.commands.calls))

    def assert_no_download(self):
        self.assertFalse(any("copyto" in args for args, _ in self.commands.calls))

    def test_source_and_baseline_are_exact_reviewed_digests(self):
        self.assertEqual(hashlib.sha256(OLD).hexdigest(), recovery.OLD_SHA256)
        self.assertEqual(hashlib.sha256(NEW).hexdigest(), recovery.NEW_SHA256)

    def test_success_retains_private_original_and_exact_metadata(self):
        os.utime(self.installed, ns=(1234567000000000000, 1234567890000000000))
        before = self.installed.stat()
        if os.geteuid() == 0:
            os.setxattr(self.installed, "user.synthetic", b"safe")
        result = self.run_recovery()
        self.assertEqual(result["installed_script"], "replaced")
        self.assertEqual(result["items_in_archive"], 37)
        self.assertTrue(result["stream_readable"])
        after = self.installed.stat()
        self.assertEqual((before.st_uid, before.st_gid, before.st_mode, before.st_mtime_ns),
                         (after.st_uid, after.st_gid, after.st_mode, after.st_mtime_ns))
        if os.geteuid() == 0:
            self.assertEqual(after.st_atime_ns, before.st_atime_ns)
            self.assertEqual(os.getxattr(self.installed, "user.synthetic"), b"safe")
        self.assertEqual(self.installed.read_bytes(), NEW)
        backups = list(self.backups.glob(".offsite-repair-*/original-script"))
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].read_bytes(), OLD)
        self.assertEqual(stat.S_IMODE(backups[0].parent.stat().st_mode), 0o700)
        self.assertEqual(self.archive.read_bytes(), self.ciphertext)

    def test_exact_new_hash_is_idempotent(self):
        self.write(self.installed, NEW, 0o750)
        inode = self.installed.stat().st_ino
        result = self.run_recovery()
        self.assertEqual(result["installed_script"], "already_current")
        self.assertEqual(self.installed.stat().st_ino, inode)
        self.assertEqual(list(self.backups.glob(".offsite-repair-*")), [])

    def test_unknown_installed_hash_never_replaced(self):
        self.write(self.installed, b"unexpected-private-source", 0o750)
        self.run_recovery("SCRIPT_HASH_MISMATCH")
        self.assertEqual(self.installed.read_bytes(), b"unexpected-private-source")
        self.assert_no_remote()

    def test_unknown_source_hash_never_installed(self):
        self.write(self.source, NEW + b"\n")
        self.run_recovery("SOURCE_HASH_MISMATCH")
        self.assertEqual(self.installed.read_bytes(), OLD)
        self.assert_no_remote()

    def test_bash_syntax_failure_stops_installation(self):
        self.commands.syntax_code = 1
        self.run_recovery("SYNTAX_FAILED")
        self.assertEqual(self.installed.read_bytes(), OLD)

    def test_executable_unsafe_mode_is_rejected(self):
        self.installed.chmod(0o777)
        self.run_recovery("METADATA_MISMATCH")
        self.assert_no_remote()

    def test_unexpected_installed_owner_is_rejected(self):
        real = os.fstat
        def changed(fd):
            info = real(fd)
            if info.st_ino == self.installed.stat().st_ino:
                values = list(info)
                values[4] = info.st_uid + 1
                return os.stat_result(values)
            return info
        with patch.object(recovery.os, "fstat", side_effect=changed):
            self.run_recovery("METADATA_MISMATCH")
        self.assert_no_remote()

    def test_installed_symlink_is_rejected(self):
        self.installed.unlink()
        self.installed.symlink_to(self.source)
        self.run_recovery("UNSAFE_PATH")
        self.assert_no_remote()

    def test_source_symlink_is_rejected(self):
        self.source.unlink()
        self.source.symlink_to(self.installed)
        self.run_recovery("UNSAFE_PATH")

    def test_archive_symlink_is_rejected(self):
        self.archive.unlink()
        self.archive.symlink_to(self.source)
        self.run_recovery("UNSAFE_PATH")
        self.assert_no_remote()

    def test_hardlinked_installed_file_is_rejected(self):
        os.link(self.installed, self.root / "second-link")
        self.run_recovery("METADATA_MISMATCH")

    def test_existing_backup_lock_blocks_concurrent_operation(self):
        with (self.backups / ".backup.lock").open("r+b") as lock:
            recovery.fcntl.flock(lock.fileno(), recovery.fcntl.LOCK_EX | recovery.fcntl.LOCK_NB)
            self.run_recovery("LOCKED")
        self.assertEqual(self.commands.calls, [])
        self.assertEqual(self.installed.read_bytes(), OLD)

    def test_active_service_blocks_installation(self):
        self.commands.service_changes["ActiveState"] = "active"
        self.run_recovery("SERVICE_BUSY")
        self.assertEqual(self.installed.read_bytes(), OLD)

    def test_unexpected_service_environment_blocks_installation(self):
        self.commands.service_changes["Environment"] = "PD_OFFSITE_REMOTE=other:private"
        self.run_recovery("SERVICE_ENV_MISMATCH")
        self.assertEqual(self.installed.read_bytes(), OLD)

    def test_service_predicate_diagnostics_are_fixed_nonleaking_and_stop_before_other_reads(self):
        cases = (
            ("ExecStart", PRIVATE, "SERVICE_EXEC_START_MISMATCH"),
            ("User", PRIVATE, "SERVICE_IDENTITY_MISMATCH"),
            ("Group", PRIVATE, "SERVICE_IDENTITY_MISMATCH"),
            ("ExecStartPre", PRIVATE, "SERVICE_HOOKS_MISMATCH"),
            ("ExecStartPost", PRIVATE, "SERVICE_HOOKS_MISMATCH"),
            ("EnvironmentFiles", PRIVATE, "SERVICE_ENV_FILES_MISMATCH"),
            ("DropInPaths", PRIVATE, "SERVICE_DROPINS_MISMATCH"),
            ("Environment", PRIVATE, "SERVICE_ENV_MISMATCH"),
            ("Environment", "'" + PRIVATE, "SERVICE_ENV_MISMATCH"),
        )
        for field, value, status in cases:
            with self.subTest(field=field, value=value):
                self.commands.service_changes = {field: value}
                self.commands.calls.clear()
                result = self.run_recovery(status)
                self.assertEqual(result["installed_script"], "unchanged")
                self.assertEqual(self.installed.read_bytes(), OLD)
                self.assertEqual(len(self.commands.calls), 1)
                self.assertEqual(self.commands.calls[0][0][:3],
                                 ["/usr/bin/systemctl", "show", "steelprodukt-pd-offsite-backup.service"])

    def test_service_query_failure_is_distinct_and_does_not_leak_properties(self):
        self.commands.service_code = 1
        self.commands.service_changes = {"Environment": PRIVATE}
        self.run_recovery("SERVICE_QUERY_FAILED")
        self.assertEqual(len(self.commands.calls), 1)
        self.assertEqual(self.installed.read_bytes(), OLD)

    def test_typed_empty_struct_arrays_prove_absent_formatted_fields(self):
        self.run_recovery()
        typed = [args for args, _ in self.commands.calls if args[0] == "/usr/bin/busctl"]
        self.assertEqual([args[-1] for args in typed], ["ExecStartPre", "ExecStartPost", "EnvironmentFiles"])
        self.assertEqual(len(typed), 3)

    def test_typed_nonempty_malformed_and_missing_values_remain_fail_closed(self):
        for field in ("ExecStartPre", "ExecStartPost", "EnvironmentFiles"):
            expected = "SERVICE_ENV_FILES_MISMATCH" if field == "EnvironmentFiles" else "SERVICE_HOOKS_MISMATCH"
            original = self.commands.typed_outputs[field]
            for bad in (b"", b"as 0\n", b"a(sb) 0\nextra", b"a(sasbttttuii) 0\nextra",
                        b"a(sasbttttuii) 1 " + PRIVATE.encode(), b"a(sb) 1 " + PRIVATE.encode()):
                with self.subTest(field=field, value=bad):
                    self.commands.typed_outputs[field] = bad
                    self.commands.calls.clear()
                    result = self.run_recovery(expected)
                    self.assertEqual(result["installed_script"], "unchanged")
                    self.assertEqual(self.installed.read_bytes(), OLD)
                    self.assertTrue(all(args[0] in {"/usr/bin/systemctl", "/usr/bin/busctl"}
                                        for args, _ in self.commands.calls))
                    self.assertEqual(self.commands.calls[-1][0][-1], field)
            self.commands.typed_outputs[field] = original

    def test_typed_query_errors_fail_closed_without_raw_output(self):
        for field in ("ExecStartPre", "ExecStartPost", "EnvironmentFiles"):
            with self.subTest(field=field):
                self.commands.typed_codes = {field: 1}
                self.run_recovery("SERVICE_QUERY_FAILED")
                self.assertEqual(self.installed.read_bytes(), OLD)
                self.assert_no_remote()

    def test_missing_busctl_fails_closed_without_exception_text(self):
        self.commands.typed_error = FileNotFoundError(PRIVATE)
        self.run_recovery("SERVICE_QUERY_FAILED")
        self.assertEqual(self.installed.read_bytes(), OLD)

    def test_imminent_timer_blocks_installation(self):
        self.commands.next_run = "Sat 2026-10-10 18:05:00 UTC"
        self.run_recovery("TIMER_UNSAFE")
        self.assertEqual(self.installed.read_bytes(), OLD)

    def test_wrong_remote_endpoint_fails_before_installation(self):
        self.write(self.config, self.config.read_bytes().replace(b"storage.beget.cloud", b"other.example"))
        self.run_recovery("REMOTE_CONFIG_MISMATCH")
        self.assertEqual(self.installed.read_bytes(), OLD)

    def test_download_url_and_other_routing_overrides_are_rejected(self):
        for extra in (b"download_url = https://unapproved.invalid\n", b"use_accelerate_endpoint = true\n"):
            with self.subTest(extra=extra):
                original = self.config.read_bytes()
                self.write(self.config, original + extra)
                self.run_recovery("REMOTE_CONFIG_MISMATCH")
                self.assertEqual(self.installed.read_bytes(), OLD)
                self.assert_no_remote()
                self.write(self.config, original)

    def test_missing_static_credentials_are_rejected(self):
        self.write(self.config, self.config.read_bytes().replace(("secret_access_key = " + PRIVATE).encode(), b"secret_access_key = "))
        self.run_recovery("REMOTE_CONFIG_MISMATCH")
        self.assert_no_remote()

    def test_insufficient_disk_space_stops_before_download(self):
        with patch.object(recovery.os, "statvfs", return_value=os.statvfs_result((4096, 4096, 100, 100, 1, 0, 0, 0, 0, 255))):
            self.run_recovery("INSUFFICIENT_SPACE")
        self.assert_no_download()

    def test_post_replace_failure_reports_script_may_have_changed(self):
        real = recovery.os.replace
        def replace_then_fail(source, target):
            real(source, target)
            raise OSError(PRIVATE)
        with patch.object(recovery.os, "replace", side_effect=replace_then_fail):
            result = self.run_recovery("INTERNAL_ERROR")
        self.assertEqual(result["installed_script"], "replacement_attempted")
        self.assertEqual(self.installed.read_bytes(), NEW)

    def test_missing_remote_reported_as_directory_stops_without_download(self):
        self.commands.remote["IsDir"] = True
        self.run_recovery("REMOTE_MISSING")
        self.assert_no_download()

    def test_remote_auth_failure_is_not_reported_as_missing(self):
        self.commands.remote_code = 7
        self.run_recovery("REMOTE_METADATA_FAILED")
        self.assert_no_download()

    def test_remote_wrong_identity_stops_without_download(self):
        self.commands.remote["Path"] = "other-private-object"
        self.run_recovery("REMOTE_METADATA_FAILED")
        self.assert_no_download()

    def test_remote_size_mismatch_stops_without_download(self):
        self.commands.remote["Size"] += 1
        self.run_recovery("REMOTE_SIZE_MISMATCH")
        self.assert_no_download()

    def test_downloaded_hash_mismatch_stops_before_decrypt(self):
        self.commands.download = b"x" * len(self.ciphertext)
        self.run_recovery("REMOTE_HASH_MISMATCH")
        self.assertFalse(any(args == ["STREAM_COUNT"] for args, _ in self.commands.calls))

    def test_download_error_cleans_only_created_validation_directory(self):
        unrelated = self.backups / "unrelated-encrypted-copy"
        unrelated.write_bytes(b"keep")
        self.commands.download_code = 3
        self.run_recovery("DOWNLOAD_FAILED")
        self.assertEqual(unrelated.read_bytes(), b"keep")

    def test_failed_decryption_is_fixed_status_and_cleans_temp(self):
        self.commands.stream_error = recovery.Stop("STREAM_FAILED")
        self.run_recovery("STREAM_FAILED")

    def test_raw_exception_never_leaks(self):
        self.commands.stream_error = RuntimeError(PRIVATE + self.archive.name)
        self.run_recovery("INTERNAL_ERROR")

    def test_local_bad_digest_blocks_remote_read(self):
        self.write(self.archive, b"x" * len(self.ciphertext))
        os.utime(self.archive, (NOW - 7200, NOW - 7190))
        self.run_recovery("LOCAL_HASH_MISMATCH")
        self.assert_no_remote()

    def test_incomplete_report_blocks_remote_read(self):
        metadata = json.loads(self.report.read_bytes())
        metadata["restore_tested"] = False
        self.write(self.report, json.dumps(metadata).encode())
        self.run_recovery("LOCAL_METADATA_MISMATCH")
        self.assert_no_remote()

    def test_stale_local_archive_blocks_remote_read(self):
        self.policy = replace(self.policy, max_age_seconds=3600)
        self.run_recovery("LOCAL_STALE")
        self.assert_no_remote()

    def test_local_archive_size_bound_precedes_remote_read(self):
        self.policy = replace(self.policy, max_bytes=1)
        self.run_recovery("BOUNDS_EXCEEDED")
        self.assert_no_remote()

    def test_local_concurrent_mutation_detected(self):
        self.commands.on_download = lambda: self.report.write_bytes(b"{}")
        self.run_recovery("LOCAL_CHANGED")

    def test_only_allowlisted_external_actions_and_no_upload_prune_or_execution(self):
        self.run_recovery()
        actual = []
        for args, kwargs in self.commands.calls:
            if args[0] == "/usr/bin/systemctl":
                self.assertEqual(args[1], "show")
                actual.append("status")
            elif args[0] == "/usr/bin/busctl":
                self.assertEqual(args[4], "get-property")
                self.assertIn(args[-1], {"ExecStartPre", "ExecStartPost", "EnvironmentFiles"})
                actual.append("typed_property")
            elif args[0] == "/usr/bin/bash":
                self.assertEqual(args[1], "-n")
                actual.append("syntax")
            elif args[0] == "/usr/bin/rclone":
                self.assertIn(args[3], {"lsjson", "copyto"})
                if args[3] == "copyto":
                    self.assertTrue(args[4].startswith(self.policy.remote + "/"))
                    self.assertFalse(args[5].startswith(self.policy.remote))
                actual.append(args[3])
            else:
                self.assertEqual(args, ["STREAM_COUNT"])
                actual.append("stream")
            self.assertFalse({"delete", "purge", "sync", "move", "start", "restart", "daemon-reload"} & set(args))
        self.assertEqual(actual, ["status", "typed_property", "typed_property", "typed_property", "status", "syntax", "lsjson", "copyto", "stream"])


class CommandLineTest(unittest.TestCase):
    def test_source_first_modes_are_explicit_and_mutually_exclusive(self):
        for flag, mode in ((None, "repair_readonly"), ("--verify-only", "verify_only"),
                           ("--upload-approved-existing", "upload_approved_existing")):
            with self.subTest(flag=flag), patch.object(recovery, "execute", return_value=(0, {"status": "OK"})) as execute, \
                    patch.object(recovery.signal, "signal"), patch.object(recovery.signal, "alarm"), \
                    patch.object(recovery.os, "umask"), contextlib.redirect_stdout(io.StringIO()):
                args = ["helper", "/synthetic/trusted-source"] + ([] if flag is None else [flag])
                self.assertEqual(recovery.main(args), 0)
                execute.assert_called_once_with(Path("/synthetic/trusted-source"), mode=mode)

    def test_unknown_or_combined_flags_do_not_run_any_operation(self):
        for args in (["helper"], ["helper", "/synthetic/source", "--unknown"],
                     ["helper", "--verify-only", "/synthetic/source"],
                     ["helper", "/synthetic/source", "--verify-only", "--upload-approved-existing"]):
            with self.subTest(args=args), patch.object(recovery, "execute") as execute, \
                    patch.object(recovery.os, "umask"), contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(recovery.main(args), 2)
                self.assertEqual(json.loads(output.getvalue()), {"status": "USAGE"})
                execute.assert_not_called()


class PipeProcess:
    """A real local pipe, fake child: no program is launched."""
    next_pid = 1000000

    def __init__(self, output, returncode=0):
        read, write = os.pipe()
        os.write(write, output)
        os.close(write)
        self.stdout = os.fdopen(read, "rb")
        self.returncode = returncode
        self.pid = PipeProcess.next_pid
        PipeProcess.next_pid += 1

    def wait(self, timeout=None):
        return self.returncode

    def poll(self):
        return self.returncode


class CommandBoundaryTest(unittest.TestCase):
    def test_stream_requires_both_openssl_and_tar_success(self):
        for decrypt_code, tar_code in ((1, 0), (0, 1), (1, 1)):
            with self.subTest(decrypt=decrypt_code, tar=tar_code):
                children = [PipeProcess(b"", decrypt_code), PipeProcess(b"private-name\n", tar_code)]
                with patch.object(recovery.subprocess, "Popen", side_effect=children) as popen, patch.object(recovery.os, "killpg") as killpg:
                    with self.assertRaises(recovery.Stop) as failure:
                        recovery.Commands(recovery.Policy()).stream_count(10, 11)
                    self.assertEqual(failure.exception.status, "STREAM_FAILED")
                    self.assertTrue(all(call.kwargs["start_new_session"] for call in popen.call_args_list))
                    self.assertEqual({call.args[0] for call in killpg.call_args_list}, {child.pid for child in children})

    def test_stream_emits_only_count_and_never_extracts(self):
        children = [PipeProcess(b""), PipeProcess(b"private-name\nother\\nname\n")]
        with patch.object(recovery.subprocess, "Popen", side_effect=children) as popen, patch.object(recovery.os, "killpg"):
            self.assertEqual(recovery.Commands(recovery.Policy()).stream_count(10, 11), 2)
        args = popen.call_args_list[1].args[0]
        self.assertEqual(args, ["/usr/bin/tar", "--quoting-style=escape", "-tzf", "-"])
        for call in popen.call_args_list:
            self.assertIsNotNone(call.kwargs["stderr"])
            self.assertNotIn("RCLONE_CONFIG", call.kwargs["env"])
            self.assertNotIn("OPENSSL_CONF", call.kwargs["env"])
            self.assertEqual(call.kwargs["env"]["TZ"], "UTC")

    def test_stream_listing_and_item_limits_are_enforced(self):
        for policy in (replace(recovery.Policy(), max_items=1), replace(recovery.Policy(), max_listing_bytes=2)):
            children = [PipeProcess(b""), PipeProcess(b"one\ntwo\n")]
            with patch.object(recovery.subprocess, "Popen", side_effect=children), patch.object(recovery.os, "killpg"):
                with self.assertRaises(recovery.Stop) as failure:
                    recovery.Commands(policy).stream_count(10, 11)
                self.assertEqual(failure.exception.status, "BOUNDS_EXCEEDED")

    def test_command_output_is_size_bounded_and_stderr_suppressed(self):
        process = PipeProcess(PRIVATE.encode())
        with patch.object(recovery.subprocess, "Popen", return_value=process) as popen, patch.object(recovery.os, "killpg"):
            with self.assertRaises(recovery.Stop) as failure:
                recovery.Commands(recovery.Policy()).run(["synthetic"], maximum=2)
            self.assertEqual(failure.exception.status, "BOUNDS_EXCEEDED")
        self.assertEqual(popen.call_args.kwargs["stderr"].name, os.devnull)
        self.assertTrue(popen.call_args.kwargs["start_new_session"])

    def test_command_timeout_kills_process_group(self):
        process = PipeProcess(b"not-logged")
        with patch.object(recovery.subprocess, "Popen", return_value=process), patch.object(recovery.os, "killpg") as killpg, patch.object(recovery.time, "monotonic", side_effect=[0, 61]):
            with self.assertRaises(recovery.Stop) as failure:
                recovery.Commands(recovery.Policy()).run(["synthetic"], timeout=60)
            self.assertEqual(failure.exception.status, "TIMEOUT")
        killpg.assert_called_with(process.pid, recovery.signal.SIGKILL)


if __name__ == "__main__":
    unittest.main()
