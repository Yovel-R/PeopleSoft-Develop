const mongoose = require("mongoose");
require("dotenv").config({ path: "./.env" });

const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/hrm";

mongoose.connect(mongoURI)
  .then(async () => {
    console.log("Connected to MongoDB successfully!");
    
    const Intern = mongoose.model("Intern", new mongoose.Schema({}, { strict: false }));
    const Company = mongoose.model("Company", new mongoose.Schema({}, { strict: false }), "companies");
    
    console.log("\n--- COMPANYS ---");
    const companies = await Company.find({});
    companies.forEach(c => {
      console.log(`Company ID: ${c._id}, companyCode: ${c.companyCode}, name: ${c.companyName || c.name}`);
    });
    
    console.log("\n--- DEMO INTERN ---");
    const demoIntern = await Intern.findOne({ email: "demo001@gmail.com" });
    if (demoIntern) {
      console.log(JSON.stringify(demoIntern, null, 2));
    } else {
      console.log("demo001@gmail.com intern not found!");
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  });
