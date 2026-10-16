# DeFi Guard — v0.4

Read-only DeFi position monitoring with persistent watchlists, scheduled checks, change detection and explainable alert delivery.

## Product thesis

> **Follow my DeFi position and warn me when the risk actually changes.**

DeFi Guard does not custody assets or execute transactions.

## Current architecture

```text
Watchlist
   ↓
Monitored Position
   ↓
Cloudflare Cron (5 min beta cadence)
   ↓
Normalized Snapshot Provider
   ↓
Guard Engine
   ↓
OK / WATCH / WARNING / CRITICAL / VERIFY
   ↓
Compare with Previous Snapshot
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

## BUILD-001 — Guard Core v0.1

Implemented:
- deterministic Guard Engine;
- Health Factor thresholds;
- liquidation-buffer thresholds;
- upstream market/security state;
- stale/incomplete evidence → VERIFY;
- explainable reason codes;
- read-only evaluator;
- tests + CI.

## BUILD-002 — Watchlists + Persistence v0.2

Implemented:
- Cloudflare D1 schema;
- watchlists and monitored positions;
- immutable snapshots;
- alert event history;
- hashed owner-key tenant boundary;
- deterministic change detection;
- persistence API.

## BUILD-003 — Scheduled Monitoring + Alert Delivery v0.3

Implemented in code:
- Cloudflare scheduled handler;
- five-minute beta cron;
- enabled-position monitoring loop;
- external normalized snapshot-provider contract;
- alert delivery policy;
- Resend email adapter;
- generic HTTPS webhook adapter;
- webhook target validation + redirect blocking;
- delivery destinations API;
- monitor run audit records;
- delivery attempt audit records;
- no-change → no notification behavior;
- tests for delivery policy and destination validation.

### Delivery destination API

Requires `X-Guard-Owner-Key`.

- `POST /api/v1/watchlists/:watchlistId/destinations`
- `GET /api/v1/watchlists/:watchlistId/destinations`

Supported channels:
- `email`
- `webhook`

### Operational endpoints

- `GET /api/health`
- `GET /api/v1/meta`
- `POST /api/v1/evaluate`

See:
- `docs/ALERT_MODEL.md`
- `docs/PERSISTENCE.md`
- `docs/D1_DEPLOYMENT.md`
- `docs/MONITORING_DELIVERY.md`

## BUILD-004 — Live Risk Monitor Adapter + End-to-End Beta Gate

Implemented in code:
- native adapter for `DeFi-Risk-Monitor` account snapshots;
- Aave v3 / Ethereum scope validation;
- current position LTV derived from debt/collateral rather than confusing it with Aave max-LTV;
- fail-closed upstream payload validation;
- provider mode diagnostics;
- backward-compatible generic POST provider;
- adapter and transition integration tests.

See `docs/LIVE_RISK_MONITOR_ADAPTER.md`.


## BUILD-010 — Delivery Retry + Idempotency

Implemented in code:
- failed notification attempts are selected for retry on later cron runs;
- retry is bounded by `DELIVERY_RETRY_MAX_ATTEMPTS` (default 3, hard cap 10);
- retry processing is isolated from position monitoring, so notification outages do not stop fresh risk snapshots;
- a successful event/destination pair is excluded from future retries;
- webhook retries carry a stable `x-defi-guard-delivery-key` and incrementing `x-defi-guard-delivery-attempt`;
- Resend requests use the same stable value as `Idempotency-Key`;
- validation sink supports deterministic fail-first testing without storing state.

This gives delivery **at-least-once retry behavior with provider-side idempotency support** where the provider honors the supplied key. External delivery still requires real provider validation.

## BUILD-003 Definition of Done

### Code
- [x] Separate BUILD-003 branch.
- [x] Scheduled Worker handler.
- [x] Cron configuration.
- [x] Enabled position batch monitoring.
- [x] Snapshot provider contract.
- [x] Change-only delivery policy.
- [x] Email adapter.
- [x] HTTPS webhook adapter.
- [x] Webhook SSRF-oriented validation.
- [x] Monitor run persistence.
- [x] Delivery audit persistence.
- [x] Destination API.
- [x] Unit tests for delivery policy.
- [x] GitHub Actions PASS.

### Deployment / Revenue Gate
- [x] Real D1 database bound as `DB`.
- [x] D1 migrations 0001 + 0002 applied.
- [x] Real snapshot provider connected.
- [ ] Resend sender configured.
- [x] First real position monitored by cron.
- [x] First controlled Guard-only risk transition returned to real live state.
- [x] First real webhook delivered and audited.
- [x] Next unchanged run produced no duplicate notification.
- [ ] First external beta tester.
- [ ] First **€19 Founding Guard** payment.

## Environment

Never commit secrets.

Runtime configuration may include:

- `SNAPSHOT_PROVIDER_KIND` — `generic-post` (default) or `defi-risk-monitor`\n- `SNAPSHOT_PROVIDER_URL`
- `SNAPSHOT_PROVIDER_TOKEN` — secret if used
- `RESEND_API_KEY` — secret
- `ALERT_EMAIL_FROM`
- `WEBHOOK_BEARER_TOKEN` — optional secret
- `MONITOR_BATCH_SIZE`
- `DELIVERY_RETRY_MAX_ATTEMPTS` — default 3, hard cap 10
- `DELIVERY_RETRY_BATCH_SIZE` — default 50

See `.dev.vars.example`.

## Safety boundary

DeFi Guard does **not**:
- custody assets;
- request or store private keys;
- sign or execute transactions;
- move user funds;
- automatically rebalance positions;
- claim five-minute monitoring prevents liquidation;
- provide discretionary portfolio management.

## Commercial validation

Initial hypothesis:

- Manual/free evaluation: acquisition.
- **Founding Guard: €19/month.**
- Pro Guard: **€29–39/month** only after paid validation.
- B2B monitoring/API: later.

Pricing remains a hypothesis until real customers pay.

## License

Proprietary / All Rights Reserved. See `LICENSE`.
