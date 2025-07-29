"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeQueues = exports.addEmailScanJob = exports.addScrapingJob = exports.emailQueue = exports.scrapingQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const logger_1 = require("../config/logger");
// Create queues
exports.scrapingQueue = new bullmq_1.Queue('scraping', {
    connection: redis_1.redis,
    defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    },
});
exports.emailQueue = new bullmq_1.Queue('email-scan', {
    connection: redis_1.redis,
    defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
    },
});
// Add jobs to queues
const addScrapingJob = async (data) => {
    try {
        const job = await exports.scrapingQueue.add('scrape-businesses', data, {
            priority: 1,
        });
        logger_1.logger.info('Scraping job added to queue', {
            jobId: job.id,
            searchId: data.searchId
        });
        return job;
    }
    catch (error) {
        logger_1.logger.error('Failed to add scraping job to queue:', error);
        throw error;
    }
};
exports.addScrapingJob = addScrapingJob;
const addEmailScanJob = async (data) => {
    try {
        const job = await exports.emailQueue.add('scan-emails', data, {
            priority: 2,
        });
        logger_1.logger.info('Email scan job added to queue', {
            jobId: job.id,
            businessId: data.businessId
        });
        return job;
    }
    catch (error) {
        logger_1.logger.error('Failed to add email scan job to queue:', error);
        throw error;
    }
};
exports.addEmailScanJob = addEmailScanJob;
// Queue event listeners
exports.scrapingQueue.on('completed', (job) => {
    logger_1.logger.info('Scraping job completed', { jobId: job.id });
});
exports.scrapingQueue.on('failed', (job, err) => {
    logger_1.logger.error('Scraping job failed', {
        jobId: job?.id,
        error: err.message
    });
});
exports.emailQueue.on('completed', (job) => {
    logger_1.logger.info('Email scan job completed', { jobId: job.id });
});
exports.emailQueue.on('failed', (job, err) => {
    logger_1.logger.error('Email scan job failed', {
        jobId: job?.id,
        error: err.message
    });
});
// Graceful shutdown
const closeQueues = async () => {
    await exports.scrapingQueue.close();
    await exports.emailQueue.close();
    logger_1.logger.info('Queues closed');
};
exports.closeQueues = closeQueues;
//# sourceMappingURL=queue.js.map