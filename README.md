# DeFi Guard — v0.2

Read-only DeFi position monitoring, watchlists and explainable risk-change events.

## Product thesis

DeFi Guard is the recurring monitoring layer in the Proof & Signal / DeFi Credit & Yield stack.

It answers:

> **What changed in this DeFi position, and does the user need to pay attention now?**

It does not custody assets or execute transactions.

## Current architecture

```text
Watchlist
   ↓
Monitored Position
   ↓
New Snapshot
   ↓
Guard Engine
   ↓
OK / WATCH / WARNING / CRITICAL / VERIFY
   ↓
Compare with Previous Snapshot
   ↓
Risk Escalated / Improved / Initial Alert
   ↓
Persistent Alert Event
```

## BUILD-001 — Guard Core v0.1

Implemented:
- deterministic Guard Engine;
- Health Factor thresholds;
- liquidation-buffer thresholds;
- upstream market/security state;
- stale/incomplete evidence → VERIFY;
- explainable reason codes;
- read-only `POST /api/v1/evaluate`;
- tests + CI.

## BUILD-002 — Watchlists + Persistence v0.2

Implemented in this build:
- Cloudflare D1 schema;
- watchlists;
- monitored positions;
- immutable snapshots;
- alert event history;
- deterministic change detection;
- temporary owner-key tenant boundary;
- D1 deployment gate.

### Persistence API

Requires `X-Guard-Owner-Key`.

- `POST /api/v1/watchlists`
- `GET /api/v1/watchlists`
- `POST /api/v1/watchlists/:watchlistId/positions`
- `GET /api/v1/watchlists/:watchlistId/positions`
- `POST /api/v1/positions/:positionId/snapshots`
- `GET /api/v1/positions/:positionId/events`

The standalone evaluator remains:

- `POST /api/v1/evaluate`

Operational endpoints:
- `GET /api/health`
- `GET /api/v1/meta`

See:
- `docs/ALERT_MODEL.md`
- `docs/PERSISTENCE.md`
- `docs/D1_DEPLOYMENT.md`

## Safety boundary

DeFi Guard does **not**:
- custody assets;
- request or store private keys;
- sign or execute transactions;
- move user funds;
- automatically rebalance positions;
- provide discretionary portfolio management.

## BUILD-002 Definition of Done

- [x] Separate BUILD-002 branch.
- [x] D1 schema.
- [x] Watchlist persistence.
- [x] Position persistence.
- [x] Snapshot persistence.
- [x] Alert event persistence.
- [x] State-change detector.
- [x] Persistence API.
- [x] Unit tests for change detection.
- [x] Deployment gate documentation.
- [ ] CI PASS on PR.
- [ ] Real D1 database created and bound.
- [ ] Migration applied.
- [ ] First persisted real position.
- [ ] First persisted alert-state transition.
- [ ] Worker deployment PASS.

## Next — BUILD-003

`Scheduled Monitoring + Alert Delivery`

```text
Enabled positions
      ↓
Scheduled Worker
      ↓
Fresh protocol / intelligence data
      ↓
New snapshot
      ↓
Guard Engine + Change Detection
      ↓
Delivery Policy
      ↓
Email / Telegram / webhook
```

BUILD-003 is the first build that turns DeFi Guard into a real recurring-monitoring service suitable for paid beta testing.

## Commercial direction

Initial validation hypothesis:

- Free: limited manual evaluation.
- Founding Guard: **€19/month**.
- Pro Guard: **€29–39/month** after validation.
- B2B monitoring/API: later, after retail monitoring is proven.

Pricing is a hypothesis until real customers pay.

## License

Proprietary / All Rights Reserved. See `LICENSE`.
