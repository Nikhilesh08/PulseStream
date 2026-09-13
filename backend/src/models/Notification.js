const { Schema, model } = require("mongoose");

const NotificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

NotificationSchema.index({ userId: 1 });

// MongoDB automatically deletes notifications 30 days after they are created!
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

const Notification = model("Notification", NotificationSchema);

module.exports = { Notification };
