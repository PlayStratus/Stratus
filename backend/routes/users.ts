import express from "express"

import {
  ControllerGetUser,
  ControllerCreateUser,
  ControllerGetUserByToken,
  ControllerRefreshToken,
} from "./usersController.ts"

const router = express.Router()
//plan to add implement put for updating username.

router.post("/signin", ControllerGetUser)
router.post("/create", ControllerCreateUser)
router.get("/refresh", ControllerRefreshToken)
router.get("/", ControllerGetUserByToken)

// router.post("/login", ControllerGetUserByCredentials)
// router.post("/logout", ControllerLogout)
// router.post("/refresh", ControllerRefreshToken)
// router.post("/signup", ControllerCreateUser)
// router.get("/verify", ControllerVerifyToken)

export default router
