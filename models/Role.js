const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true }, // e.g., 'HR_ADMIN', 'EMPLOYEE', 'MANAGER'
  description: { type: String },
  permissions: [{ type: String }], // Array of permission strings like 'CREATE_USER', 'APPROVE_LEAVE', '*'
  isSystemDefined: { type: Boolean, default: false }, // Prevent deletion of core roles
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index to ensure role names are unique per company
RoleSchema.index({ companyId: 1, name: 1 }, { unique: true });

// Update timestamp on save
RoleSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Role', RoleSchema);
