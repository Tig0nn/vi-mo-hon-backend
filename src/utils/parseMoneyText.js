const MULTIPLIERS = {
  k: 1_000,
  nghìn: 1_000,
  ngàn: 1_000,

  m: 1_000_000,
  tr: 1_000_000,
  triệu: 1_000_000,

  vnd: 1,
  đ: 1,
  "₫": 1,
};

const parseNumber = (rawNumber, multiplier) => {
  // Có hậu tố như 1.5tr hoặc 1,5 triệu:
  // dấu chấm/phẩy được hiểu là phần thập phân.
  if (multiplier > 1) {
    const normalized = rawNumber.replace(",", ".");

    // Nhiều dấu phân cách thì coi chúng là dấu phân cách hàng nghìn.
    if ((normalized.match(/\./g) || []).length > 1) {
      return Number(rawNumber.replace(/[.,]/g, ""));
    }

    return Number(normalized);
  }

  // Không có hậu tố:
  // 35.000 hoặc 35,000 được hiểu là 35.000 VND.
  return Number(rawNumber.replace(/[.,]/g, ""));
};

const parseMoneyText = (text) => {
  if (!text) {
    return null;
  }

  const normalizedText = String(text).trim().toLowerCase();

  const pattern = /(\d[\d.,]*)\s*(triệu|nghìn|ngàn|vnd|tr|m|k|đ|₫)?/giu;

  const matches = [...normalizedText.matchAll(pattern)];

  if (matches.length === 0) {
    return null;
  }

  // Giữ hành vi cũ: lấy số tiền xuất hiện cuối cùng trong câu.
  const lastMatch = matches[matches.length - 1];

  const rawNumber = lastMatch[1];
  const suffix = lastMatch[2] || "";
  const multiplier = MULTIPLIERS[suffix] || 1;

  const baseAmount = parseNumber(rawNumber, multiplier);
  const amount = Math.round(baseAmount * multiplier);

  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

module.exports = {
  parseMoneyText,
};
