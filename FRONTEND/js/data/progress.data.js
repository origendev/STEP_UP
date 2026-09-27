/* ============================================================
   progress.data.js — funnel, timeline and readiness figures
============================================================ */

export const funnel = [
  { num:18, label:"Applied",     pct:100 },
  { num:11, label:"Screened",    pct:61 },
  { num:6,  label:"Interviewed", pct:33 },
  { num:2,  label:"Offers",      pct:11 },
];

export const timeline = [
  { date:"Aug 20", title:"Profile registered on placement portal", desc:"Resume and academic records verified",     done:true },
  { date:"Sep 2",  title:"Applied to Zoho, TCS, Infosys",          desc:"3 applications submitted this week",       done:true },
  { date:"Sep 10", title:"Shortlisted by Zoho",                    desc:"Moved to technical interview round",       done:true },
  { date:"Sep 20", title:"TCS aptitude assessment",                desc:"Scheduled, prep material assigned",        done:false },
  { date:"Sep 27", title:"Zoho technical interview",               desc:"Round 1 — data structures & problem solving", done:false },
];

export const readiness = [
  { label:"Skills readiness",   value:"64%" },
  { label:"Resume & profile",   value:"80%" },
  { label:"Interview practice", value:"38%" },
];
