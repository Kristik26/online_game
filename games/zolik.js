import { db, ref, set, onValue, update } from "../firebase-config.js?v=8";
import { state } from "../app.js?v=8";

const SUITS = {
    H: { key: "H", symbol: "♥️", color: "red", order: 0 },
    D: { key: "D", symbol: "♦️", color: "red", order: 1 },
    S: { key: "S", symbol: "♠️", color: "black", order: 2 },
    C: { key: "C", symbol: "♣️", color: "black", order: 3 }
};

const SUIT_KEYS = ["H", "D", "S", "C"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_ORDER = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
    "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14, "JOKER": 99
};

let latestData = null;
let selectedIds = new Set();
let stagedMelds = [];
let handSortMode = "suit";
let lastTurnKey = "";
let uiError = "";

const toArr = (v) => (Array.isArray(v) ? v : v ? Object.values(v) : []);

export function initZolik() {
    const container = document.getElementById("zolik-content");
    if (!container) return;

    renderWaiting(container);

    const zolikRef = ref(db, `rooms/${state.roomId}/games/zolik`);
    onValue(zolikRef, (snapshot) => {
        const data = snapshot.val();
        latestData = data;

        if (!data || data.status === "waiting") {
            selectedIds.clear();
            stagedMelds = [];
            lastTurnKey = "";
            uiError = "";
            renderWaiting(container);
            return;
        }

        const turnKey = `${data.status}_${data.currentTurnIndex}_${data.turnPhase}`;
        if (turnKey !== lastTurnKey) {
            selectedIds.clear();
            stagedMelds = [];
            uiError = "";
            lastTurnKey = turnKey;
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

function createDeck108() {
    const deck = [];
    for (let d = 0; d < 2; d++) {
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
    for (let j = 1; j <= 4; j++) {
        deck.push({
            id: `joker_${j}`,
            suit: "joker",
            rank: "JOKER"
        });
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const k = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[k]] = [deck[k], deck[i]];
    }
    return deck;
}

function startNewGame(openLimit = 42) {
    const allPlayers = state.players.length > 0 ? [...state.players] : [state.myName];
    const playerOrder = allPlayers.slice(0, 6);
    const deck = createDeck108();
    const hands = {};
    const opened = {};

    for (const p of playerOrder) {
        hands[p] = [];
        opened[p] = false;
        for (let i = 0; i < 12; i++) {
            if (deck.length > 0) hands[p].push(deck.pop());
        }
    }

    const firstDiscard = deck.pop();
    const discard = firstDiscard ? [firstDiscard] : [];

    set(ref(db, `rooms/${state.roomId}/games/zolik`), {
        status: "playing",
        openLimit,
        playerOrder,
        currentTurnIndex: 0,
        turnPhase: "draw",
        deck,
        discard,
        hands,
        opened,
        tableMelds: [],
        lastAction: `Hra začala! ${playerOrder[0]} si líže kartu.`,
        winner: null,
        penalties: {}
    });
}

// --- VALIDACE SKUPIN (POSTUPKY A TROJICE/ČTVEŘICE) ---

function getCardPoints(rank, aceAsOne = false) {
    if (rank === "JOKER") return 20;
    if (rank === "A") return aceAsOne ? 1 : 11;
    if (rank === "J" || rank === "Q" || rank === "K") return 10;
    return Number(rank) || 0;
}

function rankToNum(rank, aceHigh) {
    if (rank === "A") return aceHigh ? 14 : 1;
    if (rank === "J") return 11;
    if (rank === "Q") return 12;
    if (rank === "K") return 13;
    return Number(rank);
}

function numToRank(n) {
    if (n === 1 || n === 14) return "A";
    if (n === 11) return "J";
    if (n === 12) return "Q";
    if (n === 13) return "K";
    return String(n);
}

function validateSet(reals, jokers) {
    const total = reals.length + jokers.length;
    if (total < 3 || total > 4) return null;

    const targetRank = reals[0].rank;
    if (!reals.every(c => c.rank === targetRank)) return null;

    const usedSuits = new Set(reals.map(c => c.suit));
    if (usedSuits.size !== reals.length) return null;

    const missingSuits = SUIT_KEYS.filter(s => !usedSuits.has(s));
    if (missingSuits.length < jokers.length) return null;

    const annotatedJokers = jokers.map((jk, idx) => ({
        id: jk.id,
        suit: "joker",
        rank: "JOKER",
        represents: { suit: missingSuits[idx], rank: targetRank }
    }));

    const cleanReals = reals.map(c => ({ id: c.id, suit: c.suit, rank: c.rank }));
    const points = getCardPoints(targetRank) * total;

    return {
        valid: true,
        type: "set",
        points,
        cards: [...cleanReals, ...annotatedJokers]
    };
}

function validateRun(reals, jokers) {
    const runSuit = reals[0].suit;
    if (!reals.every(c => c.suit === runSuit)) return null;

    const usedRanks = new Set(reals.map(c => c.rank));
    if (usedRanks.size !== reals.length) return null;

    function tryOrder(aceHigh) {
        const minBound = aceHigh ? 2 : 1;
        const maxBound = aceHigh ? 14 : 13;

        const mapped = reals
            .map(c => ({ card: c, num: rankToNum(c.rank, aceHigh) }))
            .sort((a, b) => a.num - b.num);

        const nums = mapped.map(m => m.num);
        let internalGaps = 0;
        for (let i = 0; i < nums.length - 1; i++) {
            internalGaps += nums[i + 1] - nums[i] - 1;
        }
        if (internalGaps > jokers.length) return null;

        const extra = jokers.length - internalGaps;
        const highAdd = Math.min(extra, maxBound - nums[nums.length - 1]);
        const lowAdd = extra - highAdd;

        if (nums[0] - lowAdd < minBound) return null;

        const startNum = nums[0] - lowAdd;
        const endNum = nums[nums.length - 1] + highAdd;

        const ordered = [];
        let jokerCursor = 0;
        let points = 0;

        for (let n = startNum; n <= endNum; n++) {
            const realMatch = mapped.find(m => m.num === n);
            if (realMatch) {
                ordered.push({
                    id: realMatch.card.id,
                    suit: realMatch.card.suit,
                    rank: realMatch.card.rank
                });
            } else {
                const jk = jokers[jokerCursor++];
                ordered.push({
                    id: jk.id,
                    suit: "joker",
                    rank: "JOKER",
                    represents: { suit: runSuit, rank: numToRank(n) }
                });
            }
            points += n === 1 ? 1 : n === 14 ? 11 : n >= 10 ? 10 : n;
        }

        return {
            valid: true,
            type: "run",
            points,
            cards: ordered
        };
    }

    return tryOrder(true) || tryOrder(false);
}

function validateMeld(cards) {
    if (!cards || cards.length < 3) return { valid: false };
    const jokers = cards.filter(c => c.rank === "JOKER");
    const reals = cards.filter(c => c.rank !== "JOKER");
    if (reals.length < 2) return { valid: false };

    const asSet = validateSet(reals, jokers);
    if (asSet) return asSet;

    const asRun = validateRun(reals, jokers);
    if (asRun) return asRun;

    return { valid: false };
}

// --- HERNÍ AKCE ---

function drawFromDeck() {
    if (!latestData || latestData.status !== "playing" || latestData.turnPhase !== "draw") return;
    const playerOrder = toArr(latestData.playerOrder);
    if (playerOrder[latestData.currentTurnIndex || 0] !== state.myName) return;

    const deck = [...toArr(latestData.deck)];
    let discard = [...toArr(latestData.discard)];

    if (deck.length === 0 && discard.length > 1) {
        const top = discard.pop();
        for (let i = discard.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [discard[i], discard[j]] = [discard[j], discard[i]];
        }
        deck.push(...discard);
        discard = [top];
    }

    if (deck.length === 0) return;

    const card = deck.pop();
    const newHand = [...toArr(latestData.hands?.[state.myName]), card];

    update(ref(db, `rooms/${state.roomId}/games/zolik`), {
        deck,
        discard,
        [`hands/${state.myName}`]: newHand,
        turnPhase: "play",
        lastAction: `${state.myName} si líznul(a) kartu z balíčku.`
    });
}

function drawFromDiscard() {
    if (!latestData || latestData.status !== "playing" || latestData.turnPhase !== "draw") return;
    const playerOrder = toArr(latestData.playerOrder);
    if (playerOrder[latestData.currentTurnIndex || 0] !== state.myName) return;

    const discard = [...toArr(latestData.discard)];
    if (discard.length === 0) return;

    const card = discard.pop();
    const newHand = [...toArr(latestData.hands?.[state.myName]), card];

    update(ref(db, `rooms/${state.roomId}/games/zolik`), {
        discard,
        [`hands/${state.myName}`]: newHand,
        turnPhase: "play",
        lastAction: `${state.myName} si vzal(a) kartu z odhazovacího balíčku.`
    });
}

function finishGame(winnerName, updatedHands, extraUpdates = {}) {
    const playerOrder = toArr(latestData.playerOrder);
    const penalties = {};
    for (const p of playerOrder) {
        const h = toArr(updatedHands[p]);
        penalties[p] = p === winnerName ? 0 : h.reduce((sum, c) => sum + getCardPoints(c.rank), 0);
    }

    update(ref(db, `rooms/${state.roomId}/games/zolik`), {
        ...extraUpdates,
        status: "finished",
        winner: winnerName,
        hands: updatedHands,
        penalties,
        lastAction: `🏆 ${winnerName} zavřel(a) hru a vyhrává Žolíka!`
    });
}

function getEffectiveHand() {
    const serverHand = toArr(latestData?.hands?.[state.myName]);
    const stagedIds = new Set(stagedMelds.flatMap(m => m.cards.map(c => c.id)));
    return serverHand.filter(c => !stagedIds.has(c.id));
}

function handleMeldSelected(container) {
    if (!latestData || latestData.status !== "playing" || latestData.turnPhase !== "play") return;
    const effectiveHand = getEffectiveHand();
    const selectedCards = effectiveHand.filter(c => selectedIds.has(c.id));
    const res = validateMeld(selectedCards);

    if (!res.valid) {
        uiError = "Neplatná skupina! Potřebuješ postupku stejné barvy nebo trojici/čtveřici stejné hodnoty (min. 2 pravé karty).";
        renderPlaying(container, latestData);
        return;
    }

    uiError = "";
    const hasOpened = Boolean(latestData.opened?.[state.myName]) || (latestData.openLimit || 0) === 0;

    if (hasOpened) {
        const newHand = effectiveHand.filter(c => !selectedIds.has(c.id));
        const newMelds = [
            ...toArr(latestData.tableMelds),
            {
                id: `m_${Date.now()}`,
                type: res.type,
                owner: state.myName,
                cards: res.cards
            }
        ];
        selectedIds.clear();

        if (newHand.length === 0) {
            const allHands = { ...(latestData.hands || {}), [state.myName]: [] };
            finishGame(state.myName, allHands, { tableMelds: newMelds });
            return;
        }

        update(ref(db, `rooms/${state.roomId}/games/zolik`), {
            [`hands/${state.myName}`]: newHand,
            tableMelds: newMelds,
            lastAction: `${state.myName} vyložil(a) novou skupinu (${res.points} b.).`
        });
    } else {
        stagedMelds.push({ type: res.type, points: res.points, cards: res.cards });
        selectedIds.clear();
        renderPlaying(container, latestData);
    }
}

function commitStagedMelds() {
    if (!latestData || stagedMelds.length === 0) return;
    const totalPts = stagedMelds.reduce((s, m) => s + m.points, 0);
    const limit = latestData.openLimit ?? 42;
    if (totalPts < limit) return;

    const newHand = getEffectiveHand();
    const newMelds = [
        ...toArr(latestData.tableMelds),
        ...stagedMelds.map((m, idx) => ({
            id: `m_${Date.now()}_${idx}`,
            type: m.type,
            owner: state.myName,
            cards: m.cards
        }))
    ];

    stagedMelds = [];
    selectedIds.clear();

    if (newHand.length === 0) {
        const allHands = { ...(latestData.hands || {}), [state.myName]: [] };
        finishGame(state.myName, allHands, {
            tableMelds: newMelds,
            [`opened/${state.myName}`]: true
        });
        return;
    }

    update(ref(db, `rooms/${state.roomId}/games/zolik`), {
        [`hands/${state.myName}`]: newHand,
        [`opened/${state.myName}`]: true,
        tableMelds: newMelds,
        lastAction: `${state.myName} otevřel(a) hru s ${totalPts} body!`
    });
}

function addToTableMeld(meldIndex, container) {
    if (!latestData || latestData.status !== "playing" || latestData.turnPhase !== "play") return;
    const hasOpened = Boolean(latestData.opened?.[state.myName]) || (latestData.openLimit || 0) === 0;
    if (!hasOpened || selectedIds.size === 0) return;

    const hand = toArr(latestData.hands?.[state.myName]);
    const selectedCards = hand.filter(c => selectedIds.has(c.id));
    const tableMelds = toArr(latestData.tableMelds).map(m => ({ ...m, cards: toArr(m.cards) }));
    const targetMeld = tableMelds[meldIndex];
    if (!targetMeld) return;

    const combined = [...targetMeld.cards, ...selectedCards];
    const res = validateMeld(combined);

    if (!res.valid) {
        uiError = "Vybrané karty nejdou přiložit k této skupině!";
        renderPlaying(container, latestData);
        return;
    }

    uiError = "";
    tableMelds[meldIndex] = { ...targetMeld, type: res.type, cards: res.cards };
    const newHand = hand.filter(c => !selectedIds.has(c.id));
    selectedIds.clear();

    if (newHand.length === 0) {
        const allHands = { ...(latestData.hands || {}), [state.myName]: [] };
        finishGame(state.myName, allHands, { tableMelds });
        return;
    }

    update(ref(db, `rooms/${state.roomId}/games/zolik`), {
        [`hands/${state.myName}`]: newHand,
        tableMelds,
        lastAction: `${state.myName} přiložil(a) ${selectedCards.length} ${selectedCards.length === 1 ? "kartu" : "karty"} na stůl.`
    });
}

function swapJokerOnMeld(meldIndex, container) {
    if (!latestData || latestData.status !== "playing" || latestData.turnPhase !== "play") return;
    const hasOpened = Boolean(latestData.opened?.[state.myName]) || (latestData.openLimit || 0) === 0;
    if (!hasOpened || selectedIds.size !== 1) return;

    const hand = toArr(latestData.hands?.[state.myName]);
    const selCard = hand.find(c => selectedIds.has(c.id));
    if (!selCard || selCard.rank === "JOKER") return;

    const tableMelds = toArr(latestData.tableMelds).map(m => ({ ...m, cards: toArr(m.cards) }));
    const targetMeld = tableMelds[meldIndex];
    if (!targetMeld) return;

    const jokerIdx = targetMeld.cards.findIndex(
        c => c.rank === "JOKER" && c.represents && c.represents.suit === selCard.suit && c.represents.rank === selCard.rank
    );
    if (jokerIdx === -1) {
        uiError = "Tahle karta nenahrazuje žádného žolíka v této skupině.";
        renderPlaying(container, latestData);
        return;
    }

    uiError = "";
    const takenJoker = targetMeld.cards[jokerIdx];
    const updatedCards = [...targetMeld.cards];
    updatedCards[jokerIdx] = { id: selCard.id, suit: selCard.suit, rank: selCard.rank };
    tableMelds[meldIndex] = { ...targetMeld, cards: updatedCards };

    const newHand = hand.filter(c => c.id !== selCard.id);
    newHand.push({ id: takenJoker.id, suit: "joker", rank: "JOKER" });
    selectedIds.clear();

    update(ref(db, `rooms/${state.roomId}/games/zolik`), {
        [`hands/${state.myName}`]: newHand,
        tableMelds,
        lastAction: `🃏 ${state.myName} vyměnil(a) žolíka ze stolu!`
    });
}

function discardSelected() {
    if (!latestData || latestData.status !== "playing" || latestData.turnPhase !== "play") return;
    if (selectedIds.size !== 1 || stagedMelds.length > 0) return;

    const playerOrder = toArr(latestData.playerOrder);
    if (playerOrder[latestData.currentTurnIndex || 0] !== state.myName) return;

    const hand = toArr(latestData.hands?.[state.myName]);
    const selCard = hand.find(c => selectedIds.has(c.id));
    if (!selCard) return;

    const newHand = hand.filter(c => c.id !== selCard.id);
    const newDiscard = [...toArr(latestData.discard), selCard];
    selectedIds.clear();

    if (newHand.length === 0) {
        const allHands = { ...(latestData.hands || {}), [state.myName]: [] };
        finishGame(state.myName, allHands, { discard: newDiscard });
        return;
    }

    const nextTurnIndex = ((latestData.currentTurnIndex || 0) + 1) % playerOrder.length;
    const suitSym = selCard.rank === "JOKER" ? "🃏" : (SUITS[selCard.suit]?.symbol || "");

    update(ref(db, `rooms/${state.roomId}/games/zolik`), {
        [`hands/${state.myName}`]: newHand,
        discard: newDiscard,
        currentTurnIndex: nextTurnIndex,
        turnPhase: "draw",
        lastAction: `${state.myName} odhodil(a) ${selCard.rank === "JOKER" ? "Žolíka" : selCard.rank + " " + suitSym}. Hraje ${playerOrder[nextTurnIndex]}.`
    });
}

function skipTurn() {
    if (!state.isHost || !latestData || latestData.status !== "playing") return;
    const playerOrder = toArr(latestData.playerOrder);
    const currentTurn = playerOrder[latestData.currentTurnIndex || 0];
    const nextTurnIndex = ((latestData.currentTurnIndex || 0) + 1) % playerOrder.length;

    update(ref(db, `rooms/${state.roomId}/games/zolik`), {
        currentTurnIndex: nextTurnIndex,
        turnPhase: "draw",
        lastAction: `⏭️ Hostitel přeskočil tah hráče ${currentTurn}.`
    });
}

// --- VYKRESLOVÁNÍ UI ---

function renderCardHtml(card, extraClass = "") {
    if (card.rank === "JOKER") {
        const repHtml = card.represents
            ? `<div class="zolik-joker-rep">${card.represents.rank}${SUITS[card.represents.suit]?.symbol || ""}</div>`
            : "";
        return `
            <div class="zolik-card card-joker ${extraClass}">
                <div class="zolik-card-rank">🃏</div>
                <div class="zolik-card-suit" style="font-size: 0.65rem;">JOKER</div>
                ${repHtml}
            </div>
        `;
    }
    const s = SUITS[card.suit] || SUITS.H;
    return `
        <div class="zolik-card ${s.color === "red" ? "card-red" : "card-black"} ${extraClass}">
            <div class="zolik-card-rank">${card.rank}</div>
            <div class="zolik-card-suit">${s.symbol}</div>
        </div>
    `;
}

function sortHand(cards) {
    const copy = [...cards];
    if (handSortMode === "suit") {
        copy.sort((a, b) => {
            const sa = a.suit === "joker" ? 99 : (SUITS[a.suit]?.order ?? 9);
            const sb = b.suit === "joker" ? 99 : (SUITS[b.suit]?.order ?? 9);
            if (sa !== sb) return sa - sb;
            return (RANK_ORDER[a.rank] || 0) - (RANK_ORDER[b.rank] || 0);
        });
    } else {
        copy.sort((a, b) => {
            const ra = RANK_ORDER[a.rank] || 0;
            const rb = RANK_ORDER[b.rank] || 0;
            if (ra !== rb) return ra - rb;
            const sa = a.suit === "joker" ? 99 : (SUITS[a.suit]?.order ?? 9);
            const sb = b.suit === "joker" ? 99 : (SUITS[b.suit]?.order ?? 9);
            return sa - sb;
        });
    }
    return copy;
}

function renderWaiting(container) {
    container.innerHTML = `
        <div class="bomba-box">
            <h1>🃏 Žolík</h1>
            <p>Klasický Žolík (2 balíčky, 108 karet). Skládej postupky a trojice/čtveřice a vyprázdni ruku jako první!</p>
            <p style="color: #9ca3af; font-size: 0.9rem;">Podporuje až 6 hráčů v místnosti.</p>
            ${state.isHost ? `
                <div style="margin-top: 18px; display: flex; flex-direction: column; gap: 10px; align-items: center;">
                    <button id="btnStartZolik42" class="btn-game" style="background: #0d9488; margin: 0;">
                        🃏 Klasický Žolík (od 42 bodů)
                    </button>
                    <button id="btnStartZolik0" class="btn-game" style="background: #0284c7; margin: 0;">
                        ⚡ Rychlý Žolík (bez limitu)
                    </button>
                </div>
            ` : `
                <p class="pulse-text" style="margin-top: 20px;">Čeká se, až hostitel spustí Žolíka...</p>
            `}
        </div>
    `;

    if (state.isHost) {
        document.getElementById("btnStartZolik42").addEventListener("click", () => startNewGame(42));
        document.getElementById("btnStartZolik0").addEventListener("click", () => startNewGame(0));
    }
}

function renderPlaying(container, data) {
    const playerOrder = toArr(data.playerOrder);
    const currentTurn = playerOrder[data.currentTurnIndex || 0];
    const isMyTurn = currentTurn === state.myName;
    const isSpectator = !playerOrder.includes(state.myName);
    const hasOpened = Boolean(data.opened?.[state.myName]) || (data.openLimit || 0) === 0;

    const deck = toArr(data.deck);
    const discard = toArr(data.discard);
    const topDiscard = discard[discard.length - 1];
    const tableMelds = toArr(data.tableMelds);

    const playersStripHtml = playerOrder.map(p => {
        const count = toArr(data.hands?.[p]).length;
        const pOpened = Boolean(data.opened?.[p]) || (data.openLimit || 0) === 0;
        return `
            <div class="card-player-chip ${p === currentTurn ? "active-turn" : ""}">
                <span>${p === state.myName ? "⭐ " + p : p}</span>
                <span class="card-count-badge">${pOpened ? "✓" : "🔒"} ${count}</span>
            </div>
        `;
    }).join("");

    const canDraw = isMyTurn && data.turnPhase === "draw";
    const canPlay = isMyTurn && data.turnPhase === "play";

    const effectiveHand = sortHand(getEffectiveHand());
    const selectedCards = effectiveHand.filter(c => selectedIds.has(c.id));
    const singleSel = selectedCards.length === 1 ? selectedCards[0] : null;

    // Staged melds box (42-pt mode before opening)
    const stagedPoints = stagedMelds.reduce((s, m) => s + m.points, 0);
    const openLimit = data.openLimit ?? 42;
    const stagingHtml = stagedMelds.length > 0 ? `
        <div class="zolik-staging-box">
            <div style="font-size: 0.9rem; font-weight: 800; color: #fbbf24;">
                Příprava vyložení: ${stagedPoints} / ${openLimit} bodů
            </div>
            <div class="zolik-melds-grid" style="margin: 8px 0;">
                ${stagedMelds.map(m => `
                    <div class="zolik-meld-group">
                        ${m.cards.map(c => renderCardHtml(c, "mini")).join("")}
                        <span style="font-size: 0.75rem; color: #9ca3af; align-self: center;">(${m.points}b)</span>
                    </div>
                `).join("")}
            </div>
            <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                <button id="btnZolikCancelStage" class="btn-small" style="background: #7f1d1d;">↩️ Zrušit</button>
                <button id="btnZolikCommitStage" class="btn-small" style="background: #10b981;" ${stagedPoints < openLimit ? "disabled" : ""}>
                    ✅ Vyložit na stůl (${stagedPoints} b.)
                </button>
            </div>
        </div>
    ` : "";

    // Table melds
    const meldsHtml = tableMelds.length > 0 ? tableMelds.map((meld, idx) => {
        const cards = toArr(meld.cards);
        const canLayOff = canPlay && hasOpened && selectedCards.length >= 1;
        const canSwapJoker = canPlay && hasOpened && singleSel && singleSel.rank !== "JOKER" &&
            cards.some(c => c.rank === "JOKER" && c.represents && c.represents.suit === singleSel.suit && c.represents.rank === singleSel.rank);

        return `
            <div class="zolik-meld-group">
                ${cards.map(c => renderCardHtml(c, "mini")).join("")}
                ${canLayOff ? `<button class="btn-meld-action" data-layoff="${idx}">+ Přiložit</button>` : ""}
                ${canSwapJoker ? `<button class="btn-meld-action swap" data-swap="${idx}">🃏 Vzít žolíka</button>` : ""}
            </div>
        `;
    }).join("") : `<div style="color: #6b7280; font-size: 0.9rem;">Na stole zatím nejsou žádné vyložené skupiny.</div>`;

    const handHtml = effectiveHand.map(c => {
        const isSel = selectedIds.has(c.id);
        return `
            <button class="zolik-hand-btn ${isSel ? "selected" : ""}" data-card-id="${c.id}">
                ${renderCardHtml(c, isSel ? "selected" : "")}
            </button>
        `;
    }).join("");

    container.innerHTML = `
        <div class="game-wide-box">
            <div class="card-players-strip">${playersStripHtml}</div>

            <div class="prsi-action-ticker">${data.lastAction || ""}</div>
            ${uiError ? `<div class="prsi-alert-banner">${uiError}</div>` : ""}

            <div class="prsi-table-center" style="margin: 10px 0;">
                <button id="btnZolikDrawDeck" class="prsi-draw-pile" ${!canDraw ? "disabled" : ""}>
                    <div style="font-size: 1.6rem;">🂠</div>
                    <div style="font-size: 0.85rem; font-weight: 800;">Líznout</div>
                    <div style="font-size: 0.75rem; opacity: 0.8;">(${deck.length})</div>
                </button>

                <button id="btnZolikDrawDiscard" class="zolik-discard-btn" ${!canDraw || !topDiscard ? "disabled" : ""}>
                    ${topDiscard ? renderCardHtml(topDiscard) : `<div class="zolik-card empty">Prázdný</div>`}
                    <div style="font-size: 0.75rem; color: #d1d5db; margin-top: 4px;">${canDraw && topDiscard ? "♻️ Vzít odhoz" : "Odhoz"}</div>
                </button>
            </div>

            <div class="zolik-table-melds">
                <div style="font-size: 0.8rem; color: #9ca3af; margin-bottom: 6px; text-align: left;">Vyložené skupiny na stole:</div>
                <div class="zolik-melds-grid">${meldsHtml}</div>
            </div>

            ${stagingHtml}

            ${!isSpectator ? `
                <div class="prsi-turn-status ${isMyTurn ? "my-turn-banner" : ""}">
                    ${isMyTurn
                        ? (data.turnPhase === "draw"
                            ? "📥 Jsi na řadě: lízni si kartu z balíčku nebo z odhozu!"
                            : `🔥 Fáze hraní: vykládej skupiny nebo označ 1 kartu a odhoď ji.${!hasOpened ? ` (První vyložení min. ${openLimit} b.)` : ""}`)
                        : `⏳ Na řadě je: ${currentTurn}`
                    }
                </div>

                ${canPlay ? `
                    <div class="zolik-action-bar">
                        <button id="btnZolikMeld" class="btn-small" style="background: #0d9488;" ${selectedCards.length < 3 ? "disabled" : ""}>
                            ✨ Vyložit (${selectedCards.length})
                        </button>
                        <button id="btnZolikDiscard" class="btn-small" style="background: #dc2626;" ${selectedCards.length !== 1 || stagedMelds.length > 0 ? "disabled" : ""}>
                            🗑️ Odhodit kartu
                        </button>
                    </div>
                ` : ""}

                <div class="prsi-hand-area">
                    <div class="zolik-hand-header">
                        <span>Tvoje ruka (${effectiveHand.length}):</span>
                        <div style="display: flex; gap: 6px;">
                            <button id="btnSortSuit" class="btn-sort ${handSortMode === "suit" ? "active" : ""}">🎨 Barvy</button>
                            <button id="btnSortRank" class="btn-sort ${handSortMode === "rank" ? "active" : ""}">🔢 Hodnoty</button>
                        </div>
                    </div>
                    <div class="zolik-hand-grid">${handHtml}</div>
                </div>
            ` : `
                <div class="prsi-turn-status">👀 Jsi divák (hra už probíhá). Na řadě je ${currentTurn}.</div>
            `}

            ${state.isHost ? `
                <div class="host-mini-controls">
                    <button id="btnZolikSkip" class="btn-small">⏭️ Přeskočit tah</button>
                    <button id="btnZolikRestart42" class="btn-small">🔄 Nová (42b)</button>
                    <button id="btnZolikRestart0" class="btn-small">⚡ Nová (0b)</button>
                </div>
            ` : ""}
        </div>
    `;

    document.getElementById("btnZolikDrawDeck")?.addEventListener("click", drawFromDeck);
    document.getElementById("btnZolikDrawDiscard")?.addEventListener("click", drawFromDiscard);
    document.getElementById("btnZolikMeld")?.addEventListener("click", () => handleMeldSelected(container));
    document.getElementById("btnZolikDiscard")?.addEventListener("click", discardSelected);
    document.getElementById("btnZolikCancelStage")?.addEventListener("click", () => {
        stagedMelds = [];
        selectedIds.clear();
        uiError = "";
        renderPlaying(container, latestData);
    });
    document.getElementById("btnZolikCommitStage")?.addEventListener("click", commitStagedMelds);

    document.getElementById("btnSortSuit")?.addEventListener("click", () => {
        handSortMode = "suit";
        renderPlaying(container, latestData);
    });
    document.getElementById("btnSortRank")?.addEventListener("click", () => {
        handSortMode = "rank";
        renderPlaying(container, latestData);
    });

    container.querySelectorAll(".zolik-hand-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-card-id");
            if (selectedIds.has(id)) selectedIds.delete(id);
            else selectedIds.add(id);
            uiError = "";
            renderPlaying(container, latestData);
        });
    });

    container.querySelectorAll("[data-layoff]").forEach(btn => {
        btn.addEventListener("click", () => addToTableMeld(Number(btn.getAttribute("data-layoff")), container));
    });

    container.querySelectorAll("[data-swap]").forEach(btn => {
        btn.addEventListener("click", () => swapJokerOnMeld(Number(btn.getAttribute("data-swap")), container));
    });

    if (state.isHost) {
        document.getElementById("btnZolikSkip")?.addEventListener("click", skipTurn);
        document.getElementById("btnZolikRestart42")?.addEventListener("click", () => startNewGame(42));
        document.getElementById("btnZolikRestart0")?.addEventListener("click", () => startNewGame(0));
    }
}

function renderFinished(container, data) {
    const playerOrder = toArr(data.playerOrder);
    const penalties = data.penalties || {};
    const rows = playerOrder
        .map(p => ({ name: p, pts: penalties[p] ?? 0 }))
        .sort((a, b) => a.pts - b.pts);

    const rowsHtml = rows.map((r, idx) => `
        <div class="quiz-leaderboard-row ${r.name === data.winner ? "me" : ""}">
            <div><strong>${idx === 0 ? "🏆 " : `${idx + 1}. `}${r.name}</strong></div>
            <div>${r.name === data.winner ? "Vítěz (0 b.)" : `+${r.pts} trestných b.`}</div>
        </div>
    `).join("");

    container.innerHTML = `
        <div class="bomba-box">
            <h1 style="font-size: 3.5rem; margin: 0;">🏆</h1>
            <h2>Konec Žolíka!</h2>
            <p style="font-size: 1.3rem;">Vyhrál(a): <strong style="color: #fbbf24;">${data.winner}</strong></p>
            <div class="quiz-leaderboard" style="margin: 16px 0;">${rowsHtml}</div>
            ${state.isHost ? `
                <div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
                    <button id="btnZolikAgain42" class="btn-game" style="background: #0d9488; margin: 0;">🔄 Hrát znovu (42 bodů)</button>
                    <button id="btnZolikAgain0" class="btn-game" style="background: #0284c7; margin: 0;">⚡ Hrát znovu (bez limitu)</button>
                </div>
            ` : `<p class="pulse-text">Čeká se na hostitele...</p>`}
        </div>
    `;

    if (state.isHost) {
        document.getElementById("btnZolikAgain42").addEventListener("click", () => startNewGame(42));
        document.getElementById("btnZolikAgain0").addEventListener("click", () => startNewGame(0));
    }
}
