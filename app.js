import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import scenarioRoutes from './routes/scenarioRoutes.js';
import config from './config/config.js';

dotenv.config();
const app = express();

// ✅ Log app start
console.log('🚀 Starting server...');

// ✅ Allowed origins for CORS
const allowedOrigins = [
  'https://frontend-medscena-tysg-8maubhtdz.vercel.app',
  'https://frontend-medscena-8tl7.vercel.app',
  'http://localhost:5173'
];

// ✅ Secure CORS middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`❌ Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ✅ Body parser
app.use(express.json());

// ✅ Routes
app.use('/api/scenarios', scenarioRoutes);

// ✅ Test route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// ✅ Error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: "Invalid JSON syntax" });
  }
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation', origin: req.headers.origin });
  }
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ✅ Config log
console.log('🔑 API Key:', config.GEMINI_API_KEY ? 'Loaded' : 'MISSING!');
console.log('🌍 Frontend URL allowed:', config.FRONTEND_URL);
console.log('🧾 Port:', config.PORT);

// ✅ Listen with error handling
app.listen(config.PORT, () => {
  console.log(`✅ Server running on port ${config.PORT}`);
}).on('error', (err) => {
  console.error('🚨 Failed to start server:', err);
});
