const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  location: { type: String }, // e.g., 'New York', 'HQ'
  timezone: { type: String, default: 'UTC' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
BranchSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Branch', BranchSchema);
