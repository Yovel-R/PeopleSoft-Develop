const mongoose = require("mongoose");

const CounterSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  type: { type: String, required: true }, // e.g., 'employee', 'intern'
  seq: { type: Number, default: 0 },
});

// Ensure uniqueness per company and type
CounterSchema.index({ companyId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("Counter", CounterSchema);
