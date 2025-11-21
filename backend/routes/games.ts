import express from "express"

import { ControllerGetAll, ControllerGetByID } from "./gamesController.ts"

const router = express.Router()

router.get("/:id", ControllerGetByID)

router.get("/", ControllerGetAll)

export default router
