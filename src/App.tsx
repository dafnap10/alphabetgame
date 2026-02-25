import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STORAGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function dbGet(key) {
  if (!window.storage) throw new Error("window.storage not available");
  try {
    const res = await window.storage.get(key, true);
    return res ? JSON.parse(res.value) : null;
  } catch { return null; }
}
async function dbSet(key, value) {
  if (!window.storage) throw new Error("window.storage not available");
  await window.storage.set(key, JSON.stringify(value), true);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function makeId() { return Math.random().toString(36).substring(2, 10); }
function randomLetter() { return "ABCDEFGHIJKLMNOPRSTW"[Math.floor(Math.random() * 20)]; }

const CATS  = ["Country","City","Animal","Food","Celebrity","Brand","Object"];
const ICONS = { Country:"🌍", City:"🏙️", Animal:"🦁", Food:"🍕", Celebrity:"⭐", Brand:"💼", Object:"📦" };
const QUEUE_KEY = "ag-queue-v1";

// ─────────────────────────────────────────────────────────────────────────────
// MATCHMAKING
// Join queue or pick up the first waiting player and start a room together.
// Queue entry: { id, name, joinedAt }
// ─────────────────────────────────────────────────────────────────────────────
async function enterQueue(myEntry) {
  // read queue, prune stale entries (> 60s old), add myself
  let q = await dbGet(QUEUE_KEY) || [];
  const now = Date.now();
  q = q.filter(e => now - e.joinedAt < 60000); // remove anyone waiting > 60s
  // check if someone else already waiting
  const opponent = q.find(e => e.id !== myEntry.id);
  if (opponent) {
    // remove opponent from queue
    q = q.filter(e => e.id !== opponent.id);
    await dbSet(QUEUE_KEY, q);
    // create room
    const room = {
      id: makeId(),
      letter: randomLetter(),
      status: "playing",
      players: [opponent.name, myEntry.name],
      playerIds: [opponent.id, myEntry.id],
      answers: {},
      validation: {}
    };
    await dbSet(`ag-room:${room.id}`, room);
    return { matched: true, room, opponentName: opponent.name };
  } else {
    // nobody waiting — add myself and wait
    q = q.filter(e => e.id !== myEntry.id); // dedup
    q.push(myEntry);
    await dbSet(QUEUE_KEY, q);
    return { matched: false };
  }
}

async function pollQueue(myId) {
  // check if someone created a room for me
  const q = await dbGet(QUEUE_KEY) || [];
  const stillInQueue = q.some(e => e.id === myId);
  if (!stillInQueue) {
    // I was removed from queue — someone matched with me, find my room
    return { removed: true };
  }
  return { removed: false };
}

async function findMyRoom(myId) {
  // scan recent rooms to find one that has myId
  // we store a "player rooms" index
  const idx = await dbGet(`ag-prooms:${myId}`) || [];
  for (const roomId of idx.reverse()) {
    const room = await dbGet(`ag-room:${roomId}`);
    if (room && room.playerIds.includes(myId) && room.status === "playing") {
      return room;
    }
  }
  return null;
}

async function indexRoomForPlayer(playerId, roomId) {
  const idx = await dbGet(`ag-prooms:${playerId}`) || [];
  idx.push(roomId);
  await dbSet(`ag-prooms:${playerId}`, idx);
}

async function removeFromQueue(myId) {
  let q = await dbGet(QUEUE_KEY) || [];
  q = q.filter(e => e.id !== myId);
  await dbSet(QUEUE_KEY, q);
}

// ─────────────────────────────────────────────────────────────────────────────
// AI VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
async function aiValidate(answers, letter) {
  const lines = CATS.map(c => `${c}: "${(answers[c]||"").trim()||"(empty)"}"`).join("\n");
  const prompt = `You are a strict judge for the word game "Stop/Alphabet Game".
Letter this round: "${letter}"

For each category validate:
1. Answer starts with "${letter}" (case-insensitive)
2. Answer genuinely belongs to the category (be strict — "Belgium" is a Country NOT a City, a person's name is NOT food, etc.)

Reply ONLY with minified JSON, no markdown:
{"Country":{"valid":true,"reason":"..."},"City":{"valid":false,"reason":"..."},"Animal":{"valid":true,"reason":"..."},"Food":{"valid":false,"reason":"..."},"Celebrity":{"valid":true,"reason":"..."},"Brand":{"valid":false,"reason":"..."},"Object":{"valid":true,"reason":"..."}}

Answers:
${lines}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const d = await r.json();
    const txt = (d.content||[]).map(b=>b.text||"").join("").replace(/```json|```/g,"").trim();
    return JSON.parse(txt);
  } catch {
    const fb = {};
    CATS.forEach(c => {
      const v = (answers[c]||"").trim();
      const ok = v.length >= 2 && v.toLowerCase().startsWith(letter.toLowerCase());
      fb[c] = { valid: ok, reason: ok ? "Valid" : "Invalid or empty" };
    });
    return fb;
  }
}

function totalScore(v) {
  if (!v) return 0;
  return Object.values(v).reduce((s, e) => s + (e?.valid ? 10 : 0), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0a0f;--surf:#12121a;--surf2:#1c1c28;--brd:#2a2a3d;
  --acc:#e8ff47;--red:#ff4757;--txt:#f0f0ff;--mute:#6b6b8a;--ok:#2dff8a;
}
body{background:var(--bg);color:var(--txt);font-family:'DM Sans',sans-serif}
.G{min-height:100vh;display:flex;flex-direction:column;align-items:center;background:var(--bg);overflow-x:hidden}
.noise{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.35;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")}
.S{position:relative;z-index:1;width:100%;max-width:480px;padding:0 16px}
.home{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh}
.logo{text-align:center;margin-bottom:48px}
.lbadge{display:inline-block;background:var(--acc);color:#0a0a0f;font-family:'Bebas Neue',sans-serif;font-size:11px;letter-spacing:3px;padding:4px 10px;margin-bottom:12px}
.ltitle{font-family:'Bebas Neue',sans-serif;font-size:clamp(64px,18vw,96px);line-height:.9;letter-spacing:-2px;background:linear-gradient(135deg,#f0f0ff 30%,var(--acc) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.lsub{color:var(--mute);font-size:14px;margin-top:8px;letter-spacing:1px}
.menu{display:flex;flex-direction:column;gap:12px;width:100%}
.btn{border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;font-size:16px;transition:all .15s;border-radius:4px;padding:16px 24px;display:flex;align-items:center;gap:12px;justify-content:center}
.btn:active{transform:scale(.97)}
.btn-p{background:var(--acc);color:#0a0a0f;box-shadow:0 0 30px rgba(232,255,71,.25)}
.btn-p:hover{background:#d4eb2e}
.btn-p:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-o{background:transparent;color:var(--txt);border:1px solid var(--brd)}
.btn-o:hover{border-color:var(--acc);color:var(--acc)}
.btn-g{background:var(--surf2);color:var(--txt)}
.btn-g:hover{background:var(--brd)}
.btn-r{background:var(--red);color:#fff}
.bico{font-size:20px}
.back{background:none;border:none;color:var(--mute);cursor:pointer;font-family:'DM Sans',sans-serif;font-size:14px;display:flex;align-items:center;gap:6px;padding:4px 0}
.back:hover{color:var(--txt)}
.ghdr{padding:16px 0;display:flex;align-items:center;justify-content:space-between}
.ldisplay{text-align:center;padding:24px 0 16px;position:relative}
.lbg{font-family:'Bebas Neue',sans-serif;font-size:180px;line-height:1;color:transparent;-webkit-text-stroke:2px rgba(232,255,71,.15);position:absolute;left:50%;transform:translateX(-50%);top:-20px;user-select:none;pointer-events:none}
.lmain{font-family:'Bebas Neue',sans-serif;font-size:96px;line-height:1;color:var(--acc);filter:drop-shadow(0 0 30px rgba(232,255,71,.5));position:relative;z-index:1}
.llbl{color:var(--mute);font-size:12px;letter-spacing:3px;margin-top:4px}
.tbar-wrap{height:4px;background:var(--surf2);border-radius:2px;margin:16px 0;overflow:hidden}
.tbar{height:100%;border-radius:2px;transition:width 1s linear,background 1s}
.tnum{font-family:'Bebas Neue',sans-serif;font-size:48px;text-align:center;letter-spacing:2px;transition:color .5s}
.cats{display:flex;flex-direction:column;gap:8px;margin:16px 0}
.crow{display:flex;align-items:center;gap:12px;background:var(--surf);border:1px solid var(--brd);border-radius:8px;padding:10px 14px;transition:border-color .2s}
.crow:focus-within{border-color:var(--acc);box-shadow:0 0 0 2px rgba(232,255,71,.1)}
.crow.bad{border-color:var(--red)}
.cico{font-size:20px;width:28px;text-align:center;flex-shrink:0}
.clbl{font-size:11px;color:var(--mute);width:64px;flex-shrink:0;letter-spacing:.5px;font-weight:500}
.cinp{flex:1;background:transparent;border:none;outline:none;color:var(--txt);font-family:'DM Sans',sans-serif;font-size:16px;font-weight:500}
.cinp::placeholder{color:var(--mute);font-weight:300}
.cinp:disabled{opacity:.5;cursor:not-allowed}
.cx{font-size:13px;min-width:16px;text-align:center}
.vwrap{display:flex;flex-direction:column;align-items:center;gap:16px;padding:40px 16px;text-align:center}
.aibadge{display:inline-flex;align-items:center;gap:8px;background:rgba(232,255,71,.1);border:1px solid rgba(232,255,71,.3);border-radius:20px;padding:6px 14px;font-size:13px;color:var(--acc);font-weight:500}
.aidot{width:8px;height:8px;border-radius:50%;background:var(--acc);animation:blink 1s infinite;flex-shrink:0}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
.spin{width:40px;height:40px;border:3px solid var(--brd);border-top-color:var(--acc);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.sscrn{display:flex;flex-direction:column;align-items:center;padding:32px 0;gap:20px}
.sbig{font-family:'Bebas Neue',sans-serif;font-size:120px;line-height:1;color:var(--acc);filter:drop-shadow(0 0 40px rgba(232,255,71,.6));animation:pop .5s cubic-bezier(.34,1.56,.64,1)}
@keyframes pop{from{transform:scale(.3) rotate(-10deg);opacity:0}to{transform:scale(1);opacity:1}}
.slbl{color:var(--mute);letter-spacing:3px;font-size:12px}
.smax{color:var(--mute);font-size:14px}
.rlist{width:100%;display:flex;flex-direction:column;gap:6px}
.rrow{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-radius:8px;background:var(--surf);border-left:3px solid transparent}
.rrow.rv{border-left-color:var(--ok)}
.rrow.ri{border-left-color:var(--red);opacity:.8}
.rico{font-size:17px;width:22px;text-align:center;flex-shrink:0;padding-top:2px}
.rcat{font-size:11px;color:var(--mute);width:62px;flex-shrink:0;padding-top:3px}
.rbody{flex:1;min-width:0}
.rans{font-weight:500;font-size:15px}
.rwhy{font-size:11px;color:var(--mute);margin-top:2px;font-style:italic}
.rpts{font-family:'Bebas Neue',sans-serif;font-size:20px;flex-shrink:0}
.pt-ok{color:var(--ok)}.pt-no{color:var(--red)}
.oscr{display:flex;flex-direction:column;min-height:100vh;padding-top:24px;gap:20px}
.stitle{font-family:'Bebas Neue',sans-serif;font-size:36px;letter-spacing:1px}
.flbl{font-size:12px;color:var(--mute);letter-spacing:2px;font-weight:500}
.tinp{background:var(--surf);border:1px solid var(--brd);border-radius:8px;padding:14px 16px;color:var(--txt);font-family:'DM Sans',sans-serif;font-size:16px;font-weight:500;width:100%;outline:none;transition:border-color .2s}
.tinp:focus{border-color:var(--acc)}
.err{color:var(--red);font-size:13px;text-align:center;padding:8px;background:rgba(255,71,87,.1);border-radius:6px}
.div{height:1px;background:var(--brd);margin:4px 0}
/* matchmaking */
.mcard{background:var(--surf);border:1px solid var(--brd);border-radius:12px;padding:32px 24px;display:flex;flex-direction:column;align-items:center;gap:20px;text-align:center}
.mcard-title{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:1px}
.mstatus{font-size:14px;color:var(--mute)}
.mfound{color:var(--ok);font-size:15px;font-weight:600}
.pulse-ring{width:80px;height:80px;border-radius:50%;border:3px solid var(--acc);position:relative;display:flex;align-items:center;justify-content:center}
.pulse-ring::after{content:'';position:absolute;inset:-8px;border-radius:50%;border:2px solid var(--acc);opacity:.4;animation:ring 1.5s ease-out infinite}
@keyframes ring{0%{transform:scale(1);opacity:.4}100%{transform:scale(1.4);opacity:0}}
.pulse-ico{font-size:32px}
.queue-count{font-size:12px;color:var(--mute);letter-spacing:1px}
/* vs screen */
.vsscrn{display:flex;flex-direction:column;gap:14px;padding:24px 0}
.vshdr{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:var(--mute);text-align:center}
.bnr{text-align:center;padding:16px;border-radius:8px}
.bnr-w{border:1px solid var(--acc);background:rgba(232,255,71,.1)}
.bnr-l{border:1px solid var(--red);background:rgba(255,71,87,.1)}
.bnr-t{border:1px solid var(--mute);background:rgba(107,107,138,.2)}
.btxt{font-family:'Bebas Neue',sans-serif;font-size:32px}
.bt-w{color:var(--acc)}.bt-l{color:var(--red)}.bt-t{color:var(--txt)}
.srow{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center}
.sside{text-align:center}
.sslbl{font-size:11px;color:var(--mute);letter-spacing:1px;margin-bottom:4px;font-weight:500}
.ssnum{font-family:'Bebas Neue',sans-serif;font-size:56px}
.sy{color:var(--acc)}.so{color:var(--red)}
.vsmid{font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--mute);text-align:center}
.cmp{display:flex;flex-direction:column;gap:6px}
.cmpr{display:grid;grid-template-columns:1fr 32px 1fr;gap:6px;align-items:flex-start}
.cmpc{padding:8px 10px;border-radius:6px;font-size:13px;font-weight:500;background:var(--surf);border:1px solid var(--brd);min-height:38px;display:flex;flex-direction:column;justify-content:center}
.cmpc.cw{border-color:var(--ok);background:rgba(45,255,138,.08)}
.cmpc.cl{opacity:.4}
.cmpw{font-size:10px;color:var(--mute);margin-top:2px;font-style:italic}
.cmpico{text-align:center;font-size:16px;padding-top:10px}
`;

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,     setScreen]     = useState("home");
  const [letter,     setLetter]     = useState("B");
  const [answers,    setAnswers]    = useState({});
  const [timeLeft,   setTimeLeft]   = useState(60);
  const [submitted,  setSubmitted]  = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [oppName,    setOppName]    = useState("");
  const [oppAnswers, setOppAnswers] = useState({});
  const [oppVal,     setOppVal]     = useState(null);
  const [error,      setError]      = useState("");
  const [queueStatus, setQueueStatus] = useState("searching"); // searching | found

  const timerRef   = useRef(null);
  const pollRef    = useRef(null);
  const pollAnsRef = useRef(null);
  const answersR   = useRef({});
  const letterR    = useRef("B");
  const roomR      = useRef("");
  const nameR      = useRef("");
  const myIdR      = useRef("");
  const submittedR = useRef(false);

  useEffect(() => { answersR.current   = answers;    }, [answers]);
  useEffect(() => { letterR.current    = letter;     }, [letter]);
  useEffect(() => { nameR.current      = playerName; }, [playerName]);
  useEffect(() => { submittedR.current = submitted;  }, [submitted]);

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
    clearInterval(pollAnsRef.current);
  }, []);

  // ── Timer ──────────────────────────────────────────────────────────────────
  const DURATION = 60;
  function startTimer(onEnd) {
    clearInterval(timerRef.current);
    setTimeLeft(DURATION);
    setSubmitted(false);
    setValidation(null);
    setValidating(false);
    submittedR.current = false;
    let t = DURATION;
    timerRef.current = setInterval(() => {
      t--;
      setTimeLeft(t);
      if (t <= 0) { clearInterval(timerRef.current); onEnd(); }
    }, 1000);
  }

  // ── AI Submit ──────────────────────────────────────────────────────────────
  async function doSubmit(l, code) {
    if (submittedR.current) return;
    clearInterval(timerRef.current);
    submittedR.current = true;
    setSubmitted(true);
    setValidating(true);
    const result = await aiValidate(answersR.current, l);
    setValidation(result);
    setValidating(false);
    if (code) {
      try {
        const room = await dbGet(`ag-room:${code}`);
        if (room) {
          room.answers[nameR.current]    = { ...answersR.current };
          room.validation[nameR.current] = result;
          await dbSet(`ag-room:${code}`, room);
        }
      } catch (e) { console.error("save answers failed:", e); }
    } else {
      setScreen("solo-score");
    }
  }

  // ── Solo ───────────────────────────────────────────────────────────────────
  function startSolo() {
    const l = randomLetter();
    setLetter(l); letterR.current = l;
    setAnswers({}); answersR.current = {};
    setScreen("solo-game");
    startTimer(() => doSubmit(l, null));
  }

  // ── Matchmaking ────────────────────────────────────────────────────────────
  async function findMatch() {
    if (!playerName.trim()) return setError("Enter your name first");
    setError("");
    const myId = makeId();
    myIdR.current = myId;
    const myEntry = { id: myId, name: playerName, joinedAt: Date.now() };
    setQueueStatus("searching");
    setScreen("matchmaking");

    try {
      const result = await enterQueue(myEntry);
      if (result.matched) {
        // I matched immediately with someone already waiting
        await indexRoomForPlayer(myId, result.room.id);
        launchOnlineGame(result.room, result.opponentName);
      } else {
        // I'm in the queue — poll until matched
        pollRef.current = setInterval(async () => {
          try {
            const check = await pollQueue(myId);
            if (check.removed) {
              clearInterval(pollRef.current);
              // find the room created for me
              const room = await findMyRoom(myId);
              if (room) {
                const opp = room.players.find(p => p !== nameR.current) || "Opponent";
                setQueueStatus("found");
                setTimeout(() => launchOnlineGame(room, opp), 800);
              }
            }
          } catch { /* keep polling */ }
        }, 2000);
      }
    } catch (e) {
      setScreen("online-name");
      setError("Matchmaking error: " + e.message);
    }
  }

  function launchOnlineGame(room, opponentName) {
    roomR.current = room.id;
    setOppName(opponentName);
    const l = room.letter;
    setLetter(l); letterR.current = l;
    setAnswers({}); answersR.current = {};
    setScreen("online-game");
    startTimer(() => doSubmit(l, room.id));
  }

  async function cancelMatchmaking() {
    clearInterval(pollRef.current);
    await removeFromQueue(myIdR.current).catch(() => {});
    setScreen("online-name");
  }

  // ── Poll for opponent results ──────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "online-game" || !submitted || validating) return;
    const code = roomR.current;
    clearInterval(pollAnsRef.current);
    pollAnsRef.current = setInterval(async () => {
      try {
        const room = await dbGet(`ag-room:${code}`);
        if (!room) return;
        const opp = room.players.find(p => p !== nameR.current);
        if (opp && room.answers[opp] && room.validation[opp]) {
          clearInterval(pollAnsRef.current);
          setOppAnswers(room.answers[opp]);
          setOppVal(room.validation[opp]);
          setScreen("online-score");
        }
      } catch { /* keep polling */ }
    }, 2000);
    return () => clearInterval(pollAnsRef.current);
  }, [screen, submitted, validating]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const pct   = (timeLeft / DURATION) * 100;
  const tcol  = timeLeft > 20 ? "var(--ok)" : timeLeft > 10 ? "var(--acc)" : "var(--red)";
  const myPts = totalScore(validation);
  const opPts = totalScore(oppVal);
  function changeAnswer(cat, val) { setAnswers(p => ({ ...p, [cat]: val })); }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREENS
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === "home") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="home">
          <div className="logo">
            <div className="lbadge">AI-JUDGED WORD GAME</div>
            <div className="ltitle">ALPHABET<br/>GAME</div>
            <div className="lsub">Fill categories. Beat the clock. Win.</div>
          </div>
          <div className="menu">
            <button className="btn btn-p" onClick={() => setScreen("solo-name")}>
              <span className="bico">🎮</span> Play Solo
            </button>
            <button className="btn btn-o" onClick={() => setScreen("online-name")}>
              <span className="bico">🌐</span> Play Online
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (screen === "solo-name") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="oscr">
          <button className="back" onClick={() => setScreen("home")}>← Back</button>
          <div className="stitle">Solo Play</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div className="flbl">YOUR NAME</div>
            <input className="tinp" placeholder="Enter your name…" value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key==="Enter" && playerName.trim() && startSolo()} />
          </div>
          <button className="btn btn-p" onClick={startSolo} disabled={!playerName.trim()}>
            <span className="bico">🚀</span> Start Game
          </button>
        </div>
      </div>
    </div>
  );

  if (screen === "online-name") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="oscr">
          <button className="back" onClick={() => setScreen("home")}>← Back</button>
          <div className="stitle">Play Online</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div className="flbl">YOUR NAME</div>
            <input className="tinp" placeholder="Enter your name…" value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key==="Enter" && playerName.trim() && findMatch()} />
          </div>
          {error && <div className="err">{error}</div>}
          <button className="btn btn-p" onClick={findMatch} disabled={!playerName.trim()}>
            <span className="bico">🔍</span> Find Match
          </button>
        </div>
      </div>
    </div>
  );

  if (screen === "matchmaking") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="oscr">
          <div className="stitle">Matchmaking</div>
          <div className="mcard">
            {queueStatus === "found" ? (
              <>
                <div style={{fontSize:48}}>🎮</div>
                <div className="mfound">Opponent found!</div>
                <div className="mstatus">Starting game…</div>
              </>
            ) : (
              <>
                <div className="pulse-ring">
                  <span className="pulse-ico">🔍</span>
                </div>
                <div className="mcard-title">Finding a Match</div>
                <div className="mstatus">Looking for an opponent for <strong style={{color:"var(--txt)"}}>{playerName}</strong>…</div>
                <div className="queue-count">You are in the queue</div>
                <div className="spin" style={{width:24,height:24,borderWidth:2}}/>
              </>
            )}
          </div>
          {queueStatus !== "found" && (
            <button className="btn btn-g" onClick={cancelMatchmaking}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (screen === "solo-game") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="ghdr">
          <button className="back" onClick={() => { clearInterval(timerRef.current); setScreen("home"); }}>← Quit</button>
          <span style={{fontSize:13,color:"var(--mute)"}}>{playerName}</span>
        </div>
        <div className="ldisplay">
          <div className="lbg">{letter}</div>
          <div className="lmain">{letter}</div>
          <div className="llbl">CURRENT LETTER</div>
        </div>
        <div className="tbar-wrap">
          <div className="tbar" style={{width:`${pct}%`,background:tcol}}/>
        </div>
        <div className="tnum" style={{color:tcol}}>{String(timeLeft).padStart(2,"0")}</div>
        {validating ? (
          <div className="vwrap">
            <div className="spin"/>
            <div className="aibadge"><div className="aidot"/> AI is judging your answers…</div>
            <div style={{color:"var(--mute)",fontSize:13}}>Checking each category for real validity</div>
          </div>
        ) : (
          <>
            <div className="cats">
              {CATS.map(cat => {
                const val = answers[cat] || "";
                const bad = val.length >= 1 && !val.toLowerCase().startsWith(letter.toLowerCase());
                return (
                  <div key={cat} className={`crow${bad?" bad":""}`}>
                    <span className="cico">{ICONS[cat]}</span>
                    <span className="clbl">{cat}</span>
                    <input className="cinp" placeholder={`${letter}…`}
                      value={val} onChange={e => changeAnswer(cat, e.target.value)}
                      disabled={submitted} />
                    <span className="cx">{bad?"❌":""}</span>
                  </div>
                );
              })}
            </div>
            {!submitted && (
              <button className="btn btn-p" style={{width:"100%",marginTop:8,marginBottom:24}}
                onClick={() => doSubmit(letter, null)}>
                Submit Answers
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (screen === "solo-score") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="sscrn">
          <div className="slbl">YOUR SCORE</div>
          <div className="sbig">{myPts}</div>
          <div className="smax">out of {CATS.length * 10} · letter {letter}</div>
          <div className="aibadge" style={{fontSize:12}}><div className="aidot"/> AI-validated</div>
          <div className="div" style={{width:"100%"}}/>
          <div className="rlist" style={{width:"100%"}}>
            {CATS.map(cat => {
              const val = answers[cat] || "";
              const v   = validation?.[cat];
              const ok  = v?.valid ?? false;
              return (
                <div key={cat} className={`rrow ${ok?"rv":"ri"}`}>
                  <span className="rico">{ICONS[cat]}</span>
                  <span className="rcat">{cat}</span>
                  <div className="rbody">
                    <div className="rans">{val || <span style={{color:"var(--mute)",fontSize:13}}>—</span>}</div>
                    {v?.reason && v.reason !== "empty" && <div className="rwhy">{v.reason}</div>}
                  </div>
                  <span className={`rpts ${ok?"pt-ok":"pt-no"}`}>{ok?"+10":"0"}</span>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10,width:"100%"}}>
            <button className="btn btn-p" style={{flex:1}} onClick={startSolo}>Play Again</button>
            <button className="btn btn-g" style={{flex:1}} onClick={() => setScreen("home")}>Home</button>
          </div>
        </div>
      </div>
    </div>
  );

  if (screen === "online-game") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="ghdr">
          <button className="back" onClick={() => { clearInterval(timerRef.current); setScreen("home"); }}>← Quit</button>
          <span style={{fontSize:13,color:"var(--mute)"}}>vs {oppName}</span>
        </div>
        <div className="ldisplay">
          <div className="lbg">{letter}</div>
          <div className="lmain">{letter}</div>
          <div className="llbl">CURRENT LETTER</div>
        </div>
        <div className="tbar-wrap">
          <div className="tbar" style={{width:`${pct}%`,background:tcol}}/>
        </div>
        <div className="tnum" style={{color:tcol}}>{String(timeLeft).padStart(2,"0")}</div>
        {validating ? (
          <div className="vwrap">
            <div className="spin"/>
            <div className="aibadge"><div className="aidot"/> AI is judging your answers…</div>
            <div style={{color:"var(--mute)",fontSize:13}}>Also waiting for {oppName}…</div>
          </div>
        ) : submitted ? (
          <div style={{textAlign:"center",padding:"24px 12px",color:"var(--ok)",fontSize:14}}>
            ✓ Submitted — waiting for {oppName}…
            <div className="spin" style={{margin:"16px auto 0",width:32,height:32,borderWidth:2}}/>
          </div>
        ) : (
          <>
            <div className="cats">
              {CATS.map(cat => {
                const val = answers[cat] || "";
                const bad = val.length >= 1 && !val.toLowerCase().startsWith(letter.toLowerCase());
                return (
                  <div key={cat} className={`crow${bad?" bad":""}`}>
                    <span className="cico">{ICONS[cat]}</span>
                    <span className="clbl">{cat}</span>
                    <input className="cinp" placeholder={`${letter}…`}
                      value={val} onChange={e => changeAnswer(cat, e.target.value)} />
                    <span className="cx">{bad?"❌":""}</span>
                  </div>
                );
              })}
            </div>
            <button className="btn btn-p" style={{width:"100%",marginTop:8,marginBottom:24}}
              onClick={() => doSubmit(letterR.current, roomR.current)}>
              Submit Answers
            </button>
          </>
        )}
      </div>
    </div>
  );

  if (screen === "online-score") {
    const won = myPts > opPts, tie = myPts === opPts;
    return (
      <div className="G"><div className="noise"/>
        <div className="S">
          <div className="vsscrn">
            <div className="vshdr">RESULTS · {letter}</div>
            <div className={`bnr ${won?"bnr-w":tie?"bnr-t":"bnr-l"}`}>
              <div className={`btxt ${won?"bt-w":tie?"bt-t":"bt-l"}`}>
                {won?"🏆 YOU WIN!":tie?"🤝 IT'S A TIE!":"😤 YOU LOSE"}
              </div>
            </div>
            <div className="srow">
              <div className="sside">
                <div className="sslbl">{playerName.toUpperCase()}</div>
                <div className="ssnum sy">{myPts}</div>
              </div>
              <div className="vsmid">VS</div>
              <div className="sside">
                <div className="sslbl">{oppName.toUpperCase()}</div>
                <div className="ssnum so">{opPts}</div>
              </div>
            </div>
            <div className="div"/>
            <div className="aibadge" style={{alignSelf:"center",fontSize:12}}><div className="aidot"/> AI-validated</div>
            <div className="cmp">
              {CATS.map(cat => {
                const ma=answers[cat]||"", oa=oppAnswers[cat]||"";
                const mv=validation?.[cat], ov=oppVal?.[cat];
                const mp=mv?.valid?10:0, op=ov?.valid?10:0;
                return (
                  <div key={cat} className="cmpr">
                    <div className={`cmpc ${mp>op?"cw":mp<op?"cl":""}`}>
                      <div>{ma||<span style={{color:"var(--mute)",fontSize:12}}>—</span>}</div>
                      {mv?.reason&&ma&&<div className="cmpw">{mv.reason}</div>}
                    </div>
                    <div className="cmpico">{ICONS[cat]}</div>
                    <div className={`cmpc ${op>mp?"cw":op<mp?"cl":""}`} style={{textAlign:"right",alignItems:"flex-end"}}>
                      <div>{oa||<span style={{color:"var(--mute)",fontSize:12}}>—</span>}</div>
                      {ov?.reason&&oa&&<div className="cmpw">{ov.reason}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:10,paddingBottom:24}}>
              <button className="btn btn-p" style={{flex:1}}
                onClick={() => setScreen("online-name")}>Play Again</button>
              <button className="btn btn-g" style={{flex:1}} onClick={() => setScreen("home")}>Home</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
