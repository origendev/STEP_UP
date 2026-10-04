/* =========================================================
   NOTIFICATIONS — what the bell icon shows.
   type: job | reminder | learning     goto: route opened on click
   Replace with an API response later; notifications.js only
   needs { id, type, title, text, time, goto }.
========================================================= */
export const notifications = [
  { id: 'n1', type: 'job',      title: 'Resume shortlisted — Zoho', text: 'Your application moved to the next round.', time: '2 days ago', goto: 'progress' },
  { id: 'n2', type: 'reminder', title: 'TCS aptitude round',        text: 'Starts in 2 days. Review your prep material.', time: 'In 2 days', goto: 'progress' },
  { id: 'n3', type: 'job',      title: 'New jobs match your skills', text: 'Fresh openings were added today.', time: 'Today', goto: 'jobs' },
  { id: 'n4', type: 'learning', title: 'SQL course — 3 modules left', text: 'Finish the remaining modules this week.', time: 'Ongoing', goto: 'skills' },
];
