import { db, ref, set, onValue, update } from "../firebase-config.js?v=4";
import { state } from "../app.js?v=4";

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
    "Na kolik procent věříš, že má {player} doma uklizeno právě teď?",
    "Na kolik procent je šance, že {player} zamává někomu, kdo ve skutečnosti mával na člověka za ním?",
    "Jaká je pravděpodobnost, že {player} řekne prodavači „tobě taky“, když mu popřeje dobrou chuť?",
    "Na kolik procent by {player} dokázal(a) předstírat, že rozumí tématu, o kterém nemá ani ponětí?",
    "Jaká je šance, že {player} začne vyprávět příběh a zapomene, co vlastně chtěl(a) říct?",
    "Na kolik procent by {player} poznal(a) vlastní hlas v nahrávce a nezačal(a) pochybovat o své existenci?",
    "Jaká je pravděpodobnost, že {player} uklouzne na rovině, kde není vůbec nic?",
    "Na kolik procent by {player} zvládl(a) celý den předstírat, že je bohatý/á?",
    "Jaká je šance, že {player} omylem pošle screenshot konverzace přímo člověku, o kterém se baví?",
    "Na kolik procent by {player} dokázal(a) předstírat nemoc, aby nemusel(a) do práce, a pak se prozradit na Instagramu?",
    "Jaká je pravděpodobnost, že {player} začne smát v situaci, kdy se to absolutně nehodí?",

    // 🍻 Párty a alkohol
    "Na kolik procent je šance, že {player} po dvou drincích začne všem vysvětlovat, jak funguje vesmír?",
    "Jaká je pravděpodobnost, že {player} si objedná jídlo za cenu celého večera, protože má hlad?",
    "Na kolik procent by {player} zvládl(a) dělat DJ na párty, aniž by někoho naštval(a)?",
    "Jaká je šance, že {player} začne po půlnoci plánovat úplně nový život?",
    "Na kolik procent by {player} dokázal(a) přesvědčit celou hospodu, aby si s ním/ní zazpívala?",
    "Jaká je pravděpodobnost, že {player} řekne „dneska jen na jedno“ a skončí jako poslední?",
    "Na kolik procent by {player} přežil(a) karaoke, kdyby mu/jí někdo vypnul hudbu?",
    "Jaká je šance, že {player} začne po pár drincích rozdávat životní rady, přestože sám/sama nemá život pod kontrolou?",
    "Na kolik procent by {player} dokázal(a) celou noc tančit, aniž by znal(a) jediný krok?",
    "Jaká je pravděpodobnost, že {player} ztratí během jednoho večera telefon, klíče a důstojnost?",

    // ❤️ Vztahy a láska
    "Na kolik procent je šance, že {player} se zamiluje do člověka jen proto, že mu přinesl jídlo?",
    "Jaká je pravděpodobnost, že {player} si projde profil své tajné lásky až do roku 2017?",
    "Na kolik procent by {player} vydržel(a) týden bez toho, aby kontroloval(a), kdo mu/jí lajkuje fotky?",
    "Jaká je šance, že {player} odpustí nevěru, když dostane opravdu drahý dárek?",
    "Na kolik procent by {player} dokázal(a) poznat, že se jeho/její partner zlobí, jen podle tečky na konci zprávy?",
    "Jaká je pravděpodobnost, že {player} řekne „mně je to jedno“ a pak odmítne všechno, co mu/jí nabídneš?",
    "Na kolik procent by {player} zvládl(a) první rande bez jediné trapné věty?",
    "Jaká je šance, že {player} začne žárlit na fiktivní postavu z filmu?",
    "Na kolik procent by {player} dokázal(a) utajit novou známost před svými kamarády celý měsíc?",
    "Jaká je pravděpodobnost, že {player} napíše zprávu, smaže ji a napíše ji znovu desetkrát?",

    // 🧠 Zajímavé a nečekané
    "Na kolik procent by {player} dokázal(a) vyhrát soutěž, jejíž pravidla se dozví až na konci?",
    "Jaká je šance, že {player} jako první odhalí podvodníka v detektivce?",
    "Na kolik procent by {player} dokázal(a) přesvědčit mimozemšťany, že lidstvo stojí za záchranu?",
    "Jaká je pravděpodobnost, že {player} omylem založí vlastní náboženství?",
    "Na kolik procent by {player} zvládl(a) jeden den bez jediného zalhání?",
    "Jaká je šance, že {player} vyřeší záhadu vraždy dřív než policie, ale úplnou náhodou?",
    "Na kolik procent by {player} dokázal(a) přežít týden v minulosti bez moderních technologií?",
    "Jaká je pravděpodobnost, že {player} objeví nový vynález, když se bude jen snažit opravit starý?",
    "Na kolik procent by {player} dokázal(a) přesvědčit robota, že je člověk?",
    "Jaká je šance, že {player} omylem spustí mezinárodní konflikt jednou špatně pochopenou zprávou?",

    // 💸 Peníze a morální dilemata
    "Na kolik procent by {player} utratil(a) milion korun během jednoho týdne?",
    "Jaká je pravděpodobnost, že {player} půjčí kamarádovi peníze a pak se bude stydět si o ně říct?",
    "Na kolik procent by {player} přijal(a) milion korun za to, že ho/ji celý rok budou všichni oslovovat „Vaše Veličenstvo“?",
    "Jaká je šance, že {player} by vrátil(a) peněženku plnou peněz, kdyby v ní nebyly žádné doklady?",
    "Na kolik procent by {player} dokázal(a) žít měsíc s rozpočtem 500 Kč?",
    "Jaká je pravděpodobnost, že {player} koupí něco úplně zbytečného jen proto, že je to ve slevě?",
    "Na kolik procent by {player} přijal(a) práci, kde musí každý den nosit kostým obřího kuřete, za 100 000 Kč měsíčně?",
    "Jaká je šance, že {player} zatají výhru v loterii i před vlastní rodinou?",
    "Na kolik procent by {player} prodal(a) kamarádovo nejtrapnější tajemství za dovolenou zdarma?",
    "Jaká je pravděpodobnost, že {player} bude mít na účtu nulu ještě před výplatou?",

    // 💀 Černější humor a chaos
    "Na kolik procent by {player} dokázal(a) přesvědčit ostatní, že náhodný požár byl součástí jeho/jejího plánu?",
    "Jaká je pravděpodobnost, že {player} přežije hororový film jako první?",
    "Na kolik procent by {player} zvládl(a) týden předstírat, že je tajný agent?",
    "Jaká je šance, že {player} by se omylem stal(a) vůdcem kultu jen proto, že dobře mluví?",
    "Na kolik procent by {player} dokázal(a) zachovat klid, kdyby mu/jí někdo řekl, že svět skončí za hodinu?",
    "Jaká je pravděpodobnost, že {player} by se v apokalypse stal(a) větším nebezpečím pro vlastní tým než pro nepřátele?",
    "Na kolik procent by {player} dokázal(a) přesvědčit policii, že ukradené auto bylo jen nedorozumění?",
    "Jaká je šance, že {player} by se stal(a) záporákem jen kvůli jedné nepovedené hádce?",
    "Na kolik procent by {player} přežil(a) výslech, kdyby nesměl(a) lhát, ale mohl(a) odpovídat jen otázkami?",
    "Jaká je pravděpodobnost, že {player} by při útěku před zombie zakopl(a) o vlastní nohu?",

    // 🤡 Osobnost a kamarádi
    "Na kolik procent by {player} dokázal(a) přežít celý den bez toho, aby si na něco stěžoval(a)?",
    "Jaká je šance, že {player} tajně považuje sám/sama sebe za nejchytřejšího člověka v místnosti?",
    "Na kolik procent by {player} zvládl(a) být slavný/á, aniž by mu/jí stoupla sláva do hlavy?",
    "Jaká je pravděpodobnost, že {player} se pohádá s navigací a stejně pojede špatně?",
    "Na kolik procent by {player} dokázal(a) poznat kamaráda podle smíchu přes celou hospodu?",
    "Jaká je šance, že {player} by se stal(a) virálním hitem internetu kvůli něčemu naprosto trapnému?",
    "Na kolik procent by {player} zvládl(a) celý den odpovídat na každou otázku naprosto upřímně?",
    "Jaká je pravděpodobnost, že {player} řekne „já to říkal(a)“ ještě dřív, než se něco pokazí?",
    "Na kolik procent by {player} dokázal(a) týden fungovat, kdyby mu/jí někdo zakázal používat Google?",
    "Jaká je šance, že {player} by omylem urazil(a) člověka, kterého se právě snaží sbalit?",

    // 🦆 Totální absurdita
    "Na kolik procent by {player} vyhrál(a) soudní spor proti vlastní kočce?",
    "Jaká je pravděpodobnost, že {player} by se stal(a) starostou/starostkou malé vesnice díky jednomu povedenému vtipu?",
    "Na kolik procent by {player} dokázal(a) naučit slepici aportovat?",
    "Jaká je šance, že {player} by se pokusil(a) utéct před holubem, který se na něj/ni podezřele dívá?",
    "Na kolik procent by {player} dokázal(a) vyhrát hádku s dítětem ve věku pěti let?",
    "Jaká je pravděpodobnost, že {player} omylem koupí pozemek v jiné zemi, protože nečetl(a) smlouvu?",
    "Na kolik procent by {player} zvládl(a) předstírat, že je odborník na tučňáky před skutečným odborníkem?",
    "Jaká je šance, že {player} by dokázal(a) prodat led Eskymákům a ještě na tom vydělat?",
    "Na kolik procent by {player} přežil(a) týden, kdyby každé jeho/její slovo zpíval operní pěvec?",
    "Jaká je pravděpodobnost, že {player} omylem založí firmu, která začne vydělávat miliardy?"
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
