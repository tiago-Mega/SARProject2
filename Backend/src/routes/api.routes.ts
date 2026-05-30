import * as authController from '../controllers/auth.controller';
import * as itemController from '../controllers/item.controller';

import { authenticate, handleJwtError, checkBlacklist } from '../middlewares/auth.middleware';
import { placeBid } from '../controllers/item.controller';
import { logout } from '../controllers/auth.controller';
import { Router } from 'express';

const router = Router();

// Public auth routes
router.post('/authenticate', authController.authenticate);
router.post('/newuser',      authController.registerUser);

// Protected auth routes
router.get('/users',  authenticate, checkBlacklist, authController.getUsers);
router.post('/logout', authenticate, checkBlacklist, logout);

// Protected item routes — all require valid, non-blacklisted token
router.get('/items',       authenticate, checkBlacklist, itemController.getItems);
router.post('/newitem',    authenticate, checkBlacklist, itemController.createItem);
router.post('/removeitem', authenticate, checkBlacklist, itemController.removeItem);
router.post('/placebid',   authenticate, checkBlacklist, placeBid);

// Handle JWT errors
router.use(handleJwtError);

export default router;
