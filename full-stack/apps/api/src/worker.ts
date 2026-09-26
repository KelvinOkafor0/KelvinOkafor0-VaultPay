import { pool } from './db.js';
import { getBankProvider } from './services/providers.js';
import { audit } from './utils/audit.js';
import { settleTransfer } from './services/transferSettlement.js';

const bank=getBankProvider();

async function claimOutbox(){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const e=(await client.query(`SELECT * FROM outbox_events WHERE published_at IS NULL AND available_at<=now() AND (processing_at IS NULL OR processing_at < now()-interval '5 minutes') ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`)).rows[0];
  if(!e){await client.query('COMMIT');return null}
  await client.query(`UPDATE outbox_events SET processing_at=now(),attempts=attempts+1 WHERE id=$1`,[e.id]);
  await client.query('COMMIT'); return e;
 }catch(err){await client.query('ROLLBACK');throw err}finally{client.release()}
}

async function handleOutbox(e:any){
 if(e.event_type!=='TRANSFER_AUTHORIZED'){
   await pool.query(`UPDATE outbox_events SET published_at=now(),processing_at=NULL WHERE id=$1`,[e.id]);
   return;
 }
 const transferId=String(e.aggregate_id);
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const t=(await client.query(`SELECT t.*,b.bank_code,b.account_number FROM transfers t JOIN beneficiaries b ON b.id=t.beneficiary_id WHERE t.id=$1 FOR UPDATE`,[transferId])).rows[0];
  if(!t || !['AUTHORIZED','SUBMITTED'].includes(t.status)){await client.query(`UPDATE outbox_events SET published_at=now(),processing_at=NULL WHERE id=$1`,[e.id]);await client.query('COMMIT');return;}
  if(t.status==='AUTHORIZED') await client.query(`UPDATE transfers SET status='SUBMITTED',updated_at=now() WHERE id=$1`,[t.id]);
  await client.query('COMMIT');
  let res;
  try{res=await bank.submitTransfer({bankCode:t.bank_code,accountNumber:t.account_number,amount:String(t.amount),reference:String(t.id),description:t.description??undefined});}
  catch(error:any){await pool.query(`UPDATE outbox_events SET processing_at=NULL,available_at=now()+interval '5 minutes',last_error=$2 WHERE id=$1`,[e.id,String(error?.message??error)]);const ac=await pool.connect(); try { await ac.query('BEGIN'); await audit(ac,{actorType:'SYSTEM',action:'TRANSFER_PROVIDER_ERROR',resourceType:'TRANSFER',resourceId:t.id,metadata:{error:String(error?.message??error)}}); await ac.query('COMMIT'); } catch { try{await ac.query('ROLLBACK')}catch{} } finally { ac.release(); } return;}
  if(res.status==='FAILED'){
    const c=await pool.connect();try{await c.query('BEGIN');await settleTransfer(c,t.id,'FAILED',res.providerReference);await c.query(`UPDATE outbox_events SET published_at=now(),processing_at=NULL,last_error=NULL WHERE id=$1`,[e.id]);await c.query('COMMIT')}catch(x){await c.query('ROLLBACK');throw x}finally{c.release()}
  }else{
    await pool.query(`UPDATE transfers SET status='PROCESSING',provider_reference=$2,updated_at=now() WHERE id=$1 AND status IN ('SUBMITTED','AUTHORIZED')`,[t.id,res.providerReference]);
    await pool.query(`UPDATE outbox_events SET published_at=now(),processing_at=NULL,last_error=NULL WHERE id=$1`,[e.id]);
  }
 }catch(err){try{await client.query('ROLLBACK')}catch{} throw err}finally{client.release()}
}

async function pollProcessingTransfers(){
 const rows=await pool.query(`SELECT id,provider_reference FROM transfers WHERE status='PROCESSING' AND provider_reference IS NOT NULL ORDER BY updated_at ASC LIMIT 25`);
 for(const t of rows.rows){
  try{
    const details=await bank.getTransferDetails(String(t.provider_reference));
    if(details.status==='PROCESSING')continue;
    const c=await pool.connect();try{await c.query('BEGIN');await settleTransfer(c,t.id,details.status,String(details.providerReference));await c.query('COMMIT')}catch(e){await c.query('ROLLBACK');console.error(e)}finally{c.release()}
  }catch(e){console.error('transfer poll failed',t.id,e)}
 }
}

async function loop(){
 let lastPoll=0;
 for(;;){
  try{const e=await claimOutbox(); if(e)await handleOutbox(e); if(Date.now()-lastPoll>10000){await pollProcessingTransfers();lastPoll=Date.now();}}
  catch(error){console.error(error);await new Promise(r=>setTimeout(r,1000))}
  if(!lastPoll)await new Promise(r=>setTimeout(r,250));
 }
}
loop().catch(e=>{console.error(e);process.exit(1)});
