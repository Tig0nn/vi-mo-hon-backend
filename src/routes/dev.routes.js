const express = require('express');
const devController = require('../controllers/dev.controller');

const router = express.Router();

router.get('/tester-cohort-stats', devController.getTesterCohortStats);

module.exports = router;
