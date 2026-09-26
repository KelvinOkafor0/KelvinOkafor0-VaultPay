import type { PoolClient } from 'pg';
import { createBalancedJournal } from './ledger.js';
import { audit } from '../utils/audit.js';

export async function settleTransfer(client:PoolClient, transferId:string, outcome:'SUCCESS'|'FAILED'|'REVERSED', providerReference?:string){
 const r=await client.query(`SELECT t.*,a.user_id,a.currency AS account_currency,la.id AS customer_ledger_account_id FROM transfers t JOIN accounts a ON a.id=t.source_account_id JOIN ledger_accounts la ON la.account_id=a.id WHERE t.id=$1 FOR UPDATE`,[transferId]);
 const t=r.rows[0]; if(!t) throw Object.assign(new Error('TRANSFER_NOT_FOUND'),{statusCode:404});
 const providerCode=String(t.provider||'provider').toLowerCase();
 if(outcome==='SUCCESS'){
   if(t.status==='SUCCESS') return t;
   if(!['AUTHORIZED','SUBMITTED','PROCESSING'].includes(t.status)) throw Object.assign(new Error('INVALID_TRANSFER_STATE'),{statusCode:409});
   const clearing=(await client.query(`INSERT INTO ledger_accounts(code,currency,account_type) VALUES($1,$2,'PROVIDER_CLEARING') ON CONFLICT(code) DO UPDATE SET code=EXCLUDED.code RETURNING id`,[`PROVIDER_CLEARING:${providerCode}:${t.currency}`,t.currency])).rows[0];
   await createBalancedJournal(client,{referenceType:'TRANSFER',referenceId:t.id,description:'Completed bank transfer',currency:t.currency,lines:[{ledgerAccountId:t.customer_ledger_account_id,type:'DEBIT',amount:String(t.amount)},{ledgerAccountId:clearing.id,type:'CREDIT',amount:String(t.amount)}]});
   await client.query(`UPDATE accounts SET ledger_balance=ledger_balance-$1,updated_at=now() WHERE id=$2`,[t.amount,t.source_account_id]);
   return (await client.query(`UPDATE transfers SET status='SUCCESS',provider_reference=COALESCE($2,provider_reference),updated_at=now() WHERE id=$1 RETURNING *`,[t.id,providerReference??null])).rows[0];
 }
 if(outcome==='FAILED'){
   if(t.status==='FAILED') return t;
   if(['SUCCESS','REVERSED','REFUNDED'].includes(t.status)) throw Object.assign(new Error('INVALID_TRANSFER_STATE'),{statusCode:409});
   await client.query(`UPDATE accounts SET available_balance=available_balance+$1,updated_at=now() WHERE id=$2`,[t.amount,t.source_account_id]);
   return (await client.query(`UPDATE transfers SET status='FAILED',provider_reference=COALESCE($2,provider_reference),updated_at=now() WHERE id=$1 RETURNING *`,[t.id,providerReference??null])).rows[0];
 }
 if(t.status==='REVERSED') return t;
 if(t.status!=='SUCCESS') throw Object.assign(new Error('INVALID_TRANSFER_STATE'),{statusCode:409});
 const clearing=(await client.query(`INSERT INTO ledger_accounts(code,currency,account_type) VALUES($1,$2,'PROVIDER_CLEARING') ON CONFLICT(code) DO UPDATE SET code=EXCLUDED.code RETURNING id`,[`PROVIDER_CLEARING:${providerCode}:${t.currency}`,t.currency])).rows[0];
 await createBalancedJournal(client,{referenceType:'TRANSFER_REVERSAL',referenceId:t.id,description:'Reversal of bank transfer',currency:t.currency,lines:[{ledgerAccountId:clearing.id,type:'DEBIT',amount:String(t.amount)},{ledgerAccountId:t.customer_ledger_account_id,type:'CREDIT',amount:String(t.amount)}]});
 await client.query(`UPDATE accounts SET ledger_balance=ledger_balance+$1,available_balance=available_balance+$1,updated_at=now() WHERE id=$2`,[t.amount,t.source_account_id]);
 const out=(await client.query(`UPDATE transfers SET status='REVERSED',provider_reference=COALESCE($2,provider_reference),updated_at=now() WHERE id=$1 RETURNING *`,[t.id,providerReference??null])).rows[0];
 await audit(client,{actorType:'SYSTEM',action:'TRANSFER_REVERSED',resourceType:'TRANSFER',resourceId:t.id,metadata:{providerReference}}); return out;
}
