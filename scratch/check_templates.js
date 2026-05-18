const mongoose = require('mongoose');
require("dotenv").config({ path: "./.env" });
const Company = require('../models/CompanyModel');

async function checkTemplates() {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrm';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    const companies = await Company.find({});
    console.log(`Found ${companies.length} companies`);

    for (const c of companies) {
      console.log(`\nCompany: ${c.name} (${c.companyCode})`);
      const templates = c.settings?.offerLetterSettings?.documentTemplates;
      if (!templates) {
        console.log('No documentTemplates found');
        continue;
      }

      for (const [key, t] of Object.entries(templates)) {
        if (t && t.pages && t.pages.length > 0) {
          console.log(` - Template: ${key} (${t.orientation})`);
          t.pages.forEach((p, idx) => {
            console.log(`    Page ${idx + 1}:`);
            console.log(`      Placeholders (${p.placeholders?.length || 0}):`);
            p.placeholders?.forEach(pl => {
              console.log(`        - ${pl.key}: x=${pl.x}, y=${pl.y}, fontSize=${pl.fontSize}`);
            });
            console.log(`      Paragraphs (${p.paragraphs?.length || 0}):`);
            p.paragraphs?.forEach((pa, pidx) => {
              console.log(`        - Paragraph ${pidx + 1}: text="${pa.text?.substring(0, 30)}...", x=${pa.x}, y=${pa.y}, width=${pa.width}`);
            });
          });
        }
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

checkTemplates();
