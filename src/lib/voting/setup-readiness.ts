import { orderedContests } from './contests';
type Member={position:string;studentId:string};
type Voter={credentialEnabled:boolean;pinHash:string|null;pinFingerprint:string|null;participation:Array<{organization:string}>};
export type SetupPeriod={opensAt:Date;closesAt:Date;contests:Array<{organization:string;sortOrder:number;candidateModeSnapshot:string;candidates:Array<{members:Member[]}>}>;voters:Voter[]};
export function canEditElectionSetup(period:{state:string;opensAt:Date},now:Date){
  return period.state==='DRAFT'||(period.state==='SCHEDULED'&&now<period.opensAt);
}
export function electionSetup(period:SetupPeriod,now:Date){
  let validContests=true;
  try { orderedContests(period.contests); } catch { validContests=false; }
  const configurationReady=validContests&&period.opensAt>now&&period.closesAt>period.opensAt;
  const candidatesReady=validContests&&period.contests.every(contest=>{
    const students=new Set<string>();
    return !!contest?.candidates.length&&contest.candidates.every(pair=>{
      const chair=pair.members.find(m=>m.position==='CHAIR');
      const vice=pair.members.find(m=>m.position==='VICE_CHAIR');
      if (!['SINGLE','OPTIONAL_VICE'].includes(contest.candidateModeSnapshot)||!chair||pair.members.length!==(vice?2:1)||
          (contest.candidateModeSnapshot==='SINGLE'&&vice)||new Set(pair.members.map(m=>m.studentId)).size!==pair.members.length||
          pair.members.some(m=>students.has(m.studentId))) return false;
      pair.members.forEach(m=>students.add(m.studentId));
      return true;
    });
  });
  const rosterReady=validContests&&period.voters.length>0&&period.voters.length<=99&&period.voters.every(voter=>voter.participation.length===period.contests.length&&new Set(voter.participation.map(p=>p.organization)).size===period.contests.length&&period.contests.every(c=>voter.participation.some(p=>p.organization===c.organization)));
  const pinsReady=period.voters.length>0&&period.voters.every(voter=>voter.credentialEnabled&&!!voter.pinHash&&!!voter.pinFingerprint);
  return {configurationReady,candidatesReady,rosterReady,pinsReady,ready:configurationReady&&candidatesReady&&rosterReady&&pinsReady,voterCount:period.voters.length,pinCount:period.voters.filter(v=>v.credentialEnabled&&v.pinHash&&v.pinFingerprint).length};
}
