import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('one-step onboarding preflights live Aave data and persists an active Guard bundle', async () => {
  const originalFetch=globalThis.fetch;
  const batches=[];

  globalThis.fetch=async () => new Response(JSON.stringify({
    snapshot:{
      wallet:'0x7a447c0a0ca7a786224bc2d27347b257e246eb1d',
      chainId:1,
      poolAddress:'0x0000000000000000000000000000000000000001',
      totalCollateralBase:100000,
      totalDebtBase:20000,
      currentLiquidationThreshold:0.8,
      healthFactor:3.2,
      observedAt:new Date().toISOString()
    },
    risk:{state:'SAFE'}
  }),{
    status:200,
    headers:{'content-type':'application/json'}
  });

  const db={
    prepare(sql){
      return {
        bind(...values){
          return {sql,values};
        }
      };
    },
    async batch(statements){
      batches.push(statements);
      return statements.map(()=>({success:true}));
    }
  };

  try{
    const request=new Request('https://guard.example/api/v1/onboarding',{
      method:'POST',
      headers:{
        'content-type':'application/json',
        'x-guard-owner-key':'0123456789abcdef0123456789abcdef'
      },
      body:JSON.stringify({
        walletAddress:'0x7a447c0a0ca7a786224bc2d27347b257e246eb1d',
        alertChannel:'webhook',
        alertTarget:'https://alerts.example.com/hook',
        label:'External Tester'
      })
    });

    const response=await worker.fetch(request,{
      DB:db,
      SNAPSHOT_PROVIDER_KIND:'defi-risk-monitor',
      SNAPSHOT_PROVIDER_URL:'https://risk.example.com'
    });
    const body=await response.json();

    assert.equal(response.status,201);
    assert.equal(body.status,'ACTIVE');
    assert.equal(body.position.protocol,'aave-v3');
    assert.equal(body.position.chain,'ethereum');
    assert.equal(body.position.asset,'ACCOUNT');
    assert.equal(body.destination.channel,'webhook');
    assert.equal(body.destination.target,undefined);
    assert.equal(body.destination.targetHint,'https://alerts.example.com/…');
    assert.equal(body.currentRisk.alertState,'OK');
    assert.equal(body.monitoring.firstScheduledCheck,'pending');
    assert.equal(batches.length,1);
    assert.equal(batches[0].length,3);
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test('onboarding refuses email while email delivery is not configured', async () => {
  const request=new Request('https://guard.example/api/v1/onboarding',{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-guard-owner-key':'0123456789abcdef0123456789abcdef'
    },
    body:JSON.stringify({
      walletAddress:'0x7a447c0a0ca7a786224bc2d27347b257e246eb1d',
      alertChannel:'email',
      alertTarget:'tester@example.com'
    })
  });

  const response=await worker.fetch(request,{
    DB:{},
    SNAPSHOT_PROVIDER_KIND:'defi-risk-monitor',
    SNAPSHOT_PROVIDER_URL:'https://risk.example.com'
  });
  const body=await response.json();

  assert.equal(response.status,503);
  assert.equal(body.error,'email_delivery_not_configured');
});
