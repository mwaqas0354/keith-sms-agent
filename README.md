# SMS Sales Agent — AI-Powered Platform

A full-stack AI sales automation platform that handles two-way SMS conversations, syncs with CRM, and provides a real-time management dashboard for sales teams.

## Project Overview

This platform is an intelligent SMS sales agent that engages leads via text message, qualifies opportunities, handles objections, and escalates to human agents when needed. The system includes:

- An **AI conversation engine** powered by OpenAI (with a demo fallback when no API key is configured)
- **Twilio SMS** integration for inbound and outbound messaging
- **Zoho CRM** integration for lead sync, notes, and task notifications
- A **real-time dashboard** for monitoring and managing all conversations
- **Agent authentication** so sales reps can log in, take over conversations, and resume AI

The application runs locally in demo mode without any third-party API keys, making it easy for developers to explore and extend the codebase immediately.

---

## Features

### AI Sales Agent
- Context-aware conversational responses using configurable system prompts
- Sentiment analysis on inbound messages
- Automatic escalation when leads request a human or show negative sentiment
- Customizable outreach templates for new leads

### SMS & Lead Management
- Two-way SMS via Twilio webhooks
- Automatic lead creation from unknown phone numbers
- Conversation threading with full message history
- Deal outcome tracking (won / lost)

### Human Takeover
- Agents can pause AI and reply manually from the dashboard
- Resume AI when the human handoff is complete
- Agent identity recorded on takeover and manual replies

### CRM Integration (Zoho)
- OAuth-based Zoho CRM connection
- Lead sync with `zoho_id` mapping
- Automatic Notes on conversation start
- Automatic Tasks on escalation and human takeover
- Configurable notification toggles

### Dashboard & Analytics
- Live conversation monitoring via WebSocket
- In-app notification bell for escalations and takeovers
- Analytics: success rate, escalation rate, message volume, daily trends
- Demo simulator for testing without real SMS

### Agent & Team Management
- JWT-based authentication
- Role-based access (admin / agent)
- Admin can create additional agent accounts
- Bot training UI for non-technical configuration

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite (better-sqlite3) |
| Real-time | WebSocket (ws) |
| AI | OpenAI API (gpt-4o-mini default) |
| SMS | Twilio |
| CRM | Zoho CRM API |
| Auth | JWT + bcryptjs |

---

## Architecture

```
┌─────────────┐     HTTP/WS      ┌──────────────────┐
│   React     │ ◄──────────────► │  Express API     │
│  Dashboard  │                  │  (port 3001)     │
└─────────────┘                  └────────┬─────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
              ┌──────────┐         ┌──────────┐         ┌──────────┐
              │  SQLite  │         │  OpenAI  │         │  Twilio  │
              │    DB    │         │   API    │         │   SMS    │
              └──────────┘         └──────────┘         └──────────┘
                                          │
                                          ▼
                                    ┌──────────┐
                                    │ Zoho CRM │
                                    └──────────┘
```

### Request Flow (Inbound SMS)

1. Lead sends SMS → Twilio webhook hits `POST /api/webhooks/twilio/sms`
2. Server finds or creates lead by phone number
3. Message stored; AI generates response (or demo fallback)
4. Response sent via Twilio (or logged in demo mode)
5. WebSocket broadcasts update to connected dashboards
6. Optional Zoho Note/Task created on configured events

---

## Folder Structure

```
ai-sms-sales-agent/
├── client/                    # React frontend (Vite)
│   ├── src/
│   │   ├── api.ts             # REST API client
│   │   ├── App.tsx            # Layout, routing, auth gate
│   │   ├── components/        # Reusable UI components
│   │   ├── context/           # AuthContext (JWT session)
│   │   ├── hooks/             # useWebSocket
│   │   └── pages/             # Dashboard, Conversations, Analytics, Settings, Login
│   ├── index.html
│   └── vite.config.ts         # Dev proxy to API
├── server/                    # Express backend
│   ├── src/
│   │   ├── db/                # SQLite schema, seed data
│   │   ├── middleware/        # JWT auth middleware
│   │   ├── models/            # Repository (CRUD)
│   │   ├── routes/            # API routes
│   │   └── services/          # AI, Twilio, Zoho, auth, notifications, conversation
│   ├── data/                  # SQLite database (auto-created, gitignored)
│   └── tsconfig.json
├── .env.example               # Environment variable template
├── package.json               # Root scripts (concurrently)
└── README.md
```

---

## Installation & Setup

### Prerequisites

- **Node.js** 18+ (20+ recommended)
- **npm** 9+

### 1. Clone the repository

```bash
git clone <repository-url>
cd ai-sms-sales-agent
```

### 2. Install dependencies

```bash
npm run install:all
```

This installs root, server, and client packages.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values. The app runs in **demo mode** without API keys.

### 4. Start development servers

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:5173 |
| API | http://localhost:3001/api |
| WebSocket | ws://localhost:3001/ws |
| Health check | http://localhost:3001/api/health |

### 5. First login

On first server start, a default admin account is seeded:

| Field | Value |
|-------|-------|
| Email | `tech@nationwideadvance.com` |
| Password | `tech@nationwideadvance.com` |

**Change this password immediately in production** by creating a new admin and removing the default, or updating the seed logic.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | API server port (default: `3001`) |
| `NODE_ENV` | No | `development` or `production` |
| `JWT_SECRET` | **Yes (prod)** | Secret for signing JWT tokens |
| `OPENAI_API_KEY` | No | OpenAI API key (demo fallback if empty) |
| `OPENAI_MODEL` | No | Model name (default: `gpt-4o-mini`) |
| `TWILIO_ACCOUNT_SID` | No | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | No | Twilio sending number (E.164) |
| `ZOHO_CLIENT_ID` | No | Zoho OAuth client ID |
| `ZOHO_CLIENT_SECRET` | No | Zoho OAuth client secret |
| `ZOHO_REFRESH_TOKEN` | No | Zoho OAuth refresh token |
| `ZOHO_API_DOMAIN` | No | Zoho API domain (default: `https://www.zohoapis.com`) |
| `DEMO_MODE` | No | `true` to enable demo fallbacks (default: `true`) |

Settings can also be configured via the dashboard **Settings** page (stored in SQLite).

---

## Development Workflow

```bash
# Run both frontend and backend
npm run dev

# Run backend only
npm run dev:server

# Run frontend only
npm run dev:client

# Type-check and build for production
npm run build

# Start production server (serves built frontend)
npm start
```

### Vite Dev Proxy

During development, the React app proxies `/api` and `/ws` to the Express server on port 3001. No CORS configuration is needed locally.

### Demo Mode

When `DEMO_MODE=true` or API keys are missing:

- AI uses built-in smart fallback responses
- SMS messages are logged to the console instead of sent
- Zoho operations are skipped with console logs
- Full dashboard functionality remains available

Use the **Demo Panel** on the dashboard to simulate inbound SMS, new leads, and full conversations.

---

## Build & Deployment

### Production Build

```bash
npm run build
```

This builds the React app to `client/dist/` and compiles the server to `server/dist/`.

### Start Production Server

```bash
NODE_ENV=production npm start
```

The Express server serves the built React app and API from a single port.

### Deployment Recommendations

| Component | Suggested Service |
|-----------|-------------------|
| API + Frontend | AWS ECS/Fargate, Railway, Render, Fly.io |
| Database | Migrate SQLite → PostgreSQL for production scale |
| Webhooks | Public HTTPS URL required for Twilio/Zoho |
| Secrets | AWS Secrets Manager, environment variables |
| Static assets | CloudFront CDN (optional, if split from API) |

### Webhook URLs (Production)

Configure these in Twilio and Zoho:

```
POST https://your-domain.com/api/webhooks/twilio/sms
POST https://your-domain.com/api/webhooks/zoho/lead
```

---

## API Documentation

Base URL: `http://localhost:3001/api`

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | API info and available routes |
| `GET` | `/health` | Health check |
| `POST` | `/auth/login` | Agent login `{ email, password }` → `{ token, agent }` |
| `POST` | `/webhooks/twilio/sms` | Twilio inbound SMS webhook |
| `POST` | `/webhooks/zoho/lead` | Zoho new lead webhook |

### Protected Endpoints (Bearer JWT required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/me` | Current agent profile |
| `GET` | `/conversations` | List all conversations |
| `GET` | `/conversations/:id` | Conversation with messages |
| `POST` | `/conversations/:id/reply` | Send human reply `{ body }` |
| `POST` | `/conversations/:id/pause` | Take over (pause AI) |
| `POST` | `/conversations/:id/resume` | Resume AI |
| `POST` | `/conversations/:id/close` | Close deal `{ outcome: "won" \| "lost" }` |
| `GET` | `/analytics` | Dashboard analytics |
| `GET` | `/settings` | Get settings (secrets masked) |
| `PUT` | `/settings` | Update settings |
| `GET` | `/notifications` | List notifications + unread count |
| `POST` | `/notifications/:id/read` | Mark notification read |
| `POST` | `/notifications/read-all` | Mark all read |
| `GET` | `/agents` | List agents |
| `POST` | `/agents` | Create agent (admin only) |
| `POST` | `/demo/inbound-sms` | Simulate inbound SMS |
| `POST` | `/demo/new-lead` | Simulate new lead outreach |
| `POST` | `/demo/simulate-conversation` | Create demo conversation |

### Authentication

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tech@nationwideadvance.com","password":"tech@nationwideadvance.com"}'

# Use token
curl http://localhost:3001/api/conversations \
  -H "Authorization: Bearer <token>"
```

### WebSocket Events

Connect to `ws://localhost:3001/ws`. Events include:

| Event | Description |
|-------|-------------|
| `connected` | Initial connection confirmation |
| `message` | New message in a conversation |
| `conversation_updated` | Conversation status changed |
| `notification` | New in-app notification |

---

## Database

SQLite database is auto-created at `server/data/sales-agent.db` on first run.

### Schema

| Table | Purpose |
|-------|---------|
| `settings` | Key-value configuration store |
| `leads` | Lead contact records |
| `conversations` | Conversation state and metadata |
| `messages` | Individual SMS messages |
| `analytics_events` | Event log for reporting |
| `agents` | Dashboard user accounts |
| `notifications` | In-app notification records |

### Migrations

There is no formal migration framework. Schema is defined in `server/src/db/index.ts` using `CREATE TABLE IF NOT EXISTS`. For production, consider adopting a migration tool (e.g., Drizzle, Knex) when moving to PostgreSQL.

### Seed Data

On first run, `server/src/db/seed.ts` creates sample leads and conversations for demo purposes. A default admin agent is seeded by `server/src/services/auth.ts`.

To reset: delete `server/data/sales-agent.db` and restart the server.

---

## Bot Training

Non-technical users can configure the AI via **Settings → Bot Training**:

- **Company Name** — injected into AI context
- **Products / Services Catalog** — pricing and feature reference
- **System Prompt** — personality, rules, and conversation guidelines
- **Outreach Template** — first message sent to new leads (`{name}` placeholder supported)

Changes take effect on the next AI response. No model fine-tuning is required.

---

## Known Limitations

| Limitation | Notes |
|------------|-------|
| Single-tenant | One organization per deployment; no multi-tenant isolation |
| SQLite | Suitable for development and small deployments; migrate for scale |
| No formal migrations | Schema changes require manual handling |
| Zoho notifications | Notes/Tasks only — not native Zoho push notifications |
| Demo credentials | Default admin password must be changed in production |
| JWT secret | Uses a dev default if `JWT_SECRET` is not set |

---

## Future Improvements

- [ ] PostgreSQL support with migration framework
- [ ] Multi-tenant architecture (org isolation)
- [ ] Email and push notification channels
- [ ] Conversation assignment and queue management
- [ ] OpenAI function calling for structured lead qualification
- [ ] Rate limiting and webhook signature verification
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Docker Compose for local and production deployment
- [ ] Unit and integration test suite
- [ ] Audit log for agent actions

---

## License

Private repository. All rights reserved.
