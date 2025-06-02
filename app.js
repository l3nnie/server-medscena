import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import scenarioRoutes from './routes/scenarioRoutes.js';
import config from './config/config.js';

dotenv.config();
const app = express();

// Middleware - must come before routes
app.use(cors({
    origin: config.FRONTEND_URL || 'https://frontend-medscena-tysg-8maubhtdz.vercel.app',                                
    credentials: true
}));
app.use(express.json());

// API Routes
app.use('/api/scenarios', scenarioRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

// Error handling middleware - must come after routes
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError) {
        return res.status(400).json({ error: "Invalid request syntax" });
    }
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

console.log('API Key:', config.GEMINI_API_KEY ? 'Loaded' : 'MISSING!');

app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
});
