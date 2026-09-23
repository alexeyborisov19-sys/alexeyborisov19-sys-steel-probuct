#!/usr/bin/env python3
"""Read-only IMAP operator utility for info@steelprodukt.ru.

Safety properties:
- opens mailboxes with EXAMINE (readonly=True), never SELECT read-write;
- fetches content with BODY.PEEK so messages are not marked as read;
- exposes no commands that STORE, MOVE, COPY, APPEND, DELETE, RENAME or EXPUNGE;
- never prints credentials.

The utility is intentionally an operator-side building block. It does not run in
the background and does not send mail.
"""

from __future__ import annotations

import argparse
import base64
import email
import imaplib
import json
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from email import policy
from email.header import decode_header
from email.message import Message
from email.parser import BytesParser
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

DEFAULT_ENV_FILE = ".env.production"
DEFAULT_MAILBOX = "INBOX"
MAX_LIST_LIMIT = 100
MAX_SCAN_LIMIT = 500
MAX_MESSAGE_BYTES = 25 * 1024 * 1024
MAX_TEXT_CHARS = 100_000
MAX_ATTACHMENT_PREVIEW_BYTES = 2 * 1024 * 1024


class MailReadOnlyError(RuntimeError):
    pass


class HtmlTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.parts.append(data)

    def text(self) -> str:
        return "\n".join(self.parts)


def read_env(path: str) -> dict[str, str]:
    values: dict[str, str] = {}
    env_path = Path(path)
    if env_path.exists():
        for raw in env_path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                value = value[1:-1]
            values[key.strip()] = value

    for key, value in os.environ.items():
        if value:
            values[key] = value
    return values


@dataclass(frozen=True)
class ImapConfig:
    host: str
    port: int
    user: str
    password: str
    mailbox: str = DEFAULT_MAILBOX

    @classmethod
    def from_env(cls, values: dict[str, str], mailbox: str = DEFAULT_MAILBOX) -> "ImapConfig":
        if values.get("IMAP_READ_ONLY", "").lower() != "true":
            raise MailReadOnlyError("Read-only IMAP guard is not enabled.")
        if values.get("IMAP_SECURE", "").lower() != "true":
            raise MailReadOnlyError("TLS is required for IMAP.")
        host = values.get("IMAP_HOST", "").strip()
        user = values.get("IMAP_USER", "").strip()
        password = values.get("IMAP_PASSWORD", "").strip() or values.get("SMTP_PASSWORD", "").strip()
        try:
            port = int(values.get("IMAP_PORT", "993"))
        except ValueError as exc:
            raise MailReadOnlyError("Invalid IMAP port.") from exc
        if not host or not user or not password:
            raise MailReadOnlyError("IMAP configuration is incomplete.")
        if port != 993:
            raise MailReadOnlyError("Only IMAPS on port 993 is allowed.")
        if mailbox.upper() != "INBOX":
            raise MailReadOnlyError("Only INBOX is enabled for the read-only operator utility.")
        return cls(host=host, port=port, user=user, password=password, mailbox=mailbox)


def decode_mime_header(value: str | None) -> str:
    if not value:
        return ""
    chunks: list[str] = []
    for item, charset in decode_header(value):
        if isinstance(item, bytes):
            for candidate in (charset, "utf-8", "cp1251", "latin-1"):
                if not candidate:
                    continue
                try:
                    chunks.append(item.decode(candidate, errors="strict"))
                    break
                except (LookupError, UnicodeDecodeError):
                    continue
            else:
                chunks.append(item.decode("utf-8", errors="replace"))
        else:
            chunks.append(item)
    return "".join(chunks).strip()


def header_value(message: Message, name: str) -> str:
    return decode_mime_header(message.get(name))


def normalized_subject(subject: str) -> str:
    current = subject.strip()
    prefix = re.compile(r"^\s*(?:re|fw|fwd|ответ|пересл)\s*:\s*", re.IGNORECASE)
    while True:
        updated = prefix.sub("", current, count=1)
        if updated == current:
            break
        current = updated
    return re.sub(r"\s+", " ", current).casefold()


def message_ids(value: str) -> set[str]:
    return {item.casefold() for item in re.findall(r"<[^>]+>", value or "")}


def collect_fetch_bytes(data: Iterable[object]) -> bytes:
    chunks: list[bytes] = []
    for item in data:
        if isinstance(item, tuple) and len(item) >= 2 and isinstance(item[1], (bytes, bytearray)):
            chunks.append(bytes(item[1]))
        elif isinstance(item, (bytes, bytearray)) and not bytes(item).startswith(b")"):
            # Literal payloads normally arrive inside tuples. Ignore protocol
            # status fragments that imaplib may return separately.
            pass
    return b"".join(chunks)


def parse_header_bytes(raw: bytes) -> Message:
    return BytesParser(policy=policy.default).parsebytes(raw, headersonly=True)


def header_summary(uid: str, message: Message, size: int | None = None) -> dict[str, object]:
    return {
        "uid": uid,
        "date": header_value(message, "Date"),
        "from": header_value(message, "From"),
        "to": header_value(message, "To"),
        "cc": header_value(message, "Cc"),
        "subject": header_value(message, "Subject"),
        "messageId": header_value(message, "Message-ID"),
        "inReplyTo": header_value(message, "In-Reply-To"),
        "references": header_value(message, "References"),
        "size": size,
    }


def safe_text_decode(payload: bytes, charset: str | None) -> str:
    for candidate in (charset, "utf-8", "cp1251", "latin-1"):
        if not candidate:
            continue
        try:
            return payload.decode(candidate, errors="strict")
        except (LookupError, UnicodeDecodeError):
            continue
    return payload.decode("utf-8", errors="replace")


def html_to_text(value: str) -> str:
    parser = HtmlTextExtractor()
    try:
        parser.feed(value)
        parser.close()
        return parser.text()
    except Exception:
        return re.sub(r"<[^>]+>", " ", value)


def trim_text(value: str, limit: int = MAX_TEXT_CHARS) -> str:
    compact = value.replace("\x00", "").strip()
    if len(compact) <= limit:
        return compact
    return compact[:limit] + "\n[…truncated…]"


def text_body(message: Message) -> str:
    plain: list[str] = []
    html: list[str] = []

    if message.is_multipart():
        parts = message.walk()
    else:
        parts = [message]

    for part in parts:
        if part.is_multipart():
            continue
        disposition = (part.get_content_disposition() or "").lower()
        if disposition == "attachment":
            continue
        content_type = part.get_content_type().lower()
        if content_type not in {"text/plain", "text/html"}:
            continue
        payload = part.get_payload(decode=True)
        if payload is None:
            content = part.get_payload()
            decoded = content if isinstance(content, str) else ""
        else:
            decoded = safe_text_decode(payload, part.get_content_charset())
        if content_type == "text/plain":
            plain.append(decoded)
        else:
            html.append(html_to_text(decoded))

    chosen = "\n\n".join(plain).strip() or "\n\n".join(html).strip()
    return trim_text(chosen)


def pdf_preview(payload: bytes) -> str | None:
    command = shutil.which("pdftotext")
    if not command or not payload or len(payload) > MAX_ATTACHMENT_PREVIEW_BYTES:
        return None
    source = None
    target = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as src:
            src.write(payload)
            source = src.name
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as dst:
            target = dst.name
        result = subprocess.run(
            [command, "-layout", source, target],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=10,
            check=False,
        )
        if result.returncode != 0:
            return None
        return trim_text(Path(target).read_text(encoding="utf-8", errors="replace"), 50_000)
    except Exception:
        return None
    finally:
        for path in (source, target):
            if path:
                try:
                    Path(path).unlink(missing_ok=True)
                except Exception:
                    pass


def attachment_summary(part: Message, index: int) -> dict[str, object]:
    payload = part.get_payload(decode=True) or b""
    content_type = part.get_content_type().lower()
    filename = decode_mime_header(part.get_filename()) or f"attachment-{index}"
    preview: str | None = None

    if len(payload) <= MAX_ATTACHMENT_PREVIEW_BYTES:
        if content_type.startswith("text/") or content_type in {
            "application/json",
            "application/xml",
            "application/csv",
        }:
            preview = trim_text(safe_text_decode(payload, part.get_content_charset()), 50_000)
        elif content_type == "application/pdf":
            preview = pdf_preview(payload)

    return {
        "index": index,
        "filename": filename,
        "contentType": content_type,
        "size": len(payload),
        "textPreview": preview,
    }


def attachment_summaries(message: Message) -> list[dict[str, object]]:
    result: list[dict[str, object]] = []
    index = 0
    for part in message.walk():
        if part.is_multipart():
            continue
        disposition = (part.get_content_disposition() or "").lower()
        filename = part.get_filename()
        if disposition != "attachment" and not filename:
            continue
        index += 1
        result.append(attachment_summary(part, index))
    return result


class ReadOnlyMailbox:
    def __init__(self, config: ImapConfig):
        self.config = config
        self.client: imaplib.IMAP4_SSL | None = None

    def __enter__(self) -> "ReadOnlyMailbox":
        client = imaplib.IMAP4_SSL(self.config.host, self.config.port, timeout=15)
        typ, _ = client.login(self.config.user, self.config.password)
        if typ != "OK":
            raise MailReadOnlyError("IMAP authentication failed.")
        typ, _ = client.select(self.config.mailbox, readonly=True)
        if typ != "OK":
            raise MailReadOnlyError("Unable to open INBOX in read-only mode.")
        self.client = client
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if not self.client:
            return
        try:
            self.client.logout()
        except Exception:
            pass
        self.client = None

    def _client(self) -> imaplib.IMAP4_SSL:
        if not self.client:
            raise MailReadOnlyError("IMAP connection is not open.")
        return self.client

    def uids(self, unseen: bool = False) -> list[str]:
        criterion = "UNSEEN" if unseen else "ALL"
        typ, data = self._client().uid("search", None, criterion)
        if typ != "OK":
            raise MailReadOnlyError("IMAP SEARCH failed.")
        raw = data[0] if data and isinstance(data[0], bytes) else b""
        return [item.decode("ascii") for item in raw.split() if item.isdigit()]

    def fetch_headers(self, uid: str) -> dict[str, object]:
        query = (
            "(BODY.PEEK[HEADER.FIELDS "
            "(DATE FROM TO CC SUBJECT MESSAGE-ID IN-REPLY-TO REFERENCES)] RFC822.SIZE)"
        )
        typ, data = self._client().uid("fetch", uid, query)
        if typ != "OK":
            raise MailReadOnlyError("IMAP header fetch failed.")
        raw = collect_fetch_bytes(data)
        if not raw:
            raise MailReadOnlyError("Message headers were not returned.")
        size = None
        for item in data:
            if isinstance(item, tuple) and isinstance(item[0], bytes):
                match = re.search(rb"RFC822\.SIZE\s+(\d+)", item[0])
                if match:
                    size = int(match.group(1))
                    break
        return header_summary(uid, parse_header_bytes(raw), size)

    def fetch_message(self, uid: str) -> dict[str, object]:
        typ, data = self._client().uid("fetch", uid, "(BODY.PEEK[] RFC822.SIZE)")
        if typ != "OK":
            raise MailReadOnlyError("IMAP message fetch failed.")
        raw = collect_fetch_bytes(data)
        if not raw:
            raise MailReadOnlyError("Message content was not returned.")
        if len(raw) > MAX_MESSAGE_BYTES:
            raise MailReadOnlyError("Message exceeds the read-only analysis size limit.")
        message = BytesParser(policy=policy.default).parsebytes(raw)
        return {
            **header_summary(uid, message, len(raw)),
            "text": text_body(message),
            "attachments": attachment_summaries(message),
        }

    def status(self) -> dict[str, object]:
        typ, data = self._client().status(self.config.mailbox, "(MESSAGES UNSEEN)")
        if typ != "OK":
            raise MailReadOnlyError("IMAP STATUS failed.")
        value = data[0].decode("utf-8", errors="replace") if data and data[0] else ""
        messages = re.search(r"MESSAGES\s+(\d+)", value)
        unseen = re.search(r"UNSEEN\s+(\d+)", value)
        return {
            "mailbox": self.config.mailbox,
            "messages": int(messages.group(1)) if messages else None,
            "unseen": int(unseen.group(1)) if unseen else None,
            "readOnly": True,
        }


def latest_headers(mailbox: ReadOnlyMailbox, limit: int, unseen: bool) -> list[dict[str, object]]:
    uids = mailbox.uids(unseen=unseen)[-limit:]
    result: list[dict[str, object]] = []
    for uid in reversed(uids):
        try:
            result.append(mailbox.fetch_headers(uid))
        except MailReadOnlyError:
            continue
    return result


def search_headers(mailbox: ReadOnlyMailbox, query: str, limit: int, scan_limit: int) -> list[dict[str, object]]:
    needle = query.casefold().strip()
    if not needle:
        return []
    uids = mailbox.uids()[-scan_limit:]
    matches: list[dict[str, object]] = []
    for uid in reversed(uids):
        try:
            item = mailbox.fetch_headers(uid)
        except MailReadOnlyError:
            continue
        haystack = " ".join(
            str(item.get(key) or "")
            for key in ("subject", "from", "to", "cc", "date", "messageId")
        ).casefold()
        if needle in haystack:
            matches.append(item)
            if len(matches) >= limit:
                break
    return matches


def thread_messages(mailbox: ReadOnlyMailbox, uid: str, scan_limit: int, limit: int) -> list[dict[str, object]]:
    seed = mailbox.fetch_headers(uid)
    seed_subject = normalized_subject(str(seed.get("subject") or ""))
    ids = set()
    ids.update(message_ids(str(seed.get("messageId") or "")))
    ids.update(message_ids(str(seed.get("inReplyTo") or "")))
    ids.update(message_ids(str(seed.get("references") or "")))

    candidates: list[dict[str, object]] = []
    for candidate_uid in mailbox.uids()[-scan_limit:]:
        try:
            item = mailbox.fetch_headers(candidate_uid)
        except MailReadOnlyError:
            continue
        candidate_ids = set()
        candidate_ids.update(message_ids(str(item.get("messageId") or "")))
        candidate_ids.update(message_ids(str(item.get("inReplyTo") or "")))
        candidate_ids.update(message_ids(str(item.get("references") or "")))
        subject_match = bool(seed_subject) and normalized_subject(str(item.get("subject") or "")) == seed_subject
        reference_match = bool(ids.intersection(candidate_ids))
        if candidate_uid == uid or subject_match or reference_match:
            candidates.append(item)

    selected = candidates[-limit:]
    result: list[dict[str, object]] = []
    for item in selected:
        try:
            result.append(mailbox.fetch_message(str(item["uid"])))
        except MailReadOnlyError:
            continue
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Read-only operator access to the Steel Produkt mailbox.")
    parser.add_argument("--env-file", default=DEFAULT_ENV_FILE)
    parser.add_argument("--mailbox", default=DEFAULT_MAILBOX)

    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("status")

    list_parser = sub.add_parser("list")
    list_parser.add_argument("--limit", type=int, default=20)
    list_parser.add_argument("--unseen", action="store_true")

    search_parser = sub.add_parser("search")
    search_parser.add_argument("query")
    search_parser.add_argument("--limit", type=int, default=20)
    search_parser.add_argument("--scan-limit", type=int, default=200)

    message_parser = sub.add_parser("message")
    message_parser.add_argument("uid")

    thread_parser = sub.add_parser("thread")
    thread_parser.add_argument("uid")
    thread_parser.add_argument("--limit", type=int, default=30)
    thread_parser.add_argument("--scan-limit", type=int, default=300)

    return parser


def clamp(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))


def main() -> int:
    args = build_parser().parse_args()
    values = read_env(args.env_file)
    config = ImapConfig.from_env(values, mailbox=args.mailbox)

    try:
        with ReadOnlyMailbox(config) as mailbox:
            if args.command == "status":
                result: object = mailbox.status()
            elif args.command == "list":
                result = {
                    "readOnly": True,
                    "messages": latest_headers(
                        mailbox,
                        clamp(args.limit, 1, MAX_LIST_LIMIT),
                        bool(args.unseen),
                    ),
                }
            elif args.command == "search":
                result = {
                    "readOnly": True,
                    "query": args.query,
                    "messages": search_headers(
                        mailbox,
                        args.query,
                        clamp(args.limit, 1, MAX_LIST_LIMIT),
                        clamp(args.scan_limit, 1, MAX_SCAN_LIMIT),
                    ),
                }
            elif args.command == "message":
                if not str(args.uid).isdigit():
                    raise MailReadOnlyError("UID must be numeric.")
                result = {"readOnly": True, "message": mailbox.fetch_message(str(args.uid))}
            elif args.command == "thread":
                if not str(args.uid).isdigit():
                    raise MailReadOnlyError("UID must be numeric.")
                result = {
                    "readOnly": True,
                    "seedUid": str(args.uid),
                    "messages": thread_messages(
                        mailbox,
                        str(args.uid),
                        clamp(args.scan_limit, 1, MAX_SCAN_LIMIT),
                        clamp(args.limit, 1, MAX_LIST_LIMIT),
                    ),
                }
            else:
                raise MailReadOnlyError("Unsupported read-only operation.")

        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
        return 0
    except (MailReadOnlyError, imaplib.IMAP4.error, OSError) as exc:
        print(
            json.dumps(
                {"ok": False, "readOnly": True, "error": str(exc)},
                ensure_ascii=False,
                separators=(",", ":"),
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
