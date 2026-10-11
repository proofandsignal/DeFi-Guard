import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchPositionSnapshot } from '../src/provider.js';
import { evaluatePosition } from '../src/core/guard.js';
import { detectAlertChange } from '../src/core/change.js';

const position={
  id:'pos-live-adapter',
  walletAddress:'0x2222222222222222222222222222222222222222',
  protocol:'aave-v3',
  chain:'ethereum',
  asset:'ACCOUNT'
};

function payload(healthFactor,debt=7000){
  return {
    snapshot:{
      wallet:position.walletAddress,
      chainId:1,
      poolAddress:'0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      totalCollateralBase:10000,
      totalDebtBase:debt,
      availableBorrowsBase:0,
      currentLiquidationThreshold:0.8,
      ltv:0.75,
      healthFactor,
      observedAt:'2026-10-11T10:00:00.000Z'
    },
    risk:{state:healthFactor<=1.2?'DANGER':'SAFE'},
    alerts:[]
  };
}

test('risk monitor adapter feeds deterministic Guard transition detection',async()=>{
  const originalFetch=globalThis.fetch;
  const queue=[payload(1.6,5000),payload(1.10,7600)];
  globalThis.fetch=async()=>new Response(JSON.stringify(queue.shift()),{
    status:200,
    headers:{'content-type':'application/json'}
  });

  try{
    const env={
      SNAPSHOT_PROVIDER_KIND:'defi-risk-monitor',
      SNAPSHOT_PROVIDER_URL:'https://risk.example'
    };

    const first=evaluatePosition(
      await fetchPositionSnapshot(position,env),
      Date.parse('2026-10-11T10:05:00.000Z')
    );
    const second=evaluatePosition(
      await fetchPositionSnapshot(position,env),
      Date.parse('2026-10-11T10:05:00.000Z')
    );

    assert.equal(first.alertState,'OK');
    assert.equal(second.alertState,'WARNING');

    const change=detectAlertChange(first.alertState,second.alertState);
    assert.equal(change.changed,true);
    assert.equal(change.eventType,'DETERIORATED');
  }finally{
    globalThis.fetch=originalFetch;
  }
});
