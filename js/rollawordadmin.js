// 1. Import SDK components from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    updateDoc, 
    deleteDoc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. PASTE YOUR WEBPAGE FIREBASE CONFIG HERE
const firebaseConfig = {
    apiKey: "AIzaSyC_ayepAzJV_vfV5Qh8m52tGnn1Iw7CRnY",
    authDomain: "://firebaseapp.com",
    projectId: "laser-sailing-simulator",
    storageBucket: "laser-sailing-simulator.firebasestorage.app",
    messagingSenderId: "45397375888",
    appId: "1:145397375888:web:1ca8d7688170787624d115"
};

// Initialize Firebase instances
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const leaderboardCollection = collection(db, "rollaword_leaderboard");

// DOM elements cache references
const crudForm = document.getElementById("crud-form");
const entryIdInput = document.getElementById("entry-id");
const entryNameInput = document.getElementById("entry-name");
const entryScoreInput = document.getElementById("entry-score");
const entryDateInput = document.getElementById("entry-date");

const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const gridBody = document.getElementById("database-grid-body");

// Object cache to hold records locally for instant text-box loading during selection
let loadedRecordsCache = {};

// 3. READ: Real-time Listener synchronizing database state straight to your HTML grid
const q = query(leaderboardCollection, orderBy("date", "desc"), orderBy("score", "desc"));
onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
        gridBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No entries stored inside rollaword_leaderboard.</td></tr>`;
        return;
    }

    let htmlBuffer = "";
    loadedRecordsCache = {}; // Wipe old dictionary cache reference

    snapshot.forEach((documentSnapshot) => {
        const id = documentSnapshot.id;
        const data = documentSnapshot.data();
        
        // Store record values in local memory cache
        loadedRecordsCache[id] = data;

        htmlBuffer += `
            <tr id="row-${id}">
                <td style="color: #888; font-size: 11px;">${id}</td>
                <td>${data.date}</td>
                <td><strong>${data.name}</strong></td>
                <td>${data.score} pts</td>
                <td class="action-links">
                    <a onclick="window.startEditMode('${id}')">Edit</a>
                    <a class="delete-link" onclick="window.triggerDelete('${id}')">Delete</a>
                </td>
            </tr>
        `;
    });
    gridBody.innerHTML = htmlBuffer;
});

// 4. CREATE or UPDATE Submission router controller
crudForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const targetId = entryIdInput.value;
    const payload = {
        name: entryNameInput.value.trim(),
        score: parseInt(entryScoreInput.value, 10),
        date: entryDateInput.value.trim()
    };

    try {
        if (targetId) {
            // UPDATE: Target specific active document tracking link ID
            const docRef = doc(db, "rollaword_leaderboard", targetId);
            await updateDoc(docRef, payload);
            alert("Leaderboard document altered successfully!");
        } else {
            // CREATE: Insert completely fresh data submission
            await addDoc(leaderboardCollection, payload);
            alert("Player score recorded into Cloud DB!");
        }
        resetFormState();
    } catch (err) {
        console.error("CRUD persistence failure:", err);
        alert("Database operation execution rejected. See console log details.");
    }
});

// 5. EDIT MODE ACTIVATION (Exposed to global window scope so HTML table can fire it)
window.startEditMode = function(docId) {
    const record = loadedRecordsCache[docId];
    if (!record) return;

    // Populate the input elements with data values
    entryIdInput.value = docId;
    entryNameInput.value = record.name;
    entryScoreInput.value = record.score;
    entryDateInput.value = record.date;

    // Shift form styles instantly into update workflow configuration
    formTitle.textContent = `Update Existing Document Record [ID: ${docId}]`;
    submitBtn.textContent = "Update Button";
    submitBtn.className = "admin-btn btn-success";
    cancelBtn.style.display = "inline-block";
    
    // Auto scroll viewport straight back to input forms smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 6. DELETE OPERATION PIPELINE
window.triggerDelete = async function(docId) {
    if (!confirm(`Are you absolutely sure you want to drop record execution entry context (${docId})?`)) return;
    try {
        await deleteDoc(doc(db, "rollaword_leaderboard", docId));
        if(entryIdInput.value === docId) resetFormState();
    } catch (err) {
        console.error("Target node wipe fault context:", err);
    }
};

// Form clearing utility routine
cancelBtn.addEventListener("click", resetFormState);
function resetFormState() {
    crudForm.reset();
    entryIdInput.value = "";
    formTitle.textContent = "Create New Score Record";
    submitBtn.textContent = "Save Record";
    submitBtn.className = "admin-btn btn-primary";
    cancelBtn.style.display = "none";
}
