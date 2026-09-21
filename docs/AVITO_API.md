# Avito API integration

Status: code-level integration is prepared; production credentials are intentionally not stored in Git.

## Purpose

The integration is for the Steel Produkt Avito Pro cabinet and is initially **read-only**:

- authenticate with Avito API using OAuth 2.0 client credentials;
- identify the connected Avito account;
- load the cabinet's advertisements;
- load advertisement statistics for the selected period;
- produce a private audit JSON for review;
- flag exact normalized-title duplicates as review candidates.

The audit does **not** automatically remove or deactivate advertisements. Removal/deactivation must be implemented only after the exact account capabilities and API method available to this Avito tariff are verified in production.

## Production secrets

Store only on the VPS in `/var/www/html/.env.production`:

```env
AVITO_INTEGRATION_ENABLED=true
AVITO_CLIENT_ID=
AVITO_CLIENT_SECRET=
AVITO_API_BASE_URL=https://api.avito.ru
```

Do not commit production values to Git.

## Run

On the VPS:

```bash
cd /var/www/html
npm run avito:audit
```

Default output:

```text
/tmp/avito-audit.json
```

Override with `AVITO_AUDIT_OUTPUT` to a private 0600 path outside the public web root.

Optional period overrides:

```env
AVITO_AUDIT_DATE_FROM=2026-08-22
AVITO_AUDIT_DATE_TO=2026-09-21
```

If these are empty, the script uses the previous 30 calendar days.

## Security

- `AVITO_CLIENT_SECRET` is never logged.
- Access tokens are held in process memory only.
- Audit files are written with mode 0600.
- No Avito paid services are invoked by this integration.
- No automatic advertisement removal is enabled.
