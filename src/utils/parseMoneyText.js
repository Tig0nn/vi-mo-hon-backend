const parseMoneyText = (text) => {
  if (!text) {
    return null;
  }

  const matches = String(text).match(/\d[\d.,]*/g);
  if (!matches) {
    return null;
  }

  const rawAmount = matches[matches.length - 1].replace(/[.,]/g, '');
  const amount = Number.parseInt(rawAmount, 10);

  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

module.exports = {
  parseMoneyText,
};
