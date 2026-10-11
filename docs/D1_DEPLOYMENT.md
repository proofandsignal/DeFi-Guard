# D1 Deployment Gate

Do not mark DeFi Guard deployed until a real Cloudflare D1 database is bound and both schema migrations have been applied.

## Beta target

Use a separate beta database, for example:

`defi-guard-beta`

The Worker binding name must remain:

`DB`

## Required operator steps

1. Create the D1 database in Cloudflare.
2. Copy its real `database_id`.
3. Add this binding to `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "defi-guard-beta"
database_id = "<REAL_D1_DATABASE_ID>"
```

4. Apply both migrations remotely:

```bash
npx wrangler d1 execute defi-guard-beta --remote --file migrations/0001_watchlists.sql
npx wrangler d1 execute defi-guard-beta --remote --file migrations/0002_monitoring_delivery.sql
```

5. Deploy the Worker:

```bash
npx wrangler deploy
```

6. Confirm `GET /api/health` reports:
   - `persistence: true`
   - `snapshotProvider: true`
   - `snapshotProviderKind: "defi-risk-monitor"`

7. Create a test watchlist and one real Aave/Ethereum `ACCOUNT` position.
8. Wait for / trigger a scheduled monitoring run.
9. Confirm a fresh snapshot is persisted.
10. Confirm a controlled risk-state transition creates one alert event.
11. Confirm an unchanged subsequent run creates no duplicate notification.

## Live snapshot provider

The public, non-secret beta provider configuration is committed in `wrangler.toml`:

```toml
SNAPSHOT_PROVIDER_KIND = "defi-risk-monitor"
SNAPSHOT_PROVIDER_URL = "https://defi-risk-monitor-api.onrender.com"
```

The Risk Monitor owns the Alchemy RPC secret. DeFi Guard does not need the Alchemy key.

## Secrets

Never commit Cloudflare account secrets, API tokens, Resend API keys or webhook bearer tokens.

Potential runtime secrets:

- `RESEND_API_KEY`
- `WEBHOOK_BEARER_TOKEN`

`ALERT_EMAIL_FROM` can be a normal environment variable when the sender address is not sensitive.
