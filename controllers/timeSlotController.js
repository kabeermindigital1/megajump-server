const TimeSlot = require('../models/TimeSlot');

exports.createTimeSlot = async (req, res) => {
  try {
    const slot = new TimeSlot(req.body);
    await slot.save();
    res.status(201).json({ success: true, data: slot });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getTimeSlotsByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const slots = await TimeSlot.find({ date });
    res.json({ success: true, data: slots });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateTimeSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await TimeSlot.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteTimeSlot = async (req, res) => {
  try {
    const { id } = req.params;
    await TimeSlot.findByIdAndDelete(id);
    res.json({ success: true, message: 'Time slot deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
