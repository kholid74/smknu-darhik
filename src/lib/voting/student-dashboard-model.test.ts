import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentDashboard } from './student-dashboard-model';
import { votingProgress, type Contest } from './contests';

const period = {id:'period-id',slug:'pemilu-2026',name:'Pemilihan 2026',opensAt:new Date(0),closesAt:new Date(1)};
const contests = (n:number): Contest[] => Array.from({length:n},(_,i)=>({organization:'TYPE_'+i,name:'Jenis '+i,logoUrl:null,candidateMode:'SINGLE',chairLabel:'Ketua',viceChairLabel:null,sortOrder:i+1}));
test('dashboard exposes ordered period snapshots and only participation with Coming Soon services',()=>{
  const list=contests(5),rights=list.map((c,i)=>({organization:c.organization,hasVoted:i===0}));
  const dashboard=buildStudentDashboard(period,list,rights);
  assert.equal(dashboard.scope,'ELECTION_VOTING');assert.equal(dashboard.participation.TYPE_0,true);
  assert.equal(dashboard.nextOrganization,'TYPE_1');assert.deepEqual(dashboard.contests,list);
  assert.equal(dashboard.services[0].href,'/siswa/e-voting/pemilu-2026/pilih');
  assert.equal('nisn' in dashboard,false);assert.equal('href' in dashboard.services[1],false);
  assert.deepEqual(dashboard.services.slice(1).map(s=>s.status),['coming_soon','coming_soon']);
});
test('1/5/6/20 types complete exactly at the final right; teacher keeps its realm',()=>{
  for(const n of [1,5,6,20]){
    const list=contests(n),rights=list.map(c=>({organization:c.organization,hasVoted:true}));
    const complete=buildStudentDashboard(period,list,rights,'TEACHER');
    assert.equal(complete.complete,true);assert.equal(complete.nextOrganization,null);assert.equal(complete.services.length,1);
    rights[n-1].hasVoted=false;
    assert.equal(buildStudentDashboard(period,list,rights).nextOrganization,'TYPE_'+(n-1));
  }
});
test('invalid, empty, duplicate, missing or foreign rights never count as completion',()=>{
  const list=contests(5),rights=list.map(c=>({organization:c.organization,hasVoted:true}));
  for(const bad of [[],rights.slice(1),[...rights,rights[0]],[...rights.slice(1),{organization:'FOREIGN',hasVoted:true}]]){
    assert.throws(()=>votingProgress(list,bad),/RECONCILIATION_FAILED/);
  }
  assert.throws(()=>votingProgress([],[]),/RECONCILIATION_FAILED/);
  list[0].sortOrder=7;assert.throws(()=>votingProgress(list,rights),/RECONCILIATION_FAILED/);
});
