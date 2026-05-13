const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }, // Optional, can be global to company
  name: { type: String, required: true },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Head of Department
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
DepartmentSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Department', DepartmentSchema);
