import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initDatabase } from './db/index.js';
import { seedDatabase } from './db/seed.js';
import { seedDefaultAgent } from './services/auth.js';
import apiRouter from './routes/api.js';
import { setBroadcast } from './services/conversation.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3001', 10);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3001'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', apiRouter);

// Serve frontend in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

// WebSocket
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.send(JSON.stringify({ event: 'connected', data: { message: 'Connected to Keith Sales Agent' } }));
});

setBroadcast((event, data) => {
  const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
});

// Initialize
void (async () => {
  initDatabase();
  seedDatabase();
  await seedDefaultAgent();

  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║     Keith AI Sales Agent - Server Running        ║
╠══════════════════════════════════════════════════╣
║  API:       http://localhost:${PORT}/api           ║
║  WebSocket: ws://localhost:${PORT}/ws              ║
║  Dashboard: http://localhost:5173                ║
║  Mode:      ${process.env.DEMO_MODE !== 'false' ? 'DEMO (no API keys needed)' : 'PRODUCTION'}              ║
╚══════════════════════════════════════════════════╝
    `);
  });
})();

export default app;
