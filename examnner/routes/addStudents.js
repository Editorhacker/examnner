const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { S3Client } = require("@aws-sdk/client-s3");
const multerS3 = require("multer-s3");
const { DynamoDBClient, PutItemCommand, QueryCommand  } = require("@aws-sdk/client-dynamodb");
require("dotenv").config({ path: "../.env" });

const router = express.Router();

// AWS S3 Client setup
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Multer setup for S3
const upload = multer({
    storage: multerS3({
        s3,
        bucket: 'student-photos-app',
        key: (req, file, cb) => cb(null, `student_photos/${Date.now()}-${file.originalname}`),
    }),
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/jpg"];
        cb(null, allowed.includes(file.mimetype));
    },
});

// Render form
router.get("/", (req, res) => {
    res.render("addStudents", { success: req.flash("success"), error: req.flash("error") });
});

// Handle form submission
router.post("/", upload.single("photo"), async (req, res) => {
    try {
        const { rollno, department, year } = req.body;
        const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

        // Check if rollno already exists
        const getParams = {
            TableName: "Degree",
            KeyConditionExpression: "rollno = :r",
            ExpressionAttributeValues: {
                ":r": { S: rollno },
            },
        };

        const existing = await ddb.send(new QueryCommand(getParams));
        if (existing.Items && existing.Items.length > 0) {
            req.flash("error", "Roll number already exists.");
            return res.redirect("/addStudents");
        }

        // Generate unique studentId
        const studentId = uuidv4();

        // Prepare item for DynamoDB
        const studentItem = {
            TableName: "Degree",
            Item: {
                rollno: { S: rollno },           // Partition key
                studentId: { S: studentId },     // Sort key
                department: { S: department },
                year: { S: year },
                photoUrl: { S: req.file.location },
                createdAt: { S: new Date().toISOString() },
            },
        };

        // Save to DynamoDB
        await ddb.send(new PutItemCommand(studentItem));

        req.flash("success", "Data saved successfully!");
        res.redirect("/viewStudents");
    } catch (err) {
        console.error(err);
        req.flash("error", "Error saving data.");
        res.redirect("/addStudents");
    }
});

module.exports = router;