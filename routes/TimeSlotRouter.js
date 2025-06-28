const express = require('express');
const router = express.Router();
const TimeSlot = require('../models/TimeSlot');

// GET all time slots (optionally filtered by date)
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    const query = date ? { date } : {};
    const slots = await TimeSlot.find(query).sort({ startTime: 1 });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET a specific time slot by ID
router.get('/:id', async (req, res) => {
  try {
    const slot = await TimeSlot.findById(req.params.id);
    if (!slot) return res.status(404).json({ error: 'Time slot not found' });
    res.json(slot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new time slot
router.post('/', async (req, res) => {
  try {
    const newSlot = new TimeSlot(req.body);
    const savedSlot = await newSlot.save();
    res.status(201).json(savedSlot);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update a time slot
router.put('/:id', async (req, res) => {
  try {
    const updated = await TimeSlot.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Time slot not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a time slot
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await TimeSlot.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Time slot not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
