const express = require("express");
const multer = require("multer");
const coachController = require("../controllers/coach.controller");
const coachRateLimit = require("../middlewares/coachRateLimit.middleware");
const { createHttpError } = require("../utils/httpError");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const uploadAudio = (req, res, next) => {
  upload.single("audio")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(createHttpError(413, "Audio file must be 10MB or smaller"));
    }

    return next(createHttpError(400, "Invalid audio upload"));
  });
};

router.post(
  "/anti-regret",
  coachRateLimit,
  coachController.createAntiRegretResponse,
);
router.post("/chat", coachRateLimit, coachController.createChatResponse);
router.post(
  "/voice-message",
  coachRateLimit,
  uploadAudio,
  coachController.createVoiceMessageResponse,
);

module.exports = router;
