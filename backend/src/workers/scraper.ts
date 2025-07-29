import { Worker, Job } from 'bullmq';
import dotenv from 'dotenv';
import { connectDB } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { GoogleMapsScraper, EmailScraper } from '../services/scraper';
import { SearchJob } from '../models/SearchJob';
import { Business } from '../models/Business';
import type { ScrapingJobData, EmailScanJobData } from '../types';

dotenv.config();

// The main function that processes a single scraping job
const processScrapeJob = async (job: Job<ScrapingJobData>) => {
  const { searchId, businessType, location, maxResults } = job.data;
  logger.info(`[Worker] Starting to process scrape job ${job.id} for search: ${searchId}`);

  let scraper: GoogleMapsScraper | null = null;

  try {
    // Update job status to in progress
    await SearchJob.findByIdAndUpdate(searchId, { 
      status: 'IN_PROGRESS'
    });

    // Initialize scraper
    logger.info(`[Worker] Initializing GoogleMapsScraper for job ${job.id}`);
    scraper = new GoogleMapsScraper();
    await scraper.initialize();
    
    // Perform scraping
    logger.info(`[Worker] Starting scraping for: ${businessType} in ${location}`);
    const businesses = await scraper.searchBusinesses(businessType, location, maxResults);
    
    // Save businesses to database
    const savedBusinesses = [];
    for (const businessData of businesses) {
      try {
        const business = new Business({
          ...businessData,
          searchJobId: searchId,
          createdAt: new Date()
        });
        const saved = await business.save();
        savedBusinesses.push(saved);
      } catch (saveError) {
        logger.error(`[Worker] Failed to save business:`, saveError);
      }
    }

    // Update job status to completed
    await SearchJob.findByIdAndUpdate(searchId, {
      status: 'COMPLETED',
      completedAt: new Date(),
      resultsCount: savedBusinesses.length
    });

    logger.info(`[Worker] Job ${job.id} COMPLETED. Found and saved ${savedBusinesses.length} businesses.`);
    return { businessCount: savedBusinesses.length, businesses: savedBusinesses };

  } catch (error: any) {
    logger.error(`[Worker] Job ${job.id} FAILED for searchId: ${searchId}`, {
      message: error.message,
      stack: error.stack,
      searchId,
      businessType,
      location
    });
    
    // Update job status to failed
    try {
      await SearchJob.findByIdAndUpdate(searchId, {
        status: 'FAILED',
        error: error.message,
        completedAt: new Date(),
      });
    } catch (updateError) {
      logger.error(`[Worker] Failed to update job status to FAILED:`, updateError);
    }
    
    // Re-throw the error so BullMQ correctly marks the job as failed
    throw error;
  } finally {
    if (scraper) {
      try {
        await scraper.close();
      } catch (closeError) {
        logger.error(`[Worker] Error closing scraper:`, closeError);
      }
    }
  }
};

// Process email scanning job
const processEmailScanJob = async (job: Job<EmailScanJobData>) => {
  const { businessId, website } = job.data;
  logger.info(`[Worker] Starting email scan job ${job.id} for business: ${businessId}`);

  let emailScraper: EmailScraper | null = null;

  try {
    // Initialize email scraper
    logger.info(`[Worker] Initializing EmailScraper for job ${job.id}`);
    emailScraper = new EmailScraper();
    await emailScraper.initialize();

    // Add random delay to avoid being blocked
    const delay = Math.random() * 2000 + 500; // 0.5-2.5 seconds
    await new Promise(resolve => setTimeout(resolve, delay));

    // Extract emails
    logger.info(`[Worker] Extracting emails from: ${website}`);
    const emails = await emailScraper.extractEmails(website);

    // Update business with found emails
    if (emails.length > 0) {
      await Business.findByIdAndUpdate(businessId, {
        $addToSet: { emails: { $each: emails } } // Add emails without duplicates
      });

      logger.info(`[Worker] Email scan job ${job.id} COMPLETED. Found ${emails.length} emails for business ${businessId}`);
    } else {
      logger.info(`[Worker] Email scan job ${job.id} COMPLETED. No emails found for business ${businessId}`);
    }

    return { emailCount: emails.length, emails };

  } catch (error: any) {
    logger.error(`[Worker] Email scan job ${job.id} FAILED for business: ${businessId}`, {
      message: error.message,
      stack: error.stack,
      businessId,
      website
    });

    throw error;
  } finally {
    if (emailScraper) {
      try {
        await emailScraper.close();
      } catch (closeError) {
        logger.error(`[Worker] Error closing email scraper:`, closeError);
      }
    }
  }
};

// --- Main Worker Initialization ---

async function startWorkers() {
  try {
    logger.info('[Worker] 🚀 Initializing scraper worker process...');
    console.log('[Worker] 🚀 Worker starting up...');
    
    // Connect to database
    logger.info('[Worker] 📦 Connecting to MongoDB...');
    console.log('[Worker] 📦 Connecting to MongoDB...');
    await connectDB();
    logger.info('[Worker] ✅ MongoDB connected successfully');
    console.log('[Worker] ✅ MongoDB connected successfully');
    
    // Connect to Redis
    logger.info('[Worker] 🔗 Connecting to Redis...');
    console.log('[Worker] 🔗 Connecting to Redis...');
    await redis.connect();
    logger.info('[Worker] ✅ Redis connected successfully');
    console.log('[Worker] ✅ Redis connected successfully');

    // Create scraping worker
    logger.info('[Worker] 🏭 Creating scraping worker...');
    console.log('[Worker] 🏭 Creating scraping worker...');
    const scrapingWorker = new Worker(
      'scraping',
      processScrapeJob,
      {
        connection: redis,
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2'),
        limiter: {
          max: 5, // Max 5 jobs per minute to avoid being blocked
          duration: 60000,
        },
      }
    );

    // Create email scanning worker  
    logger.info('[Worker] 📧 Creating email scanning worker...');
    console.log('[Worker] 📧 Creating email scanning worker...');
    const emailWorker = new Worker(
      'email-scanning',
      processEmailScanJob,
      {
        connection: redis,
        concurrency: parseInt(process.env.EMAIL_WORKER_CONCURRENCY || '1'),
      }
    );

    // --- CRITICAL: Add Event Listeners for Full Observability ---

    // Scraping worker events
    scrapingWorker.on('active', (job: Job) => {
      logger.info(`[Worker] 🟡 Scraping job ${job.id} is now ACTIVE for search: ${job.data.searchId}`);
      console.log(`[Worker] 🟡 Job ${job.id} ACTIVE: ${job.data.businessType} in ${job.data.location}`);
    });

    scrapingWorker.on('completed', (job: Job, returnValue: any) => {
      logger.info(`[Worker] ✅ Scraping job ${job.id} COMPLETED with ${returnValue?.businessCount || 0} businesses`);
      console.log(`[Worker] ✅ Job ${job.id} COMPLETED: Found ${returnValue?.businessCount || 0} businesses`);
    });

    scrapingWorker.on('failed', (job: Job | undefined, err: Error) => {
      if (job) {
        logger.error(`[Worker] ❌ Scraping job ${job.id} FAILED: ${err.message}`, { 
          stack: err.stack,
          jobData: job.data 
        });
        console.error(`[Worker] ❌ Job ${job.id} FAILED: ${err.message}`);
      } else {
        logger.error(`[Worker] ❌ Unknown scraping job FAILED: ${err.message}`, { stack: err.stack });
        console.error(`[Worker] ❌ Unknown job FAILED: ${err.message}`);
      }
    });

    scrapingWorker.on('error', (err: Error) => {
      logger.error('[Worker] 💥 Scraping worker ERROR:', err);
      console.error('[Worker] 💥 Scraping worker ERROR:', err.message);
    });

    // Email worker events
    emailWorker.on('active', (job: Job) => {
      logger.info(`[Worker] 🟡 Email job ${job.id} is now ACTIVE for business: ${job.data.businessId}`);
      console.log(`[Worker] 🟡 Email job ${job.id} ACTIVE: ${job.data.website}`);
    });

    emailWorker.on('completed', (job: Job, returnValue: any) => {
      logger.info(`[Worker] ✅ Email job ${job.id} COMPLETED with ${returnValue?.emailCount || 0} emails`);
      console.log(`[Worker] ✅ Email job ${job.id} COMPLETED: Found ${returnValue?.emailCount || 0} emails`);
    });

    emailWorker.on('failed', (job: Job | undefined, err: Error) => {
      if (job) {
        logger.error(`[Worker] ❌ Email job ${job.id} FAILED: ${err.message}`, { 
          stack: err.stack,
          jobData: job.data 
        });
        console.error(`[Worker] ❌ Email job ${job.id} FAILED: ${err.message}`);
      } else {
        logger.error(`[Worker] ❌ Unknown email job FAILED: ${err.message}`, { stack: err.stack });
        console.error(`[Worker] ❌ Unknown email job FAILED: ${err.message}`);
      }
    });

    emailWorker.on('error', (err: Error) => {
      logger.error('[Worker] 💥 Email worker ERROR:', err);
      console.error('[Worker] 💥 Email worker ERROR:', err.message);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async () => {
      logger.info('[Worker] 🛑 Shutting down workers gracefully...');
      console.log('[Worker] 🛑 Shutting down workers gracefully...');
      
      try {
        await scrapingWorker.close();
        await emailWorker.close();
        await redis.disconnect();
        logger.info('[Worker] ✅ Workers shutdown completed');
        console.log('[Worker] ✅ Workers shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('[Worker] ❌ Error during shutdown:', error);
        console.error('[Worker] ❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

    logger.info(`[Worker] 🎉 Worker processes are running and listening for jobs!`);
    console.log(`[Worker] 🎉 Both workers are READY and waiting for jobs!`);
    console.log(`[Worker] 📊 Scraping queue: "scraping" (concurrency: ${process.env.WORKER_CONCURRENCY || '2'})`);
    console.log(`[Worker] 📧 Email queue: "email-scanning" (concurrency: ${process.env.EMAIL_WORKER_CONCURRENCY || '1'})`);

  } catch (error: any) {
    logger.error('[Worker] 💀 Failed to start workers:', error);
    console.error('[Worker] 💀 Worker startup FAILED:', error.message);
    console.error('[Worker] 💀 Stack trace:', error.stack);
    process.exit(1);
  }
}

// Only start if this file is run directly
if (require.main === module) {
  startWorkers();
}