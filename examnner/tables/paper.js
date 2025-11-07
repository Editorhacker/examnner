const { DynamoDBClient, CreateTableCommand } = require("@aws-sdk/client-dynamodb");
require("dotenv").config({ path: "../.env" });


const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const params = {
    TableName: "Papers",
    AttributeDefinitions: [
        { AttributeName: "paperId", AttributeType: "S" },
    ],
    KeySchema: [
        { AttributeName: "paperId", KeyType: "HASH" },
    ],
    ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
    },
};

(async () => {
    try {
        const data = await client.send(new CreateTableCommand(params));
        console.log("Papers table created successfully:", data);
    } catch (err) {
        console.error("Error creating Papers table:", err);
    }
})();
