const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema({
  // Section 1 – Personal Details
  EmployeeId: { type: String, default: "" },
  password: { type: String, default: "" },
  status: { type: String, default: "initial" },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  onboardingDate: { type: Date },
  emergencyName: String,
  emergencyPhone: String,
  dob: Date,
  address: String,
  role: String,
  linkedin: String,
  gender: String,
  nationality: String,
  maritalStatus: String,

  // Section 2 – Education
  qualification: String,
  specialization: String,
  college: String,
  passingYear: String,

  // Section 3 – CGPA / Marksheets
  ugCgpa: Number,
  pgCgpa: Number,

  // Section 4 – Experience (conditional)
  isExperienced: { type: Boolean, default: false },
  experienceYears: String,
  previousOrg: String,
  designation: String,

  // Section 6 – Declarations
  declaration: { type: Boolean, default: false },
  bgConsent: { type: Boolean, default: false },
  whatsappConsent: { type: Boolean, default: false },

  submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Employee", EmployeeSchema);
