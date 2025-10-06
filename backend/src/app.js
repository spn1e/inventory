import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import knex from 'knex';
import knexConfig from './db/knexfile.js';
import winston from 'winston';

// Import routes
import authRoutes from './routes/auth.js';
import itemsRoutes from './routes/items.js';
import salesRoutes from './routes/sales.js';
import forecastRoutes from './routes/forecast.js';
import uploadRoutes from './routes/upload.js';

// Load environment variables
config();

// Setup logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'inventory-backend' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Database connection
const environment = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[environment]);

// Express app
const app = express();
const server = createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || ["http://localhost:5173", "http://localhost:5174"],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Make database and socket.io available to routes
app.use((req, res, next) => {
  req.db = db;
  req.io = io;
  req.logger = logger;
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Import authentication middleware
import { authenticateToken } from './routes/auth.js';

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/upload', uploadRoutes);

// Add alias route for reorder suggestions
app.get('/api/reorder/suggestions', authenticateToken, async (req, res, next) => {
  try {
    // Forward to the existing handler in sales routes
    req.url = '/reorder/suggestions';
    salesRoutes(req, res, next);
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
  
  socket.on('join_room', (room) => {
    socket.join(room);
    logger.info(`Client ${socket.id} joined room: ${room}`);
  });
});

// Database connection test and migration
async function initializeDatabase() {
  try {
    await db.raw('SELECT 1');
    logger.info('Database connection established');
    
    // Run migrations
    await db.migrate.latest();
    logger.info('Database migrations completed');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  }
}

// Start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initializeDatabase();
    
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    db.destroy();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    db.destroy();
    process.exit(0);
  });
});

// Start the server
startServer();

export default app;