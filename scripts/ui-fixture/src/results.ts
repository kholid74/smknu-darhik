import type { ResultSnapshot } from '../../../src/lib/voting/result-snapshot';

export function resultPeriod(slug: string) {
  if(slug === 'qa-results-error') throw new Error('Synthetic private database error');
  const zero=slug==='qa-results-zero',tie=slug==='qa-results-tie';
  const n=slug==='qa-results-1'?1:slug==='qa-results-6'?6:5;
  const codes=n===1?['PRADANA_PUTRI']:['OSIS','PRADANA_PUTRA','PRADANA_PUTRI','IPNU','IPPNU',...(n===6?['NEW_TYPE']:[])];
  const counts=n===1?[7]:[7,6,5,4,4,4];
  const result:ResultSnapshot={version:2,eligibleVoters:10,complete:zero?0:n===1?7:4,partial:zero||n===1?0:3,notStarted:zero?10:3,
    contests:codes.map((organization,index)=>{
      const votesCast=zero?0:tie?6:counts[index];
      const paired=organization==='OSIS'||organization==='IPNU';
      const values=zero?[0,0,0]:tie?[3,3,0]:[Math.ceil(votesCast/2),Math.floor(votesCast/2),0];
      return {organization,name:organization==='NEW_TYPE'?'Jenis keenam <b>snapshot</b>':organization.replaceAll('_',' ')+' historis',
        logoUrl:slug==='qa-results-late-logo'?null:index%2===0?'/api/image/qa/logo-'+index+'.png':null,candidateMode:paired?'OPTIONAL_VICE':'SINGLE',chairLabel:paired?'Ketua historis':'Pradana historis',viceChairLabel:paired?'Wakil historis':null,sortOrder:index+1,votesCast,
        candidates:[2,1,3].map(ballotNumber=>({candidateId:'50000000-0000-4000-8000-'+String(index*3+ballotNumber).padStart(12,'0'),ballotNumber,vision:'Visi historis '+ballotNumber+' <b>aman</b>',mission:'Misi historis\nKegiatan bersama',votes:values[ballotNumber-1],
          chair:{name:'Calon '+ballotNumber+' <b>historis</b>',className:'X Kelas historis',photoUrl:ballotNumber===3?null:'/api/image/qa/portrait-'+index+'-'+ballotNumber+'.png'},
          viceChair:paired&&ballotNumber===1?{name:'Wakil historis dengan nama yang panjang',className:'XI Kelas historis',photoUrl:'/api/image/qa/portrait-vice-'+index+'.png'}:null}))};
    })};
  return {id:'10000000-0000-4000-8000-000000000001',slug,name:'Pemilihan Bersama 2026',academicYear:'2026/2027',state:slug==='qa-results-draft'?'DRAFT':slug==='qa-results-scheduled'?'SCHEDULED':slug==='qa-results-archived'?'ARCHIVED':'CLOSED',
    closedAt:new Date('2026-10-17T05:00:00Z'),publishedAt:slug==='qa-results-unpublished'?null:new Date('2026-10-17T05:15:00Z'),resultSnapshot:slug==='qa-results-corrupt'?{...result,version:1}:result};
}
