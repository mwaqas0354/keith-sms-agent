import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.js';

export interface AuthRequest extends Request {
  agent?: { id: string; email: string; name: string; role: string };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const agent = verifyToken(header.slice(7));
  if (!agent) return res.status(401).json({ error: 'Invalid or expired token' });
  req.agent = agent;
  next();
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const agent = verifyToken(header.slice(7));
    if (agent) req.agent = agent;
  }
  next();
}
