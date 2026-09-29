/* ============================================================
   progress.js — Placement Progress page
============================================================ */

export function mount() {

  const resultUpdate = document.getElementById("round1ResultUpdate");

  if (!resultUpdate) return;

  const round1Completed =
    localStorage.getItem("stepupRound1Completed") === "true";

  if (round1Completed) {
    resultUpdate.style.display = "grid";
  } else {
    resultUpdate.style.display = "none";
  }
}