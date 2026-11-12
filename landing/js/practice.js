// Sequence Timeline Data Structure
const scenarioTimeline = [
    {
        title: "Offshore Launch",
        text: "The wind is blowing from land out to sea. Arrange the components from <strong>Left to Right</strong> so that you are holding the boat safely from its upwind side.",
        layout: "horizontal",
        windLabel: "Wind◀",
        correctOrder: ['ilca', 'sailor', 'wind']
    },
    {
        title: "Onshore Launch",
        text: "The wind is blowing directly from the water onto the beach. Arrange the components from <strong>Left to Right</strong> to avoid getting trapped between the hull and dry beach.",
        layout: "horizontal",
        windLabel: "Wind▶",
        correctOrder: ['wind', 'sailor', 'ilca']
    },
    {
        title: "Cross-shore Launch",
        text: "The breeze runs parallel to the coastline. Arrange the components vertically from <strong>Top to Bottom</strong>, keeping yourself directly upwind of the ILCA's side hull.",
        layout: "vertical",
        windLabel: "Wind▲",
        correctOrder: ['ilca', 'sailor', 'wind']
    }
];

let currentStepIndex = 0;

// DOM Target Caches
const items = document.querySelectorAll('.item');
const slots = document.querySelectorAll('.slot');
const sourceContainer = document.getElementById('source-container');
const workArea = document.getElementById('work-area');

const titleField = document.getElementById('title-field');
const stepField = document.getElementById('step-field');
const textField = document.getElementById('text-field');
const windElement = document.getElementById('wind');
const resultDiv = document.getElementById('result');

const btnSubmit = document.getElementById('btn-submit');
const btnRetry = document.getElementById('btn-retry');
const btnNext = document.getElementById('btn-next');

// --- HTML5 Drag & Drop Subsystems ---
items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', e.target.id);
    });
});

slots.forEach(slot => {
    slot.addEventListener('dragover', (e) => e.preventDefault());
    slot.addEventListener('drop', (e) => {
        e.preventDefault();
        const itemId = e.dataTransfer.getData('text/plain');
        const draggedItem = document.getElementById(itemId);
        
        if (slot.children.length === 0) {
            slot.textContent = ''; 
            slot.appendChild(draggedItem);
        }
    });
});

sourceContainer.addEventListener('dragover', (e) => e.preventDefault());
sourceContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    sourceContainer.appendChild(document.getElementById(itemId));
});

// --- Navigation & Core Display Rendering Engines ---
function loadScenario(index) {
    const config = scenarioTimeline[index];
    
    // Render step text settings
    titleField.textContent = config.title;
    stepField.textContent = `${index + 1} / ${scenarioTimeline.length}`;
    textField.innerHTML = config.text;
    windElement.textContent = config.windLabel;

    // Reset workspace layout styles
    workArea.className = `work-area ${config.layout}`;
    
    // Restore items to original state
    resetCurrentScenario();
}

function resetCurrentScenario() {
    slots.forEach((slot, idx) => {
        if (slot.firstElementChild) {
            sourceContainer.appendChild(slot.firstElementChild);
        }
        slot.textContent = configSlotLabel(idx);
    });

    // Toggle UI control displays back to standard initial state
    resultDiv.innerHTML = '';
    btnSubmit.style.display = 'inline-block';
    btnRetry.style.display = 'none';
    btnNext.style.display = 'none';
}

function configSlotLabel(index) {
    return scenarioTimeline[currentStepIndex].layout === 'vertical' 
        ? `Position ${index + 1}` 
        : `Slot ${index + 1}`;
}

// --- Evaluation Verification Logic ---
function checkAnswer() {
    const config = scenarioTimeline[currentStepIndex];
    
    const currentOrder = [
        document.getElementById('slot1').firstElementChild?.id,
        document.getElementById('slot2').firstElementChild?.id,
        document.getElementById('slot3').firstElementChild?.id
    ];

    const isCorrect = currentOrder.every((id, index) => id === config.correctOrder[index]);

    btnSubmit.style.display = 'none';

    if (isCorrect) {
        resultDiv.innerHTML = "<span class='pass'>✅ Correct! Brilliant tracking.</span>";
        if (currentStepIndex < scenarioTimeline.length - 1) {
            btnNext.style.display = 'inline-block';
        } else {
            resultDiv.innerHTML = "<span class='pass'>🏆 Practice Complete! You mastered all safety alignments.</span>";
        }
    } else {
        resultDiv.innerHTML = "<span class='fail'>❌ Incorrect alignment. Let's fix your relative safety positioning.</span>";
        btnRetry.style.display = 'inline-block';
    }
}

function navigateNext() {
    currentStepIndex++;
    loadScenario(currentStepIndex);
}

// Launch Application Runtime Configuration
loadScenario(0);
