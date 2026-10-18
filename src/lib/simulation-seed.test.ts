import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import * as fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcryptjs';
import { SIMULATION_DATABASE } from './simulation-guard';

// Execute the actual seed command against SQL-only local storage; suppress synthetic slips and env output.
let sqlDb: PGlite, writes: string[] = [];
const fixtures = globalThis as any;
fixtures.simulationSeedFs = {...fs,writeFile:async (_:unknown,body:string)=>{writes.push(body);}};
fixtures.simulationSeedBcrypt = {hash:(value:string)=>bcrypt.hash(value,4)};
fixtures.simulationSeedClient = class {
  async connect() {}
  async end() {}
  async query(sql:string,params?:unknown[]){
    if(sql==='SELECT current_database() AS database')return {rows:[{database:SIMULATION_DATABASE}]};
    return params?sqlDb.query(sql,params):(await sqlDb.exec(sql)).at(-1)??{rows:[]};
  }
};
register('data:text/javascript,'+encodeURIComponent(`
  export function resolve(specifier,context,nextResolve){
    if(context.parentURL?.includes('/scripts/election-simulation.ts')){
      const source=specifier==='pg'?'export const Client=globalThis.simulationSeedClient':specifier==='node:fs/promises'?'export const {readFile,readdir,writeFile}=globalThis.simulationSeedFs':specifier==='bcryptjs'?'export default globalThis.simulationSeedBcrypt':null;
      if(source)return {url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true};
    }
    return nextResolve(specifier,context);
  }
`),import.meta.url);
after(()=>{delete fixtures.simulationSeedFs;delete fixtures.simulationSeedBcrypt;delete fixtures.simulationSeedClient;});
for(const scenario of ['empty','ready','partial','completed','expired'])test('actual simulator seeds dynamic schema atomically: '+scenario,async()=>{
  sqlDb=new PGlite();writes=[];
  const argv=process.argv,log=console.log,table=console.table,errors=console.error,priorExit=process.exitCode;
  const previousEnv={...process.env};let failure=false;
  try{
    // Only the owned local simulation URL may reach the mocked Client; no real environment is consumed.
    delete process.env.SIMULATION_DATABASE_URL;delete process.env.DATABASE_URL;process.env.SMKDH_SIMULATION='1';process.env.NODE_ENV='test';
    process.argv=['node','scripts/election-simulation.ts','seed','--scenario='+scenario];
    console.log=()=>{};console.table=()=>{};console.error=()=>{failure=true;};
    await import('../../scripts/election-simulation.ts?scenario='+scenario);
    assert.equal(failure,false);
    const period=(await sqlDb.query<any>('SELECT * FROM "ElectionPeriod"')).rows[0];assert.ok(period);
    assert.equal((await sqlDb.query('SELECT * FROM "ElectionContest" ORDER BY "sortOrder"')).rows.length,5);
    assert.equal((await sqlDb.query('SELECT * FROM "ElectionVoter"')).rows.length,scenario==='empty'?0:8);
    assert.equal((await sqlDb.query('SELECT * FROM "Ballot"')).rows.length,scenario==='completed'?5:scenario==='partial'?2:0);
    assert.equal((await sqlDb.query(`SELECT * FROM "CandidateMember" WHERE organization IN ('PRADANA_PUTRA','PRADANA_PUTRI') AND position='VICE_CHAIR'`)).rows.length,0);
    const now=(await sqlDb.query<{now:Date}>('SELECT clock_timestamp() AS now')).rows[0].now;
    assert.equal(period.closesAt<now,scenario==='expired');assert.equal(writes.length,1);
  }finally{
    console.log=log;console.table=table;console.error=errors;process.argv=argv;process.exitCode=priorExit;
    for(const key of ['SIMULATION_DATABASE_URL','DATABASE_URL','SMKDH_SIMULATION','NODE_ENV']){if(previousEnv[key]===undefined)delete process.env[key];else process.env[key]=previousEnv[key];}
    await sqlDb.close();process.exitCode=priorExit;
  }
});
