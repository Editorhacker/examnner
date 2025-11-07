require("dotenv").config({ path: "../.env" });
const express = require("express");
const { DynamoDBClient, ScanCommand, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall, marshall } = require("@aws-sdk/util-dynamodb");
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const router = express.Router();

// DynamoDB client
const ddb = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const TABLE_NAME = "Papers";

// Show all papers
router.get("/", async (req, res) => {
    try {
        const data = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
        const papers = data.Items.map(item => unmarshall(item));
        res.render("ExamDepartment/showPapers", { papers });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching papers");
    }
});

// Delete a paper
router.post("/delete/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await ddb.send(new DeleteItemCommand({
            TableName: TABLE_NAME,
            Key: marshall({ paperId: id })  // paperId is the partition key
        }));

        
        req.flash("success", "Paper deleted successfully!");
        res.redirect("/showPapers");
    } catch (err) {
        console.error(err);
        req.flash("error", "Error deleting paper.");
        res.redirect("/showPapers");
    }
});

module.exports = router;
