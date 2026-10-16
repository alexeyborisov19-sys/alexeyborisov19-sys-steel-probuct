"""No network, no secrets, no real mailbox use during tests."""
from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bridge import MailBridgeError, bounded, invoke, valid_uid


class MailBridgeTests(unittest.TestCase):
    @patch("bridge.subprocess.run")
    def test_status_read_only(self, runner):
        payload = {"mailbox": "INBOX", "messages": 4, "unseen": 2, "readOnly": True}
        runner.return_value = subprocess.CompletedProcess([], 0, json.dumps(payload), "")
        self.assertEqual(invoke("status"), payload)
        argv = runner.call_args.args[0]
        self.assertEqual(argv[0], sys.executable)
        self.assertIn("mail-readonly.py", argv[1])
        self.assertIn("status", argv)
        self.assertFalse(runner.call_args.kwargs["check"])
        self.assertEqual(runner.call_args.kwargs["stdin"], subprocess.DEVNULL)
        self.assertNotIn("shell", runner.call_args.kwargs)

    @patch("bridge.subprocess.run")
    def test_reject_write_commands(self, runner):
        for action in ("send", "delete", "store", "expunge", "move"):
            with self.assertRaises(ValueError):
                invoke(action)
        runner.assert_not_called()

    def test_uid_validation(self):
        self.assertEqual(valid_uid("12345"), "12345")
        for uid in ("", "0", "-1", "--env-file", "１２", "1\n2", "1"*21):
            with self.assertRaises(ValueError):
                valid_uid(uid)

    def test_limit(self):
        self.assertEqual(bounded(500, 50), "50")
        for value in (0, -1, True):
            with self.assertRaises(ValueError):
                bounded(value, 50)

    @patch("bridge.subprocess.run")
    def test_redact_process_error(self, runner):
        runner.return_value = subprocess.CompletedProcess([], 1, '{"error":"secret"}', "password=secret")
        with self.assertRaises(MailBridgeError) as error:
            invoke("status")
        self.assertNotIn("secret", str(error.exception))

    @patch("bridge.subprocess.run")
    def test_reject_non_readonly_response(self, runner):
        runner.return_value = subprocess.CompletedProcess([], 0, '{"readOnly":false}', "")
        with self.assertRaises(MailBridgeError):
            invoke("status")


if __name__ == "__main__":
    unittest.main()
