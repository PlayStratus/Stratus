import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import "dotenv/config"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"
import usersRoutes from "./routes/users.js"
import gamesRoutes from "./routes/games.js"
import { WebSocketServer } from "ws"
import { handleMessage } from "./socket/messages.js"    //to .js git rebase
import http from 'http'


const app = express()
const PORT = process.env.PORT || 4000

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-west-2",
})

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

/*
Socket, guide https://karlhadwen.medium.com/node-js-websocket-tutorial-real-time-chat-room-using-multiple-clients-44a8e26a953e
*/

let socket: WebSocketServer | null = null


  const server = http.createServer(app);
  socket = new WebSocketServer({server});

  socket.on("connection", (ws) => {           
    console.log("New WebSocket connection")

    ws.on("message", (message) => {
      try {
        const parsed = JSON.parse(message.toString())                   //parse message
        handleMessage(ws, parsed)                                       //pass to handle function
      } catch {
        console.error("Invalid JSON received:", message.toString())
      }
    })

    ws.on("close", () => {
      handleMessage(ws, { type: "node_disconnect", payload: {} })       //need further build out
    })

    ws.on("error", (err) => {                                           //need further build out
      console.error("WebSocket error:", err)
      handleMessage(ws, { type: "node_disconnect", payload: {} })
    })
  })

  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`)
  });


