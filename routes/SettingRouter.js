const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');

// GET all settings (optional)
router.get('/', async (req, res) => {
  const settings = await Setting.find();
  res.json(settings);
});

// GET by locationName
router.get('/:locationName', async (req, res) => {
  const setting = await Setting.findOne({ locationName: req.params.locationName });
  if (!setting) return res.status(404).json({ error: 'Location not found' });
  res.json(setting);
});

// PUT by locationName (upsert)
router.put('/:locationName', async (req, res) => {
  const data = req.body;
  const updated = await Setting.findOneAndUpdate(
    { locationName: req.params.locationName },
    data,
    { new: true, upsert: true }
  );
  res.json(updated);
});

module.exports = router;