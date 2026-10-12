export const COURSE_OPTIONS = [
  { value: 'cse', label: 'Computer Science & Engineering (CSE)' },
  { value: 'it', label: 'Information Technology (IT)' },
  { value: 'ece', label: 'Electronics & Communication Engineering (ECE)' },
  { value: 'eee', label: 'Electrical & Electronics Engineering (EEE)' },
  { value: 'mechanical', label: 'Mechanical Engineering' },
  { value: 'civil', label: 'Civil Engineering' }
];

export const COURSE_BASELINES = {
  cse: ['AI/ML Engineer', 'Software Engineer', 'Data Engineer', 'Cloud/DevOps Engineer', 'Cybersecurity Engineer'],
  it: ['Software Engineer', 'Cloud Engineer', 'DevOps Engineer', 'Data Engineer', 'Cybersecurity Engineer'],
  ece: ['Embedded Systems Engineer', 'VLSI Design Engineer', 'Verification Engineer', 'IoT Engineer', 'RF/Telecom Engineer'],
  eee: ['Electrical Design Engineer', 'Power Systems Engineer', 'EV Engineer', 'Renewable Energy Engineer', 'Industrial Automation Engineer'],
  mechanical: ['Design Engineer', 'Manufacturing Engineer', 'Automation Engineer', 'Automotive Engineer', 'CAE Engineer'],
  civil: ['Structural Engineer', 'Construction Engineer', 'BIM Engineer', 'Infrastructure Engineer', 'Project Engineer']
};

export const BASELINE_SOURCE = {
  label: 'World Economic Forum · Future of Jobs 2025',
  url: 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/'
};

// Backward compatibility for any older cached page module that still imports `demands`.
export const demands = COURSE_BASELINES.cse.map((title, index) => ({
  code: String(index + 1).padStart(2, '0'),
  name: title,
  signal: 'Course-specific demand baseline.',
  roles: [title],
  india: 'Use the live India ranking for current market evidence.',
  international: 'Use the live Global ranking for current international evidence.',
  skills: [],
  source: BASELINE_SOURCE
}));
