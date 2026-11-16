import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveAdaptiveHome, type HomeSelection } from '../../web/src/adaptiveHome.ts';
import type { JinnIdentity } from '../../web/src/jinnStore.ts';

const jinn=(id:string,name:string,primary=false):JinnIdentity=>({
 id,name,is_primary:primary,purpose:'',
});

describe('F03-003 adaptive Wish home',()=>{
 const owner='account-a';
 const system=jinn('primary','Jinn',true);
 const maya=jinn('primary','Maya',true);
 const ari=jinn('other','Ari');
 const lee=jinn('third','Lee');

 it('keeps guests completely Wish-first even when old preferences are supplied',()=>{
   const result=resolveAdaptiveHome(null,[maya,ari],7,{id:'other',ownerId:owner},'other');
   assert.deepEqual(result,{mode:'guest',selected:null,requiresRecovery:false});
 });
 it('does not mistake an unused auto-primary Jinn for deliberate onboarding',()=>{
   const result=resolveAdaptiveHome(owner,[system],0,null,null);
   assert.equal(result.mode,'fresh');
   assert.equal(result.selected?.id,'primary');
   assert.equal(result.requiresRecovery,false);
   assert.equal(resolveAdaptiveHome(owner,[],0,null,null).mode,'fresh');
 });
 it('shows a named companion for a configured sole Jinn, even before a first Wish',()=>{
   const result=resolveAdaptiveHome(owner,[maya],0,null,null);
   assert.equal(result.mode,'named');
   assert.equal(result.selected?.name,'Maya');
   assert.equal(resolveAdaptiveHome(owner,[system],1,null,null).mode,'named');
 });
 it('shows the primary by default when three Jinns exist, without writing a preference',()=>{
   const result=resolveAdaptiveHome(owner,[maya,ari,lee],4,null,null);
   assert.equal(result.mode,'multiple');
   assert.equal(result.selected?.name,'Maya');
   assert.equal(result.requiresRecovery,false);
 });
 it('honors an explicitly chosen Jinn and then last valid explicit preference',()=>{
   assert.equal(resolveAdaptiveHome(owner,[maya,ari,lee],0,{id:'other',ownerId:owner},null).selected?.name,'Ari');
   assert.equal(resolveAdaptiveHome(owner,[maya,ari,lee],0,null,'third').selected?.name,'Lee');
   assert.equal(resolveAdaptiveHome(owner,[maya,ari,lee],0,{id:'primary',ownerId:owner},'third').selected?.name,'Maya');
 });
 it('blocks stale, deleted, foreign-owner, or account-switched selections until explicit recovery',()=>{
   const invalid:HomeSelection={id:'other',ownerId:'account-b'};
   for(const result of [
     resolveAdaptiveHome(owner,[maya,ari],1,invalid,null),
     resolveAdaptiveHome(owner,[maya,ari],1,{id:'removed',ownerId:owner},null),
     resolveAdaptiveHome(owner,[maya,ari],1,null,'removed'),
   ]){
     assert.equal(result.requiresRecovery,true);
     assert.equal(result.selected,null);
   }
   const recovered=resolveAdaptiveHome(owner,[maya,ari],1,null,null);
   assert.equal(recovered.requiresRecovery,false);
   assert.equal(recovered.selected?.name,'Maya');
 });
});
