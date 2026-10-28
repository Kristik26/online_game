import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// Konfigurace Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAoscmcB4jStMkbxPl7YM8JgqVAwVB_NPI",
  authDomain: "party-portal-d2a9b.firebaseapp.com",
  projectId: "party-portal-d2a9b",
  storageBucket: "party-portal-d2a9b.firebasestorage.app",
  messagingSenderId: "261585928649",
  appId: "1:261585928649:web:3195927e3842ad3feb2818",
  measurementId: "G-QB7ZH0BGQX",
  databaseURL: "https://party-portal-d2a9b-default-rtdb.europe-west1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Exportujeme db a funkce, ať nemusíme psát dlouhé URL v každém souboru
export { db, ref, set, get, onValue, update, onDisconnect, remove };
