import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';

export interface Agent {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const JWT_EXPIRES = '7d';

/** Stable across serverless cold starts so JWTs stay valid when /tmp SQLite is recreated. */
export const DEFAULT_ADMIN_ID = 'a0000000-0000-4000-8000-000000000001';
const DEFAULT_ADMIN_EMAIL = 'admin@example.com';

function stripPassword(agent: Agent & { password_hash?: string }): Agent {
  const { password_hash: _, ...safe } = agent;
  return safe;
}

export function getAgentByEmail(email: string): (Agent & { password_hash: string }) | undefined {
  return db.prepare('SELECT * FROM agents WHERE email = ?').get(email.toLowerCase()) as
    | (Agent & { password_hash: string })
    | undefined;
}

export function getAgentById(id: string): Agent | undefined {
  const row = db.prepare('SELECT id, email, name, role, created_at FROM agents WHERE id = ?').get(id);
  return row as Agent | undefined;
}

export function getAllAgents(): Agent[] {
  return db.prepare('SELECT id, email, name, role, created_at FROM agents ORDER BY name').all() as Agent[];
}

export async function createAgent(email: string, name: string, password: string, role = 'agent'): Promise<Agent> {
  const id = uuid();
  const hash = await bcrypt.hash(password, 10);
  db.prepare('INSERT INTO agents (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(
    id, email.toLowerCase(), name, hash, role
  );
  return getAgentById(id)!;
}

export async function verifyPassword(email: string, password: string): Promise<Agent | null> {
  const agent = getAgentByEmail(email);
  if (!agent) return null;
  const valid = await bcrypt.compare(password, agent.password_hash);
  if (!valid) return null;
  return stripPassword(agent);
}

export function signToken(agent: Agent): string {
  return jwt.sign({ sub: agent.id, email: agent.email, name: agent.name, role: agent.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
}

/**
 * Validate JWT. On Vercel, each cold start can get a fresh /tmp DB, so the agent
 * row from a previous instance may be missing — fall back to JWT claims / email.
 */
export function verifyToken(token: string): Agent | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      sub: string;
      email?: string;
      name?: string;
      role?: string;
    };

    const byId = getAgentById(payload.sub);
    if (byId) return byId;

    if (payload.email) {
      const byEmail = getAgentByEmail(payload.email);
      if (byEmail) return stripPassword(byEmail);
    }

    if (payload.email && payload.name) {
      try {
        db.prepare(
          `INSERT INTO agents (id, email, name, password_hash, role)
           VALUES (?, ?, ?, '', ?)
           ON CONFLICT(email) DO NOTHING`
        ).run(payload.sub, payload.email.toLowerCase(), payload.name, payload.role || 'agent');
      } catch {
        // ignore rehydrate races
      }
      const rehydrated = getAgentById(payload.sub);
      if (rehydrated) return rehydrated;
      const emailRow = payload.email ? getAgentByEmail(payload.email) : undefined;
      if (emailRow) return stripPassword(emailRow);

      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role || 'agent',
        created_at: new Date().toISOString(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function seedDefaultAgent() {
  const existing = getAgentByEmail(DEFAULT_ADMIN_EMAIL);
  if (existing) return;

  const hash = await bcrypt.hash('changeme123', 10);
  db.prepare('INSERT INTO agents (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(
    DEFAULT_ADMIN_ID,
    DEFAULT_ADMIN_EMAIL,
    'Admin',
    hash,
    'admin'
  );
  console.log('Default admin agent seeded (see README for first-login credentials).');
}
