import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePosition } from '../src/core/guard.js';

const NOW = Date.parse('2026-10-09T06:00:00Z');

function base(overrides = {}) {
  return {
    positionId:'p-001',
    protocol:'Aave',
    chain:'Ethereum',
    asset:'USDC',
    healthFactor:2,
    collateralValueUsd:10_000,
    debtValueUsd:4_000,
    ltvPct:40,
    liquidationThresholdPct:80,
    marketDecision:'PASS',
    securityState:'PASS',
    dataState:'SUFFICIENT',
    updatedAt:'2026-10-09T05:59:30Z',
    ...overrides
  };
}

test('healthy verified position is OK',()=>{
  const out=evaluatePosition(base(),NOW);
  assert.equal(out.alertState,'OK');
  assert.equal(out.verificationRequired,false);
  assert.deepEqual(out.reasons,[]);
});

test('health factor at 1.4 is WATCH',()=>{
  const out=evaluatePosition(base({healthFactor:1.4}),NOW);
  assert.equal(out.alertState,'WATCH');
  assert.ok(out.reasons.some(x=>x.code==='HF_WATCH'));
});

test('health factor at 1.15 is WARNING',()=>{
  const out=evaluatePosition(base({healthFactor:1.15}),NOW);
  assert.equal(out.alertState,'WARNING');
  assert.ok(out.reasons.some(x=>x.code==='HF_WARNING'));
});

test('health factor at 1.02 is CRITICAL',()=>{
  const out=evaluatePosition(base({healthFactor:1.02}),NOW);
  assert.equal(out.alertState,'CRITICAL');
  assert.ok(out.reasons.some(x=>x.code==='HF_CRITICAL'));
});

test('upstream security BLOCK is CRITICAL',()=>{
  const out=evaluatePosition(base({securityState:'BLOCK'}),NOW);
  assert.equal(out.alertState,'CRITICAL');
  assert.ok(out.reasons.some(x=>x.code==='SECURITY_BLOCK'));
});

test('missing health factor with debt is VERIFY',()=>{
  const out=evaluatePosition(base({healthFactor:null}),NOW);
  assert.equal(out.alertState,'VERIFY');
  assert.equal(out.verificationRequired,true);
  assert.ok(out.reasons.some(x=>x.code==='HEALTH_FACTOR_MISSING'));
});

test('partial upstream data is VERIFY',()=>{
  const out=evaluatePosition(base({dataState:'PARTIAL'}),NOW);
  assert.equal(out.alertState,'VERIFY');
  assert.equal(out.verificationRequired,true);
});

test('market REVIEW produces WATCH when position is otherwise healthy',()=>{
  const out=evaluatePosition(base({marketDecision:'REVIEW'}),NOW);
  assert.equal(out.alertState,'WATCH');
});

test('explicit critical risk outranks verification requirement',()=>{
  const out=evaluatePosition(base({healthFactor:1.01,dataState:'PARTIAL'}),NOW);
  assert.equal(out.alertState,'CRITICAL');
  assert.equal(out.verificationRequired,true);
});

test('stale snapshot requires VERIFY',()=>{
  const out=evaluatePosition(base({updatedAt:'2026-10-09T05:30:00Z'}),NOW);
  assert.equal(out.alertState,'VERIFY');
  assert.ok(out.reasons.some(x=>x.code==='SNAPSHOT_STALE_OR_UNKNOWN'));
});

test('tight liquidation buffer produces WARNING',()=>{
  const out=evaluatePosition(base({ltvPct:76,liquidationThresholdPct:80}),NOW);
  assert.equal(out.alertState,'WARNING');
  assert.ok(out.reasons.some(x=>x.code==='LIQUIDATION_BUFFER_WARNING'));
});
