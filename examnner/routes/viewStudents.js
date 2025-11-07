require("dotenv").config({ path: "../.env" });
const express = require("express");
const { DynamoDBClient, ScanCommand, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall, marshall } = require("@aws-sdk/util-dynamodb");

const router = express.Router();
const ddb = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const TABLE_NAME = "Degree"; // DynamoDB table name

// Render Students List
router.get("/", async (req, res) => {
    try {
        const data = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
        const students = data.Items.map(item => unmarshall(item));
        res.render("viewStudents", { students });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// Delete Student
router.post("/delete/:id", async (req, res) => {
    try {
        const { id } = req.params;

        await ddb.send(new DeleteItemCommand({
            TableName: TABLE_NAME,
            Key: marshall({ rollno: id })
        }));

        req.flash("success", "Student deleted successfully!");
        res.redirect("/viewStudents");
    } catch (err) {
        console.error(err);
        req.flash("error", "Error deleting student.");
        res.redirect("/viewStudents");
    }
});

module.exports = router;
