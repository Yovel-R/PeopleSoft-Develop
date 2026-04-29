const mongoose = require("mongoose");

const LeaveSchema = new mongoose.Schema({
  internId: { type: String, required: true },
  internName: { type: String, required: true },
  leaveType: { type: String, required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  numberOfDays: { type: Number, required: true },
  reason: { type: String, required: true },
  status: { type: String, default: "pending" },
  rejectionReason: { type: String, default: "" },
  perDayDurations: { type: Map, of: String, default: {} },
  perDayDurations: {
  type: Object,
  default: {},
},

});

module.exports = mongoose.model("InternLeaves", LeaveSchema);
