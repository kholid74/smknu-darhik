import type { APIRoute } from 'astro';
import { can } from '../../lib/rbac';
import { receiveUpload, uploadJson } from '../../lib/upload-http';
export const prerender=false;
export const ALL: APIRoute=async({request,locals})=>{
  if(!locals.session||!locals.principal)return uploadJson({error:'Unauthorized'},401);
  if(!can(locals.principal,'media.kelola'))return uploadJson({error:'Forbidden'},403);
  if(request.method!=='POST')return uploadJson({error:'Method not allowed'},405);
  return receiveUpload(request);
};
