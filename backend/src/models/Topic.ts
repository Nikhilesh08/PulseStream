import { Schema, model, Document } from "mongoose";

export interface ITopic extends Document {
  name: string;
}

const TopicSchema = new Schema<ITopic>({
  name: { type: String, required: true, unique: true, trim: true },
});

export const Topic = model<ITopic>("Topic", TopicSchema);
