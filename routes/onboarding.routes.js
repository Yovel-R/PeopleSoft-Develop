const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Company = require('../models/CompanyModel');
const User = require('../models/User');
const Role = require('../models/Role');

/**
 * @route POST /api/onboarding/register
 * @desc Register a new SaaS tenant/company and the initial HR admin
 * @access Public
 */
router.post('/register', async (req, res) => {
  try {
    const { companyName, companyCode, hrName, hrEmail, hrPassword } = req.body;

    if (!companyName || !companyCode || !hrName || !hrEmail || !hrPassword) {
      return res.status(400).json({ success: false, msg: 'All fields are required.' });
    }

    // 1. Check if Company Code is already taken
    const existingCompany = await Company.findOne({ companyCode: { $regex: new RegExp(`^${companyCode}$`, 'i') } });
    if (existingCompany) {
      return res.status(400).json({ success: false, msg: 'Company Code is already taken. Please choose another.' });
    }

    // 2. Check if HR email is already taken across ANY company (since email is usually the global login)
    // Actually, in multi-tenant, email uniqueness is usually per company, but for HR admins logging in from a global portal, it should probably be globally unique.
    // However, our UserSchema enforces uniqueness per company: { companyId: 1, email: 1 }
    // Let's do a global check here just to be safe for initial admins to prevent confusion.
    const existingUser = await User.findOne({ email: { $regex: new RegExp(`^${hrEmail}$`, 'i') } });
    if (existingUser) {
      return res.status(400).json({ success: false, msg: 'Email is already registered. Please use another.' });
    }

    // 3. Create Company
    const newCompany = new Company({
      name: companyName,
      companyCode: companyCode.toUpperCase(),
      subscriptionStatus: 'trial', // Default 
    });

    const savedCompany = await newCompany.save();

    // 4. Create the System Default HR_ADMIN Role
    const adminRole = new Role({
      companyId: savedCompany._id,
      name: 'HR_ADMIN',
      description: 'Master administrator for the company',
      permissions: ['*'], // Full access
      isSystemDefined: true
    });
    const savedRole = await adminRole.save();

    // 5. Hash HR Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(hrPassword, salt);

    // 6. Create HR Admin User tied to Company
    const newUser = new User({
      companyId: savedCompany._id,
      email: hrEmail.toLowerCase(),
      password: hashedPassword,
      roleId: savedRole._id,
      profile: {
        firstName: hrName
      },
      employment: {
        type: 'FULL_TIME',
        designation: 'HR Administrator'
      }
    });

    const savedUser = await newUser.save();

    // 7. Generate JWT Token for immediate login
    // We keep role: 'hr' for backward compatibility with the frontend until it's fully migrated
    const token = jwt.sign(
      { user: { id: savedUser._id, companyId: savedCompany._id, role: 'hr' } },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '1d' }
    );

    res.status(201).json({
      success: true,
      msg: 'Company and HR Admin registered successfully!',
      token,
      hr: {
        id: savedUser._id,
        name: savedUser.profile.firstName,
        email: savedUser.email,
        companyId: savedCompany._id
      },
      company: {
        id: savedCompany._id,
        name: savedCompany.name,
        companyCode: savedCompany.companyCode
      }
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ success: false, msg: 'Server error during registration.', error: error.message });
  }
});

/**
 * @route GET /api/onboarding/verify/:code
 * @desc Verify if a company code is valid and return company name
 * @access Public
 */
router.get('/verify/:code', async (req, res) => {
  try {
    const code = req.params.code;
    const company = await Company.findOne({ 
      companyCode: { $regex: new RegExp(`^${code}$`, 'i') } 
    }).select('name companyCode');

    if (!company) {
      return res.status(404).json({ success: false, msg: 'Invalid Company Code.' });
    }

    res.json({
      success: true,
      company: {
        id: company._id,
        name: company.name,
        companyCode: company.companyCode
      }
    });
  } catch (error) {
    console.error('Verify Error:', error);
    res.status(500).json({ success: false, msg: 'Server error during verification.' });
  }
});

module.exports = router;
