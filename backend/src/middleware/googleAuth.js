const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Load credentials from environment variables or credentials file
const credentials = {
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
};

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  credentials.client_id,
  credentials.client_secret,
  credentials.redirect_uri
);

// Generate authentication URL
const getAuthUrl = () => {
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
};

// Set credentials from code
const setCredentials = (tokens) => {
  oauth2Client.setCredentials(tokens);
};

// Get OAuth2 client
const getOAuth2Client = () => oauth2Client;

// Refresh access token
const refreshAccessToken = async () => {
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    return credentials;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
};

// Middleware to check if user has Google authentication
const requireGoogleAuth = async (req, res, next) => {
  try {
    // Check if tokens are available in session or database
    const tokens = req.session?.googleTokens || req.user?.googleTokens;

    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: 'Google authentication required',
        authUrl: getAuthUrl()
      });
    }

    oauth2Client.setCredentials(tokens);

    // Test if token is valid by making a simple API call
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.calendarList.list({ maxResults: 1 });

    req.googleAuth = oauth2Client;
    next();
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid Google authentication',
      authUrl: getAuthUrl()
    });
  }
};

module.exports = {
  getAuthUrl,
  setCredentials,
  getOAuth2Client,
  refreshAccessToken,
  requireGoogleAuth
};
