const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  client: { type: String },
  description: { type: String },
  startDate: { type: Date, default: Date.now },
  deadline: { type: Date },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  teamMembers: [{
    memberId: { type: mongoose.Schema.Types.ObjectId, required: true },
    memberType: { type: String, enum: ['intern', 'employee'], required: true },
    fullName: String
  }],
  checklist: [{
    task: { type: String, required: true },
    isCompleted: { type: Boolean, default: false },
    completedBy: { type: mongoose.Schema.Types.ObjectId, default: null }, // ID of the person who checked it
    completedAt: { type: Date }
  }],
  status: { type: String, enum: ['In Progress', 'Completed', 'On Hold'], default: 'In Progress' },
  progress: { type: Number, default: 0 } // Percentage 0-100
}, { timestamps: true });

// Pre-save middleware to calculate progress
projectSchema.pre('save', function() {
  if (this.checklist && this.checklist.length > 0) {
    const completedCount = this.checklist.filter(item => item.isCompleted).length;
    this.progress = Math.round((completedCount / this.checklist.length) * 100);
  } else {
    this.progress = 0;
  }
});

module.exports = mongoose.model('Project', projectSchema);
