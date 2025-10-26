// ✅ Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import connectDB from './config/database';
import routes from './routes';
import publicRoutes from './routes/publicRoutes';
import swaggerSpecs from './config/swagger';

// ✅ Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// 👇 Force environment to production for Render (مهم جدًا)
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

console.log('🚀 Starting ClinicPro Backend...');
console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
console.log(`📡 PORT: ${PORT}`);

// ✅ Start listening immediately so Render detects the open port
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on port ${PORT}`);
  console.log(`🏥 Health check: http://0.0.0.0:${PORT}/api/health`);
});

// ✅ Initialize server logic
async function initializeServer() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ Database connected successfully');

    // Security middleware
    app.use(helmet());

    // CORS configuration
    const corsOptions = {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'Pragma',
        'X-Clinic-Id'
      ],
      credentials: true,
      optionsSuccessStatus: 200
    };
    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 10000,
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
      }
    });
    app.use('/api', limiter);

    // Body parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Swagger Documentation (disabled in production)
    if (process.env.NODE_ENV !== 'production') {
      app.use(
        '/api/docs',
        swaggerUi.serve,
        swaggerUi.setup(swaggerSpecs, {
          explorer: true,
          customCss: '.swagger-ui .topbar { display: none }',
          customSiteTitle: 'Clinic Management API Documentation',
          swaggerOptions: {
            docExpansion: 'none',
            filter: true,
            showRequestDuration: true,
            syntaxHighlight: { activate: true, theme: 'agate' }
          }
        })
      );
    }

    // Public routes
    app.use('/public', publicRoutes);

    // API routes
    app.use('/api', routes);

    // Health check endpoint
    app.get('/api/health', (req, res) => {
      res.json({
        success: true,
        message: 'Clinic Management System API is running 🚀',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Root route
    app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'Clinic Management System API',
        version: '1.0.0',
        documentation: '/api/docs',
        health: '/api/health'
      });
    });

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    });

    // Global error handler
    app.use(
      (
        err: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        console.error('Error:', err);

        if (err.name === 'ValidationError') {
          const errors = Object.values(err.errors).map((e: any) => e.message);
          res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors
          });
          return;
        }

        if (err.name === 'CastError') {
          res.status(400).json({
            success: false,
            message: 'Invalid ID format'
          });
          return;
        }

        if (err.name === 'JsonWebTokenError') {
          res.status(401).json({
            success: false,
            message: 'Invalid token'
          });
          return;
        }

        if (err.name === 'TokenExpiredError') {
          res.status(401).json({
            success: false,
            message: 'Token expired'
          });
          return;
        }

        if (
          err.name === 'MongoNetworkError' ||
          err.name === 'MongoTimeoutError'
        ) {
          res.status(503).json({
            success: false,
            message: 'Database connection error'
          });
          return;
        }

        res.status(err.status || 500).json({
          success: false,
          message: err.message || 'Internal server error'
        });
      }
    );

    console.log('✅ Initialization complete.');
  } catch (error) {
    console.error('💥 Failed to initialize server:', error);
  }
}

// ✅ Start initialization
initializeServer().catch((error) => {
  console.error('💥 Fatal error during startup:', error);
});

export default app;
