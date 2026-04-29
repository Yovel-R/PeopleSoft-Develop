const mongoose = require("mongoose");

const EmployeeLeaveSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },

    leaveType: { type: String, required: true },

    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },

    numberOfDays: { type: Number, required: true },

    reason: { type: String, required: true },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },

    rejectionReason: { type: String, default: "" },

    // example: { "2025-01-10": "half", "2025-01-11": "full" }
    perDayDurations: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmployeeLeaves", EmployeeLeaveSchema);
