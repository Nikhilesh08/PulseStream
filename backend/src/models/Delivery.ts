import { Schema, model, Types } from "mongoose";

// Plain interface without 'extends Document' for Mongoose v9 compatibility
export interface IDelivery {
  eventId: Types.ObjectId;
  userId: Types.ObjectId;
  channel: "email" | "inApp";
  status: "pending" | "sent" | "failed";
  attempts: number;
  sentAt: Date | null;
}

const DeliverySchema = new Schema<IDelivery>({
  eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  channel: { type: String, enum: ["email", "inApp"], required: true },
  status: {
    type: String,
    enum: ["pending", "sent", "failed"],
    default: "pending",
  },
  attempts: { type: Number, default: 0 },
  sentAt: { type: Date, default: null },
});

// Ensures no duplicate jobs can be created for the same event+user+channel
DeliverySchema.index({ eventId: 1, userId: 1, channel: 1 }, { unique: true });

export const Delivery = model<IDelivery>("Delivery", DeliverySchema);
