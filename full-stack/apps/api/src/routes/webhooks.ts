import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { env } from '../env.js';
import { pool, withTx } from '../db.js';
import { settleTransfer } from '../services/transferSettlement.js';
import { createBalancedJournal } from '../services/ledger.js';
import { audit } from '../utils/audit.js';
import { getBankProvider } from '../services/providers.js';

const bank=getBankProvider();

function validFlutterwaveSignature(rawBody:string, headers:any){
  const secret=env.FLW_SECRET_HASH;
  if(!secret)return false;
  const legacy=String(headers['verif-hash']??'');
  if(legacy && crypto.timingSafeEqual(Buffer.from(legacy),Buffer.from(secret)))return true;
  const signature=String(headers['flutterwave-signature']??'');
  if(!signature)return false;
  const expected=crypto.createHmac('sha256',secret).update(rawBody).digest('base64');
  try{return crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected));}catch{return false}
}
function safeKycPayload(body:any){
  const d=body?.data??{}; return {event:String(body?.event??'bvn.completed'),reference:String(d.reference??''),status:String(d.status??''),firstname:d.firstname?String(d.firstname):undefined,lastname:d.lastname?String(d.lastname):undefined};
}

export async function webhookRoutes(app:FastifyInstance){
 app.post('/webhooks/flutterwave',async(req,reply)=>{
   const raw=String((req as any).rawBody??JSON.stringify(req.body??{}));
   if(!validFlutterwaveSignature(raw,req.headers))return reply.code(401).send({error:'INVALID_SIGNATURE'});
   const body=req.body as any; const event=String(body?.event??''); const data=body?.data??{};
   const providerEventId=String(body?.webhook_id??data?.id??data?.reference??crypto.createHash('sha256').update(raw).digest('hex'));
   const inserted=await withTx(async client=>{
     if(event==='bvn.completed'){
       const safe=safeKycPayload(body); const ins=await client.query(`INSERT INTO webhook_events(provider,event_id,event_type,payload,signature_valid) VALUES('flutterwave',$1,$2,$3,true) ON CONFLICT(provider,event_id) DO NOTHING RETURNING id`,[providerEventId,event,safe]);
       if(!ins.rows[0])return {duplicate:true};
       const status=String(data.status??'').toUpperCase()==='COMPLETED'?'VERIFIED':'REJECTED';
       await client.query(`UPDATE kyc_profiles SET status=$1,verified_at=CASE WHEN $1='VERIFIED' THEN now() ELSE verified_at END,rejection_reason=CASE WHEN $1='REJECTED' THEN $2 ELSE NULL END,verification_level=CASE WHEN $1='VERIFIED' THEN 'BVN' ELSE verification_level END,updated_at=now() WHERE provider='flutterwave' AND provider_reference=$3`,[status,status==='REJECTED'?'Flutterwave BVN verification did not complete':null,String(data.reference??'')]);
       const k=(await client.query(`SELECT user_id FROM kyc_profiles WHERE provider='flutterwave' AND provider_reference=$1`,[String(data.reference??'')])).rows[0];
       if(k && status==='VERIFIED') await client.query(`UPDATE users SET status='ACTIVE',updated_at=now() WHERE id=$1`,[k.user_id]);
       await audit(client,{actorType:'SYSTEM',action:'KYC_WEBHOOK_PROCESSED',resourceType:'KYC',metadata:{providerEventId,reference:String(data.reference??''),status}});
       await client.query(`UPDATE webhook_events SET processed_at=now() WHERE id=$1`,[ins.rows[0].id]);
       return {duplicate:false};
     }
     const safePayload={event,eventType:String(body?.['event.type']??''),id:data?.id??null,reference:data?.reference??null,status:data?.status??null,amount:data?.amount??null,currency:data?.currency??null,accountNumber:data?.account_number??null};
     const ins=await client.query(`INSERT INTO webhook_events(provider,event_id,event_type,payload,signature_valid) VALUES('flutterwave',$1,$2,$3,true) ON CONFLICT(provider,event_id) DO NOTHING RETURNING id`,[providerEventId,event||'TRANSFER',safePayload]);
     if(!ins.rows[0])return {duplicate:true};
     return {duplicate:false,eventRowId:ins.rows[0].id};
   });
   if((inserted as any).duplicate)return {ok:true,duplicate:true};

   if(event==='transfer.completed'){
     const providerReference=String(data?.id??'');
     if(!providerReference)return reply.code(400).send({error:'PROVIDER_TRANSFER_ID_REQUIRED'});
     const details=await bank.getTransferDetails(providerReference);
     if(details.status==='PROCESSING')return {ok:true};
     const finalStatus=details.status;
     const outbound=await pool.query(`SELECT id FROM transfers WHERE id=$1 AND provider='FlutterwaveBankProvider'`,[String(data?.reference??'')]);
     if(outbound.rows[0]){
       await withTx(async client=>{await settleTransfer(client,outbound.rows[0].id,finalStatus,providerReference); await client.query(`UPDATE webhook_events SET processed_at=now() WHERE provider='flutterwave' AND event_id=$1`,[providerEventId]);});
       return {ok:true,mode:'outbound'};
     }
     return {ok:true,ignored:true};
   }

   if(event==='charge.completed'){
     if(!bank.getTransactionDetails)return reply.code(503).send({error:'FUNDING_PROVIDER_UNAVAILABLE'});
     const transactionId=String(data?.id??'');
     if(!transactionId)return reply.code(400).send({error:'PROVIDER_TRANSACTION_ID_REQUIRED'});
     const details=await bank.getTransactionDetails(transactionId);
     if(details.status==='PROCESSING')return {ok:true};
     const accountNumber=String(details.accountNumber??data?.account_number??data?.meta?.account_number??'');
     if(!accountNumber)return {ok:true,ignored:true};
     const account=await pool.query(`SELECT a.id,a.currency,la.id AS ledger_account_id FROM accounts a JOIN ledger_accounts la ON la.account_id=a.id WHERE a.account_number=$1 AND a.status='ACTIVE' AND la.account_type='CUSTOMER_WALLET'`,[accountNumber]);
     if(!account.rows[0])return {ok:true,ignored:true};
     const dAmount=String(details.amount??data?.amount??'0'); const dCurrency=String(details.currency??data?.currency??'NGN');
     if(dCurrency!=='NGN')return reply.code(400).send({error:'UNSUPPORTED_FUNDING_CURRENCY'});
     if(details.status!=='SUCCESS')return {ok:true};
     const providerRef=String(details.providerReference);
     await withTx(async client=>{
       const ins=await client.query(`INSERT INTO inbound_transfers(account_id,provider,provider_reference,provider_event_id,amount,currency,status,source_account_number,source_name,narration) VALUES($1,'flutterwave',$2,$3,$4,$5,'SUCCESS',$6,$7,$8) ON CONFLICT(provider,provider_reference) DO NOTHING RETURNING id`,[account.rows[0].id,providerRef,providerEventId,dAmount,dCurrency,String(data?.account_number??details.accountNumber??''),String(data?.fullname??details.accountName??''),String(data?.narration??details.reference??'')]);
       if(!ins.rows[0]){await client.query(`UPDATE webhook_events SET processed_at=now() WHERE provider='flutterwave' AND event_id=$1`,[providerEventId]);return;}
       const clearing=(await client.query(`INSERT INTO ledger_accounts(code,currency,account_type) VALUES('PROVIDER_CLEARING:flutterwave:NGN','NGN','PROVIDER_CLEARING') ON CONFLICT(code) DO UPDATE SET code=EXCLUDED.code RETURNING id`)).rows[0];
       await createBalancedJournal(client,{referenceType:'INBOUND_TRANSFER',referenceId:ins.rows[0].id,description:'Customer account funding',currency:'NGN',lines:[{ledgerAccountId:clearing.id,type:'DEBIT',amount:dAmount},{ledgerAccountId:account.rows[0].ledger_account_id,type:'CREDIT',amount:dAmount}]});
       await client.query(`UPDATE accounts SET ledger_balance=ledger_balance+$1,available_balance=available_balance+$1,updated_at=now() WHERE id=$2`,[dAmount,account.rows[0].id]);
       await audit(client,{actorType:'SYSTEM',action:'ACCOUNT_FUNDED',resourceType:'ACCOUNT',resourceId:account.rows[0].id,metadata:{provider:'flutterwave',providerReference:providerRef,amount:dAmount,currency:dCurrency}});
       await client.query(`UPDATE webhook_events SET processed_at=now() WHERE provider='flutterwave' AND event_id=$1`,[providerEventId]);
     });
     return {ok:true,mode:'inbound'};
   }
   return {ok:true};
 });

 app.post('/webhooks/provider/transfer',async(req,reply)=>{
   const raw=JSON.stringify(req.body??{});const sig=String(req.headers['x-webhook-signature']??'');const expected=crypto.createHmac('sha256',env.WEBHOOK_SECRET).update(raw).digest('hex');try{if(!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(sig)))return reply.code(401).send({error:'INVALID_SIGNATURE'})}catch{return reply.code(401).send({error:'INVALID_SIGNATURE'})}
   const body=req.body as any;const eventId=String(body?.eventId||'');if(!eventId)return reply.code(400).send({error:'EVENT_ID_REQUIRED'});
   const result=await withTx(async client=>{const ins=await client.query(`INSERT INTO webhook_events(provider,event_id,event_type,payload,signature_valid) VALUES('mock',$1,$2,$3,true) ON CONFLICT(provider,event_id) DO NOTHING RETURNING id`,[eventId,String(body.eventType||'TRANSFER_STATUS'),body]);if(!ins.rows[0])return {duplicate:true};const status=body.status==='SUCCESS'?'SUCCESS':body.status==='FAILED'?'FAILED':body.status==='REVERSED'?'REVERSED':null;if(!status)throw Object.assign(new Error('UNSUPPORTED_WEBHOOK_STATUS'),{statusCode:400});await settleTransfer(client,String(body.transferId),status,body.providerReference);await client.query(`UPDATE webhook_events SET processed_at=now() WHERE id=$1`,[ins.rows[0].id]);await audit(client,{actorType:'SYSTEM',action:'WEBHOOK_PROCESSED',resourceType:'TRANSFER',resourceId:String(body.transferId),metadata:{eventId,status}});return {duplicate:false}});return {ok:true,...result}});
}
