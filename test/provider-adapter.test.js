import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchPositionSnapshot,
  normalizeRiskMonitorPayload,
  snapshotProviderKind
} from '../src/provider.js';
import { evaluatePosition } from '../src/core/guard.js';

const position={
  id:'pos-1',
  externalPositionId:null,
  walletAddress:'0x1111111111111111111111111111111111111111',
  protocol:'aave-v3',
  chain:'ethereum',
  asset:'ACCOUNT'
};

function riskMonitorPayload(overrides={}){
  return {
    snapshot:{
      wallet:position.walletAddress,
      chainId:1,
      poolAddress:'0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      totalCollateralBase:10000,
      totalDebtBase:5000,
      availableBorrowsBase:1000,
      currentLiquidationThreshold:0.8,
      ltv:0.75,
      healthFactor:1.6,
      observedAt:'2026-10-11T10:00:00.000Z',
      ...overrides
    },
    risk:{
      state:'SAFE',
      uniformCollateralDropToLiquidationPct:37.5
    },
    alerts:[]
  };
}

test('risk monitor adapter maps current position LTV instead of Aave max LTV',()=>{
  const snapshot=normalizeRiskMonitorPayload(riskMonitorPayload(),position);

  assert.equal(snapshot.collateralValueUsd,10000);
  assert.equal(snapshot.debtValueUsd,5000);
  assert.equal(snapshot.ltvPct,50);
  assert.equal(snapshot.liquidationThresholdPct,80);
  assert.equal(snapshot.dataState,'SUFFICIENT');
  assert.equal(snapshot.source.upstreamRiskState,'SAFE');
});

test('mapped risk monitor snapshot is accepted by Guard without false liquidation-buffer warning',()=>{
  const now=Date.parse('2026-10-11T10:05:00.000Z');
  const snapshot=normalizeRiskMonitorPayload(riskMonitorPayload(),position);
  const evaluation=evaluatePosition(snapshot,now);

  assert.equal(evaluation.alertState,'OK');
  assert.equal(evaluation.healthFactor,1.6);
  assert.equal(evaluation.ltvPct,50);
  assert.equal(evaluation.liquidationThresholdPct,80);
});

test('near-liquidation account produces critical Guard state',()=>{
  const now=Date.parse('2026-10-11T10:05:00.000Z');
  const snapshot=normalizeRiskMonitorPayload(
    riskMonitorPayload({
      totalCollateralBase:10000,
      totalDebtBase:8000,
      currentLiquidationThreshold:0.82,
      healthFactor:1.04
    }),
    position
  );
  const evaluation=evaluatePosition(snapshot,now);

  assert.equal(evaluation.alertState,'CRITICAL');
  assert.ok(evaluation.reasons.some(x=>x.code==='HF_CRITICAL'));
  assert.ok(evaluation.reasons.some(x=>x.code==='LIQUIDATION_BUFFER_CRITICAL'));
});

test('risk monitor mode performs GET against wallet endpoint',async()=>{
  const originalFetch=globalThis.fetch;
  let request=null;
  globalThis.fetch=async(url,init)=>{
    request={url:String(url),init};
    return new Response(JSON.stringify(riskMonitorPayload()),{
      status:200,
      headers:{'content-type':'application/json'}
    });
  };

  try{
    const result=await fetchPositionSnapshot(position,{
      SNAPSHOT_PROVIDER_KIND:'defi-risk-monitor',
      SNAPSHOT_PROVIDER_URL:'https://risk.example'
    });

    assert.equal(snapshotProviderKind({SNAPSHOT_PROVIDER_KIND:'defi-risk-monitor'}),'defi-risk-monitor');
    assert.equal(request.init.method,'GET');
    assert.equal(
      request.url,
      `https://risk.example/api/v1/aave/account/${position.walletAddress}`
    );
    assert.equal(result.healthFactor,1.6);
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test('generic POST provider remains backward compatible',async()=>{
  const originalFetch=globalThis.fetch;
  let request=null;
  globalThis.fetch=async(url,init)=>{
    request={url:String(url),init};
    return new Response(JSON.stringify({
      healthFactor:1.4,
      collateralValueUsd:10000,
      debtValueUsd:5000,
      ltvPct:50,
      liquidationThresholdPct:80,
      dataState:'SUFFICIENT',
      updatedAt:'2026-10-11T10:00:00.000Z'
    }),{status:200,headers:{'content-type':'application/json'}});
  };

  try{
    const result=await fetchPositionSnapshot(position,{
      SNAPSHOT_PROVIDER_URL:'https://generic.example/snapshot'
    });

    assert.equal(request.init.method,'POST');
    assert.equal(result.positionId,'pos-1');
    assert.equal(result.protocol,'aave-v3');
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test('risk monitor adapter rejects unsupported chain and missing wallet',async()=>{
  await assert.rejects(
    ()=>fetchPositionSnapshot({...position,chain:'arbitrum'},{
      SNAPSHOT_PROVIDER_KIND:'defi-risk-monitor',
      SNAPSHOT_PROVIDER_URL:'https://risk.example'
    }),
    /risk_monitor_chain_unsupported/
  );

  await assert.rejects(
    ()=>fetchPositionSnapshot({...position,walletAddress:null},{
      SNAPSHOT_PROVIDER_KIND:'defi-risk-monitor',
      SNAPSHOT_PROVIDER_URL:'https://risk.example'
    }),
    /risk_monitor_wallet_address_required/
  );
});

test('risk monitor adapter rejects incomplete upstream data',()=>{
  assert.throws(
    ()=>normalizeRiskMonitorPayload(riskMonitorPayload({
      totalDebtBase:5000,
      healthFactor:null
    }),position),
    /risk_monitor_health_factor_missing_with_debt/
  );
});
