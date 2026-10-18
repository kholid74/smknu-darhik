import type { APIRoute } from 'astro';
import { can } from '../../../../../lib/rbac';
import { db } from '../../../../../lib/prisma';
import { json, UUID } from '../../../../../lib/voting/admin-http';
import { publicResultSnapshot } from '../../../../../lib/voting/result-snapshot';

export const prerender=false;
export const GET: APIRoute=async({params,locals})=>{
  if(!params.periodId||!UUID.test(params.periodId))return json({error:{code:'INVALID_INPUT'}},400);
  if(!locals.principal||!can(locals.principal,'evoting.hasil'))return json({error:{code:'FORBIDDEN'}},403);
  try{
    // Read the snapshot in the same statement as its state gate; never query the live tally.
    const [period]=await db.$queryRaw<Array<{state:string;resultSnapshot:unknown}>>`SELECT state,
      CASE WHEN state IN ('CLOSED','ARCHIVED') THEN "resultSnapshot" ELSE NULL END AS "resultSnapshot"
      FROM "ElectionPeriod" WHERE id=${params.periodId}::uuid`;
    if(!period)return json({error:{code:'NOT_FOUND'}},404);
    if(!['CLOSED','ARCHIVED'].includes(period.state))return json({error:{code:'RESULTS_NOT_AVAILABLE'}},409);
    const result=publicResultSnapshot(period.resultSnapshot);
    if(!result)return json({error:{code:'TEMPORARILY_UNAVAILABLE'}},503);
    return json({data:result});
  }catch{return json({error:{code:'TEMPORARILY_UNAVAILABLE'}},503);}
};
