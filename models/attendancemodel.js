const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
  
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  internId: {
    type: String,  // was ObjectId, now string
    required: true,
  },
  date: { type: String, required: true },
  punchInTime: { type: Date, default: null },
  punchOutTime: { type: Date, default: null },
  duration: { type: String, default: null },
  punchInLocation: { type: String, default: null },
  punchOutLocation: { type: String, default: null },
});


module.exports = mongoose.model("Attendance", AttendanceSchema);
