import { Queue, Job } from 'bullmq';
import type { ScrapingJobData, EmailScanJobData } from '../types';
export declare const scrapingQueue: Queue<any, any, string>;
export declare const emailQueue: Queue<any, any, string>;
export declare const addScrapingJob: (data: ScrapingJobData) => Promise<Job<ScrapingJobData>>;
export declare const addEmailScanJob: (data: EmailScanJobData) => Promise<Job<EmailScanJobData>>;
export declare const closeQueues: () => Promise<void>;
//# sourceMappingURL=queue.d.ts.map