"""IMAP/SMTP operations for the Steel Produkt private mail MCP gateway.

Dependencies: Python standard library. Secrets are read only from server-side
environment variables or an existing operator-controlled .env.production file.
No public HTTP listener, mailbox password export, or background daemon here.
"""
from __future__ import annotations

import base64
import contextlib
import email
import imaplib
import os
import re
import smtplib
import ssl
from dataclasses import dataclass
from email import policy
from email.header import decode_header
from email.message import EmailMessage
from email.parser import BytesParser
from email.utils import formatdate, getaddresses, make_msgid
from pathlib import Path
from typing import Any, Iterator

MAX_BODY = 200_000
MAX_EMAIL_BYTES = 25 * 1024 * 1024
MAX_ATTACHMENT_BASE64_BYTES = 1024 * 1024
MAX_RECIPIENTS = 25


class MailOperationError(ValueError):
    """A safe, non-secret-bearing mailbox error."""


def load_env() -> dict[str, str]:
    """Read existing protected config, with runtime environment taking priority."""
    root = Path(__file__).resolve().parents[2]
    path = Path(os.environ.get("MAIL_MCP_ENV_FILE") or root / ".env.production")
    result: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            value = value.strip()
            if len(value) > 1 and value[0] in {"'", '"'} and value[-1] == value[0]:
                value = value[1:-1]
            result[key.strip()] = value
    return {**result, **os.environ}


def enabled(config: dict[str, str], key: str) -> bool:
    return config.get(key, "").strip().lower() == "true"


@dataclass(frozen=True)
class Config:
    imap_host: str
    imap_user: str
    imap_password: str
    smtp_host: str
    smtp_user: str
    smtp_password: str
    smtp_port: int
    smtp_from: str
    write: bool
    send: bool
    permanent_delete: bool

    @classmethod
    def load(cls) -> "Config":
        data = load_env()
        imap_host = data.get("IMAP_HOST", "imap.mail.ru").strip()
        imap_user = data.get("IMAP_USER", "info@steelprodukt.ru").strip()
        imap_password = data.get("IMAP_PASSWORD", "").strip() or data.get("SMTP_PASSWORD", "").strip()
        if not imap_user or imap_user.casefold() != "info@steelprodukt.ru":
            raise MailOperationError("Corporate mailbox identity does not match the approved address")
        if not imap_host or data.get("IMAP_PORT", "993") != "993":
            raise MailOperationError("IMAP over port 993 is required")
        if data.get("IMAP_SECURE", "true").lower() != "true":
            raise MailOperationError("TLS is required for IMAP")
        if not imap_password:
            raise MailOperationError("IMAP credentials are not configured on the private server")
        smtp_host = data.get("SMTP_HOST", "").strip() or "smtp.mail.ru"
        smtp_user = data.get("SMTP_USER", "").strip() or imap_user
        smtp_password = data.get("SMTP_PASSWORD", "").strip() or imap_password
        smtp_from = data.get("SMTP_FROM", "").strip() or imap_user
        if smtp_user.casefold() != imap_user.casefold() or smtp_from.casefold() != imap_user.casefold():
            raise MailOperationError("SMTP sender must match the authorized mailbox")
        try:
            smtp_port = int(data.get("SMTP_PORT", "465"))
        except ValueError as exc:
            raise MailOperationError("Invalid SMTP port") from exc
        if smtp_port not in {465, 587}:
            raise MailOperationError("Only TLS-protected SMTP ports 465 or 587 are supported")
        return cls(
            imap_host, imap_user, imap_password,
            smtp_host, smtp_user, smtp_password, smtp_port, smtp_from,
            enabled(data, "MAIL_MCP_WRITE_ENABLED"),
            enabled(data, "MAIL_MCP_SEND_ENABLED"),
            enabled(data, "MAIL_MCP_PERMANENT_DELETE_ENABLED"),
        )


def require(config: Config, action: str) -> None:
    if not config.write:
        raise MailOperationError("Mail changes are disabled on the server")
    if action == "send" and not config.send:
        raise MailOperationError("Sending is disabled on the server")
    if action == "permanent_delete" and not config.permanent_delete:
        raise MailOperationError("Permanent deletion is disabled on the server")


def uid_number(uid: str) -> str:
    if not isinstance(uid, str) or not uid.isascii() or not uid.isdecimal() or not 1 <= len(uid) <= 20 or int(uid) < 1:
        raise MailOperationError("A positive numeric IMAP UID is required")
    return uid


def imap_utf7_encode(value: str) -> str:
    """Encode mailbox names using IMAP modified UTF-7 (RFC 3501)."""
    output: list[str] = []
    buffered: list[str] = []
    def flush() -> None:
        if buffered:
            encoded = base64.b64encode("".join(buffered).encode("utf-16-be")).decode("ascii")
            output.append("&" + encoded.rstrip("=").replace("/", ",") + "-")
            buffered.clear()
    for char in value:
        if char == "&":
            flush()
            output.append("&-")
        elif 0x20 <= ord(char) <= 0x7e:
            flush()
            output.append(char)
        else:
            buffered.append(char)
    flush()
    return "".join(output)


def imap_utf7_decode(value: str) -> str:
    def replace(match: re.Match[str]) -> str:
        text = match.group(1)
        if not text:
            return "&"
        try:
            padded = text.replace(",", "/") + "=" * ((-len(text)) % 4)
            return base64.b64decode(padded).decode("utf-16-be")
        except (ValueError, UnicodeError):
            return match.group(0)
    return re.sub(r"&([A-Za-z0-9+,]*)-", replace, value)


def quote_folder(name: str) -> str:
    if not isinstance(name, str) or not name or len(name) > 200 or any(c in name for c in "\x00\r\n"):
        raise MailOperationError("Invalid mailbox folder")
    encoded = imap_utf7_encode(name)
    return '"' + encoded.replace("\\", "\\\\").replace('"', '\\"') + '"'


def parse_folder_line(line: bytes) -> dict[str, Any] | None:
    text = line.decode("ascii", errors="replace")
    match = re.fullmatch(r'\(([^)]*)\)\s+(?:"[^"]*"|NIL)\s+(.+)', text)
    if not match:
        return None
    tail = match.group(2)
    if tail.startswith('"') and tail.endswith('"'):
        tail = tail[1:-1].replace('\\"', '"').replace('\\\\', '\\')
    return {"name": imap_utf7_decode(tail), "flags": match.group(1).split()}


@contextlib.contextmanager
def mailbox(config: Config) -> Iterator[imaplib.IMAP4_SSL]:
    client = imaplib.IMAP4_SSL(config.imap_host, 993, ssl_context=ssl.create_default_context(), timeout=20)
    try:
        kind, _ = client.login(config.imap_user, config.imap_password)
        if kind != "OK":
            raise MailOperationError("IMAP authentication failed")
        yield client
    finally:
        try:
            client.logout()
        except (OSError, imaplib.IMAP4.error):
            pass


def folders(client: imaplib.IMAP4_SSL) -> list[dict[str, Any]]:
    result, data = client.list()
    if result != "OK":
        raise MailOperationError("Cannot list IMAP folders")
    return [parsed for line in data or [] if isinstance(line, bytes)
            if (parsed := parse_folder_line(line)) is not None]


def existing_folder(client: imaplib.IMAP4_SSL, name: str) -> str:
    if not isinstance(name, str) or not name.strip():
        raise MailOperationError("Folder name is required")
    if name.casefold() == "inbox":
        return "INBOX"
    for folder in folders(client):
        if folder["name"].casefold() == name.casefold() and not any(
            flag.casefold() == r"\noselect" for flag in folder["flags"]
        ):
            return folder["name"]
    raise MailOperationError("Folder not found on the mail server")


def special_folder(client: imaplib.IMAP4_SSL, flag: str) -> str:
    for folder in folders(client):
        if any(mark.casefold() == ("\\" + flag).casefold() for mark in folder["flags"]):
            return folder["name"]
    raise MailOperationError("Required special-use folder not advertised by IMAP; choose an existing folder explicitly")


def select(client: imaplib.IMAP4_SSL, folder: str, readonly: bool) -> tuple[str, int]:
    matched = existing_folder(client, folder)
    result, data = client.select(quote_folder(matched), readonly=readonly)
    if result != "OK":
        raise MailOperationError("Cannot open requested mailbox folder")
    count = int(data[0]) if data and data[0] else 0
    return matched, count


def decode_header(value: str | None) -> str:
    if not value:
        return ""
    parts: list[str] = []
    for chunk, encoding in email.header.decode_header(value):
        if isinstance(chunk, str):
            parts.append(chunk)
        else:
            for codec in (encoding, "utf-8", "cp1251", "latin-1"):
                if not codec:
                    continue
                try:
                    parts.append(chunk.decode(codec))
                    break
                except (LookupError, UnicodeError):
                    continue
            else:
                parts.append(chunk.decode("utf-8", errors="replace"))
    return "".join(parts).strip()


def text_body(message: EmailMessage) -> str:
    contents = []
    for part in message.walk():
        if part.is_multipart() or part.get_content_disposition() == "attachment":
            continue
        if part.get_content_type() == "text/plain":
            try:
                contents.append(part.get_content())
            except (UnicodeError, LookupError):
                continue
    return "\n\n".join(contents).strip()[:MAX_BODY]


def metadata(message: EmailMessage, uid: str) -> dict[str, Any]:
    attachments = []
    for idx, part in enumerate(
        p for p in message.walk() if not p.is_multipart() and
        (p.get_content_disposition() == "attachment" or p.get_filename())
    ):
        contents = part.get_payload(decode=True) or b""
        attachments.append({
            "index": idx + 1, "filename": decode_header(part.get_filename()),
            "contentType": part.get_content_type(), "size": len(contents),
        })
    return {
        "uid": uid, "from": decode_header(message.get("From")),
        "to": decode_header(message.get("To")), "cc": decode_header(message.get("Cc")),
        "subject": decode_header(message.get("Subject")),
        "date": message.get("Date", ""),
        "messageId": message.get("Message-ID", ""),
        "inReplyTo": message.get("In-Reply-To", ""),
        "references": message.get("References", ""),
        "text": text_body(message), "attachments": attachments,
    }


def fetch_message(client: imaplib.IMAP4_SSL, uid: str) -> EmailMessage:
    response, data = client.uid("FETCH", uid_number(uid), "(BODY.PEEK[] RFC822.SIZE)")
    if response != "OK":
        raise MailOperationError("Message could not be fetched")
    raw = b"".join(item[1] for item in data or [] if isinstance(item, tuple) and isinstance(item[1], bytes))
    if not raw or len(raw) > MAX_EMAIL_BYTES:
        raise MailOperationError("Email message not found or exceeds the safe limit")
    return BytesParser(policy=policy.default).parsebytes(raw)


def list_folder_messages(folder: str = "INBOX", limit: int = 20, unseen_only: bool = False) -> dict[str, Any]:
    config = Config.load()
    if not 1 <= limit <= 50:
        raise MailOperationError("Limit must be between 1 and 50")
    with mailbox(config) as client:
        selected, count = select(client, folder, readonly=True)
        resp, data = client.uid("SEARCH", None, "UNSEEN" if unseen_only else "ALL")
        if resp != "OK":
            raise MailOperationError("Mailbox search failed")
        uids = (data[0] if data and data[0] else b"").decode("ascii").split()[-limit:]
        headers = []
        for uid in reversed(uids):
            kind, entries = client.uid("FETCH", uid, "(BODY.PEEK[HEADER.FIELDS (DATE FROM TO SUBJECT MESSAGE-ID)] RFC822.SIZE)")
            if kind != "OK":
                continue
            raw = b"".join(e[1] for e in entries or [] if isinstance(e, tuple) and isinstance(e[1], bytes))
            if raw:
                msg = BytesParser(policy=policy.default).parsebytes(raw, headersonly=True)
                headers.append({key: value for key, value in metadata(msg, uid).items() if key not in {"text", "attachments"}})
        return {"folder": selected, "total": count, "messages": headers, "readOnly": True}


def read_message(folder: str, uid: str) -> dict[str, Any]:
    with mailbox(Config.load()) as client:
        select(client, folder, readonly=True)
        return {"folder": folder, "message": metadata(fetch_message(client, uid_number(uid)), uid), "readOnly": True}


def read_attachment(folder: str, uid: str, index: int) -> dict[str, Any]:
    if not 1 <= index <= 100:
        raise MailOperationError("Attachment index out of range")
    with mailbox(Config.load()) as client:
        select(client, folder, readonly=True)
        message = fetch_message(client, uid_number(uid))
        attachment_parts = [
            p for p in message.walk() if not p.is_multipart() and
            (p.get_content_disposition() == "attachment" or p.get_filename())
        ]
        if index > len(attachment_parts):
            raise MailOperationError("Attachment does not exist")
        part = attachment_parts[index - 1]
        raw = part.get_payload(decode=True) or b""
        if len(raw) > MAX_ATTACHMENT_BASE64_BYTES:
            raise MailOperationError("Attachment is too large to return through the MCP text channel")
        return {
            "filename": decode_header(part.get_filename()),
            "contentType": part.get_content_type(),
            "byteLength": len(raw), "base64": base64.b64encode(raw).decode("ascii"),
        }


def flag_message(folder: str, uid: str, flag: str, set_flag: bool) -> dict[str, Any]:
    if flag not in {r"\Seen", r"\Flagged", r"\Answered"}:
        raise MailOperationError("Unsupported IMAP flag")
    config = Config.load()
    require(config, "write")
    with mailbox(config) as client:
        selected, _ = select(client, folder, readonly=False)
        result, _ = client.uid("STORE", uid_number(uid), "+FLAGS.SILENT" if set_flag else "-FLAGS.SILENT", f"({flag})")
        if result != "OK":
            raise MailOperationError("Unable to update message flag")
        return {"folder": selected, "uid": uid, "flag": flag, "enabled": set_flag}


def move_copy(folder: str, uid: str, destination: str, move: bool) -> dict[str, Any]:
    config = Config.load()
    require(config, "write")
    with mailbox(config) as client:
        selected, _ = select(client, folder, readonly=False)
        dst = existing_folder(client, destination)
        if selected.casefold() == dst.casefold():
            raise MailOperationError("Source and destination must be different folders")
        if move and b"MOVE" not in client.capabilities:
            raise MailOperationError("The mail server does not support safe atomic UID MOVE")
        result, _ = client.uid("MOVE" if move else "COPY", uid_number(uid), quote_folder(dst))
        if result != "OK":
            raise MailOperationError("Unable to move or copy message")
        return {"uid": uid, "source": selected, "destination": dst, "operation": "move" if move else "copy"}


def move_to_special(folder: str, uid: str, purpose: str) -> dict[str, Any]:
    config = Config.load()
    require(config, "write")
    with mailbox(config) as client:
        destination = special_folder(client, purpose)
    return move_copy(folder, uid, destination, move=True)


def create_folder(name: str) -> dict[str, Any]:
    config = Config.load()
    require(config, "write")
    with mailbox(config) as client:
        quote_folder(name)
        if any(item["name"].casefold() == name.casefold() for item in folders(client)):
            raise MailOperationError("A folder with this name already exists")
        status, _ = client.create(quote_folder(name))
        if status != "OK":
            raise MailOperationError("Folder could not be created")
        return {"created": name}


def rename_folder(source: str, destination: str) -> dict[str, Any]:
    config = Config.load()
    require(config, "write")
    with mailbox(config) as client:
        old = existing_folder(client, source)
        if old == "INBOX" or any(item["name"].casefold() == destination.casefold() for item in folders(client)):
            raise MailOperationError("The source is protected or destination exists")
        if any(item["name"].casefold() == old.casefold() and
               any(mark.casefold() in {r"\inbox", r"\sent", r"\drafts", r"\trash", r"\junk", r"\archive"}
                   for mark in item["flags"]) for item in folders(client)):
            raise MailOperationError("Cannot rename special-use folder")
        state, _ = client.rename(quote_folder(old), quote_folder(destination))
        if state != "OK":
            raise MailOperationError("Cannot rename folder")
        return {"renamedFrom": old, "renamedTo": destination}


def delete_empty_folder(name: str, confirmation: str) -> dict[str, Any]:
    config = Config.load()
    require(config, "write")
    if confirmation != "DELETE_EMPTY_FOLDER":
        raise MailOperationError("Explicit deletion confirmation required")
    with mailbox(config) as client:
        selected, count = select(client, name, readonly=True)
        if selected == "INBOX" or count > 0:
            raise MailOperationError("Cannot delete INBOX or a non-empty folder")
        if any(item["name"].casefold() == selected.casefold() and
               any(mark.casefold() in {r"\inbox", r"\sent", r"\drafts", r"\trash", r"\junk", r"\archive"}
                   for mark in item["flags"]) for item in folders(client)):
            raise MailOperationError("Cannot delete special-use folder")
        state, _ = client.delete(quote_folder(selected))
        if state != "OK":
            raise MailOperationError("Cannot delete folder")
        return {"deletedFolder": selected}


def permanent_delete(folder: str, uid: str, confirmation: str) -> dict[str, Any]:
    config = Config.load()
    require(config, "permanent_delete")
    if confirmation != "PERMANENTLY_DELETE_MESSAGE":
        raise MailOperationError("Explicit permanent-deletion confirmation required")
    with mailbox(config) as client:
        selected, _ = select(client, folder, readonly=False)
        if b"UIDPLUS" not in client.capabilities:
            raise MailOperationError("Safe targeted UID EXPUNGE not supported by mail server")
        uid = uid_number(uid)
        status, _ = client.uid("STORE", uid, "+FLAGS.SILENT", r"(\Deleted)")
        if status != "OK":
            raise MailOperationError("Could not mark message for deletion")
        status, _ = client.uid("EXPUNGE", uid)
        if status != "OK":
            raise MailOperationError("Could not permanently remove specified message")
        return {"permanentlyDeleted": uid, "folder": selected}


def validated_addresses(values: list[str], label: str) -> list[str]:
    if not isinstance(values, list) or len(values) > MAX_RECIPIENTS:
        raise MailOperationError(f"Invalid {label} recipient list")
    result: list[str] = []
    for original in values:
        if not isinstance(original, str) or any(c in original for c in "\r\n\x00"):
            raise MailOperationError(f"Invalid {label} email address")
        parsed = getaddresses([original])
        if len(parsed) != 1 or not parsed[0][1]:
            raise MailOperationError(f"Invalid {label} email address")
        address = parsed[0][1]
        if len(address) > 254 or "@" not in address or any(c.isspace() for c in address):
            raise MailOperationError(f"Invalid {label} email address")
        result.append(address)
    return result


def compose(
    config: Config, to: list[str], cc: list[str], bcc: list[str],
    subject: str, body: str,
    in_reply_to: str = "", references: str = "",
    draft: bool = False,
) -> tuple[EmailMessage, list[str]]:
    recipients_to = validated_addresses(to, "To")
    recipients_cc = validated_addresses(cc, "Cc")
    recipients_bcc = validated_addresses(bcc, "Bcc")
    envelope_recipients = list(dict.fromkeys(recipients_to + recipients_cc + recipients_bcc))
    if not recipients_to or not envelope_recipients or len(envelope_recipients) > MAX_RECIPIENTS:
        raise MailOperationError("Provide between 1 and 25 recipients, including a To recipient")
    if not isinstance(subject, str) or len(subject) > 500 or "\r" in subject or "\n" in subject:
        raise MailOperationError("Invalid subject")
    if not isinstance(body, str) or len(body) > MAX_BODY:
        raise MailOperationError("Message body is too long")
    message = EmailMessage(policy=policy.SMTP)
    message["From"] = config.smtp_from
    message["To"] = ", ".join(recipients_to)
    if recipients_cc:
        message["Cc"] = ", ".join(recipients_cc)
    if draft and recipients_bcc:
        message["Bcc"] = ", ".join(recipients_bcc)
    message["Subject"] = subject
    message["Date"] = formatdate(localtime=False, usegmt=True)
    message["Message-ID"] = make_msgid(domain="steelprodukt.ru")
    if in_reply_to:
        message["In-Reply-To"] = in_reply_to
    if references:
        message["References"] = references[-1200:]
    message.set_content(body)
    return message, envelope_recipients


def save_draft(to: list[str], subject: str, body: str, cc: list[str] | None = None, bcc: list[str] | None = None,
               reply_folder: str = "", reply_uid: str = "") -> dict[str, Any]:
    config = Config.load()
    require(config, "write")
    in_reply_to = references = ""
    with mailbox(config) as client:
        if reply_uid:
            select(client, reply_folder or "INBOX", readonly=True)
            parent = fetch_message(client, uid_number(reply_uid))
            in_reply_to = parent.get("Message-ID", "")
            references = (parent.get("References", "") + " " + in_reply_to).strip()
        draft_folder = special_folder(client, "Drafts")
        msg, _ = compose(config, to, cc or [], bcc or [], subject, body, in_reply_to, references, draft=True)
        result, _ = client.append(quote_folder(draft_folder), r"(\Draft)", None, msg.as_bytes())
        if result != "OK":
            raise MailOperationError("IMAP server rejected the draft")
        return {"saved": True, "folder": draft_folder, "subject": subject, "recipientCount": len(to)}


def send_mail(
    to: list[str], subject: str, body: str, cc: list[str] | None = None, bcc: list[str] | None = None,
    in_reply_to: str = "", references: str = "",
) -> dict[str, Any]:
    config = Config.load()
    require(config, "send")
    message, recipients = compose(config, to, cc or [], bcc or [], subject, body, in_reply_to, references)
    context = ssl.create_default_context()
    try:
        if config.smtp_port == 465:
            with smtplib.SMTP_SSL(config.smtp_host, 465, timeout=25, context=context) as client:
                client.login(config.smtp_user, config.smtp_password)
                client.send_message(message, from_addr=config.smtp_from, to_addrs=recipients)
        else:
            with smtplib.SMTP(config.smtp_host, 587, timeout=25) as client:
                client.ehlo()
                client.starttls(context=context)
                client.ehlo()
                client.login(config.smtp_user, config.smtp_password)
                client.send_message(message, from_addr=config.smtp_from, to_addrs=recipients)
    except (smtplib.SMTPException, OSError) as exc:
        # Intentionally no exception chaining: SMTP exceptions can contain
        # personal data, server details, recipients and/or message content.
        raise MailOperationError("SMTP send failed; delivery state must be checked before retry") from None
    return {"sent": True, "messageId": message["Message-ID"], "recipientCount": len(recipients),
            "subject": subject, "sentCopy": "Check Sent folder; provider behavior is not assumed"}


def send_reply(folder: str, uid: str, body: str, include_all: bool = False) -> dict[str, Any]:
    config = Config.load()
    require(config, "send")
    with mailbox(config) as client:
        select(client, folder, readonly=True)
        original = fetch_message(client, uid_number(uid))
    reply_dest = original.get("Reply-To") or original.get("From")
    to = [address for _, address in getaddresses([reply_dest or ""]) if address]
    if not to:
        raise MailOperationError("Original email has no reply address")
    cc = []
    if include_all:
        cc = [addr for _, addr in getaddresses(
            [original.get("To", ""), original.get("Cc", "")]
        ) if addr and addr.casefold() != config.imap_user.casefold() and addr not in to]
    subject = decode_header(original.get("Subject"))
    if not subject.lower().startswith("re:"):
        subject = "Re: " + subject
    original_id = original.get("Message-ID", "")
    refs = (original.get("References", "") + " " + original_id).strip()
    result = send_mail(to, subject, body, cc=cc, in_reply_to=original_id, references=refs)
    return {**result, "repliedToUid": uid, "folder": folder}


def send_forward(folder: str, uid: str, to: list[str], message: str = "") -> dict[str, Any]:
    config = Config.load()
    require(config, "send")
    with mailbox(config) as client:
        select(client, folder, readonly=True)
        original = fetch_message(client, uid_number(uid))
    subject = decode_header(original.get("Subject"))
    if not subject.lower().startswith("fwd:"):
        subject = "Fwd: " + subject
    if not isinstance(message, str) or len(message) > MAX_BODY // 2:
        raise MailOperationError("Forward comment is too long")
    origin = metadata(original, uid)
    body = "\n".join([
        message, "", "---------- Forwarded message ----------",
        "From: " + origin["from"], "Date: " + origin["date"],
        "Subject: " + origin["subject"], "",
        origin["text"][:MAX_BODY // 2], "",
        "[Original attachments are NOT included in this forward.]",
    ])
    result = send_mail(to, subject, body)
    return {**result, "forwardedUid": uid, "attachmentsIncluded": False}


def capabilities() -> dict[str, Any]:
    config = Config.load()
    return {"mailbox": config.imap_user, "read": True, "writeEnabled": config.write,
            "sendEnabled": config.write and config.send,
            "permanentDeleteEnabled": config.write and config.permanent_delete}
