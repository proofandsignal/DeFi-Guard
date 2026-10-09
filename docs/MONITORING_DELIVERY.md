# BUILD-003 — Scheduled Monitoring + Alert Delivery v0.3

BUILD-003 converts persisted watchlists into recurring read-only monitoring.

## Runtime flow

```text
Cloudflare Cron (every 5 minutes)
          ↓
Enabled Positions
          ↓
Snapshot Provider Contract
          ↓
Fresh normalized snapshot
          ↓
Guard Engine
          ↓
Previous vs New State
          ↓
No change → silence
Change → Alert Event
          ↓
Delivery Policy
          ↓
Email / HTTPS Webhook
          ↓
Delivery Audit Record
```

## Scheduler

The Worker defines a `scheduled()` handler and Wrangler cron:

`*/5 * * * *`

The five-minute cadence is the initial beta configuration, not a promise of real-time or sub-minute protection.

## Snapshot provider contract

DeFi Guard intentionally does not copy lending-protocol adapter code from other repositories.

Set:

- `SNAPSHOT_PROVIDER_URL`
- optional secret `SNAPSHOT_PROVIDER_TOKEN`

For each enabled position, DeFi Guard sends:

```json
{
  "positionId": "...",
  "externalPositionId": "...",
  "walletAddress": "0x...",
  "protocol": "Aave",
  "chain": "Ethereum",
  "asset": "USDC"
}
```

The provider must return a normalized read-only snapshot containing the fields required by the Guard Engine, such as:

- `healthFactor`
- `collateralValueUsd`
- `debtValueUsd`
- `ltvPct`
- `liquidationThresholdPct`
- `marketDecision`
- `securityState`
- `dataState`
- `updatedAt`

This contract allows DeFi Credit & Yield Lab or another adapter service to provide intelligence without sharing source code between repositories.

## Delivery policy

Delivery occurs only when the alert state changes.

Deliverable event types:

- `INITIAL_ALERT`
- `RISK_ESCALATED`
- `RISK_IMPROVED`
- `VERIFICATION_REQUIRED`
- `VERIFICATION_RESOLVED`

`UNCHANGED` and `INITIAL_OK` are silent.

Every attempt is recorded in D1.

## Email

Email delivery uses the Resend HTTP API.

Required secrets/config:

- `RESEND_API_KEY`
- `ALERT_EMAIL_FROM`

The API key must never be committed to GitHub. Use Cloudflare Worker secrets.

## Webhook

Webhook destinations must:

- use HTTPS;
- use a domain hostname, not an IP literal;
- not use localhost;
- not embed URL username/password credentials.

An optional global `WEBHOOK_BEARER_TOKEN` may be configured as a Worker secret.

Avoid embedding reusable secrets in webhook query strings because delivery targets are persisted in D1.

## D1 migration

Apply both migrations in order:

1. `0001_watchlists.sql`
2. `0002_monitoring_delivery.sql`

Migration #2 adds:

- destination records;
- monitor run audit records;
- delivery attempt audit records;
- `last_checked_at` and `last_error` on monitored positions.

## Destination API

Requires the existing `X-Guard-Owner-Key` tenant boundary.

- `POST /api/v1/watchlists/:watchlistId/destinations`
- `GET /api/v1/watchlists/:watchlistId/destinations`

Supported channels:

- `email`
- `webhook`

API responses mask the destination target.

The actual email address / webhook URL is stored in D1 because it is required for delivery. Treat the D1 database as confidential application data.

## Deployment gate

Do not claim paid-monitoring readiness until all are true:

- real D1 database bound as `DB`;
- both D1 migrations applied remotely;
- `SNAPSHOT_PROVIDER_URL` points to a real normalized provider;
- provider token, if required, is stored as a Worker secret;
- Resend key is stored as a Worker secret;
- sender domain/address is production-capable;
- test watchlist + position + destination created;
- scheduled run obtains a fresh real snapshot;
- state transition creates one alert event;
- exactly one notification is delivered;
- unchanged next run produces no duplicate alert.

## Safety boundary

This remains read-only monitoring. It does not sign transactions, rebalance, liquidate, repay, withdraw, or custody assets.
