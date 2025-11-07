const express = require("express");
const router = express.Router();
const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { v4: uuidv4 } = require("uuid");

require("dotenv").config({ path: "../.env" });
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const ddb = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Multer S3 setup
const upload = multer({
    storage: multerS3({
        s3,
        bucket: 'student-photos-app',
        key: (req, file, cb) => {
            const filename = `student_photos/${Date.now()}-${file.originalname}`;
            cb(null, filename);
        }
    })
});

router.post("/submit", upload.single("photo"), async (req, res) => {
    const rollNumber = req.body.rollNumber || req.body.rollno;
    const { roomId } = req.body;

    if (!rollNumber || !roomId || !req.file) {
        return res.status(400).json({ success: false, message: "Missing fields or photo." });
    }

    const s3Url = req.file.location;
    const params = {
        TableName: "Students",
        Item: {
            rollNumber: { S: rollNumber },
            roomId: { S: roomId },
            photoUrl: { S: s3Url },
            createdAt: { S: new Date().toISOString() },
        },
    };

    try {
        await ddb.send(new PutItemCommand(params));
        res.json({ success: true, message: "Student added successfully", photoUrl: s3Url });
    } catch (err) {
        console.error("Error saving student:", err);
        res.status(500).json({ success: false, message: "Failed to save student", error: err.message });
    }
});


module.exports = router;
