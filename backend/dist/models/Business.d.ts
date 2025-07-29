import mongoose, { Document } from 'mongoose';
import { Business as IBusiness } from '../types';
export interface BusinessDocument extends IBusiness, Document {
}
export declare const Business: mongoose.Model<BusinessDocument, {}, {}, {}, mongoose.Document<unknown, {}, BusinessDocument, {}> & BusinessDocument & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Business.d.ts.map