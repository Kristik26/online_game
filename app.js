import { db, ref, set, get, onValue, update, onDisconnect, remove } from "./firebase-config.js?v=6";
import { initBomba } from "./games/bomba.js?v=6";
import { initSlider } from "./games/slider.js?v=6";
import { initVyzyvatel } from "./games/vyzyvatel.js?v=6";
import { initDilema } from "./games/dilema.js?v=6";

// Globální stav hráče
export const state = {
    myName: "",
    roomId: "",
    isHost: false,
    players: []
};

// Úklid prázdných místností v databázi (pokud v nich nezůstal žádný hráč)
async function cleanupEmptyRooms() {
    try {
        const roomsSnap = await get(ref(db, "rooms"));
        if (!roomsSnap.exists()) return;
        const rooms = roomsSnap.val();
        for (const [rId, rData] of Object.entries(rooms)) {
            if (!rData.players || Object.keys(rData.players).length === 0) {
                await remove(ref(db, `rooms/${rId}`));
            }
        }
    } catch (e) {
        console.error("Chyba při úklidu prázdných místností:", e);
    }
}

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

    // Nejprve promažeme případné osiřelé prázdné místnosti v databázi
    await cleanupEmptyRooms();

    const roomRef = ref(db, `rooms/${state.roomId}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists() || !snapshot.val().players) {
        // Místnost neexistuje (nebo byla prázdná) -> zakládáme ji a stáváme se Hostem
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
        if (roomData.host === state.myName || !roomData.players[roomData.host]) {
            state.isHost = true;
            await update(roomRef, { host: state.myName });
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

function updateHostUI() {
    if (state.isHost) {
        document.getElementById("hostControls").style.display = "block";
        document.getElementById("waitingMsg").style.display = "none";
        document.querySelectorAll(".host-only-bar").forEach(el => el.style.display = "block");
    }
}

function setupUI() {
    document.getElementById("displayRoomId").innerText = state.roomId;
    document.getElementById("displayPlayerName").innerText = state.myName;

    updateHostUI();

    // Nabindování tlačítek pro spuštění her v Lobby
    document.querySelectorAll("#hostControls .btn-game").forEach(btn => {
        btn.addEventListener("click", () => {
            const gameName = btn.getAttribute("data-game");
            if (gameName) switchPortalState(gameName);
        });
    });

    // Nabindování tlačítek "Zpět do Lobby" (ukončí aktuální hru a smaže ji z DB)
    document.querySelectorAll(".btn-backToLobby").forEach(btn => {
        btn.addEventListener("click", () => {
            switchPortalState("lobby");
        });
    });

    // Tlačítko pro opuštění místnosti
    const btnLeave = document.getElementById("btnLeaveRoom");
    if (btnLeave) {
        btnLeave.addEventListener("click", leaveRoom);
    }

    // Inicializace herních modulů
    initBomba();
    initSlider();
    initVyzyvatel();
    initDilema();
}

function startListeners() {
    const roomRef = ref(db, `rooms/${state.roomId}`);
    const myPlayerRef = ref(db, `rooms/${state.roomId}/players/${state.myName}`);

    // 1. Sledování seznamu hráčů a automatické smazání místnosti, když v ní nikdo nezůstane
    onValue(ref(db, `rooms/${state.roomId}/players`), async (snapshot) => {
        const playersObj = snapshot.val() || {};
        state.players = Object.keys(playersObj);

        const listEl = document.getElementById("playersList");
        listEl.innerHTML = state.players
            .map(p => `<li>${p === state.myName ? "⭐ " + p : p}</li>`)
            .join("");

        // Pokud jsem v místnosti úplně sám (poslední hráč), nastavíme onDisconnect na celou místnost,
        // aby se po mém odpojení smazala celá místnost včetně her z databáze.
        if (state.players.length === 1 && state.players[0] === state.myName) {
            onDisconnect(roomRef).remove();
        } else if (state.players.length > 1) {
            // Pokud je v místnosti víc lidí, při odpojení mažeme jen sebe, ne celou místnost
            onDisconnect(roomRef).cancel();
            onDisconnect(myPlayerRef).remove();
        }

        // Pokud původní Host odešel a já jsem první v seznamu zbývajících hráčů, převezmu roli Hosta
        if (!state.isHost && state.players.length > 0 && state.players[0] === state.myName) {
            const roomSnap = await get(roomRef);
            if (roomSnap.exists()) {
                const currentHost = roomSnap.val().host;
                if (!playersObj[currentHost]) {
                    state.isHost = true;
                    updateHostUI();
                    await update(roomRef, { host: state.myName });
                }
            }
        }
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

// Funkce pro Hosta na přepnutí hry (při návratu do lobby smaže ukončenou hru z databáze)
export function switchPortalState(newState) {
    if (!state.isHost) return;
    if (newState === "lobby") {
        update(ref(db, `rooms/${state.roomId}`), {
            activeState: "lobby",
            games: null
        });
    } else {
        update(ref(db, `rooms/${state.roomId}`), {
            activeState: newState
        });
    }
}

// Ruční opuštění místnosti
async function leaveRoom() {
    const roomRef = ref(db, `rooms/${state.roomId}`);
    const myPlayerRef = ref(db, `rooms/${state.roomId}/players/${state.myName}`);

    onDisconnect(roomRef).cancel();
    onDisconnect(myPlayerRef).cancel();

    if (state.players.length <= 1) {
        // Jsme poslední hráč -> smažeme rovnou celou místnost z databáze
        await remove(roomRef);
    } else {
        // Jinak smažeme ze seznamu jen sebe
        await remove(myPlayerRef);
    }

    window.location.reload();
}
