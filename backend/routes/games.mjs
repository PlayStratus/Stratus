import express from "express"

import {
  ControllerGetAll,
  ControllerGetID,
} from "./gamesController.mjs"

const router = express.Router()
//plan to add implement put for updating username.

router.get("/:id", ControllerGetID)

router.get("/", ControllerGetAll)


export default router
