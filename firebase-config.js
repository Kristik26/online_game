import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { firebaseConfig } from "./firebase-env.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Exportujeme db a funkce, ať nemusíme psát dlouhé URL v každém souboru
export { db, ref, set, get, onValue, update, onDisconnect, remove };
