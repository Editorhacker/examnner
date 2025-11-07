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
    TableName: "Degree",
    AttributeDefinitions: [
        { AttributeName: "rollno", AttributeType: "S" },
    ],
    KeySchema: [
        { AttributeName: "rollno", KeyType: "HASH" }, // Partition Key only
    ],
  
     BillingMode: "PAY_PER_REQUEST"  // ✅ Add this line

};


(async () => {
    try {
        const data = await client.send(new CreateTableCommand(params));
        console.log("Table created successfully:", data);
    } catch (err) {
        console.error("Error creating table:", err);
    }
})();
