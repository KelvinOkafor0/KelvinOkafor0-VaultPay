import type { PoolClient } from 'pg';

export async function createBalancedJournal(client:PoolClient,input:{referenceType:string;referenceId:string;description?:string;currency:string;lines:Array<{ledgerAccountId:string;type:'DEBIT'|'CREDIT';amount:string}>}){
 const debits=input.lines.filter(x=>x.type==='DEBIT').reduce((s,x)=>s+Number(x.amount),0);
 const credits=input.lines.filter(x=>x.type==='CREDIT').reduce((s,x)=>s+Number(x.amount),0);
 if(debits<=0 || Math.abs(debits-credits)>0.000001) throw new Error('UNBALANCED_JOURNAL');
 const j=await client.query(`INSERT INTO journal_entries(reference_type,reference_id,description) VALUES($1,$2,$3) RETURNING id`,[input.referenceType,input.referenceId,input.description??null]);
 for(const line of input.lines){await client.query(`INSERT INTO journal_lines(journal_entry_id,ledger_account_id,entry_type,amount,currency) VALUES($1,$2,$3,$4,$5)`,[j.rows[0].id,line.ledgerAccountId,line.type,line.amount,input.currency])}
 return j.rows[0].id;
}
