import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc,
    query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ---- CONFIG -------------------------------------------------------------
// Copy this block again from Firebase console > Project settings if anything fails.
// (Your messagingSenderId and appId project numbers didn't match, so check them.)
const firebaseConfig = {
    apiKey: "AIzaSyC_ayepAzJV_vfV5Qh8m52tGnn1Iw7CRnY",
    authDomain: "laser-sailing-simulator.firebaseapp.com",
    projectId: "laser-sailing-simulator",
    storageBucket: "laser-sailing-simulator.firebasestorage.app",
    messagingSenderId: "45397375888",
    appId: "1:145397375888:web:1ca8d7688170787624d115"
};
// ------------------------------------------------------------------------

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const COLLECTION = "rollaword_leaderboard";
const leaderboardCollection = collection(db, COLLECTION);

// DOM
const crudForm = document.getElementById("crud-form");
const entryIdInput = document.getElementById("entry-id");
const entryNameInput = document.getElementById("entry-name");
const entryScoreInput = document.getElementById("entry-score");
const entryDateInput = document.getElementById("entry-date");
const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const gridBody = document.getElementById("database-grid-body");
const authBtn = document.getElementById("auth-btn");
const userLabel = document.getElementById("user-label");
const adminTools = document.getElementById("admin-tools");

// Escape text before putting it in HTML (player names come from the public)
const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let loadedRecordsCache = {};
let signedIn = false;

// ---- Messages -----------------------------------------------------------
function showAdminMessage(text) {
    let box = document.getElementById("admin-message");
    if (!box) {
        box = document.createElement("div");
        box.id = "admin-message";
        box.style.cssText = "background:#fdecea; border:1px solid #dc3545; color:#a71d2a; padding:10px 14px; margin:10px 0; border-radius:4px;";
        document.querySelector(".crud-table").before(box);
    }
    box.textContent = text;
    box.style.display = text ? "block" : "none";
}

// ---- Sign in / out ------------------------------------------------------
authBtn.addEventListener("click", async () => {
    try {
        if (auth.currentUser) await signOut(auth);
        else await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
        console.error(err);
        showAdminMessage(`Sign-in failed (${err.code}). If it says unauthorized-domain, add this site's domain under Firebase console > Authentication > Settings > Authorized domains. Open the page via http://localhost, not by double-clicking the file.`);
    }
});

onAuthStateChanged(auth, (user) => {
    signedIn = !!user;
    userLabel.textContent = user ? user.email + " " : "";
    authBtn.textContent = user ? "Sign out" : "Sign in with Google";
    adminTools.style.display = user ? "block" : "none";
    renderTable(); // show/hide Edit and Delete links
});

// ---- READ ---------------------------------------------------------------
// Ordered by date only (no composite index needed); score ordering is done below.
const q = query(leaderboardCollection, orderBy("date", "desc"), limit(300));
let lastDocs = [];

onSnapshot(q, (snapshot) => {
    lastDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    lastDocs.sort((a, b) => (b.date + "").localeCompare(a.date + "") || (b.score - a.score));
    loadedRecordsCache = {};
    lastDocs.forEach(r => { loadedRecordsCache[r.id] = r; });
    renderTable();
}, (err) => {
    console.error(err);
    showAdminMessage(`Could not load entries (${err.code}). ${err.message}`);
});

function renderTable() {
    if (lastDocs.length === 0) {
        gridBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No entries stored inside ${COLLECTION}.</td></tr>`;
        return;
    }
    gridBody.innerHTML = lastDocs.map(r => `
        <tr id="row-${esc(r.id)}">
            <td style="color:#888; font-size:11px;">${esc(r.id)}</td>
            <td>${esc(r.date)}</td>
            <td><strong>${esc(r.name)}</strong></td>
            <td>${esc(r.score)} pts</td>
            <td class="action-links">${signedIn ? `
                <a onclick="window.startEditMode('${esc(r.id)}')">Edit</a>
                <a class="delete-link" onclick="window.triggerDelete('${esc(r.id)}')">Delete</a>` : ""}
            </td>
        </tr>`).join("");
}

// ---- CREATE / UPDATE ----------------------------------------------------
crudForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const targetId = entryIdInput.value;
    const payload = {
        name: entryNameInput.value.trim(),
        score: parseInt(entryScoreInput.value, 10),
        date: entryDateInput.value.trim()
    };

    if (!payload.name || payload.name.length > 20) return showAdminMessage("Name must be 1-20 characters.");
    if (Number.isNaN(payload.score) || payload.score < 0 || payload.score > 1000000) return showAdminMessage("Score must be a number from 0 to 1,000,000.");
    if (!/^[0-9]{8}$/.test(payload.date)) return showAdminMessage("Date must be 8 digits, like 20261028.");
    showAdminMessage("");

    try {
        if (targetId) {
            await updateDoc(doc(db, COLLECTION, targetId), payload);
        } else {
            await addDoc(leaderboardCollection, payload);
        }
        resetFormState();
    } catch (err) {
        console.error(err);
        showAdminMessage(`Save failed (${err.code || err.message}). If it says permission-denied, check you're signed in with the admin email and the rules are published.`);
    }
});

// ---- EDIT ---------------------------------------------------------------
window.startEditMode = function (docId) {
    const record = loadedRecordsCache[docId];
    if (!record) return;
    entryIdInput.value = docId;
    entryNameInput.value = record.name;
    entryScoreInput.value = record.score;
    entryDateInput.value = record.date;
    formTitle.textContent = `Update Existing Record [ID: ${docId}]`;
    submitBtn.textContent = "Update Record";
    submitBtn.className = "admin-btn btn-success";
    cancelBtn.style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: "smooth" });
};

// ---- DELETE (click twice to confirm) -----------------------------------
const pendingDeletes = new Set();

window.triggerDelete = async function (docId) {
    const link = document.querySelector(`#row-${CSS.escape(docId)} .delete-link`);

    if (!pendingDeletes.has(docId)) {
        pendingDeletes.add(docId);
        if (link) link.textContent = "Click again to confirm";
        setTimeout(() => {
            pendingDeletes.delete(docId);
            if (link && link.isConnected) link.textContent = "Delete";
        }, 4000);
        return;
    }

    pendingDeletes.delete(docId);
    showAdminMessage("");
    if (link) link.textContent = "Deleting...";
    try {
        await deleteDoc(doc(db, COLLECTION, docId));
        if (entryIdInput.value === docId) resetFormState();
    } catch (err) {
        console.error(err);
        showAdminMessage(`Delete failed (${err.code || err.message}). Record ${docId} was not deleted.`);
        if (link) link.textContent = "Delete";
    }
};

// ---- Reset --------------------------------------------------------------
cancelBtn.addEventListener("click", resetFormState);
function resetFormState() {
    crudForm.reset();
    entryIdInput.value = "";
    formTitle.textContent = "Create New Score Record";
    submitBtn.textContent = "Save Record";
    submitBtn.className = "admin-btn btn-primary";
    cancelBtn.style.display = "none";
}
