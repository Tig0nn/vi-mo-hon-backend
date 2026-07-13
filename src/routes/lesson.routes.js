const express = require('express');
const lessonController = require('../controllers/lesson.controller');

const router = express.Router();

router.get('/', lessonController.listLessons);
router.post('/:lessonId/complete', lessonController.completeLesson);

module.exports = router;
