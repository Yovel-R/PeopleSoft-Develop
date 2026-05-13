const mongoose = require('mongoose');
require('dotenv').config();

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const Employee = mongoose.model('Employee', new mongoose.Schema({}, { strict: false, collection: 'employees' }));
    
    const latest = await Employee.find({ status: 'initial' }).sort({ createdAt: -1 }).limit(5);
    
    console.log('Latest 5 initial employees:');
    latest.forEach(emp => {
      console.log(`- Name: ${emp.fullName}, Email: ${emp.email}, Qual: ${emp.qualification}, College: ${emp.college}, CreatedAt: ${emp.createdAt || emp.submittedAt}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkData();
