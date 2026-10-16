import { evaluatePosition } from './core/guard.js';
import { detectAlertChange } from './core/change.js';
import { shouldDeliver } from './core/delivery-policy.js';
import { normalizeMaxDeliveryAttempts, retryDecision } from './core/retry-policy.js';
import { fetchPositionSnapshot } from './provider.js';
import { deliverAlert } from './delivery.js';
import {
  listEnabledPositions,
  latestSnapshot,
  saveSnapshot,
  saveAlertEvent,
  listDeliveryDestinations,
  createMonitorRun,
  completeMonitorRun,
  saveDeliveryAttempt,
  updatePositionCheck,
  listRetryableDeliveries
} from './store.js';

export async function runScheduledMonitoring(env, scheduledAt = new Date().toISOString()) {
  if (!env?.DB) {
    return {
      status:'SKIPPED',
      reason:'d1_not_configured',
      scheduledAt
    };
  }

  const startedAt=new Date().toISOString();
  const positions=await listEnabledPositions(env.DB, Number(env.MONITOR_BATCH_SIZE || 100));
  const runId=crypto.randomUUID();

  await createMonitorRun(env.DB,{
    id:runId,
    scheduledAt,
    startedAt,
    positionsTotal:positions.length
  });

  const stats={
    id:runId,
    scheduledAt,
    startedAt,
    completedAt:null,
    status:'SUCCESS',
    positionsTotal:positions.length,
    positionsChecked:0,
    eventsCreated:0,
    deliveriesAttempted:0,
    deliveriesSucceeded:0,
    errorCount:0,
    errors:[]
  };

  const retryResult=await retryPendingDeliveries(env);
  stats.deliveriesAttempted+=retryResult.deliveriesAttempted;
  stats.deliveriesSucceeded+=retryResult.deliveriesSucceeded;
  if(retryResult.errors.length){
    stats.errorCount+=retryResult.errors.length;
    stats.status='PARTIAL';
    stats.errors.push(...retryResult.errors);
  }

  for(const position of positions){
    try{
      const result=await monitorPosition(env,position);
      stats.positionsChecked++;
      if(result.event) stats.eventsCreated++;
      stats.deliveriesAttempted+=result.deliveriesAttempted;
      stats.deliveriesSucceeded+=result.deliveriesSucceeded;
    }catch(error){
      stats.errorCount++;
      stats.status='PARTIAL';
      stats.errors.push({
        positionId:position.id,
        error:String(error?.message || error).slice(0,500)
      });
      await updatePositionCheck(env.DB,position.id,{
        checkedAt:new Date().toISOString(),
        error:String(error?.message || error).slice(0,500)
      }).catch(()=>{});
    }
  }

  stats.completedAt=new Date().toISOString();
  if(stats.errorCount===positions.length && positions.length>0) stats.status='FAILED';
  await completeMonitorRun(env.DB,stats);
  return stats;
}

export async function monitorPosition(env, position) {
  if(!env?.DB) throw new Error('d1_not_configured');

  const payload=await fetchPositionSnapshot(position,env);
  const evaluation=evaluatePosition(payload);
  const previous=await latestSnapshot(env.DB,position.id);
  const change=detectAlertChange(previous?.alertState || null,evaluation.alertState);
  const now=new Date().toISOString();
  const snapshotId=crypto.randomUUID();

  const snapshot=await saveSnapshot(env.DB,{
    id:snapshotId,
    positionId:position.id,
    observedAt:payload.updatedAt || now,
    payload,
    evaluation,
    createdAt:now
  });

  let event=null;
  let deliveriesAttempted=0;
  let deliveriesSucceeded=0;

  if(change.changed){
    event=await saveAlertEvent(env.DB,{
      id:crypto.randomUUID(),
      positionId:position.id,
      snapshotId,
      previousState:change.previousState,
      currentState:change.currentState,
      eventType:change.eventType,
      severityRank:change.severityRank,
      reasons:evaluation.reasons,
      createdAt:now
    });

    if(shouldDeliver(change)){
      const destinations=await listDeliveryDestinations(env.DB,position.watchlistId);

      for(const destination of destinations){
        deliveriesAttempted++;
        const result=await deliverAlert(destination,{
          event,
          change,
          position,
          evaluation,
          snapshot
        },env);

        if(result.ok) deliveriesSucceeded++;

        await saveDeliveryAttempt(env.DB,{
          id:crypto.randomUUID(),
          eventId:event.id,
          destinationId:destination.id,
          channel:destination.channel,
          target:destination.target,
          status:result.ok ? 'SENT' : 'FAILED',
          providerMessageId:result.providerMessageId || null,
          error:result.error || null,
          attemptedAt:new Date().toISOString()
        });
      }
    }
  }

  await updatePositionCheck(env.DB,position.id,{
    checkedAt:new Date().toISOString(),
    error:null
  });

  return {
    positionId:position.id,
    snapshot,
    change,
    event,
    deliveriesAttempted,
    deliveriesSucceeded
  };
}


export async function retryPendingDeliveries(env) {
  if(!env?.DB){
    return {deliveriesAttempted:0,deliveriesSucceeded:0,errors:[]};
  }

  const maxAttempts=normalizeMaxDeliveryAttempts(env.DELIVERY_RETRY_MAX_ATTEMPTS,3);
  const limit=Math.max(1,Math.min(200,Number(env.DELIVERY_RETRY_BATCH_SIZE || 50)));
  const pending=await listRetryableDeliveries(env.DB,{limit,maxAttempts});
  const result={
    deliveriesAttempted:0,
    deliveriesSucceeded:0,
    errors:[]
  };

  for(const item of pending){
    const decision=retryDecision(item.failedAttempts,maxAttempts);
    if(!decision.retry) continue;

    result.deliveriesAttempted++;

    try{
      const delivery=await deliverAlert(
        item.destination,
        {
          event:item.event,
          change:item.change,
          position:item.position,
          evaluation:item.evaluation,
          snapshot:item.snapshot
        },
        env,
        {attemptNumber:decision.nextAttempt}
      );

      if(delivery.ok) result.deliveriesSucceeded++;

      await saveDeliveryAttempt(env.DB,{
        id:crypto.randomUUID(),
        eventId:item.event.id,
        destinationId:item.destination.id,
        channel:item.destination.channel,
        target:item.destination.target,
        status:delivery.ok ? 'SENT' : 'FAILED',
        providerMessageId:delivery.providerMessageId || null,
        error:delivery.error || null,
        attemptedAt:new Date().toISOString()
      });

      if(!delivery.ok){
        result.errors.push({
          type:'delivery_retry_failed',
          eventId:item.event.id,
          destinationId:item.destination.id,
          attemptNumber:decision.nextAttempt,
          error:String(delivery.error || 'delivery_failed').slice(0,500)
        });
      }
    }catch(error){
      result.errors.push({
        type:'delivery_retry_exception',
        eventId:item.event.id,
        destinationId:item.destination.id,
        attemptNumber:decision.nextAttempt,
        error:String(error?.message || error).slice(0,500)
      });
    }
  }

  return result;
}
