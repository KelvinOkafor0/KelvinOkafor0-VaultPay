import type { FastifyReply, FastifyRequest } from 'fastify';
export type AuthUser = { id:string; phone:string; email?:string|null; status:string };
export type AuthedRequest = FastifyRequest & { user: AuthUser };
export function requireUser(req:FastifyRequest, reply:FastifyReply): req is AuthedRequest {
  if (!(req as any).user) { reply.code(401).send({error:'UNAUTHORIZED'}); return false; }
  return true;
}
