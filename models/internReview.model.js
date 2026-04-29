const mongoose = require("mongoose");

/* ---------------------- GOAL SCHEMA ---------------------- */

const GoalSchema = new mongoose.Schema({
  perspective: { type: String, required: true, trim: true },
  kpi: {type: String,required: true,trim: true},
  title: {type: String,required: true,trim: true},
  description: {type: String,required: true,trim: true},
  weight: {type: Number,required: true,min: 0},
  comment: {type: String,default: ""},
  grade: {type: String,enum: ["A", "B", "C", "D", ""],default: ""},
  score: {type: Number,default: 0}
});

/* ---------------------- REVIEW SCHEMA ---------------------- */

const ReviewSchema = new mongoose.Schema({
  internId: {
    type: String,
    required: true,
    index: true
  },
  internName: {
    type: String,
    required: true
  },
  team: {
    type: String,
    required: true
  },
  goals: {
    type: [GoalSchema],
    default: []
  },
  summary: {
    obtainedScore: {
      type: Number,
      default: 0
    },
    totalWeight: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    }
  },
  isGraded: {
    type: Boolean,
    default: false
  },
  date: {
    type: String, // yyyy-MM-dd
    required: true,
    index: true
  }
});

/* ---------------------- EXPORT ---------------------- */

module.exports = mongoose.model("Review", ReviewSchema);
