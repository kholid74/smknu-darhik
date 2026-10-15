import test from 'node:test';import assert from 'node:assert/strict';import {tableView} from './table-state';
const rows=Array.from({length:31},(_,i)=>['Siswa '+(i+1),i%2?'X DKV':'X LPS']);
const defaults={query:'',filter:'',filterColumn:1,sortColumn:0,direction:'asc' as const,page:1,size:10};
test('table filters and natural sort before paginating; size is bounded',()=>{const view=tableView(rows,r=>r,{...defaults,filter:'X DKV',page:2});assert.equal(view.total,15);assert.equal(view.rows[0][0],'Siswa 22');assert.equal(view.rows.length,5);assert.equal(tableView(rows,r=>r,{...defaults,size:999}).size,10)});
test('table resets out of range page after filtering and handles empty results',()=>{const view=tableView(rows,r=>r,{...defaults,query:'Siswa 31',page:100});assert.equal(view.page,1);assert.equal(view.total,1);const empty=tableView(rows,r=>r,{...defaults,query:'tidak ditemukan'});assert.equal(empty.pages,1);assert.deepEqual(empty.rows,[])});

test('pagination preserves initial order and sorting does not mutate the dataset',()=>{const before=rows.map(row=>[...row]);const view=tableView(rows,r=>r,{...defaults,sortColumn:-1,page:2});assert.equal(view.rows[0][0],'Siswa 11');tableView(rows,r=>r,{...defaults,direction:'desc'});assert.deepEqual(rows,before)});
