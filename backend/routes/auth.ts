import express from "express"

import {
  ControllerCreateUser,
  ControllerGetUserByToken,
  ControllerGoogleAuth,
  ControllerLogout,
} from "./authController.js"

const router = express.Router()

router.post("/google", ControllerGoogleAuth)
router.post("/create", ControllerCreateUser)
router.get("/", ControllerGetUserByToken)
router.post("/logout", ControllerLogout)

export default router
