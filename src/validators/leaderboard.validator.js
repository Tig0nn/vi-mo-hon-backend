const { z } = require('zod');

const leaderboardQuerySchema = z.object({
  type: z.enum(['discipline', 'streak'], {
    errorMap: () => ({
      message: 'Loại bảng xếp hạng không hợp lệ. Chỉ chấp nhận "discipline" (Kỷ luật) hoặc "streak" (Chuỗi ngày). Tuyệt đối không xếp hạng theo tiền.',
    }),
  }).default('discipline'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  userId: z.string().trim().optional(),
});

module.exports = {
  leaderboardQuerySchema,
};
