import express from "express"

import { ControllerCreateSession } from "./playController.js"

const router = express.Router()
//plan to add implement put for updating username.

router.post("/session", ControllerCreateSession)

export default router
