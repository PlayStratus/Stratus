import express from 'express';
import { ControllerGetUserById, ControllerCreateUser} from './usersController.mjs';

const router = express.Router();
                                                                        //plan to add implement put for updating username.
router.get('/:id', ControllerGetUserById);                                     

router.post('/', ControllerCreateUser);

//router.put('/:id', Controller); 

export default router;