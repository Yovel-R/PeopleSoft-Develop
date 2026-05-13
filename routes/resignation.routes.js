// module.exports = router;
const express = require("express");
const router = express.Router();
const verifyTenant = require("../middleware/tenant.middleware");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() }); 


// Import your controller once
const resignationController = require("../controllers/resignation.controller");

// Create a resignation request
router.post("/submit", verifyTenant, resignationController.createResignation);

router.get("/check/:userId", verifyTenant, resignationController.checkResignation);
// Get all resignation requests
router.get("/all", verifyTenant, resignationController.getAllResignations);

router.get("/pending", verifyTenant, resignationController.getPendingResignations);
router.get("/manager-pending/:managerId", verifyTenant, resignationController.getManagerPendingResignations);

// Get resignation by userId
router.get("/:userId", verifyTenant, resignationController.getResignationByUserId);

// Manager Review
router.put("/manager-review/:id", verifyTenant, resignationController.managerReview);

// HR Review (Accept or reject resignation)
router.put("/hr-review/:action/:id", verifyTenant, upload.array("files"), resignationController.hrReview);

// router.get("/pending", verifyTenant, resignationController.getPendingResignations);
module.exports = router;
