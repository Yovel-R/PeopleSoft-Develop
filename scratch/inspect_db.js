const mongoose = require('mongoose');
require('dotenv').config({ path: '/Users/yovelr/Softrate/HRM/Develop-Backend/.env' });

const uri = process.env.MONGO_URI;
console.log('Connecting to:', uri);

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected!');
    const db = mongoose.connection.db;
    const interns = await db.collection('interns').find({}).toArray();
    console.log('--- ALL INTERNS ---');
    for (const i of interns) {
      console.log(`Name: ${i.fullName}, ID: ${i.internid || i.internId}, Payroll:`, JSON.stringify(i.payroll));
    }
    await mongoose.disconnect();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
