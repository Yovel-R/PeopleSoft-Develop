const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },type: {
    type: String,
    enum: ['weekly', 'special'],
    required: true
  },
  day: {
    type: String, // Mon, Tue, etc.
    required: function() { return this.type === 'weekly' }
  },
  weeks: [{
    type: Number // 1,2,3,4,5
  }],
  fromDate: {
    type: Date,
    required: function() { return this.type === 'special' }
  },
  toDate: {
    type: Date,
    required: function() { return this.type === 'special' }
  },
  reason: {
    type: String,
    required: function() { return this.type === 'special' }
  }
}, {
  timestamps: true
});

// ✅ NO UNIQUE INDEXES - Multiple same dates allowed!

module.exports = mongoose.model('Holiday', holidaySchema);
