const mongoose = require("mongoose");

const employeeResignationSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    designation: {
      type: String,
      required: true,
    },
    applyDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    noticePeriodMonths: {
      type: Number,
      required: true,
      default: 2,
    },
    lastWorkingDay: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    additionalComments: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      required: true,
    },
    rejectionReason: {
      type: String,
      default: "",
    },
    createdBy: {
      // optional: link to employee user _id if you have users collection
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "EmployeeResignation",
  employeeResignationSchema
);
