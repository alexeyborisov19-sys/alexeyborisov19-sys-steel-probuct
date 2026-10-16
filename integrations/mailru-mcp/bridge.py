"""Read-only subprocess bridge to the existing Steel Produkt IMAP utility.

Do not deploy a public HTTP endpoint for this component. The gateway must run
as an isolated stdio process within an authorized private MCP tunnel.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "mail-readonly.py"
ALLOWED_ACTIONS = frozenset({"status", "list", "search", "message", "thread"})


class MailBridgeError(RuntimeError):
    """No secret or subprocess output is included in these errors."""


def invoke(action: str, *args: str) -> dict[str, Any]:
    """Run an allowlisted IMAP read; never invoke a shell or pass passwords."""
    if action not in ALLOWED_ACTIONS:
        raise ValueError("Unsupported mailbox action")
    if not SCRIPT.is_file():
        raise MailBridgeError("Read-only IMAP utility is missing")

    env_file = os.environ.get("MAIL_MCP_ENV_FILE") or str(ROOT / ".env.production")
    argv = [sys.executable, str(SCRIPT), "--env-file", env_file, action, *args]
    try:
        result = subprocess.run(
            argv,
            cwd=str(ROOT),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            encoding="utf-8",
            errors="replace",
            timeout=60,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise MailBridgeError("Mailbox request was not completed") from exc

    if result.returncode != 0 or len(result.stdout) > 4_000_000:
        raise MailBridgeError("Mailbox request failed (check IMAP configuration on server)")
    try:
        data = json.loads(result.stdout)
    except (TypeError, ValueError) as exc:
        raise MailBridgeError("Mailbox response was invalid") from exc
    if not isinstance(data, dict) or data.get("ok") is False or data.get("readOnly") is not True:
        raise MailBridgeError("Mailbox read-only check failed")
    return data


def valid_uid(uid: str) -> str:
    """Prevent option smuggling; IMAP UIDs are positive decimal strings only."""
    if not isinstance(uid, str) or not uid.isascii() or not uid.isdigit() or len(uid) > 20 or int(uid) <= 0:
        raise ValueError("Invalid numeric IMAP UID")
    return uid


def bounded(value: int, maximum: int) -> str:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError("Limit must be a positive integer")
    return str(min(value, maximum))
