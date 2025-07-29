import mongoose, { Schema, Document } from 'mongoose';
import { Business as IBusiness } from '../types';

export interface BusinessDocument extends IBusiness, Document {}

const BusinessSchema = new Schema<BusinessDocument>({
  searchId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true,
    default: null
  },
  website: {
    type: String,
    trim: true,
    default: null
  },
  emails: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  source: {
    type: String,
    enum: ['GOOGLE_MAPS', 'WEBSITE_SCAN'],
    required: true
  },
  extractedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
BusinessSchema.index({ searchId: 1, createdAt: -1 });
BusinessSchema.index({ name: 1 });
BusinessSchema.index({ 'emails.0': 1 }); // Index for businesses with emails

// Prevent duplicate businesses in the same search
BusinessSchema.index({ searchId: 1, name: 1, address: 1 }, { unique: true });

export const Business = mongoose.model<BusinessDocument>('Business', BusinessSchema);