import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { publicResultSnapshot } from './result-snapshot';
const fixture=(n=5)=>({version:2,eligibleVoters:2,notStarted:1,partial:0,complete:1,
  contests:Array.from({length:n},(_,i)=>({organization:'TYPE_'+i,name:'Jenis '+i,logoUrl:'/api/image/logo.webp',candidateMode:'OPTIONAL_VICE',chairLabel:'Ketua',viceChairLabel:'Wakil',sortOrder:i+1,votesCast:1,
    candidates:[{candidateId:randomUUID(),ballotNumber:1,vision:'Visi',mission:'Misi',votes:1,chair:{name:'Siswa A',className:'X RPL',photoUrl:null,studentId:'private'},viceChair:null}]}))});
test('public v2 projects only allowed fields for 1/5/6/20 types and zero turnout',()=>{
  for(const n of [1,5,6,20]){
    const input=fixture(n),result=publicResultSnapshot(input);assert.ok(result);assert.equal(result.contests.length,n);
    assert.equal('studentId' in result.contests[0].candidates[0].chair,false);
    input.complete=0;input.notStarted=2;input.contests.forEach(c=>{c.votesCast=0;c.candidates[0].votes=0});
    assert.ok(publicResultSnapshot(input));
  }
});
test('public v2 rejects stale versions, duplicate IDs/numbers, invalid mode/order/code/media and counts',()=>{
  const mutations:Array<(s:any)=>void>=[
    s=>s.version=1,s=>s.contests=[],s=>s.contests[0].sortOrder=2,s=>s.contests[0].organization='invalid',
    s=>s.contests[0].organization=s.contests[1].organization,s=>s.contests[0].candidates[0].candidateId=s.contests[1].candidates[0].candidateId,
    s=>s.contests[0].candidates.push(s.contests[0].candidates[0]),s=>s.contests[0].logoUrl='javascript:alert(1)',
    s=>s.contests[0].viceChairLabel=null,s=>s.contests[0].candidateMode='SINGLE',
    s=>s.contests[0].candidates[0].viceChair={},s=>s.contests[0].candidates[0].viceChair=undefined,
    s=>s.contests[0].candidates[0].votes=2,s=>s.eligibleVoters=100,s=>s.partial=1,
  ];
  for(const mutate of mutations){const input=fixture();mutate(input);assert.equal(publicResultSnapshot(input),null);}
});
test('reconciliation bounds include at least one and at most N-1 ballots per partial voter',()=>{
  const p=fixture(5);p.complete=0;p.partial=1;p.notStarted=1;
  assert.equal(publicResultSnapshot(p),null);
  p.contests[4].votesCast=0;p.contests[4].candidates[0].votes=0;assert.ok(publicResultSnapshot(p));
  p.contests.forEach(c=>{c.votesCast=0;c.candidates[0].votes=0});assert.equal(publicResultSnapshot(p),null);
  const one=fixture(1);one.complete=0;one.partial=1;one.notStarted=1;assert.equal(publicResultSnapshot(one),null);
});
test('single mode requires null vice label and member',()=>{
  const p=fixture(1),c=p.contests[0];c.candidateMode='SINGLE';(c as any).viceChairLabel=null;
  assert.ok(publicResultSnapshot(p));
  (c.candidates[0] as any).viceChair={name:'Vice',className:'X',photoUrl:null};assert.equal(publicResultSnapshot(p),null);
});
