import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

export const firebaseConfig = {
    apiKey: "AIzaSyCW4NbNdOkfs-lPSNFDyNqRTCPYimL7rks",
    authDomain: "eastern-wordtest.firebaseapp.com",
    projectId: "eastern-wordtest",
    storageBucket: "eastern-wordtest.firebasestorage.app",
    messagingSenderId: "908358368350",
    appId: "1:908358368350:web:18a2197cf035fb118088cf",
    measurementId: "G-WHCV2L49WK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
