import { db, ref, set, onValue, update } from "../firebase-config.js";
import { state } from "../app.js?v=2";

// Databáze subjektivních párty otázek ({player} se nahradí jménem náhodného hráče)
const QUESTIONS = [
    "Na kolik procent věříš, že by {player} dokázal(a) podle manuálu přistát s dopravním letadlem?",
    "Jaká je šance (v %), že {player} dneska skončí pod stolem?",
    "Na kolik procent by {player} přežil(a) první týden v zombie apokalypse?",
    "Jaká je pravděpodobnost, že se {player} do 5 let stane milionářem?",
    "Na kolik procent věříš, že by {player} zvládl(a) týden v lese bez telefonu a jídla?",
    "Jaká je šance, že {player} udrží velké tajemství a nikomu ho nevykecá?",
    "Na kolik procent by {player} vyhrál(a) v reality show Survivor?",
    "Jaká je pravděpodobnost, že {player} napíše svému/své ex po 5 panácích?",
    "Na kolik procent věříš, že by {player} dokázal(a) ukecat policajta při pokutě?",
    "Jaká je šance, že {player} ráno vstane na první budík?",
    "Na kolik procent by {player} zvládl(a) uvařit tříchodovou večeři bez receptu?",
    "Jaká je pravděpodobnost, že by se {player} nechal(a) potetovat na čelo za milion korun?",
    "Na kolik procent věříš, že by {player} přežil(a) ve vězení?",
    "Jaká je šance, že {player} na dovolené ztratí pas nebo peněženku?",
    "Na kolik procent by byl(a) {player} dobrý prezident / dobrá prezidentka?",
    "Jaká je pravděpodobnost, že {player} odejde z párty bez rozloučení (tzv. po anglicku)?",
    "Na kolik procent věříš, že by {player} porazil(a) vzteklou husu v souboji holýma rukama?",
    "Jaká je šance, že si {player} zítra bude pamatovat celý dnešní večer?",
    "Na kolik procent by {player} dokázal(a) měsíc neutratit ani korunu za zbytečnosti?",
    "Jaká je pravděpodobnost, že {player} přijde pozdě na vlastní svatbu?",
    "Na kolik procent věříš, že by {player} zvládl(a) řídit tank?",
    "Jaká je šance, že se {player} během příštího roku přestěhuje do jiné země?",
    "Na kolik procent by {player} uspěl(a) jako stand-up komik?",
    "Jaká je pravděpodobnost, že {player} tajně poslouchá dechovku nebo dětské písničky?",
    "Na kolik procent věříš, že by {player} dokázal(a) lhát na detektoru lži a projít?",
    "Jaká je šance, že {player} v obchodě vrátí prodavačce peníze, když mu/jí vydá o pětistovku víc?",
    "Na kolik procent by {player} zvládl(a) celý víkend vůbec nemluvit?",
    "Jaká je pravděpodobnost, že si {player} pořídí víc než 3 děti?",
    "Na kolik procent věříš, že by se {player} dokázal(a) uživit jako influencer?",
    "Jaká je šance, že {player} sní jídlo, které mu/jí spadlo na zem na ulici?",
    "Na kolik procent by {player} dokázal(a) opravit kapající kohoutek bez YouTube tutoriálu?",
    "Jaká je pravděpodobnost, že {player} začne na párty tancovat na stole?",
    "Na kolik procent věříš, že by {player} vyhrál(a) hádku s právníkem?",
    "Jaká je šance, že by {player} skočil(a) bungee jumping bez váhání?",
    "Na kolik procent věříš, že má {player} doma uklizeno právě teď?"
];

let renderedRoundId = null;

export function initSlider() {
    const container = document.getElementById("slider-content");
    if (!container) return;

    // Rovnou vykreslíme výchozí obrazovku, než odpoví Firebase
    renderWaiting(container);

    const sliderRef = ref(db, `rooms/${state.roomId}/games/slider`);

    onValue(sliderRef, (snapshot) => {
        const data = snapshot.val();

        if (!data || data.status === "waiting") {
            renderedRoundId = null;
            renderWaiting(container);
            return;
        }

        if (data.status === "voting") {
            renderVoting(container, data);
            return;
        }

        if (data.status === "results") {
            renderedRoundId = null;
            renderResults(container, data);
            return;
        }

        renderWaiting(container);
    });
}

// 1. ÚVODNÍ OBRAZOVKA PŘED HROU
function renderWaiting(container) {
    container.innerHTML = `
        <div class="bomba-box">
            <h1>🎚️ Tref Průměr</h1>
            <p>Na obrazovce se objeví otázka na někoho z vás. Nastav na posuvníku <strong>0 až 100 %</strong> podle svého odhadu.</p>
            <p style="color: #9ca3af; font-size: 0.95rem;">Vyhrává ten, kdo se svým tipem trefí nejblíž průměru všech hráčů!</p>
            ${state.isHost
                ? `<button id="btnStartSlider" class="btn-game" style="margin-top: 20px;">🎲 Spustit první kolo</button>`
                : `<p class="pulse-text">Čeká se, až hostitel spustí kolo...</p>`
            }
        </div>
    `;

    if (state.isHost) {
        document.getElementById("btnStartSlider").addEventListener("click", () => {
            startNewRound();
        });
    }
}

// 2. HLASOVÁNÍ (POSUVNÍK)
function renderVoting(container, data) {
    const votes = data.votes || {};
    const myVote = votes[state.myName];
    const hasVoted = myVote !== undefined;
    const votedCount = Object.keys(votes).length;
    const totalPlayers = state.players.length;

    // Automatické vyhodnocení, jakmile odhlasují všichni v místnosti
    if (state.isHost && totalPlayers > 0 && votedCount >= totalPlayers) {
        showResults();
        return;
    }

    // Pokud hráč ještě nehlasoval a už má vykreslený posuvník pro toto kolo,
    // aktualizujeme pouze počítadlo hlasů, abychom mu při tahu prstem neresetovali posuvník
    if (!hasVoted && renderedRoundId === data.roundId && document.getElementById("sliderInput")) {
        const statusEl = document.getElementById("sliderVoteStatus");
        if (statusEl) {
            statusEl.innerText = `Odhlasováno: ${votedCount} / ${totalPlayers} hráčů`;
        }
        const btnForce = document.getElementById("btnForceResults");
        if (btnForce) {
            btnForce.style.display = votedCount > 0 ? "inline-block" : "none";
        }
        return;
    }

    renderedRoundId = data.roundId;

    if (!hasVoted) {
        container.innerHTML = `
            <div class="bomba-box">
                <div class="topic-card">
                    <div class="topic-label" style="color: #fbbf24;">Otázka na tělo:</div>
                    <div class="topic-text" style="font-size: 1.4rem; line-height: 1.35;">${data.question}</div>
                </div>

                <div class="slider-value-display">
                    <span id="sliderValueText">50</span> %
                </div>

                <div class="slider-wrapper">
                    <input type="range" id="sliderInput" class="party-slider" min="0" max="100" value="50">
                    <div class="slider-labels">
                        <span>0 % (Vůbec)</span>
                        <span>50 %</span>
                        <span>100 % (Stopro)</span>
                    </div>
                </div>

                <button id="btnSubmitVote" class="btn-primary" style="margin-top: 20px; background: #10b981;">
                    ✅ Potvrdit tip
                </button>

                <p id="sliderVoteStatus" style="color: #9ca3af; margin-top: 12px;">
                    Odhlasováno: ${votedCount} / ${totalPlayers} hráčů
                </p>

                ${state.isHost ? `
                    <button id="btnForceResults" class="btn-small" style="margin-top: 8px; display: ${votedCount > 0 ? "inline-block" : "none"};">
                        📊 Uzavřít a vyhodnotit hned
                    </button>
                ` : ""}
            </div>
        `;

        const sliderInput = document.getElementById("sliderInput");
        const sliderValueText = document.getElementById("sliderValueText");

        sliderInput.addEventListener("input", () => {
            sliderValueText.innerText = sliderInput.value;
        });

        document.getElementById("btnSubmitVote").addEventListener("click", () => {
            const val = Number(sliderInput.value);
            submitVote(val);
        });

        const btnForce = document.getElementById("btnForceResults");
        if (btnForce) {
            btnForce.addEventListener("click", showResults);
        }
    } else {
        // Hráč už odhlasoval -> čeká na ostatní
        const waitingFor = state.players.filter(p => votes[p] === undefined);

        container.innerHTML = `
            <div class="bomba-box">
                <div class="topic-card">
                    <div class="topic-label" style="color: #fbbf24;">Otázka:</div>
                    <div class="topic-text" style="font-size: 1.3rem;">${data.question}</div>
                </div>

                <p style="font-size: 1.2rem;">Tvůj odeslaný tip:</p>
                <div class="slider-value-display" style="font-size: 3rem; margin: 10px 0;">
                    ${myVote} %
                </div>

                <p class="pulse-text">Čeká se na ostatní (${votedCount} / ${totalPlayers})...</p>
                ${waitingFor.length > 0 ? `
                    <p style="color: #9ca3af; font-size: 0.9rem;">
                        Ještě přemýšlí: <strong>${waitingFor.join(", ")}</strong>
                    </p>
                ` : ""}

                ${state.isHost ? `
                    <button id="btnForceResults" class="btn-small" style="margin-top: 15px;">
                        📊 Uzavřít a vyhodnotit hned
                    </button>
                ` : ""}
            </div>
        `;

        const btnForce = document.getElementById("btnForceResults");
        if (btnForce) {
            btnForce.addEventListener("click", showResults);
        }
    }
}

// 3. VYHODNOCENÍ KOLA
function renderResults(container, data) {
    const votes = data.votes || {};
    const entries = Object.entries(votes); // [[name, value], ...]

    if (entries.length === 0) {
        container.innerHTML = `
            <div class="bomba-box">
                <h2>Nikdo nehlasoval 🤷‍♂️</h2>
                ${getNextRoundButtonHtml()}
            </div>
        `;
        bindNextRoundButton(data.question);
        return;
    }

    // Výpočet průměru
    const sum = entries.reduce((acc, [, val]) => acc + Number(val), 0);
    const avgRaw = sum / entries.length;
    const avgRounded = Math.round(avgRaw * 10) / 10;

    // Spočítáme odchylku každého hráče od průměru a seřadíme od nejpřesnějšího
    const results = entries.map(([player, val]) => {
        const numVal = Number(val);
        const diff = Math.round(Math.abs(numVal - avgRaw) * 10) / 10;
        return { player, val: numVal, diff };
    }).sort((a, b) => a.diff - b.diff);

    const bestDiff = results[0].diff;
    const worstDiff = results[results.length - 1].diff;
    const winners = results.filter(r => r.diff === bestDiff).map(r => r.player);

    const rowsHtml = results.map((r, index) => {
        const isWinner = r.diff === bestDiff;
        const isLoser = results.length > 1 && r.diff === worstDiff && bestDiff !== worstDiff;
        let badge = `${index + 1}.`;
        if (isWinner) badge = "🏆";
        else if (isLoser) badge = "🍻";

        return `
            <div class="slider-result-row ${isWinner ? "winner-row" : ""} ${isLoser ? "loser-row" : ""}">
                <div class="slider-result-name">
                    <span>${badge}</span>
                    <strong>${r.player}</strong>
                </div>
                <div class="slider-result-numbers">
                    <span class="slider-tip-badge">${r.val} %</span>
                    <span class="slider-diff-badge">odchylka ${r.diff} %</span>
                </div>
            </div>
        `;
    }).join("");

    container.innerHTML = `
        <div class="bomba-box">
            <div class="topic-card" style="margin-bottom: 12px; padding: 14px;">
                <div class="topic-text" style="font-size: 1.15rem;">${data.question}</div>
            </div>

            <div class="avg-card">
                <div class="topic-label">Průměr skupiny (vůle davu):</div>
                <div class="avg-number">${avgRounded} %</div>
            </div>

            <p style="font-size: 1.25rem; margin: 12px 0;">
                🎯 Nejblíž byl(a): <strong style="color: #10b981;">${winners.join(", ")}</strong>
            </p>

            <div class="slider-results-list">
                ${rowsHtml}
            </div>

            ${getNextRoundButtonHtml()}
        </div>
    `;

    bindNextRoundButton(data.question);
}

// --- HERNÍ AKCE ---

function startNewRound(previousQuestion = null) {
    const playersList = state.players.length > 0 ? state.players : [state.myName];

    let finalQuestion = "";
    do {
        const template = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
        const randomPlayer = playersList[Math.floor(Math.random() * playersList.length)];
        finalQuestion = template.replace("{player}", randomPlayer);
    } while (finalQuestion === previousQuestion && QUESTIONS.length > 1);

    set(ref(db, `rooms/${state.roomId}/games/slider`), {
        status: "voting",
        roundId: Date.now(),
        question: finalQuestion,
        votes: {}
    });
}

function submitVote(value) {
    update(ref(db, `rooms/${state.roomId}/games/slider/votes`), {
        [state.myName]: value
    });
}

function showResults() {
    update(ref(db, `rooms/${state.roomId}/games/slider`), {
        status: "results"
    });
}

function getNextRoundButtonHtml() {
    if (!state.isHost) {
        return `<p class="pulse-text" style="margin-top: 16px;">Čeká se na hostitele pro další otázku...</p>`;
    }
    return `
        <button id="btnNextSliderRound" class="btn-game" style="margin-top: 18px; background: #8b5cf6;">
            🎲 Další otázka
        </button>
    `;
}

function bindNextRoundButton(previousQuestion) {
    if (!state.isHost) return;
    const btn = document.getElementById("btnNextSliderRound");
    if (btn) {
        btn.addEventListener("click", () => {
            startNewRound(previousQuestion);
        });
    }
}
