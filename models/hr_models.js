const mongoose = require("mongoose");

const hrSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  hr_policy_url: {
    type: String,
    default: null
  },
  policy_updated_at: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model("HrUsers", hrSchema);
