import mongoose, { Document } from 'mongoose';
import { SearchJob as ISearchJob } from '../types';
export interface SearchJobDocument extends ISearchJob, Document {
}
export declare const SearchJob: mongoose.Model<SearchJobDocument, {}, {}, {}, mongoose.Document<unknown, {}, SearchJobDocument, {}> & SearchJobDocument & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=SearchJob.d.ts.map