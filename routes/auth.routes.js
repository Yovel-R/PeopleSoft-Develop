const express = require("express");
const router = express.Router();
const authController = require("../controllers/AuthController");
const verifyTenant = require("../middleware/tenant.middleware");

router.post("/login", authController.login);
router.get("/me", verifyTenant, authController.getMe);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

module.exports = router;
