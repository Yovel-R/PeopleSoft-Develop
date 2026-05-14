const mongoose = require('mongoose');
const Attendance = require('../models/attendancemodel');
const Intern = require('../models/Intern');

async function check() {
  const MONGO_URI = "mongodb+srv://yovel2911_db_user:x3BIDPEMrPrbN68M@cluster0.kyxao9c.mongodb.net/hrdb";
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  const internId = "6a054d287bb91e45ce3ae88c";
  const intern = await Intern.findById(internId);
  if (!intern) {
    console.log('Intern not found by ID:', internId);
    mongoose.disconnect();
    return;
  }
  console.log('Intern:', intern.fullName, 'internid:', intern.internid);

  const records = await Attendance.find({ internId: intern.internid });
  console.log('Records found with internid:', records.length);
  if (records.length > 0) {
    console.log('First record date:', records[0].date);
  }

  const recordsById = await Attendance.find({ internId: internId });
  console.log('Records found with _id:', recordsById.length);

  mongoose.disconnect();
}

check();
