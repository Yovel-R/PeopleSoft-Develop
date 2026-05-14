const express = require('express');
const router = express.Router();
const PerformanceTemplate = require('../models/PerformanceTemplate');
const verifyTenant = require('../middleware/tenant.middleware');

// @route   GET /api/performance-templates
// @desc    Get all templates for the company
router.get('/', verifyTenant, async (req, res) => {
  try {
    const templates = await PerformanceTemplate.find({ companyId: req.tenant.companyId });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/performance-templates/role/:roleName
// @desc    Get templates for a specific role
router.get('/role/:roleName', verifyTenant, async (req, res) => {
  try {
    const templates = await PerformanceTemplate.find({ 
      companyId: req.tenant.companyId,
      roleName: { $regex: new RegExp(`^${req.params.roleName}$`, "i") }
    });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/performance-templates
// @desc    Create or update a template
router.post('/', verifyTenant, async (req, res) => {
  try {
    const { roleName, category, goals } = req.body;
    
    let template = await PerformanceTemplate.findOne({
      companyId: req.tenant.companyId,
      roleName,
      category
    });

    if (template) {
      template.goals = goals;
      await template.save();
    } else {
      template = new PerformanceTemplate({
        companyId: req.tenant.companyId,
        roleName,
        category,
        goals
      });
      await template.save();
    }

    res.json(template);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// @route   DELETE /api/performance-templates/:id
// @desc    Delete a template
router.delete('/:id', verifyTenant, async (req, res) => {
  try {
    await PerformanceTemplate.findOneAndDelete({
      _id: req.params.id,
      companyId: req.tenant.companyId
    });
    res.json({ message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
