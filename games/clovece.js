import { db, ref, set, onValue, update } from "../firebase-config.js?v=8";
import { state } from "../app.js?v=8";

const COLORS = [
    { key: "red", name: "Červená", emoji: "🔴", hex: "#ef4444" },
    { key: "blue", name: "Modrá", emoji: "🔵", hex: "#3b82f6" },
    { key: "green", name: "Zelená", emoji: "🟢", hex: "#22c55e" },
    { key: "yellow", name: "Žlutá", emoji: "🟡", hex: "#eab308" }
];

const START_OFFSET = [0, 10, 20, 30];

// 40 políček hlavního okruhu po směru hodinových ručiček
const TRACK = [
    [4,0],[4,1],[4,2],[4,3],[4,4],[3,4],[2,4],[1,4],[0,4],[0,5],
    [0,6],[1,6],[2,6],[3,6],[4,6],[4,7],[4,8],[4,9],[4,10],[5,10],
    [6,10],[6,9],[6,8],[6,7],[6,6],[7,6],[8,6],[9,6],[10,6],[10,5],
    [10,4],[9,4],[8,4],[7,4],[6,4],[6,3],[6,2],[6,1],[6,0],[5,0]
];

const HOME_LANES = [
    [[5,1],[5,2],[5,3],[5,4]], // 0: Červená
    [[1,5],[2,5],[3,5],[4,5]], // 1: Modrá
    [[5,9],[5,8],[5,7],[5,6]], // 2: Zelená
    [[9,5],[8,5],[7,5],[6,5]]  // 3: Žlutá
];

const BASES = [
    [[0,0],[0,1],[1,0],[1,1]],     // 0: Červená
    [[0,9],[0,10],[1,9],[1,10]],   // 1: Modrá
    [[9,9],[9,10],[10,9],[10,10]], // 2: Zelená
    [[9,0],[9,1],[10,0],[10,1]]    // 3: Žlutá
];

const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

let latestData = null;

const toArr = (v) => (Array.isArray(v) ? v : v ? Object.values(v) : []);

export function initClovece() {
    const container = document.getElementById("clovece-content");
    if (!container) return;

    renderWaiting(container);

    const cloveceRef = ref(db, `rooms/${state.roomId}/games/clovece`);
    onValue(cloveceRef, (snapshot) => {
        const data = snapshot.val();
        latestData = data;

        if (!data || data.status === "waiting") {
            renderWaiting(container);
            return;
        }

        if (data.status === "playing") {
            renderPlaying(container, data);
            return;
        }

        if (data.status === "finished") {
            renderFinished(container, data);
            return;
        }

        renderWaiting(container);
    });
}

function getInitialRolls(pieces) {
    const hasNonSixMove = pieces.some(
        p => p >= 0 && [1, 2, 3, 4, 5].some(d => p + d <= 43 && !pieces.includes(p + d))
    );
    return !hasNonSixMove && pieces.some(p => p === -1) ? 3 : 1;
}

function getValidPieceIndices(pieces, dice) {
    const valid = [];
    for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        if (p === -1) {
            if (dice === 6 && !pieces.includes(0)) valid.push(i);
        } else if (p + dice <= 43 && !pieces.includes(p + dice)) {
            valid.push(i);
        }
    }
    return valid;
}

function startNewGame() {
    const rawPlayers = state.players.length > 0 ? [...state.players] : [state.myName];
    const selected = rawPlayers.slice(0, 4);

    let colorAssignment = [0];
    if (selected.length === 2) colorAssignment = [0, 2];
    else if (selected.length === 3) colorAssignment = [0, 1, 2];
    else if (selected.length >= 4) colorAssignment = [0, 1, 2, 3];

    const players = selected.map((name, idx) => ({
        name,
        colorIdx: colorAssignment[idx]
    }));

    const pieces = {};
    for (const p of players) {
        pieces[p.name] = [-1, -1, -1, -1];
    }

    set(ref(db, `rooms/${state.roomId}/games/clovece`), {
        status: "playing",
        players,
        pieces,
        currentTurnIndex: 0,
        turnPhase: "roll",
        dice: null,
        rollsLeft: 3,
        lastAction: `Hra začala! Hází ${players[0].name}.`,
        winner: null
    });
}

function rollDice() {
    if (!latestData || latestData.status !== "playing" || latestData.turnPhase !== "roll") return;
    const players = toArr(latestData.players);
    const currIdx = latestData.currentTurnIndex || 0;
    const currentPlayer = players[currIdx];
    if (!currentPlayer || currentPlayer.name !== state.myName) return;

    const myPieces = toArr(latestData.pieces?.[state.myName]);
    const dice = Math.floor(Math.random() * 6) + 1;
    const valid = getValidPieceIndices(myPieces, dice);

    if (valid.length > 0) {
        update(ref(db, `rooms/${state.roomId}/games/clovece`), {
            dice,
            turnPhase: "move",
            lastAction: `${state.myName} hodil(a) ${dice} ${DICE_FACES[dice]} — vyber figurku!`
        });
        return;
    }

    const rollsLeft = latestData.rollsLeft || 1;
    if (dice < 6 && rollsLeft > 1) {
        const nextRollsLeft = rollsLeft - 1;
        update(ref(db, `rooms/${state.roomId}/games/clovece`), {
            dice,
            rollsLeft: nextRollsLeft,
            turnPhase: "roll",
            lastAction: `${state.myName} hodil(a) ${dice} ${DICE_FACES[dice]} (zbývá hodů: ${nextRollsLeft}).`
        });
        return;
    }

    const nextIdx = (currIdx + 1) % players.length;
    const nextPlayer = players[nextIdx];
    const nextPieces = toArr(latestData.pieces?.[nextPlayer.name]);
    const nextRolls = getInitialRolls(nextPieces);

    update(ref(db, `rooms/${state.roomId}/games/clovece`), {
        dice,
        currentTurnIndex: nextIdx,
        turnPhase: "roll",
        rollsLeft: nextRolls,
        lastAction: `${state.myName} hodil(a) ${dice} ${DICE_FACES[dice]} (žádný tah) — hází ${nextPlayer.name}.`
    });
}

function movePiece(pieceIdx) {
    if (!latestData || latestData.status !== "playing" || latestData.turnPhase !== "move") return;
    const players = toArr(latestData.players);
    const currIdx = latestData.currentTurnIndex || 0;
    const currentPlayer = players[currIdx];
    if (!currentPlayer || currentPlayer.name !== state.myName) return;

    const dice = latestData.dice;
    const myPieces = toArr(latestData.pieces?.[state.myName]);
    const valid = getValidPieceIndices(myPieces, dice);
    if (!valid.includes(pieceIdx)) return;

    const newPieces = {};
    for (const p of players) {
        newPieces[p.name] = [...toArr(latestData.pieces?.[p.name])];
    }

    const oldProg = newPieces[state.myName][pieceIdx];
    const newProg = oldProg === -1 ? 0 : oldProg + dice;
    newPieces[state.myName][pieceIdx] = newProg;

    let kickedName = null;
    if (newProg >= 0 && newProg <= 39) {
        const targetTrack = (START_OFFSET[currentPlayer.colorIdx] + newProg) % 40;
        for (const opp of players) {
            if (opp.name === state.myName) continue;
            const oppArr = newPieces[opp.name];
            for (let k = 0; k < oppArr.length; k++) {
                const oppProg = oppArr[k];
                if (oppProg >= 0 && oppProg <= 39) {
                    const oppTrack = (START_OFFSET[opp.colorIdx] + oppProg) % 40;
                    if (oppTrack === targetTrack) {
                        oppArr[k] = -1;
                        kickedName = opp.name;
                    }
                }
            }
        }
    }

    if (newPieces[state.myName].every(p => p >= 40)) {
        update(ref(db, `rooms/${state.roomId}/games/clovece`), {
            status: "finished",
            winner: state.myName,
            pieces: newPieces,
            lastAction: `🏆 ${state.myName} dostal(a) všechny figurky do domečku a vyhrává!`
        });
        return;
    }

    const kickSuffix = kickedName ? ` 💥 Vyhodil(a) figurku hráče ${kickedName}!` : "";

    if (dice === 6) {
        update(ref(db, `rooms/${state.roomId}/games/clovece`), {
            pieces: newPieces,
            turnPhase: "roll",
            rollsLeft: getInitialRolls(newPieces[state.myName]),
            lastAction: `${state.myName} hodil(a) 6 a hází znovu!${kickSuffix}`
        });
        return;
    }

    const nextIdx = (currIdx + 1) % players.length;
    const nextPlayer = players[nextIdx];
    const nextRolls = getInitialRolls(newPieces[nextPlayer.name]);

    update(ref(db, `rooms/${state.roomId}/games/clovece`), {
        pieces: newPieces,
        currentTurnIndex: nextIdx,
        turnPhase: "roll",
        rollsLeft: nextRolls,
        lastAction: `${state.myName} posunul(a) figurku o ${dice}.${kickSuffix} Hází ${nextPlayer.name}.`
    });
}

function skipTurn() {
    if (!state.isHost || !latestData || latestData.status !== "playing") return;
    const players = toArr(latestData.players);
    const currIdx = latestData.currentTurnIndex || 0;
    const nextIdx = (currIdx + 1) % players.length;
    const nextPlayer = players[nextIdx];
    const nextPieces = toArr(latestData.pieces?.[nextPlayer.name]);

    update(ref(db, `rooms/${state.roomId}/games/clovece`), {
        currentTurnIndex: nextIdx,
        turnPhase: "roll",
        rollsLeft: getInitialRolls(nextPieces),
        lastAction: `⏭️ Hostitel přeskočil tah hráče ${players[currIdx].name}. Hází ${nextPlayer.name}.`
    });
}

function getCoordKey(r, c) {
    return `${r}_${c}`;
}

function buildBoardHtml(data, validMoves, isMyTurn) {
    const players = toArr(data.players);
    const cellMeta = new Map();

    // Hlavní okruh
    TRACK.forEach(([r, c], idx) => {
        cellMeta.set(getCoordKey(r, c), { type: "track", trackIdx: idx });
    });

    // Startovní pole jednotlivých barev
    START_OFFSET.forEach((trackIdx, colorIdx) => {
        const [r, c] = TRACK[trackIdx];
        cellMeta.set(getCoordKey(r, c), { type: "start", colorIdx });
    });

    // Domečky (cílové dráhy)
    HOME_LANES.forEach((lane, colorIdx) => {
        lane.forEach(([r, c]) => {
            cellMeta.set(getCoordKey(r, c), { type: "home", colorIdx });
        });
    });

    // Základny
    BASES.forEach((base, colorIdx) => {
        base.forEach(([r, c]) => {
            cellMeta.set(getCoordKey(r, c), { type: "base", colorIdx });
        });
    });

    // Rozmístění figurek na souřadnice
    const piecesAtCoord = new Map();
    players.forEach(player => {
        const pArr = toArr(data.pieces?.[player.name]);
        pArr.forEach((prog, pieceIdx) => {
            let coord = null;
            if (prog === -1) {
                coord = BASES[player.colorIdx]?.[pieceIdx];
            } else if (prog >= 0 && prog <= 39) {
                const trackIdx = (START_OFFSET[player.colorIdx] + prog) % 40;
                coord = TRACK[trackIdx];
            } else if (prog >= 40 && prog <= 43) {
                coord = HOME_LANES[player.colorIdx]?.[prog - 40];
            }
            if (coord) {
                const key = getCoordKey(coord[0], coord[1]);
                if (!piecesAtCoord.has(key)) piecesAtCoord.set(key, []);
                piecesAtCoord.get(key).push({
                    playerName: player.name,
                    colorIdx: player.colorIdx,
                    pieceIdx
                });
            }
        });
    });

    let cellsHtml = "";
    for (let r = 0; r < 11; r++) {
        for (let c = 0; c < 11; c++) {
            const key = getCoordKey(r, c);
            const meta = cellMeta.get(key);
            let cellClass = "ludo-cell ludo-empty";
            let inner = "";

            if (r === 5 && c === 5) {
                cellClass = "ludo-cell ludo-center";
                inner = "🏆";
            } else if (meta) {
                if (meta.type === "track") {
                    cellClass = "ludo-cell ludo-track";
                } else if (meta.type === "start") {
                    cellClass = `ludo-cell ludo-track ludo-start-${COLORS[meta.colorIdx].key}`;
                    inner = `<span class="ludo-start-star">★</span>`;
                } else if (meta.type === "home") {
                    cellClass = `ludo-cell ludo-home-${COLORS[meta.colorIdx].key}`;
                } else if (meta.type === "base") {
                    cellClass = `ludo-cell ludo-base-${COLORS[meta.colorIdx].key}`;
                }
            }

            const occupants = piecesAtCoord.get(key) || [];
            if (occupants.length > 0) {
                inner = occupants.map(occ => {
                    const colorKey = COLORS[occ.colorIdx].key;
                    const canMove = isMyTurn && occ.playerName === state.myName && data.turnPhase === "move" && validMoves.includes(occ.pieceIdx);
                    if (canMove) {
                        return `<button class="ludo-piece piece-${colorKey} movable" data-piece-idx="${occ.pieceIdx}" title="Posunout figurku">${occ.pieceIdx + 1}</button>`;
                    }
                    return `<div class="ludo-piece piece-${colorKey}">${occ.pieceIdx + 1}</div>`;
                }).join("");
            }

            cellsHtml += `<div class="${cellClass}">${inner}</div>`;
        }
    }

    return `<div class="ludo-board">${cellsHtml}</div>`;
}

function renderWaiting(container) {
    container.innerHTML = `
        <div class="bomba-box">
            <h1>🎲 Člověče, nezlob se</h1>
            <p>Klasická deskovka pro 2–4 hráče (hráči nad limit 4 jsou diváci). Dostaň všechny 4 figurky do domečku jako první!</p>
            <p style="color: #9ca3af; font-size: 0.9rem;">
                Na nasazení z domečku potřebuješ <strong>6</strong> (máš až 3 pokusy, když nemůžeš táhnout). Šestka dává hod navíc!
            </p>
            ${state.isHost
                ? `<button id="btnStartClovece" class="btn-game" style="margin-top: 20px; background: #f97316;">🎲 Spustit Člověče</button>`
                : `<p class="pulse-text" style="margin-top: 20px;">Čeká se, až hostitel spustí hru...</p>`
            }
        </div>
    `;

    if (state.isHost) {
        document.getElementById("btnStartClovece").addEventListener("click", startNewGame);
    }
}

function renderPlaying(container, data) {
    const players = toArr(data.players);
    const currIdx = data.currentTurnIndex || 0;
    const currentPlayer = players[currIdx] || players[0];
    const isMyTurn = currentPlayer && currentPlayer.name === state.myName;
    const isPlaying = players.some(p => p.name === state.myName);

    const myPieces = toArr(data.pieces?.[state.myName]);
    const validMoves = isMyTurn && data.turnPhase === "move" ? getValidPieceIndices(myPieces, data.dice) : [];

    const badgesHtml = players.map(p => {
        const c = COLORS[p.colorIdx];
        const homeCount = toArr(data.pieces?.[p.name]).filter(pos => pos >= 40).length;
        const activeClass = currentPlayer && p.name === currentPlayer.name ? "active-turn" : "";
        return `
            <div class="card-player-chip ${activeClass}">
                <span>${c.emoji} ${p.name === state.myName ? "⭐ " + p.name : p.name}</span>
                <span class="card-count-badge">🏠 ${homeCount}/4</span>
            </div>
        `;
    }).join("");

    const boardHtml = buildBoardHtml(data, validMoves, isMyTurn);

    const diceValue = data.dice;
    const diceHtml = diceValue
        ? `<div class="ludo-dice-face">${DICE_FACES[diceValue]}</div><div style="font-size: 0.95rem; font-weight: 800;">Padla: ${diceValue}</div>`
        : `<div class="ludo-dice-face">🎲</div><div style="font-size: 0.85rem; color: #9ca3af;">Hoď kostkou</div>`;

    let actionAreaHtml = "";
    if (!isPlaying) {
        actionAreaHtml = `<div class="prsi-turn-status">👀 Jsi divák (hra je pro max. 4 hráče). Na řadě je ${currentPlayer?.name || ""}.</div>`;
    } else if (isMyTurn && data.turnPhase === "roll") {
        const rollsLeft = data.rollsLeft || 1;
        actionAreaHtml = `
            <button id="btnLudoRoll" class="btn-game" style="background: #f97316; margin: 10px 0;">
                🎲 HODIT KOSTKOU ${rollsLeft > 1 ? `(pokusů: ${rollsLeft})` : ""}
            </button>
        `;
    } else if (isMyTurn && data.turnPhase === "move") {
        actionAreaHtml = `
            <div class="prsi-turn-status my-turn-banner">
                ✨ Klikni na blikající figurku na plánu!
            </div>
            ${validMoves.length === 1 ? `
                <button id="btnLudoQuickMove" class="btn-game" style="background: #10b981; margin: 8px 0;">
                    ➡️ Posunout figurku č. ${validMoves[0] + 1}
                </button>
            ` : ""}
        `;
    } else {
        const c = COLORS[currentPlayer?.colorIdx || 0];
        actionAreaHtml = `
            <div class="prsi-turn-status">
                ⏳ Na řadě je: ${c.emoji} <strong>${currentPlayer?.name || ""}</strong>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="game-wide-box">
            <div class="card-players-strip">${badgesHtml}</div>

            <div class="prsi-action-ticker">${data.lastAction || ""}</div>

            ${boardHtml}

            <div class="ludo-controls-row">
                <div class="ludo-dice-box">${diceHtml}</div>
                <div style="flex: 1;">${actionAreaHtml}</div>
            </div>

            ${state.isHost ? `
                <div class="host-mini-controls">
                    <button id="btnLudoSkip" class="btn-small">⏭️ Přeskočit tah</button>
                    <button id="btnLudoRestart" class="btn-small">🔄 Nová hra</button>
                </div>
            ` : ""}
        </div>
    `;

    document.getElementById("btnLudoRoll")?.addEventListener("click", rollDice);
    document.getElementById("btnLudoQuickMove")?.addEventListener("click", () => {
        if (validMoves.length === 1) movePiece(validMoves[0]);
    });

    container.querySelectorAll(".ludo-piece.movable").forEach(btn => {
        btn.addEventListener("click", () => movePiece(Number(btn.getAttribute("data-piece-idx"))));
    });

    if (state.isHost) {
        document.getElementById("btnLudoSkip")?.addEventListener("click", skipTurn);
        document.getElementById("btnLudoRestart")?.addEventListener("click", startNewGame);
    }
}

function renderFinished(container, data) {
    const players = toArr(data.players);
    const boardHtml = buildBoardHtml(data, [], false);

    const rowsHtml = players.map(p => {
        const c = COLORS[p.colorIdx];
        const homeCount = toArr(data.pieces?.[p.name]).filter(pos => pos >= 40).length;
        return `
            <div class="quiz-leaderboard-row ${p.name === data.winner ? "me" : ""}">
                <div><strong>${p.name === data.winner ? "🏆 " : c.emoji + " "}${p.name}</strong></div>
                <div>${p.name === data.winner ? "Vítěz!" : `${homeCount}/4 v domečku`}</div>
            </div>
        `;
    }).join("");

    container.innerHTML = `
        <div class="game-wide-box">
            <h1 style="font-size: 3rem; margin: 0;">🏆</h1>
            <h2>Konec hry!</h2>
            <p style="font-size: 1.25rem;">Vyhrál(a): <strong style="color: #fbbf24;">${data.winner}</strong></p>
            ${boardHtml}
            <div class="quiz-leaderboard" style="margin: 14px 0;">${rowsHtml}</div>
            ${state.isHost
                ? `<button id="btnLudoAgain" class="btn-game" style="background: #f97316;">🔄 Hrát znovu</button>`
                : `<p class="pulse-text">Čeká se na hostitele...</p>`
            }
        </div>
    `;

    if (state.isHost) {
        document.getElementById("btnLudoAgain").addEventListener("click", startNewGame);
    }
}
