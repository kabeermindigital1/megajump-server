const express = require('express');
const router = express.Router();
const facebookConversionsService = require('../services/facebookConversionsService');

// Test Facebook API connection
router.get('/test', async (req, res) => {
  try {
    const result = await facebookConversionsService.testConnection();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Facebook API connection successful',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Facebook API connection failed',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Facebook API test error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during Facebook API test',
      error: error.message
    });
  }
});

// Send purchase event to Facebook Conversions API
router.post('/conversions', async (req, res) => {
  try {
    const {
      event_name,
      event_time,
      event_id,
      user_data,
      custom_data
    } = req.body;

    // Validate required fields
    if (!event_name || !event_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: event_name and event_id are required',
        error: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Prepare ticket data for the service
    const ticketData = {
      ticketId: user_data?.external_id || event_id,
      email: user_data?.em ? Buffer.from(user_data.em, 'hex').toString() : null, // Note: This is simplified, in production you'd need proper decryption
      phone: user_data?.ph ? Buffer.from(user_data.ph, 'hex').toString() : null,
      subtotal: custom_data?.value || 0,
      currency: custom_data?.currency || 'EUR',
      eventId: event_id,
      eventTime: event_time
    };

    let result = false;

    // Send appropriate event based on event_name
    if (event_name === 'Purchase') {
      result = await facebookConversionsService.sendPurchaseEvent(ticketData);
    } else if (event_name === 'ViewContent') {
      result = await facebookConversionsService.sendViewContentEvent(ticketData);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported event type. Only Purchase and ViewContent are supported.',
        error: 'UNSUPPORTED_EVENT_TYPE'
      });
    }

    if (result) {
      res.json({
        success: true,
        message: `${event_name} event sent successfully to Facebook Conversions API`,
        data: {
          event_name,
          event_id,
          sent_at: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to send ${event_name} event to Facebook Conversions API`,
        error: 'FACEBOOK_API_ERROR'
      });
    }

  } catch (error) {
    console.error('Facebook Conversions API error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while sending Facebook conversion event',
      error: error.message
    });
  }
});

// Health check endpoint for Facebook service
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Facebook Conversions API service is running',
    timestamp: new Date().toISOString(),
    pixelId: process.env.FACEBOOK_PIXEL_ID || '1121695493214669',
    hasAccessToken: !!process.env.FACEBOOK_ACCESS_TOKEN
  });
});

module.exports = router; 