import { db, ref, set, onValue, update } from "../firebase-config.js?v=13";
import { state } from "../app.js?v=13";

const MIN_DICE = 1;
const MAX_DICE = 10;
const DEFAULT_DICE = 2;
const MAX_HISTORY = 5;

// Pozice puntíků v 3x3 mřížce (indexy 0..8)
const PIP_MAP = {
    1: [4],
    2: [2, 6],
    3: [2, 4, 6],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
};

let latestData = null;
let lastAnimatedRollId = null;
let hasReceivedInitialSnapshot = false;
let isAnimating = false;
let activeTimers = [];

const toArr = (v) => (Array.isArray(v) ? v : v ? Object.values(v) : []);

function clearAllTimers() {
    for (const t of activeTimers) {
        clearTimeout(t);
        clearInterval(t);
    }
    activeTimers = [];
    isAnimating = false;
}

function clampDiceCount(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return DEFAULT_DICE;
    return Math.min(MAX_DICE, Math.max(MIN_DICE, Math.round(num)));
}

function formatDiceWord(count) {
    if (count === 1) return "1 kostka";
    if (count >= 2 && count <= 4) return `${count} kostky`;
    return `${count} kostek`;
}

function formatRollButtonLabel(count) {
    if (count === 1) return "🎲 HODIT 1 KOSTKOU";
    return `🎲 HODIT ${count} KOSTKAMI`;
}

function buildDieFaceHtml(value, isPreview = false) {
    if (isPreview || !PIP_MAP[value]) {
        return `<div class="kostka-preview-mark">?</div>`;
    }
    const activePips = PIP_MAP[value];
    let cells = "";
    for (let idx = 0; idx < 9; idx++) {
        if (activePips.includes(idx)) {
            const extraCls = value === 1 ? " pip-one" : "";
            cells += `<span class="kostka-pip${extraCls}"></span>`;
        } else {
            cells += `<span class="kostka-pip-empty"></span>`;
        }
    }
    return `<div class="kostka-pips">${cells}</div>`;
}

function getSpecialBadge(values) {
    if (!values || values.length < 2) return null;
    const allSame = values.every(v => v === values[0]);
    if (allSame && values[0] === 6) {
        return { cls: "badge-jackpot", text: "🔥 JACKPOT! Samé šestky!" };
    }
    if (allSame && values[0] === 1) {
        return { cls: "badge-unlucky", text: "💀 Samé jedničky!" };
    }
    if (allSame) {
        return { cls: "badge-special", text: `✨ Všechny kostky stejné (${values[0]})!` };
    }
    const maxPossible = values.length * 6;
    const sum = values.reduce((acc, v) => acc + v, 0);
    if (sum >= maxPossible - values.length && values.length >= 3) {
        return { cls: "badge-high", text: "⚡ Parádní vysoký hod!" };
    }
    return null;
}

export function initKostky() {
    const container = document.getElementById("kostky-content");
    if (!container) return;

    hasReceivedInitialSnapshot = false;
    lastAnimatedRollId = null;
    clearAllTimers();

    renderKostky(container, null, false);

    const kostkyRef = ref(db, `rooms/${state.roomId}/games/kostky`);
    onValue(kostkyRef, (snapshot) => {
        const data = snapshot.val();
        latestData = data;

        if (!data) {
            clearAllTimers();
            lastAnimatedRollId = null;
            hasReceivedInitialSnapshot = true;
            renderKostky(container, null, false);
            return;
        }

        const rollId = data.rollId || 0;
        const values = toArr(data.values).map(Number).filter(v => v >= 1 && v <= 6);

        let shouldAnimate = false;
        if (rollId && values.length > 0 && rollId !== lastAnimatedRollId) {
            // Při prvním načtení stránky animujeme jen pokud hod proběhl právě teď (do 2,5 s)
            const isFreshRoll = data.rolledAt && (Date.now() - data.rolledAt < 2500);
            if (hasReceivedInitialSnapshot || isFreshRoll) {
                shouldAnimate = true;
            }
            lastAnimatedRollId = rollId;
        }

        hasReceivedInitialSnapshot = true;

        // Pokud právě běží animace a změnil se jen počet kostek (ne rollId), nepřerušujeme ji
        if (isAnimating && !shouldAnimate) {
            updateHostSelectorOnly(container, data);
            return;
        }

        renderKostky(container, data, shouldAnimate);
    });

    // Pokud se v průběhu hry změní hostitel místnosti, překreslíme ovládání
    const hostRef = ref(db, `rooms/${state.roomId}/host`);
    onValue(hostRef, () => {
        if (!isAnimating) {
            renderKostky(container, latestData, false);
        } else {
            updateHostSelectorOnly(container, latestData);
        }
    });
}

function setDiceCount(newCount) {
    if (!state.isHost) return;
    const count = clampDiceCount(newCount);
    const kostkyRef = ref(db, `rooms/${state.roomId}/games/kostky`);

    if (!latestData) {
        set(kostkyRef, {
            diceCount: count,
            rollId: 0,
            values: [],
            sum: 0,
            rolledBy: null,
            rolledAt: null,
            history: []
        });
    } else {
        update(kostkyRef, {
            diceCount: count
        });
    }
}

function triggerRoll() {
    if (!state.isHost || isAnimating) return;

    const count = clampDiceCount(latestData?.diceCount ?? DEFAULT_DICE);
    const values = [];
    for (let i = 0; i < count; i++) {
        values.push(Math.floor(Math.random() * 6) + 1);
    }
    const sum = values.reduce((acc, v) => acc + v, 0);
    const prevHistory = toArr(latestData?.history);
    const nextHistory = [
        { sum, values, count, rolledBy: state.myName },
        ...prevHistory
    ].slice(0, MAX_HISTORY);

    const rollId = Date.now();

    set(ref(db, `rooms/${state.roomId}/games/kostky`), {
        diceCount: count,
        rollId,
        values,
        sum,
        rolledBy: state.myName,
        rolledAt: Date.now(),
        history: nextHistory
    });
}

function updateHostSelectorOnly(container, data) {
    const count = clampDiceCount(data?.diceCount ?? DEFAULT_DICE);
    container.querySelectorAll(".kostky-count-btn").forEach(btn => {
        const val = Number(btn.getAttribute("data-count"));
        btn.classList.toggle("active", val === count);
    });
    const rollBtn = container.querySelector("#btnRollKostky");
    if (rollBtn && !isAnimating) {
        rollBtn.textContent = formatRollButtonLabel(count);
    }
    const countLabel = container.querySelector("#kostkySelectedLabel");
    if (countLabel) {
        countLabel.textContent = formatDiceWord(count);
    }
    const viewerCount = container.querySelector("#kostkyViewerCount");
    if (viewerCount) {
        viewerCount.textContent = formatDiceWord(count);
    }
}

function renderKostky(container, data, shouldAnimate) {
    clearAllTimers();

    const selectedCount = clampDiceCount(data?.diceCount ?? DEFAULT_DICE);
    const values = toArr(data?.values).map(Number).filter(v => v >= 1 && v <= 6);
    const hasRoll = values.length > 0;
    const finalSum = hasRoll ? values.reduce((acc, v) => acc + v, 0) : 0;
    const history = toArr(data?.history);

    // Které kostky vykreslíme v misce (buď hozené hodnoty, nebo náhledové kostky před 1. hodem)
    const displayCount = hasRoll ? values.length : selectedCount;
    const trayDensityClass = displayCount >= 7 ? "density-compact" : displayCount >= 4 ? "density-medium" : "density-large";

    const specialBadge = (!shouldAnimate && hasRoll) ? getSpecialBadge(values) : null;

    // Horní karta se součtem
    let sumSubtitle = "";
    if (shouldAnimate) {
        sumSubtitle = `Hází se ${formatDiceWord(displayCount)}...`;
    } else if (hasRoll) {
        sumSubtitle = displayCount === 1
            ? `Hozeno 1 kostkou`
            : `${values.join(" + ")} = ${finalSum}`;
    } else {
        sumSubtitle = `Připraveno: ${formatDiceWord(selectedCount)}`;
    }

    const sumValueText = shouldAnimate
        ? String(Math.floor(Math.random() * (displayCount * 5)) + displayCount)
        : (hasRoll ? String(finalSum) : "—");

    // Jednotlivé kostky pod součtem
    const diceHtml = Array.from({ length: displayCount }, (_, idx) => {
        const val = hasRoll ? values[idx] : 0;
        const initialFace = shouldAnimate ? (Math.floor(Math.random() * 6) + 1) : val;
        const spinDir = idx % 2 === 0 ? 1 : -1;
        const tiltDeg = ((idx * 17) % 15) - 7;
        const bounceX = ((idx * 13) % 11) - 5;
        const animOffset = -((idx * 67) % 360);
        const dieClasses = [
            "kostka-die",
            !hasRoll ? "is-preview" : "",
            shouldAnimate ? "is-rolling" : "",
            !shouldAnimate && val === 6 ? "is-six" : ""
        ].filter(Boolean).join(" ");

        return `
            <div class="kostka-slot" data-die-idx="${idx}" style="--spin-dir:${spinDir}; --tilt:${tiltDeg}deg; --bx:${bounceX}px; --anim-offset:${animOffset}ms;">
                <div class="${dieClasses}" id="kostka-die-${idx}">
                    ${buildDieFaceHtml(initialFace, !hasRoll && !shouldAnimate)}
                </div>
                <div class="kostka-shadow ${shouldAnimate ? "is-rolling" : ""}" id="kostka-shadow-${idx}"></div>
                <div class="kostka-val-tag" id="kostka-tag-${idx}">
                    ${shouldAnimate ? "…" : (hasRoll ? val : "")}
                </div>
            </div>
        `;
    }).join("");

    // Ovládání pro hostitele (admina)
    const countButtonsHtml = Array.from({ length: MAX_DICE }, (_, i) => {
        const num = i + 1;
        const activeCls = num === selectedCount ? "active" : "";
        return `<button class="kostky-count-btn ${activeCls}" data-count="${num}" type="button">${num}</button>`;
    }).join("");

    const controlsHtml = state.isHost ? `
        <div class="kostky-admin-panel">
            <div class="kostky-admin-header">
                <span>⚙️ Počet kostek (1–10)</span>
                <strong id="kostkySelectedLabel">${formatDiceWord(selectedCount)}</strong>
            </div>
            <div class="kostky-count-grid">
                ${countButtonsHtml}
            </div>
            <button id="btnRollKostky" class="btn-kostky-roll" type="button" ${shouldAnimate ? "disabled" : ""}>
                ${shouldAnimate ? "🎲 HÁZÍ SE..." : formatRollButtonLabel(selectedCount)}
            </button>
        </div>
    ` : `
        <div class="kostky-viewer-bar">
            <span>🎲 Nastaveno: <strong id="kostkyViewerCount">${formatDiceWord(selectedCount)}</strong></span>
            <span class="pulse-text" id="kostkyViewerStatus">${shouldAnimate ? "Kostky letí..." : "Hází hostitel"}</span>
        </div>
    `;

    // Historie posledních hodů (během animace skryjeme nejnovější výsledek, ať neprozradí součet předem)
    const historyHtml = history.length > 1 ? `
        <div class="kostky-history-box" id="kostkyHistoryBox">
            <div class="kostky-history-title">🕒 Poslední hody</div>
            <div class="kostky-history-list">
                ${history.map((item, idx) => {
                    const itemVals = toArr(item.values);
                    const isLatest = idx === 0;
                    const hideNow = isLatest && shouldAnimate;
                    return `
                        <div class="kostky-history-row ${isLatest ? "latest" : ""}" ${isLatest ? 'id="kostkyHistoryLatest"' : ""} ${hideNow ? 'style="display:none;"' : ""}>
                            <span class="kostky-history-sum">${item.sum}</span>
                            <span class="kostky-history-vals">[${itemVals.join(", ")}]</span>
                            <span class="kostky-history-meta">${formatDiceWord(item.count || itemVals.length)}</span>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    ` : "";

    container.innerHTML = `
        <div class="game-wide-box kostky-box">
            <h2 style="margin: 0 0 10px 0;">🎲 Kostky</h2>

            <div class="kostky-sum-card ${shouldAnimate ? "is-rolling" : (hasRoll ? "has-result" : "")}" id="kostkySumCard">
                <div class="kostky-sum-label">CELKOVÝ SOUČET</div>
                <div class="kostky-sum-number" id="kostkySumNumber">${sumValueText}</div>
                <div class="kostky-sum-sub" id="kostkySumSub">${sumSubtitle}</div>
                <div class="kostky-special-slot" id="kostkySpecialSlot">
                    ${specialBadge ? `<span class="kostky-special-badge ${specialBadge.cls}">${specialBadge.text}</span>` : ""}
                </div>
            </div>

            <div class="kostky-tray ${trayDensityClass}" id="kostkyTray">
                ${diceHtml}
            </div>

            ${controlsHtml}

            ${historyHtml}
        </div>
    `;

    // Event listenery pro hostitele
    if (state.isHost) {
        container.querySelectorAll(".kostky-count-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const count = Number(btn.getAttribute("data-count"));
                setDiceCount(count);
            });
        });

        const rollBtn = document.getElementById("btnRollKostky");
        if (rollBtn) {
            rollBtn.addEventListener("click", triggerRoll);
        }
    }

    if (shouldAnimate && hasRoll) {
        runRollAnimation(container, values, finalSum, selectedCount);
    }
}

function runRollAnimation(container, finalValues, finalSum, selectedCount) {
    isAnimating = true;
    if (navigator.vibrate) {
        navigator.vibrate([35, 45, 25]);
    }

    const count = finalValues.length;
    const sumCardEl = container.querySelector("#kostkySumCard");
    const sumNumEl = container.querySelector("#kostkySumNumber");
    const sumSubEl = container.querySelector("#kostkySumSub");
    const specialSlotEl = container.querySelector("#kostkySpecialSlot");

    const currentShown = finalValues.map(() => Math.floor(Math.random() * 6) + 1);
    const settled = new Array(count).fill(false);

    // Kaskádové dopadání kostek (celkem cca 850–1250 ms podle počtu)
    const baseLandMs = 680;
    const staggerMs = count > 1 ? Math.min(85, Math.floor(420 / count)) : 0;

    // Rychlé přeblikávání puntíků během hodu
    const spinInterval = setInterval(() => {
        let runningSum = 0;
        for (let i = 0; i < count; i++) {
            if (!settled[i]) {
                const nextFace = Math.floor(Math.random() * 6) + 1;
                currentShown[i] = nextFace;
                const dieEl = container.querySelector(`#kostka-die-${i}`);
                if (dieEl) {
                    dieEl.innerHTML = buildDieFaceHtml(nextFace, false);
                }
            }
            runningSum += currentShown[i];
        }
        if (sumNumEl) {
            sumNumEl.textContent = String(runningSum);
        }
    }, 70);
    activeTimers.push(spinInterval);

    // Postupné dopadnutí každé kostky
    for (let i = 0; i < count; i++) {
        const landAt = baseLandMs + i * staggerMs;
        const landTimer = setTimeout(() => {
            settled[i] = true;
            currentShown[i] = finalValues[i];

            const dieEl = container.querySelector(`#kostka-die-${i}`);
            const shadowEl = container.querySelector(`#kostka-shadow-${i}`);
            const tagEl = container.querySelector(`#kostka-tag-${i}`);

            if (dieEl) {
                dieEl.classList.remove("is-rolling");
                dieEl.innerHTML = buildDieFaceHtml(finalValues[i], false);
                dieEl.classList.add("is-landed");
                if (finalValues[i] === 6) {
                    dieEl.classList.add("is-six");
                }
            }
            if (shadowEl) {
                shadowEl.classList.remove("is-rolling");
            }
            if (tagEl) {
                tagEl.textContent = String(finalValues[i]);
                tagEl.classList.add("is-visible");
            }
        }, landAt);
        activeTimers.push(landTimer);
    }

    // Finální odhalení celkového součtu po dopadu poslední kostky
    const finishAt = baseLandMs + (count - 1) * staggerMs + 130;
    const finishTimer = setTimeout(() => {
        clearInterval(spinInterval);
        isAnimating = false;

        if (sumCardEl) {
            sumCardEl.classList.remove("is-rolling");
            sumCardEl.classList.add("has-result", "is-revealed");
        }
        if (sumNumEl) {
            sumNumEl.textContent = String(finalSum);
        }
        if (sumSubEl) {
            sumSubEl.textContent = count === 1
                ? "Hozeno 1 kostkou"
                : `${finalValues.join(" + ")} = ${finalSum}`;
        }
        if (specialSlotEl) {
            const badge = getSpecialBadge(finalValues);
            specialSlotEl.innerHTML = badge
                ? `<span class="kostky-special-badge ${badge.cls}">${badge.text}</span>`
                : "";
        }

        const rollBtn = container.querySelector("#btnRollKostky");
        if (rollBtn) {
            const liveCount = clampDiceCount(latestData?.diceCount ?? selectedCount);
            rollBtn.disabled = false;
            rollBtn.textContent = formatRollButtonLabel(liveCount);
        }

        const viewerStatus = container.querySelector("#kostkyViewerStatus");
        if (viewerStatus) {
            viewerStatus.textContent = "Hází hostitel";
        }

        const latestHistoryRow = container.querySelector("#kostkyHistoryLatest");
        if (latestHistoryRow) {
            latestHistoryRow.style.display = "";
        }

        if (navigator.vibrate) {
            navigator.vibrate(45);
        }
    }, finishAt);
    activeTimers.push(finishTimer);
}
