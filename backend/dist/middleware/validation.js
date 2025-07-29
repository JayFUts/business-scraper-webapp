"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailScanValidationSchema = exports.searchValidationSchema = exports.validateRequest = void 0;
const joi_1 = __importDefault(require("joi"));
const errorHandler_1 = require("./errorHandler");
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            const message = error.details.map(detail => detail.message).join(', ');
            throw new errorHandler_1.CustomError(message, 400);
        }
        next();
    };
};
exports.validateRequest = validateRequest;
exports.searchValidationSchema = joi_1.default.object({
    businessType: joi_1.default.string().min(2).max(100).required()
        .messages({
        'string.min': 'Business type must be at least 2 characters',
        'string.max': 'Business type cannot exceed 100 characters',
        'any.required': 'Business type is required'
    }),
    location: joi_1.default.string().min(2).max(100).required()
        .messages({
        'string.min': 'Location must be at least 2 characters',
        'string.max': 'Location cannot exceed 100 characters',
        'any.required': 'Location is required'
    }),
    maxResults: joi_1.default.number().integer().min(1).max(100).optional().default(20)
});
exports.emailScanValidationSchema = joi_1.default.object({
    website: joi_1.default.string().uri().required()
        .messages({
        'string.uri': 'Please provide a valid website URL',
        'any.required': 'Website URL is required'
    })
});
//# sourceMappingURL=validation.js.map