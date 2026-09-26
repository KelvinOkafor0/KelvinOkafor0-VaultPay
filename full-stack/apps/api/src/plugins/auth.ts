import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
export default fp(async app=>{
 app.decorateRequest('user',null);
 app.addHook('preHandler',async(req:any)=>{
   const h=req.headers.authorization as string|undefined;
   if(!h?.startsWith('Bearer ')) return;
   try{ req.user=jwt.verify(h.slice(7),env.JWT_ACCESS_SECRET) as any }catch{ }
 });
});
