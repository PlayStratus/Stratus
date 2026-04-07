import express from "express"

import { ControllerCreateSession, ControllerGetNodes} from "./playController.js"

const router = express.Router()
//plan to add implement put for updating username.

router.post("/session", ControllerCreateSession)

router.get("/nodes", ControllerGetNodes)

export default router
