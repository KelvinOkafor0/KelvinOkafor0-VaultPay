import type { FastifyInstance } from 'fastify'; import { env } from '../env.js'; import { pool } from '../db.js';
export async function systemRoutes(app:FastifyInstance){
 app.get('/system/regulatory',async()=>({model:env.REGULATORY_MODEL,status:env.REGULATORY_STATUS,liveMoneyEnabled:env.LIVE_MONEY_ENABLED}));
 app.get('/health',async()=>{await pool.query('SELECT 1');return {status:'ok',service:'vaultpay-api',time:new Date().toISOString()}})
}
