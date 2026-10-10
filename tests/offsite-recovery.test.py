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
            return self.service_code, "\n".join(k + "=" + v for k, v in values.items()).encode()
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

    def run_recovery(self, expected="OK"):
        with contextlib.redirect_stdout(io.StringIO()) as stdout, contextlib.redirect_stderr(io.StringIO()) as stderr:
            code, result = recovery.execute(self.source, self.policy, self.commands, NOW)
        self.assertEqual(result["status"], expected, result)
        self.assertEqual(code, 0 if expected == "OK" else 1)
        self.assertEqual(stdout.getvalue(), "")
        self.assertEqual(stderr.getvalue(), "")
        encoded = json.dumps(result)
        for sensitive in (PRIVATE, self.expected, self.archive.name, str(self.root), recovery.OLD_SHA256, recovery.NEW_SHA256):
            self.assertNotIn(sensitive, encoded)
        self.assertFalse(result["upload_performed"])
        self.assertFalse(result["deletion_performed"])
        self.assertEqual(list(self.backups.glob(".offsite-readonly-*")), [])
        self.assertEqual(list(self.bin.glob(".offsite-replacement-*")), [])
        return result

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
        self.assertEqual(actual, ["status", "status", "syntax", "lsjson", "copyto", "stream"])


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
