const express = require("express");
const router = express.Router();
const authController = require("../controllers/AuthController");
const verifyTenant = require("../middleware/tenant.middleware");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Intern = require("../models/Intern");
const Employee = require("../models/EmployeeModel");
const User = require("../models/User");

router.post("/login", authController.login);
router.post("/unified-login", authController.login);
router.get("/me", verifyTenant, authController.getMe);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/verify-company/:code", authController.verifyCompany);

module.exports = router;
