import * as authController from '../controllers/auth.controller';
import * as itemController from '../controllers/item.controller';

import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware';

const router = Router();

// Public auth routes
router.post('/authenticate', authController.authenticate);
router.post('/newuser',      authController.registerUser);

// Protected auth routes
router.get('/users',  ...authMiddleware, authController.getUsers);
router.post('/logout', ...authMiddleware, authController.logout);

// Protected item routes — all require valid, non-blacklisted token
router.get('/items',         ...authMiddleware, itemController.getItems);
router.post('/newitem',      ...authMiddleware, itemController.createItem);
router.post('/removeitem',   ...authMiddleware, itemController.removeItem);
router.post('/placebid',     ...authMiddleware, itemController.placeBid);
router.post('/items/buynow', ...authMiddleware, itemController.buyNow);

// Handle JWT errors
router.use(authMiddleware[1] as unknown as Router); // handleJwtError is the second middleware in the array

export default router;
