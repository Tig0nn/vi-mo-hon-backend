const express = require('express');
const coachController = require('../controllers/coach.controller');

const router = express.Router();

router.post('/anti-regret', coachController.createAntiRegretResponse);
router.post('/chat', coachController.createChatResponse);

module.exports = router;
