import express from "express"

import {
  ControllerCreateUser,
  ControllerGetUserByCredentials,
  ControllerRefreshToken,
  ControllerVerifyToken,
  ControllerLogout,
} from "./usersController.ts"

const router = express.Router()
//plan to add implement put for updating username.

router.post("/login", ControllerGetUserByCredentials)
router.post("/logout", ControllerLogout)
router.post("/refresh", ControllerRefreshToken)
router.post("/signup", ControllerCreateUser)
router.get("/verify", ControllerVerifyToken)

export default router
