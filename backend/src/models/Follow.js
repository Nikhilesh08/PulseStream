const { Schema, model } = require("mongoose");

const FollowSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    topicId: { type: String, required: true, trim: true },
    channels: {
      type: [String],
      enum: ["email", "inApp"],
      default: [],
    },
  },
  { timestamps: true },
);

// One subscription per user/topic keeps the fan-out query deterministic.
FollowSchema.index({ userId: 1, topicId: 1 }, { unique: true });
FollowSchema.index({ topicId: 1 });

const Follow = model("Follow", FollowSchema);

module.exports = { Follow };
