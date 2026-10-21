/* ============================================================
   round2.js — Round 2 Coding Assessment (IDE)
============================================================ */

const STARTERS = {
  python: `# Python Hello World
print("Hello, World!")

# Get user input
name = input("Enter your name: ")
print(f"Hello, {name}!")
`,
  javascript: `// JavaScript Hello World
console.log("Hello, World!");
`,
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
`
};

const FILES = { python: "main.py", javascript: "main.js", java: "Main.java" };

let pyodide = null; // Python engine, loaded the first time you click Run

async function loadPython(output) {
  if (pyodide) return pyodide;

  output.textContent = "Loading Python (first time only)...";

  if (!window.loadPyodide) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Could not load Python engine. Check your internet."));
      document.head.appendChild(s);
    });
  }

  pyodide = await window.loadPyodide();
  return pyodide;
}

export function mount() {

  const editor      = document.getElementById("round2Editor");
  const lineNumbers = document.getElementById("round2LineNumbers");
  const explorer    = document.getElementById("round2Explorer");
  const explorerBtn = document.getElementById("round2ToggleExplorer");
  const terminalBtn = document.getElementById("round2TerminalBtn");
  const linesBtn    = document.getElementById("round2LinesBtn");
  const terminal    = document.getElementById("round2Terminal");
  const output      = document.getElementById("round2Output");
  const runBtn      = document.getElementById("round2Run");
  const langSelect  = document.getElementById("round2Language");
  const fileLabel   = document.querySelector(".r2-file");
  const submitBtn   = document.getElementById("round2Submit");

  if (!editor || !lineNumbers) return;

  /* ---------- line numbers ---------- */
  function updateLineNumbers() {
    const count = editor.value.split("\n").length;
    let html = "";
    for (let i = 1; i <= count; i++) html += i + "<br>";
    lineNumbers.innerHTML = html;
  }

  editor.addEventListener("input", updateLineNumbers);
  editor.addEventListener("scroll", () => {
    lineNumbers.scrollTop = editor.scrollTop;
  });

  /* Tab key types 4 spaces */
  editor.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.slice(0, start) + "    " + editor.value.slice(end);
      editor.selectionStart = editor.selectionEnd = start + 4;
      updateLineNumbers();
    }
  });

  /* ---------- panel buttons ---------- */
  explorerBtn.addEventListener("click", () => explorer.classList.toggle("collapsed"));
  terminalBtn.addEventListener("click", () => { terminal.hidden = !terminal.hidden; });
  linesBtn.addEventListener("click", () => {
    lineNumbers.style.display = lineNumbers.style.display === "none" ? "" : "none";
  });

  /* ---------- language switch ---------- */
  langSelect.addEventListener("change", () => {
    const lang = langSelect.value;
    editor.value = STARTERS[lang];
    fileLabel.textContent = "📄 " + FILES[lang];
    updateLineNumbers();
  });

  /* ---------- run code ---------- */
  async function runPython(code) {
    const py = await loadPython(output);
    let text = "";

    py.setStdout({ batched: (line) => { text += line + "\n"; } });
    py.setStderr({ batched: (line) => { text += line + "\n"; } });
    py.setStdin({ stdin: () => window.prompt("Program input:") });

    try {
      await py.runPythonAsync(code);
    } catch (err) {
      text += String(err.message || err);
    }
    return text || "(no output)";
  }

  function runJavaScript(code) {
    let text = "";
    const log = (...args) => { text += args.join(" ") + "\n"; };
    const fakeConsole = { log, error: log, warn: log, info: log };

    try {
      new Function("console", code)(fakeConsole);
    } catch (err) {
      text += "Error: " + err.message;
    }
    return text || "(no output)";
  }

  runBtn.addEventListener("click", async () => {
    const code = editor.value;
    const lang = langSelect.value;

    terminal.hidden = false;
    runBtn.disabled = true;
    output.textContent = "Running...";

    try {
      if (lang === "python") {
        output.textContent = await runPython(code);
      } else if (lang === "javascript") {
        output.textContent = runJavaScript(code);
      } else {
        output.textContent =
          "Java needs a server to compile it, so it can't run in the browser yet.\n" +
          "Choose Python or JavaScript for now.";
      }
    } catch (err) {
      output.textContent = "Error: " + err.message;
    }

    runBtn.disabled = false;
  });

  /* ---------- submit ---------- */
  submitBtn.addEventListener("click", () => {
    localStorage.setItem("stepupRound2Completed", "true");
    window.location.hash = "#/skills";
  });

  updateLineNumbers();
}