const Setting = require('../models/Setting');

exports.createSetting = async (req, res) => {
  try {
    const newSetting = new Setting(req.body);
    const saved = await newSetting.save();
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateSettingById = async (req, res) => {
  try {
    const updated = await Setting.findByIdAndUpdate(req.params.id, req.body, {
      new: true
    });
    if (!updated) return res.status(404).json({ success: false, message: 'Setting not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getSettingById = async (req, res) => {
  try {
    const setting = await Setting.findById(req.params.id);
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
