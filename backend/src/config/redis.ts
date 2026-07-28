import Redis from "ioredis";
import dotenv from "dotenv";
import path from "path";

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error(
    "❌ CRITICAL ERROR: REDIS_URL is not defined in your .env file!",
  );
  process.exit(1);
}

// Upstash requires TLS/SSL. Passing `maxRetriesPerRequest: null` is required by BullMQ!
export const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  tls: {
    rejectUnauthorized: false, // Helps avoid SSL certificate handshake issues on Windows
  },
});

redisConnection.on("connect", () => {
  console.log("✅ Redis Connected Successfully to Upstash!");
});

redisConnection.on("error", (err) => {
  console.error("❌ Redis Connection Error:", err.message);
});
