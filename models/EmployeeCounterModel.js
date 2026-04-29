// models/EmployeeCounterModel.js
const mongoose = require("mongoose");

const employeeCounterSchema = new mongoose.Schema({
  year: { type: Number, required: true, unique: true }, // store year as number
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.models.EmployeeCounter || mongoose.model("EmployeeCounter", employeeCounterSchema);
