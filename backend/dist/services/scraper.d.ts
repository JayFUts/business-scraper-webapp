import type { Business } from '../types';
export declare class GoogleMapsScraper {
    private browser;
    private page;
    initialize(): Promise<void>;
    searchBusinesses(businessType: string, location: string, maxResults?: number): Promise<Partial<Business>[]>;
    private handleCookieConsent;
    private waitForSearchResults;
    private scrollToLoadResults;
    private extractBusinessData;
    private extractDetailedBusinessData;
    private extractEmailsFromWebsite;
    close(): Promise<void>;
}
export declare class EmailScraper {
    private browser;
    private page;
    initialize(): Promise<void>;
    extractEmails(website: string): Promise<string[]>;
    close(): Promise<void>;
}
//# sourceMappingURL=scraper.d.ts.map