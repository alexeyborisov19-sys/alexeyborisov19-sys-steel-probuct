"""Unit checks: no network use, no mail credentials, no real messages."""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mailops


class MailOpsTests(unittest.TestCase):
    def test_modified_utf7_names(self):
        for folder in ("INBOX", "Отправленные", "Проекты & архив", "New/2026", "A&B", "Сделки/Смоленск"):
            self.assertEqual(mailops.imap_utf7_decode(mailops.imap_utf7_encode(folder)), folder)
        self.assertEqual(mailops.imap_utf7_encode("A&B"), "A&-B")

    def test_parse_list(self):
        raw = r'(\HasNoChildren \Sent) "/" "Sent"'.encode()
        self.assertEqual(mailops.parse_folder_line(raw), {"name": "Sent", "flags": [r"\HasNoChildren", r"\Sent"]})

    def test_reject_mailbox_injection(self):
        for folder in ("", "INBOX\nLOGOUT", "Inbox\r\n", "Folder\x00", "a" * 201):
            with self.assertRaises(mailops.MailOperationError):
                mailops.quote_folder(folder)

    def test_reject_invalid_uid(self):
        for uid in ("", "0", "-1", "1\n2", "xxx", "１２", "123456789012345678901"):
            with self.assertRaises(mailops.MailOperationError):
                mailops.uid_number(uid)
        self.assertEqual(mailops.uid_number("123"), "123")

    def test_config_requires_private_credentials(self):
        fake_env = {
            "IMAP_HOST": "imap.mail.ru",
            "IMAP_PORT": "993",
            "IMAP_SECURE": "true",
            "IMAP_USER": "info@steelprodukt.ru",
            "SMTP_USER": "info@steelprodukt.ru",
            "SMTP_FROM": "info@steelprodukt.ru",
            "IMAP_PASSWORD": "",
            "SMTP_PASSWORD": "",
        }
        with patch.object(mailops, "load_env", return_value=fake_env):
            with self.assertRaisesRegex(mailops.MailOperationError, "not configured"):
                mailops.Config.load()

    def test_write_disabled_by_default(self):
        config = mailops.Config(
            "imap.mail.ru", "info@steelprodukt.ru", "test-only",
            "smtp.mail.ru", "info@steelprodukt.ru", "test-only",
            465, "info@steelprodukt.ru", False, False, False,
        )
        for action in ("write", "send", "permanent_delete"):
            with self.assertRaisesRegex(mailops.MailOperationError, "disabled"):
                mailops.require(config, action)

    def test_compose_bcc_not_visible(self):
        config = mailops.Config(
            "imap.mail.ru", "info@steelprodukt.ru", "test-only",
            "smtp.mail.ru", "info@steelprodukt.ru", "test-only",
            465, "info@steelprodukt.ru", True, True, False,
        )
        message, recipients = mailops.compose(
            config,
            ["customer@example.com"], ["sales@example.org"],
            ["hidden@example.net"], "Offer", "Hello",
        )
        self.assertEqual(len(recipients), 3)
        self.assertNotIn("Bcc", message)
        self.assertIn("hidden@example.net", recipients)
        self.assertNotIn("hidden@example.net", message.as_string())

    def test_reject_header_injection(self):
        config = mailops.Config(
            "imap.mail.ru", "info@steelprodukt.ru", "test-only",
            "smtp.mail.ru", "info@steelprodukt.ru", "test-only",
            465, "info@steelprodukt.ru", True, True, False,
        )
        with self.assertRaises(mailops.MailOperationError):
            mailops.compose(config, ["ok@example.com"], [], [], "Hi\r\nBcc: x@example.com", "body")
        with self.assertRaises(mailops.MailOperationError):
            mailops.compose(config, ["to@example.com\r\nBCC: x@example.com"], [], [], "Hello", "body")

    @patch.object(mailops, "mailbox")
    def test_send_disabled_never_touches_imap(self, mailbox):
        with patch.object(mailops.Config, "load", return_value=mailops.Config(
            "imap.mail.ru", "info@steelprodukt.ru", "test-only",
            "smtp.mail.ru", "info@steelprodukt.ru", "test-only",
            465, "info@steelprodukt.ru", True, False, False,
        )):
            with self.assertRaisesRegex(mailops.MailOperationError, "disabled"):
                mailops.send_mail(["client@example.com"], "Test", "Body")
        mailbox.assert_not_called()


if __name__ == "__main__":
    unittest.main()
