const Ticket = require('../models/Ticket');
const EmailLog = require('../models/EmailLog');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

class EmailRetryService {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    this.transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateLimit: 14,
    });
  }

  async start() {
    if (this.isRunning) {
      console.log('🔄 Email Retry Service is already running');
      return;
    }

    console.log('🚀 Starting Email Retry Service...');
    this.isRunning = true;

    // Run immediately on start
    await this.checkAndRetryEmails();

    // Then run every 2 minutes
    this.interval = setInterval(async () => {
      await this.checkAndRetryEmails();
    }, 2 * 60 * 1000); // 2 minutes

    console.log('✅ Email Retry Service started - will run every 2 minutes');
  }

  async stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('🛑 Email Retry Service stopped');
  }

  async checkAndRetryEmails() {
    try {
      console.log('🔍 Email Retry Service: Checking for missing emails...');
      
      // Get all tickets that should have emails sent
      const tickets = await Ticket.find({
        email: { $exists: true, $ne: null, $ne: '' },
        cancelTicket: false,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      });

      console.log(`📊 Found ${tickets.length} tickets to check`);

      for (const ticket of tickets) {
        await this.processTicket(ticket);
      }

      console.log('✅ Email Retry Service: Check completed');
    } catch (error) {
      console.error('❌ Email Retry Service Error:', error);
    }
  }

  async processTicket(ticket) {
    try {
      // Check if email was already sent successfully
      const existingEmailLog = await EmailLog.findOne({
        ticketId: ticket.ticketId,
        status: 'SENT'
      });

      if (existingEmailLog) {
        console.log(`✅ Email already sent for ticket ${ticket.ticketId}`);
        return;
      }

      // Check if there's a failed attempt
      const failedEmailLog = await EmailLog.findOne({
        ticketId: ticket.ticketId,
        status: 'FAILED'
      });

      // If failed attempt exists and it's been more than 1 hour, retry
      if (failedEmailLog) {
        const timeSinceLastAttempt = Date.now() - failedEmailLog.sentAt.getTime();
        if (timeSinceLastAttempt < 60 * 60 * 1000) { // 1 hour
          console.log(`⏳ Skipping retry for ticket ${ticket.ticketId} - too soon since last attempt`);
          return;
        }
      }

      console.log(`📧 Attempting to send email for ticket ${ticket.ticketId} to ${ticket.email}`);

      // Generate a simple email without PDF for retry
      const emailSent = await this.sendRetryEmail(ticket);

      if (emailSent) {
        // Log successful retry
        await EmailLog.create({
          email: ticket.email,
          name: ticket.name || '',
          ticketId: ticket.ticketId,
          status: 'SENT',
          retryCount: failedEmailLog ? (failedEmailLog.retryCount || 0) + 1 : 0
        });

        console.log(`✅ Successfully sent retry email for ticket ${ticket.ticketId}`);
      } else {
        // Log failed retry
        await EmailLog.findOneAndUpdate(
          { ticketId: ticket.ticketId, status: 'FAILED' },
          {
            email: ticket.email,
            name: ticket.name || '',
            ticketId: ticket.ticketId,
            status: 'FAILED',
            error: 'Retry failed - no PDF available',
            retryCount: (failedEmailLog?.retryCount || 0) + 1,
            sentAt: new Date()
          },
          { upsert: true, new: true }
        );

        console.log(`❌ Failed to send retry email for ticket ${ticket.ticketId}`);
      }

    } catch (error) {
      console.error(`❌ Error processing ticket ${ticket.ticketId}:`, error);
      
      // Log the error
      await EmailLog.findOneAndUpdate(
        { ticketId: ticket.ticketId, status: 'FAILED' },
        {
          email: ticket.email,
          name: ticket.name || '',
          ticketId: ticket.ticketId,
          status: 'FAILED',
          error: error.message,
          retryCount: 1,
          sentAt: new Date()
        },
        { upsert: true, new: true }
      );
    }
  }

  async sendRetryEmail(ticket) {
    try {
      // Generate QR code for ticket ID
      const qrCodeData = ticket.ticketId;
      const qrCodeBuffer = await QRCode.toBuffer(qrCodeData, {
        type: 'image/png',
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Save QR code to temporary file
      const qrCodeFileName = `qr_${ticket.ticketId}_${Date.now()}.png`;
      const qrCodeFilePath = `uploads/${qrCodeFileName}`;
      fs.writeFileSync(qrCodeFilePath, qrCodeBuffer);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Mega Jump Ticket</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #2196F3; text-align: center; margin-bottom: 30px;">🎫 Mega Jump Ticket</h1>
            
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${ticket.name || 'there'}!</h2>
            
            <p style="color: #666; line-height: 1.6; font-size: 16px; margin-bottom: 20px;">
              Your Mega Jump ticket is ready! This is a retry email with QR code for easy access.
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="margin-top: 0; color: #333;">Ticket Details:</h3>
              <p style="margin: 8px 0; font-size: 16px;"><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
              <p style="margin: 8px 0; font-size: 16px;"><strong>Date:</strong> ${ticket.date}</p>
              <p style="margin: 8px 0; font-size: 16px;"><strong>Time:</strong> ${ticket.startTime} - ${ticket.endTime}</p>
              <p style="margin: 8px 0; font-size: 16px;"><strong>Number of Tickets:</strong> ${ticket.tickets}</p>
              <p style="margin: 8px 0; font-size: 16px;"><strong>Total Amount:</strong> €${ticket.subtotal}</p>
            </div>
            
            <div style="text-align: center; margin: 20px 0; padding: 20px; background: #f0f8ff; border-radius: 8px;">
              <h3 style="color: #333; margin-bottom: 15px;">📱 QR Code for Quick Access</h3>
              <p style="color: #666; margin-bottom: 15px; font-size: 14px;">
                Scan this QR code at the entrance for quick verification
              </p>
              <img src="cid:qr-code" alt="Ticket QR Code" style="width: 150px; height: 150px; border: 2px solid #2196F3; border-radius: 8px;">
              <p style="color: #999; font-size: 12px; margin-top: 10px;">
                Ticket ID: ${ticket.ticketId}
              </p>
            </div>
            
            <p style="color: #666; line-height: 1.6; font-size: 16px; margin-bottom: 20px;">
              <strong>Note:</strong> This is a retry email with QR code. You can show this email or scan the QR code at the entrance.
            </p>
            
            <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #0056b3; font-size: 16px;">
                <strong>📍 Location:</strong> Mega Jump Trampoline Park<br>
                <strong>📞 Contact:</strong> For any questions, please contact us
              </p>
            </div>
            
            <p style="color: #666; line-height: 1.6; font-size: 16px; margin-bottom: 20px;">
              We hope you have an amazing time at Mega Jump! 🎉
            </p>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
              <p style="color: #999; font-size: 14px; margin: 0;">
                Best regards,<br>
                The Mega Jump Team
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
Mega Jump Ticket - Retry Email with QR Code

Hello ${ticket.name || 'there'}!

Your Mega Jump ticket is ready! This is a retry email with QR code for easy access.

Ticket Details:
- Ticket ID: ${ticket.ticketId}
- Date: ${ticket.date}
- Time: ${ticket.startTime} - ${ticket.endTime}
- Number of Tickets: ${ticket.tickets}
- Total Amount: €${ticket.subtotal}

QR Code: A QR code is attached to this email containing your ticket ID.
You can scan this QR code at the entrance for quick verification.

Note: This is a retry email with QR code. You can show this email or scan the QR code at the entrance.

Location: Mega Jump Trampoline Park
Contact: For any questions, please contact us

We hope you have an amazing time at Mega Jump!

Best regards,
The Mega Jump Team
      `;

      const mailOptions = {
        from: `"Mega Jump" <${process.env.EMAIL_USER}>`,
        to: ticket.email,
        subject: "🎫 Your Mega Jump Ticket - Retry Email with QR Code",
        text: textContent,
        html: htmlContent,
        attachments: [
          {
            filename: `MegaJump_QR_${ticket.ticketId}.png`,
            path: qrCodeFilePath,
            cid: 'qr-code' // Content ID for embedding in HTML
          }
        ],
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'high',
          'X-Mailer': 'MegaJump-Retry-System'
        }
      };

      await this.transporter.sendMail(mailOptions);
      
      // Clean up QR code file after sending
      try {
        fs.unlinkSync(qrCodeFilePath);
      } catch (cleanupError) {
        console.error('Failed to cleanup QR code file:', cleanupError);
      }
      
      return true;

    } catch (error) {
      console.error('Failed to send retry email:', error);
      
      // Clean up QR code file if it exists
      try {
        const qrCodeFileName = `qr_${ticket.ticketId}_${Date.now()}.png`;
        const qrCodeFilePath = `uploads/${qrCodeFileName}`;
        if (fs.existsSync(qrCodeFilePath)) {
          fs.unlinkSync(qrCodeFilePath);
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup QR code file on error:', cleanupError);
      }
      
      return false;
    }
  }

  async getEmailStats() {
    try {
      const stats = await EmailLog.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            lastSent: { $max: '$sentAt' }
          }
        }
      ]);

      const totalTickets = await Ticket.countDocuments({
        email: { $exists: true, $ne: null, $ne: '' },
        cancelTicket: false
      });

      const sentEmails = stats.find(s => s._id === 'SENT')?.count || 0;
      const failedEmails = stats.find(s => s._id === 'FAILED')?.count || 0;

      return {
        totalTickets,
        sentEmails,
        failedEmails,
        successRate: totalTickets > 0 ? ((sentEmails / totalTickets) * 100).toFixed(2) : 0,
        lastSent: stats.find(s => s._id === 'SENT')?.lastSent,
        lastFailed: stats.find(s => s._id === 'FAILED')?.lastSent
      };
    } catch (error) {
      console.error('Error getting email stats:', error);
      return null;
    }
  }
}

module.exports = new EmailRetryService(); 