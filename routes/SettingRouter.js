const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');

// GET all settings
router.get('/', async (req, res) => {
  try {
    const settings = await Setting.find();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET by ID
router.get('/:id', async (req, res) => {
  try {
    const setting = await Setting.findById(req.params.id);
    if (!setting) return res.status(404).json({ error: 'Setting not found' });
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT by ID (Update)
router.put('/:id', async (req, res) => {
  try {
    const updated = await Setting.findByIdAndUpdate(req.params.id, req.body, {
      new: true
    });
    if (!updated) return res.status(404).json({ error: 'Setting not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST (Create new setting)
router.post('/', async (req, res) => {
  try {
    const newSetting = new Setting(req.body);
    const saved = await newSetting.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
