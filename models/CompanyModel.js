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
