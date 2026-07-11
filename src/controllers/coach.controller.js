const coachService = require("../services/coach.service");
const { env } = require("../config/env");
const { sendError, sendSuccess } = require("../utils/response");
const { formatZodErrors } = require("../utils/validation");
const {
  antiRegretCoachSchema,
  chatCoachSchema,
} = require("../validators/coach.validator");

const createAntiRegretResponse = async (req, res, next) => {
  const result = antiRegretCoachSchema.safeParse(req.body);
  if (!result.success) {
    return sendError(
      res,
      "Validation failed",
      422,
      formatZodErrors(result.error),
    );
  }

  try {
    const serviceResult = await coachService.createAntiRegretResponse(
      result.data,
    );
    const { providerUsed, ...data } = serviceResult;
    const meta =
      env.NODE_ENV === "production"
        ? {}
        : { debug: { provider: providerUsed } };

    return sendSuccess(res, data, "Coach response generated", 200, meta);
  } catch (error) {
    return next(error);
  }
};

const createChatResponse = async (req, res, next) => {
  const result = chatCoachSchema.safeParse(req.body);
  if (!result.success) {
    return sendError(
      res,
      "Validation failed",
      422,
      formatZodErrors(result.error),
    );
  }

  try {
    const serviceResult = await coachService.createChatResponse(result.data);
    const { providerUsed, retryCount, ...data } = serviceResult;
    const meta =
      env.NODE_ENV === "production"
        ? {}
        : {
            debug: {
              provider: providerUsed,
              retryCount,
            },
          };

    return sendSuccess(res, data, "Coach chat response generated", 200, meta);
  } catch (error) {
    if (
      error.code === "AI_RESPONSE_INVALID" ||
      error.code === "AI_PROVIDER_ERROR"
    ) {
      const payload = {
        success: false,
        message: error.message,
        error: {
          code: error.code,
        },
      };

      if (env.NODE_ENV !== "production") {
        payload.debug = error.debug || {
          provider: "gemini",
        };
      }

      return res.status(error.status || 502).json(payload);
    }

    return next(error);
  }
};

module.exports = {
  createAntiRegretResponse,
  createChatResponse,
};
