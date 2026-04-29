const mongoose = require('mongoose');

const employeeTerminationSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    index: true
  },
  employeeName: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  designation: {
    type: String,
    required: true
  },
  terminationDate: {
    type: Date,
    required: true
  },
  lastWorkingDay: {
    type: Date,
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'Termination During Probation',
      'Termination Due to Performance Issues',
      'Termination Due to Attendance / Absenteeism',
      'Termination Due to Misconduct',
      'Termination Due to Policy Violation',
      'Role Redundancy / Business Decision',
      'Violation of Confidentiality / NDA',
      'Fraud / Integrity Concern',
      'Other'
    ]
  },
  otherReason: {
    type: String,
    maxlength: 500
  },
  showCauseNotice: {
    type: Boolean,
    default: false
  },
  showCauseNoticeDoc: {
    type: String, // File name or URL
    maxlength: 500
  },
  performanceLogs: {
    type: String, // File name or URL
    maxlength: 500,
    default: ''
  },
  status: {
    type: String,
    enum: ['terminated', 'cancelled'],
    default: 'terminated'
  },
  terminatedAt: {
    type: Date,
    default: Date.now
  },
  terminatedBy: {
    type: String,
    default: 'HR'
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient querying
employeeTerminationSchema.index({ employeeId: 1, status: 1 });
employeeTerminationSchema.index({ terminationDate: -1 });
employeeTerminationSchema.index({ status: 1, terminatedAt: -1 });

module.exports = mongoose.model('EmployeeTermination', employeeTerminationSchema);
