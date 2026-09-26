import type { FastifyInstance } from 'fastify';
import { requireUser, type AuthedRequest } from '../types.js';
import { pool } from '../db.js';
export async function userRoutes(app:FastifyInstance){
 app.get('/users/me',async(req,reply)=>{if(!requireUser(req,reply))return; const r=await pool.query(`SELECT id,phone,email,status,first_name,last_name,date_of_birth,created_at FROM users WHERE id=$1`,[(req as AuthedRequest).user.id]); return r.rows[0]});
 app.patch('/users/me',async(req,reply)=>{if(!requireUser(req,reply))return; const b=req.body as any; const allowed=['first_name','last_name','date_of_birth']; const sets:string[]=[]; const vals:any[]=[]; for(const k of allowed){if(b?.[k]!==undefined){sets.push(`${k}=$${vals.length+1}`); vals.push(b[k]);}} if(!sets.length)return reply.code(400).send({error:'NO_CHANGES'}); vals.push((req as AuthedRequest).user.id); const r=await pool.query(`UPDATE users SET ${sets.join(',')},updated_at=now() WHERE id=$${vals.length} RETURNING id,phone,email,status,first_name,last_name,date_of_birth`,vals); return r.rows[0];});
}
