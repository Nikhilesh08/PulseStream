# ⚡ PulseStream — Real-Time Notification & Event Fanout System

PulseStream is a topic-based pub/sub notification engine. Users subscribe to products/topics and choose notification channels. When an event is triggered, the system fans it out to the matching subscribers through dedicated BullMQ queues for email and in-app delivery.

## Features

- Topic-based subscriptions with independent email and in-app channels
- Event fan-out through BullMQ + Redis
- Dedicated email and in-app workers
- Exponential-backoff retries for background jobs
- MongoDB delivery records for pending/success/failed tracking
- Dead-letter style failure view with fault classification
- One-click re-queue of failed deliveries
- Real-time Socket.io notifications
- JWT authentication with bcrypt password hashing
- Password-reset tokens stored as SHA-256 hashes
- Automatic cleanup of subscriptions belonging to deleted users
- Admin analytics backed by MongoDB aggregation
- 30-day TTL for persisted in-app notifications

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, JavaScript, Vite, TailwindCSS |
| Backend | Node.js, Express, JavaScript |
| Realtime | Socket.io |
| Queues | BullMQ + Redis / Upstash Redis |
| Database | MongoDB + Mongoose |
| Email | Nodemailer + SMTP |
| Auth | JWT + bcrypt |

Everything in this version is JavaScript. There are no `.ts` or `.tsx` source files.

## Architecture

```text
Admin triggers price-drop event
        │
        ▼
     MongoDB Event
        │
        ▼
   fanout-queue (BullMQ)
        │
        ├───────────────┐
        ▼               ▼
  email-queue      inapp-queue
        │               │
        ▼               ▼
 email.worker     inapp.worker
        │               │
        ▼               ▼
  SMTP delivery    MongoDB Notification
        │               │
        └───────┬───────┘
                ▼
        Delivery record
        pending/success/failed
                │
                ▼
        Admin analytics UI
```

## Project Structure

```text
PulseStream-js/
├── backend/
│   ├── src/
│   │   ├── config/       # MongoDB, Redis, Socket.io, SMTP
│   │   ├── controllers/  # event/notification logic
│   │   ├── middleware/   # JWT authentication + admin authorization
│   │   ├── models/       # User, Topic, Follow, Event, Notification, Delivery
│   │   ├── queues/       # BullMQ queue definitions
│   │   ├── routes/       # auth, users, notifications, analytics
│   │   └── workers/      # fanout, email and in-app workers
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/  # Navbar, UserPanel, AdminDashboard
│   │   ├── hooks/       # Socket.io integration
│   │   └── services/    # Axios API client
│   ├── .env.example
│   └── package.json
├── package.json
└── TROUBLESHOOTING.md
```

## Requirements

Use Node.js 20.19+ (Node 22 LTS is recommended). You also need MongoDB and Redis reachable from the backend.

For Redis you can either run Redis locally or use Upstash. Upstash is convenient on Windows because it removes the need to maintain a local Redis service.

For email testing you need SMTP credentials. Gmail requires an App Password rather than the normal account password. Email configuration is optional when testing only in-app notifications.

## Setup

### 1. Install dependencies

From the project root:

```bash
npm run install:all
```

This installs root, backend, and frontend dependencies.

### 2. Configure backend

For the core local demo, `backend/.env` is optional because the backend has safe development defaults for MongoDB, Redis, and JWT signing. You only need `backend/.env` when using Atlas/Upstash, changing the admin credentials, or enabling real SMTP email delivery.

When you do need it, copy:

```text
backend/.env.example -> backend/.env
```

A local MongoDB/Redis setup can use:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/pulsestream
REDIS_URL=redis://127.0.0.1:6379
FRONTEND_URL=http://localhost:5173
```

For Upstash, replace `REDIS_URL` with the `rediss://...` URL from the Upstash console.

### 3. Configure frontend

`frontend/.env` is also optional for the local demo. The Vite client defaults to `http://localhost:5000`.

When you do need it, copy:

```text
frontend/.env.example -> frontend/.env
```

The default value is:

```env
VITE_API_URL=http://localhost:5000
```

### 4. Start the application

Run both services together:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:backend
npm run dev:frontend
```

Frontend:

```text
http://localhost:5173
```

Backend health check:

```text
http://localhost:5000/health
```

The health endpoint reports MongoDB and Redis connection state.

## Development admin account

In development, the backend automatically creates this admin account when it does not already exist:

```text
Email:    nikhileshkumar317@gmail.com
Password: test1234
```

You can override the seeded account with `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` in `backend/.env`.

The frontend does not hard-code the administrator's email. The backend includes an `isAdmin` flag in the authenticated user response, and protected admin routes enforce authorization server-side.

## Demo flow

1. Start MongoDB and Redis (or configure Upstash Redis).
2. Run `npm run dev`.
3. Open the Shopper Portal and sign in with the development admin account. The development admin is automatically subscribed to all five demo products with both channels on a fresh demo database.
4. You can still use `ARM ALL TRIGGERS` to restore all five subscriptions manually.
5. Open `Admin Center`.
6. Click `-$50 (Drop)` for that same product.
7. Watch the BullMQ workers process the event.
8. In-app delivery appears immediately through Socket.io and is persisted in MongoDB.
9. Email delivery is processed by the email worker when SMTP credentials are configured.
10. Admin metrics update from the MongoDB `Delivery` collection.

## Important implementation details

The fan-out worker creates a `Delivery` record before queuing each channel. Delivery records use a compound unique index on `eventId + userId + channel`, preventing duplicate receipt records.

Socket.io connections are authenticated with the same JWT used by the REST API. Each socket is automatically placed in its authenticated user's room.

Failed delivery retry is a real BullMQ re-queue operation; it does not merely change the database status back to `pending`.

## Build

```bash
npm run build
```

This builds the Vite frontend.

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for the common local MongoDB/Redis/SMTP issues and the expected startup logs.

## License

No license file is currently included.
