import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBetaOnboarding } from '../src/core/onboarding.js';

test('beta onboarding normalizes an Aave Ethereum webhook tester', () => {
  const result=validateBetaOnboarding({
    walletAddress:'0x7a447c0a0ca7a786224bc2d27347b257e246eb1d',
    alertChannel:'webhook',
    alertTarget:'https://alerts.example.com/hook',
    label:'Tester #1'
  });

  assert.equal(result.ok,true);
  assert.equal(result.value.walletAddress,'0x7a447c0a0ca7a786224bc2d27347b257e246eb1d');
  assert.equal(result.value.protocol,'aave-v3');
  assert.equal(result.value.chain,'ethereum');
  assert.equal(result.value.asset,'ACCOUNT');
  assert.equal(result.value.alertChannel,'webhook');
  assert.equal(result.value.alertTarget,'https://alerts.example.com/hook');
  assert.equal(result.value.label,'Tester #1');
});

test('beta onboarding rejects malformed wallet', () => {
  assert.deepEqual(
    validateBetaOnboarding({
      walletAddress:'0x1234',
      alertChannel:'webhook',
      alertTarget:'https://alerts.example.com/hook'
    }),
    {ok:false,error:'invalid_wallet_address'}
  );
});

test('beta onboarding rejects unsafe webhook target', () => {
  assert.deepEqual(
    validateBetaOnboarding({
      walletAddress:'0x7a447c0a0ca7a786224bc2d27347b257e246eb1d',
      alertChannel:'webhook',
      alertTarget:'http://localhost/hook'
    }),
    {ok:false,error:'webhook_https_required'}
  );
});

test('beta onboarding validates email target without enabling provider configuration', () => {
  const result=validateBetaOnboarding({
    walletAddress:'0x7a447c0a0ca7a786224bc2d27347b257e246eb1d',
    alertChannel:'email',
    alertTarget:'tester@example.com'
  });
  assert.equal(result.ok,true);
  assert.equal(result.value.alertChannel,'email');
  assert.equal(result.value.alertTarget,'tester@example.com');
});
