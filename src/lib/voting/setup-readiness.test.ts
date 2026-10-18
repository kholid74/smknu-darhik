import test from 'node:test';
import assert from 'node:assert/strict';
import { canEditElectionSetup, electionSetup } from './setup-readiness';
const fixture = (n = 5) => {
  const contests = Array.from({length:n},(_,i)=>({organization:'TYPE_'+i,sortOrder:i+1,candidateModeSnapshot:'OPTIONAL_VICE',candidates:[{members:[{position:'CHAIR',studentId:'a'},{position:'VICE_CHAIR',studentId:'b'}]}]}));
  return {opensAt:new Date(200),closesAt:new Date(300),contests,voters:[{credentialEnabled:true,pinHash:'hash',pinFingerprint:'fingerprint',participation:contests.map(c=>({organization:c.organization}))}]};
};
test('preflight follows the exact ordered period contests for 1, 5, 6 and 20 types',()=>{
  for(const n of [1,5,6,20]) assert.equal(electionSetup(fixture(n),new Date(100)).ready,true);
  for(const n of [0,21]) assert.equal(electionSetup(fixture(n),new Date(100)).ready,false);
  for(const count of [0,100]) {const p=fixture();p.voters=Array.from({length:count},()=>p.voters[0]);assert.equal(electionSetup(p,new Date(100)).rosterReady,false);}
  for(const mutate of [(p:any)=>p.contests[0].sortOrder=2,(p:any)=>p.contests[0].organization=p.contests[1].organization]) {const p=fixture();mutate(p);assert.equal(electionSetup(p,new Date(100)).ready,false);}
});
test('missing or duplicate rights, invalid schedule and missing credentials prevent scheduling',()=>{
  const p=fixture();p.voters[0].participation.pop();assert.equal(electionSetup(p,new Date(100)).rosterReady,false);
  p.voters[0].participation.push({organization:'TYPE_0'});assert.equal(electionSetup(p,new Date(100)).rosterReady,false);
  p.voters[0].credentialEnabled=false;assert.equal(electionSetup(p,new Date(100)).pinsReady,false);
  assert.equal(electionSetup(fixture(),new Date(200)).configurationReady,false);
});
test('single mode forbids vice, optional vice accepts chair-only; duplicate student or position fails',()=>{
  const p=fixture();p.contests[0].candidateModeSnapshot='SINGLE';
  assert.equal(electionSetup(p,new Date(100)).candidatesReady,false);
  p.contests[0].candidates[0].members.pop();assert.equal(electionSetup(p,new Date(100)).ready,true);
  for(const members of [[],[{position:'VICE_CHAIR',studentId:'a'}],[{position:'CHAIR',studentId:'a'},{position:'CHAIR',studentId:'b'}]]) {
    p.contests[0].candidates[0].members=members;assert.equal(electionSetup(p,new Date(100)).candidatesReady,false);
  }
  const q=fixture();q.contests[0].candidates.push(q.contests[0].candidates[0]);
  assert.equal(electionSetup(q,new Date(100)).candidatesReady,false);
});
test('draft setup ignores stale dates; scheduled setup freezes exactly at opening',()=>{
  const now=new Date(100);
  assert.equal(canEditElectionSetup({state:'DRAFT',opensAt:new Date(50)},now),true);
  assert.equal(canEditElectionSetup({state:'SCHEDULED',opensAt:new Date(101)},now),true);
  for(const state of ['SCHEDULED','CLOSED','ARCHIVED'])assert.equal(canEditElectionSetup({state,opensAt:new Date(100)},now),false);
  for(const state of ['CLOSED','ARCHIVED'])assert.equal(canEditElectionSetup({state,opensAt:new Date(200)},now),false);
});
