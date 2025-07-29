"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Business_1 = require("../models/Business");
const validation_1 = require("../middleware/validation");
const errorHandler_1 = require("../middleware/errorHandler");
const queue_1 = require("../services/queue");
const logger_1 = require("../config/logger");
const router = express_1.default.Router();
// Get business details
router.get('/:businessId', async (req, res, next) => {
    try {
        const { businessId } = req.params;
        if (!businessId.match(/^[0-9a-fA-F]{24}$/)) {
            throw new errorHandler_1.CustomError('Invalid business ID format', 400);
        }
        const business = await Business_1.Business.findById(businessId);
        if (!business) {
            throw new errorHandler_1.CustomError('Business not found', 404);
        }
        const response = {
            success: true,
            data: business
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
// Scan website for emails
router.post('/:businessId/scan-emails', (0, validation_1.validateRequest)(validation_1.emailScanValidationSchema), async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const { website } = req.body;
        if (!businessId.match(/^[0-9a-fA-F]{24}$/)) {
            throw new errorHandler_1.CustomError('Invalid business ID format', 400);
        }
        const business = await Business_1.Business.findById(businessId);
        if (!business) {
            throw new errorHandler_1.CustomError('Business not found', 404);
        }
        // Add email scan job to queue
        const jobData = {
            businessId,
            website
        };
        await (0, queue_1.addEmailScanJob)(jobData);
        logger_1.logger.info('Email scan job created', {
            businessId,
            website,
            businessName: business.name
        });
        const response = {
            success: true,
            data: {
                message: 'Email scan started successfully',
                businessId,
                website
            }
        };
        res.status(202).json(response);
    }
    catch (error) {
        next(error);
    }
});
// Update business information
router.put('/:businessId', async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const updates = req.body;
        if (!businessId.match(/^[0-9a-fA-F]{24}$/)) {
            throw new errorHandler_1.CustomError('Invalid business ID format', 400);
        }
        // Only allow certain fields to be updated
        const allowedUpdates = ['phone', 'website', 'emails'];
        const filteredUpdates = {};
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        const business = await Business_1.Business.findByIdAndUpdate(businessId, filteredUpdates, { new: true, runValidators: true });
        if (!business) {
            throw new errorHandler_1.CustomError('Business not found', 404);
        }
        logger_1.logger.info('Business updated', {
            businessId,
            updates: Object.keys(filteredUpdates)
        });
        const response = {
            success: true,
            data: business
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
// Search businesses by criteria
router.get('/', async (req, res, next) => {
    try {
        const { search, hasEmail, hasWebsite, source, page = 1, limit = 20 } = req.query;
        const query = {};
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
        }
        else if (hasEmail === 'false') {
            query.$or = [
                { emails: { $exists: false } },
                { emails: { $size: 0 } }
            ];
        }
        // Filter by website presence
        if (hasWebsite === 'true') {
            query.website = { $exists: true, $ne: null, $ne: '' };
        }
        else if (hasWebsite === 'false') {
            query.$or = [
                { website: { $exists: false } },
                { website: null },
                { website: '' }
            ];
        }
        // Filter by source
        if (source && ['GOOGLE_MAPS', 'WEBSITE_SCAN'].includes(source)) {
            query.source = source;
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const businesses = await Business_1.Business.find(query)
            .sort({ extractedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        const total = await Business_1.Business.countDocuments(query);
        const response = {
            success: true,
            data: {
                businesses,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=business.js.map