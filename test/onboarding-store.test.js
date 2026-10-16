import test from 'node:test';
import assert from 'node:assert/strict';
import { createOnboardingBundle } from '../src/store.js';

test('onboarding bundle uses one D1 batch for watchlist position and destination', async () => {
  const prepared=[];
  const batched=[];
  const db={
    prepare(sql){
      return {
        bind(...values){
          const statement={sql,values};
          prepared.push(statement);
          return statement;
        }
      };
    },
    async batch(statements){
      batched.push(statements);
      return statements.map(()=>({success:true}));
    }
  };

  const now='2026-10-16T04:00:00.000Z';
  const bundle={
    watchlist:{
      id:'watch-1',ownerKey:'owner-hash',label:'Founding Guard',
      createdAt:now,updatedAt:now
    },
    position:{
      id:'position-1',watchlistId:'watch-1',externalPositionId:null,
      walletAddress:'0x7a447c0a0ca7a786224bc2d27347b257e246eb1d',
      protocol:'aave-v3',chain:'ethereum',asset:'ACCOUNT',
      enabled:true,createdAt:now,updatedAt:now
    },
    destination:{
      id:'destination-1',watchlistId:'watch-1',channel:'webhook',
      target:'https://alerts.example.com/hook',enabled:true,
      createdAt:now,updatedAt:now
    }
  };

  const result=await createOnboardingBundle(db,bundle);
  assert.equal(batched.length,1);
  assert.equal(batched[0].length,3);
  assert.equal(prepared.length,3);
  assert.equal(result.watchlist.id,'watch-1');
  assert.equal(result.position.id,'position-1');
  assert.equal(result.destination.id,'destination-1');
});
