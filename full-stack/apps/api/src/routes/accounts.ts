import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser,type AuthedRequest } from '../types.js';
import { pool,withTx } from '../db.js';
import { getBankProvider } from '../services/providers.js';
import { env } from '../env.js';
import { audit } from '../utils/audit.js';

const bank=getBankProvider();

export async function accountRoutes(app:FastifyInstance){
 app.get('/accounts',async(req,reply)=>{if(!requireUser(req,reply))return; const r=await pool.query(`SELECT id,account_number,currency,status,ledger_balance,available_balance,provider,provider_metadata,created_at FROM accounts WHERE user_id=$1 ORDER BY created_at DESC`,[(req as AuthedRequest).user.id]); return {accounts:r.rows}});
 app.get('/accounts/:id',async(req,reply)=>{if(!requireUser(req,reply))return; const r=await pool.query(`SELECT id,account_number,currency,status,ledger_balance,available_balance,provider,provider_metadata,created_at FROM accounts WHERE id=$1 AND user_id=$2`,[(req.params as any).id,(req as AuthedRequest).user.id]); if(!r.rows[0])return reply.code(404).send({error:'ACCOUNT_NOT_FOUND'}); return r.rows[0]});
 app.get('/accounts/:id/balance',async(req,reply)=>{if(!requireUser(req,reply))return; const r=await pool.query(`SELECT currency,ledger_balance,available_balance FROM accounts WHERE id=$1 AND user_id=$2`,[(req.params as any).id,(req as AuthedRequest).user.id]); if(!r.rows[0])return reply.code(404).send({error:'ACCOUNT_NOT_FOUND'}); return r.rows[0]});
 app.get('/accounts/:id/ledger',async(req,reply)=>{if(!requireUser(req,reply))return; const r=await pool.query(`SELECT je.id,je.reference_type,je.reference_id,je.description,je.created_at,jl.entry_type,jl.amount,jl.currency FROM journal_entries je JOIN journal_lines jl ON jl.journal_entry_id=je.id JOIN ledger_accounts la ON la.id=jl.ledger_account_id JOIN accounts a ON a.id=la.account_id WHERE a.id=$1 AND a.user_id=$2 ORDER BY je.created_at DESC LIMIT 100`,[(req.params as any).id,(req as AuthedRequest).user.id]); return {entries:r.rows}});
 app.get('/accounts/:id/statement',async(req,reply)=>{if(!requireUser(req,reply))return; const r=await pool.query(`SELECT t.id,t.amount,t.currency,t.status,t.description,t.created_at FROM transfers t JOIN accounts a ON a.id=t.source_account_id WHERE a.id=$1 AND a.user_id=$2 ORDER BY t.created_at DESC LIMIT 100`,[(req.params as any).id,(req as AuthedRequest).user.id]); return {transactions:r.rows}});
 app.post('/accounts/:id/funding-instructions',async(req,reply)=>{
   if(!requireUser(req,reply))return; if(!env.LIVE_MONEY_ENABLED)return reply.code(503).send({error:'LIVE_MONEY_DISABLED'}); if(!bank.createFundingAccount)return reply.code(503).send({error:'FUNDING_PROVIDER_NOT_CONFIGURED'});
   const u=(req as AuthedRequest).user; const id=(req.params as any).id;
   const b=z.object({isPermanent:z.boolean().default(true),bvn:z.string().regex(/^\d{11}$/).optional(),nin:z.string().min(8).max(20).optional()}).parse(req.body??{});
   const r=await pool.query(`SELECT a.*,u.email,u.phone,u.first_name,u.last_name FROM accounts a JOIN users u ON u.id=a.user_id WHERE a.id=$1 AND a.user_id=$2 AND a.currency='NGN'`,[id,u.id]); const a=r.rows[0]; if(!a)return reply.code(404).send({error:'ACCOUNT_NOT_FOUND'});
   if(b.isPermanent && !b.bvn && !b.nin) return reply.code(400).send({error:'BVN_OR_NIN_REQUIRED_FOR_PERMANENT_ACCOUNT'});
   const reference=`VPVA-${a.id}-${Date.now()}`;
   const va=await bank.createFundingAccount({email:a.email,phone:a.phone,firstName:a.first_name,lastName:a.last_name,currency:'NGN',isPermanent:b.isPermanent,bvn:b.bvn,nin:b.nin,reference});
   const out=await withTx(async client=>{
     const updated=(await client.query(`UPDATE accounts SET account_number=$1,provider_reference=$2,provider=$3,provider_metadata=provider_metadata||$4::jsonb,updated_at=now() WHERE id=$5 RETURNING id,account_number,currency,status,provider,provider_metadata`,[va.accountNumber,va.providerReference,env.BANK_PROVIDER,JSON.stringify({bankName:va.bankName,isPermanent:va.isPermanent,expiryDate:va.expiryDate??null}),a.id])).rows[0];
     await audit(client,{actorType:'USER',actorId:u.id,action:'FUNDING_ACCOUNT_CREATED',resourceType:'ACCOUNT',resourceId:a.id,requestId:req.id,metadata:{provider:'flutterwave',providerReference:va.providerReference,isPermanent:va.isPermanent}});
     return updated;
   });
   return reply.code(201).send({account:out,bankName:va.bankName,accountNumber:va.accountNumber,isPermanent:va.isPermanent,expiryDate:va.expiryDate??null});
 });
}
