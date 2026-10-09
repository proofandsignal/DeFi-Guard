# DeFi Guard — v0.1

Read-only DeFi position monitoring and explainable risk alerts.

## Product thesis

DeFi Guard is the recurring-monitoring product in the Proof & Signal / DeFi Credit & Yield stack.

It answers:

> **What changed in this DeFi position, and does the user need to pay attention now?**

It does not custody assets or execute transactions.

## BUILD-001 — Guard Core

```text
Normalized Position Snapshot
          ↓
Data freshness / evidence checks
          ↓
Health Factor + liquidation buffer
          ↓
Upstream market/security state
          ↓
Deterministic Guard Engine
          ↓
OK / WATCH / WARNING / CRITICAL / VERIFY
          ↓
Explainable Alert Event
```

## v0.1 API

- `GET /api/health`
- `GET /api/v1/meta`
- `POST /api/v1/evaluate`

Example evaluation payload:

```json
{
  "positionId": "p-001",
  "protocol": "Aave",
  "chain": "Ethereum",
  "asset": "USDC",
  "healthFactor": 1.18,
  "collateralValueUsd": 10000,
  "debtValueUsd": 5000,
  "ltvPct": 50,
  "liquidationThresholdPct": 80,
  "marketDecision": "PASS",
  "securityState": "PASS",
  "dataState": "SUFFICIENT",
  "updatedAt": "2026-10-09T06:00:00Z"
}
```

The response contains an alert state, verification flag and explicit reason codes.

## Alert states

- **OK** — no v0.1 rule is triggered.
- **WATCH** — monitor a non-urgent risk change.
- **WARNING** — material risk condition.
- **CRITICAL** — explicit high-risk condition.
- **VERIFY** — critical evidence is missing/stale/incomplete.

See `docs/ALERT_MODEL.md`.

## Safety boundary

DeFi Guard does **not**:
- custody assets;
- request or store private keys;
- sign or execute transactions;
- move user funds;
- automatically rebalance positions;
- provide discretionary portfolio management.

## v0.1 Definition of Done

- [x] Separate repository and branch.
- [x] Deterministic Guard Rule Engine.
- [x] Health Factor thresholds.
- [x] Liquidation-buffer thresholds.
- [x] Upstream market/security state handling.
- [x] Stale/incomplete data → VERIFY.
- [x] Explainable reason codes.
- [x] Read-only evaluation API.
- [x] Unit tests.
- [x] GitHub Actions workflow.
- [ ] CI PASS on PR.
- [ ] First deployed Worker.
- [ ] First real position snapshot evaluated.
- [ ] First external tester.
- [ ] First paid Guard user.

## Next builds

`v0.1 Guard Core → v0.2 Watchlists + Persistence → v0.3 Scheduled Monitoring + Alert Delivery → Paid Beta`

The future monitoring layer may consume normalized intelligence from DeFi Credit & Yield Lab through a stable API contract. The repositories remain isolated and do not share source code.

## License

Proprietary / All Rights Reserved. See `LICENSE`.
