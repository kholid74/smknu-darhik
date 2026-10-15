import test from 'node:test';import assert from 'node:assert/strict';import {studentTableOptions} from './student-table-options';
test('student table parameters bound page size and whitelist server sort',()=>{assert.deepEqual(studentTableOptions(new URLSearchParams('page=-1&size=100000&sort=password&dir=oops')),{size:10,page:1,sort:'name',dir:'asc'});assert.deepEqual(studentTableOptions(new URLSearchParams('page=2&size=25&sort=nisn&dir=desc')),{size:25,page:2,sort:'nisn',dir:'desc'})});

test('oversized page offsets are rejected before querying the database',()=>{assert.equal(studentTableOptions(new URLSearchParams('page=9007199254740991')).page,1)});
