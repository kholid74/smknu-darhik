import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMasterRosterInserts, planMasterRoster, validateStudentSelection } from './master-roster';

describe('planMasterRoster', () => {
  it('adds only students absent from the period roster and detects NISN collisions', () => {
    const students = [
      { id: 'one', nisn: '0000000001', name: 'A', className: 'X' },
      { id: 'two', nisn: '0000000002', name: 'B', className: 'X' },
    ];
    const plan = planMasterRoster(students, [{ studentId: 'one', nisn: '0000000001' }]);
    assert.deepEqual(plan.additions, [students[1]]);
    assert.equal(plan.alreadyPresent, 1);
    assert.equal(plan.nisnConflict, false);
    assert.equal(planMasterRoster([students[1]], [{ studentId: 'legacy', nisn: '0000000002' }]).nisnConflict, true);
  });

  it('builds separate voter IDs and four participation rows per new master student', () => {
    const students = [
      { id: 'student-1', nisn: '0000000001', name: 'A', className: 'X' },
      { id: 'student-2', nisn: '0000000002', name: 'B', className: 'Y' },
    ];
    const inserts = buildMasterRosterInserts('period-1', students, ['OSIS', 'AMBALAN', 'IPNU', 'IPPNU']);
    assert.equal(inserts.voters.length, 2);
    assert.equal(new Set(inserts.voters.map(({ id }) => id)).size, 2);
    assert.deepEqual(inserts.voters.map(({ studentId }) => studentId), ['student-1', 'student-2']);
    assert.equal(inserts.participation.length, 8);
    assert.equal(new Set(inserts.participation.map(({ voterId, organization }) => `${voterId}:${organization}`)).size, 8);
  });
});

it('requires explicit bounded distinct student IDs; the previous empty-body all-students request is rejected',()=>{
  const id='20000000-0000-4000-8000-00000000000a';
  assert.deepEqual(validateStudentSelection({studentIds:[id.toUpperCase()]}),[id]);
  for(const input of [{},{studentIds:[]},{studentIds:[id,id]},{studentIds:[id,id.toUpperCase()]},{studentIds:[id],all:true},{studentIds:['Siti']},{studentIds:Array.from({length:100},()=>id)}])assert.throws(()=>validateStudentSelection(input),{code:'INVALID_INPUT'});
});
