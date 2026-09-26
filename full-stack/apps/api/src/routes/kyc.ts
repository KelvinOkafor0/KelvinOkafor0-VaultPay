import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser, type AuthedRequest } from '../types.js';
import { pool, withTx } from '../db.js';
import { getKycProvider } from '../services/providers.js';
import { audit } from '../utils/audit.js';
import { env } from '../env.js';

const provider=getKycProvider();
const startSchema=z.object({bvn:z.string().regex(/^\d{11}$/,'BVN_MUST_BE_11_DIGITS').optional()});

export async function kycRoutes(app:FastifyInstance){
 app.get('/kyc',async(req,reply)=>{if(!requireUser(req,reply))return; const r=await pool.query(`SELECT id,status,verification_level,submitted_at,verified_at,rejection_reason,metadata FROM kyc_profiles WHERE user_id=$1`,[(req as AuthedRequest).user.id]); return r.rows[0] ?? {status:'NOT_STARTED'};});
 app.post('/kyc',async(req,reply)=>{
  if(!requireUser(req,reply))return; const u=(req as AuthedRequest).user;
  const b=startSchema.parse(req.body??{});
  if(env.KYC_PROVIDER==='flutterwave' && !b.bvn)return reply.code(400).send({error:'BVN_REQUIRED'});
  const r=await pool.query(`SELECT first_name,last_name,date_of_birth,phone FROM users WHERE id=$1`,[u.id]);
  const row=r.rows[0]; if(!row?.first_name||!row?.last_name||!row?.date_of_birth)return reply.code(400).send({error:'PROFILE_INCOMPLETE'});
  const p=await provider.start({firstName:row.first_name,lastName:row.last_name,dateOfBirth:String(row.date_of_birth),phone:row.phone,bvn:b.bvn,redirectUrl:env.FLW_KYC_REDIRECT_URL});
  const result=await withTx(async client=>{
   const out=await client.query(`UPDATE kyc_profiles SET status=$2,provider=$3,provider_reference=$4,submitted_at=now(),verified_at=CASE WHEN $2='VERIFIED' THEN now() ELSE verified_at END,verification_level=CASE WHEN $2='VERIFIED' THEN 'DEMO' ELSE verification_level END,metadata=COALESCE(metadata,'{}'::jsonb)||$5::jsonb,updated_at=now() WHERE user_id=$1 RETURNING id,status,provider,provider_reference,submitted_at,verified_at,metadata`,[u.id,p.status,env.KYC_PROVIDER,p.providerReference,JSON.stringify({consentUrl:p.consentUrl??null})]);
   await audit(client,{actorType:'USER',actorId:u.id,action:'KYC_SUBMITTED',resourceType:'KYC',resourceId:out.rows[0]?.id,requestId:req.id,metadata:{provider:'flutterwave'}});
   return out.rows[0];
  });
  return reply.code(202).send(result);
 });
 app.post('/kyc/documents',async(req,reply)=>{if(!requireUser(req,reply))return; const b=req.body as any; if(!b?.documentType||!b?.storageReference)return reply.code(400).send({error:'INVALID_DOCUMENT'}); const kp=await pool.query('SELECT id FROM kyc_profiles WHERE user_id=$1',[(req as AuthedRequest).user.id]); if(!kp.rows[0])return reply.code(404).send({error:'KYC_NOT_FOUND'}); const r=await pool.query(`INSERT INTO kyc_documents(kyc_profile_id,document_type,storage_reference,document_hash) VALUES($1,$2,$3,$4) RETURNING id,document_type,verification_status`,[kp.rows[0].id,b.documentType,b.storageReference,b.documentHash??null]); return reply.code(201).send(r.rows[0]);});
 app.get('/kyc/complete',async(req,reply)=>{if(!requireUser(req,reply))return; const u=(req as AuthedRequest).user; const r=await pool.query(`SELECT id,provider_reference,status FROM kyc_profiles WHERE user_id=$1`,[u.id]); const k=r.rows[0]; if(!k)return reply.code(404).send({error:'KYC_NOT_FOUND'}); return {status:k.status,providerReference:k.provider_reference,info:'KYC completion is received asynchronously via provider webhook.'};});
}
