const Setting = require('../models/Setting');

exports.createOrUpdateSetting = async (req, res) => {
  try {
    const { locationName } = req.body;
    const updated = await Setting.findOneAndUpdate(
      { locationName },
      { $set: req.body },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getSettingByLocation = async (req, res) => {
  try {
    const { locationName } = req.params;
    const setting = await Setting.findOne({ locationName });
    if (!setting) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: setting });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getAllSettings = async (_req, res) => {
  try {
    const settings = await Setting.find();
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
