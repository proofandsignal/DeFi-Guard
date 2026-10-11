# BUILD-004 — Live Risk Monitor Adapter + End-to-End Beta Gate

## Goal

Connect **DeFi Guard** to the already-existing **DeFi Risk Monitor** without copying its Aave RPC implementation into this repository.

Repository responsibilities stay separate:

```text
DeFi Risk Monitor
  public wallet -> Aave getUserAccountData -> normalized live account snapshot
                              |
                              v
DeFi Guard
  watchlist -> cron -> adapter -> Guard Engine -> change detection -> notification
```

## Provider mode

Configure:

```
SNAPSHOT_PROVIDER_KIND=defi-risk-monitor
SNAPSHOT_PROVIDER_URL=https://<deployed-risk-monitor-host>
```

Optional:

```
SNAPSHOT_PROVIDER_TOKEN=<bearer-token>
```

For each enabled Aave/Ethereum position, Guard requests:

```
GET <SNAPSHOT_PROVIDER_URL>/api/v1/aave/account/<wallet>
```

## Risk-math mapping

The Risk Monitor returns Aave's account-level aggregate values.

Guard maps them as follows:

- `collateralValueUsd = totalCollateralBase`
- `debtValueUsd = totalDebtBase`
- `healthFactor = healthFactor`
- `liquidationThresholdPct = currentLiquidationThreshold * 100`
- `ltvPct = totalDebtBase / totalCollateralBase * 100`

The final line is deliberate.

Aave's returned `ltv` field is the account's weighted maximum loan-to-value parameter. It is **not** the current debt/collateral ratio. Guard therefore does not use that parameter as the current LTV when calculating its liquidation-buffer heuristic.

## Supported live scope

BUILD-004 adapter scope is intentionally narrow:

- protocol: Aave v3
- chain: Ethereum mainnet
- read-only public wallet
- account-level position snapshot

No private key, transaction signing, custody or auto-repayment.

## Data-quality behavior

The adapter fails closed when:

- wallet address is missing/invalid;
- protocol or chain is outside the BUILD-004 scope;
- upstream payload is malformed;
- debt exists but Health Factor is absent;
- upstream timestamp is invalid.

A successful adapter payload is marked `SUFFICIENT`; Guard's existing freshness gate still decides whether the snapshot is stale.

## Revenue / deployment gate

Code PASS is not product PASS.

The beta is only ready after:

1. DeFi Risk Monitor is reachable from the Worker.
2. Cloudflare D1 is bound and migrations are applied.
3. One real Aave/Ethereum wallet is added as an `ACCOUNT` position.
4. Scheduled Worker writes a fresh snapshot.
5. A controlled test produces a real Guard state transition.
6. Email or webhook delivery succeeds.
7. The next unchanged run stays silent.
8. One external tester completes setup.
9. First **€19 Founding Guard** payment is recorded.
