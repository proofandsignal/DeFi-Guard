import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverAlert } from '../src/delivery.js';

test('webhook delivery posts Guard event payload and captures request id', async () => {
  const originalFetch=globalThis.fetch;
  let captured=null;

  globalThis.fetch=async (url,init) => {
    captured={url,init};
    return new Response(null,{
      status:204,
      headers:{'x-request-id':'req-live-smoke-1'}
    });
  };

  try{
    const result=await deliverAlert(
      {id:'pos-destination-1',channel:'webhook',target:'https://alerts.example.com/hook'},
      {
        event:{id:'evt-1',eventType:'RISK_IMPROVED'},
        change:{changed:true,eventType:'RISK_IMPROVED',previousState:'WARNING',currentState:'OK'},
        position:{id:'pos-1',protocol:'aave-v3',chain:'ethereum',asset:'ACCOUNT'},
        evaluation:{alertState:'OK',healthFactor:4.2,reasons:[]}
      },
      {}
    );

    assert.equal(result.ok,true);
    assert.equal(result.providerMessageId,'req-live-smoke-1');
    assert.equal(result.error,null);
    assert.equal(captured.url,'https://alerts.example.com/hook');
    assert.equal(captured.init.method,'POST');
    assert.equal(captured.init.headers['x-defi-guard-event-id'],'evt-1');
    assert.equal(captured.init.headers['x-defi-guard-delivery-attempt'],'1');
    assert.equal(
      captured.init.headers['x-defi-guard-delivery-key'],
      'evt-1-pos-destination-1'
    );

    const body=JSON.parse(captured.init.body);
    assert.equal(body.service,'DeFi Guard');
    assert.equal(body.version,'0.4.0');
    assert.equal(body.change.eventType,'RISK_IMPROVED');
    assert.equal(body.position.protocol,'aave-v3');
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test('webhook delivery records non-2xx as failure', async () => {
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async () => new Response('receiver rejected',{status:503});

  try{
    const result=await deliverAlert(
      {channel:'webhook',target:'https://alerts.example.com/hook'},
      {
        event:{id:'evt-2'},
        change:{changed:true,eventType:'RISK_ESCALATED'},
        position:{protocol:'aave-v3',chain:'ethereum',asset:'ACCOUNT'},
        evaluation:{alertState:'WARNING',reasons:[]}
      },
      {}
    );

    assert.equal(result.ok,false);
    assert.match(result.error,/webhook_http_503/);
  }finally{
    globalThis.fetch=originalFetch;
  }
});


test('webhook retry keeps delivery key stable and increments attempt metadata', async () => {
  const originalFetch=globalThis.fetch;
  const captured=[];

  globalThis.fetch=async (url,init) => {
    captured.push({url,init});
    return new Response(null,{status:204,headers:{'x-request-id':'retry-ok'}});
  };

  try{
    const destination={id:'destination-2',channel:'webhook',target:'https://alerts.example.com/hook'};
    const context={
      event:{id:'evt-retry',eventType:'RISK_ESCALATED'},
      change:{changed:true,eventType:'RISK_ESCALATED',previousState:'WATCH',currentState:'WARNING'},
      position:{id:'pos-2',protocol:'aave-v3',chain:'ethereum',asset:'ACCOUNT'},
      evaluation:{alertState:'WARNING',healthFactor:1.2,reasons:[]}
    };

    await deliverAlert(destination,context,{}, {attemptNumber:1});
    await deliverAlert(destination,context,{}, {attemptNumber:2});

    assert.equal(captured[0].init.headers['x-defi-guard-delivery-attempt'],'1');
    assert.equal(captured[1].init.headers['x-defi-guard-delivery-attempt'],'2');
    assert.equal(
      captured[0].init.headers['x-defi-guard-delivery-key'],
      captured[1].init.headers['x-defi-guard-delivery-key']
    );
  }finally{
    globalThis.fetch=originalFetch;
  }
});
