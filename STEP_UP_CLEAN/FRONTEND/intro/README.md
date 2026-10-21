# StepUp intro animation

Plays on `portal-access.html` before the portal cards appear.

- `intro.css`, `intro.js`, `logo.jpg`, `robot.jpg` are the whole animation.
- `portal-access.html` has one `<link>` + a small snippet in `<head>`, and one `<script>` before `</body>`.
- It plays on a fresh visit and is skipped when the visitor comes back from a login page.
  Add `?intro` to the URL to force it, or `?nointro` to skip it.
- Click, tap, Esc or Enter skips it. Listen for the `stepup:intro-done` event if you need a hook.
- To change timing, edit `ZOOM_AT` in `intro.js` (the zoom start) and the delays in `intro.css`.
