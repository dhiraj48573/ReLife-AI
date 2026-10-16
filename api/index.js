// api/index.js
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');

const app = express();
const PORT = process.env.PORT || 5005;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Import routes (adjust paths relative to this file)
const authRoutes = require('../backend/src/routes/auth');
const chatbotRoutes = require('../backend/src/routes/chatbot');
const groupsRoutes = require('../backend/src/routes/groups');
const moderatorRoutes = require('../backend/src/routes/moderator');
const adminRoutes = require('../backend/src/routes/admin');
const googleRoutes = require('../backend/src/routes/google');

app.use('/api/auth', authRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/moderator', moderatorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/google', googleRoutes);

// Serve static frontend files (the build output of your frontend)
app.use(express.static('frontend'));

// Fallback for SPA routing
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'frontend' });
});

module.exports = serverless(app);
