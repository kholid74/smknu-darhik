import { buildStudentDashboard } from '../../../src/lib/voting/student-dashboard-model';
import type { Contest } from '../../../src/lib/voting/contests';
export const session = {id:'qa-dynamic-session',scope:'ELECTION_VOTING',voterType:'STUDENT',voterId:'qa-student',periodId:'10000000-0000-4000-8000-000000000001',createdAt:new Date(),lastSeenAt:new Date(),expiresAt:new Date(Date.now()+600000)};
export function votingFixture(n:number){
  const codes=n===1?['PRADANA_PUTRI']:['OSIS','PRADANA_PUTRA','PRADANA_PUTRI','IPNU','IPPNU',...(n===6?['NEW_TYPE']:[])];
  const contests:Contest[]=codes.map((organization,i)=>({organization,name:organization==='NEW_TYPE'?'Jenis baru dari master':organization.replaceAll('_',' '),logoUrl:i%2===0?'/api/image/qa/logo-'+i+'.png':null,candidateMode:'SINGLE',chairLabel:'Pemimpin',viceChairLabel:null,sortOrder:i+1}));
  const period={id:session.periodId,slug:'qa-'+n,name:'Pemilihan sintetis '+n,opensAt:new Date(Date.now()-60000),closesAt:new Date(Date.now()+3600000)};
  const rights=contests.map((c,i)=>({organization:c.organization,hasVoted:i<n-1}));
  const dashboard=buildStudentDashboard(period,contests,rights);
  return {dashboard,data:{period,contests,participation:dashboard.participation,nextOrganization:dashboard.nextOrganization,
    candidateCounts:Object.fromEntries(codes.map(c=>[c,1])),candidates:[{id:'40000000-0000-4000-8000-000000000001',ballotNumber:1,vision:'Aspirasi bersama',mission:'Kegiatan yang bermanfaat',members:[{position:'CHAIR',nameSnapshot:'Siswa <b>aman</b>',classSnapshot:'X QA',photoUrl:null}]}]}};
}
