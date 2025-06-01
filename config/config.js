import dotenv from 'dotenv';
dotenv.config();

export default {
    PORT: process.env.PORT || 5000,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    FRONTEND_URL: process.env.FRONTEND_URL,
    RATE_LIMIT: {
        windowMs: 15 * 60 * 1000,
        max: 100
    }
};