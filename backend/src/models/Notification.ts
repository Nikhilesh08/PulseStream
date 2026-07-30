import { Schema, model, Types } from "mongoose";

// 1. Plain TypeScript interface — DO NOT extend Document in Mongoose v9!
export interface INotification {
  userId: Types.ObjectId;
  eventId: Types.ObjectId;
  message: string;
  read: boolean;
  createdAt: Date;
}

// 2. The Schema handles the MongoDB mapping automatically
const NotificationSchema = new Schema<INotification>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

NotificationSchema.index({ userId: 1 });

// MongoDB automatically deletes notifications 30 days after they are created!
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export const Notification = model<INotification>(
  "Notification",
  NotificationSchema,
);
