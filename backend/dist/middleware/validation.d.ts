import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
export declare const validateRequest: (schema: Joi.ObjectSchema) => (req: Request, res: Response, next: NextFunction) => void;
export declare const searchValidationSchema: Joi.ObjectSchema<any>;
export declare const emailScanValidationSchema: Joi.ObjectSchema<any>;
//# sourceMappingURL=validation.d.ts.map