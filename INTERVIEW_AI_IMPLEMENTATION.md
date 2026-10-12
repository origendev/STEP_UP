# STEP_UP structured interview rounds and AI progress roadmap

## Implemented in this update
- Company job form uses repeatable, ordered interview-round cards instead of a free-text list.
- Each round captures name, assessment type, mode, duration, optional qualifying score, topics/skills assessed, and instructions/evaluation criteria.
- Requirements are collected in structured fields: minimum CGPA, backlogs, eligible batch, experience, must-have and preferred skills, education/branch criteria, and other conditions.
- Requirements are persisted in a `jobs.requirements` JSONB column, created automatically on backend startup. Interview rounds remain JSON in the existing `interview_rounds` column, with basic legacy text compatibility while editing.
- Job form submission/edit sends the structured data through the existing company API; edit resubmission still requires admin approval.

## Recommended next implementation for AI-powered progress
1. **Role analysis API:** On approved jobs, parse the role description, must-have skills, preferred skills, and rounds. Ask the configured AI provider to return validated JSON: role competency map, skill-gap rubric, recommended preparation tasks, and a draft assessment plan for each round. Never treat AI output as the authoritative eligibility decision.
2. **Human review:** Give company admins a review screen to edit and approve AI-generated question sets/rubrics before use. Store generated assessments with a version tied to the job and round.
3. **Student progress page:** For each application, show the configured rounds in order, upcoming/current/completed state, schedule, instructions, preparation checklist, and result/status only when authorized. Do not show hidden answer keys or internal evaluation notes.
4. **Assessment engine:** Support timed MCQ/aptitude tests, coding challenges in a sandboxed runner, assignment uploads, interview scheduling, and structured interviewer scorecards. Different round types need different assessment components.
5. **Scoring and fairness:** Use explicit rubrics and human review for high-impact decisions. Show students feedback and skill gaps; keep AI recommendations explainable, avoid unsupported claims, and never automatically reject a student solely based on an AI score.
6. **Notifications and audit:** Notify students when a round is scheduled or status changes, and log company/admin changes with timestamps. Validate authorization server-side for every assessment and result endpoint.

## Important
This update captures and stores structured inputs. It does not yet generate AI tests or change the live progress page; those require the separate AI-analysis, assessment storage, and student progress workflow described above.
