import { Schema, model, Document } from "mongoose";

export interface IFollow extends Document {
  userId: Schema.Types.ObjectId;
  topicId: string; // ✅ Fixed: Now expects a standard string
  channels: ("email" | "inApp")[];
}

const FollowSchema = new Schema<IFollow>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  topicId: { type: String, required: true }, // ✅ Fixed: Mongoose will store it exactly as "prod_1"
  channels: {
    type: [String],
    enum: ["email", "inApp"],
    required: true,
    validate: [
      (val: string[]) => val.length > 0,
      "At least one channel is required",
    ],
  },
});

// Prevent a user from following the exact same topic twice!
FollowSchema.index({ userId: 1, topicId: 1 }, { unique: true });

export const Follow = model<IFollow>("Follow", FollowSchema);
