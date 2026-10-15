type Member={position:string;studentId:string};
type Voter={credentialEnabled:boolean;pinHash:string|null;pinFingerprint:string|null;participation:Array<{organization:string}>};
export type SetupPeriod={opensAt:Date;closesAt:Date;contests:Array<{organization:string;candidates:Array<{members:Member[]}>}>;voters:Voter[]};
export const ELECTION_ORGANIZATIONS=['OSIS','DEWAN_AMBALAN','IPNU','IPPNU'] as const;
export function electionSetup(period:SetupPeriod,now:Date){
  const configurationReady=period.opensAt>now&&period.closesAt>period.opensAt;
  const candidatesReady=period.contests.length===4&&ELECTION_ORGANIZATIONS.every(org=>{
    const contest=period.contests.find(item=>item.organization===org);
    return !!contest?.candidates.length&&contest.candidates.every(pair=>pair.members.length===2&&pair.members.some(m=>m.position==='CHAIR')&&pair.members.some(m=>m.position==='VICE_CHAIR')&&pair.members[0].studentId!==pair.members[1].studentId);
  });
  const rosterReady=period.voters.length>0&&period.voters.length<=99&&period.voters.every(voter=>voter.participation.length===4&&ELECTION_ORGANIZATIONS.every(org=>voter.participation.some(p=>p.organization===org)));
  const pinsReady=period.voters.length>0&&period.voters.every(voter=>voter.credentialEnabled&&!!voter.pinHash&&!!voter.pinFingerprint);
  return {configurationReady,candidatesReady,rosterReady,pinsReady,ready:configurationReady&&candidatesReady&&rosterReady&&pinsReady,voterCount:period.voters.length,pinCount:period.voters.filter(v=>v.credentialEnabled&&v.pinHash&&v.pinFingerprint).length};
}
