import type { FastifyInstance } from 'fastify'; import { pool } from '../db.js';
export async function systemRoutes(app:FastifyInstance){app.get('/health',async()=>{await pool.query('SELECT 1');return {status:'ok',service:'vaultpay-api',time:new Date().toISOString()}})}
