import pg from 'pg';
import { env } from './env.js';
const { Pool } = pg;
export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 15 });
export async function withTx<T>(fn:(client:pg.PoolClient)=>Promise<T>):Promise<T>{
  const client=await pool.connect(); try{ await client.query('BEGIN'); const out=await fn(client); await client.query('COMMIT'); return out; }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
