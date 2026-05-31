import { NextFunction, Request, RequestHandler, Response } from 'express';
import { expressjwt } from 'express-jwt';
import config from '../config/config';
import BlacklistedToken from '../models/blacklistedToken';

// JWT authentication middleware
const authenticate = expressjwt({
  secret: config.jwtSecret,
  algorithms: ['HS256'],
  requestProperty: 'auth'
});

// Middleware to check if the token is blacklisted
const checkBlacklist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  try {
    const blacklisted = await BlacklistedToken.findOne({ token });
    if (blacklisted) {
      res.status(401).json({ message: 'Token has been invalidated. Please log in again.' });
      return;
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Auth check failed', error });
  }
};

// Error handler for JWT authentication
const handleJwtError = (err: unknown, req: Request, res: Response, next: NextFunction): void => {
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

const authMiddleware = [
  authenticate as RequestHandler,
  handleJwtError as unknown as RequestHandler,
  checkBlacklist as RequestHandler
];

export default authMiddleware;