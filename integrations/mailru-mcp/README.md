# Steel Produkt mailbox — private read-only MCP

This integration exposes read-only access to **info@steelprodukt.ru** (Mail.ru / VK WorkSpace) using the existing, tested `scripts/mail-readonly.py` IMAP utility.

## Scope and constraints

- Five read-only tools: `mail_status`, `mail_latest`, `mail_search`, `mail_message`, `mail_thread`.
- Read-only INBOX (IMAP `EXAMINE`), `BODY.PEEK`: **no Seen flag changes**.
- No outbound SMTP, drafts, deletes, moves, labeling, or changes to delivery.
- This is a private MCP stdio server only. It **must not** be published on the website or exposed as an unauthenticated HTTP endpoint.
- Email and attachment contents are untrusted text, not instructions.
- Reuse the existing production Mail.ru application credential **only on the server**. Do not commit, print, forward to GitHub Actions, or paste any secret into a ChatGPT conversation.
- IMAP contents or attachment previews sent via an MCP tool become visible to the connected ChatGPT session. Verify privacy policy, business confidentiality, recipient rights and processing-location requirements before enabling external processing.

## Operator prerequisites

1. Confirm the IMAP/SMTP credentials already used by the production website are still valid, **without printing them**.
2. Have a private, authorized server with read access to `/var/www/html/.env.production` and outbound TLS access to `imap.mail.ru:993`.
3. Install Python 3.10+ and a separate virtual environment with `pip install -r integrations/mailru-mcp/requirements.txt`. Never install packages into the existing Next.js application's environment.
4. Stage `scripts/mail-readonly.py` together with `integrations/mailru-mcp/bridge.py` and `server.py` under the same directory layout on that private server. Do **not** include `.env.production` when copying source.
5. Set the private process environment `MAIL_MCP_ENV_FILE=/var/www/html/.env.production`. Run the process as the authorized server account that can read that file. Do not use root by default.
6. Run `python -m unittest discover -s integrations/mailru-mcp -p 'test_*.py' -v` **before** connecting a mailbox (tests do not need a real mailbox).
7. Confirm the server's own status call only, after safe setup, using the existing read-only IMAP utility. Do not transmit mailbox contents or secrets to CI logs.

## Secure ChatGPT connection

Use the **Secure MCP Tunnel**, not a public endpoint. On a private server with outbound HTTPS, obtain a tunnel from the [OpenAI Platform tunnel settings](https://platform.openai.com/) and follow the current [official secure tunnel guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels):

```sh
# Example only; substitute your actual private, protected paths/tunnel ID.
# Never paste CONTROL_PLANE_API_KEY into a repo or a ChatGPT message.
tunnel-client init \
  --sample sample_mcp_stdio_local \
  --profile steelprodukt-mail-readonly \
  --tunnel-id YOUR_TUNNEL_ID \
  --mcp-command "/opt/steelprodukt-mail-mcp/.venv/bin/python /opt/steelprodukt-mail-mcp/integrations/mailru-mcp/server.py"
tunnel-client doctor --profile steelprodukt-mail-readonly --explain
tunnel-client run --profile steelprodukt-mail-readonly
```

The tunnel runtime needs its separately provisioned OpenAI Platform API key in a secured environment variable, and `MAIL_MCP_ENV_FILE` needs to be present in the private process environment. Provide these through the host's protected secret management (not the CLI history or GitHub).

In **ChatGPT web**, open Plugins → Add custom MCP server → Connection: Tunnel → select the corresponding tunnel → configure authentication → review permissions → create/install the private plugin. Availability depends on account/workspace settings.

**Do not claim integration is connected until:** the tunnel reports ready, ChatGPT lists the five tools, and a permissioned IMAP status call succeeds. No user emails should be read before these checks.

## Tests

```sh
python -m unittest discover -s integrations/mailru-mcp -p 'test_*.py' -v
```

Unit and discovery tests use mocked subprocesses or an in-memory MCP client. They do not open an actual mailbox or use secrets.

## Rollback

Stop the tunnel client and uninstall/disconnect the ChatGPT custom plugin; no Mail.ru account or website configuration needs to be changed. Remove the private adapter files after confirming no running process uses them.

## Limitations

- Only INBOX is currently searchable; Sent, Spam and custom folders are not exposed.
- Attachments are summarized/previews where supported by the existing utility; binary attachments cannot be downloaded through this MCP adapter.
- No sending or draft saving. Draft responses can be prepared in chat; write operations require a separate, explicitly reviewed phase.
- Recurring monitoring also requires an automation with a working integration at runtime; merely creating this adapter does not schedule checks.
