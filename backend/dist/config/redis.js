"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = require("ioredis");
const logger_1 = require("./logger");
exports.redis = new ioredis_1.Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    enableReadyCheck: false,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    connectTimeout: 60000,
});
exports.redis.on('connect', () => {
    logger_1.logger.info('Redis connected successfully');
});
exports.redis.on('error', (error) => {
    logger_1.logger.error('Redis connection error:', error);
});
exports.redis.on('reconnecting', () => {
    logger_1.logger.info('Redis reconnecting...');
});
//# sourceMappingURL=redis.js.map