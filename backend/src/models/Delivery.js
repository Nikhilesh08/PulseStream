const { Schema, model } = require("mongoose");

const DeliverySchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    channel: { type: String, enum: ["email", "inApp"], required: true },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    attempts: { type: Number, default: 0 },
    sentAt: { type: Date, default: null },
    errorMessage: { type: String }, // Stores DLQ reasons
    faultType: { type: String }, // Categorizes DLQ errors
  },
  { timestamps: true },
);

// Ensures no duplicate jobs can be created for the same event+user+channel
DeliverySchema.index({ eventId: 1, userId: 1, channel: 1 }, { unique: true });

// 🚀 UPGRADE: Speeds up the "Refresh Metrics" dashboard counting query
DeliverySchema.index({ status: 1 });

const Delivery = model("Delivery", DeliverySchema);

module.exports = { Delivery };
