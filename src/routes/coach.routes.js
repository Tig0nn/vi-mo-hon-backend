const express = require("express");
const coachController = require("../controllers/coach.controller");
const coachRateLimit = require("../middlewares/coachRateLimit.middleware");

const router = express.Router();

router.post(
  "/anti-regret",
  coachRateLimit,
  coachController.createAntiRegretResponse,
);
router.post("/chat", coachRateLimit, coachController.createChatResponse);

module.exports = router;
