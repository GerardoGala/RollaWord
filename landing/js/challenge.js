// Scenario Descriptions: No hints in the labels or wind names!
const challengeTimeline = [
    {
        title: "Weather Assessment: Coastal Flags",
        text: "You stand on dry sand looking out over the water. Regatta flags fluttering on the dunes are blowing straight back toward the inland parking lot behind you. Heavy surf is crashing directly onto the launching ramp.",
        layout: "horizontal",
        correctOrder: ['wind', 'sailor', 'ilca'] // Onshore wind logic: [Wind] -> [Sailor] -> [ILCA] -> [Beach]
    },
    {
        title: "Weather Assessment: Smoke Column",
        text: "Early morning registration. From the clubhouse balcony, you notice thick smoke from the shoreline barbecue drifting flat out across the surface of the water, away from land. The water right near the beach is flat, but heavy whitecaps are rolling far out at sea.",
        layout: "horizontal",
        correctOrder: ['ilca', 'sailor', 'wind'] // Offshore wind logic: [ILCA] -> [Sailor] -> [Wind] -> [Beach]
    },
    {
        title: "Weather Assessment: Parallel Ridge",
        text: "You are rigging your ILCA on a long beach running straight East to West. The local forecast channel reports a steady, heavy breeze driving directly out of the North, sweeping right down the shoreline parallel to the coast.",
        layout: "vertical",
        correctOrder: ['ilca', 'sailor', 'wind'] // Cross-shore logic (Top-to-Bottom): [ILCA] -> [Sailor] -> [Wind] over bottom Beach line
    }
];

let activeStep = 0;
let scoreCount = 0;

// DOM Target Selectors
const items = document.querySelectorAll('.item');
const slots = document.querySelectorAll('.slot');
const sourceBox = document.getElementById('source-container');
const workArena = document.getElementById('work-area');

const titleElement = document.getElementById('title-field');
const stepElement = document.getElementById('step-field');
const textElement = document.getElementById('text-field');
const feedbackDiv = document.getElementById('result');

const submitBtn = document.getElementById('btn-submit');
const retryBtn = document.getElementById('btn-retry');
const nextBtn = document.getElementById('btn-next');

// --- Drag & Drop Mechanics Subsystem ---
items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', e.target.id);
    });
});

slots.forEach(slot => {
    slot.addEventListener('dragover', (e) => e.preventDefault());
    slot.addEventListener('drop', (e) => {
        e.preventDefault();
        const elementId = e.dataTransfer.getData('text/plain');
        const draggedNode = document.getElementById(elementId);
        
        if (slot.children.length === 0) {
            slot.textContent = ''; 
            slot.appendChild(draggedNode);
        }
    });
});

sourceBox.addEventListener('dragover', (e) => e.preventDefault());
sourceBox.addEventListener('drop', (e) => {
    e.preventDefault();
    const elementId = e.dataTransfer.getData('text/plain');
    sourceBox.appendChild(document.getElementById(elementId));
});

// --- Challenge Navigation & Rendering Subsystems ---
function loadChallengeStage(index) {
    const stage = challengeTimeline[index];
    
    // Bind current text configurations
    titleElement.textContent = stage.title;
    stepElement.textContent = `${index + 1} / ${challengeTimeline.length}`;
    textElement.innerHTML = stage.text;

    // Toggle horizontal vs vertical grid layouts
    workArena.className = `work-area ${stage.layout}`;
    
    resetChallengeStage();
}

function resetChallengeStage() {
    slots.forEach((slot, idx) => {
        if (slot.firstElementChild) {
            sourceBox.appendChild(slot.firstElementChild);
        }
        // Label positions correctly matching active grid context
        slot.textContent = challengeTimeline[activeStep].layout === 'vertical' 
            ? `Position ${idx + 1}` 
            : `Slot ${idx + 1}`;
    });

    // Reset button visibility states
    feedbackDiv.innerHTML = '';
    submitBtn.style.display = 'inline-block';
    retryBtn.style.display = 'none';
    nextBtn.style.display = 'none';
}

// --- Assessment Validation Engine ---
function submitChallengeAnswer() {
    const stage = challengeTimeline[activeStep];
    
    // Evaluate drop position contents
    const userSequence = [
        document.getElementById('slot1').firstElementChild?.id,
        document.getElementById('slot2').firstElementChild?.id,
        document.getElementById('slot3').firstElementChild?.id
    ];

    const passing = userSequence.every((id, idx) => id === stage.correctOrder[idx]);
    submitBtn.style.display = 'none';

    if (passing) {
        scoreCount++;
        feedbackDiv.innerHTML = "<span class='text-success fw-bold'>✅ Correct assessment. Environmental positioning secure!</span>";
        revealNextAction();
    } else {
        feedbackDiv.innerHTML = "<span class='text-danger fw-bold'>❌ Incorrect safety alignment. You are exposed to hazard zones!</span>";
        retryBtn.style.display = 'inline-block';
    }
}

function revealNextAction() {
    if (activeStep < challengeTimeline.length - 1) {
        nextBtn.style.display = 'inline-block';
    } else {
        renderReportCard();
    }
}

function nextChallengeStage() {
    activeStep++;
    loadChallengeStage(activeStep);
}

function renderReportCard() {
    // Hide interaction containers to present a final report card panel
    sourceBox.style.display = 'none';
    workArena.style.display = 'none';
    stepElement.style.display = 'none';
    
    titleElement.textContent = "Challenge Completed!";
    
    let ranking = "";
    if (scoreCount === 3) ranking = "🏆 Master Captain — Flawless safety judgment!";
    else if (scoreCount === 2) ranking = "⛵ Able Sailor — Solid layout awareness, brush up on tricky variables.";
    else ranking = "⚓ Dock Hand — Review practice mode guidelines before launching real vessels.";

    textElement.innerHTML = `
        <div class='text-center py-4'>
            <h4 class='mb-3'>Your Results: <span class='text-primary fw-bold'>${scoreCount} / 3 Correct</span></h4>
            <p class='lead font-monospace bg-light p-3 border rounded text-secondary'>${ranking}</p>
        </div>
    `;
}

// Fire runtime script configuration
loadChallengeStage(0);
