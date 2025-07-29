import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import type { ScrapingJobData, EmailScanJobData } from '../types';

// Create queues
export const scrapingQueue = new Queue('scraping', {
  connection: redis,
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

export const emailQueue = new Queue('email-scan', {
  connection: redis,
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
export const addScrapingJob = async (data: ScrapingJobData): Promise<Job<ScrapingJobData>> => {
  try {
    const job = await scrapingQueue.add('scrape-businesses', data, {
      priority: 1,
    });
    
    logger.info('Scraping job added to queue', { 
      jobId: job.id, 
      searchId: data.searchId 
    });
    
    return job;
  } catch (error) {
    logger.error('Failed to add scraping job to queue:', error);
    throw error;
  }
};

export const addEmailScanJob = async (data: EmailScanJobData): Promise<Job<EmailScanJobData>> => {
  try {
    const job = await emailQueue.add('scan-emails', data, {
      priority: 2,
    });
    
    logger.info('Email scan job added to queue', { 
      jobId: job.id, 
      businessId: data.businessId 
    });
    
    return job;
  } catch (error) {
    logger.error('Failed to add email scan job to queue:', error);
    throw error;
  }
};

// Queue event listeners
scrapingQueue.on('completed', (job) => {
  logger.info('Scraping job completed', { jobId: job.id });
});

scrapingQueue.on('failed', (job, err) => {
  logger.error('Scraping job failed', { 
    jobId: job?.id, 
    error: err.message 
  });
});

emailQueue.on('completed', (job) => {
  logger.info('Email scan job completed', { jobId: job.id });
});

emailQueue.on('failed', (job, err) => {
  logger.error('Email scan job failed', { 
    jobId: job?.id, 
    error: err.message 
  });
});

// Graceful shutdown
export const closeQueues = async (): Promise<void> => {
  await scrapingQueue.close();
  await emailQueue.close();
  logger.info('Queues closed');
};