const mongoose = require("mongoose");

const InternSchema = new mongoose.Schema({
  internid: {
    type: String,
    unique: true,
    sparse: true
  },
  fullName: { type: String, required: true },
  college: { type: String, required: true },
  year: { type: String, required: true },
  department: { type: String, required: true },
  role: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, default: "" },
  contact: { type: String, required: true },
  emergencyContact: { type: String, required: true },
  onboardingDate: { type: String, default: ""},
  endDate: { type: String, default: ""},
  linkedin: { type: String, required: true },
  internshipType: { type: String, default: ""},
  applicationType: { type: String, enum: ["Internship", "Job"], default: "Internship" },



  // New backend auto-field
  status: { type: String, default: "initial" },
  leaveCount: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Intern", InternSchema);
