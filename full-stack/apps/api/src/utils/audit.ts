import type { PoolClient } from 'pg';
export async function audit(client:PoolClient, data:{actorType:string;actorId?:string;action:string;resourceType?:string;resourceId?:string;requestId?:string;ip?:string;userAgent?:string;metadata?:unknown}){
 await client.query(`INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,request_id,ip_address,user_agent,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[
  data.actorType,data.actorId??null,data.action,data.resourceType??null,data.resourceId??null,data.requestId??null,data.ip??null,data.userAgent??null,data.metadata??{}
 ]);
}
