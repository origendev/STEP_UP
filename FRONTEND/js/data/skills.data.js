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

/* Programming courses tabs. To add a course, add an object to PROG_COURSES
   (same fields as COURSES, plus  lang: 'Python' | 'Java' | 'C' | 'C++'). */
export const PROG_LANGS = [
  { key: 'Python', label: 'Python' },
  { key: 'Java',   label: 'Java' },
  { key: 'C',      label: 'C' },
  
];

export const PROG_COURSES = [
  {
    lang: 'Python',
    title: 'Python for Beginners',
    company: 'Simplilearn',
    url: 'https://www.simplilearn.com/learn-python-basics-free-course-skillup',
    desc: 'Beginner-friendly Python: core concepts, data structures, OOP, NumPy and Pandas. About 11 hours, self-paced.',
    cert: 'Certificate',
    years: [1, 2, 3, 4],
  },
    {
    lang: 'Python',
    title: 'Python Fundamentals for Beginners',
    company: 'Great Learning',
        url: 'https://www.mygreatlearning.com/academy/learn-for-free/courses/python-fundamentals-for-beginners',
    desc: 'Free beginner course on Python fundamentals with a certificate on completion.',
    cert: 'Certificate',
    years: [1, 2, 3, 4],
  },
  {
    lang: 'Python',
    title: 'Python Essentials 1',
    company: 'Cisco',
    url: 'https://www.netacad.com/learning-collections/python?courseLang=en-US',
    desc: 'Free introductory Python programming from Cisco Networking Academy and the OpenEDG Python Institute.',
    cert: 'Digital badge',
    years: [1, 2, 3, 4],
  },
  {
    lang: 'Python',
    title: 'Python for Beginners: Mastering the Essentials',
    company: 'Scaler',
    url: 'https://www.scaler.com/topics/course/python-for-beginners/',
    desc: 'Syntax, control flow, data structures, functions and OOP. About 10 hours with 10 coding challenges.',
    cert: 'Certificate',
    years: [1, 2, 3, 4],
  },


    /* ---------- Java ---------- */
  {
    lang: 'Java',
    title: 'Introduction to Java',
    company: 'Sololearn',
    url: 'https://www.sololearn.com/en/learn/courses/java-introduction',
    desc: 'Beginner-friendly Java with short daily lessons and hands-on practice exercises.',
    cert: 'Certificate',
    years: [1, 2, 3, 4],
  },
  {
    lang: 'Java',
    title: 'Learn Java',
    company: 'Coddy Tech',
    url: 'https://coddy.tech/landing/java',
    desc: 'Interactive Java in your browser: syntax, OOP and projects, with 219 lessons and coding exercises.',
    cert: 'Certificate',
    years: [1, 2, 3, 4],
  },
  {
    lang: 'Java',
    title: 'Java Course: Mastering the Fundamentals',
    company: 'Scaler',
    url: 'https://www.scaler.com/topics/course/java-beginners/',
    desc: 'Java basics to OOP, with 95 lessons and 9 challenges. About 8 hours, self-paced.',
    cert: 'Certificate',
    years: [1, 2, 3, 4],
  },

  /* ---------- C ---------- */
  {
    lang: 'C',
    title: 'Learn C Programming',
    company: 'Coddy Tech',
    url: 'https://coddy.tech/landing/c',
    desc: 'Interactive C in your browser: basics, pointers and memory, with AI hints when you get stuck.',
    cert: 'Certificate',
    years: [1, 2, 3, 4],
  },
  {
    lang: 'C',
    title: 'Introduction to C',
    company: 'Sololearn',
    url: 'https://www.sololearn.com/en/learn/courses/c-introduction',
    desc: 'The foundations of C, with no prior coding experience needed.',
    cert: 'Certificate',
    years: [1, 2, 3, 4],
  },
  {
    lang: 'C',
    title: 'Learn C',
    company: 'CodeChef',
    url: 'https://www.codechef.com/learn/course/c',
    desc: 'Beginner-friendly C with real practice problems and hands-on coding.',
    cert: 'Certificate',
    years: [1, 2, 3, 4],
  },
  {
    lang: 'Java',
    title: 'Java Programming for Beginners',
    company: 'Simplilearn',
    url: 'https://www.simplilearn.com/free-java-beginners-course-skillup?term=java',
    desc: 'Learn core Java from scratch: basics, OOP concepts and writing your first programs.',
    cert: 'Certificate',
    years: [1, 2, 3, 4],
  },
  {
    lang: 'C',
    title: 'C Programming Basics',
    company: 'Simplilearn',
    url: 'https://www.simplilearn.com/free-c-course-skillup?term=c',
    desc: 'Learn the fundamentals of C: variables, control flow, functions, arrays and pointers.',
    cert: 'Certificate',
    years: [1, 2, 3, 4],
  },


      // ---------- Advanced Python ----------
    {
      lang: 'Python',
      level: 'Advanced',
      title: 'Advanced Python Course',
      company: 'Simplilearn',
      url: 'https://www.simplilearn.com/free-advanced-python-course-skillup',
      desc: 'Explore advanced Python programming concepts through Simplilearn SkillUp.',
      cert: 'Certificate',
      years: [3, 4],
    },
    {
      lang: 'Python',
      level: 'Advanced',
      title: 'Advanced Python Projects',
      company: 'Great Learning',
      url: 'https://www.mygreatlearning.com/academy/learn-for-free/courses/advanced-python-projects',
      desc: 'Practice advanced Python through project-based learning.',
      cert: 'Certificate',
      years: [3, 4],
    },
    {
      lang: 'Python',
      level: 'Advanced',
      title: 'Pandas Analytics',
      company: 'Coddy Tech',
      url: 'https://coddy.tech/landing/courses/pandas_analytics',
      desc: 'Learn data analytics using Pandas in Python.',
      cert: 'Certificate',
      years: [3, 4],
    },

    // ---------- Advanced C ----------
    {
      lang: 'C',
      level: 'Advanced',
      title: 'C Advanced (Professional)',
      company: 'C++ Institute',
      url: 'https://cppinstitute.org/c-advanced',
      desc: 'Develop advanced C programming skills with professional-level material.',
      cert: 'Certificate',
      years: [3, 4],
    },
    {
      lang: 'C',
      level: 'Advanced',
      title: 'C Advanced',
      company: 'Cisco',
      url: 'https://www.netacad.com/courses/c-advanced?courseLang=en-US',
      desc: 'Build on C programming fundamentals with advanced concepts.',
      cert: 'Certificate',
      years: [3, 4],
    },
    {
      lang: 'C',
      level: 'Advanced',
      title: 'C Programming: Beginner to Advanced',
      company: 'Coodeverse',
      url: 'https://coodeverse.com/courses/c-course',
      desc: 'Progress from C programming fundamentals to more advanced topics.',
      cert: 'Certificate',
      years: [3, 4],
    },

    // ---------- Advanced Java ----------
    {
      lang: 'Java',
      level: 'Advanced',
      title: 'Java Concurrency and Multithreading',
      company: 'ELCAI',
      url: 'https://kelcaigroup.com/course/java-concurrency-and-multithreading-edjc?utm_source=chatgpt.com',
      desc: 'Study concurrency and multithreading concepts in Java.',
      cert: 'Certificate',
      years: [3, 4],
    },
    {
      lang: 'Java',
      level: 'Advanced',
      title: 'Introduction to Java Spring Framework',
      company: 'Simplilearn',
      url: 'https://www.simplilearn.com/introduction-to-java-spring-framework-fundamentals-skillup?tag=java%20advanced',
      desc: 'Explore the Spring Framework and its role in Java development.',
      cert: 'Certificate',
      years: [3, 4],
    },
    {
      lang: 'Java',
      level: 'Advanced',
      title: 'Advanced Java',
      company: 'DataFlair',
      url: 'https://data-flair.training/courses/free-advanced-java-course-hindi/',
      desc: 'Explore advanced Java topics through DataFlair’s course.',
      cert: 'Certificate',
      years: [3, 4],
    },

        // ---------- Intermediate Python ----------
    {
      lang: 'Python',
      level: 'Intermediate',
      title: 'Intermediate Python',
      company: 'DataCamp',
      url: 'https://www.datacamp.com/courses/intermediate-python',
      desc: 'Build on Python fundamentals with more advanced language features and practical exercises.',
      cert: 'Certificate',
      years: [2,3,4],
    },
    {
      lang: 'Python',
      level: 'Intermediate',
      title: 'Python Intermediate',
      company: 'Sololearn',
      url: 'https://www.sololearn.com/en/learn/courses/python-intermediate',
      desc: 'Strengthen your Python skills through interactive lessons and coding practice.',
      cert: 'Certificate',
      years: [2,3,4],
    },
    {
      lang: 'Python',
      level: 'Intermediate',
      title: 'Python Essentials 2',
      company: 'Cisco',
      url: 'https://www.netacad.com/articles/news/s-advance-your-python-skills-with-python-essentials-2?courseLang=en-US',
      desc: 'Continue learning Python programming through Cisco Networking Academy.',
      cert: 'Digital badge',
      years: [2,3,4],
    },

    // ---------- Intermediate Java ----------
    {
      lang: 'Java',
      level: 'Intermediate',
      title: 'Intermediate Java',
      company: 'DataCamp',
      url: 'https://www.datacamp.com/courses/intermediate-java',
      desc: 'Develop your Java programming knowledge beyond the fundamentals.',
      cert: 'Certificate',
      years: [2,3,4],
    },
    {
      lang: 'Java',
      level: 'Intermediate',
      title: 'Object-Oriented Programming in Java',
      company: 'Simplilearn',
      url: 'https://www.simplilearn.com/free-java-object-oriented-programming-course-skillup?term=java%20in',
      desc: 'Learn object-oriented programming concepts and how to apply them in Java.',
      cert: 'Certificate',
      years: [2,3,4],
    },
    {
      lang: 'Java',
      level: 'Intermediate',
      title: 'DSA Fundamentals in Java',
      company: 'Scaler',
      url: 'https://www.scaler.com/topics/course/dsa-beginners-java/',
      desc: 'Build your understanding of data structures and algorithms using Java.',
      cert: 'Certificate',
      years: [2,3,4],
    },

    // ---------- Intermediate C ----------
    {
      lang: 'C',
      level: 'Intermediate',
      title: 'Fundamentals of Data Structures in C',
      company: 'Simplilearn',
      url: 'https://www.simplilearn.com/fundamentals-of-data-structures-in-c-skillup?tag=c',
      desc: 'Learn how data structures work and how to implement them using C.',
      cert: 'Certificate',
      years: [2,3,4],
    },
    {
      lang: 'C',
      level: 'Intermediate',
      title: 'C Intermediate',
      company: 'Sololearn',
      url: 'https://www.sololearn.com/en/learn/courses/c-intermediate',
      desc: 'Strengthen your C programming skills through interactive lessons.',
      cert: 'Certificate',
      years: [2,3,4],
    },
    {
      lang: 'C',
      level: 'Intermediate',
      title: 'Data Structures in C',
      company: 'Great Learning',
      url: 'https://www.mygreatlearning.com/academy/learn-for-free/courses/data-structures-in-c',
      desc: 'Explore common data structures and their implementation in C.',
      cert: 'Certificate',
      years: [2,3,4],
    },
  
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
