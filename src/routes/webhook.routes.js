const express = require('express');
const webhookController = require('../controllers/webhook.controller');

const router = express.Router();

router.post('/revenuecat', webhookController.handleRevenueCatWebhook);
router.post('/verify-purchase', webhookController.verifyPurchase);

module.exports = router;
