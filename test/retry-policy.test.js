import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMaxDeliveryAttempts,
  retryDecision,
  deliveryKey
} from '../src/core/retry-policy.js';

test('retry policy retries failed delivery until max attempts', () => {
  assert.deepEqual(retryDecision(1,3),{
    failedAttempts:1,
    maxAttempts:3,
    nextAttempt:2,
    retry:true
  });
  assert.equal(retryDecision(2,3).retry,true);
  assert.equal(retryDecision(3,3).retry,false);
});

test('retry policy clamps invalid and excessive max attempts', () => {
  assert.equal(normalizeMaxDeliveryAttempts(undefined),3);
  assert.equal(normalizeMaxDeliveryAttempts(0),3);
  assert.equal(normalizeMaxDeliveryAttempts(50),10);
});

test('delivery key is deterministic per event and destination', () => {
  assert.equal(
    deliveryKey('event-1','destination-1'),
    'event-1-destination-1'
  );
  assert.equal(
    deliveryKey('event-1','destination-1'),
    deliveryKey('event-1','destination-1')
  );
  assert.equal(deliveryKey('','destination-1'),null);
});
