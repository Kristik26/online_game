import { db, ref, set, onValue, update } from "../firebase-config.js?v=6";
import { state } from "../app.js?v=6";

// Databáze absurdních párty dilemat [Možnost A, Možnost B]
const DILEMMAS = [
    ["Mít místo rukou hrábě", "Muset se nahlas smát na každém pohřbu"],
    ["Mluvit do konce života jenom ve verších", "Muset před každou větou udělat dřep"],
    ["Vždycky říct nahlas všechno, co si myslíš", "Už nikdy v životě nepromluvit ani slovo"],
    ["Smrdět pořád trochu jako česnek", "Cítit všude kolem sebe jenom rybinu"],
    ["Mít prsty dlouhé jako nohy", "Mít nohy krátké jako prsty"],
    ["Bojovat s jednou kachnou velikosti koně", "Bojovat se stovkou koní velikosti kachny"],
    ["Muset jíst každé jídlo s kečupem (i dort)", "Už nikdy v životě nejíst nic slaného"],
    ["Vypadat o 20 let starší od krku nahoru", "Vypadat o 20 let starší od krku dolů"],
    ["Každou noc spát v mokrých ponožkách", "Mít v posteli vždycky nadrobené tousty"],
    ["Poslat omylem erotickou fotku šéfovi", "Poslat omylem erotickou fotku svým rodičům"],
    ["Nemít už nikdy přístup k internetu", "Nemít už nikdy možnost pít alkohol ani kávu"],
    ["Mít permanentně ucpanou jednu nosní dírku", "Mít v botě pořád malý kamínek, co nejde vyndat"],
    ["Kdykoliv lžeš, nahlas si prdnout", "Kdykoliv jsi nervózní, začít nahlas jódlovat"],
    ["Být nejchytřejší člověk ve vězení", "Být nejhloupější člověk mezi miliardáři"],
    ["Mít vlasy z špaget, které dorůstají", "Potit javorový sirup místo potu"],
    ["Vědět přesné datum své smrti", "Vědět přesnou příčinu své smrti"],
    ["Mít třetí ruku uprostřed hrudníku", "Mít třetí oko na zátylku"],
    ["Muset chodit všude pozpátku", "Muset všude jezdit na dětské tříkolce"],
    ["Zapomenout jméno svého partnera při svatbě", "Zavolat šéfa slovem 'maminko' před celou firmou"],
    ["Být schopen teleportace, ale vždycky dorazit nahý", "Umět číst myšlenky, ale jen když přitom brečíš"],
    ["Do konce života poslouchat jen jednu písničku", "Do konce života koukat jen na jeden film"],
    ["Mít hlas jako Šmoula, když se rozčílíš", "Mít hlas jako Darth Vader, když flirtuješ"],
    ["Jíst celý týden jenom psí granule", "Vypít sklenici vody z kaluže na parkovišti"],
    ["Bydlet v luxusní vile bez elektřiny a teplé vody", "Bydlet v garsonce 2x2 metry s veškerým luxusem"],
    ["Mít neomezeně peněz, ale nesmět nikdy opustit své město", "Cestovat zadarmo po celém světě, ale mít vždy jen 100 Kč v kapse"],
    ["Probudit se každé ráno v jiné cizí zemi", "Probudit se každé ráno vedle náhodného člověka z této místnosti"],
    ["Mít na čele vytetované logo Kauflandu za 5 milionů Kč", "Chodit rok každý den v kostýmu banánu zadarmo"],
    ["Kousnout se do jazyka při každém obědě", "Kopnout se malíčkem o skříň každý večer"],
    ["Mít místo zubů kukuřičná zrnka", "Mít místo uší malé lívance"],
    ["Muset olíznout podlahu v autobuse MHD", "Muset sníst syrovou cibuli jako jablko"],
    ["Aby ti každá košile i tričko byly o 10 cm kratší", "Aby ti každé boty byly o 3 čísla větší"],
    ["Ztratit všechny fotky a vzpomínky z telefonu", "Zveřejnit celou svou historii vyhledávání na Googlu"],
    ["Být rok zavřený na pustém ostrově sám", "Být rok zavřený v malém bytě se svým/svou ex"],
    ["Mít doma mluvícího psa, který tě ale pořád pomlouvá", "Mít kočku, která ti krade peníze z peněženky"],
    ["Kdykoliv kýchneš, změnit náhodně barvu vlasů", "Kdykoliv škytneš, poskočit o metr do vzduchu"],
    ["Jíst pizzu už navždy jenom s ananasem", "Už nikdy v životě nesmět sníst žádnou pizzu"],
    ["Mít vždycky vybitý telefon na 3 %", "Mít internet rychlý jako v roce 1998"],
    ["Muset každému člověku při seznámení očichat krk", "Muset každému při rozloučení políbit ruku"],
    ["Být slavný kvůli extrémně trapnému virálnímu videu", "Být úplně neznámý, i když zachráníš svět"],
    ["Mít neustále pocit, že potřebuješ kýchnout, ale nejde to", "Mít neustále pocit, že ti vibruje telefon v kapse"]
];

let latestData = null;
let usedDilemmas = [];

export function initDilema() {
    const container = document.getElementById("dilema-content");
    if (!container) return;

    renderWaiting(container);

    const dilemaRef = ref(db, `rooms/${state.roomId}/games/dilema`);

    onValue(dilemaRef, (snapshot) => {
        const data = snapshot.val();
        latestData = data;

        if (!data || data.status === "waiting") {
            renderWaiting(container);
            return;
        }

        if (data.status === "voting") {
            renderVoting(container, data);
            return;
        }

        if (data.status === "results") {
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
            <h1>⚖️ Absolutní Dilema</h1>
            <p>Co bys radši? Na displeji se ukážou dvě šílené možnosti. Vyber tu menší hrůzu!</p>
            <p style="color: #9ca3af; font-size: 0.95rem;">Kdo skončí v menšině, ztrácí bod (a obhajuje svůj výběr před ostatními)!</p>
            ${state.isHost
                ? `<button id="btnStartDilema" class="btn-game" style="margin-top: 20px; background: #ec4899;">🔥 Spustit první dilema</button>`
                : `<p class="pulse-text" style="margin-top: 20px;">Čeká se, až hostitel spustí hru...</p>`
            }
        </div>
    `;

    if (state.isHost) {
        document.getElementById("btnStartDilema").addEventListener("click", () => {
            startNewRound(true);
        });
    }
}

// 2. HLASOVÁNÍ (DVĚ OBŘÍ TLAČÍTKA)
function renderVoting(container, data) {
    const votes = data.votes || {};
    const myVote = votes[state.myName];
    const hasVoted = myVote !== undefined;

    const playersList = state.players.length > 0 ? state.players : [state.myName];
    const votedCount = playersList.filter(p => votes[p] !== undefined).length;
    const totalPlayers = playersList.length;

    // Automatické vyhodnocení, jakmile odhlasují všichni v místnosti
    if (state.isHost && totalPlayers > 0 && votedCount >= totalPlayers) {
        showResults();
        return;
    }

    const optionA = data.optionA || "";
    const optionB = data.optionB || "";
    const waitingFor = playersList.filter(p => votes[p] === undefined);

    container.innerHTML = `
        <div class="bomba-box">
            <div class="topic-label" style="color: #f472b6; font-weight: bold; margin-bottom: 12px;">
                CO BYS RADŠI?
            </div>

            <div class="dilema-buttons-wrap">
                <button class="dilema-btn dilema-btn-a ${hasVoted && myVote === 0 ? "selected" : ""}" data-choice="0" ${hasVoted ? "disabled" : ""}>
                    <span class="dilema-badge">A</span>
                    <span>${optionA}</span>
                </button>

                <div class="dilema-vs">NEBO</div>

                <button class="dilema-btn dilema-btn-b ${hasVoted && myVote === 1 ? "selected" : ""}" data-choice="1" ${hasVoted ? "disabled" : ""}>
                    <span class="dilema-badge">B</span>
                    <span>${optionB}</span>
                </button>
            </div>

            <p style="color: #9ca3af; margin-top: 16px;">
                Odhlasováno: <strong>${votedCount} / ${totalPlayers}</strong> hráčů
            </p>
            ${hasVoted && waitingFor.length > 0 ? `
                <p class="pulse-text" style="font-size: 0.9rem; margin-top: 4px;">
                    Čeká se na: ${waitingFor.join(", ")}
                </p>
            ` : ""}

            ${state.isHost && votedCount > 0 ? `
                <button id="btnForceDilemaResults" class="btn-small" style="margin-top: 10px;">
                    📊 Vyhodnotit hned
                </button>
            ` : ""}
        </div>
    `;

    if (!hasVoted) {
        container.querySelectorAll(".dilema-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const choice = parseInt(btn.getAttribute("data-choice"), 10);
                submitVote(choice);
            });
        });
    }

    const btnForce = document.getElementById("btnForceDilemaResults");
    if (btnForce) {
        btnForce.addEventListener("click", showResults);
    }
}

// 3. VÝSLEDKY KOLA
function renderResults(container, data) {
    const votes = data.votes || {};
    const scores = data.scores || {};

    const votersA = Object.keys(votes).filter(p => votes[p] === 0);
    const votersB = Object.keys(votes).filter(p => votes[p] === 1);
    const totalVotes = votersA.length + votersB.length;

    const pctA = totalVotes > 0 ? Math.round((votersA.length / totalVotes) * 100) : 0;
    const pctB = totalVotes > 0 ? 100 - pctA : 0;

    // Určení menšiny
    let minorityOption = null;
    if (votersA.length < votersB.length) minorityOption = 0;
    else if (votersB.length < votersA.length) minorityOption = 1;

    const minorityPlayers = minorityOption === 0 ? votersA : minorityOption === 1 ? votersB : [];

    // Žebříček bodů
    const playersList = state.players.length > 0 ? state.players : Object.keys(scores);
    const allPlayers = [...new Set([...playersList, ...Object.keys(scores)])];
    const sortedScores = allPlayers
        .map(name => ({ name, score: scores[name] || 0 }))
        .sort((a, b) => b.score - a.score);

    const scoresHtml = sortedScores.map(p => `
        <span class="quiz-player-chip" style="border-color: ${p.score < 0 ? "#ef4444" : "#3f3f46"};">
            ${p.name}: <strong>${p.score} b.</strong>
        </span>
    `).join("");

    container.innerHTML = `
        <div class="bomba-box">
            <h2>📊 Rozhodnutí davu</h2>

            <div class="dilema-result-card ${minorityOption === 0 ? "minority-card" : "majority-card"}">
                <div class="dilema-result-header">
                    <strong>A) ${data.optionA}</strong>
                    <span class="dilema-pct">${pctA} % (${votersA.length})</span>
                </div>
                <div class="dilema-bar-bg">
                    <div class="dilema-bar-fill bar-a" style="width: ${pctA}%;"></div>
                </div>
                <div class="dilema-voters">
                    ${votersA.length > 0 ? votersA.join(", ") : "Nikdo"}
                </div>
            </div>

            <div class="dilema-result-card ${minorityOption === 1 ? "minority-card" : "majority-card"}">
                <div class="dilema-result-header">
                    <strong>B) ${data.optionB}</strong>
                    <span class="dilema-pct">${pctB} % (${votersB.length})</span>
                </div>
                <div class="dilema-bar-bg">
                    <div class="dilema-bar-fill bar-b" style="width: ${pctB}%;"></div>
                </div>
                <div class="dilema-voters">
                    ${votersB.length > 0 ? votersB.join(", ") : "Nikdo"}
                </div>
            </div>

            <div class="topic-card" style="padding: 14px; margin: 14px 0;">
                ${minorityOption === null ? `
                    <strong style="color: #fbbf24; font-size: 1.15rem;">⚖️ Přesná plichta 50 / 50! Nikdo neztrácí bod!</strong>
                ` : minorityPlayers.length === 0 ? `
                    <strong style="color: #10b981; font-size: 1.15rem;">🎉 Všichni hlasovali stejně! Nikdo není v menšině!</strong>
                ` : `
                    <div style="color: #f87171; font-weight: 800; font-size: 1.15rem;">
                        🍻 V menšině (-1 bod): ${minorityPlayers.join(", ")}
                    </div>
                    <div style="font-size: 0.85rem; color: #9ca3af; margin-top: 4px;">
                        Obhajte svůj výběr před ostatními!
                    </div>
                `}
            </div>

            <div style="margin-top: 12px; text-align: left;">
                <div style="font-size: 0.85rem; color: #9ca3af; margin-bottom: 6px;">Celkové skóre:</div>
                <div class="quiz-players-grid">${scoresHtml}</div>
            </div>

            ${state.isHost ? `
                <button id="btnNextDilema" class="btn-game" style="margin-top: 18px; background: #ec4899;">
                    🎲 Další dilema
                </button>
            ` : `
                <p class="pulse-text" style="margin-top: 16px;">Čeká se na hostitele pro další dilema...</p>
            `}
        </div>
    `;

    if (state.isHost) {
        document.getElementById("btnNextDilema").addEventListener("click", () => {
            startNewRound(false);
        });
    }
}

// --- HERNÍ AKCE ---

function startNewRound(resetScores = false) {
    let available = DILEMMAS.map((_, i) => i).filter(i => !usedDilemmas.includes(i));
    if (available.length === 0) {
        usedDilemmas = [];
        available = DILEMMAS.map((_, i) => i);
    }

    const randomIdx = available[Math.floor(Math.random() * available.length)];
    usedDilemmas.push(randomIdx);
    const [optionA, optionB] = DILEMMAS[randomIdx];

    const playersList = state.players.length > 0 ? state.players : [state.myName];
    const currentScores = (!resetScores && latestData && latestData.scores) ? { ...latestData.scores } : {};

    playersList.forEach(p => {
        if (currentScores[p] === undefined) currentScores[p] = 0;
    });

    set(ref(db, `rooms/${state.roomId}/games/dilema`), {
        status: "voting",
        optionA: optionA,
        optionB: optionB,
        scores: currentScores,
        votes: {}
    });
}

function submitVote(choice) {
    update(ref(db, `rooms/${state.roomId}/games/dilema/votes`), {
        [state.myName]: choice
    });
}

function showResults() {
    if (!latestData || latestData.status !== "voting") return;

    const votes = latestData.votes || {};
    const scores = { ...(latestData.scores || {}) };

    const votersA = Object.keys(votes).filter(p => votes[p] === 0);
    const votersB = Object.keys(votes).filter(p => votes[p] === 1);

    let minorityOption = null;
    if (votersA.length < votersB.length) minorityOption = 0;
    else if (votersB.length < votersA.length) minorityOption = 1;

    if (minorityOption !== null) {
        const minorityPlayers = minorityOption === 0 ? votersA : votersB;
        minorityPlayers.forEach(p => {
            scores[p] = (scores[p] || 0) - 1;
        });
    }

    update(ref(db, `rooms/${state.roomId}/games/dilema`), {
        status: "results",
        scores: scores
    });
}

