//====================================================
// exam.js
// Version 1
//====================================================

const PASSING_SCORE = 80;
const QUESTIONS_PER_MODULE = 2;
const MAX_WRONG = 3;

let examQuestion = [];
let currentQuestion = 0;
let correctAnswers = 0;
let wrongAnswers = 0;
let missedQuestions = [];

//----------------------------------------------------
// Utility
//----------------------------------------------------

function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

//----------------------------------------------------
// Load Exam
//----------------------------------------------------
async function loadExam() {
    const response = await fetch("data/exam.json");
    const data = await response.json();
    examQuestion = [];
    data.modules.forEach(module => {
        const questions =
            shuffle(module.questions)
                .slice(0, QUESTIONS_PER_MODULE);
        questions.forEach(question => {
            examQuestion.push({
                module: module.module,
                title: module.title,
                question: question.question,
                choices: question.choices,
                answer: question.answer,
                explanation: question.explanation
            });
        });
    });
    examQuestion = shuffle(examQuestion).slice(0, 10);
    showQuestion();
}

//----------------------------------------------------
// Show Question
//----------------------------------------------------
function showQuestion() {
    const container =
        document.getElementById("examContainer");
    //------------------------------------------------
    if (wrongAnswers >= MAX_WRONG) {
        showFailEarly();
        return;
    }
    //------------------------------------------------
    if (currentQuestion >= examQuestion.length) {
        showFinalScore();
        return;
    }

    //------------------------------------------------
    const q = examQuestion[currentQuestion];
    container.innerHTML = "";
    //------------------------------------------------

    const title = document.createElement("h3");
    title.textContent =
        `Question ${currentQuestion + 1} of ${examQuestion.length}`;
    container.appendChild(title);
    //------------------------------------------------

    const progress = document.createElement("p");
    progress.className = "text-muted";
    progress.innerHTML =
        `Correct: <strong>${correctAnswers}</strong> &nbsp;&nbsp;
         Wrong: <strong>${wrongAnswers}</strong>`;
    container.appendChild(progress);
    //------------------------------------------------
    const question = document.createElement("p");
    question.className = "lead";
    question.textContent = q.question;
    container.appendChild(question);
    //------------------------------------------------

    q.choices.forEach((choice, index) => {
        const button =
            document.createElement("button");
        button.className =
            "btn btn-outline-primary d-block w-100 mb-2";
        button.textContent = choice;
        button.onclick = () => answerQuestion(index);
        container.appendChild(button);
    });
}

//----------------------------------------------------
// Answer Question
//----------------------------------------------------
function answerQuestion(choice) {
    const q = examQuestion[currentQuestion];
    if (choice === q.answer) {
        correctAnswers++;
    }
    else {
        wrongAnswers++;
        missedQuestions.push({
            question: q.question,
            correctAnswer: q.choices[q.answer],
            explanation: q.explanation
        });
    }

    currentQuestion++;
    showQuestion();
}
//----------------------------------------------------
// Results
//----------------------------------------------------
function showFinalScore() {
    const container =
        document.getElementById("examContainer");
    const score =
        Math.round(
            correctAnswers /
            examQuestion.length *
            100
        );
    const passed =
        score >= PASSING_SCORE;
//------------------------------------------------
// Show Print Certificate button
//------------------------------------------------
const certificateButton =
    document.getElementById("certificateButton");
if (certificateButton) {
    if (passed) {
        certificateButton.classList.remove("d-none");
        certificateButton.onclick = () => {
        window.location.href = "student.html";
    };
    }
    else {

        certificateButton.classList.add("d-none");
    }
}
    let html = `
        <div class="alert ${passed ? "alert-success" : "alert-danger"}">
            <h2>
                ${passed ? "Congratulations!" : "Exam Complete"}
            </h2>
            <p>
                Correct:
                ${correctAnswers}
                /
                ${examQuestion.length}
            </p>
            <p>
                Wrong:
                ${wrongAnswers}
            </p>
            <p>
                Score:
                ${score}%
            </p>
            <h4>
                ${passed ? "PASS" : "FAIL"}
            </h4>
        </div>
    `;
    //------------------------------------------------
    // Show missed questions ONLY if passed
    //------------------------------------------------
    if (passed && missedQuestions.length > 0) {
        html += `
            <h3 class="mt-5">
                Questions to Review
            </h3>
            <p>

                Congratulations on passing! Here are the questions you missed.
                Reviewing them will strengthen your understanding.
            </p>
        `;
        missedQuestions.forEach((item, index) => {
            html += `
                <div class="card shadow-sm mb-3">
                    <div class="card-body">
                        <h5>
                            ${index + 1}. ${item.question}
                        </h5>
                        <p>
                            <strong>Correct Answer:</strong>
                            ${item.correctAnswer}
                        </p>
                        <p>
                            ${item.explanation}
                        </p>
                    </div>
                </div>
            `;
        });
    }
    container.innerHTML = html;
}

//----------------------------------------------------
// Early Fail
//----------------------------------------------------
function showFailEarly() {
    const container =
        document.getElementById("examContainer");
    container.innerHTML = `
        <div class="alert alert-danger">
            <h2>
                Exam Ended
            </h2>
            <p>
                You have accumulated four incorrect answers.
            </p>
            <p>
                Since a maximum of three incorrect answers is allowed
                to achieve an 80% passing score, the quiz has ended.
            </p>
            <p>
                Correct:
                ${correctAnswers}
            </p>
            <p>
                Wrong:
                ${wrongAnswers}
            </p>
            <h4>
                FAIL
            </h4>
            <p class="mt-3">
                Please review the course modules and try again.
            </p>
        </div>
    `;
}
//----------------------------------------------------
loadExam();
