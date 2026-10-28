import { db, ref, set, onValue, update } from "../firebase-config.js";
import { state } from "../app.js?v=2";

// Databáze párty témat (žádné složité přemýšlení)
// Databáze párty témat (žádné složité přemýšlení)
const TOPICS = [
    // Původní témata
    "Značky piva",
    "Věci, které najdeš v lednici",
    "Značky aut",
    "Výmluvy, proč jsi přišel pozdě",
    "Věci, co děláš po 5 pivech",
    "Jídla z fastfoodu",
    "Zvířata na 4 nohách",
    "Věci v koupelně",
    "Filmy nebo seriály na Netflixu",
    "Města v ČR",
    "Věci, které jsou červené",
    "Důvody k rozchodu",
    "Co si vezmeš na pustý ostrov",
    "Povolání, co bych nechtěl dělat",
    "Alkoholické drinky a panáky",
    "Věci, co smrdí",
    "Slova začínající na P",
    "Co říkáš při sexu i u večeře",
    "Věci v kufru auta",
    "Hry na PC nebo mobil",
    "Značky oblečení",
    "Věci, co se dají koupit na benzínce",
    "Příchutě zmrzliny",

    // Jídlo a pití
    "Druhy pizzy",
    "Druhy těstovin",
    "Jídla, která umíš uvařit",
    "Věci, které jíš k snídani",
    "Sladkosti",
    "Značky limonád",
    "Příchutě chipsů",
    "Druhy sýrů",
    "Ovoce",
    "Zelenina",
    "Věci, které jíš rukama",
    "Jídla, která nemusíš",
    "Věci, které si objednáš v restauraci",
    "Nápoje bez alkoholu",
    "Věci, které najdeš v mrazáku",

    // Každodenní život
    "Věci, které najdeš v kabelce",
    "Věci, které najdeš v batohu",
    "Věci na pracovním stole",
    "Věci, které máš vedle postele",
    "Věci, které děláš hned po probuzení",
    "Věci, které děláš před spaním",
    "Věci, které zapomínáš doma",
    "Věci, které ztratíš nejčastěji",
    "Věci, které tě štvou",
    "Věci, které odkládáš na později",
    "Věci, které děláš, když se nudíš",
    "Věci, které nechceš půjčovat",
    "Věci, které máš vždycky u sebe",
    "Věci, které najdeš v supermarketu",
    "Věci, které se rozbijí v nejhorší chvíli",

    // Vztahy a trapasy
    "Výmluvy, proč neodepsat na zprávu",
    "Věci, které nechceš slyšet od partnera",
    "Důvody, proč někdo nedorazí na rande",
    "Nejhorší dárky k narozeninám",
    "Věci, které jsou trapné na prvním rande",
    "Věci, které děláš, když se ti někdo líbí",
    "Věty, kterými pokazíš rande",
    "Důvody k žárlivosti",
    "Věci, které tajíš před rodiči",
    "Výmluvy, proč jít dřív domů",
    "Věci, které nechceš vysvětlovat partnerovi",
    "Nejhorší komplimenty",
    "Věci, které dělají bývalí partneři",
    "Věci, které tě na druhých přitahují",
    "Věci, které tě na druhých štvou",

    // Party a humor
    "Věci, které děláš na párty",
    "Výmluvy po divokém večeru",
    "Věci, které se nesmí říkat šéfovi",
    "Nejhorší věci, které můžeš napsat do skupinového chatu",
    "Důvody, proč tě vyhodí z baru",
    "Věci, které uděláš pro 100 tisíc korun",
    "Věci, které bys nikdy neřekl babičce",
    "Nejhorší superschopnosti",
    "Věci, které bys nechtěl najít pod postelí",
    "Věci, které jsou podezřelé ve 3 ráno",
    "Věci, které bys neměl googlit v práci",
    "Nejhorší místa na usnutí",
    "Věci, které bys nechtěl slyšet od doktora",
    "Věci, které vypadají draze, ale nejsou",
    "Věci, které jsou zbytečně předražené",

    // Zábava a popkultura
    "Filmoví superhrdinové",
    "Disney postavy",
    "Hororové filmy",
    "Pohádky z dětství",
    "Reality show",
    "Známí čeští zpěváci",
    "Hudební skupiny",
    "Písničky, které zná každý",
    "Influenceři a youtubeři",
    "Postavy z videoher",
    "Deskové hry",
    "Sporty",
    "Známé značky telefonů",
    "Aplikace v mobilu",
    "Sociální sítě",

    // Škola a práce
    "Výmluvy, proč nemáš úkol",
    "Věci, které děláš místo učení",
    "Věci, které tě štvou ve škole",
    "Věci, které nesnášíš v práci",
    "Důvody, proč přijdeš pozdě do školy",
    "Věci, které najdeš v učebně",
    "Věci, které nesmíš říct učiteli",
    "Povolání, která dobře vydělávají",
    "Věci, které děláš o přestávce",
    "Věci, které máš v penálu",

    // Cestování a místa
    "Země v Evropě",
    "Hlavní města",
    "Místa na dovolenou",
    "Věci, které si balíš na dovolenou",
    "Věci na pláži",
    "Věci, které najdeš na letišti",
    "Dopravní prostředky",
    "Věci, které tě štvou v autě",
    "Věci, které najdeš v hotelu",
    "Místa, kam nechceš jet na dovolenou",

    // Záludná a rychlá témata
    "Slova začínající na B",
    "Slova začínající na K",
    "Věci, které jsou kulaté",
    "Věci, které jsou malé",
    "Věci, které vydávají zvuk",
    "Věci, které létají",
    "Věci, které se pohybují rychle",
    "Věci, které mají tlačítka",
    "Věci, které mají kola",
    "Věci, které najdeš pod vodou",
    "Věci, které svítí",
    "Věci, které jsou drahé",
    "Věci, které jsou studené",
    "Věci, které se nevejdou do kapsy",
    "Věci, které mají čtyři písmena",

    "Věci, které bys nechtěl slyšet od pilota",
    "Nejhorší jména pro domácí mazlíčky",
    "Věci, které by neměly být ve sprše",
    "Důvody, proč tě zatkne policie",
    "Věci, které bys nechtěl vysvětlovat babičce",
    "Nejhorší věci, které můžeš říct při pohovoru",
    "Věci, které vypadají jako něco jiného",
    "Věci, které bys nechtěl mít jako tetování",
    "Nejhorší věci, které můžeš najít v lednici",
    "Věci, které bys nechtěl dostat k Vánocům",
    "Věci, které by neměly mít vlastní Instagram",
    "Věci, které bys nikdy neudělal za milion",
    "Nejhorší místa pro první pusu",
    "Věci, které jsou divné, když je děláš sám",
    "Věci, které nechceš slyšet v noci",
    "Nejhorší věci, které můžeš říct při svatbě",
    "Věci, které bys nechtěl mít ve svém pokoji",
    "Věci, které by neměly existovat",
    "Nejhorší důvody pro zrušení dovolené",
    "Věci, které jsou podezřelé, když je někdo dělá",

    // Vztahy a randění
    "Věci, které prozradí, že se ti někdo líbí",
    "Nejhorší zprávy, které můžeš dostat od partnera",
    "Věci, které nechceš vidět v partnerově mobilu",
    "Věci, které děláš, když čekáš na odpověď",
    "Nejhorší místa na romantickou večeři",
    "Věci, které pokazí romantickou chvíli",
    "Výmluvy, proč nechceš představit partnera rodičům",
    "Věci, které jsou na vztahu nejtěžší",
    "Věci, které dělají lidé po rozchodu",
    "Nejhorší otázky na prvním rande",
    "Věci, které jsou ve vztahu přeceňované",
    "Věci, kvůli kterým se páry hádají",
    "Nejhorší přezdívky pro partnera",
    "Věci, které tě okamžitě odradí od člověka",
    "Věci, které jsou romantické jen ve filmu",

    // Sociální situace
    "Věci, které děláš, když neznáš nikoho na párty",
    "Výmluvy, proč nezvednout telefon",
    "Věci, které předstíráš, že tě zajímají",
    "Věci, které děláš, když někdo vypráví nudný příběh",
    "Nejhorší otázky od příbuzných",
    "Věci, které nechceš sdílet s ostatními",
    "Věci, které děláš, když se cítíš trapně",
    "Situace, kdy předstíráš, že něčemu rozumíš",
    "Věci, které říkáš, když nevíš, co odpovědět",
    "Věci, které děláš, abys vypadal chytře",
    "Nejhorší chvíle, kdy ti zazvoní telefon",
    "Věci, které nechceš dělat před cizími lidmi",
    "Věci, které jsou trapné před rodiči partnera",
    "Důvody, proč odejít z návštěvy",
    "Věci, které děláš, když tě někdo přistihne",

    // Peníze a nakupování
    "Věci, za které utrácíš zbytečně moc peněz",
    "Věci, které by sis koupil při výhře v loterii",
    "Věci, na kterých se nevyplatí šetřit",
    "Věci, které si kupuješ, i když je nepotřebuješ",
    "Věci, které jsou dražší, než by měly být",
    "Nejhorší věci, na které utratit výplatu",
    "Věci, které si půjčuješ od kamarádů",
    "Věci, které bys prodal za dobrou cenu",
    "Věci, které by sis koupil jako milionář",
    "Věci, které stojí víc než 10 000 Kč",
    "Věci, které najdeš ve slevě",
    "Věci, které si lidé kupují na Vánoce",
    "Věci, které se nevyplatí kupovat použité",
    "Věci, které si koupíš na poslední chvíli",
    "Věci, které si lidé tajně objednávají online",

    // Domácnost a běžné věci
    "Věci, které se ztrácejí v domácnosti",
    "Věci, které se nikdy neuklízí",
    "Věci, které najdeš ve sklepě",
    "Věci, které najdeš na půdě",
    "Věci, které potřebují baterky",
    "Věci, které se zapojují do zásuvky",
    "Věci, které mají dálkové ovládání",
    "Věci, které se snadno rozbijí",
    "Věci, které se těžko čistí",
    "Věci, které se lepí",
    "Věci, které jsou pořád mokré",
    "Věci, které vydrží věčnost",
    "Věci, které najdeš v šuplíku s harampádím",
    "Věci, které se dají složit",
    "Věci, které používáš každý den, ale nevšímáš si jich",

    // Jídlo – další inspirace
    "Druhy dortů",
    "Pokrmy, které se jedí hůlkami",
    "Jídla, která chutnají lépe druhý den",
    "Věci, které si dáváš na chleba",
    "Ingredience do salátu",
    "Jídla, která jíš na festivalu",
    "Věci, které se jí na Vánoce",
    "Jídla, která děti obvykle nemají rády",
    "Věci, které si dáváš do kávy",
    "Pokrmy, které obsahují sýr",
    "Jídla, která jsou nejlepší v noci",
    "Věci, které se dají grilovat",
    "Pokrmy, které jsou typické pro Česko",
    "Věci, které jíš na cestách",
    "Jídla, která vypadají lépe než chutnají",

    // Příroda a zvířata
    "Zvířata, která žijí v lese",
    "Zvířata, která umí plavat",
    "Zvířata, která bys nechtěl potkat v přírodě",
    "Zvířata, která lidé chovají doma",
    "Zvířata, která vydávají hlasité zvuky",
    "Věci, které najdeš v lese",
    "Věci, které rostou na zahradě",
    "Věci, které najdeš na louce",
    "Přírodní katastrofy",
    "Věci, které můžeš najít na horách",
    "Věci, které létají v noci",
    "Druhy hmyzu",
    "Věci, které najdeš u rybníka",
    "Věci, které rostou na stromech",
    "Věci, které si spojuješ s létem",

    // Sport a volný čas
    "Sportovci, které zná každý",
    "Věci, které potřebuješ do posilovny",
    "Cvičení, která znáš z tělocviku",
    "Věci, které děláš o víkendu",
    "Koníčky, které můžeš dělat doma",
    "Věci, které si bereš na festival",
    "Věci, které děláš na dovolené",
    "Sportovní vybavení",
    "Věci, které děláš, když prší",
    "Aktivity, které můžeš dělat ve dvou",
    "Věci, které tě dokážou zabavit na celé hodiny",
    "Věci, které sbírají lidé",
    "Věci, které můžeš dělat bez internetu",
    "Věci, které děláš, když máš volný den",
    "Věci, které se dají dělat v noci",

    // Technologie a internet
    "Důvody, proč se vybije telefon",
    "Věci, které hledáš na Googlu",
    "Věci, které posíláš přes chat",
    "Věci, které tě štvou na internetu",
    "Důvody, proč je počítač pomalý",
    "Věci, které děláš na mobilu na záchodě",
    "Aplikace, bez kterých si neumíš představit den",
    "Věci, které můžeš zapomenout v cloudu",
    "Věci, které děláš, když vypadne internet",
    "Nejhorší hesla, která lidé používají",
    "Věci, které nechceš omylem poslat do skupiny",
    "Důvody, proč se zasekne videohovor",
    "Věci, které zabírají místo v telefonu",
    "Věci, které si ukládáš do záložek",
    "Věci, které se dají dělat s umělou inteligencí",

    // Práce a škola – další
    "Výmluvy, proč nemáš hotový projekt",
    "Věci, které děláš, když tě nikdo nekontroluje",
    "Věci, které nesmí chybět v kanceláři",
    "Věci, které se učíš na poslední chvíli",
    "Věci, které dělají studenti během přednášky",
    "Věci, které najdeš ve školní jídelně",
    "Věci, které tě stresují před zkouškou",
    "Důvody, proč změnit práci",
    "Věci, které říká šéf pořád dokola",
    "Věci, které se dějí na firemním večírku",

    // Těžší a kreativní témata
    "Věci, které bys zachránil při požáru",
    "Věci, které bys vzal na cestu časem",
    "Věci, které bys zakázal na jeden den",
    "Věci, které bys změnil na světě",
    "Věci, které bys udělal, kdybys byl neviditelný",
    "Věci, které bys dělal, kdybys vyhrál milion",
    "Věci, které bys chtěl umět okamžitě",
    "Věci, které bys nikdy nezkusil",
    "Věci, které bys chtěl zažít alespoň jednou",
    "Věci, které bys vynalezl, kdybys mohl",
    "Věci, které bys dělal, kdybys byl na den prezidentem",
    "Věci, které bys změnil na své škole",
    "Věci, které bys udělal, kdybys měl den bez pravidel",
    "Věci, které bys chtěl vědět o budoucnosti",
    "Věci, které bys dělal, kdybys mohl zastavit čas"
];

const SYLLABLES = [
    // --- Slabiky ---
    "TRA", "KOS", "BAR", "LES", "ROK", "PIV", "VOD", "TAK", 
    "KOL", "PAN", "NOS", "PES", "LET", "POT", "ZUB", "MYŠ", 
    "LAK", "DŮM", "VŮZ", "ČAJ", "MED", "RAK", "ZEĎ", "SUK",
    "STR", "VRB", "VLK", "HRU", "NOV", "SRD", "BYT", "MYT",
    "BOD", "LOD", "MOD", "POD", "ROD", "KRYT", "ŽIT", "MÍD",
    "KAH", "VAK", "PAK", "MAK", "JAK", "ZAK", "TOK", "BOK",
    "MOK", "ROK", "TOK", "ZOK", "HLAS", "VLNA", "HRAD", "KRÁL",
    
    // --- Abeceda (písmena) ---
    "A", "B", "C", "Č", "D", "E", "F", "G", "H", "CH", "I", "J", 
    "K", "L", "M", "N", "O", "P", "R", "Ř", "S", "Š", "T", "U", 
    "V", "Z", "Ž"
];

let explosionChecker = null;

export function initBomba() {
    const container = document.getElementById("bomba-content");
    const bombaRef = ref(db, `rooms/${state.roomId}/games/bomba`);

    // Posluchač na stav hry Bomba
    onValue(bombaRef, (snapshot) => {
        const data = snapshot.val();

        // Pokud hra ještě nebyla odstartována, ukážeme úvodní obrazovku Bomby
        if (!data || data.status === "waiting") {
            clearExplosionTimer();
            document.body.className = "";
            renderWaiting(container);
            return;
        }

        // Pokud bomba vybuchla
        if (data.status === "exploded") {
            clearExplosionTimer();
            renderExploded(container, data);
            return;
        }

        // Pokud hra běží (status === "running")
        if (data.status === "running") {
            renderRunning(container, data);
            startExplosionWatcher(data.explodeAt);
        }
    });
}

// 1. OBRAZOVKA PŘED STARTEM KOLA
function renderWaiting(container) {
    container.innerHTML = `
        <div class="bomba-box">
            <h1>💣 Horký Brambor</h1>
            <p>Řekni slovo podle zadání dřív, než bomba bouchne, a okamžitě ji předej dál!</p>
            ${getHostButtonsHtml()}
        </div>
    `;
    bindHostButtons();
}
// 2. OBRAZOVKA BĚHEM HRY
function renderRunning(container, data) {
    const amIHolding = data.holder === state.myName;

    if (amIHolding) {
        document.body.className = "holding-bomb";
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

        container.innerHTML = `
            <div class="bomba-box">
                <h2>🔥 MÁŠ BOMBU! 🔥</h2>
                <div class="topic-card">
                    <div class="topic-label" style="font-size: 1.2rem; color: #fbbf24; font-weight: bold;">
                        ${data.categoryLabel || "Řekni nahlas:"}
                    </div>
                    <div class="topic-text">${data.topic}</div>
                </div>
                <button id="btnPassBomb" class="btn-pass-bomb">PŘEDAT DÁL! 👉</button>
            </div>
        `;

        document.getElementById("btnPassBomb").addEventListener("click", () => {
            passBomb(data.holder, data.mode, data.topic);
        });
    } else {
        document.body.className = "";
        container.innerHTML = `
            <div class="bomba-box">
                <h2>Jsi v bezpečí 😌</h2>
                <div class="topic-card">
                    <div class="topic-label" style="font-size: 1.1rem; color: #fbbf24;">
                        ${data.categoryLabel || "Aktuální téma:"}
                    </div>
                    <div class="topic-text">${data.topic}</div>
                </div>
                <p style="font-size: 1.4rem;">Bombu teď drží:<br><strong style="font-size: 2rem; color: #fbbf24;">${data.holder}</strong></p>
                <p class="pulse-text">Tik, tak, tik, tak...</p>
            </div>
        `;
    }
}

// 3. OBRAZOVKA PO VÝBUCHU
function renderExploded(container, data) {
    const didILose = data.holder === state.myName;
    document.body.className = didILose ? "exploded-screen" : "";

    if (didILose && navigator.vibrate) {
        navigator.vibrate([600, 150, 600]);
    }

    container.innerHTML = `
        <div class="bomba-box">
            <h1 style="font-size: 4rem; margin: 0;">💥</h1>
            <h2>${didILose ? "BOUCHLO TI TO V RUCE!" : "BUM! Konec kola!"}</h2>
            <p style="font-size: 1.5rem;">
                Poražený tohoto kola je:<br>
                <strong style="font-size: 2.2rem; color: #fbbf24;">${data.holder}</strong> 🍻
            </p>
            <div class="topic-card">
                <div class="topic-label">${data.categoryLabel || "Zadání bylo:"}</div>
                <div class="topic-text">${data.topic}</div>
            </div>
            ${getHostButtonsHtml()}
        </div>
    `;
    bindHostButtons();
}

// --- HERNÍ AKCE ---

function generateTask(selectedMode = "mix", previousTopic = null) {
    let categoryLabel = "";
    let taskText = "";

    do {
        // Pokud dal Host "mix", náhodně vylosujeme buď téma, nebo slabiku
        let finalMode = selectedMode;
        if (selectedMode === "mix") {
            finalMode = Math.random() < 0.5 ? "topics" : "syllables";
        }

        if (finalMode === "topics") {
            categoryLabel = "Vymysli slovo na téma:";
            taskText = TOPICS[Math.floor(Math.random() * TOPICS.length)];
        } else if (finalMode === "syllables") {
            // Klasická bomba: Určí se i kde má slabika ve slově být
            const positions = [
                "Slovo ZAČÍNÁ na:",
                "Slovo KONČÍ na:",
                "Slovo OBSAHUJE KDEKOLIV:"
            ];
            categoryLabel = positions[Math.floor(Math.random() * positions.length)];
            const syl = SYLLABLES[Math.floor(Math.random() * SYLLABLES.length)];
            taskText = `"${syl}"`;
        }
    } while (taskText === previousTopic);

    return { categoryLabel, topic: taskText };
}

function startNewRound(selectedMode = "mix") {
    if (state.players.length === 0) return;

    const randomPlayer = state.players[Math.floor(Math.random() * state.players.length)];
    const randomDurationMs = (Math.floor(Math.random() * 23) + 15) * 1000;
    const explodeAt = Date.now() + randomDurationMs;

    const { categoryLabel, topic } = generateTask(selectedMode);

    set(ref(db, `rooms/${state.roomId}/games/bomba`), {
        status: "running",
        mode: selectedMode,
        categoryLabel: categoryLabel,
        topic: topic,
        holder: randomPlayer,
        explodeAt: explodeAt
    });
}

function passBomb(currentHolder, currentMode = "mix", currentTopic = null) {
    // Vybereme kohokoliv jiného než toho, kdo bombu právě drží
    let candidates = state.players.filter(p => p !== currentHolder);
    
    // Pojistka: Pokud to testuješ sám v místnosti (1 hráč), předá se to tobě
    if (candidates.length === 0) {
        candidates = state.players;
    }

    const nextHolder = candidates[Math.floor(Math.random() * candidates.length)];
    const { categoryLabel, topic } = generateTask(currentMode, currentTopic);

    update(ref(db, `rooms/${state.roomId}/games/bomba`), {
        holder: nextHolder,
        categoryLabel: categoryLabel,
        topic: topic
    });
}

// Hlídač času výbuchu (kontroluje každých 250ms, zda už nevypršel čas)
function startExplosionWatcher(explodeAt) {
    clearExplosionTimer();
    explosionChecker = setInterval(() => {
        if (Date.now() >= explodeAt) {
            clearExplosionTimer();
            update(ref(db, `rooms/${state.roomId}/games/bomba`), {
                status: "exploded"
            });
        }
    }, 250);
}

function clearExplosionTimer() {
    if (explosionChecker) {
        clearInterval(explosionChecker);
        explosionChecker = null;
    }
}
function getHostButtonsHtml() {
    if (!state.isHost) {
        return `<p class="pulse-text">Hostitel vybírá režim dalšího kola...</p>`;
    }
    return `
        <div style="margin-top: 20px;">
            <p style="margin-bottom: 8px; color: #9ca3af;">Vyber režim a odpal bombu:</p>
            <button class="btn-game btn-mode" data-mode="topics" style="background: #3b82f6; margin: 6px 0;">🗂️ Jen Témata</button>
            <button class="btn-game btn-mode" data-mode="syllables" style="background: #8b5cf6; margin: 6px 0;">🔤 Jen Slabiky (Slova)</button>
            <button class="btn-game btn-mode" data-mode="mix" style="background: #10b981; margin: 6px 0;">🎲 Náhodný Mix</button>
        </div>
    `;
}
function bindHostButtons() {
    if (!state.isHost) return;
    document.querySelectorAll(".btn-mode").forEach(btn => {
        btn.addEventListener("click", () => {
            const selectedMode = btn.getAttribute("data-mode");
            startNewRound(selectedMode);
        });
    });
}