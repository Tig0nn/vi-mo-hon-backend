const express = require('express');
const profileController = require('../controllers/profile.controller');

const router = express.Router();

router.post('/', profileController.createProfile);
router.post('/upgrade-premium', profileController.upgradePremium);
router.post('/freeze-streak', profileController.freezeStreak);
router.get('/:userId', profileController.getProfile);
router.patch('/:userId', profileController.updateProfile);

module.exports = router;
