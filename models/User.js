const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  
  // Login Credentials
  email: { type: String, required: true },
  password: { type: String, required: false, select: false },
  
  // System Identifiers
  employeeId: { type: String }, // Optional, company-specific ID (e.g., STP001)
  
  // Role & Permissions
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  
  // Organization Structure
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Reporting hierarchy
  
  // Profile Details
  profile: {
    firstName: { type: String, required: true },
    lastName: { type: String },
    phone: { type: String },
    dob: { type: Date },
    address: { type: String },
    avatar: { type: String },
    gender: { type: String },
    nationality: { type: String },
    maritalStatus: { type: String },
    emergencyContact: {
      name: { type: String },
      phone: { type: String }
    }
  },
  
  // Education & Experience
  education: {
    qualification: String,
    specialization: String,
    college: String,
    passingYear: String,
    ugCgpa: Number,
    pgCgpa: Number
  },

  experience: {
    isExperienced: { type: Boolean, default: false },
    years: String,
    previousOrg: String,
    designation: String
  },
  
  // Employment Details
  employment: {
    type: { type: String, enum: ['FULL_TIME', 'PART_TIME', 'INTERN', 'CONTRACTOR'], required: true },
    status: { type: String, default: 'ONBOARDING' }, // Default to onboarding
    designation: { type: String }, 
    joinedAt: { type: Date },
    endDate: { type: Date }, // For Interns/Contractors
    probationEndDate: { type: Date },
    linkedin: String
  },

  // System & Compliance
  system: {
    onboardingStatus: { type: String, default: 'initial' },
    declaration: { type: Boolean, default: false },
    bgConsent: { type: Boolean, default: false },
    whatsappConsent: { type: Boolean, default: false },
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Ensure email is unique per company
UserSchema.index({ companyId: 1, email: 1 }, { unique: true });

// Ensure employeeId is unique per company (if provided)
UserSchema.index(
  { companyId: 1, employeeId: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { employeeId: { $type: "string" } } 
  }
);

// Update timestamp on save
UserSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('User', UserSchema);
