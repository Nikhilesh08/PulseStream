const { Schema, model } = require("mongoose");

const EventSchema = new Schema(
  {
    topicId: { type: String, required: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

const Event = model("Event", EventSchema);

module.exports = { Event };
