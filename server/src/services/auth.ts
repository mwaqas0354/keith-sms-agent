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

const JWT_SECRET = process.env.JWT_SECRET || 'keith-demo-secret-change-in-production';
const JWT_EXPIRES = '7d';

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
  const { password_hash: _, ...safe } = agent;
  return safe;
}

export function signToken(agent: Agent): string {
  return jwt.sign({ sub: agent.id, email: agent.email, name: agent.name, role: agent.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
}

export function verifyToken(token: string): Agent | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    return getAgentById(payload.sub) ?? null;
  } catch {
    return null;
  }
}

export async function seedDefaultAgent() {
  const count = db.prepare('SELECT COUNT(*) as c FROM agents').get() as { c: number };
  if (count.c > 0) return;
  await createAgent('admin@keith.com', 'Admin', 'keith2024', 'admin');
  console.log('Default admin agent seeded (see README for first-login credentials).');
}
