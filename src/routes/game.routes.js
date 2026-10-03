const express = require('express');
const gameController = require('../controllers/game.controller');

const router = express.Router();

router.get('/tickets/:userId', gameController.getTickets);
router.post('/start-session', gameController.startSession);
router.post('/end-session', gameController.endSession);

module.exports = router;
