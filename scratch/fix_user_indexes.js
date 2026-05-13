const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false, collection: 'users' }));
    
    console.log('Dropping problematic index...');
    try {
      await User.collection.dropIndex('companyId_1_employeeId_1');
      console.log('Successfully dropped companyId_1_employeeId_1');
    } catch (e) {
      console.log('Index companyId_1_employeeId_1 not found or already dropped');
    }

    console.log('Indexes fixed. Mongoose will recreate them on next restart.');
    process.exit(0);
  } catch (err) {
    console.error('Error fixing indexes:', err);
    process.exit(1);
  }
}

fixIndexes();
