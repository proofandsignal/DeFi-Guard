import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldDeliver, alertSubject, alertText } from '../src/core/delivery-policy.js';

test('unchanged state is silent',()=>{
  assert.equal(shouldDeliver({changed:false,eventType:'UNCHANGED'}),false);
});

test('risk escalation is deliverable',()=>{
  assert.equal(shouldDeliver({changed:true,eventType:'RISK_ESCALATED'}),true);
});

test('verification changes are deliverable',()=>{
  assert.equal(shouldDeliver({changed:true,eventType:'VERIFICATION_REQUIRED'}),true);
  assert.equal(shouldDeliver({changed:true,eventType:'VERIFICATION_RESOLVED'}),true);
});

test('invalid event is silent',()=>{
  assert.equal(shouldDeliver({changed:true,eventType:'INVALID_STATE'}),false);
});

test('subject and text are explainable',()=>{
  const context={
    change:{eventType:'RISK_ESCALATED',previousState:'WATCH',currentState:'WARNING'},
    position:{protocol:'Aave',chain:'Ethereum',asset:'USDC'},
    evaluation:{
      alertState:'WARNING',
      healthFactor:1.15,
      reasons:[{code:'HF_WARNING',message:'Health Factor is 1.150.'}]
    }
  };
  assert.match(alertSubject(context),/WARNING/);
  assert.match(alertText(context),/HF_WARNING/);
  assert.match(alertText(context),/No transaction was executed/);
});
