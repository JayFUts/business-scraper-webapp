import mongoose, { Document } from 'mongoose';
import { User as IUser } from '../types';
export interface UserDocument extends IUser, Document {
    comparePassword(candidatePassword: string): Promise<boolean>;
}
export declare const User: mongoose.Model<UserDocument, {}, {}, {}, mongoose.Document<unknown, {}, UserDocument, {}> & UserDocument & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=User.d.ts.map