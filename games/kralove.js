import { db, ref, set, onValue, update } from "../firebase-config.js?v=7";
import { state } from "../app.js?v=7";

const SUITS = [
    { symbol: "♥️", color: "red" },
    { symbol: "♦️", color: "red" },
    { symbol: "♠️", color: "black" },
    { symbol: "♣️", color: "black" }
];

const CARD_RULES = {
    "2": {
        title: "🍺 Ty piješ!",
        desc: "Smůla! Ten, kdo tuhle kartu vytáhl ({player}), se musí sám napít."
    },
    "3": {
        title: "👉 Rozdej pití!",
        desc: "{player} vybere kohokoliv u stolu, kdo se musí okamžitě napít."
    },
    "4": {
        title: "🚻 Kluci / Holky!",
        desc: "Podle toho, kdo kartu vytáhl ({player}): buď pijí všichni kluci, nebo všechny holky u stolu!"
    },
    "5": {
        title: "🗂️ Kategorie!",
        desc: "{player} vymyslí kategorii (např. značky piva, auta, státy) a po směru hodinových ručiček říkáte příklady. Kdo zaváhá nebo zopakuje slovo, pije!"
    },
    "6": {
        title: "🍻 Pijí všichni!",
        desc: "Na zdraví! Celá parta u stolu zvedá sklenice a všichni se napijí."
    },
    "7": {
        title: "👍 Pán palce!",
        desc: "{player} získává moc PALCE! Kdykoliv během hry může nenápadně položit palec na stůl. Kdo to zopakuje jako poslední, pije!"
    },
    "8": {
        title: "🤝 Parťák (Mate)!",
        desc: "{player} si vybere kamaráda u stolu. Odteď jste spojení – kdykoliv piješ ty, musí pít i tvůj parťák (a naopak)!"
    },
    "9": {
        title: "🎤 Rým!",
        desc: "{player} řekne jedno slovo a ostatní musí po směru říkat slova, která se rýmují. Kdo zazmatkuje nebo zopakuje slovo, pije!"
    },
    "10": {
        title: "📜 Nové pravidlo!",
        desc: "{player} vymýšlí nové pravidlo, které platí až do konce hry (např. pít jen levou rukou, zákaz říkat 'já' nebo zákaz nadávat). Kdo ho poruší, pije!"
    },
    "J": {
        title: "❓ Otázky!",
        desc: "{player} se stává Pánem otázek! Nesmíte mu/jí odpovědět na žádnou otázku (musíte odpovědět zase otázkou). Kdo se nachytá a odpoví, pije!"
    },
    "Q": {
        title: "👑 Všemocná Královna!",
        desc: "{player} se stává Královnou! Nikdo na něj/ni nesmí mluvit jménem ani mu/jí tykat jménem, dokud nepadne další Královna. Kdo zapomene, pije!"
    },
    "K": {
        title: "🏆 Král / Pohár!",
        desc: "První 3 Králové nalijí trochu svého pití do společného poháru uprostřed stolu. Kdo vytáhne 4. (posledního) Krále, musí celý Královský pohár EXNOUT!"
    },
    "A": {
        title: "🌊 Vodopád!",
        desc: "Všichni začnou pít najednou! {player} může přestat kdykoliv, ale každý další po směru smí přestat pít až ve chvíli, kdy přestane člověk před ním!"
    }
};

const PRESET_RULES = [
    "🍺 Pije se jen levou rukou",
    "🚫 Zákaz říkat slovo 'JÁ' nebo 'NE'",
    "🤫 Zákaz oslovovat kohokoliv jménem",
    "👆 Zákaz ukazovat prstem (jen loktem)",
    "✊ Před každým napitím zaťukat na stůl",
    "📱 Kdo sáhne na mobil mimo tah, pije"
];

let latestData = null;

export function initKralove() {
    const container = document.getElementById("kralove-content");
    if (!container) return;

    renderWaiting(container);

    const kraloveRef = ref(db, `rooms/${state.roomId}/games/kralove`);

    onValue(kraloveRef, (snapshot) => {
        const data = snapshot.val();
        latestData = data;

        if (!data || data.status === "waiting") {
            renderWaiting(container);
            return;
        }

        if (data.status === "playing" || data.status === "finished") {
            renderGame(container, data);
            return;
        }

        renderWaiting(container);
    });
}

// 1. ÚVODNÍ OBRAZOVKA PŘED HROU
function renderWaiting(container) {
    container.innerHTML = `
        <div class="bomba-box">
            <h1>👑 Králové (Pravidla)</h1>
            <p>Klasická karetní chlastačka v mobilu! Postupně taháte karty z balíčku (52 karet) a plníte úkoly a pravidla.</p>
            <p style="color: #9ca3af; font-size: 0.95rem;">
                Připravte doprostřed stolu jeden prázdný kelímek nebo sklenici jako <strong>Královský pohár</strong>! 🏆
            </p>
            ${state.isHost
                ? `<button id="btnStartKralove" class="btn-game" style="margin-top: 20px; background: #eab308; color: #000;">🃏 Zamíchat balíček a hrát</button>`
                : `<p class="pulse-text" style="margin-top: 20px;">Čeká se, až hostitel zamíchá karty...</p>`
            }
        </div>
    `;

    if (state.isHost) {
        document.getElementById("btnStartKralove").addEventListener("click", startNewDeck);
    }
}

// 2. HLAVNÍ HERNÍ OBRAZOVKA
function renderGame(container, data) {
    const deck = data.deck || [];
    const cardsLeft = deck.length;
    const kingsCount = data.kingsCount || 0;
    const currentTurn = data.currentTurn || state.players[0] || state.myName;
    const isMyTurn = currentTurn === state.myName;
    const lastCard = data.lastCard || null;
    const activeRules = data.activeRules || [];
    const isDeckEmpty = data.status === "finished" || cardsLeft === 0;

    // Horní přehled stavu (Zbývá karet + Králové v poháru)
    const kingsIcons = [1, 2, 3, 4].map(i => i <= kingsCount ? "👑" : "⚪").join(" ");

    // Vykreslení vytažené karty (pokud už byla nějaká vytažena)
    let cardHtml = "";
    if (lastCard) {
        const ruleObj = CARD_RULES[lastCard.rank] || { title: "Karta", desc: "" };
        let formattedDesc = ruleObj.desc.replace("{player}", `<strong>${lastCard.drawnBy}</strong>`);

        // Speciální hláška pro Krále (1.–3. vs 4. poslední Král)
        const isFourthKing = lastCard.rank === "K" && kingsCount >= 4;
        if (lastCard.rank === "K") {
            if (isFourthKing) {
                formattedDesc = `💥 <strong>ČTVRTÝ KRÁL PADL!</strong> Hráč <strong>${lastCard.drawnBy}</strong> musí právě teď EXNOUT celý Královský pohár uprostřed stolu! 🍻👑`;
            } else {
                formattedDesc = `Hráč <strong>${lastCard.drawnBy}</strong> vytáhl ${kingsCount}. Krále ze 4! Nalij trochu svého pití do společného Královskýho poháru uprostřed stolu! 🫗`;
            }
        }

        // Pokud padla 10 (Pravidlo) a vytáhl jsem ji já, ukážeme rychlý výběr / zadání pravidla
        const canAddRule = lastCard.rank === "10" && lastCard.drawnBy === state.myName && !lastCard.ruleAdded;

        cardHtml = `
            <div class="king-card-wrap ${isFourthKing ? "fourth-king-alert" : ""}">
                <div class="king-drawn-by">Kartu vytáhl(a): <strong>${lastCard.drawnBy}</strong></div>

                <div class="playing-card ${lastCard.color === "red" ? "card-red" : "card-black"}">
                    <div class="card-corner top-left">${lastCard.rank}<span>${lastCard.suit}</span></div>
                    <div class="card-center">${lastCard.rank}${lastCard.suit}</div>
                    <div class="card-corner bottom-right">${lastCard.rank}<span>${lastCard.suit}</span></div>
                </div>

                <div class="king-rule-title">${isFourthKing ? "💥 EXNI KRÁLOVSKÝ POHÁR! 💥" : ruleObj.title}</div>
                <div class="king-rule-desc">${formattedDesc}</div>

                ${canAddRule ? `
                    <div class="rule-creator-box">
                        <div style="font-size: 0.85rem; color: #fbbf24; margin-bottom: 8px; font-weight: bold;">
                            Zapiš pravidlo na tabuli (nebo vyber rychlé):
                        </div>
                        <div class="preset-rules-grid">
                            ${PRESET_RULES.map(r => `<button class="btn-preset-rule" data-rule="${r}">${r}</button>`).join("")}
                        </div>
                        <div style="display: flex; gap: 6px; margin-top: 8px;">
                            <input type="text" id="customRuleInput" placeholder="Vlastní pravidlo..." maxlength="50" style="margin: 0; padding: 10px; font-size: 0.95rem;">
                            <button id="btnAddCustomRule" class="btn-small" style="background: #10b981; margin: 0; white-space: nowrap;">+ Přidat</button>
                        </div>
                    </div>
                ` : ""}
            </div>
        `;
    } else {
        cardHtml = `
            <div class="topic-card" style="padding: 28px 18px;">
                <div style="font-size: 3.5rem; margin-bottom: 8px;">🂠</div>
                <div style="font-size: 1.2rem; font-weight: bold;">Balíček je zamíchaný!</div>
                <div style="color: #9ca3af; font-size: 0.95rem; margin-top: 4px;">
                    První na řadě je <strong>${currentTurn}</strong>.
                </div>
            </div>
        `;
    }

    // Aktivní stavy u stolu (Královna, Palec, Otázky, Pravidla)
    const statusBadges = [];
    if (data.queen) statusBadges.push(`<span class="king-status-badge">👑 Královna: <strong>${data.queen}</strong></span>`);
    if (data.thumbMaster) statusBadges.push(`<span class="king-status-badge">👍 Palec: <strong>${data.thumbMaster}</strong></span>`);
    if (data.questionMaster) statusBadges.push(`<span class="king-status-badge">❓ Otázky: <strong>${data.questionMaster}</strong></span>`);

    container.innerHTML = `
        <div class="bomba-box">
            <div class="king-top-bar">
                <span>🃏 Karet: <strong>${cardsLeft}</strong></span>
                <span> Pohár: ${kingsIcons}</span>
            </div>

            ${cardHtml}

            ${!isDeckEmpty ? (
                isMyTurn ? `
                    <button id="btnDrawCard" class="btn-draw-card">
                        🃏 LÍZNOUT KARTU (Jsi na řadě!)
                    </button>
                ` : `
                    <div class="turn-waiting-box">
                        Na řadě je: <strong style="color: #fbbf24; font-size: 1.3rem;">${currentTurn}</strong>
                    </div>
                    ${state.isHost ? `
                        <button id="btnHostDrawCard" class="btn-small" style="margin-top: 8px;">
                            ⏭️ Líznout kartu za hráče ${currentTurn}
                        </button>
                    ` : ""}
                `
            ) : `
                <div class="topic-card" style="border: 2px solid #eab308;">
                    <h2>🎉 Balíček je dobraný!</h2>
                    <p>Všech 52 karet bylo vytaženo.</p>
                    ${state.isHost ? `
                        <button id="btnReshuffle" class="btn-game" style="background: #eab308; color: #000; margin-top: 10px;">
                            🔄 Zamíchat nový balíček
                        </button>
                    ` : `<p class="pulse-text">Čeká se na hostitele...</p>`}
                </div>
            `}

            ${statusBadges.length > 0 ? `
                <div class="king-statuses-wrap">
                    ${statusBadges.join("")}
                </div>
            ` : ""}

            ${activeRules.length > 0 ? `
                <div class="king-rules-board">
                    <div style="font-size: 0.85rem; color: #fbbf24; font-weight: bold; margin-bottom: 6px;">
                        📜 Platná pravidla u stolu:
                    </div>
                    <ul class="king-rules-list">
                        ${activeRules.map(r => `<li>${r}</li>`).join("")}
                    </ul>
                </div>
            ` : ""}
        </div>
    `;

    // Event listenery
    const btnDraw = document.getElementById("btnDrawCard");
    if (btnDraw) {
        btnDraw.addEventListener("click", () => drawNextCard(currentTurn));
    }

    const btnHostDraw = document.getElementById("btnHostDrawCard");
    if (btnHostDraw) {
        btnHostDraw.addEventListener("click", () => drawNextCard(currentTurn));
    }

    const btnReshuffle = document.getElementById("btnReshuffle");
    if (btnReshuffle) {
        btnReshuffle.addEventListener("click", startNewDeck);
    }

    // Přidání pravidla při vytažení 10
    container.querySelectorAll(".btn-preset-rule").forEach(btn => {
        btn.addEventListener("click", () => {
            addTableRule(btn.getAttribute("data-rule"));
        });
    });

    const btnCustomRule = document.getElementById("btnAddCustomRule");
    if (btnCustomRule) {
        btnCustomRule.addEventListener("click", () => {
            const val = document.getElementById("customRuleInput").value.trim();
            if (val) addTableRule(val);
        });
    }
}

// --- HERNÍ AKCE ---

function createShuffledDeck() {
    const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
    const deck = [];

    for (const rank of ranks) {
        for (const suitObj of SUITS) {
            deck.push({
                rank,
                suit: suitObj.symbol,
                color: suitObj.color
            });
        }
    }

    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}

function startNewDeck() {
    const playersList = state.players.length > 0 ? state.players : [state.myName];
    const deck = createShuffledDeck();

    set(ref(db, `rooms/${state.roomId}/games/kralove`), {
        status: "playing",
        deck: deck,
        kingsCount: 0,
        currentTurn: playersList[0],
        lastCard: null,
        queen: null,
        thumbMaster: null,
        questionMaster: null,
        activeRules: []
    });
}

function drawNextCard(drawerName) {
    if (!latestData || !latestData.deck || latestData.deck.length === 0) return;

    const deck = [...latestData.deck];
    const drawnCard = deck.pop();

    const playersList = state.players.length > 0 ? state.players : [state.myName];
    const currentIdx = playersList.indexOf(drawerName);
    const nextPlayer = playersList[(currentIdx + 1) % playersList.length];

    let kingsCount = latestData.kingsCount || 0;
    if (drawnCard.rank === "K") {
        kingsCount += 1;
    }

    const updates = {
        deck: deck,
        kingsCount: kingsCount,
        currentTurn: nextPlayer,
        status: deck.length === 0 ? "finished" : "playing",
        lastCard: {
            ...drawnCard,
            drawnBy: drawerName,
            ruleAdded: false
        }
    };

    if (drawnCard.rank === "Q") updates.queen = drawerName;
    if (drawnCard.rank === "7") updates.thumbMaster = drawerName;
    if (drawnCard.rank === "J") updates.questionMaster = drawerName;

    update(ref(db, `rooms/${state.roomId}/games/kralove`), updates);
}

function addTableRule(ruleText) {
    if (!latestData) return;
    const currentRules = latestData.activeRules ? [...latestData.activeRules] : [];
    currentRules.push(`${ruleText} (${state.myName})`);

    update(ref(db, `rooms/${state.roomId}/games/kralove`), {
        activeRules: currentRules,
        "lastCard/ruleAdded": true
    });
}

