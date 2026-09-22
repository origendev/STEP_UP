/* ============================================================
   progress.js — Progress page
   Renders the funnel, the journey timeline and the readiness rows.
============================================================ */

import { $, esc, renderList } from '../core/dom.js';
import { funnel, timeline, readiness } from '../data/progress.data.js';

function funnelStep(s){
  return `
    <div class="funnel-step">
      <div class="num">${s.num}</div>
      <div class="lbl">${esc(s.label)}</div>
      <div class="funnel-bar"><div style="width:${s.pct}%"></div></div>
    </div>`;
}

function timelineItem(t){
  return `
    <div class="tl-item">
      <div class="tl-dot${t.done ? ' done' : ''}"></div>
      <div class="tl-date">${esc(t.date)}</div>
      <div class="tl-title">${esc(t.title)}</div>
      <div class="tl-desc">${esc(t.desc)}</div>
    </div>`;
}

function readinessRow(r){
  return `
    <div class="row-item">
      <div class="readiness-label">${esc(r.label)}</div>
      <div class="readiness-value">${esc(r.value)}</div>
    </div>`;
}

function statusCard(label, value, percentage){
  return `
    <div class="progress-status-card">
      <div class="status-value">${esc(value)}</div>
      <div class="status-label">${esc(label)}</div>
      <div class="status-progress">
        <div class="status-progress-fill" style="width:${percentage}%"></div>
      </div>
    </div>
  `;
}

export function mount(){
  renderList($('#funnel'), funnel, funnelStep);
  renderList($('#timeline'), timeline, timelineItem);
  renderList($('#readinessList'), readiness, readinessRow);

  $('#progressStatus').innerHTML = [
  statusCard('Applied', 12, 100),
  statusCard('In Progress', 4, 33),
  statusCard('Offers', 2, 17),
  statusCard('Rejected', 6, 50)
].join('');

  $('#learningProgress').innerHTML = `
  <!-- Courses Completed -->
  <div class="learning-card">
    <div class="learning-card-header">
      <div class="learning-card-title">
        <span class="learning-icon">▣</span>
        Courses Completed
      </div>
      <span class="learning-view-all">View all</span>
    </div>

    <div class="learning-count">3</div>
    <div class="learning-subcount">of 6 planned</div>

    <div class="learning-list">
      <div class="learning-list-item">
        <span>Python for Beginners</span>
        <span class="learning-check">✓</span>
      </div>

      <div class="learning-list-item">
        <span>SQL Fundamentals</span>
        <span class="learning-check">✓</span>
      </div>

      <div class="learning-list-item">
        <span>Web Development with FastAPI</span>
        <span class="learning-check">✓</span>
      </div>
    </div>
  </div>

  <!-- Certifications Earned -->
  <div class="learning-card">
    <div class="learning-card-header">
      <div class="learning-card-title">
        <span class="learning-icon">♙</span>
        Certifications Earned
      </div>
      <span class="learning-view-all">View all</span>
    </div>

    <div class="learning-count">2</div>
    <div class="learning-subcount">certificates</div>

    <div class="learning-list">
      <div class="learning-list-item certification-item">
        <span class="cert-icon">🐍</span>
        <span class="cert-details">
          <strong>Python Programming</strong>
          <small>Coursera</small>
        </span>
      </div>

      <div class="learning-list-item certification-item">
        <span class="cert-icon">SQL</span>
        <span class="cert-details">
          <strong>SQL (Basic)</strong>
          <small>HackerRank</small>
        </span>
      </div>
    </div>
  </div>

  <!-- Projects -->
  <div class="learning-card">
    <div class="learning-card-header">
      <div class="learning-card-title">
        <span class="learning-icon">□</span>
        Projects
      </div>
      <span class="learning-view-all">View all</span>
    </div>

    <div class="project-counts">
      <div>
        <strong>1</strong>
        <span>completed</span>
      </div>

      <div>
        <strong>1</strong>
        <span>in progress</span>
      </div>
    </div>

    <div class="learning-list">
      <div class="learning-list-item project-item">
        <span class="project-icon completed-icon">▤</span>
        <span class="project-details">
          <strong>AI Document Assistant</strong>
          <small class="completed-text">Completed</small>
        </span>
        <span class="learning-check">✓</span>
      </div>

      <div class="learning-list-item project-item">
        <span class="project-icon progress-icon">♟</span>
        <span class="project-details">
          <strong>DSA Visualizer</strong>
          <small class="progress-text">In Progress</small>
        </span>
      </div>
    </div>
  </div>


`;
$('#codingActivity').innerHTML = `
  <div class="insight-header">
    <div class="card-title">
      <span class="ic">⌘</span>
      Coding Activity
    </div>
    <span class="insight-view-all">View details</span>
  </div>

  <div class="coding-stats">
    <div class="coding-stat">
      <strong>247</strong>
      <span>Total Commits</span>
    </div>

    <div class="coding-stat">
      <strong>18</strong>
      <span>This Week</span>
    </div>

    <div class="coding-stat">
      <strong>🔥 6</strong>
      <span>Streak Days</span>
    </div>
  </div>

  <div class="coding-today">
  <span>✓</span>
  <strong>2 Codes Done Today</strong>
</div>

  <div class="coding-tip">
    <span class="tip-icon">♧</span>
    <div>
      <strong>Keep coding!</strong>
      <span>Your consistency is building a strong profile.</span>
    </div>
  </div>
`;

$('#githubStreak').innerHTML = `
  <div class="insight-header">
    <div class="card-title">
      <span class="ic">◉</span>
      GitHub Contribution Streak
    </div>
    <span class="insight-view-all">View on GitHub</span>
  </div>

  <div class="github-streak-top">
    <div class="github-current">
      <div>
        <span class="fire-icon">🔥</span>
        <strong>6 days</strong>
      </div>
      <span>current streak</span>
    </div>

    <div class="github-longest">
      <span>Longest streak</span>
      <strong>12 days</strong>
    </div>
  </div>

  <div class="contribution-grid">
    ${Array.from({ length: 84 }, (_, i) => {
      const active =
        i % 5 === 0 ||
        i % 7 === 0 ||
        i % 11 === 0 ||
        i % 17 === 0;

      return `<span class="contribution-cell ${active ? 'active' : ''}"></span>`;
    }).join('')}
  </div>

  <div class="contribution-months">
    <span>Aug</span>
    <span>Sep</span>
    <span>Oct</span>
  </div>

  <div class="contribution-legend">
    <span>Less</span>
    <span class="legend-cell"></span>
    <span class="legend-cell active"></span>
    <span class="legend-cell active"></span>
    <span class="legend-cell active"></span>
    <span>More</span>
  </div>
`;

$('#goalsMilestones').innerHTML = `
  <div class="insight-header">
    <div class="card-title">
      <span class="ic">🎯</span>
      Goals & Milestones
    </div>
    <span class="insight-add">＋ Add Goal</span>
  </div>

  <div class="goal-tabs">
    <button class="goal-tab active">Goals</button>
    <button class="goal-tab">Milestones</button>
  </div>

  <div class="goal-list">

    <div class="goal-item">
      <div class="goal-ring"></div>
      <div class="goal-content">
        <strong>Complete LeetCode 75</strong>
        <span>Build problem solving skills</span>
      </div>
      <div class="goal-progress">
        <strong>11/75</strong>
        <span>›</span>
      </div>
    </div>

    <div class="goal-item">
      <div class="goal-ring"></div>
      <div class="goal-content">
        <strong>Build 3+ Real Projects</strong>
        <span>Strengthen portfolio</span>
      </div>
      <div class="goal-progress">
        <strong>1/3</strong>
        <span>›</span>
      </div>
    </div>

    <div class="goal-item">
      <div class="goal-ring"></div>
      <div class="goal-content">
        <strong>Get Placed (FTE)</strong>
        <span>Land your dream job</span>
      </div>
      <div class="goal-progress">
        <strong>0/1</strong>
        <span>›</span>
      </div>
    </div>

    

  </div>
`;
}
