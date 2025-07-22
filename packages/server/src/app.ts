import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { errorHandler } from './middleware/errorHandler.js';
import { filesRouter } from './routes/files.js';
import { filesystemRouter } from './routes/filesystem.js';
import exportRouter from './routes/export.js';
import importRouter from './routes/import.js';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration - allow requests from React app
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File upload configuration
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});

// Routes
app.use('/api/files', filesRouter);
app.use('/api/filesystem', filesystemRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;