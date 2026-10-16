import test from 'node:test';import assert from 'node:assert/strict';import {electionSetup,ELECTION_ORGANIZATIONS} from './setup-readiness';
const voter=()=>({credentialEnabled:true,pinHash:'hash',pinFingerprint:'fingerprint',participation:ELECTION_ORGANIZATIONS.map(organization=>({organization}))});
const fixture=()=>({opensAt:new Date(200),closesAt:new Date(300),contests:ELECTION_ORGANIZATIONS.map(organization=>({organization,candidates:[{members:[{position:'CHAIR',studentId:'a'},{position:'VICE_CHAIR',studentId:'b'}]}]})),voters:[voter()]});
test('preflight matches four contests, distinct members, valid schedule and 1–99 voters',()=>{assert.equal(electionSetup(fixture(),new Date(100)).ready,true);for(const count of [0,100]){const p=fixture();p.voters=Array.from({length:count},voter);assert.equal(electionSetup(p,new Date(100)).ready,false)}const p=fixture();p.contests[0].candidates[0].members[1].studentId='a';assert.equal(electionSetup(p,new Date(100)).candidatesReady,false);assert.equal(electionSetup(fixture(),new Date(200)).configurationReady,false)});
test('missing credential or participation prevents scheduling and reports separate readiness',()=>{const p=fixture();p.voters[0].participation.pop();assert.equal(electionSetup(p,new Date(100)).rosterReady,false);p.voters[0].credentialEnabled=false;assert.equal(electionSetup(p,new Date(100)).pinsReady,false)});

test('chair-only and mixed slates are ready; missing chair or duplicate positions are rejected',()=>{
  const p=fixture();
  p.contests[0].candidates[0].members.pop();
  assert.equal(electionSetup(p,new Date(100)).candidatesReady,true);
  p.contests[0].candidates[0].members[0].position='VICE_CHAIR';
  assert.equal(electionSetup(p,new Date(100)).candidatesReady,false);
  p.contests[0].candidates[0].members=[];
  assert.equal(electionSetup(p,new Date(100)).candidatesReady,false);
  p.contests[0].candidates[0].members=[{position:'CHAIR',studentId:'a'},{position:'CHAIR',studentId:'b'}];
  assert.equal(electionSetup(p,new Date(100)).candidatesReady,false);
});
