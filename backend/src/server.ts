import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import { logger } from './config/logger';
import { redis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { validateRequest } from './middleware/validation';

// Routes
import searchRoutes from './routes/search';
import businessRoutes from './routes/business';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com', 'http://localhost:3000', 'http://localhost:80'] 
    : ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting - more permissive for development
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute 
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'), // 1000 requests per minute
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/search', searchRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/auth', authRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    logger.info('Starting server...');
    
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await connectDB();
    logger.info('MongoDB connected successfully');
    
    // Connect to Redis with retry logic
    logger.info('Connecting to Redis...');
    let redisConnected = false;
    let retries = 5;
    
    while (!redisConnected && retries > 0) {
      try {
        await redis.connect();
        redisConnected = true;
        logger.info('Redis connected successfully');
      } catch (error) {
        retries--;
        logger.warn(`Redis connection failed, retries left: ${retries}`, error);
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!redisConnected) {
      logger.warn('Redis connection failed after all retries, continuing without Redis');
    }
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await redis.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await redis.disconnect();
  process.exit(0);
});

startServer();