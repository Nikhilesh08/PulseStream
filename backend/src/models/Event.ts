import { Schema, model, Document } from "mongoose";

export interface IEvent extends Document {
  topicId: string;
  type: string;
  payload: any;
}

const EventSchema = new Schema<IEvent>(
  {
    topicId: { type: String, required: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export const Event = model<IEvent>("Event", EventSchema);
