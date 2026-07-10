const express = require('express');
const coachController = require('../controllers/coach.controller');

const router = express.Router();

router.post('/anti-regret', coachController.createAntiRegretResponse);

module.exports = router;
