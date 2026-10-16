require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const groupRoutes = require('./routes/groups');
const moderatorRoutes = require('./routes/moderator');
const adminRoutes = require('./routes/admin');
const googleRoutes = require('./routes/google');
const chatbotRoutes = require('./routes/chatbot');
const paymentRoutes = require('./routes/payments');
const journalRoutes = require('./routes/journal');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
if (require.main === module) {
  connectDB();
}

// Security middleware - disabled for development to avoid CSP issues
if (process.env.NODE_ENV === 'development') {
  // Skip helmet in development to avoid CSP conflicts with development tools
  console.log('🔧 Development mode: Helmet CSP disabled for better development experience');
} else {
  app.use(helmet());
}

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests from localhost with any port (for development) or non-browser/test clients
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || !origin) {
      return callback(null, true);
    }
    
    // Production CORS restrictions
    const allowedFrontend = process.env.FRONTEND_URL;
    if (origin && (
      origin.startsWith('http://localhost:') || 
      origin.startsWith('http://127.0.0.1:') ||
      (allowedFrontend && (origin === allowedFrontend || origin === allowedFrontend.replace(/\/$/, '')))
    )) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  // Allow Chrome DevTools extensions
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ReLife Backend is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  });
});

// Test endpoint to verify server is working
app.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Server is working correctly!',
    data: {
      server: 'ReLife Backend',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// Serve static files (HTML, CSS, JS) for both development and production
app.use(express.static('./frontend'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/moderator', moderatorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/journals', journalRoutes);

// Global error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully');
  process.exit(0);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 ReLife Backend running on port ${PORT}`);
    console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
