import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';
import { env } from '../env.js';
import { randomToken, sha256 } from '../utils/crypto.js';

const registerSchema=z.object({phone:z.string().min(7),email:z.string().email().optional(),password:z.string().min(10),firstName:z.string().min(1).max(100),lastName:z.string().min(1).max(100)});
const loginSchema=z.object({login:z.string().min(3),password:z.string().min(1)});
const signAccess=(u:any)=>jwt.sign({id:u.id,phone:u.phone,email:u.email,status:u.status,role:u.role??'CUSTOMER'},env.JWT_ACCESS_SECRET,{expiresIn:env.ACCESS_TTL as any});
export async function authRoutes(app:FastifyInstance){
 app.post('/auth/register',async(req,reply)=>{
  const b=registerSchema.parse(req.body); const hash=await argon2.hash(b.password);
  const client=await pool.connect(); try{await client.query('BEGIN'); const r=await client.query(`INSERT INTO users(phone,email,password_hash,first_name,last_name,status) VALUES($1,$2,$3,$4,$5,'ACTIVE') RETURNING id,phone,email,status,first_name,last_name`,[b.phone,b.email??null,hash,b.firstName,b.lastName]); const u=r.rows[0]; await client.query(`INSERT INTO kyc_profiles(user_id,status) VALUES($1,'NOT_STARTED')`,[u.id]); await client.query('COMMIT'); return reply.code(201).send({user:u,accessToken:signAccess(u)});}catch(e:any){await client.query('ROLLBACK'); if(e.code==='23505') return reply.code(409).send({error:'USER_EXISTS'}); throw e}finally{client.release()}
 });
 app.post('/auth/login',async(req,reply)=>{
  const b=loginSchema.parse(req.body); const r=await pool.query(`SELECT id,phone,email,password_hash,status,role FROM users WHERE email=$1 OR phone=$1`,[b.login]); const u=r.rows[0]; if(!u||!(await argon2.verify(u.password_hash,b.password))) return reply.code(401).send({error:'INVALID_CREDENTIALS'});
  if(u.status!=='ACTIVE') return reply.code(403).send({error:'USER_NOT_ACTIVE'});
  const raw=randomToken(); await pool.query(`INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+$3::interval)`,[u.id,sha256(raw),env.REFRESH_TTL]);
  reply.setCookie('vp_refresh',raw,{httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'lax',path:'/api/v1/auth'});
  return {accessToken:signAccess(u),user:{id:u.id,phone:u.phone,email:u.email,status:u.status}};
 });
 app.post('/auth/logout',async(req,reply)=>{const token=(req as any).cookies?.vp_refresh; if(token) await pool.query('UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1',[sha256(token)]); reply.clearCookie('vp_refresh',{path:'/api/v1/auth'}); return {ok:true}});
 app.post('/auth/refresh',async(req,reply)=>{const token=(req as any).cookies?.vp_refresh; if(!token)return reply.code(401).send({error:'NO_REFRESH_TOKEN'}); const r=await pool.query(`SELECT rt.*,u.id,u.phone,u.email,u.status FROM refresh_tokens rt JOIN users u ON u.id=rt.user_id WHERE rt.token_hash=$1 AND rt.revoked_at IS NULL AND rt.expires_at>now()`,[sha256(token)]); const row=r.rows[0]; if(!row)return reply.code(401).send({error:'INVALID_REFRESH_TOKEN'}); const next=randomToken(); await pool.query('UPDATE refresh_tokens SET revoked_at=now() WHERE id=$1',[row.id]); await pool.query(`INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+$3::interval)`,[row.user_id,sha256(next),env.REFRESH_TTL]); reply.setCookie('vp_refresh',next,{httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'lax',path:'/api/v1/auth'}); return {accessToken:signAccess(row)};
 });
}
