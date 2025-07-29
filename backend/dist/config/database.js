"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("./logger");
const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/business-scraper';
        await mongoose_1.default.connect(mongoUri);
        logger_1.logger.info('MongoDB connected successfully');
    }
    catch (error) {
        logger_1.logger.error('MongoDB connection failed:', error);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
mongoose_1.default.connection.on('disconnected', () => {
    logger_1.logger.warn('MongoDB disconnected');
});
mongoose_1.default.connection.on('error', (error) => {
    logger_1.logger.error('MongoDB error:', error);
});
//# sourceMappingURL=database.js.map