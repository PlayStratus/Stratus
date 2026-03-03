import express from "express"

import { ControllerGetAll, ControllerGetByID } from "./gamesController.js"

const router = express.Router()

router.get("/:id", ControllerGetByID)

router.get("/", ControllerGetAll)

export default router
