import express from "express"

import {
  ControllerGetAll,
  ControllerGetByID,
} from "./gamesController.js"

const router = express.Router()
//plan to add implement put for updating username.

router.get("/:id", ControllerGetByID)

router.get("/", ControllerGetAll)


export default router
