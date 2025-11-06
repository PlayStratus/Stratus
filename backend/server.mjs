import express from 'express';
import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import usersRoutes from './routes/users.mjs';

const app = express();
const PORT = process.env.PORT;
                                                                  //username and userID verify with oauth not yet implmented
                                                                  // DynamoDB setup
const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
export const dynamoDb = DynamoDBDocumentClient.from(client);

app.use(express.json());
app.use('/users', usersRoutes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
