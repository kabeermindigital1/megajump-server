const crypto = require('crypto');
const axios = require('axios');

class FacebookConversionsService {
  constructor() {
    this.accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    this.pixelId = process.env.FACEBOOK_PIXEL_ID || '1121695493214669';
    this.apiVersion = process.env.FACEBOOK_API_VERSION || 'v17.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.pixelId}/events`;
  }

  // Hash email for Facebook Conversions API
  hashEmail(email) {
    if (!email) return null;
    return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
  }

  // Hash phone for Facebook Conversions API
  hashPhone(phone) {
    if (!phone) return null;
    // Remove all non-numeric characters and hash
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 0) return null;
    return crypto.createHash('sha256').update(cleanPhone).digest('hex');
  }

  // Send purchase event to Facebook Conversions API
  async sendPurchaseEvent(ticketData) {
    try {
      if (!this.accessToken) {
        console.warn('⚠️ Facebook access token not configured, skipping conversion tracking');
        return false;
      }

      const {
        ticketId,
        email,
        phone,
        subtotal,
        currency = 'EUR',
        eventId,
        eventTime
      } = ticketData;

      // Prepare user data with hashed values
      const userData = {};
      if (email) {
        userData.em = this.hashEmail(email);
      }
      if (phone) {
        userData.ph = this.hashPhone(phone);
      }
      if (ticketId) {
        userData.external_id = ticketId;
      }

      // Prepare custom data
      const customData = {
        value: parseFloat(subtotal) || 0,
        currency: currency.toUpperCase(),
        content_type: 'product',
        content_name: 'Mega Jump Park Ticket',
        content_category: 'Entertainment',
        content_ids: [ticketId],
        num_items: 1
      };

      // Prepare the event payload
      const eventData = {
        event_name: 'Purchase',
        event_time: eventTime || Math.floor(Date.now() / 1000),
        event_id: eventId || `purchase_${ticketId}_${Date.now()}`,
        user_data: userData,
        custom_data: customData,
        action_source: 'website'
      };

      console.log('📊 Sending Facebook Conversion Event:', {
        event_name: eventData.event_name,
        event_id: eventData.event_id,
        value: customData.value,
        currency: customData.currency
      });

      // Send to Facebook Conversions API
      const response = await axios.post(this.baseUrl, {
        data: [eventData],
        access_token: this.accessToken
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      if (response.data && response.data.events_received > 0) {
        console.log('✅ Facebook Conversion Event sent successfully:', {
          event_id: eventData.event_id,
          events_received: response.data.events_received
        });
        return true;
      } else {
        console.warn('⚠️ Facebook Conversion Event response unexpected:', response.data);
        return false;
      }

    } catch (error) {
      console.error('❌ Facebook Conversion Event failed:', {
        error: error.message,
        ticketId: ticketData.ticketId,
        eventId: ticketData.eventId
      });

      // Log detailed error for debugging
      if (error.response) {
        console.error('Facebook API Error Response:', {
          status: error.response.status,
          data: error.response.data
        });
      }

      return false;
    }
  }

  // Send view content event to Facebook Conversions API
  async sendViewContentEvent(ticketData) {
    try {
      if (!this.accessToken) {
        console.warn('⚠️ Facebook access token not configured, skipping view content tracking');
        return false;
      }

      const {
        ticketId,
        email,
        phone,
        subtotal,
        currency = 'EUR',
        eventId,
        eventTime
      } = ticketData;

      // Prepare user data with hashed values
      const userData = {};
      if (email) {
        userData.em = this.hashEmail(email);
      }
      if (phone) {
        userData.ph = this.hashPhone(phone);
      }
      if (ticketId) {
        userData.external_id = ticketId;
      }

      // Prepare custom data for view content
      const customData = {
        value: parseFloat(subtotal) || 0,
        currency: currency.toUpperCase(),
        content_type: 'product',
        content_name: 'Mega Jump Park Ticket',
        content_category: 'Entertainment',
        content_ids: [ticketId]
      };

      // Prepare the event payload
      const eventData = {
        event_name: 'ViewContent',
        event_time: eventTime || Math.floor(Date.now() / 1000),
        event_id: eventId || `view_${ticketId}_${Date.now()}`,
        user_data: userData,
        custom_data: customData,
        action_source: 'website'
      };

      console.log('📊 Sending Facebook ViewContent Event:', {
        event_name: eventData.event_name,
        event_id: eventData.event_id
      });

      // Send to Facebook Conversions API
      const response = await axios.post(this.baseUrl, {
        data: [eventData],
        access_token: this.accessToken
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      if (response.data && response.data.events_received > 0) {
        console.log('✅ Facebook ViewContent Event sent successfully:', {
          event_id: eventData.event_id,
          events_received: response.data.events_received
        });
        return true;
      } else {
        console.warn('⚠️ Facebook ViewContent Event response unexpected:', response.data);
        return false;
      }

    } catch (error) {
      console.error('❌ Facebook ViewContent Event failed:', {
        error: error.message,
        ticketId: ticketData.ticketId,
        eventId: ticketData.eventId
      });

      return false;
    }
  }

  // Test Facebook API connection
  async testConnection() {
    try {
      if (!this.accessToken) {
        return { success: false, error: 'Access token not configured' };
      }

      const response = await axios.get(`https://graph.facebook.com/${this.apiVersion}/${this.pixelId}`, {
        params: {
          access_token: this.accessToken,
          fields: 'id,name'
        },
        timeout: 10000
      });

      return {
        success: true,
        pixelId: response.data.id,
        pixelName: response.data.name
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new FacebookConversionsService(); 