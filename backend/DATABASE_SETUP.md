# ReLife Database Setup Guide

## 📋 Overview

This guide covers the complete database setup for the ReLife platform using MongoDB with Mongoose ODM.

## 🗄️ Database Schema

### Current Collections:
1. **users** - User accounts and profiles
2. **groups** - Support groups and sessions
3. **payments** - Transaction records and payment history
4. **chatHistory** - Chat logs and conversations

## 🔧 Setup Instructions

### 1. Environment Configuration

Update your `.env` file with MongoDB connection:

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/onlydivorce
MONGODB_TEST_URI=mongodb://localhost:27017/onlydivorce_test

# Optional: MongoDB Atlas (for production)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/onlydivorce?retryWrites=true&w=majority
```

### 2. Database Connection

The database connection is already configured in `backend/src/config/database.js`:

```javascript
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/onlydivorce', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
    });

  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
```

### 3. Model Relationships

#### User Model Fields:
- **Authentication**: mobileNumber, otp, isVerified
- **Profile**: userType, language, selectedTopics, groupClass
- **Features**: currentFeatureAccess, featureAccessRequests
- **Groups**: assignedGroup, moderatorNote
- **Google Integration**: googleCalendarId, googleTokens
- **Metadata**: timestamps, isActive

#### Group Model Fields:
- **Basic Info**: name, topic, description, type
- **Management**: moderator, maxCapacity, schedule
- **Status**: status, members
- **Metadata**: createdAt, updatedAt

#### Payment Model Fields:
- **Transaction**: userId, amount, paymentMethod, status
- **Details**: transactionId, orderId, razorpayOrderId
- **Metadata**: timestamps

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install mongoose bcryptjs jsonwebtoken
```

### 2. Start MongoDB
```bash
# Local MongoDB
mongod

# Or use MongoDB Atlas (recommended for production)
```

### 3. Run the Application
```bash
npm start
```

## 📊 Database Indexes

For optimal performance, add these indexes to your models:

### Users Collection:
```javascript
// Unique mobile number index
userSchema.index({ mobileNumber: 1 }, { unique: true });

// User type index for filtering
userSchema.index({ userType: 1 });

// Group class index
userSchema.index({ groupClass: 1 });

// Verification status index
userSchema.index({ isVerified: 1 });

// Created at index for sorting
userSchema.index({ createdAt: -1 });
```

### Groups Collection:
```javascript
// Moderator index
groupSchema.index({ moderator: 1 });

// Type index
groupSchema.index({ type: 1 });

// Status index
groupSchema.index({ status: 1 });

// Created at index
groupSchema.index({ createdAt: -1 });
```

### Payments Collection:
```javascript
// User ID index
paymentSchema.index({ userId: 1 });

// Status index
paymentSchema.index({ status: 1 });

// Payment method index
paymentSchema.index({ paymentMethod: 1 });

// Created at index
paymentSchema.index({ createdAt: -1 });
```

## 🔐 Security Considerations

### 1. Authentication
- **Password Hashing**: Using bcrypt for OTP hashing
- **JWT Tokens**: Secure token-based authentication
- **Input Validation**: Express-validator for sanitization

### 2. Data Protection
- **Encryption**: All sensitive data encrypted at rest
- **Access Control**: Role-based access (user/moderator/admin)
- **Audit Trail**: Timestamps for all operations

### 3. Backup Strategy
```javascript
// Recommended backup script
const { exec } = require('child_process');

// Daily backup
exec('mongodump --db onlydivorce --out /backups/$(date +%Y%m%d) --gzip', (error, stdout, stderr) => {
  if (error) console.error('Backup failed:', error);
  else console.log('Backup completed successfully');
});
```

## 📈 Performance Optimization

### 1. Connection Pooling
```javascript
// In database.js
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

mongoose.connect(process.env.MONGODB_URI, options);
```

### 2. Query Optimization
```javascript
// Use lean() for read-only operations
const users = await User.find({ isActive: true }).lean();

// Use select() to limit fields
const users = await User.find({}).select('mobileNumber userType isVerified');

// Use pagination for large datasets
const users = await User.find({})
  .limit(20)
  .skip(page * 20)
  .sort({ createdAt: -1 });
```

## 🔍 Monitoring & Debugging

### 1. MongoDB Queries
```javascript
// Enable query logging
mongoose.set('debug', true);

// Monitor slow queries
mongoose.connection.on('connected', () => {
  console.log('Enabling MongoDB query monitoring');
});
```

### 2. Performance Metrics
```javascript
// Track query performance
const startTime = Date.now();
const users = await User.find({});
const duration = Date.now() - startTime;
console.log(`Query took ${duration}ms`);
```

## 🌐 Production Deployment

### 1. MongoDB Atlas Setup
```env
# Production MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/onlydivorce?retryWrites=true&w=majority
```

### 2. Environment Variables
```env
NODE_ENV=production
MONGODB_URI=your-atlas-connection-string
JWT_SECRET=your-super-secret-jwt-key
```

### 3. Security Headers
```javascript
// In app.js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
```

## 📝 Data Migration Scripts

### 1. User Migration
```javascript
// scripts/migrateUsers.js
const User = require('../src/models/User');

async function migrateUsers() {
  // Add new field to existing users
  await User.updateMany(
    { newField: { $exists: false } },
    { $set: { newField: 'defaultValue' } }
  );
  
  console.log('User migration completed');
}

module.exports = { migrateUsers };
```

### 2. Data Seeding
```javascript
// scripts/seedData.js
const User = require('../src/models/User');
const Group = require('../src/models/Group');

async function seedData() {
  // Create sample data
  const sampleUser = new User({
    mobileNumber: '9876543210',
    userType: 'admin',
    isVerified: true,
    language: 'English'
  });
  
  await sampleUser.save();
  console.log('Sample data seeded');
}

module.exports = { seedData };
```

## 🚨 Troubleshooting

### Common Issues & Solutions:

1. **Connection Timeout**
   - Check MongoDB connection string
   - Verify network connectivity
   - Check firewall settings

2. **Schema Validation Errors**
   - Ensure required fields are provided
   - Check data types match schema
   - Validate enum values

3. **Performance Issues**
   - Add appropriate indexes
   - Use lean() for read operations
   - Implement pagination

4. **Memory Leaks**
   - Close database connections properly
   - Use connection pooling
   - Monitor memory usage

## 📚 Additional Resources

- [MongoDB Documentation](https://docs.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)

---

**Last Updated**: March 2024
**Version**: 1.0.0
**Maintainer**: ReLife Development Team
