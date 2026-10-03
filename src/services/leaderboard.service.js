const leaderboardRepository = require('../repositories/leaderboard.repository');

const getDisciplineTitle = (points) => {
  if (points >= 300) return 'Bậc Thầy Kỷ Luật';
  if (points >= 150) return 'Khắc Tinh Cám Dỗ';
  if (points >= 50) return 'Chiến Binh Kỷ Luật';
  return 'Tập Sự Kiềm Chế';
};

const getStreakTitle = (days) => {
  if (days >= 30) return 'Huyền Thoại Kiên Trì';
  if (days >= 14) return 'Bất Khả Chiến Bại';
  if (days >= 7) return 'Chiến Binh 1 Tuần';
  if (days >= 3) return 'Chiến Binh Bền Bỉ';
  return 'Người Mới Nhập Môn';
};

const getLeaderboard = async ({ type = 'discipline', limit = 20, userId = null }) => {
  const allUsers = await leaderboardRepository.getLeaderboardRawData();

  const isDiscipline = type === 'discipline';

  // Sort descending
  const sorted = [...allUsers].sort((a, b) => {
    if (isDiscipline) {
      if (b.discipline !== a.discipline) return b.discipline - a.discipline;
      if (b.xp !== a.xp) return b.xp - a.xp;
      return a.userId.localeCompare(b.userId);
    } else {
      if (b.streak !== a.streak) return b.streak - a.streak;
      if (b.discipline !== a.discipline) return b.discipline - a.discipline;
      return a.userId.localeCompare(b.userId);
    }
  });

  // Assign ranks & badges
  const rankedList = sorted.map((user, index) => {
    const score = isDiscipline ? user.discipline : user.streak;
    const unit = isDiscipline ? 'Điểm' : 'Ngày';
    const title = isDiscipline ? getDisciplineTitle(user.discipline) : getStreakTitle(user.streak);
    const isCurrentUser = Boolean(userId && user.userId === userId);

    return {
      rank: index + 1,
      userId: user.userId,
      displayName: user.displayName,
      level: user.level,
      score,
      unit,
      title,
      discipline: user.discipline,
      streak: user.streak,
      isCurrentUser,
    };
  });

  const currentUserData = userId
    ? rankedList.find((item) => item.userId === userId) || null
    : null;

  return {
    type,
    title: isDiscipline ? 'Bảng Xếp Hạng Kỷ Luật' : 'Bảng Xếp Hạng Chuỗi Streak',
    description: isDiscipline
      ? 'Vinh danh các chiến binh có ý chí kiên định và khả năng kiềm chế bốc đồng cao nhất.'
      : 'Vinh danh các chiến binh duy trì chuỗi ngày rèn luyện tài chính liên tục.',
    leaderboard: rankedList.slice(0, limit),
    currentUser: currentUserData,
    totalParticipants: rankedList.length,
  };
};

module.exports = {
  getDisciplineTitle,
  getLeaderboard,
  getStreakTitle,
};
