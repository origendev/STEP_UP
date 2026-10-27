import { api, getToken } from '../core/api.js';

const STARTER_CODE = {
  python: `name = input("What is your name? ")\nprint(f"Hello, {name}!")\n`,
  cpp: `#include <iostream>\n#include <string>\n\nint main() {\n    std::string name;\n    std::getline(std::cin, name);\n    std::cout << "Hello, " << name << "!" << std::endl;\n    return 0;\n}\n`,
  java: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner input = new Scanner(System.in);\n        String name = input.nextLine();\n        System.out.println("Hello, " + name + "!");\n    }\n}\n`
};

const DRAFT_KEY = 'stepup-code-playground-drafts-v1';
const MAX_SOURCE_LENGTH = 16_000;

function readDrafts() {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
    return drafts && typeof drafts === 'object' && !Array.isArray(drafts) ? drafts : {};
  } catch {
    return {};
  }
}

function saveDraft(language, source) {
  const drafts = readDrafts();
  drafts[language] = source;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch {
    showNotice('Your browser could not save this draft. Copy your code somewhere safe before leaving.');
  }
}

function showNotice(message = '') {
  const notice = document.getElementById('cp-notice');
  if (!notice) return;
  notice.textContent = message;
  notice.hidden = !message;
}

function setLineNumbers() {
  const source = document.getElementById('cp-source');
  const numbers = document.getElementById('cp-line-numbers');
  if (!source || !numbers) return;
  const count = source.value.split('\n').length;
  numbers.textContent = Array.from({ length: count }, (_, index) => index + 1).join('\n');
  numbers.scrollTop = source.scrollTop;
}

function setLanguage(language) {
  const source = document.getElementById('cp-source');
  const drafts = readDrafts();
  source.value = typeof drafts[language] === 'string' ? drafts[language] : STARTER_CODE[language];
  saveDraft(language, source.value);
  setLineNumbers();
  document.getElementById('cp-run-status').textContent = `${language === 'cpp' ? 'C++' : language[0].toUpperCase() + language.slice(1)} selected.`;
  document.getElementById('cp-run-status').classList.remove('error');
}

function outputText(result) {
  const sections = [];
  if (result.compileOutput) sections.push(`Compile output:\n${result.compileOutput}`);
  if (result.output) sections.push(result.output);
  if (result.stoppedByLimit) sections.push('Execution was stopped by a runner limit, such as time or memory.');
  if (result.signal) sections.push(`Process stopped (${result.signal}).`);
  if (result.exitCode !== null && result.exitCode !== 0) sections.push(`Exited with code ${result.exitCode}.`);
  return sections.join('\n\n').trim() || 'Program finished with no output.';
}

export function mount() {
  const language = document.getElementById('cp-language');
  const source = document.getElementById('cp-source');
  const stdin = document.getElementById('cp-stdin');
  const runButton = document.getElementById('cp-run');
  const output = document.getElementById('cp-output');
  const status = document.getElementById('cp-run-status');
  if (!language || !source || !stdin || !runButton || !output || !status) return;

  if (!getToken()) {
    window.location.href = 'student-login.html';
    return;
  }

  setLanguage(language.value);
  source.addEventListener('input', () => {
    saveDraft(language.value, source.value);
    setLineNumbers();
  });
  source.addEventListener('scroll', setLineNumbers);
  source.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const start = source.selectionStart;
    const end = source.selectionEnd;
    source.setRangeText('    ', start, end, 'end');
    source.dispatchEvent(new Event('input', { bubbles: true }));
  });
  language.addEventListener('change', () => setLanguage(language.value));

  document.getElementById('cp-reset').addEventListener('click', () => {
    source.value = STARTER_CODE[language.value];
    saveDraft(language.value, source.value);
    setLineNumbers();
    status.textContent = 'Starter code restored.';
    status.classList.remove('error');
  });
  document.getElementById('cp-clear-output').addEventListener('click', () => {
    output.textContent = 'Your program output will appear here.';
    status.textContent = 'Console cleared.';
    status.classList.remove('error');
    showNotice();
  });
  runButton.addEventListener('click', async () => {
    showNotice();
    if (!source.value.trim()) {
      showNotice('Add some code before running it.');
      source.focus();
      return;
    }
    if (source.value.length > MAX_SOURCE_LENGTH) {
      showNotice('Keep your code under 16,000 characters for this practice runner.');
      return;
    }

    runButton.disabled = true;
    runButton.innerHTML = '<span aria-hidden="true">…</span> Running';
    status.textContent = 'Compiling and running in the isolated practice runner…';
    status.classList.remove('error');
    output.textContent = '';
    try {
      const result = await api('/student/code/run', {
        method: 'POST',
        body: JSON.stringify({ language: language.value, source: source.value, stdin: stdin.value })
      });
      output.textContent = outputText(result.data);
      status.textContent = result.data.exitCode === 0 && !result.data.compileOutput
        ? 'Finished successfully.'
        : 'Finished. Check the console for output or errors.';
      if (result.data.exitCode !== 0 || result.data.compileOutput) status.classList.add('error');
    } catch (error) {
      status.textContent = 'Could not run the program.';
      status.classList.add('error');
      showNotice(error.message || 'The isolated code runner could not complete this run.');
      output.textContent = 'No program output was returned.';
    } finally {
      runButton.disabled = false;
      runButton.innerHTML = '<span aria-hidden="true">▶</span> Run code';
    }
  });
}
