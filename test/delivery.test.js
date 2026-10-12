import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverAlert } from '../src/delivery.js';

test('webhook delivery posts Guard event payload and captures request id', async () => {
  const originalFetch=globalThis.fetch;
  let captured=null;

  globalThis.fetch=async (url,init) => {
    captured={url,init};
    return new Response('',{
      status:204,
      headers:{'x-request-id':'req-live-smoke-1'}
    });
  };

  try{
    const result=await deliverAlert(
      {channel:'webhook',target:'https://alerts.example.com/hook'},
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
