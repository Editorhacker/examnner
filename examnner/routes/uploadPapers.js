require("dotenv").config({ path: "../.env" });
const express = require("express");
const multer = require("multer");
const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const multerS3 = require("multer-s3");
const { v4: uuidv4 } = require("uuid");
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");

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
    bucket: process.env.AWS_S3_BUCKET_NAME,
    key: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// DynamoDB client
const ddb = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Render the upload form
router.get("/", (req, res) => {
  res.render("ExamDepartment/uploadPapers", { success: req.flash("success"), error: req.flash("error") });
});

// Handle form submission
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const { department, year, subject, qpCode } = req.body;

    // Generate pre-signed URL for the uploaded file
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: req.file.key,
    });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour

    // Prepare item for DynamoDB
    const paperItem = {
      TableName: "Papers",
      Item: {
        paperId: { S: uuidv4() },     // Unique ID
        department: { S: department },
        year: { S: year },
        subject: { S: subject },
        qpCode: { S: qpCode },
        fileKey: { S: req.file.key },
        fileUrl: { S: signedUrl },
        uploadedAt: { S: new Date().toISOString() },
      },
    };

    // Save to DynamoDB
    await ddb.send(new PutItemCommand(paperItem));

    req.flash("success", "Paper uploaded successfully!");
    res.redirect("/uploadPapers");
  } catch (err) {
    console.error(err);
    req.flash("error", "Error uploading paper.");
    res.redirect("/uploadPapers");
  }
});

module.exports = router;
