const mongoose = require('mongoose');
require('dotenv').config();

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const Employee = mongoose.model('Employee', new mongoose.Schema({}, { strict: false }));
    const Intern = mongoose.model('Intern', new mongoose.Schema({}, { strict: false }));

    const employeeCount = await Employee.countDocuments();
    const internCount = await Intern.countDocuments();

    console.log(`Total Employees: ${employeeCount}`);
    console.log(`Total Interns: ${internCount}`);

    const empStatuses = await Employee.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('Employee Statuses:', empStatuses);

    const intStatuses = await Intern.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('Intern Statuses:', intStatuses);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkData();
