#!/usr/bin/env python3
"""Hash-pinned selector repair and bounded existing-copy verification.

The default repairs only the approved script and reads existing remote data.
--verify-only never repairs or uploads. --upload-approved-existing is a separate,
explicit opt-in for one approved archive family using conditional single-part
uploads. No mode runs a backup, extraction, service action, or retention.
All output is allowlisted. Review and authorize the selected mode before use.
"""

from __future__ import annotations

import configparser
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import resource
import selectors
import shlex
import signal
import stat
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone


OLD_SHA256 = "cb645f216c574c124205ad0e819754d1edef1a1cd5a351020ec8f4c106b09359"
NEW_SHA256 = "c2896205ec2b877096b5b443a796593067ea3a9b9cdaf9a7b7d1a711ccbf48cf"
STATUSES = frozenset({
    "OK", "USAGE", "ROOT_REQUIRED", "UNSAFE_PATH", "METADATA_MISMATCH",
    "LOCKED", "SOURCE_HASH_MISMATCH", "SCRIPT_HASH_MISMATCH", "SYNTAX_FAILED",
    "INSTALL_CHANGED", "SERVICE_BUSY", "SERVICE_QUERY_FAILED", "SERVICE_EXEC_START_MISMATCH",
    "SERVICE_IDENTITY_MISMATCH", "SERVICE_HOOKS_MISMATCH", "SERVICE_ENV_FILES_MISMATCH",
    "SERVICE_DROPINS_MISMATCH", "SERVICE_ENV_MISMATCH", "TIMER_UNSAFE",
    "REMOTE_CONFIG_MISMATCH", "LOCAL_MISSING", "LOCAL_STALE", "LOCAL_METADATA_MISMATCH",
    "LOCAL_HASH_MISMATCH", "LOCAL_CHANGED", "REMOTE_MISSING", "REMOTE_METADATA_FAILED",
    "REMOTE_SIZE_MISMATCH", "DOWNLOAD_FAILED", "REMOTE_HASH_MISMATCH", "STREAM_FAILED",
    "BOUNDS_EXCEEDED", "INSUFFICIENT_SPACE", "TIMEOUT", "INTERRUPTED", "INTERNAL_ERROR",
    "APPROVED_ARCHIVE_MISSING", "APPROVED_ARCHIVE_AMBIGUOUS", "RCLONE_VERSION_UNSUPPORTED",
    "UPLOAD_FAILED_UNCERTAIN",
})
ARCHIVE_RE = re.compile(r"steelprodukt-pd-(\d{8}T\d{6}Z)\.tar\.gz\.enc\Z")
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LANG": "C", "LC_ALL": "C", "HOME": "/root", "TZ": "UTC"}


@dataclass(frozen=True)
class Policy:
    installed: Path = Path("/usr/local/sbin/steelprodukt-pd-offsite-backup")
    backups: Path = Path("/var/backups/steelprodukt")
    config: Path = Path("/etc/steelprodukt/rclone.conf")
    key: Path = Path("/etc/steelprodukt/pd-backup.key")
    remote: str = "beget_pd_backup:0b1412a79c88-steelprodukt-backup/production"
    endpoint: str = "https://s3.ru1.storage.beget.cloud"
    region: str = "ru1"
    uid: int = 0
    gid: int = 0
    max_bytes: int = 2 * 1024 * 1024 * 1024
    max_age_seconds: int = 36 * 3600
    max_seconds: int = 780
    max_items: int = 1_000_000
    max_listing_bytes: int = 64 * 1024 * 1024
    old_hash: str = OLD_SHA256
    new_hash: str = NEW_SHA256
    approved_archive_bytes: int = 17925376
    approved_window_start: str = "20261010T142942Z"
    approved_window_end: str = "20261010T142949Z"


class Stop(Exception):
    def __init__(self, status: str):
        self.status = status if status in STATUSES else "INTERNAL_ERROR"
        super().__init__(self.status)


def require(condition: bool, status: str) -> None:
    if not condition:
        raise Stop(status)


def identity(info: os.stat_result) -> tuple:
    return (info.st_dev, info.st_ino, info.st_uid, info.st_gid, info.st_mode,
            info.st_nlink, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def no_symlinks(path: Path) -> None:
    require(path.is_absolute() and ".." not in path.parts, "UNSAFE_PATH")
    for item in reversed((path, *path.parents)):
        info = item.lstat()
        require(not stat.S_ISLNK(info.st_mode), "UNSAFE_PATH")
        if item != path:
            require(stat.S_ISDIR(info.st_mode) and info.st_uid in {0, os.geteuid()} and
                    (not info.st_mode & 0o022 or (info.st_uid == 0 and info.st_mode & stat.S_ISVTX)),
                    "UNSAFE_PATH")


def safe_directory(path: Path, policy: Policy, private: bool = False) -> None:
    no_symlinks(path)
    info = path.stat()
    require(stat.S_ISDIR(info.st_mode) and info.st_uid == policy.uid and
            info.st_gid == policy.gid and not info.st_mode & 0o022, "METADATA_MISMATCH")
    if private:
        require(stat.S_IMODE(info.st_mode) == 0o700, "METADATA_MISMATCH")


def open_safe(path: Path, policy: Policy, modes: set[int], maximum: int,
              writable: bool = False) -> int:
    no_symlinks(path)
    flags = (os.O_RDWR if writable else os.O_RDONLY) | os.O_NOFOLLOW | os.O_NONBLOCK
    # Linux permits O_NOATIME for the file owner as well as root.
    flags |= os.O_NOATIME
    fd = os.open(path, flags)
    try:
        info = os.fstat(fd)
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and
                info.st_uid == policy.uid and info.st_gid == policy.gid and
                stat.S_IMODE(info.st_mode) in modes, "METADATA_MISMATCH")
        require(0 <= info.st_size <= maximum, "BOUNDS_EXCEEDED")
        require(identity(path.lstat()) == identity(info), "UNSAFE_PATH")
        return fd
    except BaseException:
        os.close(fd)
        raise


def read_small(fd: int, maximum: int) -> bytes:
    data = os.pread(fd, maximum + 1, 0)
    require(len(data) <= maximum, "BOUNDS_EXCEEDED")
    return data


def digest(fd: int, maximum: int) -> str:
    value = hashlib.sha256()
    offset = 0
    while True:
        chunk = os.pread(fd, min(1024 * 1024, maximum - offset + 1), offset)
        if not chunk:
            return value.hexdigest()
        offset += len(chunk)
        require(offset <= maximum, "BOUNDS_EXCEEDED")
        value.update(chunk)


def unchanged(path: Path, fd: int, before: os.stat_result, status: str) -> None:
    require(identity(os.fstat(fd)) == identity(before) and
            identity(path.lstat()) == identity(before), status)


class Commands:
    """Bounded subprocess I/O. Neither exception text nor stderr is propagated."""

    def __init__(self, policy: Policy):
        self.policy = policy

    @staticmethod
    def stop(process: subprocess.Popen) -> None:
        # Every child has its own session: terminate descendants too, including
        # tar's gzip child or a command whose leader exited before pipe EOF.
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait(timeout=5)

    def collect(self, process: subprocess.Popen, timeout: int, maximum: int,
                count: bool = False) -> bytes | int:
        started = time.monotonic()
        result = bytearray()
        total = lines = 0
        last = b""
        try:
            with selectors.DefaultSelector() as selector:
                selector.register(process.stdout, selectors.EVENT_READ)
                while selector.get_map():
                    require(time.monotonic() - started < timeout, "TIMEOUT")
                    for key, _ in selector.select(timeout=0.2):
                        chunk = os.read(key.fileobj.fileno(), 65536)
                        if not chunk:
                            selector.unregister(key.fileobj)
                            continue
                        total += len(chunk)
                        require(total <= maximum, "BOUNDS_EXCEEDED")
                        if count:
                            lines += chunk.count(b"\n")
                            last = chunk[-1:]
                            require(lines <= self.policy.max_items, "BOUNDS_EXCEEDED")
                        else:
                            result.extend(chunk)
            process.wait(timeout=max(0.01, timeout - (time.monotonic() - started)))
            if count:
                require(not last or last == b"\n", "STREAM_FAILED")
                return lines
            return bytes(result)
        except subprocess.TimeoutExpired:
            raise Stop("TIMEOUT") from None
        finally:
            self.stop(process)
            process.stdout.close()

    def run(self, args: list[str], *, fds: tuple[int, ...] = (), timeout: int = 60,
            maximum: int = 65536, file_limit: int | None = None) -> tuple[int, bytes]:
        def limits() -> None:
            if file_limit is not None:
                resource.setrlimit(resource.RLIMIT_FSIZE, (file_limit, file_limit))

        with open(os.devnull, "wb") as errors:
            process = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                       stderr=errors, env=ENV, pass_fds=fds,
                                       start_new_session=True,
                                       preexec_fn=limits if file_limit is not None else None)
            output = self.collect(process, timeout, maximum)
        return process.returncode, output

    def stream_count(self, archive_fd: int, key_fd: int) -> int:
        decrypt = listing = None
        try:
            with open(os.devnull, "wb") as errors:
                decrypt = subprocess.Popen(
                    ["/usr/bin/openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", "600000",
                     "-pass", f"file:/proc/self/fd/{key_fd}", "-in", f"/proc/self/fd/{archive_fd}"],
                    stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=errors, env=ENV,
                    pass_fds=(archive_fd, key_fd), start_new_session=True)
                listing = subprocess.Popen(
                    ["/usr/bin/tar", "--quoting-style=escape", "-tzf", "-"], stdin=decrypt.stdout,
                    stdout=subprocess.PIPE, stderr=errors, env=ENV, start_new_session=True)
                decrypt.stdout.close()
                count = self.collect(listing, 300, self.policy.max_listing_bytes, count=True)
                decrypt.wait(timeout=10)
                require(decrypt.returncode == 0 and listing.returncode == 0 and
                        0 < count <= self.policy.max_items, "STREAM_FAILED")
                return count
        except subprocess.TimeoutExpired:
            raise Stop("TIMEOUT") from None
        finally:
            for process in (listing, decrypt):
                if process is not None:
                    self.stop(process)
                    if process.stdout is not None:
                        process.stdout.close()


def properties(data: bytes) -> dict[str, str]:
    return dict(line.split("=", 1) for line in data.decode("utf-8").splitlines() if "=" in line)


def preflight(commands: Commands, policy: Policy, now: float, config_fd: int) -> None:
    code, output = commands.run([
        "/usr/bin/systemctl", "show", "steelprodukt-pd-offsite-backup.service", "--no-pager",
        "--property=ActiveState,SubState,MainPID,ExecStart,ExecStartPre,ExecStartPost,Environment,EnvironmentFiles,User,Group,DropInPaths",
    ])
    require(code == 0, "SERVICE_QUERY_FAILED")
    service = properties(output)
    require(service.get("ActiveState") in {"inactive", "failed"} and
            service.get("SubState") in {"dead", "failed"} and service.get("MainPID") == "0", "SERVICE_BUSY")
    start = service.get("ExecStart", "")
    expected = str(policy.installed)
    require(start.count("path=") == 1 and start.count("argv[]=") == 1 and
            f"path={expected} ;" in start and f"argv[]={expected} ;" in start,
            "SERVICE_EXEC_START_MISMATCH")
    require(service.get("User") == "root" and service.get("Group") == "root", "SERVICE_IDENTITY_MISMATCH")
    # A nonempty formatted value still blocks immediately. Missing structured
    # array text is ambiguous in systemctl v249 and MUST be proved empty below.
    require(all(service.get(key) in {None, ""} for key in ("ExecStartPre", "ExecStartPost")), "SERVICE_HOOKS_MISMATCH")
    require(service.get("EnvironmentFiles") in {None, ""}, "SERVICE_ENV_FILES_MISMATCH")
    require(service.get("DropInPaths") == "", "SERVICE_DROPINS_MISMATCH")
    try:
        environment = shlex.split(service.get("Environment", ""))
    except ValueError:
        raise Stop("SERVICE_ENV_MISMATCH") from None
    require(environment in ([], ["PD_OFFSITE_RETENTION_DAYS=30"]), "SERVICE_ENV_MISMATCH")
    # busctl get-property prints the D-Bus signature and array length even for
    # zero entries. Query only the same three previously selected properties.
    # Signatures: systemd v249 man/org.freedesktop.systemd1.xml.
    for field, empty, mismatch in (
        ("ExecStartPre", b"a(sasbttttuii) 0\n", "SERVICE_HOOKS_MISMATCH"),
        ("ExecStartPost", b"a(sasbttttuii) 0\n", "SERVICE_HOOKS_MISMATCH"),
        ("EnvironmentFiles", b"a(sb) 0\n", "SERVICE_ENV_FILES_MISMATCH"),
    ):
        try:
            code, output = commands.run([
                "/usr/bin/busctl", "--system", "--no-pager", "--timeout=10", "get-property",
                "org.freedesktop.systemd1",
                "/org/freedesktop/systemd1/unit/steelprodukt_2dpd_2doffsite_2dbackup_2eservice",
                "org.freedesktop.systemd1.Service", field,
            ], timeout=20, maximum=4096)
        except OSError:
            raise Stop("SERVICE_QUERY_FAILED") from None
        require(code == 0, "SERVICE_QUERY_FAILED")
        require(output == empty, mismatch)
    code, output = commands.run([
        "/usr/bin/systemctl", "show", "steelprodukt-pd-offsite-backup.timer", "--no-pager",
        "--property=ActiveState,SubState,NextElapseUSecRealtime",
    ])
    require(code == 0, "TIMER_UNSAFE")
    timer = properties(output)
    require(timer.get("ActiveState") == "active" and timer.get("SubState") == "waiting", "TIMER_UNSAFE")
    try:
        next_run = datetime.strptime(timer["NextElapseUSecRealtime"], "%a %Y-%m-%d %H:%M:%S %Z").replace(tzinfo=timezone.utc).timestamp()
    except (KeyError, ValueError):
        raise Stop("TIMER_UNSAFE") from None
    require(next_run - now > 900, "TIMER_UNSAFE")
    parser = configparser.ConfigParser(interpolation=None)
    try:
        parser.read_string(read_small(config_fd, 131072).decode("utf-8"))
        config = parser["beget_pd_backup"]
        allowed_keys = {"type", "provider", "endpoint", "region", "env_auth", "access_key_id",
                        "secret_access_key", "acl", "force_path_style"}
        require(set(config) <= allowed_keys and bool(config.get("access_key_id", "").strip()) and
                bool(config.get("secret_access_key", "").strip()) and
                config.get("type") == "s3" and config.get("endpoint") in {policy.endpoint, policy.endpoint + "/"} and
                config.get("region") == policy.region and
                config.get("env_auth", "false").lower() == "false" and
                config.get("provider") == "Other", "REMOTE_CONFIG_MISMATCH")
    except (configparser.Error, KeyError, UnicodeError):
        raise Stop("REMOTE_CONFIG_MISMATCH") from None


def copy_metadata(source: int, target: int, info: os.stat_result) -> None:
    os.fchown(target, info.st_uid, info.st_gid)
    os.fchmod(target, stat.S_IMODE(info.st_mode))
    for name in os.listxattr(source):
        os.setxattr(target, name, os.getxattr(source, name))
    os.utime(target, ns=(info.st_atime_ns, info.st_mtime_ns))
    os.fsync(target)


def install(source: Path, commands: Commands, policy: Policy, result: dict,
            verify_only: bool = False) -> str:
    safe_directory(policy.installed.parent, policy)
    with os.fdopen(open_safe(source, policy, {0o400, 0o600, 0o644, 0o700, 0o750, 0o755}, 65536), "rb") as new:
        payload = read_small(new.fileno(), 65536)
        require(hashlib.sha256(payload).hexdigest() == policy.new_hash, "SOURCE_HASH_MISMATCH")
        code, _ = commands.run(["/usr/bin/bash", "-n", f"/proc/self/fd/{new.fileno()}"], fds=(new.fileno(),))
        require(code == 0, "SYNTAX_FAILED")
        with os.fdopen(open_safe(policy.installed, policy, {0o700, 0o750, 0o755}, 65536), "rb") as old:
            info = os.fstat(old.fileno())
            current = digest(old.fileno(), 65536)
            require(current in ({policy.new_hash} if verify_only else {policy.old_hash, policy.new_hash}),
                    "SCRIPT_HASH_MISMATCH")
            if current == policy.new_hash:
                return "already_current"
            backup_dir = Path(tempfile.mkdtemp(prefix=".offsite-repair-", dir=policy.backups))
            backup = backup_dir / "original-script"
            with backup.open("xb") as saved:
                saved.write(read_small(old.fileno(), 65536))
                saved.flush()
                copy_metadata(old.fileno(), saved.fileno(), info)
            stage_fd, stage_path = tempfile.mkstemp(prefix=".offsite-replacement-", dir=policy.installed.parent)
            try:
                with os.fdopen(stage_fd, "wb") as staged:
                    staged.write(payload)
                    staged.flush()
                    copy_metadata(old.fileno(), staged.fileno(), info)
                unchanged(policy.installed, old.fileno(), info, "INSTALL_CHANGED")
                require(digest(old.fileno(), 65536) == policy.old_hash, "INSTALL_CHANGED")
                result["installed_script"] = "replacement_attempted"
                os.replace(stage_path, policy.installed)
                result["installed_script"] = "replaced_unverified"
                with os.fdopen(open_safe(policy.installed, policy, {stat.S_IMODE(info.st_mode)}, 65536), "rb") as installed:
                    require(digest(installed.fileno(), 65536) == policy.new_hash, "INSTALL_CHANGED")
                    after = os.fstat(installed.fileno())
                    require((after.st_uid, after.st_gid, after.st_mode, after.st_mtime_ns, after.st_atime_ns) ==
                            (info.st_uid, info.st_gid, info.st_mode, info.st_mtime_ns, info.st_atime_ns), "INSTALL_CHANGED")
                directory = os.open(policy.installed.parent, os.O_RDONLY | os.O_DIRECTORY)
                try:
                    os.fsync(directory)
                finally:
                    os.close(directory)
            finally:
                if os.path.lexists(stage_path):
                    os.unlink(stage_path)
    return "replaced"


def latest_archive(policy: Policy) -> Path:
    latest = None
    count = 0
    with os.scandir(policy.backups) as entries:
        for entry in entries:
            count += 1
            require(count <= 100000, "BOUNDS_EXCEEDED")
            if entry.name.startswith("steelprodukt-pd-") and entry.name.endswith(".tar.gz.enc"):
                require(ARCHIVE_RE.fullmatch(entry.name) is not None and not entry.is_symlink(), "UNSAFE_PATH")
                info = entry.stat(follow_symlinks=False)
                require(stat.S_ISREG(info.st_mode), "UNSAFE_PATH")
                candidate = (info.st_mtime_ns, entry.name)
                if latest is None or candidate > latest:
                    latest = candidate
    require(latest is not None, "LOCAL_MISSING")
    return policy.backups / latest[1]


def approved_archive(policy: Policy) -> Path:
    """Never substitute a later backup for the specifically approved family."""
    matches = []
    with os.scandir(policy.backups) as entries:
        for count, entry in enumerate(entries, 1):
            require(count <= 100000, "BOUNDS_EXCEEDED")
            match = ARCHIVE_RE.fullmatch(entry.name)
            if match is None or not policy.approved_window_start <= match.group(1) <= policy.approved_window_end:
                continue
            require(not entry.is_symlink(), "UNSAFE_PATH")
            info = entry.stat(follow_symlinks=False)
            require(stat.S_ISREG(info.st_mode), "UNSAFE_PATH")
            if info.st_size == policy.approved_archive_bytes:
                matches.append(policy.backups / entry.name)
    require(bool(matches), "APPROVED_ARCHIVE_MISSING")
    require(len(matches) == 1, "APPROVED_ARCHIVE_AMBIGUOUS")
    return matches[0]


def verify_approved_family(commands: Commands, policy: Policy, config_fd: int, key_fd: int,
                           opened: list, result: dict, expected_hash: str,
                           config_before: os.stat_result) -> None:
    """Conditional create-only client requests; provider enforcement is external.

    Audited rclone 1.72.0 and 1.75.0 map upload-only If-None-Match to S3 PutObject. A known-size
    file below 64 MiB uses a single PUT; there is no multipart/fallback path here.
    This does not establish the provider's conditional-write implementation.
    """
    code, output = commands.run(["/usr/bin/rclone", "version"], timeout=20, maximum=8192)
    first = output.splitlines()[0] if output else b""
    version = re.fullmatch(rb"rclone v(\d{1,3})\.(\d{1,3})\.(\d{1,3})", first)
    result["rclone_version"] = ".".join(part.decode("ascii") for part in version.groups()) if version else "unrecognized"
    require(code == 0 and version is not None and tuple(map(int, version.groups())) in {(1, 72, 0), (1, 75, 0)},
            "RCLONE_VERSION_UNSUPPORTED")
    result["conditional_upload_client_supported"] = True
    maxima = (policy.max_bytes, 4096, 65536)
    hashes = [expected_hash] + [digest(opened[i][1], maxima[i]) for i in (1, 2)]
    sizes = [info.st_size for _, _, info in opened]
    require(sizes[0] == policy.approved_archive_bytes and all(0 < size < 64 * 1024 * 1024 for size in sizes),
            "BOUNDS_EXCEEDED")
    base = ["/usr/bin/rclone", "--config", f"/proc/self/fd/{config_fd}"]
    flags = ["--s3-no-check-bucket", "--retries", "1", "--low-level-retries", "1",
             "--contimeout", "15s", "--timeout", "60s", "--stats", "0"]
    remotes = [policy.remote + "/" + path.name for path, _, _ in opened]

    def local_unchanged() -> None:
        unchanged(policy.config, config_fd, config_before, "LOCAL_CHANGED")
        for i, (path, fd, before) in enumerate(opened):
            unchanged(path, fd, before, "LOCAL_CHANGED")
            require(digest(fd, maxima[i]) == hashes[i], "LOCAL_CHANGED")

    def exists(i: int) -> bool:
        local_unchanged()
        code, output = commands.run(base + ["lsjson", "--stat", remotes[i]] + flags, fds=(config_fd,))
        require(code == 0, "REMOTE_METADATA_FAILED")
        try:
            item = json.loads(output)
        except (ValueError, UnicodeError):
            raise Stop("REMOTE_METADATA_FAILED") from None
        require(isinstance(item, dict) and type(item.get("IsDir")) is bool and
                type(item.get("Size")) is int, "REMOTE_METADATA_FAILED")
        if item["IsDir"]:
            # StatJSON can represent the exact missing S3 key as its virtual
            # root: fs.NewDir("") has Name/Path="" and Size=-1 (rclone v1.72).
            require(item["Size"] == -1 and item.get("IsBucket", False) is False and
                    (item.get("Name"), item.get("Path")) in
                    {(opened[i][0].name, opened[i][0].name), ("", "")}, "REMOTE_METADATA_FAILED")
            return False
        require(item.get("Name") == opened[i][0].name and item.get("Path") == opened[i][0].name,
                "REMOTE_METADATA_FAILED")
        require(item["Size"] == sizes[i], "REMOTE_SIZE_MISMATCH")
        return True

    present = [exists(i) for i in range(3)]
    free = os.statvfs(policy.backups)
    require(free.f_bavail * free.f_frsize >= 2 * sum(sizes) + 64 * 1024 * 1024, "INSUFFICIENT_SPACE")
    local_count = commands.stream_count(opened[0][1], key_fd)
    with tempfile.TemporaryDirectory(prefix=".offsite-readonly-", dir=policy.backups) as temp:
        directory = Path(temp)
        readback_number = 0

        def readback(i: int) -> None:
            nonlocal readback_number
            local_unchanged()
            readback_number += 1
            destination = directory / ("object-" + str(i) + "-" + str(readback_number))
            code, _ = commands.run(base + ["copyto", remotes[i], str(destination)] + flags + ["--no-traverse"],
                                   fds=(config_fd,), timeout=600 if i == 0 else 60,
                                   maximum=65536, file_limit=sizes[i])
            require(code == 0, "DOWNLOAD_FAILED")
            with os.fdopen(open_safe(destination, policy, {0o400, 0o600}, sizes[i]), "rb") as downloaded:
                require(os.fstat(downloaded.fileno()).st_size == sizes[i], "REMOTE_SIZE_MISMATCH")
                require(digest(downloaded.fileno(), sizes[i]) == hashes[i], "REMOTE_HASH_MISMATCH")
                if i == 0:
                    require(commands.stream_count(downloaded.fileno(), key_fd) == local_count, "STREAM_FAILED")
            # Only this newly downloaded temporary file is removed. Every next
            # readback has a fresh path, so copyto cannot reuse cached contents.
            destination.unlink()

        # Existing objects must all match before even one missing object is sent.
        for i in range(3):
            if present[i]:
                readback(i)

        stages = {}
        for i in range(3):
            if present[i]:
                continue
            local_unchanged()
            stage = directory / ("upload-" + str(i))
            # Freeze only the existing ciphertext/sidecar bytes in private
            # validation storage; never create a new backup or plaintext file.
            with stage.open("xb") as snapshot:
                offset = 0
                while offset < sizes[i]:
                    chunk = os.pread(opened[i][1], min(1024 * 1024, sizes[i] - offset), offset)
                    require(bool(chunk), "LOCAL_CHANGED")
                    snapshot.write(chunk)
                    offset += len(chunk)
                snapshot.flush()
                os.fchmod(snapshot.fileno(), 0o400)
                os.utime(snapshot.fileno(), ns=(opened[i][2].st_atime_ns, opened[i][2].st_mtime_ns))
                os.fsync(snapshot.fileno())
            with os.fdopen(open_safe(stage, policy, {0o400}, sizes[i]), "rb") as frozen:
                require(digest(frozen.fileno(), sizes[i]) == hashes[i], "LOCAL_CHANGED")
                stages[i] = (stage, os.fstat(frozen.fileno()))
        local_unchanged()
        for i, (stage, stage_before) in stages.items():
            if exists(i):
                # A writer won the race. Verify it; never replace it.
                readback(i)
                continue
            with os.fdopen(open_safe(stage, policy, {0o400}, sizes[i]), "rb") as frozen:
                unchanged(stage, frozen.fileno(), stage_before, "LOCAL_CHANGED")
                require(digest(frozen.fileno(), sizes[i]) == hashes[i], "LOCAL_CHANGED")
                local_unchanged()
                result["upload_attempted"] = True
                result["upload_objects_attempted"] += 1
                result["upload_outcome"] = "attempted_unverified"
                # rclone's own failed-copy verifier can delete the destination.
                # Disable that cleanup path, not verification: exact size and
                # SHA256/readability are independently required by readback().
                code, _ = commands.run(base + ["copyto", str(stage), remotes[i]] + flags +
                                       ["--no-traverse", "--ignore-existing", "--no-update-modtime", "--header-upload", "If-None-Match:*",
                                        "--s3-upload-cutoff", "64M", "--s3-acl", "private", "--inplace",
                                        "--ignore-size", "--ignore-checksum", "--multi-thread-streams", "0"],
                                       fds=(config_fd,), timeout=300, maximum=65536)
                require(code == 0, "UPLOAD_FAILED_UNCERTAIN")
                unchanged(stage, frozen.fileno(), stage_before, "LOCAL_CHANGED")
                local_unchanged()
            require(exists(i), "REMOTE_MISSING")
            readback(i)
        if not all(present):
            for i in range(3):
                require(exists(i), "REMOTE_MISSING")
                readback(i)
        local_unchanged()
    result.update(remote_sha256_verified=True, remote_sidecars_verified=True,
                  remote_objects_verified=3, stream_readable=True, items_in_archive=local_count,
                  upload_outcome="verified_matching")


def verify_existing(commands: Commands, policy: Policy, config_fd: int, key_fd: int,
                    result: dict, now: float, upload_approved: bool = False,
                    config_before: os.stat_result | None = None) -> None:
    archive = approved_archive(policy) if upload_approved else latest_archive(policy)
    checksum = Path(str(archive) + ".sha256")
    report = archive.with_name(archive.name.removesuffix(".tar.gz.enc") + ".json")
    opened = []
    try:
        for path, maximum in ((archive, policy.max_bytes), (checksum, 4096), (report, 65536)):
            fd = open_safe(path, policy, {0o400, 0o600}, maximum)
            opened.append((path, fd, os.fstat(fd)))
        archive_fd, checksum_fd, report_fd = (item[1] for item in opened)
        size = opened[0][2].st_size
        require(size > 0, "LOCAL_METADATA_MISMATCH")
        stamp = ARCHIVE_RE.fullmatch(archive.name).group(1)
        created = datetime.strptime(stamp, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).timestamp()
        age = int(now - created)
        require(0 <= age <= policy.max_age_seconds and 0 <= now - opened[0][2].st_mtime <= policy.max_age_seconds and
                0 <= opened[0][2].st_mtime - created <= 3600, "LOCAL_STALE")
        result.update(archive_bytes=size, archive_age_seconds=age)
        expected = read_small(checksum_fd, 4096).decode("ascii")
        match = re.fullmatch(r"([0-9a-f]{64})  (.+)\n?", expected)
        require(match is not None and match.group(2) in {str(archive), archive.name}, "LOCAL_METADATA_MISMATCH")
        expected_hash = match.group(1)
        metadata = json.loads(read_small(report_fd, 65536))
        require(isinstance(metadata, dict) and metadata.get("restore_tested") is True and
                metadata.get("encrypted") is True and metadata.get("created_at") == stamp and
                type(metadata.get("archive_bytes")) is int and metadata["archive_bytes"] == size and
                metadata.get("archive_sha256") == expected_hash, "LOCAL_METADATA_MISMATCH")
        require(digest(archive_fd, policy.max_bytes) == expected_hash, "LOCAL_HASH_MISMATCH")
        result["local_sha256_verified"] = True
        if upload_approved:
            require(config_before is not None, "INTERNAL_ERROR")
            verify_approved_family(commands, policy, config_fd, key_fd, opened, result, expected_hash, config_before)
            return
        remote_object = policy.remote + "/" + archive.name
        base = ["/usr/bin/rclone", "--config", f"/proc/self/fd/{config_fd}"]
        flags = ["--s3-no-check-bucket", "--retries", "1", "--low-level-retries", "1",
                 "--contimeout", "15s", "--timeout", "60s", "--stats", "0"]
        code, output = commands.run(base + ["lsjson", "--stat", remote_object] + flags, fds=(config_fd,))
        require(code == 0, "REMOTE_METADATA_FAILED")
        try:
            remote = json.loads(output)
        except (ValueError, UnicodeError):
            raise Stop("REMOTE_METADATA_FAILED") from None
        require(isinstance(remote, dict) and type(remote.get("IsDir")) is bool, "REMOTE_METADATA_FAILED")
        require(remote["IsDir"] is False, "REMOTE_MISSING")
        require(remote.get("Name") == archive.name and remote.get("Path") == archive.name and
                type(remote.get("Size")) is int, "REMOTE_METADATA_FAILED")
        require(remote["Size"] == size, "REMOTE_SIZE_MISMATCH")
        free = os.statvfs(policy.backups)
        require(free.f_bavail * free.f_frsize >= size + 64 * 1024 * 1024, "INSUFFICIENT_SPACE")
        with tempfile.TemporaryDirectory(prefix=".offsite-readonly-", dir=policy.backups) as temp:
            download = Path(temp) / "ciphertext"
            code, _ = commands.run(base + ["copyto", remote_object, str(download)] + flags + ["--no-traverse"],
                                   fds=(config_fd,), timeout=600, maximum=65536, file_limit=size)
            require(code == 0, "DOWNLOAD_FAILED")
            with os.fdopen(open_safe(download, policy, {0o400, 0o600}, policy.max_bytes), "rb") as downloaded:
                require(os.fstat(downloaded.fileno()).st_size == size, "REMOTE_SIZE_MISMATCH")
                require(digest(downloaded.fileno(), policy.max_bytes) == expected_hash, "REMOTE_HASH_MISMATCH")
                result["remote_sha256_verified"] = True
                result["items_in_archive"] = commands.stream_count(downloaded.fileno(), key_fd)
                result["stream_readable"] = True
        for path, fd, before in opened:
            unchanged(path, fd, before, "LOCAL_CHANGED")
        require(digest(archive_fd, policy.max_bytes) == expected_hash and
                read_small(checksum_fd, 4096).decode("ascii") == expected and
                json.loads(read_small(report_fd, 65536)) == metadata, "LOCAL_CHANGED")
    finally:
        for _, fd, _ in opened:
            os.close(fd)


def execute(source: Path, policy: Policy | None = None, commands: Commands | None = None,
            now: float | None = None, mode: str = "repair_readonly") -> tuple[int, dict]:
    policy = policy or Policy()
    commands = commands or Commands(policy)
    result = {"status": "INTERNAL_ERROR", "installed_script": "unchanged", "upload_performed": False,
              "deletion_performed": False, "local_sha256_verified": False,
              "remote_sha256_verified": False, "stream_readable": False}
    descriptors = []
    try:
        require(mode in {"repair_readonly", "verify_only", "upload_approved_existing"}, "USAGE")
        if mode == "upload_approved_existing":
            result.pop("upload_performed")
            result.update(upload_attempted=False, upload_objects_attempted=0,
                          upload_outcome="not_attempted", remote_objects_verified=0,
                          remote_sidecars_verified=False, conditional_upload_client_supported=False,
                          rclone_version="unrecognized")
        require(os.geteuid() == policy.uid, "ROOT_REQUIRED")
        safe_directory(policy.backups, policy, private=True)
        lock = open_safe(policy.backups / ".backup.lock", policy, {0o600}, 4096, writable=True)
        descriptors.append(lock)
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise Stop("LOCKED") from None
        snapshots = []
        for path, maximum in ((policy.config, 131072), (policy.key, 4096)):
            fd = open_safe(path, policy, {0o400, 0o600}, maximum)
            descriptors.append(fd)
            snapshots.append((path, fd, os.fstat(fd)))
        config_fd, key_fd = descriptors[-2:]
        preflight(commands, policy, time.time() if now is None else now, config_fd)
        result["installed_script"] = install(source, commands, policy, result, verify_only=mode != "repair_readonly")
        verify_existing(commands, policy, config_fd, key_fd, result, time.time() if now is None else now,
                        upload_approved=mode == "upload_approved_existing", config_before=snapshots[0][2])
        for path, fd, before in snapshots:
            unchanged(path, fd, before, "LOCAL_CHANGED")
        result["status"] = "OK"
        return 0, result
    except Stop as error:
        result["status"] = error.status
    except BaseException:
        # No exception, path, object name, digest, secret, or tool stderr reaches logs.
        result["status"] = "INTERNAL_ERROR"
    finally:
        for fd in reversed(descriptors):
            os.close(fd)
    return 1, result


def main(argv: list[str]) -> int:
    os.umask(0o077)
    modes = {"--verify-only": "verify_only", "--upload-approved-existing": "upload_approved_existing"}
    if len(argv) not in {2, 3} or (len(argv) == 3 and argv[2] not in modes):
        print(json.dumps({"status": "USAGE"}, sort_keys=True))
        return 2

    def timed_out(_signum, _frame):
        raise Stop("TIMEOUT")

    signal.signal(signal.SIGALRM, timed_out)
    def interrupted(_signum, _frame):
        raise Stop("INTERRUPTED")

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    signal.alarm(Policy().max_seconds)
    code, result = execute(Path(argv[1]), mode=modes[argv[2]] if len(argv) == 3 else "repair_readonly")
    signal.alarm(0)
    print(json.dumps(result, sort_keys=True))
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv))
