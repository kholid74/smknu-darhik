import {randomUUID} from 'node:crypto';

export type VoterType = 'STUDENT' | 'TEACHER';
export const TEACHER_CODE = /^GURU-[A-F0-9]{12}$/;
export const voterPortal = (type?: string) => type === 'TEACHER' ? '/pemilih' : '/siswa';
export const newTeacherCode = () => 'GURU-' + randomUUID().replaceAll('-', '').slice(0,12).toUpperCase();

export function voterIdentifier(voter: {voterType?: string; nisn: string | null; loginCode?: string | null}): string {
  const value = voter.voterType === 'TEACHER' ? voter.loginCode : voter.nisn;
  if (!value) throw new Error('INVALID_VOTER_IDENTITY');
  return value;
}

export function validateVoterLogin(value: unknown): {voterType: VoterType; identifier: string; pin: string} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_INPUT');
  const input=value as Record<string,unknown>;
  const teacher=input.voterType==='TEACHER';
  const keys=teacher?['voterType','code','pin']:['nisn','pin'];
  const identifier=teacher&&typeof input.code==='string'?input.code.trim().toUpperCase():input.nisn;
  if(Object.keys(input).length!==keys.length||Object.keys(input).some(key=>!keys.includes(key))||
    typeof identifier!=='string'||!(teacher?TEACHER_CODE.test(identifier):/^\d{10}$/.test(identifier))||
    typeof input.pin!=='string'||!/^\d{10}$/.test(input.pin))throw new Error('INVALID_INPUT');
  return {voterType:teacher?'TEACHER':'STUDENT',identifier,pin:input.pin};
}

export function validateTeacherSelection(value: unknown): string[] {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1)throw new Error('INVALID_INPUT');
  const ids=(value as Record<string,unknown>).teacherIds;
  if(!Array.isArray(ids)||!ids.length||ids.length>99||ids.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(id))||new Set(ids).size!==ids.length)throw new Error('INVALID_INPUT');
  return ids;
}
