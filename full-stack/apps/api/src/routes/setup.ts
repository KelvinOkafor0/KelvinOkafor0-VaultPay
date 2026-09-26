import type { FastifyInstance } from 'fastify'; import { pool,withTx } from '../db.js'; import { requireUser,type AuthedRequest } from '../types.js'; import { audit } from '../utils/audit.js';
export async function setupRoutes(app:FastifyInstance){
 app.post('/accounts',async(req,reply)=>{
  if(!requireUser(req,reply))return; const u=(req as AuthedRequest).user;
  const k=await pool.query(`SELECT status FROM kyc_profiles WHERE user_id=$1`,[u.id]); if(k.rows[0]?.status!=='VERIFIED')return reply.code(403).send({error:'KYC_REQUIRED'});
  const existing=await pool.query(`SELECT id,account_number,currency,status,ledger_balance,available_balance,provider,provider_metadata FROM accounts WHERE user_id=$1 AND currency='NGN' AND status <> 'CLOSED' ORDER BY created_at DESC LIMIT 1`,[u.id]);
  if(existing.rows[0]) return reply.code(200).send(existing.rows[0]);
  const result=await withTx(async client=>{const a=(await client.query(`INSERT INTO accounts(user_id,currency,status,provider) VALUES($1,'NGN','ACTIVE',$2) RETURNING id,account_number,currency,status,ledger_balance,available_balance,provider,provider_metadata`,[u.id,'flutterwave'])).rows[0]; await client.query(`INSERT INTO ledger_accounts(account_id,code,currency,account_type) VALUES($1,$2,'NGN','CUSTOMER_WALLET')`,[a.id,`CUSTOMER:${a.id}`]); await audit(client,{actorType:'USER',actorId:u.id,action:'ACCOUNT_CREATED',resourceType:'ACCOUNT',resourceId:a.id,requestId:req.id}); return a});
  return reply.code(201).send(result);
 });
}
