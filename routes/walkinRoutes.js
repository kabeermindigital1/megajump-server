const express = require('express');
const router = express.Router();
const walkinController = require('../controllers/walkinController');

router.use(express.json()); // parse JSON body

router.post('/book', walkinController.bookWalkInTicket);

module.exports = router;