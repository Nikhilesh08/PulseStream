# PulseStream troubleshooting

## 1. The browser opens, but the backend is not working

Check:

```text
http://localhost:5000/health
```

A healthy response contains:

```json
{
  "status": "OK",
  "mongo": "connected",
  "redis": "connected"
}
```

If the backend exits during startup, read the first MongoDB or Redis error in the backend terminal.

## 2. MongoDB connection errors

You do not need to define `MONGODB_URI` for a local MongoDB server. The backend defaults to:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/pulsestream
```

For MongoDB Atlas, set your real Atlas connection string in `backend/.env` and make sure the client IP is allowed in Atlas Network Access.

The server waits up to 30 seconds for MongoDB selection so a sleeping Atlas cluster has time to wake up.

## 3. Redis / BullMQ errors

You do not need to define `REDIS_URL` for a local Redis server. The backend defaults to:

```env
REDIS_URL=redis://127.0.0.1:6379
```

For Upstash:

```env
REDIS_URL=rediss://default:<password>@<host>:<port>
```

If Redis cannot be reached, events can be written to MongoDB but the BullMQ workers will not process them.

On startup you should see messages similar to:

```text
✅ Redis connected (local).
📦 Redis is ready for BullMQ jobs.
📦 BullMQ "fanout-queue" is ready to receive jobs!
```

For Windows, Upstash is often simpler than maintaining a local Redis service.

## 4. Email is failing

Email requires SMTP credentials:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
```

Port `465` uses TLS directly. Port `587` uses STARTTLS and is also supported automatically.

Gmail accounts normally require a 2-Step Verification-enabled App Password rather than the regular account password.

Email is optional for testing the in-app pipeline. Without SMTP credentials, the email worker records a failed delivery with `SMTP_NOT_CONFIGURED`; in-app delivery continues to work.

## 5. Price drops are not producing notifications

The product must have an active Follow document before the event is triggered. The development admin is automatically subscribed to all five `prod_*` demo topics on a fresh/empty admin subscription set, so the normal admin test no longer depends on manually creating the first Follow record.

Use this sequence:

```text
Shopper Portal
  -> enable In-App Push / Email Alert
  -> Admin Center
  -> click -$50 (Drop)
```

Check the backend logs for:

```text
[Fanout Worker] Found N active followers.
```

If it says `Found 0 active followers`, nobody is subscribed to that product/topic.

## 6. The Admin Center is not visible

Admin authorization is enforced server-side. In development the seeded admin account is:

```text
nikhileshkumar317@gmail.com / test1234
```

The server returns `isAdmin: true` for configured administrator emails. The UI uses that flag instead of maintaining its own list of admin emails.

## 7. Retry button does nothing

This was a functional bug in the previous JavaScript conversion. The current version fixes it.

`POST /api/analytics/retry/:id` now:

1. Loads the failed Delivery and original Event.
2. Resets the Delivery to `pending`.
3. Re-injects the job into either `email-queue` or `inapp-queue`.
4. Lets the normal worker process it again.

## 8. Old notifications do not remain forever

In-app notifications have a MongoDB TTL index and are automatically removed 30 days after creation.

## 9. No TypeScript files remain

This conversion is intentionally JavaScript-only. The codebase contains `.js` and `.jsx` source files and uses CommonJS on the backend and ES modules on the Vite frontend.
