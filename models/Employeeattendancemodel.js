const mongoose = require("mongoose");

const EmployeeAttendanceSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employeeId: {
      type: String,
      required: true,
    },

    date: {
      type: String,
      required: true,
    },

    punchInTime: {
      type: Date,
      default: null,
    },

    punchOutTime: {
      type: Date,
      default: null,
    },

    duration: {
      type: String,
      default: "00:00",
    },

    punchInLocation: {
      type: String,
      default: "",
    },

    punchOutLocation: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "EmployeeAttendance",
  EmployeeAttendanceSchema
);
