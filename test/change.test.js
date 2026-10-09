import test from 'node:test';
import assert from 'node:assert/strict';
import { detectAlertChange, severityRank } from '../src/core/change.js';

test('initial OK does not create an alert event',()=>{
  const x=detectAlertChange(null,'OK');
  assert.equal(x.changed,false);
  assert.equal(x.eventType,'INITIAL_OK');
});

test('initial warning creates alert event',()=>{
  const x=detectAlertChange(null,'WARNING');
  assert.equal(x.changed,true);
  assert.equal(x.eventType,'INITIAL_ALERT');
});

test('risk escalation is detected',()=>{
  const x=detectAlertChange('WATCH','CRITICAL');
  assert.equal(x.changed,true);
  assert.equal(x.eventType,'RISK_ESCALATED');
});

test('risk improvement is detected',()=>{
  const x=detectAlertChange('CRITICAL','WATCH');
  assert.equal(x.changed,true);
  assert.equal(x.eventType,'RISK_IMPROVED');
});

test('same state is unchanged',()=>{
  const x=detectAlertChange('VERIFY','VERIFY');
  assert.equal(x.changed,false);
  assert.equal(x.eventType,'UNCHANGED');
});

test('transition into VERIFY is verification required, not fake risk improvement',()=>{
  const x=detectAlertChange('WARNING','VERIFY');
  assert.equal(x.changed,true);
  assert.equal(x.eventType,'VERIFICATION_REQUIRED');
});

test('transition out of VERIFY is verification resolved',()=>{
  const x=detectAlertChange('VERIFY','WATCH');
  assert.equal(x.changed,true);
  assert.equal(x.eventType,'VERIFICATION_RESOLVED');
});

test('risk severity order is deterministic',()=>{
  assert.ok(severityRank('CRITICAL') > severityRank('WARNING'));
  assert.ok(severityRank('WARNING') > severityRank('WATCH'));
});
