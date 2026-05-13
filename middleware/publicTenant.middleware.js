const Company = require('../models/CompanyModel');

/**
 * Middleware to identify a tenant based on a companyCode or companyId in the body/query
 * Used for public routes like registration/onboarding where no JWT exists.
 */
const verifyPublicTenant = async (req, res, next) => {
  try {
    const { companyCode, companyId } = req.body || req.query;

    if (!companyCode && !companyId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tenant identification required (companyCode or companyId)' 
      });
    }

    let company;
    if (companyId) {
      company = await Company.findById(companyId);
    } else {
      company = await Company.findOne({ companyCode: companyCode.toUpperCase() });
    }

    if (!company) {
      return res.status(404).json({ 
        success: false, 
        message: 'Company not found with the provided identifier' 
      });
    }

    // Set tenant context
    req.tenant = {
      companyId: company._id,
      companyCode: company.companyCode,
      receivingEmail: company.settings?.receivingEmail || process.env.RECIVER_EMAIL_USER
    };

    const { runWithTenant } = require('../utilities/tenantContext');
    runWithTenant(company._id, () => {
      next();
    });
  } catch (err) {
    console.error("Public Tenant Verification Error:", err.message);
    res.status(500).json({ success: false, message: 'Server error during tenant verification' });
  }
};

module.exports = verifyPublicTenant;
