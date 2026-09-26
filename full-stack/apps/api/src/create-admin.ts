import argon2 from 'argon2'; import { pool } from './db.js';
const [,,email='admin@vaultpay.local',phone='+2348000000000',password='ChangeMe-Admin-12345!']=process.argv;
const hash=await argon2.hash(password);
await pool.query(`INSERT INTO users(phone,email,password_hash,status,role,first_name,last_name) VALUES($1,$2,$3,'ACTIVE','ADMIN','VaultPay','Admin') ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,role='ADMIN',status='ACTIVE'`,[phone,email,hash]);
console.log(`Admin ready: ${email}`); await pool.end();
