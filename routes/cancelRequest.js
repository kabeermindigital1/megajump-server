// routes/cancelRequest.js
const express = require('express');
const router = express.Router();
const cancelRequestController = require('../controllers/cancelRequestController');

router.post('/', cancelRequestController.submitCancelRequest);
router.get('/', cancelRequestController.getAllCancelRequests); // 👈 Admin fetch route
module.exports = router;
