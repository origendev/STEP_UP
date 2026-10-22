# StepUp intro animation

Plays on `portal-access.html` before the portal cards appear.

**Sequence (about 3.4 s):** the word "StepUp" is revealed left to right with a soft blue/purple glow
-> one flash -> the word zooms through the screen and the portal page opens behind it.

- `intro.css`, `intro.js`, `word.png` are the whole animation (`logo.jpg` and `robot.jpg` from the old
  intro are no longer used and can be deleted).
- `portal-access.html` is unchanged: it already has one `<link>` + a small snippet in `<head>` and one
  `<script>` before `</body>`.
- It plays on a fresh visit and is skipped when the visitor comes back from a login page.
  Add `?intro` to the URL to force it, or `?nointro` to skip it.
- Click, tap, Esc or Enter skips it. Listen for the `stepup:intro-done` event if you need a hook.
- Timing: `EXIT_AT` in `intro.js` (when the zoom-through starts) and the delays/durations in `intro.css`
  (reveal is `suReveal` / `suEdge`, flash is `suFlash`).
- Colours are the existing StepUp palette; nothing in the theme was changed.
