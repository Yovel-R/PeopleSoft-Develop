const jwt = require('jsonwebtoken');
const Company = require('../models/CompanyModel');

const verifyTenant = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');

    // Make sure user has a companyId
    if (!decoded.user || !decoded.user.companyId) {
      return res.status(403).json({ message: 'Token does not contain tenant information' });
    }

    const company = await Company.findById(decoded.user.companyId);
    if (!company) {
       return res.status(404).json({ message: 'Tenant/Company not found' });
    }

    req.tenant = {
      companyId: company._id,
      companyCode: company.companyCode,
      receivingEmail: company.settings?.receivingEmail || process.env.RECIVER_EMAIL_USER
    };
    
    // Also attach user info
    req.user = decoded.user;

    const { runWithTenant } = require('../utilities/tenantContext');
    runWithTenant(company._id, () => {
      next();
    });
  } catch (err) {
    console.error("JWT Verification Error:", err.message);
    res.status(401).json({ message: 'Token is not valid: ' + err.message });
  }
};

module.exports = verifyTenant;
