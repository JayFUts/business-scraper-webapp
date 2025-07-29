"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./config/database");
const logger_1 = require("./config/logger");
const redis_1 = require("./config/redis");
const errorHandler_1 = require("./middleware/errorHandler");
// Routes
const search_1 = __importDefault(require("./routes/search"));
const business_1 = __importDefault(require("./routes/business"));
const auth_1 = __importDefault(require("./routes/auth"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://yourdomain.com', 'http://localhost:3000', 'http://localhost:80']
        : ['http://localhost:3000'],
    credentials: true
}));
// Rate limiting - more permissive for development
const limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute 
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'), // 1000 requests per minute
    message: { error: 'Too many requests, please try again later' }
});
app.use('/api', limiter);
// Body parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
// API routes
app.use('/api/search', search_1.default);
app.use('/api/business', business_1.default);
app.use('/api/auth', auth_1.default);
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Error handling middleware
app.use(errorHandler_1.errorHandler);
// Start server
const startServer = async () => {
    try {
        logger_1.logger.info('Starting server...');
        // Connect to MongoDB
        logger_1.logger.info('Connecting to MongoDB...');
        await (0, database_1.connectDB)();
        logger_1.logger.info('MongoDB connected successfully');
        // Connect to Redis with retry logic
        logger_1.logger.info('Connecting to Redis...');
        let redisConnected = false;
        let retries = 5;
        while (!redisConnected && retries > 0) {
            try {
                await redis_1.redis.connect();
                redisConnected = true;
                logger_1.logger.info('Redis connected successfully');
            }
            catch (error) {
                retries--;
                logger_1.logger.warn(`Redis connection failed, retries left: ${retries}`, error);
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        if (!redisConnected) {
            logger_1.logger.warn('Redis connection failed after all retries, continuing without Redis');
        }
        app.listen(PORT, () => {
            logger_1.logger.info(`Server running on port ${PORT}`);
            logger_1.logger.info(`Environment: ${process.env.NODE_ENV}`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger_1.logger.info('SIGTERM received, shutting down gracefully');
    await redis_1.redis.disconnect();
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger_1.logger.info('SIGINT received, shutting down gracefully');
    await redis_1.redis.disconnect();
    process.exit(0);
});
startServer();
//# sourceMappingURL=server.js.map