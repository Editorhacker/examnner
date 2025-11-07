const { DynamoDBClient, CreateTableCommand } = require("@aws-sdk/client-dynamodb");
require("dotenv").config({ path: "../.env" });

const ddb = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const params = {
    TableName: "Students",
    AttributeDefinitions: [
        { AttributeName: "rollNumber", AttributeType: "S" },
    ],
    KeySchema: [
        { AttributeName: "rollNumber", KeyType: "HASH" }, // Partition Key
    ],
    BillingMode: "PAY_PER_REQUEST"

};

async function createTable() {
    try {
        const data = await ddb.send(new CreateTableCommand(params));
        console.log("Table created successfully:", data.TableDescription.TableName);
    } catch (err) {
        console.error("Error creating table:", err);
    }
}

createTable();
