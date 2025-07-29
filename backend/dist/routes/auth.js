"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const joi_1 = __importDefault(require("joi"));
const User_1 = require("../models/User");
const validation_1 = require("../middleware/validation");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../config/logger");
const router = express_1.default.Router();
// Validation schemas
const registerSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(100).required(),
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(6).required()
});
const loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().required()
});
// Generate JWT token
const generateToken = (userId) => {
    return jsonwebtoken_1.default.sign({ userId }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
};
// Register new user
router.post('/register', (0, validation_1.validateRequest)(registerSchema), async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        // Check if user already exists
        const existingUser = await User_1.User.findOne({ email });
        if (existingUser) {
            throw new errorHandler_1.CustomError('User already exists with this email', 409);
        }
        // Create new user
        const user = new User_1.User({
            name,
            email,
            password
        });
        await user.save();
        // Generate token
        const token = generateToken(user._id.toString());
        logger_1.logger.info('User registered', { userId: user._id, email });
        const response = {
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
    }
    catch (error) {
        next(error);
    }
});
// Login user
router.post('/login', (0, validation_1.validateRequest)(loginSchema), async (req, res, next) => {
    try {
        const { email, password } = req.body;
        // Find user and include password field
        const user = await User_1.User.findOne({ email }).select('+password');
        if (!user) {
            throw new errorHandler_1.CustomError('Invalid email or password', 401);
        }
        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            throw new errorHandler_1.CustomError('Invalid email or password', 401);
        }
        // Generate token
        const token = generateToken(user._id.toString());
        logger_1.logger.info('User logged in', { userId: user._id, email });
        const response = {
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
    }
    catch (error) {
        next(error);
    }
});
// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        if (!token) {
            throw new errorHandler_1.CustomError('Access token required', 401);
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        const user = await User_1.User.findById(decoded.userId);
        if (!user) {
            throw new errorHandler_1.CustomError('User not found', 401);
        }
        req.user = user;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            next(new errorHandler_1.CustomError('Invalid token', 401));
        }
        else {
            next(error);
        }
    }
};
exports.authenticateToken = authenticateToken;
// Get current user profile
router.get('/profile', exports.authenticateToken, async (req, res, next) => {
    try {
        const response = {
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
    }
    catch (error) {
        next(error);
    }
});
// Update user profile
router.put('/profile', exports.authenticateToken, async (req, res, next) => {
    try {
        const { name } = req.body;
        const updates = {};
        if (name)
            updates.name = name;
        const user = await User_1.User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
        logger_1.logger.info('User profile updated', { userId: user?._id });
        const response = {
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
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map