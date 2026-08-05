# ⚡ PulseStream — Real-Time Notification & Event Fanout System

PulseStream is a topic-based pub/sub notification engine. Users subscribe ("follow") topics, and when an event is triggered, the system fans that event out to every subscriber across multiple channels — email and real-time in-app alerts — with automatic retries, failure tracking, and an admin dashboard for observability.

## 🚀 Features

- 📡 **Topic-based pub/sub** — users follow topics and choose per-channel delivery (email / in-app)
- ⚙️ **Event fanout engine** — one triggered event is expanded into a job per follower, per channel
- 📬 **Multi-channel delivery** — HTML emails (Nodemailer) and real-time in-app alerts (Socket.io)
- 🧵 **Background job processing** with BullMQ + Redis (Upstash) — dedicated queues for fanout, email, and in-app delivery
- 🔁 **Automatic retries** with exponential backoff on failed jobs
- 💀 **Dead-letter tracking** — failed deliveries are recorded with smart fault categorization (e.g. invalid email, quota exceeded, infrastructure error)
- ♻️ **One-click retry/resurrection** of failed deliveries from the dashboard
- 📊 **Admin analytics dashboard** — live success/failure/pending counts and success rate via MongoDB aggregation
- 🔔 **Real-time in-app bell notifications** delivered instantly over WebSockets to online users
- 🔐 JWT authentication with signup/login/forgot-password/reset-password flows
- 🧹 Self-healing — orphaned subscriptions (deleted users) are automatically cleaned up during fanout

## 🛠️ Tech Stack

| Layer      | Technology                                              |
|------------|-----------------------------------------------------------|
| Frontend   | React 19, TypeScript, Vite, TailwindCSS                   |
| Backend    | Node.js, Express 5, TypeScript                             |
| Realtime   | Socket.io                                                   |
| Queues     | BullMQ + Redis (Upstash)                                    |
| Database   | MongoDB (Mongoose)                                           |
| Email      | Nodemailer (SMTP)                                             |
| Auth       | JWT + bcrypt                                                    |

## 🏗️ Architecture

```
Client triggers event → Event saved to MongoDB
        │
        ▼
  fanout-queue (BullMQ)
        │  fanout.worker finds all Followers of the topic
        │
   ┌────┴─────┐
   ▼          ▼
email-queue  inapp-queue
   │            │
email.worker  inapp.worker
   │            │
Nodemailer   Notification saved + Socket.io emit to user's room
   │            │
   ▼            ▼
Delivery record updated (success / failed) → visible on Admin Dashboard
```

## 📁 Project Structure

```
PulseStream/
├── backend/
│   └── src/
│       ├── config/       # db, redis, socket.io, mail (nodemailer), env
│       ├── controllers/  # notification & analytics business logic
│       ├── middleware/   # JWT auth guard
│       ├── models/       # User, Topic, Follow, Event, Notification, Delivery
│       ├── queues/       # BullMQ queue definitions (fanout, email, inapp)
│       ├── routes/       # /api/auth, /api/users, /api/{topics,follows,events,notifications}, /api/analytics
│       └── workers/      # BullMQ workers that process each queue
├── frontend/
│   └── src/
│       ├── components/   # AdminDashboard, UserPanel, Navbar
│       ├── hooks/        # useSocket — connects & listens for live notifications
│       └── services/     # axios API client
└── package.json          # root scripts (runs backend + frontend concurrently)
```

## ⚙️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Nikhilesh08/PulseStream.git
cd PulseStream
```

### 2. Set up environment variables

**`backend/.env`**

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
REDIS_URL=your_upstash_redis_url
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_smtp_email
SMTP_PASS=your_smtp_app_password
```

**`frontend/.env`**

```env
VITE_API_URL=http://localhost:5000
```

### 3. Install all dependencies

```bash
npm run install:all
```

### 4. Run in development (backend + frontend together)

```bash
npm run dev
```

### 5. Build for production

```bash
npm run build
```

## 📄 License

This project currently has no license file.

## 🙌 Acknowledgements

Built with Node.js, TypeScript, BullMQ, Redis, Socket.io, and MongoDB.
