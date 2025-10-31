import express from 'express';
import { ControlGetUserById, ControlCreateUser } from './usersController.mjs';

const router = express.Router();

router.get('/:id', ControlGetUserById);       
router.post('/', ControlCreateUser);     

export default router;