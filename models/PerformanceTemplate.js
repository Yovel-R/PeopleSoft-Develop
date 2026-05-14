const mongoose = require('mongoose');

const GoalDefinitionSchema = new mongoose.Schema({
  perspective: { type: String, required: true },
  kpiName: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  weight: { type: Number, required: true }
});

const PerformanceTemplateSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  roleName: { type: String, required: true }, // matches Intern.role
  category: { type: String, required: true },
  goals: [GoalDefinitionSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Ensure uniqueness per company, role, and category
PerformanceTemplateSchema.index({ companyId: 1, roleName: 1, category: 1 }, { unique: true });

PerformanceTemplateSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('PerformanceTemplate', PerformanceTemplateSchema);
