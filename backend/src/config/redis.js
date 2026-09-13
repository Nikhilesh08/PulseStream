const Redis = require("ioredis");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const redisUrl = new URL(REDIS_URL);

const isTls = redisUrl.protocol === "rediss:";

const redisHost = redisUrl.hostname;
const redisPort = Number(redisUrl.port) || 6379;

const redisUsername = redisUrl.username
  ? decodeURIComponent(redisUrl.username)
  : undefined;

const redisPassword = redisUrl.password
  ? decodeURIComponent(redisUrl.password)
  : undefined;

console.log(
  `🔌 Redis target: ${isTls ? "TLS" : "TCP"} ${redisHost}:${redisPort}`,
);

function getRedisConnectionOptions(name, { worker = false } = {}) {
  return {
    host: redisHost,
    port: redisPort,

    ...(redisUsername ? { username: redisUsername } : {}),
    ...(redisPassword ? { password: redisPassword } : {}),

    ...(isTls
      ? {
          tls: {
            servername: redisHost,
          },
        }
      : {}),

    maxRetriesPerRequest: worker ? null : 5,
    enableOfflineQueue: worker,

    connectTimeout: 10000,
    keepAlive: 10000,
    connectionName: `pulsestream-${name}`,

    retryStrategy(times) {
      return Math.min(Math.max(times * 500, 500), 5000);
    },
  };
}

const redisHealthConnection = new Redis(
  getRedisConnectionOptions("health", { worker: false }),
);

redisHealthConnection.on("connect", () => {
  console.log(
    `✅ Redis TCP connection established (${isTls ? "TLS/managed" : "local"}).`,
  );
});

redisHealthConnection.on("ready", () => {
  console.log("📦 Redis is READY for BullMQ jobs.");
});

redisHealthConnection.on("error", (err) => {
  console.error("❌ Redis connection error:", err.message);
});

redisHealthConnection.on("close", () => {
  console.warn(
    "⚠️ Redis TCP connection closed; ioredis will reconnect automatically.",
  );
});

redisHealthConnection.on("reconnecting", (delay) => {
  console.warn(`🔄 Redis reconnecting in ${delay}ms...`);
});

async function verifyRedis() {
  const response = await redisHealthConnection.ping();

  if (response !== "PONG") {
    throw new Error(
      `Redis health check returned unexpected response: ${response}`,
    );
  }
}

async function closeRedis() {
  if (["end", "close"].includes(redisHealthConnection.status)) {
    return;
  }

  await redisHealthConnection.quit();
}

module.exports = {
  REDIS_URL,
  isTls,
  getRedisConnectionOptions,
  redisHealthConnection,
  verifyRedis,
  closeRedis,
};
