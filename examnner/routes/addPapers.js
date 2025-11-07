const express = require("express");
const router = express.Router();

// Render the addPapers page
router.get("/", (req, res) => {
    res.render("ExamDepartment/addPapers");
});

module.exports = router;
