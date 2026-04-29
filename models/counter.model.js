const mongoose = require("mongoose");

const CounterSchema = new mongoose.Schema({
  year: { type: String, required: true, unique: true }, // "25", "26"
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model("Counter", CounterSchema);
