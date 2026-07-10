const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const { env } = require('./src/config/env');

const challengeRouter = require('./src/routes/challenge.routes');
const coachRouter = require('./src/routes/coach.routes');
const dashboardRouter = require('./src/routes/dashboard.routes');
const expenseRouter = require('./src/routes/expense.routes');
const healthRouter = require('./src/routes/health.routes');
const profileRouter = require('./src/routes/profile.routes');
const notFoundHandler = require('./src/middlewares/notFound.middleware');
const errorHandler = require('./src/middlewares/error.middleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(logger('dev', { skip: () => env.NODE_ENV === 'test' }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// API Routes
app.use('/api/health', healthRouter);
app.use('/api/profile', profileRouter);
app.use('/api/expenses', expenseRouter);
app.use('/api/challenges', challengeRouter);
app.use('/api/coach', coachRouter);
app.use('/api/dashboard', dashboardRouter);

// Catch 404 and forward to error handler (Returns JSON)
app.use(notFoundHandler);

// Error handler (Returns JSON)
app.use(errorHandler);

module.exports = app;
