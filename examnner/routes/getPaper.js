require("dotenv").config({ path: "../.env" });
const express = require("express");
const router = express.Router();
const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const TABLE_NAME = "Papers";

// DynamoDB
const ddb = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// S3
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// GET /getpaper?qpCode=xxxx
router.get("/", async (req, res) => {
  const { qpCode } = req.query;

  if (!qpCode) {
    return res.status(400).json({ success: false, message: "QP Code is required" });
  }

  try {
    // Scan for qpCode
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "qpCode = :qp",
        ExpressionAttributeValues: { ":qp": { S: qpCode } },
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return res.status(404).json({ success: false, message: "Paper not found" });
    }

    const paper = unmarshall(result.Items[0]); // Convert DynamoDB JSON → Normal JSON

    // Generate NEW pre-signed URL (so it always works)
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: paper.fileKey,
    });

    const newSignedUrl = await getSignedUrl(s3, command); // 1 hr

    return res.json({
      success: true,
      data: newSignedUrl,
    });

  } catch (error) {
    console.error("Error fetching paper:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
