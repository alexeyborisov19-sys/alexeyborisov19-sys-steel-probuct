"""In-memory MCP discovery test: no mailbox connection or credentials."""
from __future__ import annotations

import asyncio
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from mcp import Client
from server import mcp


class MailServerDiscoveryTests(unittest.TestCase):
    def test_five_tools_all_read_only(self):
        async def check():
            async with Client(mcp, raise_exceptions=True) as client:
                result = await client.list_tools()
                tools = result.tools
                self.assertEqual(
                    {tool.name for tool in tools},
                    {"mail_status", "mail_latest", "mail_search", "mail_message", "mail_thread"},
                )
                for tool in tools:
                    self.assertIsNotNone(tool.annotations)
                    self.assertTrue(tool.annotations.read_only_hint, tool.name)
                    self.assertFalse(tool.annotations.open_world_hint, tool.name)
                    self.assertEqual(tool.input_schema["type"], "object")
        asyncio.run(check())


if __name__ == "__main__":
    unittest.main()
