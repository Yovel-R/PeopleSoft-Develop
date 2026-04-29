// module.exports = router;
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() }); 


// Import your controller once
const resignationController = require("../controllers/resignation.controller");

// Create a resignation request
router.post("/submit", resignationController.createResignation);

router.get("/check/:internId", resignationController.checkResignation);
// Get all resignation requests
router.get("/all", resignationController.getAllResignations);

router.get("/pending", resignationController.getPendingResignations);

// Get resignation by internId
router.get("/:internId", resignationController.getResignationByInternId);

// Accept or reject resignation
router.put("/:action/:id", upload.array("files"), resignationController.updateResignationStatus);

// router.get("/pending", resignationController.getPendingResignations);
module.exports = router;
