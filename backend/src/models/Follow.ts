import { Schema, model, Document, Types } from "mongoose";

export interface IFollow extends Document {
  userId: Types.ObjectId;
  topicId: string;
  channels: string[];
}

const FollowSchema = new Schema<IFollow>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    topicId: { type: String, required: true },
    channels: [{ type: String }],
  },
  { timestamps: true },
);

FollowSchema.index({ topicId: 1 });

FollowSchema.index({ userId: 1 });

export const Follow = model<IFollow>("Follow", FollowSchema);
