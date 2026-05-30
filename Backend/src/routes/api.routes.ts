import * as authController from '../controllers/auth.controller';
import * as itemController from '../controllers/item.controller';

import { authenticate, handleJwtError, checkBlacklist } from '../middlewares/auth.middleware';
import { placeBid } from '../controllers/item.controller';
import { logout } from '../controllers/auth.controller';
import { Router } from 'express';

const router = Router();

// Auth routes
router.post('/authenticate',    authController.authenticate);
router.post('/newuser',         authController.registerUser);
router.get('/users',            authenticate, authController.getUsers);

// Item routes
router.post('/removeitem',  authenticate, itemController.removeItem);
router.post('/newitem',     authenticate, itemController.createItem);
router.post('/logout',      authenticate, checkBlacklist, logout);
router.post('/placebid',    authenticate, placeBid);
router.get('/items',        authenticate, checkBlacklist, itemController.getItems);

// Handle JWT errors
router.use(handleJwtError);

export default router;