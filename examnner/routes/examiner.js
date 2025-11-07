const express = require("express");
const router = express.Router();

// Examiner main page
router.get("/", (req, res) => {
    res.render("Examiner/examiner");
});

module.exports = router;
