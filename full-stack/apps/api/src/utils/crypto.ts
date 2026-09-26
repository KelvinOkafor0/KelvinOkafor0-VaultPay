import crypto from 'node:crypto';
export const sha256=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
export const randomToken=()=>crypto.randomBytes(48).toString('base64url');
