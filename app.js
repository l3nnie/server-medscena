import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path'; // Needed for path.join if serving static files
import { fileURLToPath } from 'url'; // Needed for __dirname in ES modules

import scenarioRoutes from './routes/scenarioRoutes.js';
import config from './config/config.js'; // Assuming config.js exists and exports config object

// Load environment variables from .env file
dotenv.config();

// Configure __dirname for ES modules
// This is necessary if you plan to serve static files (like your React build)
// directly from this Node.js server. If your frontend is hosted separately
// (e.g., on Vercel), these might not be strictly necessary for the backend's API functionality,
// but it's good practice to keep them if there's any chance of serving files.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Set the port for the server. Use process.env.PORT for Render, fallback to 5000.
const PORT = config.PORT || process.env.PORT || 5000;

// --- Server Startup Logging ---
console.log('🚀 Starting server...');

// --- CORS Configuration ---
// Define all allowed origins for your frontend applications
const allowedOrigins = [
    'https://frontend-medscena-tysg-8maubhtdz.vercel.app', // Your Vercel frontend URL
    'https://frontend-medscena-8tl7.vercel.app',// Another potential Vercel frontend URL
    'https://front-notes-xi.vercel.app/',
    'http://localhost:5173', // Local development URL for Vite
    'http://localhost:3000'  // Common local development URL for Create React App
];

// If config.FRONTEND_URL is defined, add it to allowedOrigins if not already present
if (config.FRONTEND_URL && !allowedOrigins.includes(config.FRONTEND_URL)) {
    allowedOrigins.push(config.FRONTEND_URL);
}

// Apply CORS middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        // or if the origin is in our allowed list.
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true); // Allow the request
        } else {
            // Block the request and log the origin for debugging
            console.warn(`❌ Blocked by CORS: ${origin}`);
            callback(new Error('Not allowed by CORS')); // Deny the request
        }
    },
    credentials: true // Allow cookies to be sent with cross-origin requests
}));

// --- Middleware ---
// Body parser for JSON requests
app.use(express.json());
// Body parser for URL-encoded requests (if you have form submissions)
app.use(express.urlencoded({ extended: true }));

// --- API Routes ---
// All routes defined in scenarioRoutes.js will be prefixed with /api/scenarios
app.use('/api/scenarios', scenarioRoutes);

// --- Test Route ---
// A simple health check route to confirm the API is running
app.get('/', (req, res) => {
    res.send('API is running...');
});

// --- Serve Static Files (Optional, based on deployment strategy) ---
// If your frontend is deployed separately (e.g., on Vercel),
// these lines are generally not needed on your backend server.
// They are useful if you're deploying a full-stack app to a single Render service.
// app.use(express.static(path.join(__dirname, '../client/dist')));
// app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, '../client/dist/index.html'));
// });


// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
    // Handle invalid JSON syntax errors specifically
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('Invalid JSON syntax received:', err.message);
        return res.status(400).json({ error: "Invalid JSON syntax in request body" });
    }
    // Handle CORS policy violation errors
    if (err.message === 'Not allowed by CORS') {
        console.error(`CORS policy violation for origin: ${req.headers.origin}`);
        return res.status(403).json({ error: 'CORS policy violation', origin: req.headers.origin });
    }
    // Catch-all for any other unhandled errors
    console.error('Unhandled server error:', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

// --- Final Configuration Logging ---
console.log('🔑 API Key:', config.GEMINI_API_KEY ? 'Loaded' : 'MISSING!');
console.log('🌍 Frontend URL allowed:', allowedOrigins.join(', ')); // Log all allowed origins
console.log('🧾 Port:', PORT);

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
}).on('error', (err) => {
    // Handle server startup errors (e.g., port already in use)
    console.error('🚨 Failed to start server:', err);
});

export default app;
