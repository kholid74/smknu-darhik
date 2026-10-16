import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newTeacherCode, TEACHER_CODE, validateTeacherSelection, validateVoterLogin, voterIdentifier, voterPortal} from './voter-identity';
import {validateVoterSnapshot, validateRosterSnapshot} from './voter-roster-input';
import {pinHashMaterial} from './pin-input';
import {createHmac} from 'node:crypto';

test('teacher login is namespaced; existing strict ten-digit student login remains valid', () => {
  const pin='0011223344', code=newTeacherCode();
  assert.match(code, TEACHER_CODE);
  assert.deepEqual(validateVoterLogin({nisn:'0012345678',pin}), {voterType:'STUDENT',identifier:'0012345678',pin});
  assert.deepEqual(validateVoterLogin({voterType:'TEACHER',code:code.toLowerCase(),pin}), {voterType:'TEACHER',identifier:code,pin});
  for(const value of [{nisn:code,pin},{code,pin},{voterType:'TEACHER',nisn:'0012345678',pin},{voterType:'TEACHER',code:'0012345678',pin}, {nisn:'0012345678',pin,role:'admin'}, {nisn:'123456789',pin}, {voterType:'STUDENT',nisn:'0012345678',pin}]) assert.throws(()=>validateVoterLogin(value));
  const student={nisn:'0012345678'},teacher={voterType:'TEACHER',nisn:null,loginCode:code};
  assert.equal(voterPortal(teacher.voterType),'/pemilih');
  assert.equal(voterPortal(),'/siswa');
  assert.equal(voterIdentifier(teacher),code);
  const secret='s'.repeat(32);
  assert.equal(pinHashMaterial(secret,'period',voterIdentifier(student),pin),createHmac('sha256',secret).update(['pin-hash','period','0012345678',pin].join('\0')).digest('hex'));
  assert.notEqual(pinHashMaterial(secret,'period',voterIdentifier(teacher),pin),pinHashMaterial(secret,'period',voterIdentifier(student),pin));
});

test('teacher selection only accepts explicit bounded distinct master IDs',()=>{
  assert.deepEqual(validateTeacherSelection({teacherIds:['teacher-1','teacher_2']}),['teacher-1','teacher_2']);
  for(const value of [{teacherIds:[]},{teacherIds:['id','id']},{teacherIds:['id'],all:true},{teacherIds:['<free text>']},{teacherIds:[null]},{teacherIds:Array.from({length:100},(_,i)=>'t'+i)}])assert.throws(()=>validateTeacherSelection(value));
});

test('teacher removal uses its code snapshot; student-only corrections cannot accept a teacher',()=>{
  const value={loginCode:newTeacherCode(),name:'Teacher',className:'Guru'};
  assert.deepEqual(validateVoterSnapshot(value),value);
  assert.throws(()=>validateRosterSnapshot(value));
  assert.throws(()=>validateVoterSnapshot({...value,nisn:'0012345678'}));
});
