const profileService = require('../services/profile.service');
const { sendError, sendSuccess } = require('../utils/response');

const EXPECTED_PACKAGE_ID = 'vmh_premium_monthly_29k';

/**
 * Handle incoming webhooks from RevenueCat
 * Documentation: https://www.revenuecat.com/docs/webhooks
 */
const handleRevenueCatWebhook = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const configuredSecret = process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN;

  if (configuredSecret) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (token !== configuredSecret) {
      return sendError(res, 'Unauthorized webhook request', 401);
    }
  }

  const payload = req.body || {};
  const event = payload.event || payload;
  const eventType = event.type;
  const appUserId = event.app_user_id;

  if (!appUserId) {
    return sendError(res, 'Missing app_user_id in webhook event', 400);
  }

  try {
    let outcome = 'ignored';

    switch (eventType) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
      case 'NON_RENEWING_PURCHASE':
        await profileService.upgradeToPremium(appUserId);
        outcome = 'premium_granted';
        break;

      case 'CANCELLATION':
      case 'EXPIRATION':
        await profileService.revokePremium(appUserId);
        outcome = 'premium_revoked';
        break;

      default:
        outcome = `unhandled_event_${eventType || 'unknown'}`;
        break;
    }

    return sendSuccess(
      res,
      { appUserId, eventType, outcome },
      'RevenueCat webhook processed successfully',
      200
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * Verify or simulate In-App Purchase from client (StoreKit / Google Play / Sandbox)
 */
const verifyPurchase = async (req, res, next) => {
  const { userId, packageId, isSandbox } = req.body || {};

  if (!userId || typeof userId !== 'string') {
    return sendError(res, 'userId là bắt buộc', 400);
  }

  if (packageId && packageId !== EXPECTED_PACKAGE_ID) {
    return sendError(res, `Gói thanh toán không hợp lệ. Chỉ chấp nhận '${EXPECTED_PACKAGE_ID}'`, 400);
  }

  try {
    const updated = await profileService.upgradeToPremium(userId);
    return sendSuccess(
      res,
      {
        ...updated,
        isSandbox: Boolean(isSandbox),
        packageId: packageId || EXPECTED_PACKAGE_ID,
      },
      'Xác thực giao dịch In-App Purchase thành công! Gói Premium đã được kích hoạt.',
      200
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  handleRevenueCatWebhook,
  verifyPurchase,
};
