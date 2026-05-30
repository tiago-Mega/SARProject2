import { NextFunction, Request, Response } from 'express';
import BlacklistedToken from '../models/blacklistedToken';
import { expressjwt } from 'express-jwt';
import config from '../config/config';

// JWT authentication middleware
export const authenticate = expressjwt({
  secret: config.jwtSecret,
  algorithms: ['HS256']
});

// Middleware to check if the token is blacklisted
export const checkBlacklist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  if (token) {
    const blacklisted = await BlacklistedToken.findOne({ token });
    if (blacklisted) {
      res.status(401).json({ message: 'Token has been invalidated. Please log in again.' });
      return;
    }
  }
  next();
};

// Error handler for JWT authentication
export const handleJwtError = (err: unknown, req: Request, res: Response, next: NextFunction): void => {
  const authError = err as { name?: string };
  if (authError.name === 'UnauthorizedError') {
    res.status(401).json({
      status: 'error',
      message: 'Invalid token. Please log in again.'
    });
  } else {
    next(err);
  }
};