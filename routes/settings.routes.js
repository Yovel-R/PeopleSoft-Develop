const express = require('express');
const router = express.Router();
const Company = require('../models/CompanyModel');
const verifyTenant = require('../middleware/tenant.middleware');

/**
 * @route GET /api/settings/company
 * @desc Get current company settings
 * @access Private (HR Admin)
 */
router.get('/company', verifyTenant, async (req, res) => {
  try {
    const company = await Company.findById(req.tenant.companyId);
    if (!company) {
      return res.status(404).json({ success: false, msg: 'Company not found' });
    }

    res.json({
      success: true,
      settings: company.settings,
      offerLetterSettings: company.offerLetterSettings,
      company: {
        name: company.name,
        companyCode: company.companyCode
      }
    });
  } catch (error) {
    console.error('Fetch Settings Error:', error);
    res.status(500).json({ success: false, msg: 'Server error fetching settings' });
  }
});

/**
 * @route PUT /api/settings/company
 * @desc Update company settings
 * @access Private (HR Admin)
 */
router.put('/company', verifyTenant, async (req, res) => {
  try {
    const { receivingEmail, themeColor, locations, communication, offerLetterSettings } = req.body;
    
    const company = await Company.findById(req.tenant.companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    if (!company.settings) {
      company.settings = {};
    }

    if (receivingEmail !== undefined) company.settings.receivingEmail = receivingEmail;
    if (themeColor !== undefined) company.settings.themeColor = themeColor;
    if (locations !== undefined) company.settings.locations = locations;
    if (communication !== undefined) company.settings.communication = communication;
    
    if (offerLetterSettings !== undefined) {
      company.offerLetterSettings = {
        ...company.offerLetterSettings,
        ...offerLetterSettings
      };
    }

    await company.save();

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: company.settings
    });
  } catch (error) {
    console.error('Update Settings Error:', error);
    res.status(500).json({ success: false, message: 'Server error updating settings' });
  }
});

/**
 * @route GET /api/settings/public
 * @desc Get public settings (locations) for mobile app
 * @access Private (Any Auth User)
 */
router.get('/public', verifyTenant, async (req, res) => {
  try {
    const company = await Company.findById(req.tenant.companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    res.json({
      success: true,
      locations: company.settings?.locations || [],
      themeColor: company.settings?.themeColor || '#00657F'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
