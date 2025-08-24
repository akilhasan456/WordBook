/* =============== Utilities =============== */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const API = word => `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;

const storage = {
  get theme(){ return localStorage.getItem("lexi-theme") || "dark"; },
  set theme(v){ localStorage.setItem("lexi-theme", v); },
  get history(){
    try { return JSON.parse(localStorage.getItem("lexi-history") || "[]"); }
    catch { return []; }
  },
  set history(list){ localStorage.setItem("lexi-history", JSON.stringify(list.slice(0, 20))); }
};

const randomWords = [
  "serendipity","ephemeral","eloquent","sonder","luminous","catalyst","zenith",
  "mellifluous","aesthetic","resilience","quintessential","sonder","labyrinth",
  "sonder","epiphany","solace","sonder","ineffable","sonder","sonder"
];

/* =============== Theme =============== */
function applyTheme(theme){
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
}
function toggleTheme(){
  const next = storage.theme === "dark" ? "light" : "dark";
  storage.theme = next;
  applyTheme(next);
}

/* =============== Ripple animation =============== */
function addRipple(e){
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = `${size}px`;
  const x = e.clientX - rect.left - size/2;
  const y = e.clientY - rect.top - size/2;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  btn.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
}

/* =============== History =============== */
function pushHistory(word){
  let list = storage.history.filter(w => w.toLowerCase() !== word.toLowerCase());
  list.unshift(word);
  storage.history = list;
  renderHistory();
}
function renderHistory(){
  const wrap = $("#historyList");
  wrap.innerHTML = "";
  storage.history.forEach(w => {
    const pill = document.createElement("button");
    pill.className = "pill";
    pill.textContent = w;
    pill.addEventListener("click", () => search(w));
    wrap.appendChild(pill);
  });
}

/* =============== Rendering =============== */
function createCard(){
  const tpl = $("#cardTemplate");
  return tpl.content.firstElementChild.cloneNode(true);
}

function renderResult(entry){
  const { word, phonetics = [], meanings = [], sourceUrls = [] } = entry;
  const card = createCard();
  $(".word", card).textContent = word;

  const phoneticTxt =
    phonetics.find(p => p.text)?.text ||
    meanings[0]?.definitions?.[0]?.definition?.match(/\/.*\//)?.[0] ||
    "";
  $(".phonetic", card).textContent = phoneticTxt;

  // Audio
  const audioUrl =
    phonetics.find(p => p.audio)?.audio ||
    phonetics.find(p => p.sourceUrl)?.sourceUrl ||
    "";

  const playBtn = $(".playBtn", card);
  if (audioUrl){
    const audio = new Audio(audioUrl);
    playBtn.addEventListener("click", () => audio.play().catch(()=>{}));
    playBtn.addEventListener("pointerdown", addRipple);
  } else {
    playBtn.disabled = true;
    playBtn.title = "No audio available";
    playBtn.style.opacity = 0.5;
  }

  // Part of speech header
  const pos = meanings.map(m => m.partOfSpeech).filter(Boolean).join(" • ");
  $(".pos", card).textContent = pos ? pos : "";

  // Definitions list
  const list = $(".defs", card);
  meanings.forEach(m => {
    (m.definitions || []).slice(0, 4).forEach((d, i) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${d.definition}</span>
        ${d.example ? `<span class="example">“${d.example}”</span>` : ""}
      `;
      list.appendChild(li);
    });
  });

  // Synonyms chips
  const synWrap = $(".syns", card);
  const syns = new Set();
  meanings.forEach(m => (m.synonyms || []).forEach(s => syns.add(s)));
  if (syns.size){
    syns.forEach(s => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.textContent = s;
      chip.addEventListener("click", () => search(s));
      synWrap.appendChild(chip);
    });
  }

  // Source
  const src = $(".source", card);
  if (sourceUrls?.length){
    src.innerHTML = `Source: <a href="${sourceUrls[0]}" target="_blank" rel="noopener">${new URL(sourceUrls[0]).hostname}</a>`;
  }

  $("#results").appendChild(card);
}

function renderLoading(){
  const r = $("#results");
  r.innerHTML = `
    <article class="card">
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="spinner" style="width:18px;height:18px;border:2px solid rgba(255,255,255,0.3);border-top-color: var(--accent2);border-radius:50%;animation:spin 1s linear infinite;"></div>
        <span>Looking up…</span>
      </div>
    </article>
  `;
}
function renderError(message){
  const r = $("#results");
  r.innerHTML = `
    <article class="card">
      <strong>Oops.</strong> ${message}
    </article>
  `;
}
const styleSpin = document.createElement("style");
styleSpin.textContent = `@keyframes spin{to{transform:rotate(360deg)}}`;
document.head.appendChild(styleSpin);

/* =============== Search Logic =============== */
async function search(raw){
  const word = (raw || $("#query").value || "").trim();
  if (!word) return;
  $("#results").innerHTML = "";
  renderLoading();
  try{
    const res = await fetch(API(word));
    if (!res.ok) throw new Error(`No results found for “${word}”.`);
    const data = await res.json();
    $("#results").innerHTML = "";
    const entries = Array.isArray(data) ? data : [];
    if (!entries.length) throw new Error(`No results found for “${word}”.`);
    entries.slice(0, 2).forEach(renderResult); // show up to 2 entries for brevity
    pushHistory(word);
  }catch(err){
    renderError(err.message || "Something went wrong. Please try again.");
  }
}

/* =============== Events =============== */
function wireButtons(){
  $$("#searchBtn, #randomBtn, #clearBtn, #themeToggle, .playBtn").forEach(btn=>{
    btn?.addEventListener("pointerdown", addRipple);
  });
}

function init(){
  // Theme
  applyTheme(storage.theme);
  $("#themeToggle").addEventListener("click", toggleTheme);

  // History
  renderHistory();
  $("#clearHistory").addEventListener("click", () => {
    storage.history = [];
    renderHistory();
  });

  // Form
  $("#searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    search();
  });

  // Buttons
  $("#randomBtn").addEventListener("click", () => {
    const word = randomWords[Math.floor(Math.random() * randomWords.length)];
    $("#query").value = word;
    search(word);
  });
  $("#clearBtn").addEventListener("click", () => {
    $("#query").value = "";
    $("#results").innerHTML = "";
  });

  wireButtons();

  // Optional: focus input on load for desktop
  if (window.innerWidth > 880) $("#query").focus();
}

document.addEventListener("DOMContentLoaded", init);
