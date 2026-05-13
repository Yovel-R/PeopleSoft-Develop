require('dotenv').config();
const mongoose = require('mongoose');
const Counter = require('../models/counter.model');

async function checkIndexes() {
  try {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI not found in .env');
      return;
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');
    
    const indexes = await Counter.collection.indexes();
    console.log('Current indexes on Counter collection:', JSON.stringify(indexes, null, 2));
    
    // Check if year_1 exists and drop it
    const hasYearIndex = indexes.some(idx => idx.name === 'year_1');
    if (hasYearIndex) {
      console.log('Dropping index year_1...');
      await Counter.collection.dropIndex('year_1');
      console.log('Index year_1 dropped successfully.');
    } else {
      console.log('No index named year_1 found.');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

checkIndexes();
