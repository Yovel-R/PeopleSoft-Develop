const mongoose = require("mongoose");

const leaveCounterSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    index: true
  },

  leaveType: {
    type: String,
    enum: [
      "Casual Leave",
      "Sick Leave",
      "Bereavement Leave",
      "Maternity Leave"
    ],
    required: true
  },

  totalAllowed: {
    type: Number,
    required: true
  },

  used: {
    type: Number,
    default: 0
  },

  balance: {
    type: Number,
    required: true
  },

  cycleStartDate: {
    type: Date,
    required: true
  },

  nextResetDate: {
    type: Date,
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

leaveCounterSchema.index(
  { employeeId: 1, leaveType: 1 },
  { unique: true }
);

module.exports = mongoose.model("LeaveCounter", leaveCounterSchema);
