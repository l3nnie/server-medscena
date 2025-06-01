import { GoogleGenerativeAI } from '@google/generative-ai';
import express from 'express';
import { generateScenarios } from '../controllers/scenarioController.js';
import rateLimit from 'express-rate-limit';
import config from '../config/config.js';

const router = express.Router();

// CORRECT route definitions:
router.post('/generate', 
  rateLimit({
    windowMs: config.RATE_LIMIT.windowMs,
    max: config.RATE_LIMIT.max
  }),
  generateScenarios
);

// Example of proper parameterized routes:
// router.get('/scenarios/:id', getScenarioById); // Correct parameter syntax
// router.get('/search/:query', searchScenarios); // Correct parameter syntax

export default router;