import { db, ref, set, onValue, update } from "../firebase-config.js?v=13";
import { state } from "../app.js?v=13";

const SUITS = {
    srdce: { key: "srdce", symbol: "♥️", name: "Srdce", color: "red" },
    kule: { key: "kule", symbol: "♦️", name: "Kára", color: "red" },
    listy: { key: "listy", symbol: "♠️", name: "Piky", color: "black" },
    zaludy: { key: "zaludy", symbol: "♣️", name: "Kříže", color: "black" }
};

const SUIT_KEYS = ["srdce", "kule", "listy", "zaludy"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_NAMES = {
    "2": "Dvojka",
    "3": "Trojka",
    "4": "Čtyřka",
    "5": "Pětka",
    "6": "Šestka",
    "7": "Sedma",
    "8": "Osma",
    "9": "Devítka",
    "10": "Desítka",
    "J": "Kluk",
    "Q": "Královna",
    "K": "Král",
    "A": "Eso"
};

let latestData = null;

const toArr = (v) => (Array.isArray(v) ? v : v ? Object.values(v) : []);

export function initPrsi() {
    const container = document.getElementById("prsi-content");
    if (!container) return;

    renderWaiting(container);

    const prsiRef = ref(db, `rooms/${state.roomId}/games/prsi`);
    onValue(prsiRef, (snapshot) => {
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

function createShuffledDeck(numPlayers) {
    const deckCount = numPlayers > 6 ? 2 : 1;
    const deck = [];
    for (let d = 0; d < deckCount; d++) {
        for (const suit of SUIT_KEYS) {
            for (const rank of RANKS) {
                deck.push({
                    id: `d${d}_${suit}_${rank}`,
                    suit,
                    rank
                });
            }
        }
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function startNewGame() {
    const playerOrder = state.players.length > 0 ? [...state.players] : [state.myName];
    const deck = createShuffledDeck(playerOrder.length);
    const hands = {};

    for (const p of playerOrder) {
        hands[p] = [];
        for (let i = 0; i < 4; i++) {
            if (deck.length > 0) hands[p].push(deck.pop());
        }
    }

    const topCard = deck.pop();
    const discard = topCard ? [topCard] : [];

    set(ref(db, `rooms/${state.roomId}/games/prsi`), {
        status: "playing",
        playerOrder,
        currentTurnIndex: 0,
        deck,
        discard,
        hands,
        activeSuit: topCard ? topCard.suit : "srdce",
        pendingDraw: 0,
        pendingSkip: false,
        choosingSuitBy: null,
        lastAction: `Hra začala! Na řadě je ${playerOrder[0]}.`,
        winner: null
    });
}

function replenishDeckIfEmpty(deck, discard) {
    if (deck.length === 0 && discard.length > 1) {
        const top = discard.pop();
        for (let j = discard.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [discard[j], discard[k]] = [discard[k], discard[j]];
        }
        deck.push(...discard);
        return { deck, discard: [top], reshuffled: true };
    }
    return { deck, discard, reshuffled: false };
}

function drawFromPiles(deckArr, discardArr, count) {
    let deck = [...deckArr];
    let discard = [...discardArr];
    const drawn = [];
    let reshuffled = false;

    for (let i = 0; i < count; i++) {
        const res = replenishDeckIfEmpty(deck, discard);
        deck = res.deck;
        discard = res.discard;
        if (res.reshuffled) reshuffled = true;

        if (deck.length === 0) break;
        drawn.push(deck.pop());

        // Pokud se právě dobrala poslední karta, rovnou zamícháme odhozené karty do nového balíčku
        const afterRes = replenishDeckIfEmpty(deck, discard);
        deck = afterRes.deck;
        discard = afterRes.discard;
        if (afterRes.reshuffled) reshuffled = true;
    }

    return { drawn, deck, discard, reshuffled };
}

function canPlayCard(card, data) {
    if (!card || !data || data.choosingSuitBy) return false;
    const discard = toArr(data.discard);
    const topCard = discard[discard.length - 1];
    if (!topCard) return true;

    if ((data.pendingDraw || 0) > 0) {
        return card.rank === "7";
    }
    if (data.pendingSkip) {
        return card.rank === "A";
    }

    return card.rank === "Q" || card.suit === data.activeSuit || card.rank === topCard.rank;
}

function playCard(cardId) {
    if (!latestData || latestData.status !== "playing") return;
    const playerOrder = toArr(latestData.playerOrder);
    const currentTurn = playerOrder[latestData.currentTurnIndex || 0];
    if (currentTurn !== state.myName || latestData.choosingSuitBy) return;

    const myHand = toArr(latestData.hands?.[state.myName]);
    const cardIdx = myHand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return;

    const card = myHand[cardIdx];
    if (!canPlayCard(card, latestData)) return;

    const newHand = myHand.filter((_, i) => i !== cardIdx);
    const newDiscard = [...toArr(latestData.discard), card];
    const suitInfo = SUITS[card.suit] || SUITS.srdce;
    const cardLabel = `${card.rank} ${suitInfo.symbol}`;

    if (newHand.length === 0) {
        update(ref(db, `rooms/${state.roomId}/games/prsi`), {
            status: "finished",
            winner: state.myName,
            [`hands/${state.myName}`]: [],
            discard: newDiscard,
            activeSuit: card.suit,
            choosingSuitBy: null,
            pendingDraw: 0,
            pendingSkip: false,
            lastAction: `🏆 ${state.myName} vynesl(a) poslední kartu (${cardLabel}) a vyhrál(a) Prší!`
        });
        return;
    }

    if (card.rank === "Q") {
        update(ref(db, `rooms/${state.roomId}/games/prsi`), {
            [`hands/${state.myName}`]: newHand,
            discard: newDiscard,
            activeSuit: card.suit,
            pendingDraw: 0,
            pendingSkip: false,
            choosingSuitBy: state.myName,
            lastAction: `${state.myName} vynesl(a) Královnu (Q) ${suitInfo.symbol} a vybírá znak...`
        });
        return;
    }

    const nextPendingDraw = card.rank === "7" ? (latestData.pendingDraw || 0) + 2 : 0;
    const nextPendingSkip = card.rank === "A";
    const nextTurnIndex = ((latestData.currentTurnIndex || 0) + 1) % playerOrder.length;

    let actionText = `${state.myName} vynesl(a) ${RANK_NAMES[card.rank] || card.rank} ${suitInfo.symbol}.`;
    if (nextPendingDraw > 0) {
        actionText = `${state.myName} hodil(a) Sedmu! Další hráč bere ${nextPendingDraw} nebo přebíjí 7.`;
    } else if (nextPendingSkip) {
        actionText = `${state.myName} hodil(a) Eso! Další hráč stojí nebo přebíjí Esem.`;
    }

    update(ref(db, `rooms/${state.roomId}/games/prsi`), {
        [`hands/${state.myName}`]: newHand,
        discard: newDiscard,
        activeSuit: card.suit,
        pendingDraw: nextPendingDraw,
        pendingSkip: nextPendingSkip,
        currentTurnIndex: nextTurnIndex,
        lastAction: actionText
    });
}

function chooseSuit(suitKey) {
    if (!latestData || latestData.status !== "playing") return;
    if (latestData.choosingSuitBy !== state.myName) return;

    const playerOrder = toArr(latestData.playerOrder);
    const nextTurnIndex = ((latestData.currentTurnIndex || 0) + 1) % playerOrder.length;
    const suitInfo = SUITS[suitKey] || SUITS.srdce;

    update(ref(db, `rooms/${state.roomId}/games/prsi`), {
        activeSuit: suitKey,
        choosingSuitBy: null,
        currentTurnIndex: nextTurnIndex,
        lastAction: `${state.myName} změnil(a) znak na ${suitInfo.symbol} ${suitInfo.name}.`
    });
}

function passOrDraw() {
    if (!latestData || latestData.status !== "playing") return;
    const playerOrder = toArr(latestData.playerOrder);
    const currentTurn = playerOrder[latestData.currentTurnIndex || 0];
    if (currentTurn !== state.myName || latestData.choosingSuitBy) return;

    const nextTurnIndex = ((latestData.currentTurnIndex || 0) + 1) % playerOrder.length;

    if (latestData.pendingSkip) {
        update(ref(db, `rooms/${state.roomId}/games/prsi`), {
            pendingSkip: false,
            currentTurnIndex: nextTurnIndex,
            lastAction: `${state.myName} stojí kolo.`
        });
        return;
    }

    const drawCount = (latestData.pendingDraw || 0) > 0 ? latestData.pendingDraw : 1;
    const { drawn, deck, discard, reshuffled } = drawFromPiles(
        toArr(latestData.deck),
        toArr(latestData.discard),
        drawCount
    );
    const myHand = [...toArr(latestData.hands?.[state.myName]), ...drawn];
    const reshuffleNote = reshuffled ? " (🔄 Odehrané karty byly zamíchány do nového balíčku!)" : "";

    update(ref(db, `rooms/${state.roomId}/games/prsi`), {
        [`hands/${state.myName}`]: myHand,
        deck,
        discard,
        pendingDraw: 0,
        currentTurnIndex: nextTurnIndex,
        lastAction: `${state.myName} si líznul(a) ${drawn.length} ${drawn.length === 1 ? "kartu" : drawn.length < 5 ? "karty" : "karet"}.${reshuffleNote}`
    });
}

function skipTurn() {
    if (!state.isHost || !latestData || latestData.status !== "playing") return;
    const playerOrder = toArr(latestData.playerOrder);
    const currentTurn = playerOrder[latestData.currentTurnIndex || 0];
    const nextTurnIndex = ((latestData.currentTurnIndex || 0) + 1) % playerOrder.length;

    update(ref(db, `rooms/${state.roomId}/games/prsi`), {
        choosingSuitBy: null,
        currentTurnIndex: nextTurnIndex,
        lastAction: `⏭️ Hostitel přeskočil tah hráče ${currentTurn}.`
    });
}

function renderWaiting(container) {
    container.innerHTML = `
        <div class="bomba-box">
            <h1>🃏 Prší</h1>
            <p>Klasická hospodská karetní hra (52 žolíkových karet: 2 až Eso). Zbav se všech karet v ruce jako první!</p>
            <p style="color: #9ca3af; font-size: 0.95rem;">
                <strong>7</strong> = +2 karty (lze přebít) • <strong>Eso</strong> = stojíš (lze přebít) • <strong>Královna (Q)</strong> = mění znak
            </p>
            ${state.isHost
                ? `<button id="btnStartPrsi" class="btn-game" style="margin-top: 20px; background: #dc2626;">🃏 Rozdat karty (Prší)</button>`
                : `<p class="pulse-text" style="margin-top: 20px;">Čeká se, až hostitel rozdá karty...</p>`
            }
        </div>
    `;

    if (state.isHost) {
        document.getElementById("btnStartPrsi").addEventListener("click", startNewGame);
    }
}

function renderPlaying(container, data) {
    const playerOrder = toArr(data.playerOrder);
    const currentTurn = playerOrder[data.currentTurnIndex || 0];
    const isMyTurn = currentTurn === state.myName;
    const isSpectator = !playerOrder.includes(state.myName);

    const deck = toArr(data.deck);
    const discard = toArr(data.discard);
    const topCard = discard[discard.length - 1];
    const activeSuit = SUITS[data.activeSuit] || SUITS.srdce;
    const myHand = toArr(data.hands?.[state.myName]);

    const playersStripHtml = playerOrder.map(p => {
        const count = toArr(data.hands?.[p]).length;
        const activeClass = p === currentTurn ? "active-turn" : "";
        return `
            <div class="card-player-chip ${activeClass}">
                <span>${p === state.myName ? "⭐ " + p : p}</span>
                <span class="card-count-badge">🃏 ${count}</span>
            </div>
        `;
    }).join("");

    let drawBtnText = "📥 Líznout 1";
    let drawBtnClass = "";
    if (data.pendingSkip) {
        drawBtnText = "⏸️ Stojím kolo";
        drawBtnClass = "penalty-btn";
    } else if ((data.pendingDraw || 0) > 0) {
        drawBtnText = `🔥 Vzít +${data.pendingDraw}`;
        drawBtnClass = "penalty-btn";
    }

    let alertBanner = "";
    if ((data.pendingDraw || 0) > 0) {
        alertBanner = `<div class="prsi-alert-banner">🔥 Ve hře je Sedma (+${data.pendingDraw} karet)! Přebij sedmou nebo si lízni.</div>`;
    } else if (data.pendingSkip) {
        alertBanner = `<div class="prsi-alert-banner">⏸️ Ve hře je Eso! Přebij Esem nebo stůj kolo.</div>`;
    }

    const topSuit = topCard ? (SUITS[topCard.suit] || SUITS.srdce) : activeSuit;
    const topCardHtml = topCard ? `
        <div class="prsi-card prsi-top-card ${topSuit.color === "red" ? "card-red" : "card-black"}">
            <div class="prsi-card-rank">${topCard.rank}</div>
            <div class="prsi-card-suit">${topSuit.symbol}</div>
        </div>
    ` : "";

    const suitPickerHtml = data.choosingSuitBy === state.myName ? `
        <div class="prsi-suit-picker">
            <div style="font-weight: 800; color: #fbbf24; margin-bottom: 10px;">Vyber nový znak:</div>
            <div class="prsi-suit-grid">
                ${SUIT_KEYS.map(key => {
                    const s = SUITS[key];
                    return `
                        <button class="prsi-suit-btn ${s.color === "red" ? "suit-red" : "suit-black"}" data-suit="${key}">
                            ${s.symbol} ${s.name}
                        </button>
                    `;
                }).join("")}
            </div>
        </div>
    ` : "";

    const handHtml = myHand.map(card => {
        const s = SUITS[card.suit] || SUITS.srdce;
        const playable = isMyTurn && canPlayCard(card, data);
        const stateClass = isMyTurn ? (playable ? "playable" : "unplayable") : "";
        return `
            <button class="prsi-card ${s.color === "red" ? "card-red" : "card-black"} ${stateClass}" data-card-id="${card.id}" ${!playable ? "disabled" : ""}>
                <div class="prsi-card-rank">${card.rank}</div>
                <div class="prsi-card-suit">${s.symbol}</div>
            </button>
        `;
    }).join("");

    container.innerHTML = `
        <div class="game-wide-box">
            <div class="card-players-strip">${playersStripHtml}</div>

            <div class="prsi-action-ticker">${data.lastAction || ""}</div>
            ${alertBanner}

            <div class="prsi-table-center">
                <div class="prsi-pile-col">
                    <button id="btnPrsiDraw" class="prsi-draw-pile ${drawBtnClass}" ${!isMyTurn || data.choosingSuitBy ? "disabled" : ""}>
                        <div style="font-size: 1.8rem;">🂠</div>
                        <div style="font-size: 0.9rem; font-weight: 800;">${drawBtnText}</div>
                        <div style="font-size: 0.75rem; opacity: 0.8;">(${deck.length})</div>
                    </button>
                </div>

                <div class="prsi-pile-col">
                    ${topCardHtml}
                    <div class="prsi-active-suit-badge">
                        Znak: <span class="${activeSuit.color === "red" ? "suit-text-red" : "suit-text-light"}">${activeSuit.symbol} ${activeSuit.name}</span>
                    </div>
                </div>
            </div>

            ${suitPickerHtml}

            ${!isSpectator ? `
                <div class="prsi-turn-status ${isMyTurn ? "my-turn-banner" : ""}">
                    ${data.choosingSuitBy
                        ? (data.choosingSuitBy === state.myName ? "🃏 Vyber nový znak výše!" : `🃏 ${data.choosingSuitBy} vybírá znak...`)
                        : (isMyTurn ? "🔥 Jsi na řadě! Vynes kartu nebo lízni." : `⏳ Na řadě je: ${currentTurn}`)
                    }
                </div>

                <div class="prsi-hand-area">
                    <div style="font-size: 0.85rem; color: #9ca3af; margin-bottom: 8px;">Tvoje karty (${myHand.length}):</div>
                    <div class="prsi-hand-grid">${handHtml}</div>
                </div>
            ` : `
                <div class="prsi-turn-status">👀 Jsi divák (hra už probíhá). Na řadě je ${currentTurn}.</div>
            `}

            ${state.isHost ? `
                <div class="host-mini-controls">
                    <button id="btnPrsiSkip" class="btn-small">⏭️ Přeskočit tah</button>
                    <button id="btnPrsiRestart" class="btn-small">🔄 Nová hra</button>
                </div>
            ` : ""}
        </div>
    `;

    const btnDraw = document.getElementById("btnPrsiDraw");
    if (btnDraw) btnDraw.addEventListener("click", passOrDraw);

    container.querySelectorAll(".prsi-suit-btn").forEach(btn => {
        btn.addEventListener("click", () => chooseSuit(btn.getAttribute("data-suit")));
    });

    container.querySelectorAll(".prsi-hand-grid .prsi-card.playable").forEach(btn => {
        btn.addEventListener("click", () => playCard(btn.getAttribute("data-card-id")));
    });

    if (state.isHost) {
        document.getElementById("btnPrsiSkip")?.addEventListener("click", skipTurn);
        document.getElementById("btnPrsiRestart")?.addEventListener("click", startNewGame);
    }
}

function renderFinished(container, data) {
    const playerOrder = toArr(data.playerOrder);
    const standings = playerOrder
        .map(p => ({ name: p, count: toArr(data.hands?.[p]).length }))
        .sort((a, b) => a.count - b.count);

    const rowsHtml = standings.map((p, idx) => `
        <div class="quiz-leaderboard-row ${p.name === data.winner ? "me" : ""}">
            <div><strong>${idx === 0 ? "🏆 " : `${idx + 1}. `}${p.name}</strong></div>
            <div>${p.count === 0 ? "Vyhrál(a)!" : `${p.count} karet`}</div>
        </div>
    `).join("");

    container.innerHTML = `
        <div class="bomba-box">
            <h1 style="font-size: 3.5rem; margin: 0;">🏆</h1>
            <h2>Konec hry Prší!</h2>
            <p style="font-size: 1.3rem;">Vítěz: <strong style="color: #fbbf24;">${data.winner}</strong></p>
            <div class="quiz-leaderboard" style="margin: 16px 0;">${rowsHtml}</div>
            ${state.isHost
                ? `<button id="btnPrsiPlayAgain" class="btn-game" style="background: #dc2626;">🔄 Hrát znovu</button>`
                : `<p class="pulse-text">Čeká se na hostitele pro novou hru...</p>`
            }
        </div>
    `;

    if (state.isHost) {
        document.getElementById("btnPrsiPlayAgain").addEventListener("click", startNewGame);
    }
}
