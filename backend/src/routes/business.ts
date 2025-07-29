import express from 'express';
import { Business } from '../models/Business';
import { validateRequest, emailScanValidationSchema } from '../middleware/validation';
import { CustomError } from '../middleware/errorHandler';
import { addEmailScanJob } from '../services/queue';
import { logger } from '../config/logger';
import type { ApiResponse, EmailScanJobData } from '../types';

const router = express.Router();

// Get business details
router.get('/:businessId', async (req, res, next) => {
  try {
    const { businessId } = req.params;
    
    if (!businessId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new CustomError('Invalid business ID format', 400);
    }
    
    const business = await Business.findById(businessId);
    if (!business) {
      throw new CustomError('Business not found', 404);
    }
    
    const response: ApiResponse = {
      success: true,
      data: business
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Scan website for emails
router.post('/:businessId/scan-emails', validateRequest(emailScanValidationSchema), async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { website } = req.body;
    
    if (!businessId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new CustomError('Invalid business ID format', 400);
    }
    
    const business = await Business.findById(businessId);
    if (!business) {
      throw new CustomError('Business not found', 404);
    }
    
    // Add email scan job to queue
    const jobData: EmailScanJobData = {
      businessId,
      website
    };
    
    await addEmailScanJob(jobData);
    
    logger.info('Email scan job created', { 
      businessId, 
      website,
      businessName: business.name 
    });
    
    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Email scan started successfully',
        businessId,
        website
      }
    };
    
    res.status(202).json(response);
  } catch (error) {
    next(error);
  }
});

// Update business information
router.put('/:businessId', async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const updates = req.body;
    
    if (!businessId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new CustomError('Invalid business ID format', 400);
    }
    
    // Only allow certain fields to be updated
    const allowedUpdates = ['phone', 'website', 'emails'];
    const filteredUpdates: any = {};
    
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }
    
    const business = await Business.findByIdAndUpdate(
      businessId,
      filteredUpdates,
      { new: true, runValidators: true }
    );
    
    if (!business) {
      throw new CustomError('Business not found', 404);
    }
    
    logger.info('Business updated', { 
      businessId, 
      updates: Object.keys(filteredUpdates) 
    });
    
    const response: ApiResponse = {
      success: true,
      data: business
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Search businesses by criteria
router.get('/', async (req, res, next) => {
  try {
    const {
      search,
      hasEmail,
      hasWebsite,
      source,
      page = 1,
      limit = 20
    } = req.query;
    
    const query: any = {};
    
    // Text search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by email presence
    if (hasEmail === 'true') {
      query.emails = { $exists: true, $ne: [] };
    } else if (hasEmail === 'false') {
      query.$or = [
        { emails: { $exists: false } },
        { emails: { $size: 0 } }
      ];
    }
    
    // Filter by website presence
    if (hasWebsite === 'true') {
      query.website = { $exists: true, $ne: null, $ne: '' };
    } else if (hasWebsite === 'false') {
      query.$or = [
        { website: { $exists: false } },
        { website: null },
        { website: '' }
      ];
    }
    
    // Filter by source
    if (source && ['GOOGLE_MAPS', 'WEBSITE_SCAN'].includes(source as string)) {
      query.source = source;
    }
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const businesses = await Business.find(query)
      .sort({ extractedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string));
    
    const total = await Business.countDocuments(query);
    
    const response: ApiResponse = {
      success: true,
      data: {
        businesses,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      }
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;