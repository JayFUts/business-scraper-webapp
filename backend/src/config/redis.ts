import { Redis } from 'ioredis';
import { logger } from './logger';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  enableReadyCheck: false,
  lazyConnect: true,
  maxRetriesPerRequest: null,
  connectTimeout: 60000,
});

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

redis.on('reconnecting', () => {
  logger.info('Redis reconnecting...');
});