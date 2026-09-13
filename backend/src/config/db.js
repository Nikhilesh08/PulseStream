const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Local defaults make the project runnable after cloning when MongoDB is
// installed locally. Production deployments should always provide MONGODB_URI.
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pulsestream";

mongoose.set("bufferTimeoutMS", 30000);

mongoose.connection.on("connected", () => {
  console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
});
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected — waiting for reconnection...");
});
mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB reconnected.");
});
mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err.message);
});

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error.message);
    console.error(
      `   Mongo connection type: ${MONGODB_URI.startsWith("mongodb+srv://") ? "MongoDB Atlas" : "local/standard MongoDB"}`,
    );
    console.error(
      "   Start MongoDB locally or set backend/.env -> MONGODB_URI to a reachable Atlas/local URI.",
    );
    throw error;
  }
};

module.exports = { connectDB };
