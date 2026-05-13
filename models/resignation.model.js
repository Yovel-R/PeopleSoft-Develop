const mongoose = require("mongoose");

const resignationSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    fullName: { type: String, required: true },
    userId: { type: String, required: true },
    userType: { type: String, enum: ["intern", "employee"], default: "intern" },
    department: { type: String, required: true },

    lastWorkingDay: { type: String, required: true },

    exitType: { type: String, required: true }, // Resignation
    exitReason: { type: String, required: true }, // Selected / Other reason

    assetReturnStatus: { type: String, required: true },
    status: { type: String, enum: ["pending_manager", "pending_hr", "accepted", "rejected"], default: "pending_manager" },

    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    managerStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    managerRemarks: { type: String, default: "" },

    hrStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    hrRemarks: { type: String, default: "" },

    createdAt: { type: Date, default: Date.now },

  },
  { collection: "resignation_records" }
);

module.exports = mongoose.model("Resignation", resignationSchema);
