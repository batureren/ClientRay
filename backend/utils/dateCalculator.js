// utils/dateCalculator.js

/**
 * Calculates the next occurrence of a recurring task based on a pattern.
 * @param {Date|string} currentDate The starting date for the calculation.
 * @param {string} pattern The recurrence pattern (e.g., 'daily', 'weekly').
 * @param {number} [interval=1] The interval for the pattern (e.g., every 2 weeks).
 * @returns {Date|null} The calculated next occurrence date, or null if the pattern is invalid.
 */
const calculateNextOccurrence = (currentDate, pattern, interval = 1) => {
  const date = new Date(currentDate);
  const originalMonth = new Date(currentDate).getMonth();

  switch (pattern) {
    case 'daily':
      date.setDate(date.getDate() + interval);
      break;
    case 'weekdays':
      date.setDate(date.getDate() + 1);
      while (date.getDay() === 0 || date.getDay() === 6) {
        date.setDate(date.getDate() + 1);
      }
      break;
    case 'weekly':
      date.setDate(date.getDate() + (7 * interval));
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + interval);
      if (date.getMonth() !== (originalMonth + interval) % 12) {
        date.setDate(0);
      }
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + (3 * interval));
      if (date.getMonth() !== (originalMonth + (3 * interval)) % 12) {
        date.setDate(0);
      }
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + interval);
      break;
    default:
      return null;
  }
  
  return date;
};

module.exports = { calculateNextOccurrence };