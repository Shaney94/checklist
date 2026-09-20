const {neon}=require('@neondatabase/serverless');
const {randomUUID,createCipheriv,createDecipheriv,createHash,hkdfSync}=require('node:crypto');
let sql;
function database(){if(!process.env.DATABASE_URL)throw Error('Calendar database is not configured');return sql||=neon(process.env.DATABASE_URL);}
function key(){const master=Buffer.from(process.env.TURNLI_CONTENT_KEY||'','base64');if(master.length!==32)throw Error('Calendar encryption unavailable');return Buffer.from(hkdfSync('sha256',master,'turnli','calendar-subscriptions-v1',32));}
function seal(url,owner){const iv=require('node:crypto').randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);cipher.setAAD(Buffer.from(owner));const bytes=Buffer.concat([cipher.update(url,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),bytes].map(b=>b.toString('base64')).join('.');}
function unseal(value,owner){const [iv,tag,data]=value.split('.').map(v=>Buffer.from(v,'base64'));const decipher=createDecipheriv('aes-256-gcm',key(),iv);decipher.setAAD(Buffer.from(owner));decipher.setAuthTag(tag);return Buffer.concat([decipher.update(data),decipher.final()]).toString();}
function metadata(row){return {id:row.id,propertyId:row.property_id||null,name:row.display_name,platform:row.platform,host:row.feed_host,enabled:row.enabled,checkIn:String(row.check_in).slice(0,5),checkOut:String(row.check_out).slice(0,5),lastAttempt:row.last_attempt,lastSuccess:row.last_success,error:row.sync_error,status:!row.enabled?'Paused':row.sync_error?'Sync error':row.last_success?'Connected':'Not synced',createdAt:row.created_at,updatedAt:row.updated_at};}
function createStore(db=database()){
 return {
  async list(owner){return db`SELECT * FROM turnli_calendars WHERE owner_id=${owner} ORDER BY display_name,id`;},
  async get(owner,id){return (await db`SELECT * FROM turnli_calendars WHERE owner_id=${owner} AND id=${id}`)[0];},
  async create(owner,input,bookings){if(typeof input.propertyId!=='string'||!input.propertyId)return undefined;const id=randomUUID(),encrypted=seal(input.url,owner),hash=createHash('sha256').update(input.url).digest('hex');return (await db`INSERT INTO turnli_calendars(id,owner_id,property_id,display_name,platform,feed_host,encrypted_url,url_hash,check_in,check_out,bookings,last_attempt,last_success) SELECT ${id},${owner},${input.propertyId},${input.name},${input.platform},${new URL(input.url).hostname},${encrypted},${hash},${input.checkIn},${input.checkOut},${JSON.stringify(bookings)}::jsonb,now(),now() FROM turnli_dashboard WHERE owner_id=${owner} AND data @> ${JSON.stringify({properties:[{id:input.propertyId}]})}::jsonb RETURNING *`)[0];},
  async update(owner,id,input){return (await db`UPDATE turnli_calendars SET property_id=${input.propertyId},display_name=${input.name},platform=${input.platform},check_in=${input.checkIn},check_out=${input.checkOut},enabled=${input.enabled},revision=revision+1,updated_at=now() WHERE owner_id=${owner} AND id=${id} AND ((${input.propertyId}::text IS NULL AND property_id IS NULL) OR EXISTS(SELECT 1 FROM turnli_dashboard d WHERE d.owner_id=${owner} AND d.data @> ${JSON.stringify({properties:[{id:input.propertyId}]})}::jsonb)) RETURNING *`)[0];},
  async remove(owner,id){return (await db`DELETE FROM turnli_calendars WHERE owner_id=${owner} AND id=${id} RETURNING id`).length>0;},
  async claim(owner,id){const lease=randomUUID();return (await db`UPDATE turnli_calendars SET lease_id=${lease},lease_until=now()+interval '45 seconds',last_attempt=now() WHERE owner_id=${owner} AND id=${id} AND enabled AND (lease_until IS NULL OR lease_until<now()) AND (last_attempt IS NULL OR last_attempt<now()-interval '5 minutes') RETURNING *`)[0];},
  async finish(row,bookings,error,cancelledIds=[]){
   if(error)return db`UPDATE turnli_calendars SET sync_error=${error},lease_id=NULL,lease_until=NULL WHERE id=${row.id} AND owner_id=${row.owner_id} AND lease_id=${row.lease_id} AND revision=${row.revision}`;
   // A complete but temporarily partial response is not proof of cancellation.
   // Confirm absence in two successful refreshes; explicit cancellations need no delay.
   const present=new Set(bookings.map(b=>b.id)),cancelled=new Set(cancelledIds),pending=new Set(row.pending_removals||[]);
   const retained=(row.bookings||[]).filter(b=>!present.has(b.id)&&!cancelled.has(b.id)&&!pending.has(b.id));
   const missing=retained.map(b=>b.id),warning=missing.length?'Some reservations are missing from the latest feed. Their saved plans are retained until removal is confirmed by the next successful refresh.':null;
   return db`UPDATE turnli_calendars SET bookings=${JSON.stringify([...bookings,...retained])}::jsonb,pending_removals=${JSON.stringify(missing)}::jsonb,last_success=now(),sync_error=${warning},lease_id=NULL,lease_until=NULL WHERE id=${row.id} AND owner_id=${row.owner_id} AND lease_id=${row.lease_id} AND revision=${row.revision}`;
  },
  async due(limit=50){return db`SELECT id,owner_id FROM turnli_calendars WHERE enabled AND (last_attempt IS NULL OR last_attempt<now()-interval '23 hours') AND (lease_until IS NULL OR lease_until<now()) ORDER BY last_attempt NULLS FIRST LIMIT ${limit}`;}
 };
}
module.exports={database,createStore,metadata,seal,unseal};
