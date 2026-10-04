/* ============================================================
   round1.js — Round 1 Assessment
============================================================ */

const questions = [
  {
    question: "Which data structure follows the FIFO principle?",
    options: [
      "Stack",
      "Queue",
      "Tree",
      "Graph"
    ],
    answer: 1
  },
  {
    question: "What is the time complexity of binary search?",
    options: [
      "O(n)",
      "O(n²)",
      "O(log n)",
      "O(1)"
    ],
    answer: 2
  },
  {
    question: "Which keyword is used to inherit a class in Java?",
    options: [
      "implements",
      "extends",
      "inherits",
      "super"
    ],
    answer: 1
  },
  {
    question: "Which of the following is a relational database?",
    options: [
      "MongoDB",
      "Redis",
      "MySQL",
      "Firebase"
    ],
    answer: 2
  },
  {
    question: "Which HTTP method is commonly used to retrieve data?",
    options: [
      "POST",
      "PUT",
      "GET",
      "DELETE"
    ],
    answer: 2
  }
];

let currentQuestion = 0;
let selectedAnswers = [];

export function mount() {

  const questionElement = document.getElementById("round1Question");
  const optionsElement = document.getElementById("round1Options");
  const currentElement = document.getElementById("round1Current");
  const questionNumberElement =
    document.getElementById("round1QuestionNumber");

  const previousButton =
    document.getElementById("round1Previous");

  const nextButton =
    document.getElementById("round1Next");

  if (!questionElement || !optionsElement) return;

  function renderQuestion() {

    const question = questions[currentQuestion];

    currentElement.textContent = currentQuestion + 1;
    questionNumberElement.textContent = currentQuestion + 1;

    questionElement.textContent = question.question;

    optionsElement.innerHTML = "";

    question.options.forEach((option, index) => {

      const button = document.createElement("button");

      button.className = "round1-option";
      button.textContent = option;

      if (selectedAnswers[currentQuestion] === index) {
        button.classList.add("selected");
      }

      button.addEventListener("click", () => {

        selectedAnswers[currentQuestion] = index;

        renderQuestion();

      });

      optionsElement.appendChild(button);

    });

    previousButton.disabled = currentQuestion === 0;

    if (currentQuestion === questions.length - 1) {
      nextButton.innerHTML = "Finish <span>✓</span>";
    } else {
      nextButton.innerHTML = "Next <span>›</span>";
    }
  }

  previousButton.addEventListener("click", () => {

    if (currentQuestion > 0) {
      currentQuestion--;
      renderQuestion();
    }

  });

  nextButton.addEventListener("click", () => {

  if (currentQuestion < questions.length - 1) {

    currentQuestion++;
    renderQuestion();

  }

});


const submitButton =
  document.getElementById("round1Submit");

submitButton.addEventListener("click", () => {

  localStorage.setItem(
    "stepupRound1Completed",
    "true"
  );

  window.location.hash = "#skills";

});

  renderQuestion();
}