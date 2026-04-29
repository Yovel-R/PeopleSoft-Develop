const express = require("express");
const multer = require("multer");
const sendEmail = require("../utilities/sendEmail");
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() }); // store files in RAM

// SEND EMAIL API
router.post(
  "/send-documents",
  upload.array("files"), // receives: files[]
  async (req, res) => {
    try {
      const { internName, internId } = req.body;

      // Prepare attachments
      const attachments = req.files.map((file) => ({
        filename: file.originalname,
        content: file.buffer,
        contentType: "application/pdf",
      }));

      // Call our resend utility
      await sendEmail({
        to: process.env.RECIVER_EMAIL_USER,
        subject: `Intern Documents - ${internName} (${internId})`,
        html: `
          <p>Hi Admin,</p>
          <p>Please find attached all internship documents for the following intern:</p>
          <p><b>Intern Name :</b> ${internName}</p>
          <p><b>Intern ID :</b> ${internId}</p>
          <p>Thanks.</p>
        `,
        attachments,
      });

      res.status(200).json({ message: "Email sent successfully!" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Email sending failed." });
    }
  }
);

module.exports = router;
