/* =========================================================
   SETTINGS DATA — notification categories, appearance options,
   and session info. Swap for real API data later.
========================================================= */

export const fontOptions = ['System Fonts', 'Inter', 'Sora', 'Serif'];

export const zoomOptions = [90, 100, 110, 120, 130]; // percent

export const notificationCategories = [
  { key: 'default', label: 'Default', on: true },
  { key: 'jobRequest', label: 'Job Request', on: true },
  { key: 'jobPost', label: 'Job Post', on: true },
  { key: 'jobCircular', label: 'Job Circular', on: true },
  { key: 'generalNotice', label: 'General Notice', on: true },
  { key: 'targetAudience', label: 'Target Audience Notice', on: true },
  { key: 'jobApplicantList', label: 'Job Applicant List', on: true },
];

export const activeSessions = [
  { device: 'This device — Chrome on Windows', meta: 'Active now', current: true },
];
