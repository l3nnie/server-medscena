import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import scenarioRoutes from './routes/scenarioRoutes.js';
import config from './config/config.js';

// Configure __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();

// CORS Configuration
const allowedOrigins = [
  'https://frontend-medscena-tysg-8maubhtdz.vercel.app',
  'http://localhost:5173' // For local development
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/scenarios', scenarioRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    frontend: config.FRONTEND_URL,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static files from React app (if you're serving the frontend from backend in production)
app.use(express.static(path.join(__dirname, '../client/dist')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      error: 'CORS policy violation',
      allowedOrigins: allowedOrigins
    });
  }

  // Handle invalid JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  // Generic error handler
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Configuration logging
console.log('Environment Variables:', {
  PORT: config.PORT,
  FRONTEND_URL: config.FRONTEND_URL,
  NODE_ENV: process.env.NODE_ENV,
  API_KEY_PRESENT: !!config.GEMINI_API_KEY
});

app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
  console.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);
  console.log(`Frontend URL: ${config.FRONTEND_URL}`);
});
