const { GetItemCommand } = require("@aws-sdk/client-dynamodb");
require("dotenv").config({ path: "../.env" });
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const ddb = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

async function test() {
    const data = await ddb.send(new GetItemCommand({
        TableName: "Degree",
        Key: { rollno: { S: "247525" } } // your test roll number
    }));
    console.log("Result:", data);
}

test();
