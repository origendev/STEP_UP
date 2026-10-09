/* ============================================================
   skills.data.js — free courses shown on the Skills page.

   TO ADD A COURSE: copy one object below, change the fields.
     title    course name
     company  who runs it (shown as a badge)
     url      the company's own course page (opens in a new tab)
     desc     one short line
     cert     what the student gets, free:
              'Certificate' | 'Digital badge' | 'Certification' | 'Statement of participation'
     depts    department tabs it appears in:  ['CSE','IT',...]  or  'ALL'
     years    which study years it suits:  1 basic, 2 intermediate,
              3 advanced, 4 placement prep   e.g. [1,2]
     general  true  -> also shown in the General tab, under `group`
     group    General tab section: 'communication' | 'aptitude' | 'digital'

   Only list courses that are free AND give a free certificate/badge.
   Re-check the links now and then — companies move their pages.
============================================================ */

export const DEPARTMENTS = [
  { key: 'CSE',        label: 'CSE' },
  { key: 'IT',         label: 'IT' },
  { key: 'ECE',        label: 'ECE' },
  { key: 'EEE',        label: 'EEE' },
  { key: 'Mechanical', label: 'Mechanical' },
  { key: 'Civil',      label: 'Civil' },
];

export const YEARS = [
  { key: 1, label: '1st year', level: 'Basic',        blurb: 'Basic courses to build the fundamentals of your domain.' },
  { key: 2, label: '2nd year', level: 'Intermediate', blurb: 'Intermediate courses to go deeper into your domain.' },
  { key: 3, label: '3rd year', level: 'Advanced',     blurb: 'Advanced courses to build job-ready depth.' },
  { key: 4, label: '4th year', level: 'Placements',   blurb: 'Courses and tests to get ready for placements and interviews.' },
];

export const GENERAL_GROUPS = [
  { key: 'communication', label: 'Communication & workplace skills' },
  { key: 'aptitude',      label: 'Aptitude & reasoning' },
  { key: 'digital',       label: 'AI & digital skills' },
];

/* Shown above a department's list when few free certificate courses exist for it. */
export const DEPT_NOTES = {
  Mechanical: 'Few big companies offer free certificate courses for core mechanical topics. These are the best free options right now; more will be added.',
  Civil:      'Few big companies offer free certificate courses for core civil topics. These are the best free options right now; more will be added.',
};

export const COURSES = [
  /* ================= Cisco Networking Academy ================= */
  {
    title: 'Python Essentials 1',
    company: 'Cisco',
    url: 'https://www.netacad.com/courses/programming/pcap-programming-essentials-python',
    desc: 'Start programming in Python with no prior experience.',
    cert: 'Certificate',
    depts: ['CSE', 'IT', 'ECE', 'EEE'],
    years: [1, 2],
  },
  {
    title: 'Introduction to Cybersecurity',
    company: 'Cisco',
    url: 'https://www.netacad.com/courses/cybersecurity/introduction-cybersecurity',
    desc: 'Threats, safe online habits and how security careers work.',
    cert: 'Certificate',
    depts: ['CSE', 'IT'],
    years: [1, 2],
    general: true, group: 'digital',
  },
  {
    title: 'Introduction to IoT',
    company: 'Cisco',
    url: 'https://www.netacad.com/courses/iot/introduction-iot',
    desc: 'How connected devices, sensors and data come together.',
    cert: 'Certificate',
    depts: ['IT', 'ECE', 'EEE', 'Mechanical'],
    years: [1, 2],
  },
  {
    title: 'Networking Essentials',
    company: 'Cisco',
    url: 'https://www.netacad.com/courses/networking/networking-essentials',
    desc: 'Core networking concepts, from IP addresses to a small office network.',
    cert: 'Certificate',
    depts: ['CSE', 'IT', 'ECE'],
    years: [2],
  },
  {
    title: 'CCNA: Introduction to Networks',
    company: 'Cisco',
    url: 'https://www.netacad.com/courses/networking/ccna-introduction-networks',
    desc: 'Associate-level networking: routing, switching and addressing. First of the three CCNA courses.',
    cert: 'Certificate',
    depts: ['CSE', 'IT', 'ECE'],
    years: [3],
  },

  /* ================= MathWorks (MATLAB / Simulink) ================= */
  {
    title: 'MATLAB Onramp',
    company: 'MathWorks',
    url: 'https://matlabacademy.mathworks.com/details/matlab-onramp/gettingstarted',
    desc: 'Learn the MATLAB basics used across engineering branches.',
    cert: 'Certificate',
    depts: ['ECE', 'EEE', 'Mechanical', 'Civil'],
    years: [1],
  },
  {
    title: 'Simulink Onramp',
    company: 'MathWorks',
    url: 'https://matlabacademy.mathworks.com/details/simulink-onramp/simulink',
    desc: 'Model and simulate systems — useful for circuits, control and mechanics.',
    cert: 'Certificate',
    depts: ['ECE', 'EEE', 'Mechanical'],
    years: [2, 3],
  },

  /* ================= Reputed institutions ================= */
  {
    title: 'CS50x — Introduction to Computer Science',
    company: 'Harvard',
    url: 'https://cs50.harvard.edu/x/',
    desc: 'Harvard\'s famous intro course. Free certificate if you score at least 70% on every problem set and the final project.',
    cert: 'Certificate',
    depts: ['CSE', 'IT'],
    years: [1, 2],
  },
  {
    title: 'Elements of AI',
    company: 'Univ. of Helsinki',
    url: 'https://www.elementsofai.com/',
    desc: 'A friendly, no-maths introduction to what AI is and how it works. Open to every branch.',
    cert: 'Certificate',
    depts: 'ALL',
    years: [1, 2],
    general: true, group: 'digital',
  },
  {
    title: 'OpenLearn — Engineering & technology courses',
    company: 'Open University',
    url: 'https://www.open.edu/openlearn/',
    desc: 'Nearly 1,000 free courses. Browse the science, maths and technology subjects for your branch.',
    cert: 'Statement of participation',
    depts: 'ALL',
    years: [1, 2, 3],
  },

  /* ================= Coding practice & certification ================= */
  {
    title: 'freeCodeCamp — Free developer certifications',
    company: 'freeCodeCamp',
    url: 'https://www.freecodecamp.org/learn',
    desc: 'Build projects and earn free certifications in web design, JavaScript, Python and more.',
    cert: 'Certification',
    depts: ['CSE', 'IT'],
    years: [1, 2, 3],
  },
  {
    title: 'HackerRank — Skills certification tests',
    company: 'HackerRank',
    url: 'https://www.hackerrank.com/skills-verification',
    desc: 'Free timed tests in Problem Solving, Python, Java, SQL and more. Basic level suits 2nd year; Intermediate and Advanced suit 3rd and 4th year.',
    cert: 'Certification',
    depts: ['CSE', 'IT', 'ECE', 'EEE'],
    years: [2, 3, 4],
  },

  /* ================= Cloud & enterprise ================= */
  {
    title: 'Microsoft Azure Fundamentals — learning path',
    company: 'Microsoft',
    url: 'https://learn.microsoft.com/en-us/training/paths/azure-fundamentals-describe-cloud-concepts/',
    desc: 'Cloud concepts on Microsoft Azure. The learning path is free and earns a badge.',
    cert: 'Digital badge',
    depts: ['CSE', 'IT'],
    years: [3, 4],
  },
  {
    title: 'IBM SkillsBuild — Student learning catalog',
    company: 'IBM',
    url: 'https://skillsbuild.org/learning-catalog/university-catalog',
    desc: 'Free courses in AI, cybersecurity, data analytics and cloud. Earn IBM digital credentials.',
    cert: 'Digital badge',
    depts: ['CSE', 'IT'],
    years: [2, 3],
    general: true, group: 'digital',
  },

  /* ================= Placement readiness (4th year) ================= */
  {
    title: 'IBM SkillsBuild — Professional skills',
    company: 'IBM',
    url: 'https://skillsbuild.org/learning-catalog/university-catalog',
    desc: 'Workplace-readiness skills for the job hunt. Open the catalog and choose Professional skills.',
    cert: 'Digital badge',
    depts: 'ALL',
    years: [4],
    general: true, group: 'communication',
  },
  {
    title: 'Infosys Springboard — Soft skills & communication',
    company: 'Infosys',
    url: 'https://infyspringboard.onwingspan.com/web/en/login',
    desc: 'Free courses on communication, behavioural and life skills. Sign in with any email.',
    cert: 'Certificate',
    depts: 'ALL',
    years: [1, 2, 3, 4],
    general: true, group: 'communication',
  },
  {
    title: 'Infosys Springboard — Aptitude & reasoning',
    company: 'Infosys',
    url: 'https://infyspringboard.onwingspan.com/web/en/login',
    desc: 'After signing in, search the catalog for aptitude and reasoning courses.',
    cert: 'Certificate',
    depts: 'ALL',
    years: [1, 2, 3, 4],
    general: true, group: 'aptitude',
  },

  /* ================= Google ================= */
  {
    title: 'Google Skillshop — Digital marketing & Analytics',
    company: 'Google',
    url: 'https://skillshop.withgoogle.com/',
    desc: 'Free Google Ads and Google Analytics training with official certifications.',
    cert: 'Certification',
    depts: [],
    years: [2, 3, 4],
    general: true, group: 'digital',
  },
];
