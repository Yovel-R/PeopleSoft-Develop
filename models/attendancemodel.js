const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
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
