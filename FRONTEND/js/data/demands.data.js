/* ============================================================
   demands.data.js — role paths and practical market context
============================================================ */

const workforceReport = {
  label: 'World Economic Forum · Future of Jobs 2025',
  url: 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/'
};

export const demands = [
  {
    code: '01',
    name: 'AI, data & automation',
    signal: 'Recommendation systems, support assistants, and workflow automation are moving from experiments into everyday products and operations.',
    roles: ['Data analyst', 'Automation analyst', 'Machine-learning engineer', 'AI product operations'],
    india: 'Fintech, IT services, e-commerce, and SaaS teams use data and automation to improve customer journeys and internal tools.',
    international: 'Product, consulting, and operations teams need people who can evaluate AI output and connect models to real workflows.',
    skills: ['SQL', 'Python', 'Statistics', 'APIs', 'Model evaluation'],
    source: workforceReport
  },
  {
    code: '02',
    name: 'Cybersecurity & digital trust',
    signal: 'Digital payments, cloud services, and connected workplaces make identity, monitoring, and incident response core operating work.',
    roles: ['SOC analyst', 'Cloud security analyst', 'Application security tester', 'Governance, risk & compliance analyst'],
    india: 'Banks, IT service providers, SaaS firms, and public-facing digital services protect accounts, infrastructure, and sensitive data.',
    international: 'Financial services, healthcare, and cloud employers hire across security operations, application testing, and risk roles.',
    skills: ['Networking', 'Linux', 'Identity & access', 'SIEM tools', 'Incident reports'],
    source: workforceReport
  },
  {
    code: '03',
    name: 'Healthcare & health technology',
    signal: 'Digital records, remote care, diagnostics, and patient-monitoring systems create work at the intersection of care and software.',
    roles: ['Health informatics analyst', 'Clinical data analyst', 'Health-tech implementation specialist', 'Quality & privacy analyst'],
    india: 'Hospitals, diagnostic networks, insurers, and digital-health providers need reliable systems and usable patient services.',
    international: 'Health systems and medical-software companies integrate records, virtual care, and monitoring while protecting patient data.',
    skills: ['Excel or SQL', 'Data quality', 'Health workflows', 'Interoperability', 'Privacy'],
    source: workforceReport
  },
  {
    code: '04',
    name: 'Commerce, supply chain & logistics',
    signal: 'Online shopping and faster delivery depend on accurate demand forecasts, inventory visibility, and efficient routing.',
    roles: ['Supply-chain analyst', 'Demand planner', 'E-commerce operations analyst', 'Last-mile optimization analyst'],
    india: 'Retail, manufacturing, quick-commerce, and logistics operators coordinate stock, warehouses, and delivery networks.',
    international: 'Retailers, carriers, and fulfilment networks use analytics to reduce delays, stock-outs, and operating costs.',
    skills: ['Advanced Excel', 'SQL', 'Power BI', 'Forecasting', 'Inventory basics'],
    source: workforceReport
  },
  {
    code: '05',
    name: 'Clean energy & sustainability',
    signal: 'Power demand, renewable projects, and emissions reporting are creating technical and analytical work across energy-intensive sectors.',
    roles: ['Energy analyst', 'Renewable-project analyst', 'Carbon-accounting analyst', 'Building-efficiency analyst'],
    india: 'Solar and wind developers, utilities, manufacturers, and infrastructure firms plan projects and track energy use.',
    international: 'Utilities and large employers measure energy performance, deliver renewable projects, and report climate-related data.',
    skills: ['Energy data', 'Excel', 'Emissions accounting', 'GIS basics', 'Project analysis'],
    source: workforceReport
  }
];