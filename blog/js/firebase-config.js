import {
    initializeApp,
    getApp,
    getApps
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
    getAuth,
    GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyC_ayepAzJV_vfV5Qh8m52tGnn1Iw7CRnY",
    authDomain: "laser-sailing-simulator.firebaseapp.com",
    projectId: "laser-sailing-simulator",
    storageBucket: "laser-sailing-simulator.firebasestorage.app",
    messagingSenderId: "45397375888",
    appId: "1:45397375888:web:1ca8d7688170787624d115"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, db, auth, googleProvider };