const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const mongoose = require('mongoose');
const verifyTenant = require("../middleware/tenant.middleware");

// Create a new project
router.post('/create', verifyTenant, async (req, res) => {
  try {
    const project = new Project({ ...req.body, companyId: req.tenant.companyId });
    await project.save();
    res.status(201).json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get projects for a manager
router.get('/manager/:managerId', verifyTenant, async (req, res) => {
  try {
    const projects = await Project.find({ managerId: req.params.managerId, companyId: req.tenant.companyId }).sort({ createdAt: -1 });
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get projects for an intern or employee
router.get('/member/:memberId', verifyTenant, async (req, res) => {
  try {
    const projects = await Project.find({
      'teamMembers.memberId': req.params.memberId,
      companyId: req.tenant.companyId
    }).sort({ createdAt: -1 });
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update project (checklist, team, etc.)
router.put('/update/:projectId', verifyTenant, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, companyId: req.tenant.companyId });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    // Update fields
    Object.assign(project, req.body);
    
    // Progress is auto-calculated in pre-save hook
    await project.save();
    
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle checklist item
router.put('/toggle-task/:projectId/:taskId', verifyTenant, async (req, res) => {
  try {
    const { userId } = req.body;
    const project = await Project.findOne({ _id: req.params.projectId, companyId: req.tenant.companyId });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const task = project.checklist.id(req.params.taskId);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    task.isCompleted = !task.isCompleted;
    if (task.isCompleted) {
      task.completedBy = userId;
      task.completedAt = new Date();
    } else {
      task.completedBy = null;
      task.completedAt = null;
    }

    await project.save();
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete project
router.delete('/:projectId', verifyTenant, async (req, res) => {
  try {
    await Project.findOneAndDelete({ _id: req.params.projectId, companyId: req.tenant.companyId });
    res.json({ success: true, message: 'Project deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
