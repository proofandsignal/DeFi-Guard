import { validateDeliveryTarget } from './delivery-policy.js';

export function validateBetaOnboarding(input) {
  const body=input && typeof input==='object' && !Array.isArray(input) ? input : {};
  const walletAddress=String(body.walletAddress || '').trim();
  if(!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)){
    return {ok:false,error:'invalid_wallet_address'};
  }

  const alertChannel=String(body.alertChannel || body.channel || '').trim().toLowerCase();
  const target=body.alertTarget ?? body.target;
  const destination=validateDeliveryTarget(alertChannel,target);
  if(!destination.ok){
    return {ok:false,error:destination.error};
  }

  const label=String(body.label || 'Founding Guard').trim().slice(0,120) || 'Founding Guard';

  return {
    ok:true,
    value:{
      label,
      walletAddress:walletAddress.toLowerCase(),
      protocol:'aave-v3',
      chain:'ethereum',
      asset:'ACCOUNT',
      alertChannel,
      alertTarget:destination.value
    }
  };
}
