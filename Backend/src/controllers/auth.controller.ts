import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

import socketService from '../services/socket.service';
import config from '../config/config';
import User from '../models/user';

/**
 * Handle user authentication
 */
export const authenticate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ message: 'Username and password are required' });
      return;
    }
    const user = await User.findOne({ username });
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    user.islogged = true;
    await user.save();

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      config.jwtSecret,
      { expiresIn: '24h' }
    );
    socketService.newLoggedUserBroadcast({ username: user.username });
    res.status(200).json({ username: user.username, token });
  } catch (error) {
    res.status(500).json({ message: 'Authentication failed', error });
  }
};

/**
 * Handle user registration
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, username, password, latitude, longitude } = req.body;
    if (!name || !email || !username || !password) {
      res.status(400).json({ message: 'All fields are required' });
      return;
    }
    const existing = await User.findOne({ username });
    if (existing) {
      res.status(409).json({ message: 'Username already exists' });
      return;
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name, email, username,
      password: hashedPassword,
      islogged: false,
      latitude: latitude || 0,
      longitude: longitude || 0
    });
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully', username });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error });
  }
};

/**
 * Get all users
 */
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users', error });
  }
};

/**
 * Handle user logout
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.body;
    await User.findOneAndUpdate({ username }, { islogged: false });
    socketService.userLoggedOutBroadcast({ username });
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Logout failed', error });
  }
};
  