import { db } from './prisma';
import { deleteFromR2 } from './r2';
import { mediaKey } from './image-url';
import { env } from './env';

export class MediaInUseError extends Error {}
export async function deleteMedia(id: string, origin: string) {
  const removed=await db.$transaction(async(tx:any)=>{
    const [media]=await tx.$queryRaw`SELECT * FROM "Media" WHERE id=${id} FOR UPDATE`;
    if(!media)return null;
    const [{used}]=await tx.$queryRaw`SELECT (
      EXISTS(SELECT 1 FROM "ElectionType" WHERE "logoUrl"=${media.url}) OR
      EXISTS(SELECT 1 FROM "ElectionContest" WHERE "logoUrlSnapshot"=${media.url}) OR
      EXISTS(SELECT 1 FROM "CandidateMember" WHERE "photoUrl"=${media.url}) OR
      EXISTS(SELECT 1 FROM "ElectionPeriod" p, LATERAL jsonb_array_elements(COALESCE(p."resultSnapshot"->'contests','[]'::jsonb)) contest
        WHERE contest->>'logoUrl'=${media.url} OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(contest->'candidates','[]'::jsonb)) candidate
          WHERE candidate->'chair'->>'photoUrl'=${media.url} OR candidate->'viceChair'->>'photoUrl'=${media.url}))
    ) AS used`;
    if(used)throw new MediaInUseError();
    await tx.$executeRaw`DELETE FROM "Media" WHERE id=${id}`;
    return media;
  },{maxWait:2000,timeout:10000});
  if(!removed)return {storageDeleted:true};
  const key=mediaKey(removed.url,origin,env('R2_PUBLIC_URL'));
  if(key){try{await deleteFromR2(key);}catch{return {storageDeleted:false};}}
  return {storageDeleted:true};
}
