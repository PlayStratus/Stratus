import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import "dotenv/config"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"
import usersRoutes from "./routes/users.mjs"

const app = express()
const PORT = process.env.PORT || 4000

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})
export const dynamoDb = DynamoDBDocumentClient.from(client)

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
)

app.use(express.json())
app.use(cookieParser())
app.use("/users", usersRoutes)

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
