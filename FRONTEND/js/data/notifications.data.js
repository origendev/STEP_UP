/* ============================================================
   notifications.data.js — sample notification feed.
   Swap this for a real API call later; notifications.js doesn't care.
============================================================ */

export const notifications = [
  {
    id: 'n1',
    title: 'TCS aptitude round scheduled',
    meta: 'Your assessment is on 10 Sept, 10:00 AM',
    time: '2h ago',
    unread: true,
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  },
  {
    id: 'n2',
    title: 'Resume shortlisted — Zoho',
    meta: 'You have been moved to the next round',
    time: '5h ago',
    unread: true,
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
  },
  {
    id: 'n3',
    title: 'New job posted: Infosys',
    meta: 'Systems Engineer · apply before 28 Sept',
    time: '1d ago',
    unread: true,
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  },
  {
    id: 'n4',
    title: 'Profile verification pending',
    meta: 'Contact your placement team to get verified',
    time: '2d ago',
    unread: false,
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  },
  {
    id: 'n5',
    title: 'Placement drive reminder',
    meta: 'Barclays campus drive — 2 Sept, Main Auditorium',
    time: '3d ago',
    unread: false,
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  },
];