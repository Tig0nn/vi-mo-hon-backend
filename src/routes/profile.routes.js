const express = require('express');
const profileController = require('../controllers/profile.controller');

const router = express.Router();

router.post('/', profileController.createProfile);
router.get('/:userId', profileController.getProfile);
router.patch('/:userId', profileController.updateProfile);

module.exports = router;
