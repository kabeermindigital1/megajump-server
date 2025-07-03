// controllers/cancelRequestController.js
const CancelRequest = require('../models/CancelRequest');

exports.submitCancelRequest = async (req, res) => {
  const { ticketId, email, reason } = req.body;

  try {
    const request = new CancelRequest({
      ticketId,
      email,
      reason: reason || "No reason provided",
    });

    await request.save();
    console.log("📬 Cancellation request saved:", request);

    res.status(200).json({ message: "Cancellation request submitted successfully." });
  } catch (error) {
    console.error("❌ Error saving cancellation request:", error);
    res.status(500).json({ message: "Failed to submit cancellation request." });
  }
};

exports.getAllCancelRequests = async (req, res) => {
    try {
      const requests = await CancelRequest.find().sort({ createdAt: -1 });
      res.status(200).json(requests);
    } catch (error) {
      console.error("❌ Error fetching cancellation requests:", error);
      res.status(500).json({ message: "Failed to retrieve cancellation requests." });
    }
  };
