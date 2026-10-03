const express = require("express");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const { env } = require("./src/config/env");

const challengeRouter = require("./src/routes/challenge.routes");
const coachRouter = require("./src/routes/coach.routes");
const dashboardRouter = require("./src/routes/dashboard.routes");
const expenseRouter = require("./src/routes/expense.routes");
const gameRouter = require("./src/routes/game.routes");
const healthRouter = require("./src/routes/health.routes");
const leaderboardRouter = require("./src/routes/leaderboard.routes");
const lessonRouter = require("./src/routes/lesson.routes");
const profileRouter = require("./src/routes/profile.routes");
const webhookRouter = require("./src/routes/webhook.routes");
const devRouter = require("./src/routes/dev.routes");
const notFoundHandler = require("./src/middlewares/notFound.middleware");
const path = require("path");
const fs = require("fs");
const errorHandler = require("./src/middlewares/error.middleware");

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  })
);
app.use(cors());
app.use(logger("dev", { skip: () => env.NODE_ENV === "test" }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Serve 3D WebGL Games (Runner & Boss Battle)
const gameStaticPath = fs.existsSync(path.join(__dirname, "public/game"))
  ? path.join(__dirname, "public/game")
  : path.join(__dirname, "../vi-mo-hon-frontend/assets/game");

app.use(
  "/game",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(gameStaticPath)
);

// API Routes
app.use("/api/health", healthRouter);
app.use("/api/profile", profileRouter);
app.use("/api/expenses", expenseRouter);
app.use("/api/challenges", challengeRouter);
app.use("/api/lessons", lessonRouter);
app.use("/api/coach", coachRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/game", gameRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/webhooks", webhookRouter);
app.use("/api/dev", devRouter);

// Catch 404 and forward to error handler (Returns JSON)
app.use(notFoundHandler);

// Error handler (Returns JSON)
app.use(errorHandler);

module.exports = app;
