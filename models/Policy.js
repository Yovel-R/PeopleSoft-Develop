const mongoose = require("mongoose");

const policySchema = new mongoose.Schema(
  {
    policy_name: { type: String, required: true },
    policy_view_by: {
      type: [String],
      enum: ["employee", "intern"],
      required: true,
    },
    policy_url: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Policy", policySchema);
