const mongoose = require('mongoose');
require('dotenv').config();

async function checkIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const collections = ['employeeattendances', 'attendances'];
    
    for (const collName of collections) {
      const coll = mongoose.connection.collection(collName);
      const indexes = await coll.indexes();
      console.log(`Indexes for ${collName}:`, JSON.stringify(indexes, null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkIndexes();
