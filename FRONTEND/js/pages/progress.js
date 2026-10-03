/* ============================================================
   progress.js — Placement Progress page
============================================================ */

export function mount() {
  const applicationsListView = document.getElementById("applicationsListView");
  const companyDetailView = document.getElementById("companyDetailView");
  const backToAppsBtn = document.getElementById("backToAppsBtn");
  const detailCompanyName = document.getElementById("detailCompanyName");
  const round1Title = document.getElementById("round1Title");
  const resultUpdate = document.getElementById("round1ResultUpdate");

  const companyRows = document.querySelectorAll(".application-row");

  

  

  // Back button -> Hide details, show list, hide the header back button
  if (backToAppsBtn) {
    backToAppsBtn.addEventListener("click", () => {
      if (applicationsListView && companyDetailView) {
        companyDetailView.style.display = "none";
        applicationsListView.style.display = "block";
        backToAppsBtn.style.display = "none";
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }
}