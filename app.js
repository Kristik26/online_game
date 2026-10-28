import { db, ref, set, get, onValue, update, onDisconnect } from "./firebase-config.js?v=4";
import { initBomba } from "./games/bomba.js?v=4";
import { initSlider } from "./games/slider.js?v=4";
import { initVyzyvatel } from "./games/vyzyvatel.js?v=4";

// Globální stav hráče
export const state = {
    myName: "",
    roomId: "",
    isHost: false,
    players: []
};

// Přihlášení do místnosti
document.getElementById("btnJoin").addEventListener("click", async () => {
    const nameInput = document.getElementById("playerName").value.trim();
    const roomInput = document.getElementById("roomId").value.trim().toUpperCase();

    if (!nameInput || !roomInput) {
        alert("Vyplň přezdívku i kód místnosti!");
        return;
    }

    state.myName = nameInput;
    state.roomId = roomInput;

    const roomRef = ref(db, `rooms/${state.roomId}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) {
        // Místnost neexistuje -> zakládáme ji a stáváme se Hostem
        state.isHost = true;
        await set(roomRef, {
            host: state.myName,
            activeState: "lobby",
            players: {
                [state.myName]: { joinedAt: Date.now() }
            }
        });
    } else {
        // Místnost existuje -> přidáme se do ní
        const roomData = snapshot.val();
        if (roomData.host === state.myName) {
            state.isHost = true; // Pokud se Host omylem odpojil a vrátil pod stejným jménem
        }
        await update(ref(db, `rooms/${state.roomId}/players`), {
            [state.myName]: { joinedAt: Date.now() }
        });
    }

    // Automatické smazání hráče při zavření tabu
    onDisconnect(ref(db, `rooms/${state.roomId}/players/${state.myName}`)).remove();

    setupUI();
    startListeners();
});

function setupUI() {
    document.getElementById("displayRoomId").innerText = state.roomId;
    document.getElementById("displayPlayerName").innerText = state.myName;

    if (state.isHost) {
        document.getElementById("hostControls").style.display = "block";
        document.getElementById("waitingMsg").style.display = "none";
        document.querySelectorAll(".host-only-bar").forEach(el => el.style.display = "block");
    }

    // Nabindování tlačítek pro spuštění her v Lobby
    document.querySelectorAll("#hostControls .btn-game").forEach(btn => {
        btn.addEventListener("click", () => {
            const gameName = btn.getAttribute("data-game");
            if (gameName) switchPortalState(gameName);
        });
    });

    // Nabindování tlačítek "Zpět do Lobby"
    document.querySelectorAll(".btn-backToLobby").forEach(btn => {
        btn.addEventListener("click", () => {
            switchPortalState("lobby");
        });
    });

    // Inicializace herních modulů
    initBomba();
    initSlider();
    initVyzyvatel();
}

function startListeners() {
    // 1. Sledování seznamu hráčů
    onValue(ref(db, `rooms/${state.roomId}/players`), (snapshot) => {
        const playersObj = snapshot.val() || {};
        state.players = Object.keys(playersObj);

        const listEl = document.getElementById("playersList");
        listEl.innerHTML = state.players
            .map(p => `<li>${p === state.myName ? "⭐ " + p : p}</li>`)
            .join("");
    });

    // 2. Sledování aktivní obrazovky (Router)
    onValue(ref(db, `rooms/${state.roomId}/activeState`), (snapshot) => {
        const activeState = snapshot.val();
        if (!activeState) return;

        // Reset pozadí (kdyby se odcházelo z prostředku Bomby)
        document.body.className = "";

        // Přepnutí viditelného divu
        document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
        const targetScreen = document.getElementById(`screen-${activeState}`);
        if (targetScreen) {
            targetScreen.classList.add("active");
        }
    });
}

// Funkce pro Hosta na přepnutí hry
export function switchPortalState(newState) {
    if (!state.isHost) return;
    update(ref(db, `rooms/${state.roomId}`), { activeState: newState });
}