const mongoose = require("mongoose");

const resignationSchema = new mongoose.Schema(
  {
    internName: { type: String, required: true },
    internId: { type: String, required: true },
    department: { type: String, required: true },

    lastWorkingDay: { type: String, required: true },

    exitType: { type: String, required: true }, // Resignation
    exitReason: { type: String, required: true }, // Selected / Other reason

    assetReturnStatus: { type: String, required: true },
    status: { type: String, default: "pending" },

    createdAt: { type: Date, default: Date.now },

  },
  { collection: "resignation_records" }
);

module.exports = mongoose.model("Resignation", resignationSchema);
