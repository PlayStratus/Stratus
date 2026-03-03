import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import "dotenv/config"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"
import usersRoutes from "./routes/users.js"
import gamesRoutes from "./routes/games.js"

const app = express()
const PORT = process.env.PORT || 4000

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-west-2",
})

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error("Missing AWS credentials env vars")
}

export const dynamoDb = DynamoDBDocumentClient.from(client)

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
)

app.use(express.json())
app.use(cookieParser())
app.use("/users", usersRoutes)
app.use("/games", gamesRoutes)

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
