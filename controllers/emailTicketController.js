const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const EmailLog = require("../models/EmailLog"); // ✅ import model

const sendTicketByEmail = async (req, res) => {
  try {
    const { email, name, ticketId } = req.body;
    const pdfFile = req.file;

    if (!email || !ticketId || !pdfFile) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // use TLS
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: `"Mega Jump" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "🎫 Your Mega Jump Ticket Confirmation",
        text: `Hi${name ? " " + name : ""},\n\nYour ticket is confirmed. Find your Mega Jump ticket attached.\n\nTicket ID: ${ticketId}`,
        attachments: [
          {
            filename: `MegaJump_Ticket_${ticketId}.pdf`,
            path: pdfFile.path,
          },
        ],
      };

    await transporter.sendMail(mailOptions);

    // ✅ Log success
    await EmailLog.create({
      email,
      name,
      ticketId,
      status: "SENT",
    });

    // Clean up file after sending
    fs.unlinkSync(pdfFile.path);

    return res.status(200).json({ message: "Email sent successfully" });
  } catch (err) {
    console.error("❌ Failed to send email:", err);

    // ✅ Log failure
    await EmailLog.create({
      email: req.body.email,
      name: req.body.name || "",
      ticketId: req.body.ticketId,
      status: "FAILED",
      error: err.message,
    });

    return res.status(500).json({ message: "Failed to send email", error: err.message });
  }
};

module.exports = { sendTicketByEmail };
