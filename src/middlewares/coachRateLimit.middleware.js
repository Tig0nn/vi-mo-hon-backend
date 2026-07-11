const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const getUserId = (req) => {
  const value = req.body && req.body.userId;

  return typeof value === "string" ? value.trim() : "";
};

const coachRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,

  // Tối đa 30 lượt gọi Coach mỗi giờ cho một user/thiết bị.
  limit: 30,

  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    const userId = getUserId(req);
    const normalizedIp = ipKeyGenerator(req.ip);

    // Các tester chung Wi-Fi nhưng có userId khác nhau
    // vẫn có giới hạn riêng.
    return userId ? `${normalizedIp}:${userId}` : normalizedIp;
  },

  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      message: "Bạn đã dùng Coach hơi nhiều, thử lại sau nha.",
    }),
});

module.exports = coachRateLimit;
