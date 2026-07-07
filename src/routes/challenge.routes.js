const express = require('express');
const challengeController = require('../controllers/challenge.controller');

const router = express.Router();

router.get('/', challengeController.listActiveChallenges);
router.post('/:challengeId/complete', challengeController.completeChallenge);

module.exports = router;
