import express from 'express';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { User } from '../models/User';
import { validateRequest } from '../middleware/validation';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import type { ApiResponse } from '../types';

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Generate JWT token
const generateToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Register new user
router.post('/register', validateRequest(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new CustomError('User already exists with this email', 409);
    }
    
    // Create new user
    const user = new User({
      name,
      email,
      password
    });
    
    await user.save();
    
    // Generate token
    const token = generateToken(user._id.toString());
    
    logger.info('User registered', { userId: user._id, email });
    
    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          subscription: user.subscription,
          credits: user.credits
        },
        token
      },
      message: 'User registered successfully'
    };
    
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// Login user
router.post('/login', validateRequest(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new CustomError('Invalid email or password', 401);
    }
    
    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new CustomError('Invalid email or password', 401);
    }
    
    // Generate token
    const token = generateToken(user._id.toString());
    
    logger.info('User logged in', { userId: user._id, email });
    
    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          subscription: user.subscription,
          credits: user.credits
        },
        token
      },
      message: 'Login successful'
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Middleware to verify JWT token
export const authenticateToken = async (req: any, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      throw new CustomError('Access token required', 401);
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as { userId: string };
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      throw new CustomError('User not found', 401);
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new CustomError('Invalid token', 401));
    } else {
      next(error);
    }
  }
};

// Get current user profile
router.get('/profile', authenticateToken, async (req: any, res, next) => {
  try {
    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          subscription: req.user.subscription,
          credits: req.user.credits,
          createdAt: req.user.createdAt
        }
      }
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: any, res, next) => {
  try {
    const { name } = req.body;
    
    const updates: any = {};
    if (name) updates.name = name;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );
    
    logger.info('User profile updated', { userId: user?._id });
    
    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: user?._id,
          name: user?.name,
          email: user?.email,
          subscription: user?.subscription,
          credits: user?.credits
        }
      },
      message: 'Profile updated successfully'
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;