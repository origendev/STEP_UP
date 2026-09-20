/* =========================================================
   PROFILE DATA — student profile content.
   Swap for a real API/DB response later; profile.js doesn't care.
========================================================= */

export const profileMeta = {
  name: 'Vaishavi R',
  initial: 'V',
  role: 'B.Tech, Computer Science · Batch 2027',
  regNo: '21CS1042',
  cgpa: '8.4',
  completeness: 78,
};

export const personalFields = [
  { key: 'fullName', label: 'Full Name', value: 'Vaishavi R' },
  { key: 'dob', label: 'Date of Birth', value: '14 Mar 2004' },
  { key: 'email', label: 'Email', value: 'vaishavi.r@college.edu' },
  { key: 'phone', label: 'Phone Number', value: '+91 98765 43210' },
  { key: 'gender', label: 'Gender', value: 'Female' },
  { key: 'category', label: 'Category', value: 'General' },
  { key: 'address', label: 'Address', value: '12, Lake View Road, Hosur, Tamil Nadu', full: true },
];

export const academicFields = [
  { key: 'tenth', label: '10th Percentage', value: '91.2%' },
  { key: 'twelfth', label: '12th Percentage', value: '88.6%' },
  { key: 'cgpa', label: 'UG CGPA', value: '8.4' },
  { key: 'backlogsCurrent', label: 'Current Backlogs', value: '0' },
  { key: 'backlogsHistory', label: 'History of Backlogs', value: '1 (cleared)' },
  { key: 'dept', label: 'Department', value: 'Computer Science' },
];

export const socialLinks = [
  { key: 'linkedin', label: 'LinkedIn', value: 'linkedin.com/in/vaishavi-r',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.66 4.78 6.12V21h-4v-5.6c0-1.34-.02-3.06-1.87-3.06-1.87 0-2.16 1.46-2.16 2.96V21H9z"/></svg>' },
  { key: 'github', label: 'GitHub', value: 'github.com/vaishavi-r',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.5c.5.1.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.15-1.11-1.46-1.11-1.46-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.1-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.1.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.6 9.6 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.69 0 3.84-2.33 4.68-4.56 4.93.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2z"/></svg>' },
  { key: 'portfolio', label: 'Portfolio', value: 'vaishavi-portfolio.dev',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>' },
];

export const documents = [
  { key: 'resume', name: 'Resume', meta: 'Updated 12 Sept 2026 · PDF, 240 KB', status: 'uploaded',
    icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' },
  { key: 'tenthMarksheet', name: '10th Marksheet', meta: 'Uploaded 2 Sept 2026', status: 'uploaded',
    icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>' },
  { key: 'eleventhMarksheet', name: '11th Marksheet', meta: 'Not uploaded yet', status: 'missing',
    icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>' },
  { key: 'twelfthMarksheet', name: '12th Marksheet', meta: 'Uploaded 2 Sept 2026', status: 'uploaded',
    icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>' },
  { key: 'govId', name: 'Government ID (Aadhar/PAN)', meta: 'Not uploaded yet', status: 'missing',
    icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 9h16"/></svg>' },
  { key: 'provisionalDegree', name: 'Provisional Degree Certificate', meta: 'Not uploaded yet · optional until final year', status: 'missing',
    icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' },
];

