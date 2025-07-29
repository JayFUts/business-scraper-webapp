import mongoose, { Schema, Document } from 'mongoose';
import { SearchJob as ISearchJob } from '../types';

export interface SearchJobDocument extends ISearchJob, Document {}

const SearchJobSchema = new Schema<SearchJobDocument>({
  userId: {
    type: String,
    default: null,
    index: true
  },
  businessType: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
    index: true
  },
  resultsCount: {
    type: Number,
    default: 0,
    min: 0
  },
  error: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for duration calculation
SearchJobSchema.virtual('duration').get(function() {
  if (this.completedAt && this.createdAt) {
    return this.completedAt.getTime() - this.createdAt.getTime();
  }
  return null;
});

// Indexes for performance
SearchJobSchema.index({ createdAt: -1 });
SearchJobSchema.index({ status: 1, createdAt: -1 });
SearchJobSchema.index({ userId: 1, createdAt: -1 });

export const SearchJob = mongoose.model<SearchJobDocument>('SearchJob', SearchJobSchema);