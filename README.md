# DeFi Guard — v0.3

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
- [ ] GitHub Actions PASS.

### Deployment / Revenue Gate
- [ ] Real D1 database bound as `DB`.
- [ ] D1 migrations 0001 + 0002 applied.
- [ ] Real snapshot provider connected.
- [ ] Resend sender configured.
- [ ] First real position monitored by cron.
- [ ] First real risk transition detected.
- [ ] First real email/webhook delivered.
- [ ] Next unchanged run produces no duplicate notification.
- [ ] First external beta tester.
- [ ] First **€19 Founding Guard** payment.

## Environment

Never commit secrets.

Runtime configuration may include:

- `SNAPSHOT_PROVIDER_URL`
- `SNAPSHOT_PROVIDER_TOKEN` — secret if used
- `RESEND_API_KEY` — secret
- `ALERT_EMAIL_FROM`
- `WEBHOOK_BEARER_TOKEN` — optional secret
- `MONITOR_BATCH_SIZE`

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
