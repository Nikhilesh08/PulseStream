const { Schema, model } = require("mongoose");

const TopicSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
});

const Topic = model("Topic", TopicSchema);

module.exports = { Topic };
