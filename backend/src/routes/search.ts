import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SearchJob } from '../models/SearchJob';
import { Business } from '../models/Business';
import { validateRequest, searchValidationSchema } from '../middleware/validation';
import { CustomError } from '../middleware/errorHandler';
import { addScrapingJob } from '../services/queue';
import { logger } from '../config/logger';
import type { ApiResponse, ScrapingJobData } from '../types';

const router = express.Router();

// Start a new search
router.post('/', validateRequest(searchValidationSchema), async (req, res, next) => {
  try {
    const { businessType, location, maxResults = 20 } = req.body;
    
    // Create search job in database
    const searchJob = new SearchJob({
      businessType,
      location,
      status: 'PENDING'
    });
    
    await searchJob.save();
    
    // Add job to queue
    const jobData: ScrapingJobData = {
      searchId: searchJob._id.toString(),
      businessType,
      location,
      maxResults
    };
    
    await addScrapingJob(jobData);
    
    logger.info('Search job created', { 
      searchId: searchJob._id, 
      businessType, 
      location 
    });
    
    const response: ApiResponse = {
      success: true,
      data: {
        searchId: searchJob._id,
        status: searchJob.status,
        message: 'Search started successfully'
      }
    };
    
    res.status(202).json(response);
  } catch (error) {
    next(error);
  }
});

// Get search status and results
router.get('/:searchId', async (req, res, next) => {
  try {
    const { searchId } = req.params;
    
    if (!searchId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new CustomError('Invalid search ID format', 400);
    }
    
    const searchJob = await SearchJob.findById(searchId);
    if (!searchJob) {
      throw new CustomError('Search not found', 404);
    }
    
    // Get businesses found so far
    const businesses = await Business.find({ searchId })
      .sort({ extractedAt: -1 })
      .limit(100);
    
    const response: ApiResponse = {
      success: true,
      data: {
        search: {
          id: searchJob._id,
          businessType: searchJob.businessType,
          location: searchJob.location,
          status: searchJob.status,
          resultsCount: searchJob.resultsCount,
          error: searchJob.error,
          createdAt: searchJob.createdAt,
          completedAt: searchJob.completedAt
        },
        businesses: businesses.map(business => ({
          id: business._id,
          name: business.name,
          address: business.address,
          phone: business.phone,
          website: business.website,
          emails: business.emails,
          source: business.source,
          extractedAt: business.extractedAt
        }))
      }
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Get all searches (with pagination)
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    
    const searches = await SearchJob.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await SearchJob.countDocuments();
    
    const response: ApiResponse = {
      success: true,
      data: {
        searches,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Export search results
router.get('/:searchId/export', async (req, res, next) => {
  try {
    const { searchId } = req.params;
    const format = req.query.format as string || 'json';
    
    if (!searchId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new CustomError('Invalid search ID format', 400);
    }
    
    const searchJob = await SearchJob.findById(searchId);
    if (!searchJob) {
      throw new CustomError('Search not found', 404);
    }
    
    const businesses = await Business.find({ searchId })
      .sort({ extractedAt: -1 });
    
    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'Name,Address,Phone,Website,Emails,Source,Extracted At\n';
      const csvRows = businesses.map(business => 
        `"${business.name}","${business.address}","${business.phone || ''}","${business.website || ''}","${business.emails.join('; ')}","${business.source}","${business.extractedAt}"`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="search-${searchId}.csv"`);
      res.send(csvHeader + csvRows);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="search-${searchId}.json"`);
      res.json({
        search: searchJob,
        businesses,
        exportedAt: new Date()
      });
    }
  } catch (error) {
    next(error);
  }
});

// Delete a search and its results
router.delete('/:searchId', async (req, res, next) => {
  try {
    const { searchId } = req.params;
    
    if (!searchId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new CustomError('Invalid search ID format', 400);
    }
    
    const searchJob = await SearchJob.findById(searchId);
    if (!searchJob) {
      throw new CustomError('Search not found', 404);
    }
    
    // Delete all businesses for this search
    await Business.deleteMany({ searchId });
    
    // Delete the search job
    await SearchJob.findByIdAndDelete(searchId);
    
    logger.info('Search deleted', { searchId });
    
    const response: ApiResponse = {
      success: true,
      message: 'Search and all results deleted successfully'
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;