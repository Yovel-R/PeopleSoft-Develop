const mongoose = require("mongoose");

const hrSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
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
