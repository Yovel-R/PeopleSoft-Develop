const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema({
  name: { type: String, required: true },
  domain: { type: String, unique: true, sparse: true }, // e.g., 'acme' for acme.softrate.com
  companyCode: { type: String, unique: true, required: true }, // Short code for login (e.g., ACME123)
  logo: { type: String, default: null },
  subscriptionStatus: { 
    type: String, 
    enum: ['active', 'trial', 'suspended', 'cancelled'], 
    default: 'trial' 
  },
  subscriptionExpiresAt: { type: Date },
  settings: {
    themeColor: { type: String, default: '#00657F' },
    receivingEmail: { type: String, default: null }, // Email to receive system notifications
    locations: [{
      name: { type: String, default: 'Headquarters' },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      radius: { type: Number, default: 200 }, // allowable distance in meters
      addedBy: { type: String, default: 'hr' } // Can be 'hr' or employeeId
    }],
    communication: {
      whatsappNotifications: { type: Boolean, default: false },
      emailNotifications: { type: Boolean, default: true }
    },
    employeeRoles: [{ type: String }],
    internRoles: [{ type: String }],
    hrPolicyUrl: { type: String, default: null },
    hrPolicyUpdatedAt: { type: Date, default: null },
    payrollSettings: {
      pfCalculateEmployee: { type: Boolean, default: false },
      pfCalculateIntern: { type: Boolean, default: false },
      pfPercentage: { type: Number, default: 12 },
      taxPercentage: { type: Number, default: 10 },
      taxLimitThreshold: { type: Number, default: 50000 },

      // LOP (Loss of Pay) Settings
      // Applies to: pending leaves + absence without any approval
      lopSettings: {
        enableLopEmployee:      { type: Boolean, default: false },
        enableLopIntern:        { type: Boolean, default: false },
        // 'percentage' = % of per-day salary deducted | 'amount' = flat ₹ per day
        lopTypeEmployee:        { type: String, enum: ['percentage', 'amount'], default: 'percentage' },
        lopTypeIntern:          { type: String, enum: ['percentage', 'amount'], default: 'percentage' },
        // Used when lopType === 'percentage' (100 = full-day deduction)
        lopPercentageEmployee:  { type: Number, default: 100 },
        lopPercentageIntern:    { type: Number, default: 100 },
        // Used when lopType === 'amount' (flat ₹ per unauthorized day)
        lopAmountEmployee:      { type: Number, default: 0 },
        lopAmountIntern:        { type: Number, default: 0 },
        // Working days per month (used to derive per-day salary from basic)
        workingDaysEmployee:    { type: Number, default: 26 },
        workingDaysIntern:      { type: Number, default: 26 }
      }
    },
    offerLetterSettings: {
      companyName: { type: String, default: 'Softrate Technologies (P) Ltd' },
      address: { type: String, default: 'SOFTRATE TECH PARK, MANGADU, CHENNAI, INDIA, 600 122' },
      contact: { type: String, default: '(+91) 8148633580 | hr@softrateglobal.com' },
      website: { type: String, default: 'www.softrateglobal.com' },
      logoUrl: { type: String, default: null },
      signatureUrl: { type: String, default: null },
      signatoryName: { type: String, default: 'Hiring Manager' },
      signatoryRole: { type: String, default: 'Softrate Global (India)' },
      workLocation: { type: String, default: 'Softrate Tech Park, Chennai' },
      annexureUrl: { type: String, default: null },
      ndaUrl: { type: String, default: null },
      templateContent: { type: String, default: null },
      logoSize: { type: Number, default: 50 },
      borderWidth: { type: Number, default: 10 },
      documentTemplates: {
        offerLetter: { orientation: { type: String, default: 'portrait' }, pages: [{ backgroundUrl: String, placeholders: [{ key: String, x: Number, y: Number, fontSize: Number, isBold: Boolean, color: String }], paragraphs: [mongoose.Schema.Types.Mixed] }] },
        annexure: { orientation: { type: String, default: 'portrait' }, pages: [{ backgroundUrl: String, placeholders: [{ key: String, x: Number, y: Number, fontSize: Number, isBold: Boolean, color: String }], paragraphs: [mongoose.Schema.Types.Mixed] }] },
        nda: { orientation: { type: String, default: 'portrait' }, pages: [{ backgroundUrl: String, placeholders: [{ key: String, x: Number, y: Number, fontSize: Number, isBold: Boolean, color: String }], paragraphs: [mongoose.Schema.Types.Mixed] }] },
        lor: { orientation: { type: String, default: 'landscape' }, pages: [{ backgroundUrl: String, placeholders: [{ key: String, x: Number, y: Number, fontSize: Number, isBold: Boolean, color: String }], paragraphs: [mongoose.Schema.Types.Mixed] }] },
        internshipCompletion: { orientation: { type: String, default: 'landscape' }, pages: [{ backgroundUrl: String, placeholders: [{ key: String, x: Number, y: Number, fontSize: Number, isBold: Boolean, color: String }], paragraphs: [mongoose.Schema.Types.Mixed] }] },
        projectCompletion: { orientation: { type: String, default: 'landscape' }, pages: [{ backgroundUrl: String, placeholders: [{ key: String, x: Number, y: Number, fontSize: Number, isBold: Boolean, color: String }], paragraphs: [mongoose.Schema.Types.Mixed] }] }
      }
    }
  }
}, { timestamps: true });

// Update timestamp on save
CompanySchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model("Company", CompanySchema);
