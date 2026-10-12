/* ============================================================
   jobs.data.js — job listings
   Keeping data separate from the UI means that when you switch to
   a real backend you only change this file (fetch instead of export).
============================================================ */

export const jobs = [
  {
    title:"Barclays", sub:"Technology Developer Summer Internship",
    salary:"—", stipend:"75K Per Month",
    applyBefore:"31 Aug 2026", applyBeforeVal:"2026-08-31",
    visit:"2 Sept 2026", visitTag:"Tentative",
    status:"Completed With H...", statusClass:"status-green",
    batch:"—", posted:"29 Aug 2026",
    type:"Summer Intern", cats:["eligible","applied"], prev:false
  },
  {
    title:"Natwest", sub:"Intern Trainee",
    salary:"—", stipend:"55K Per Month",
    applyBefore:"28 Aug 2026", applyBeforeVal:"2026-08-28",
    visit:"10 Sept 2026", visitTag:"Tentative",
    status:"In Progress", statusClass:"status-amber",
    batch:"—", posted:"7 Sept 2026",
    type:"Regular Intern", cats:["eligible","applied"], prev:false
  },
  {
    title:"BNY", sub:"Intern",
    salary:"—", stipend:"75K Per Month",
    applyBefore:"4 Jul 2026", applyBeforeVal:"2026-07-04",
    visit:"25 Jul 2026", visitTag:"Tentative",
    status:"In Progress", statusClass:"status-amber",
    batch:"—", posted:"3 Jul 2026",
    type:"Summer Intern", cats:["eligible","eligibleNotApplied"], prev:false
  },
  {
    title:"Deloitte", sub:"Business Analyst",
    salary:"₹6.5 LPA", stipend:"—",
    applyBefore:"15 Jun 2026", applyBeforeVal:"2026-06-15",
    visit:"20 Jun 2026", visitTag:"Confirmed",
    status:"Rejected", statusClass:"status-rose",
    batch:"2027", posted:"1 Jun 2026",
    type:"Full-time", cats:["rejected"], prev:true
  },
  {
    title:"Zoho", sub:"Software Development Engineer",
    salary:"₹9 LPA", stipend:"—",
    applyBefore:"12 May 2026", applyBeforeVal:"2026-05-12",
    visit:"18 May 2026", visitTag:"Confirmed",
    status:"Offer Released", statusClass:"status-green",
    batch:"2027", posted:"28 Apr 2026",
    type:"Full-time", cats:["offered","applied"], prev:true
  },
  {
    title:"TCS", sub:"Systems Engineer",
    salary:"₹3.6–7 LPA", stipend:"—",
    applyBefore:"9 Apr 2026", applyBeforeVal:"2026-04-09",
    visit:"15 Apr 2026", visitTag:"Confirmed",
    status:"Eligible", statusClass:"status-amber",
    batch:"2027", posted:"25 Mar 2026",
    type:"Full-time", cats:["eligible","eligibleNotApplied"], prev:true
  },
];
