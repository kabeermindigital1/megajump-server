const express = require('express');
const router = express.Router();
const {
  createTimeSlot,
  getTimeSlotsByDate,
  updateTimeSlot,
  deleteTimeSlot,
  bulkCreateSlots,
  getAllTimeSlots,
  deleteAllSlots,
  deleteSlotsByDate
} = require('../controllers/timeSlotController');

// ✅ DELETE ALL slots — must come before `/:id`
router.delete('/all', deleteAllSlots);

// ✅ DELETE slots by specific date — must come before `/:id`
router.delete('/date/:date', deleteSlotsByDate);

// ✅ Bulk create slots
router.post('/bulk-create', bulkCreateSlots);



// ✅ Create new slot
router.post('/', createTimeSlot);

// ✅ Get all slots or filter by ?date
router.get('/', getAllTimeSlots);

// ✅ Get slot by ID (optional, not used in bulk)
router.get('/:date', getTimeSlotsByDate);

// ✅ Update individual slot
router.put('/:id', updateTimeSlot);

// ✅ Delete individual slot
router.delete('/:id', deleteTimeSlot);

module.exports = router;
