const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");

dotenv.config({
  path: path.resolve(__dirname, ".env"),
});

const API_URL = process.env.LOAD_TEST_API_URL || "http://localhost:5000";

const EMAIL = process.env.LOAD_TEST_EMAIL || process.env.ADMIN_EMAIL;

const PASSWORD = process.env.LOAD_TEST_PASSWORD || process.env.ADMIN_PASSWORD;

const TOPIC_ID = process.env.LOAD_TEST_TOPIC_ID || "prod_1";

const EVENT_COUNT = Number(process.env.LOAD_TEST_EVENTS || 100);

const CONCURRENCY = Number(process.env.LOAD_TEST_CONCURRENCY || 10);

const POLL_INTERVAL_MS = 250;

if (!EMAIL || !PASSWORD) {
  console.error(
    "❌ LOAD TEST: ADMIN_EMAIL and ADMIN_PASSWORD must exist in backend/.env",
  );

  process.exit(1);
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function percentile(values, percentile) {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);

  const index = (percentile / 100) * (sorted.length - 1);

  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --------------------------------------------------
// Login
// --------------------------------------------------

async function login() {
  console.log("🔐 Logging into PulseStream...");

  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.token) {
    throw new Error(`Login failed: ${response.status} ${JSON.stringify(data)}`);
  }

  console.log("✅ Load-test authentication successful.");

  return data.token;
}

// --------------------------------------------------
// MongoDB subscriber calculation
// --------------------------------------------------

async function getExpectedDeliveries() {
  const { Follow } = require("./src/models/Follow");

  const follows = await Follow.find({
    topicId: TOPIC_ID,
    channels: {
      $in: ["email", "inApp"],
    },
  }).lean();

  let deliveriesPerEvent = 0;

  for (const follow of follows) {
    if (Array.isArray(follow.channels)) {
      if (follow.channels.includes("email")) {
        deliveriesPerEvent++;
      }

      if (follow.channels.includes("inApp")) {
        deliveriesPerEvent++;
      }
    }
  }

  return {
    followerCount: follows.length,
    deliveriesPerEvent,
  };
}

// --------------------------------------------------
// Submit one event
// --------------------------------------------------

async function submitEvent(token, sequence) {
  const start = performance.now();

  const response = await fetch(`${API_URL}/api/events`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },

    body: JSON.stringify({
      topicId: TOPIC_ID,

      type: "price_drop",

      payload: {
        productId: TOPIC_ID,
        productName: `Load Test Product ${sequence}`,
        oldPrice: 1000,
        newPrice: 950,
        currency: "USD",
        loadTest: true,
        sequence,
      },
    }),
  });

  const elapsed = performance.now() - start;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `${response.status}: ${data.error || JSON.stringify(data)}`,
    );
  }

  return {
    latency: elapsed,
    eventId: String(data.event?._id || data.event?.id || ""),
  };
}

// --------------------------------------------------
// Concurrent event submission
// --------------------------------------------------

async function runEventSubmission(token) {
  const latencies = [];
  const eventIds = [];
  const failures = [];

  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;

      if (index >= EVENT_COUNT) {
        return;
      }

      try {
        const result = await submitEvent(token, index + 1);

        latencies.push(result.latency);

        if (result.eventId) {
          eventIds.push(result.eventId);
        }

        if ((index + 1) % 10 === 0) {
          console.log(`📤 Submitted ${index + 1}/${EVENT_COUNT} events`);
        }
      } catch (error) {
        failures.push({
          index: index + 1,
          message: error.message,
        });
      }
    }
  }

  const start = performance.now();

  const workers = Array.from(
    {
      length: Math.min(CONCURRENCY, EVENT_COUNT),
    },
    () => worker(),
  );

  await Promise.all(workers);

  const elapsed = performance.now() - start;

  return {
    latencies,
    eventIds,
    failures,
    elapsed,
  };
}

// --------------------------------------------------
// Wait for Delivery collection to finish
// --------------------------------------------------

async function waitForDeliveries(eventIds, expectedDeliveries) {
  const { Delivery } = require("./src/models/Delivery");

  const start = performance.now();

  const eventObjectIds = eventIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  while (true) {
    const [successful, failed, pending, total] = await Promise.all([
      Delivery.countDocuments({
        eventId: {
          $in: eventObjectIds,
        },
        status: "success",
      }),

      Delivery.countDocuments({
        eventId: {
          $in: eventObjectIds,
        },
        status: "failed",
      }),

      Delivery.countDocuments({
        eventId: {
          $in: eventObjectIds,
        },
        status: "pending",
      }),

      Delivery.countDocuments({
        eventId: {
          $in: eventObjectIds,
        },
      }),
    ]);

    process.stdout.write(
      `\r📊 Deliveries: ${total}/${expectedDeliveries} | success=${successful} failed=${failed} pending=${pending}`,
    );

    if (successful + failed >= expectedDeliveries) {
      console.log("");

      return {
        successful,
        failed,
        pending,
        total,
        elapsed: performance.now() - start,
      };
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

// --------------------------------------------------
// Main
// --------------------------------------------------

async function main() {
  console.log("");
  console.log("==========================================");
  console.log("        PulseStream Load Test");
  console.log("==========================================");
  console.log(`API:         ${API_URL}`);
  console.log(`Topic:       ${TOPIC_ID}`);
  console.log(`Events:      ${EVENT_COUNT}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log("");

  if (process.env.LOAD_TEST_MODE !== "true") {
    console.warn("⚠️ LOAD_TEST_MODE is not true.");

    console.warn("   Real email delivery may occur.");

    console.warn("   Set LOAD_TEST_MODE=true before continuing.");

    process.exit(1);
  }

  const token = await login();

  await mongoose.connect(process.env.MONGODB_URI);

  console.log("✅ Connected to MongoDB for measurement.");

  const { followerCount, deliveriesPerEvent } = await getExpectedDeliveries();

  if (followerCount === 0 || deliveriesPerEvent === 0) {
    throw new Error(`No active subscriptions found for ${TOPIC_ID}.`);
  }

  console.log(`👥 Followers: ${followerCount}`);

  console.log(`📦 Deliveries per event: ${deliveriesPerEvent}`);

  console.log(`🎯 Expected deliveries: ${EVENT_COUNT * deliveriesPerEvent}`);

  console.log("");

  // ------------------------------------------------
  // Submit events
  // ------------------------------------------------

  const submission = await runEventSubmission(token);

  const eventThroughput =
    submission.latencies.length / (submission.elapsed / 1000);

  console.log("");
  console.log("📈 Event submission results");

  console.log(`Events accepted: ${submission.eventIds.length}/${EVENT_COUNT}`);

  console.log(
    `Submission throughput: ${eventThroughput.toFixed(2)} events/sec`,
  );

  console.log(
    `POST /events P50: ${percentile(submission.latencies, 50).toFixed(2)} ms`,
  );

  console.log(
    `POST /events P95: ${percentile(submission.latencies, 95).toFixed(2)} ms`,
  );

  console.log(
    `POST /events P99: ${percentile(submission.latencies, 99).toFixed(2)} ms`,
  );

  console.log(`Request failures: ${submission.failures.length}`);

  if (submission.failures.length) {
    console.log(submission.failures.slice(0, 5));
  }

  // ------------------------------------------------
  // Wait for workers
  // ------------------------------------------------

  const expectedDeliveries = submission.eventIds.length * deliveriesPerEvent;

  console.log("");
  console.log("⏳ Waiting for BullMQ workers to finish all deliveries...");

  const deliveryResult = await waitForDeliveries(
    submission.eventIds,
    expectedDeliveries,
  );

  const deliveryThroughput =
    deliveryResult.successful / (deliveryResult.elapsed / 1000);

  const completionRate =
    expectedDeliveries === 0
      ? 0
      : (deliveryResult.successful / expectedDeliveries) * 100;

  console.log("");
  console.log("==========================================");
  console.log("              RESULTS");
  console.log("==========================================");

  console.log(`Events accepted:       ${submission.eventIds.length}`);

  console.log(
    `Event throughput:      ${eventThroughput.toFixed(2)} events/sec`,
  );

  console.log(
    `Delivery throughput:   ${deliveryThroughput.toFixed(2)} deliveries/sec`,
  );

  console.log(
    `P95 API latency:       ${percentile(submission.latencies, 95).toFixed(
      2,
    )} ms`,
  );

  console.log(`Successful deliveries: ${deliveryResult.successful}`);

  console.log(`Failed deliveries:     ${deliveryResult.failed}`);

  console.log(`Pending deliveries:    ${deliveryResult.pending}`);

  console.log(`Delivery success rate: ${completionRate.toFixed(2)}%`);

  console.log(
    `End-to-end worker time: ${(deliveryResult.elapsed / 1000).toFixed(2)} sec`,
  );

  console.log("==========================================");

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("");
  console.error("❌ LOAD TEST FAILED:");
  console.error(error.stack || error.message);

  mongoose.disconnect().catch(() => {});

  process.exit(1);
});
