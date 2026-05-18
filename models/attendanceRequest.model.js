const mongoose = require("mongoose");

const AttendanceRequestSchema = new mongoose.Schema({
  
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },internId: { type: String, required: true }, // The readable ID (e.g., 2025001)
  internMongoId: { type: mongoose.Schema.Types.ObjectId, ref: "Intern", required: true },
  internName: { type: String, required: true },
  managerMongoId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  date: { type: Date, required: true },
  requestedPunchIn: { type: String, default: null }, // ISO string or time string
  requestedPunchOut: { type: String, default: null },
  reason: { type: String, required: true },
  
  // Manager Approval
  managerApprovalStatus: { 
    type: String, 
    enum: ["pending", "approved", "rejected"], 
    default: "pending" 
  },
  managerRemarks: { type: String, default: "" },
  managerActionDate: { type: Date },

  // HR Approval
  hrApprovalStatus: { 
    type: String, 
    enum: ["pending", "approved", "rejected"], 
    default: "pending" 
  },
  hrRemarks: { type: String, default: "" },
  hrActionDate: { type: Date },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("AttendanceRequest", AttendanceRequestSchema);
