/* ============================================================
   profile.data.js — document list shown on the Profile page
   icon: key into the ICONS map in js/pages/profile.js
============================================================ */

export const documents = [
  { icon:"book",  name:"Resume",                        meta:"Updated 12 Sept 2026 · PDF, 240 KB", action:"View / Replace", uploaded:true },
  { icon:"sheet", name:"10th Marksheet",                meta:"Uploaded 2 Sept 2026",               action:"View / Replace", uploaded:true },
  { icon:"sheet", name:"12th Marksheet",                meta:"Uploaded 2 Sept 2026",               action:"View / Replace", uploaded:true },
  { icon:"card",  name:"Government ID (Aadhar/PAN)",    meta:"Not uploaded yet",                   action:"Upload",         uploaded:false },
  { icon:"check", name:"Provisional Degree Certificate",meta:"Not required until final year",      action:"Upload",         uploaded:false, disabled:true },
];
