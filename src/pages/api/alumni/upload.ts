import type { APIRoute } from 'astro';
import { getAlumniSession } from '../../../lib/alumni-auth';
import { receiveUpload, uploadJson } from '../../../lib/upload-http';
export const prerender=false;
export const ALL: APIRoute=async({request,cookies})=>{
  if(!await getAlumniSession(cookies))return uploadJson({error:'Unauthorized'},401);
  if(request.method!=='POST')return uploadJson({error:'Method not allowed'},405);
  return receiveUpload(request,true);
};
