import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { CustomError } from './errorHandler';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      throw new CustomError(message, 400);
    }
    
    next();
  };
};

export const searchValidationSchema = Joi.object({
  businessType: Joi.string().min(2).max(100).required()
    .messages({
      'string.min': 'Business type must be at least 2 characters',
      'string.max': 'Business type cannot exceed 100 characters',
      'any.required': 'Business type is required'
    }),
  location: Joi.string().min(2).max(100).required()
    .messages({
      'string.min': 'Location must be at least 2 characters',
      'string.max': 'Location cannot exceed 100 characters',
      'any.required': 'Location is required'
    }),
  maxResults: Joi.number().integer().min(1).max(100).optional().default(20)
});

export const emailScanValidationSchema = Joi.object({
  website: Joi.string().uri().required()
    .messages({
      'string.uri': 'Please provide a valid website URL',
      'any.required': 'Website URL is required'
    })
});