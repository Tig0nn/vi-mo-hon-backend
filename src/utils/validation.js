const formatZodErrors = (error) =>
  error.issues.reduce((acc, issue) => {
    const key = issue.path.join('.') || 'request';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(issue.message);
    return acc;
  }, {});

module.exports = {
  formatZodErrors,
};
