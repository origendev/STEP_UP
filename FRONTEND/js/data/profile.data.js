/* =========================================================
   PROFILE DATA — starting values for the student profile.
   Edits made on the page are saved in localStorage ('stepup-profile').
   Swap this for a real API/DB response later; profile.js reads
   the same shape either way.
========================================================= */
const f = (k, label, value = '', full = false) => ({ k, label, value, full });

export const defaults = {
  photo: '',
  verification: 'unverified',           // unverified | requested | verified
  applied: 12,
  links: [],                            // [{ url }]

  sections: {
    overview: { title: 'Student overview', fields: [
      f('fullName', 'Full name', 'Vaishavi R'), f('regNo', 'Register number', '21CS1042'),
      f('dob', 'Date of birth', '14 Mar 2004'), f('gender', 'Gender', 'Female'),
      f('dept', 'Department', 'Computer Science'), f('degree', 'Degree', 'B.Tech'),
      f('batch', 'Batch', '2027'), f('category', 'Category', 'General'),
      f('status', 'Placement status', 'Interested for placement'),
    ]},
    contact: { title: 'Contact details', fields: [
      f('email', 'Email', 'vaishavi.r@college.edu'), f('phone', 'Phone number', '+91 98765 43210'),
      f('whatsapp', 'WhatsApp number'), f('altEmail', 'Alternative email'),
      f('altPhone', 'Alternative phone'), f('contactPref', 'Preferred contact method'),
    ]},
    address: { title: 'Address details', fields: [
      f('line', 'Address', '12, Lake View Road, Hosur', true),
      f('city', 'City', 'Hosur'), f('district', 'District'),
      f('state', 'State', 'Tamil Nadu'), f('country', 'Country', 'India'), f('pin', 'Pin code'),
    ]},
    parents: { title: 'Parent information', fields: [
      f('fName', "Father's name"), f('fPhone', "Father's contact"),
      f('fJob', "Father's occupation"), f('fEmail', "Father's email"),
      f('mName', "Mother's name"), f('mPhone', "Mother's contact"),
      f('mJob', "Mother's occupation"), f('mEmail', "Mother's email"),
    ]},
  },

  colleges: [
    { name: 'B.Tech, Computer Science', course: 'B.Tech', branch: 'Computer Science', years: '',
      score: '8.4 CGPA', backlogs: '0', history: '1 (cleared)', semesters: [] },
    { name: 'Class 12', course: 'Higher secondary', branch: '', years: '', score: '88.6%', backlogs: '', history: '', semesters: [] },
    { name: 'Class 10', course: 'Secondary', branch: '', years: '', score: '91.2%', backlogs: '', history: '', semesters: [] },
  ],

  resume: { objective: '', include: { education: true, skills: true, projects: true, experience: true, certifications: true, awards: true, languages: true, links: true } },
  resumeFile: null,                     // { name, size, date }  (file itself is kept in IndexedDB)

  skills: [],                           // [{ name, level }]
  view: 'grid',

  more: { experience: [], projects: [], certifications: [], patents: [], scholarships: [], volunteering: [] },   // items: { a, b, c, proof }
  socials: {},                          // { github: 'https://…' }
  languages: [],

  documents: [
    { name: '10th Marksheet', meta: 'Not uploaded yet', status: 'missing' },
    { name: '11th Marksheet', meta: 'Not uploaded yet', status: 'missing' },
    { name: '12th Marksheet', meta: 'Not uploaded yet', status: 'missing' },
    { name: 'Government ID (Aadhar/PAN)', meta: 'Not uploaded yet', status: 'missing' },
    { name: 'Provisional Degree Certificate', meta: 'Optional until final year', status: 'missing' },
  ],
};

export const moreSections = [
  { id: 'experience',     title: 'Work experience', add: 'Add experience',    ph: ['Role', 'Company', 'Period'] },
  { id: 'projects',       title: 'Projects',        add: 'Add project',       ph: ['Project name', 'Tech used or link', 'Year'] },
  { id: 'certifications', title: 'Certifications',  add: 'Add certification', ph: ['Certification', 'Issued by', 'Year'] },
  { id: 'patents',        title: 'Patents',         add: 'Add patent',        ph: ['Patent title', 'Office or number', 'Year'] },
  { id: 'scholarships',   title: 'Scholarships',    add: 'Add scholarship',   ph: ['Scholarship', 'Awarded by', 'Year'] },
  { id: 'volunteering',   title: 'Volunteering',    add: 'Add volunteering',  ph: ['Role', 'Organisation', 'Year'] },
];

export const platforms = ['GitHub', 'LeetCode', 'CodeChef', 'HackerRank', 'Codeforces', 'Kaggle', 'Stack Overflow',
  'GeeksforGeeks', 'LinkedIn', 'Portfolio website', 'YouTube', 'Behance', 'Medium', 'Other'];

export const languageList = ['English', 'Tamil', 'Hindi', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali',
  'Gujarati', 'Punjabi', 'Urdu', 'Odia', 'Sanskrit', 'Other'];

export const skillLevels = ['Beginner', 'Intermediate', 'Advanced'];
