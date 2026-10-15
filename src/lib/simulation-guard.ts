export const SIMULATION_DATABASE='smkdh_election_simulation';
export const SIMULATION_OWNER='smkdh-local-election-qa-v1';
export function assertSimulationTarget(connectionString:string|undefined,env:Record<string,string|undefined>){
 if(env.NODE_ENV==='production'||env.VERCEL||env.VERCEL_ENV||env.SMKDH_SIMULATION!=='1')throw new Error('SIMULATION_ENVIRONMENT_REJECTED');
 if(!connectionString)throw new Error('SIMULATION_DATABASE_URL_REQUIRED');
 let target:URL;try{target=new URL(connectionString)}catch{throw new Error('SIMULATION_URL_INVALID')}
 if(!['postgres:','postgresql:'].includes(target.protocol)||!['127.0.0.1','localhost','[::1]'].includes(target.hostname)||target.pathname!=='/'+SIMULATION_DATABASE||target.search||target.hash)throw new Error('SIMULATION_TARGET_REJECTED');
 return target;
}
export function assertSimulationOwnership(database:string,owner:string|undefined,confirmation?:string){
 if(database!==SIMULATION_DATABASE||owner!==SIMULATION_OWNER)throw new Error('SIMULATION_OWNERSHIP_REJECTED');
 if(confirmation!==undefined&&confirmation!==SIMULATION_DATABASE)throw new Error('SIMULATION_CONFIRMATION_REQUIRED');
}
