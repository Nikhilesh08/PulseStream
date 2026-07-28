import { Schema, model, Document } from "mongoose";

export interface IEvent extends Document {
  topicId: string; // ✅ Fixed: Expects a standard string instead of ObjectId
  type: string;
  payload: any;
}

const EventSchema = new Schema<IEvent>(
  {
    // ✅ Fixed: type is now String so it perfectly accepts "prod_1"
    topicId: { type: String, required: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export const Event = model<IEvent>("Event", EventSchema);
