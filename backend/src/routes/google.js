const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const User = require('../models/User');
const { requireGoogleAuth, getAuthUrl, setCredentials, refreshAccessToken } = require('../middleware/googleAuth');

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();

  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Get Google OAuth URL
router.get('/auth-url', authenticateToken, (req, res) => {
  try {
    const authUrl = getAuthUrl();
    res.status(200).json({
      success: true,
      authUrl
    });
  } catch (error) {
    console.error('Get auth URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Handle OAuth callback and save tokens
router.post('/auth-callback', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code required'
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    );

    const { tokens } = await oauth2Client.getAccessToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user's calendar list to find primary calendar
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarList = await calendar.calendarList.list();
    const primaryCalendar = calendarList.data.items.find(cal => cal.primary);

    if (!primaryCalendar) {
      return res.status(400).json({
        success: false,
        message: 'No primary calendar found'
      });
    }

    // Update user with Google tokens and calendar ID
    await User.findByIdAndUpdate(req.user.userId, {
      googleCalendarId: primaryCalendar.id,
      googleTokens: tokens
    });

    res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      calendarId: primaryCalendar.id
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
});

// Create Google Calendar event and generate Meet link
router.post('/create-event', authenticateToken, requireGoogleAuth, [
  body('summary').trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('startTime').isISO8601(),
  body('endTime').isISO8601(),
  body('attendees').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { summary, description, startTime, endTime, attendees } = req.body;
    const user = await User.findById(req.user.userId);

    const calendar = google.calendar({ version: 'v3', auth: req.googleAuth });

    const event = {
      summary,
      description,
      start: {
        dateTime: new Date(startTime).toISOString(),
        timeZone: 'Asia/Kolkata' // Adjust based on your timezone
      },
      end: {
        dateTime: new Date(endTime).toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      attendees: attendees?.map(email => ({ email })) || [],
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    };

    const response = await calendar.events.insert({
      calendarId: user.googleCalendarId || 'primary',
      resource: event,
      conferenceDataVersion: 1
    });

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event: {
        id: response.data.id,
        summary: response.data.summary,
        startTime: response.data.start.dateTime,
        endTime: response.data.end.dateTime,
        meetLink: response.data.conferenceData?.entryPoints?.[0]?.uri,
        htmlLink: response.data.htmlLink
      }
    });

  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create event'
    });
  }
});

// Get user's Google Calendar events
router.get('/events', authenticateToken, requireGoogleAuth, async (req, res) => {
  try {
    const { timeMin, timeMax, maxResults = 10 } = req.query;
    const user = await User.findById(req.user.userId);

    const calendar = google.calendar({ version: 'v3', auth: req.googleAuth });

    const response = await calendar.events.list({
      calendarId: user.googleCalendarId || 'primary',
      timeMin: timeMin ? new Date(timeMin).toISOString() : undefined,
      timeMax: timeMax ? new Date(timeMax).toISOString() : undefined,
      maxResults: parseInt(maxResults),
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = response.data.items.map(event => ({
      id: event.id,
      summary: event.summary,
      description: event.description,
      startTime: event.start.dateTime || event.start.date,
      endTime: event.end.dateTime || event.end.date,
      meetLink: event.conferenceData?.entryPoints?.[0]?.uri,
      htmlLink: event.htmlLink
    }));

    res.status(200).json({
      success: true,
      events,
      count: events.length
    });

  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events'
    });
  }
});

// Update group creation to optionally use Google Calendar
router.post('/create-group-event', authenticateToken, requireGoogleAuth, [
  body('groupName').trim().isLength({ min: 3, max: 100 }),
  body('groupDescription').trim().isLength({ min: 10, max: 500 }),
  body('topic').isIn([
    'Women Support', 'Mens Support', 'Emotional & Mental Support',
    'Child Issues & Custody', 'NRI Section', 'Alimony', 'Maintenance',
    'Property', 'Cash', 'Gold', 'Domestic Violence', 'Child Abuse',
    'Extra Marital Issues'
  ]),
  body('language').isIn(['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam']),
  body('groupClass').isIn(['Basic', 'Premium']),
  body('scheduledDate').isISO8601(),
  body('duration').isInt({ min: 30, max: 180 }),
  body('maxParticipants').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.user.userId);

    if (user.userType !== 'moderator' && user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only moderators and admins can create group events'
      });
    }

    const {
      groupName,
      groupDescription,
      topic,
      language,
      groupClass,
      scheduledDate,
      duration,
      maxParticipants
    } = req.body;

    const startTime = new Date(scheduledDate);
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const calendar = google.calendar({ version: 'v3', auth: req.googleAuth });

    const event = {
      summary: `${groupName} - ${topic}`,
      description: `${groupDescription}\n\nTopic: ${topic}\nLanguage: ${language}\nClass: ${groupClass}`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      conferenceData: {
        createRequest: {
          requestId: `group-meet-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    };

    const response = await calendar.events.insert({
      calendarId: user.googleCalendarId || 'primary',
      resource: event,
      conferenceDataVersion: 1
    });

    res.status(201).json({
      success: true,
      message: 'Group event created successfully',
      event: {
        id: response.data.id,
        summary: response.data.summary,
        startTime: response.data.start.dateTime,
        endTime: response.data.end.dateTime,
        meetLink: response.data.conferenceData?.entryPoints?.[0]?.uri,
        htmlLink: response.data.htmlLink,
        groupDetails: {
          name: groupName,
          description: groupDescription,
          topic,
          language,
          groupClass,
          duration,
          maxParticipants: maxParticipants || 50
        }
      }
    });

  } catch (error) {
    console.error('Create group event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create group event'
    });
  }
});

module.exports = router;
