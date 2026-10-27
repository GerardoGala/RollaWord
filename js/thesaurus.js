const wordInput = document.getElementById('word-input');
const canvasContainer = document.getElementById('canvas-container');

// 🔒 SCROLL LOCK: Prevent page scrolling
document.documentElement.style.overflow = 'hidden';
document.body.style.overflow = 'hidden';

// ⚙️ GLOBAL THEME & ANIMATION CONFIGURATIONS (Tweak these values!)
const MAX_SYNONYMS = 9;         // Maximum number of synonym nodes allowed on screen
const EXPLOSION_RADIUS = 160;   // Maximum distance nodes branch out (in pixels); shrinks automatically on small screens
const SCREEN_MARGIN = 10;       // Minimum gap kept between any button and the screen edge (in pixels)

const ANIMATION_DURATION = '0.5s'; // How long the flight lasts (Must include 's' for seconds)
const STAGGER_DELAY = 35;          // Milliseconds between each button launch ripple
const START_DELAY = 20;            // Initial baseline delay before movement starts (in ms)

wordInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && this.value.trim() !== '') {
        fetchSynonyms(this.value.trim());
    }
});

function fetchSynonyms(word) {
    clearCanvas();

    // Safe Base64 string for: "https://api.datamuse.com/words?rel_syn="
    var securePath = atob("aHR0cHM6Ly9hcGkuZGF0YW11c2UuY29tL3dvcmRzP3JlbF9zeW49");
    var apiUrl = securePath + encodeURIComponent(word);

    fetch(apiUrl)
        .then(function (response) { return response.json(); })
        .then(function (data) {
            // Keep only single-word synonyms (skip anything containing a space)
            var allSynonyms = data
                .map(function (item) { return item.word; })
                .filter(function (w) { return w.indexOf(' ') === -1; });

            if (allSynonyms.length === 0) {
                alert("No synonyms found for that word. Try another!");
                return;
            }

            // Limit the array using our global MAX_SYNONYMS configuration variable
            var limitedSynonyms = allSynonyms.slice(0, MAX_SYNONYMS);
            generateExplosion(limitedSynonyms);
        })
        .catch(function (err) { console.error("Error fetching data:", err); });
}

function generateExplosion(synonyms) {
    const list = synonyms.slice(0, MAX_SYNONYMS);
    const N = list.length;
    const angleInterval = 360 / N;

    // Track the exact live coordinates of your text box center
    const boxRect = wordInput.getBoundingClientRect();
    const textboxX = boxRect.left + (boxRect.width / 2);
    const textboxY = boxRect.top + (boxRect.height / 2);

    // PASS 1: build the buttons (hidden at the center) so we can measure them
    const buttons = list.map(function (synonym) {
        var synButton = document.createElement('button');
        synButton.innerText = synonym;

        // Core starting styles (Spawn hidden at the absolute center of the textbox)
        synButton.style.position = 'fixed';
        synButton.style.left = textboxX + 'px';
        synButton.style.top = textboxY + 'px';
        synButton.style.transform = 'translate(-50%, -50%) scale(0)'; // Spawn at scale 0
        synButton.style.opacity = '0'; // Completely invisible at start

        // Visual presentation theme rules
        synButton.style.padding = '10px 20px';
        synButton.style.fontSize = '14px';
        synButton.style.fontWeight = 'bold';
        synButton.style.fontFamily = 'Arial, sans-serif';
        synButton.style.border = 'none';
        synButton.style.backgroundColor = '#0056b3';
        synButton.style.color = '#ffffff';
        synButton.style.cursor = 'pointer';
        synButton.style.zIndex = '99999';
        synButton.style.whiteSpace = 'nowrap';
        synButton.style.borderRadius = '4px';
        synButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';

        // 💫 CSS TRANSITION HOOK
        synButton.style.transition = 'left ' + ANIMATION_DURATION + ' cubic-bezier(0.25, 1, 0.5, 1), top ' + ANIMATION_DURATION + ' cubic-bezier(0.25, 1, 0.5, 1), transform ' + ANIMATION_DURATION + ' ease-out, opacity ' + ANIMATION_DURATION + ' ease-out';

        synButton.addEventListener('click', function () {
            wordInput.value = synonym;
            fetchSynonyms(synonym);
        });

        document.body.appendChild(synButton);
        return synButton;
    });

    // 📱 FIT TO SCREEN: size the ring so the biggest button never leaves the viewport
    var maxHalfW = 0;
    var maxHalfH = 0;
    buttons.forEach(function (b) {
        maxHalfW = Math.max(maxHalfW, b.offsetWidth / 2);
        maxHalfH = Math.max(maxHalfH, b.offsetHeight / 2);
    });

    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    // Horizontal and vertical radii are fitted separately (the ring becomes an oval on tall phones)
    const radiusX = Math.max(0, Math.min(
        EXPLOSION_RADIUS,
        textboxX - maxHalfW - SCREEN_MARGIN,
        viewW - textboxX - maxHalfW - SCREEN_MARGIN
    ));
    const radiusY = Math.max(0, Math.min(
        EXPLOSION_RADIUS,
        textboxY - maxHalfH - SCREEN_MARGIN,
        viewH - textboxY - maxHalfH - SCREEN_MARGIN
    ));

    // PASS 2: launch each button to its fitted position
    buttons.forEach(function (synButton, index) {
        const angleInRadians = (index * angleInterval) * (Math.PI / 180);

        setTimeout(function () {
            const targetX = textboxX + radiusX * Math.cos(angleInRadians);
            const targetY = textboxY + radiusY * Math.sin(angleInRadians);

            synButton.style.left = targetX + 'px';
            synButton.style.top = targetY + 'px';
            synButton.style.transform = 'translate(-50%, -50%) scale(1)'; // Bring to full size
            synButton.style.opacity = '1'; // Fade completely into focus view
        }, START_DELAY + (index * STAGGER_DELAY));
    });
}

function clearCanvas() {
    var buttons = document.querySelectorAll('button');
    buttons.forEach(function (button) {
        button.remove();
    });
}
