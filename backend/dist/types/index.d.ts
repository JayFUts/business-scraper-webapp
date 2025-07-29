export interface Business {
    _id?: string;
    searchId: string;
    name: string;
    address: string;
    phone?: string;
    website?: string;
    emails: string[];
    source: 'GOOGLE_MAPS' | 'WEBSITE_SCAN';
    extractedAt: Date;
}
export interface SearchJob {
    _id?: string;
    userId?: string;
    businessType: string;
    location: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    resultsCount: number;
    error?: string;
    createdAt: Date;
    completedAt?: Date;
}
export interface ScrapingJobData {
    searchId: string;
    businessType: string;
    location: string;
    maxResults?: number;
}
export interface EmailScanJobData {
    businessId: string;
    website: string;
}
export interface User {
    _id?: string;
    email: string;
    password: string;
    name: string;
    subscription: 'FREE' | 'PREMIUM';
    credits: number;
    createdAt: Date;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
//# sourceMappingURL=index.d.ts.map