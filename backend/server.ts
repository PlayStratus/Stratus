import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"
import { WebSocketServer } from "ws"
import http from "node:http"

import playRoutes from "./routes/play.js"
import gamesRoutes from "./routes/games.js"
import authRoutes from "./routes/auth.js"

import jwt from "jsonwebtoken"

import { handleMessage } from "./socket/messages.js" //to .js git rebase

import "dotenv/config"

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

app.use("/games", gamesRoutes)
app.use("/auth", authRoutes)
app.use("/play", playRoutes)

/*
Socket, guide https://karlhadwen.medium.com/node-js-websocket-tutorial-real-time-chat-room-using-multiple-clients-44a8e26a953e
*/

let socket: WebSocketServer | null = null

const server = http.createServer(app)
socket = new WebSocketServer({ server })

socket.on("connection", (ws) => {
  ws.on("message", (message) => {
    try {
      const parsed = JSON.parse(message.toString()) //parse message
      handleMessage(ws, parsed) //pass to handle function
    } catch {
      console.error("Invalid JSON received:", message.toString())
    }
  })

  ws.on("close", () => {
    handleMessage(ws, { type: "node_disconnect", payload: {} }) //need further build out
  })

  ws.on("error", (err) => {
    //need further build out
    console.error("WebSocket error:", err)
    handleMessage(ws, { type: "node_disconnect", payload: {} })
  })
})

server.on("upgrade", (request, socket, head) => {
  if (process.env.STRATUSD_PASSWORD) {
    // Enforce basic authentication for stratusd nodes if STRATUSD_PASSWORD is set
    try {
      const ws_pw = `stratusd:${process.env.STRATUSD_PASSWORD}`
      if (!request.headers.authorization) {
        throw new Error("No stratusd password provided")
      }
      if (atob(request.headers.authorization.replace(/Basic /, '')) !== ws_pw) {
        throw new Error("Incorrect stratusd password")
      }
    } catch {
      console.warn(`Failed stratusd authentication from ${request.socket.remoteAddress}`)
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
  }
})

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})

/*
Example on how to generate temp token for get and post testing
const token = jwt.sign(
    { userId: "test-user-id", email: "test@oregonstate.edu" },
    process.env.AUTH_SECRET as string,
    { expiresIn: "7d" }
)

console.log(token)*/
