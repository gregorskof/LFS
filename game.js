/* Legends of the Falling Sky — 2D Skirmish (from scratch)
   - Auto-uses ship PNGs sitting next to these files
   - Canvas RTS controls + formation + AI + weapon logic + victory
*/
(() => {
  'use strict';

  // ---------- DOM ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const el = {
    playerFaction: document.getElementById("playerFaction"),
    spawnFaction: document.getElementById("spawnFaction"),
    spawnType: document.getElementById("spawnType"),
    spawnCount: document.getElementById("spawnCount"),
    btnSpawnNow: document.getElementById("btnSpawnNow"),

    formation: document.getElementById("formation"),
    btnHold: document.getElementById("btnHold"),
    btnFree: document.getElementById("btnFree"),
    btnDelete: document.getElementById("btnDelete"),
    btnDeselect: document.getElementById("btnDeselect"),
    btnRepair: document.getElementById("btnRepair"),
    btnScatter: document.getElementById("btnScatter"),
    btnRecall: document.getElementById("btnRecall"),
    btnSelectAll: document.getElementById("btnSelectAll"),
    btnFocusCam: document.getElementById("btnFocusCam"),

    btnStart: document.getElementById("btnStart"),
    btnPause: document.getElementById("btnPause"),
    btnReset: document.getElementById("btnReset"),
    btnQuick: document.getElementById("btnQuick"),

    btnSound: document.getElementById("btnSound"),
    soundVol: document.getElementById("soundVol"),
    musicVol: document.getElementById("musicVol"),

    btnExport: document.getElementById("btnExport"),
    btnImport: document.getElementById("btnImport"),
    scenarioBox: document.getElementById("scenarioBox"),

    status: document.getElementById("status"),

    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayText: document.getElementById("overlayText"),
    btnDownloadCSV: document.getElementById("btnDownloadCSV"),
    btnPlayAgain: document.getElementById("btnPlayAgain"),
    btnCloseOverlay: document.getElementById("btnCloseOverlay"),
  };

  let playerFaction = el.playerFaction?.value || 'republic';

  function isPlayerFaction(factionId){
    return factionId === playerFaction;
  }

  // ---------- Utils ----------
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);

  const v2 = (x=0,y=0)=>({x,y});
  const add = (a,b)=>({x:a.x+b.x,y:a.y+b.y});
  const sub = (a,b)=>({x:a.x-b.x,y:a.y-b.y});
  const mul = (a,s)=>({x:a.x*s,y:a.y*s});
  const len = (a)=>Math.hypot(a.x,a.y);
  const norm = (a)=>{ const l=len(a)||1; return {x:a.x/l,y:a.y/l}; };
  const dot = (a,b)=>a.x*b.x+a.y*b.y;

  function assetPath(filename){
    // important: filenames contain spaces, ampersands, etc.
    return encodeURI(filename);
  }

  // ---------- Render cache: pre-baked glow sprites + gradient cache ----------

  // Pre-render a soft radial glow circle to an offscreen canvas.
  // Used instead of createRadialGradient + shadowBlur per ship per frame.
  // Key: "r_g_b_size"  (tint + pixel radius)
  const glowSpriteCache = new Map();
  function getGlowSprite(r, g, b, size){
    const key = `${r}_${g}_${b}_${size}`;
    let c = glowSpriteCache.get(key);
    if (c) return c;
    const s = size * 2;
    c = document.createElement('canvas');
    c.width = c.height = s;
    const cx2 = c.getContext('2d');
    const grad = cx2.createRadialGradient(size, size, 0, size, size, size);
    grad.addColorStop(0,   `rgba(${r},${g},${b},0.55)`);
    grad.addColorStop(0.4, `rgba(${r},${g},${b},0.22)`);
    grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
    cx2.fillStyle = grad;
    cx2.fillRect(0, 0, s, s);
    glowSpriteCache.set(key, c);
    return c;
  }

  // Pre-baked shield glow (blue radial)
  const shieldSpriteCache = new Map();
  function getShieldSprite(size){
    const key = size;
    let c = shieldSpriteCache.get(key);
    if (c) return c;
    const s = size * 2;
    c = document.createElement('canvas');
    c.width = c.height = s;
    const cx2 = c.getContext('2d');
    const grad = cx2.createRadialGradient(size, size, size*0.55, size, size, size);
    grad.addColorStop(0,   'rgba(90,167,255,0)');
    grad.addColorStop(0.7, 'rgba(90,167,255,0.55)');
    grad.addColorStop(1,   'rgba(180,220,255,0.28)');
    cx2.fillStyle = grad;
    cx2.fillRect(0, 0, s, s);
    shieldSpriteCache.set(key, c);
    return c;
  }

  // Pre-baked fire glow (orange-red radial)
  let _fireSprite = null;
  function getFireSprite(size){
    if (_fireSprite && _fireSprite._size === size) return _fireSprite;
    const s = size * 2;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const cx2 = c.getContext('2d');
    const grad = cx2.createRadialGradient(size, size, 0, size, size, size);
    grad.addColorStop(0,   'rgba(255,200,60,0.9)');
    grad.addColorStop(0.5, 'rgba(255,80,20,0.6)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    cx2.fillStyle = grad;
    cx2.fillRect(0, 0, s, s);
    c._size = size;
    _fireSprite = c;
    return c;
  }

  // Cached flat-color gradients for health bars (only 4 variations, created once)
  let _hbGradCache = null;
  function getHBGrads(barW, x0){
    // We create these as 1×1 horizontal gradients and stretch them with drawImage;
    // but Canvas 2D gradients are absolute coords — so we cache by barW bucket.
    const key = Math.round(barW / 4) * 4; // bucket to 4px
    if (!_hbGradCache || _hbGradCache.key !== key){
      const g_shield = ctx.createLinearGradient(0, 0, key, 0);
      g_shield.addColorStop(0, 'rgba(60,120,255,0.9)');
      g_shield.addColorStop(1, 'rgba(120,200,255,0.9)');

      const g_hp_high = ctx.createLinearGradient(0, 0, key, 0);
      g_hp_high.addColorStop(0, 'rgba(30,180,110,0.9)');
      g_hp_high.addColorStop(1, 'rgba(80,230,160,0.9)');

      const g_hp_mid = ctx.createLinearGradient(0, 0, key, 0);
      g_hp_mid.addColorStop(0, 'rgba(220,160,20,0.9)');
      g_hp_mid.addColorStop(1, 'rgba(255,210,50,0.9)');

      const g_hp_low = ctx.createLinearGradient(0, 0, key, 0);
      g_hp_low.addColorStop(0, 'rgba(200,40,40,0.9)');
      g_hp_low.addColorStop(1, 'rgba(255,80,80,0.9)');

      _hbGradCache = { key, g_shield, g_hp_high, g_hp_mid, g_hp_low };
    }
    return _hbGradCache;
  }

  // Pre-baked engine trail gradients.
  // Key: "r_g_b_trailAlpha" — one offscreen 1×trailLen canvas per unique faction tint.
  // We store a small horizontal gradient canvas and drawImage it rotated, avoiding
  // ctx.createLinearGradient() on the main canvas every frame per moving ship.
  // Because trail direction changes every frame we can't pre-rotate, so instead we
  // cache the gradient *object* itself (keyed by colour + alpha bucket), which is
  // far cheaper than creating a new CanvasGradient object each call.
  // Canvas gradient objects are reusable across frames as long as the coords match —
  // we regenerate only when the bucketed trail length changes (rare).
  const trailGradCache = new Map();
  function getTrailGrad(sx, sy, tx, ty, r, g, b, ta){
    // Bucket trail length to nearest 8px to maximise cache hits
    const lenKey = Math.round(Math.hypot(tx-sx, ty-sy) / 8) * 8;
    const key = `${r}_${g}_${b}_${Math.round(ta*10)}_${lenKey}`;
    let entry = trailGradCache.get(key);
    if (entry) {
      // Reposition the cached gradient to the current screen coords
      // Canvas linear gradients are defined by absolute coords — we must recreate
      // if the direction changes. Easiest correct approach: cache by direction bucket too.
      // Direction bucket: 16 sectors (22.5° each)
      const angle = Math.atan2(ty-sy, tx-tx); // always 0 for same-direction
      return null; // fall through to per-frame creation — see below
    }
    return null;
  }
  // Pre-built rgba strings for vector fallback ship shapes (craft + large ellipse).
  // Avoids template-literal allocation per ship per frame for ships without PNG sprites.
  const vecColorCache = new Map();
  function getVecColors(col){
    const key = col[0]*65536 + col[1]*256 + col[2];
    let c = vecColorCache.get(key);
    if (!c){
      const r = col[0], g = col[1], b = col[2];
      const r60 = Math.min(255,r+60), g60 = Math.min(255,g+60), b80 = Math.min(255,b+80);
      const r80 = Math.min(255,r+80), g80 = Math.min(255,g+80), b100 = Math.min(255,b+100);
      const r40 = Math.min(255,r+40), g40 = Math.min(255,g+40), b50 = Math.min(255,b+50);
      c = {
        // craft fill gradient stops
        fill0:   `rgba(${r},${g},${b},0.20)`,
        fill06:  `rgba(${r},${g},${b},0.50)`,
        fill1:   `rgba(${r60},${g60},${b80},0.70)`,
        stroke:  `rgba(${r80},${g80},${b100},0.75)`,
        // large ship body gradient stops
        body0:   `rgba(${r},${g},${b},0.22)`,
        body05:  `rgba(${r40},${g40},${b50},0.45)`,
        body1:   `rgba(${r},${g},${b},0.18)`,
        bodyStroke: `rgba(${r80},${g80},${r80},0.55)`,
      };
      vecColorCache.set(key, c);
    }
    return c;
  }

  // Simpler, correct approach: cache CanvasGradient objects keyed by colour only,
  // reusing a fixed horizontal template and applying ctx.setTransform instead.
  // Actually the simplest guaranteed-correct cache is to avoid recreating the
  // colour strings — pre-build the rgba strings once per faction tint.
  const trailColorCache = new Map();
  function getTrailColors(col){
    const key = col[0]*65536 + col[1]*256 + col[2];
    let c = trailColorCache.get(key);
    if (!c){
      const r2 = Math.min(255, col[1]+40), b2 = Math.min(255, col[2]+80);
      c = {
        headA: `rgba(${col[0]},${r2},${b2},`,   // append alpha + ")"
        midA:  `rgba(${col[0]},${col[1]},${col[2]},0.10)`,
        tail:  'rgba(0,0,0,0)',
      };
      trailColorCache.set(key, c);
    }
    return c;
  }

  // Frustum (viewport) culling — returns true if a world-space circle is visible
  function isOnScreen(wx, wy, wRadius, rect){
    const sx = (wx - cam.x) * cam.zoom + rect.width  / 2;
    const sy = (wy - cam.y) * cam.zoom + rect.height / 2;
    const sr = wRadius * cam.zoom + 4;
    return sx + sr > 0 && sx - sr < rect.width &&
           sy + sr > 0 && sy - sr < rect.height;
  }

  // Sort-dirty flag — re-sort world.ships by radius only when ships are added/removed,
  // not every frame. Saves an O(n log n) sort at 60fps with 200+ ships.
  let _shipsSortDirty = true;

  // getBoundingClientRect() causes layout reflow — cache it once per frame
  let _frameRect = null;
  function getFrameRect(){
    if (!_frameRect) _frameRect = canvas.getBoundingClientRect();
    return _frameRect;
  }
  // Call at the start of each frame to invalidate the cache
  function invalidateFrameRect(){ _frameRect = null; }

  // O(1) ship lookup by ID
  const shipMap = new Map();
  function getShipById(id){
    if (!id) return null;
    return shipMap.get(id) || null;
  }
  function shipMapRebuild(){
    shipMap.clear();
    for (const s of world.ships) if (s.isAlive()) shipMap.set(s.id, s);
  }

  // Spatial grid: divides world into cells, stores ship refs per cell
  // Used for O(1)-ish proximity queries instead of O(n) full sweeps
  const GRID_CELL = 320; // world units per cell
  const grid = {
    cells: new Map(),
    w: 0, h: 0,
    clear(){
      this.cells.clear();
    },
    key(cx, cy){ return cx * 10000 + cy; },
    cellOf(wx, wy){
      return { cx: Math.floor(wx / GRID_CELL), cy: Math.floor(wy / GRID_CELL) };
    },
    insert(ship){
      const { cx, cy } = this.cellOf(ship.pos.x, ship.pos.y);
      const k = this.key(cx, cy);
      let cell = this.cells.get(k);
      if (!cell){ cell = []; this.cells.set(k, cell); }
      cell.push(ship);
    },
    // Return all ships in cells within cellRadius of position (wx,wy)
    query(wx, wy, radius){
      const cellR = Math.ceil(radius / GRID_CELL);
      const { cx: ox, cy: oy } = this.cellOf(wx, wy);
      const out = [];
      for (let dx = -cellR; dx <= cellR; dx++){
        for (let dy = -cellR; dy <= cellR; dy++){
          const k = this.key(ox + dx, oy + dy);
          const cell = this.cells.get(k);
          if (cell) for (const s of cell) out.push(s);
        }
      }
      return out;
    },
    rebuild(ships){
      this.clear();
      for (const s of ships) if (s.isAlive()) this.insert(s);
    },
  };

  // ---------- Sound (WebAudio, no external files) ----------
  const audio = (() => {
    let ctx = null;
    let master = null;
    let enabled = true;
    let volume = 0.35;
    let frameBudget = 0;

    // Engine drone — single shared oscillator
    let engOsc = null, engGain = null, engFilter = null, engLast = 0;

    function ensure(){
      if (ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }

    function unlock(){
      ensure();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
    }

    function setEnabled(v){
      enabled = !!v;
      if (el.btnSound) el.btnSound.textContent = enabled ? 'Sound: On' : 'Sound: Off';
    }

    function setVolume(v){
      volume = clamp(+v, 0, 1);
      if (master) master.gain.value = volume;
    }

    function beginFrame(){ frameBudget = 14; engineTick(); }

    // ── Core synthesis helpers ────────────────────────────────
    function tone(freq, dur, type, gain, delay){
      if (!enabled) return;
      ensure();
      if (!ctx || !master || frameBudget-- <= 0) return;
      const t0 = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain ?? 0.12, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    }

    function sweep(f0, f1, dur, type, gain, delay){
      if (!enabled) return;
      ensure();
      if (!ctx || !master || frameBudget-- <= 0) return;
      const t0 = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = type || 'sawtooth';
      osc.frequency.setValueAtTime(f0, t0);
      osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(gain ?? 0.12, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    }

    function noise(dur, gain, lpHz, delay){
      if (!enabled) return;
      ensure();
      if (!ctx || !master || frameBudget-- <= 0) return;
      const t0  = ctx.currentTime + (delay || 0);
      const sz  = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, sz, ctx.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < sz; i++) d[i] = (Math.random()*2-1) * (1 - i/sz);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g   = ctx.createGain();
      g.gain.setValueAtTime(gain ?? 0.20, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.setValueAtTime(lpHz || 1800, t0);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + dur + 0.02);
    }

    // ── Weapon fire ───────────────────────────────────────────
    function laser(weaponType, special){
      if (special){
        // Superweapon: low rumble + rising shriek
        noise(0.16, 0.26, 3000);
        sweep(90, 35, 0.20, 'sawtooth', 0.18);
        sweep(1800, 4200, 0.12, 'sine', 0.10, 0.04);
        return;
      }
      if (weaponType === 'plasma'){
        sweep(620, 280, 0.07, 'sawtooth', 0.10);
        noise(0.035, 0.05, 2800);
      } else if (weaponType === 'ion'){
        sweep(1200, 680, 0.06, 'triangle', 0.08);
        tone(2400, 0.025, 'sine', 0.04);
      } else {
        // kinetic: sharp crack + snap
        noise(0.028, 0.09, 5500);
        tone(2000, 0.018, 'square', 0.05);
      }
    }

    // ── Shield & hull impacts ─────────────────────────────────
    function shieldHit(big){
      // Metallic resonant ring that decays quickly
      const f = big ? 2800 : 1900;
      sweep(f, f * 0.6, big ? 0.14 : 0.09, 'sine', big ? 0.07 : 0.05);
      tone(f * 1.5, big ? 0.07 : 0.05, 'triangle', big ? 0.04 : 0.03);
      noise(big ? 0.06 : 0.04, big ? 0.07 : 0.05, 5800);
    }

    function hullCrack(big){
      // Dull structural thud + crunch
      noise(big ? 0.10 : 0.06, big ? 0.16 : 0.10, big ? 2000 : 3500);
      sweep(big ? 220 : 300, big ? 60 : 90, big ? 0.09 : 0.06, 'sawtooth', big ? 0.12 : 0.08);
    }

    // ── Explosions ────────────────────────────────────────────
    function explosion(big){
      // Layered: noise burst + sub-bass thud + mid crack
      noise(big ? 0.40 : 0.20, big ? 0.32 : 0.20, big ? 700 : 1500);
      sweep(big ? 75 : 110, big ? 28 : 48, big ? 0.30 : 0.18, 'sine', big ? 0.20 : 0.13);
      if (big){
        noise(0.18, 0.14, 350, 0.07);                // delayed low rumble
        sweep(3500, 200, 0.10, 'sawtooth', 0.07, 0.05); // debris crack
      }
    }

    function craftExplosion(){
      // Quick, light pop — doesn't compete with big ship deaths
      noise(0.055, 0.09, 3400);
      tone(520, 0.04, 'sine', 0.05);
    }

    // ── Engine ────────────────────────────────────────────────
    function engineEnsure(){
      if (!enabled) return;
      ensure();
      if (!ctx || !master || engOsc) return;
      engOsc    = ctx.createOscillator(); engOsc.type = 'sawtooth';
      engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass';
      engFilter.frequency.setValueAtTime(260, ctx.currentTime);
      engFilter.Q.setValueAtTime(0.7, ctx.currentTime);
      engGain   = ctx.createGain(); engGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      engOsc.connect(engFilter); engFilter.connect(engGain); engGain.connect(master);
      engOsc.frequency.setValueAtTime(70, ctx.currentTime);
      engOsc.start();
    }

    function engineHum(size, speed){
      if (!enabled) return;
      engineEnsure();
      if (!engOsc || !engGain || !ctx) return;
      const t0  = ctx.currentTime;
      const sz  = clamp((size || 40) / 200, 0.2, 4.0);
      const sp  = clamp((speed || 0) / 320, 0, 1);
      const base = 95 / Math.sqrt(sz);
      const freq  = clamp(base * (1.0 + 0.55 * sp), 32, 160);
      engOsc.frequency.setTargetAtTime(freq, t0, 0.04);
      engGain.gain.setTargetAtTime(0.006 + 0.020 * sp, t0, 0.04);
      if (engFilter) engFilter.frequency.setTargetAtTime(220 + 520*sp, t0, 0.06);
      engLast = t0;
    }

    function engineTick(){
      if (!engGain || !ctx) return;
      if ((ctx.currentTime - engLast) > 0.12)
        engGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.10);
    }

    // ── UI ────────────────────────────────────────────────────
    function click(){ tone(420, 0.03, 'square', 0.05); }

    function warpJump(big){
      if (!enabled) return;
      ensure();
      if (!ctx || !master) return;
      const t0 = ctx.currentTime;
      const sz = big ? 1.0 : 0.55;
      // Rising sweep
      const o1 = ctx.createOscillator(), g1 = ctx.createGain();
      o1.type = 'sawtooth';
      o1.frequency.setValueAtTime(80, t0);
      o1.frequency.exponentialRampToValueAtTime(3500, t0 + 0.36*sz);
      g1.gain.setValueAtTime(0.0001, t0);
      g1.gain.linearRampToValueAtTime(0.20*sz, t0 + 0.04);
      g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.40*sz);
      o1.connect(g1); g1.connect(master); o1.start(t0); o1.stop(t0 + 0.42*sz);
      // Wind rush
      const nBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate*0.32*sz), ctx.sampleRate);
      const nd = nBuf.getChannelData(0);
      for (let i=0;i<nd.length;i++) nd[i]=(Math.random()*2-1)*Math.pow(1-i/nd.length,0.35);
      const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
      const nFilt = ctx.createBiquadFilter(); nFilt.type='bandpass';
      nFilt.frequency.setValueAtTime(1800,t0); nFilt.frequency.linearRampToValueAtTime(7000,t0+0.28*sz);
      nFilt.Q.value = 0.6;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.22*sz,t0); nGain.gain.exponentialRampToValueAtTime(0.0001,t0+0.33*sz);
      nSrc.connect(nFilt); nFilt.connect(nGain); nGain.connect(master);
      nSrc.start(t0); nSrc.stop(t0+0.34*sz);
      // Arrival thud
      const aT = t0 + 0.38*sz;
      const o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(big?52:88, aT);
      o2.frequency.exponentialRampToValueAtTime(big?26:44, aT+0.22);
      g2.gain.setValueAtTime(0.0001,aT); g2.gain.linearRampToValueAtTime(0.30*sz,aT+0.012);
      g2.gain.exponentialRampToValueAtTime(0.0001,aT+0.26);
      o2.connect(g2); g2.connect(master); o2.start(aT); o2.stop(aT+0.28);
      // Impact crack
      const cBuf = ctx.createBuffer(1,Math.floor(ctx.sampleRate*0.04),ctx.sampleRate);
      const cd = cBuf.getChannelData(0);
      for (let i=0;i<cd.length;i++) cd[i]=(Math.random()*2-1)*(1-i/cd.length);
      const cSrc=ctx.createBufferSource(); cSrc.buffer=cBuf;
      const cG=ctx.createGain(); cG.gain.value=0.40*sz;
      cSrc.connect(cG); cG.connect(master); cSrc.start(aT); cSrc.stop(aT+0.05);
    }

    function repair(){
      if (!enabled) return;
      ensure();
      if (!ctx || !master) return;
      [220,440,660].forEach((f,i)=>{
        const t0 = ctx.currentTime + i*0.055;
        const o=ctx.createOscillator(), g=ctx.createGain();
        o.type='sine'; o.frequency.value=f;
        g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(0.06,t0+0.01);
        g.gain.exponentialRampToValueAtTime(0.0001,t0+0.14);
        o.connect(g); g.connect(master); o.start(t0); o.stop(t0+0.16);
      });
    }

    function orderAck(){
      if (!enabled) return;
      tone(600, 0.04, 'square', 0.04);
      tone(820, 0.035, 'square', 0.035, 0.055);
    }

    // ── New SFX ───────────────────────────────────────────────

    // Superweapon pre-fire charge-up whine (call at windup start)
    function chargeUp(dur){
      if (!enabled) return;
      ensure(); if (!ctx||!master) return;
      // Low rumble builds while high whine climbs
      sweep(180, 2400, dur*0.88, 'sawtooth', 0.07);
      sweep(90,  480,  dur*0.88, 'triangle', 0.06);
      noise(dur*0.88, 0.06, 4000);
    }

    // Victory fanfare — ascending chord sequence
    function victory(){
      if (!enabled) return;
      ensure(); if (!ctx||!master) return;
      [[523,0],[659,0.11],[784,0.22],[1047,0.34]].forEach(([f,d])=>{
        tone(f, 0.60, 'sine', 0.09, d);
      });
      tone(130, 0.75, 'sine', 0.13, 0.05);  // bass anchor
    }

    // Battle-lost / incoming alert — double descending beep
    function alert(){
      if (!enabled) return;
      sweep(900, 660, 0.09, 'square', 0.06);
      sweep(900, 660, 0.09, 'square', 0.06, 0.16);
    }

    // Short blip when spawning a craft wave from hangar
    function hangarLaunch(){
      if (!enabled) return;
      tone(880, 0.03, 'square', 0.03);
      tone(1100, 0.025, 'sine', 0.03, 0.04);
    }

    // ══════════════════════════════════════════════════════════
    // BACKGROUND MUSIC — fully procedural WebAudio synthesis
    // Two moods: 'ambient' (setup/menu) and 'battle' (combat)
    // Separate music gain bus so volume slider only cuts SFX
    // without killing the score, and vice versa.
    // ══════════════════════════════════════════════════════════
    let musicBus   = null;   // gain node → master
    let musicVol   = 0.26;   // music-specific volume (0-1)
    let musicMood  = null;   // 'ambient' | 'battle' | null
    let desiredMusicMood = 'ambient';
    let musicNodes = [];     // all active music nodes (for cleanup)
    let musicScheduled = []; // { stop() } handles for looping parts
    let musicTimers = [];    // setInterval/setTimeout IDs
    let battleIntensity = 0.18;
    let battleCtl = null;

    // Music scale — Dorian minor (dark, epic, spacey)
    // Root = C2.  Intervals in semitones: 0,2,3,5,7,9,10
    const ROOT  = 65.41;  // C2 Hz
    const SCALE = [0,2,3,5,7,9,10,12,14,15,17,19,21,22]; // two octaves
    function scNote(deg, oct){ return ROOT * Math.pow(2, (SCALE[deg%SCALE.length] + (oct||0)*12) / 12); }

    function ensureMusic(){
      ensure();
      if (!ctx || !master) return false;
      if (!musicBus){
        musicBus = ctx.createGain();
        musicBus.gain.value = musicVol;
        musicBus.connect(master);
      }
      return true;
    }

    function musicNode(node){ musicNodes.push(node); return node; }

    function stopMusic(fadeTime){
      const t = fadeTime || 0.8;
      if (musicBus && ctx){
        musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, t * 0.4);
      }
      for (const id of musicTimers) clearInterval(id), clearTimeout(id);
      musicTimers = [];
      // Schedule actual node stops after fade
      const scheduled = musicScheduled.slice();
      musicScheduled = [];
      setTimeout(()=>{
        for (const n of scheduled){ try{ n.stop(); }catch(e){} }
        for (const n of musicNodes){ try{ n.disconnect(); }catch(e){} }
        musicNodes = [];
        if (musicBus && ctx){
          musicBus.gain.cancelScheduledValues(ctx.currentTime);
          musicBus.gain.setValueAtTime(musicVol, ctx.currentTime);
        }
      }, (t + 0.3) * 1000);
      musicMood = null;
      battleCtl = null;
    }

    // ── Helpers ───────────────────────────────────────────────
    function smoothMusicGain(node, value, timeConst){
      if (!node || !ctx) return;
      node.gain.cancelScheduledValues(ctx.currentTime);
      node.gain.setTargetAtTime(Math.max(0.0001, value), ctx.currentTime, timeConst || 0.18);
    }

    function makeSubBus(gainVal){
      if (!ensureMusic()) return null;
      const g = ctx.createGain();
      g.gain.setValueAtTime(Math.max(0.0001, gainVal ?? 1), ctx.currentTime);
      g.connect(musicBus);
      musicNode(g);
      return g;
    }

    function setEnabledFull(v){
      const next = !!v;
      const wasEnabled = enabled;
      enabled = next;
      if (el.btnSound) el.btnSound.textContent = enabled ? 'Sound: On' : 'Sound: Off';
      if (master && ctx){
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(enabled ? volume : 0.0001, ctx.currentTime, 0.03);
      }
      if (!enabled){
        stopMusic(0.35);
      } else if (!wasEnabled){
        setTimeout(() => setMusicMood(desiredMusicMood || 'ambient'), 120);
      }
    }

    // A looping continuous oscillator connected to musicBus via a gain
    function loopOsc(freq, type, gainVal, detuneHz, dest){
      if (!ensureMusic()) return null;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type      = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (detuneHz) osc.detune.setValueAtTime(detuneHz * 100, ctx.currentTime);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + 1.0);
      osc.connect(g); g.connect(dest || musicBus);
      osc.start();
      musicNode(osc); musicNode(g);
      musicScheduled.push(osc);
      return { osc, g };
    }

    // A filtered noise layer
    function loopNoise(gainVal, lpHz, hpHz, dest){
      if (!ensureMusic()) return null;
      // Looping 4-second noise buffer
      const sr  = ctx.sampleRate;
      const len = sr * 4;
      const buf = ctx.createBuffer(1, len, sr);
      const d   = buf.getChannelData(0);
      for (let i=0;i<len;i++) d[i] = Math.random()*2-1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop   = true;
      const lp  = ctx.createBiquadFilter(); lp.type='lowpass';  lp.frequency.value = lpHz || 800;
      const hp  = ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value = hpHz || 60;
      const g   = ctx.createGain();
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + 1.5);
      src.connect(lp); lp.connect(hp); hp.connect(g); g.connect(dest || musicBus);
      src.start();
      musicNode(src); musicNode(lp); musicNode(hp); musicNode(g);
      musicScheduled.push(src);
      return { src, g };
    }

    // LFO modulating a gain node
    function attachLFO(targetGain, rate, depth, offset){
      if (!ctx) return;
      const lfo = ctx.createOscillator();
      const lg  = ctx.createGain();
      lfo.frequency.value = rate;
      lg.gain.value       = depth;
      lfo.connect(lg); lg.connect(targetGain.gain);
      targetGain.gain.setValueAtTime(offset, ctx.currentTime);
      lfo.start();
      musicNode(lfo); musicNode(lg);
      musicScheduled.push(lfo);
      return lfo;
    }

    // Schedule a repeating note pattern (melody / percussion)
    // fn(time) fires at each interval, returns at most N notes
    function schedulePattern(intervalSec, fn){
      if (!ctx) return;
      let nextTime = ctx.currentTime + 0.1;
      const id = setInterval(()=>{
        if (!ctx || !musicBus) return;
        while (nextTime < ctx.currentTime + 0.25){
          fn(nextTime);
          nextTime += intervalSec;
        }
      }, Math.max(50, intervalSec * 400));
      musicTimers.push(id);
    }

    // Play a short note on musicBus
    function mNote(freq, dur, type, g, t0, dest){
      if (!ctx || !musicBus) return;
      const osc = ctx.createOscillator(), gn = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.linearRampToValueAtTime(g, t0 + 0.015);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gn); gn.connect(dest || musicBus);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
      musicNode(osc); musicNode(gn);
    }

    // ── AMBIENT MOOD (setup / menu) ───────────────────────────
    // Slow, dark, evolving space drone.
    // Layers: sub-bass drone, two detuned pad oscillators,
    //         filtered noise wind, slow LFO tremolo, high shimmer.
    function startAmbient(){
      if (!ensureMusic()) return;
      musicMood = 'ambient';

      // Sub-bass drone on root
      const bass = loopOsc(ROOT, 'sine', 0.18);

      // Two detuned sawtooth pads (slightly sharp/flat for beating)
      const pad1 = loopOsc(scNote(4,1), 'sawtooth', 0.055,  8);   // 5th, detune +8 cents
      const pad2 = loopOsc(scNote(4,1), 'sawtooth', 0.055, -8);   // 5th, detune -8 cents
      const pad3 = loopOsc(scNote(0,2), 'sawtooth', 0.038,  5);   // root octave up

      // Slow LFO tremolo on pads
      if (pad1) attachLFO(pad1.g, 0.14, 0.018, 0.055);
      if (pad2) attachLFO(pad2.g, 0.17, 0.018, 0.055);
      if (pad3) attachLFO(pad3.g, 0.09, 0.015, 0.038);

      // Filtered noise — distant space wind
      loopNoise(0.032, 320, 80);

      // High shimmer — very slow tremolo on a high triangle
      const shim = loopOsc(scNote(7,3), 'triangle', 0.025);
      if (shim) attachLFO(shim.g, 0.06, 0.020, 0.025);

      // Very slow chord walk — every 8 seconds shift the pad pitch
      const chordWalk = [
        [scNote(4,1), scNote(0,2)],
        [scNote(6,1), scNote(2,2)],
        [scNote(3,1), scNote(10,1)],
        [scNote(5,1), scNote(0,2)],
      ];
      let chordIdx = 0;
      const chordId = setInterval(()=>{
        if (!pad1 || !pad2 || !pad3 || !ctx || !musicBus) return;
        chordIdx = (chordIdx + 1) % chordWalk.length;
        const [f1, f2] = chordWalk[chordIdx];
        const ramp = ctx.currentTime + 3.5;
        pad1.osc.frequency.exponentialRampToValueAtTime(f1, ramp);
        pad2.osc.frequency.exponentialRampToValueAtTime(f1 * 1.002, ramp);
        pad3.osc.frequency.exponentialRampToValueAtTime(f2, ramp);
      }, 8000);
      musicTimers.push(chordId);

      // Occasional low melodic note bloop
      schedulePattern(9.0, (t)=>{
        const deg  = [0,2,4,6][Math.floor(Math.random()*4)];
        const oct  = Math.random() < 0.5 ? 1 : 2;
        mNote(scNote(deg, oct), 3.5, 'sine', 0.040, t);
        mNote(scNote(deg, oct) * 2, 2.8, 'sine', 0.012, t + 0.02);
      });
    }

    // ── BATTLE MOOD ───────────────────────────────────────────
    // Tense, rhythmic, driving. Tempo = 112 BPM → beat = 0.536s
    // Layers: rhythmic bass pulse, tension string pad, hi-hat percussion,
    //         a stalking melody, occasional stab chords, low sub pulse.
    function startBattleMusic(){
      if (!ensureMusic()) return;
      musicMood = 'battle';

      const BPM    = 112;
      const BEAT   = 60 / BPM;
      const BAR    = BEAT * 4;

      const buses = {
        bed:    makeSubBus(0.52),
        pulse:  makeSubBus(0.34),
        lead:   makeSubBus(0.18),
        fury:   makeSubBus(0.0001),
      };

      const ctl = battleCtl = {
        buses,
        target: battleIntensity,
        current: battleIntensity,
        strings: null,
        apply(v, immediate){
          const x = clamp(+v || 0, 0, 1);
          this.target = x;
          this.current = x;
          const tc = immediate ? 0.04 : 0.28;
          smoothMusicGain(this.buses.bed,   0.42 + x * 0.26, tc);
          smoothMusicGain(this.buses.pulse, 0.16 + x * 0.72, tc);
          smoothMusicGain(this.buses.lead,  0.08 + clamp((x - 0.12) / 0.88, 0, 1) * 0.62, tc);
          smoothMusicGain(this.buses.fury,  clamp((x - 0.56) / 0.44, 0, 1) * 0.92, tc);
          if (this.strings && ctx){
            const [str1, str2, str3] = this.strings;
            const dark = scNote(x > 0.68 ? 5 : 3, 1);
            const upper = scNote(x > 0.82 ? 10 : 7, x > 0.74 ? 1 : 0);
            const ramp = ctx.currentTime + (immediate ? 0.08 : 0.35);
            if (str1) str1.osc.frequency.exponentialRampToValueAtTime(dark, ramp);
            if (str2) str2.osc.frequency.exponentialRampToValueAtTime(dark * 1.003, ramp);
            if (str3) str3.osc.frequency.exponentialRampToValueAtTime(upper, ramp);
          }
        }
      };

      // Low undertow and string bed
      loopOsc(ROOT * 0.5, 'sine', 0.13, 0, buses.bed);
      const str1 = loopOsc(scNote(3,1), 'sawtooth', 0.058, 10, buses.bed);
      const str2 = loopOsc(scNote(3,1), 'sawtooth', 0.058, -10, buses.bed);
      const str3 = loopOsc(scNote(7,0), 'sawtooth', 0.042, 5, buses.bed);
      ctl.strings = [str1, str2, str3];
      if (str1) attachLFO(str1.g, 5.6, 0.020, 0.058);
      if (str2) attachLFO(str2.g, 6.1, 0.020, 0.058);
      if (str3) attachLFO(str3.g, 4.0, 0.016, 0.042);
      loopNoise(0.026, 220, 45, buses.bed);

      // Quarter-note pulse
      const bassNotes = [scNote(0,1), scNote(0,1), scNote(4,0), scNote(2,1), scNote(3,1), scNote(0,1), scNote(4,0), scNote(5,0)];
      let bassStep = 0;
      schedulePattern(BEAT, (t)=>{
        const i = ctl.target;
        const note = bassNotes[bassStep % bassNotes.length] * (i > 0.72 && bassStep % 8 === 6 ? 1.122 : 1);
        mNote(note, BEAT * (i > 0.65 ? 0.92 : 0.78), 'sawtooth', 0.070 + i * 0.012, t, buses.pulse);
        if (i > 0.84 && bassStep % 2 === 1){
          mNote(note * 2, BEAT * 0.22, 'square', 0.018, t + BEAT * 0.22, buses.fury);
        }
        bassStep++;
      });

      // Sub hit and pulse accents
      let pulseStep = 0;
      schedulePattern(BEAT * 0.5, (t)=>{
        const i = ctl.target;
        if (pulseStep % 4 === 0){
          mNote(ROOT * 0.5, BEAT * 1.3, 'sine', 0.090 + i * 0.03, t, buses.bed);
        }
        if (i > 0.32 && pulseStep % 2 === 1){
          mNote(scNote(7,1), BEAT * 0.16, 'triangle', 0.016 + i * 0.01, t, buses.lead);
        }
        pulseStep++;
      });

      // Percussion bed
      let hatStep = 0;
      schedulePattern(BEAT * 0.5, (t)=>{
        if (!ctx) return;
        const i = ctl.target;
        const isDownbeat = hatStep % 4 === 0;
        const isSnare = hatStep % 4 === 2;
        if (isDownbeat){
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(170 + i * 40, t);
          o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
          g.gain.setValueAtTime(0.09 + i * 0.03, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
          o.connect(g); g.connect(buses.pulse);
          o.start(t); o.stop(t + 0.22);
          musicNode(o); musicNode(g);
        }
        if (isSnare && i > 0.22){
          const sr2 = ctx.sampleRate;
          const sLen = Math.floor(sr2 * 0.09);
          const sBuf = ctx.createBuffer(1, sLen, sr2);
          const sd   = sBuf.getChannelData(0);
          for (let i2=0; i2<sLen; i2++) sd[i2] = (Math.random()*2-1) * (1-i2/sLen);
          const ss = ctx.createBufferSource(); ss.buffer = sBuf;
          const sf = ctx.createBiquadFilter(); sf.type='bandpass'; sf.frequency.value=2600 + i*1200; sf.Q.value=0.7;
          const sg = ctx.createGain(); sg.gain.setValueAtTime(0.055 + i*0.045, t); sg.gain.exponentialRampToValueAtTime(0.0001, t+0.09);
          ss.connect(sf); sf.connect(sg); sg.connect(i > 0.75 ? buses.fury : buses.pulse);
          ss.start(t); ss.stop(t+0.10);
          musicNode(ss); musicNode(sf); musicNode(sg);
        }
        const hLen = Math.floor(ctx.sampleRate * 0.022);
        const hBuf = ctx.createBuffer(1, hLen, ctx.sampleRate);
        const hd   = hBuf.getChannelData(0);
        for (let i2=0;i2<hLen;i2++) hd[i2] = (Math.random()*2-1) * (1-i2/hLen);
        const hs = ctx.createBufferSource(); hs.buffer = hBuf;
        const hf = ctx.createBiquadFilter(); hf.type='highpass'; hf.frequency.value=6800;
        const hg = ctx.createGain(); hg.gain.value = (isDownbeat ? 0.016 : 0.008) + i * 0.010;
        hs.connect(hf); hf.connect(hg); hg.connect(i > 0.64 ? buses.fury : buses.pulse);
        hs.start(t); hs.stop(t+0.03);
        musicNode(hs); musicNode(hf); musicNode(hg);
        hatStep++;
      });

      // Lead phrase opens up as intensity rises
      const leadPattern = [0,2,3,5,7,5,3,2, 0,2,3,7,10,7,5,3];
      let leadStep = 0;
      schedulePattern(BEAT * 0.5, (t)=>{
        const i = ctl.target;
        if (i < 0.18){ leadStep++; return; }
        const deg = leadPattern[leadStep % leadPattern.length];
        const shouldPlay = i > 0.7 ? true : (leadStep % 2 === 0);
        if (shouldPlay){
          const oct = i > 0.76 ? 3 : 2;
          const type = i > 0.58 ? 'triangle' : 'sine';
          mNote(scNote(deg, oct), BEAT * (i > 0.7 ? 0.34 : 0.26), type, 0.020 + i * 0.018, t, i > 0.78 ? buses.fury : buses.lead);
        }
        leadStep++;
      });

      // War-tier ostinato and chord stabs
      let furyStep = 0;
      schedulePattern(BAR, (t)=>{
        const i = ctl.target;
        if (i < 0.55) { furyStep++; return; }
        const chord = i > 0.82
          ? [scNote(3,2), scNote(7,2), scNote(10,2)]
          : [scNote(0,2), scNote(4,2), scNote(7,2)];
        chord.forEach((f, idx) => mNote(f, BEAT * 1.8, 'sawtooth', 0.018 + i * 0.012, t + idx * 0.03, buses.fury));
        if (i > 0.86){
          mNote(scNote([10,9,7,5][furyStep % 4], 3), BEAT * 0.7, 'square', 0.020, t + BEAT * 2.5, buses.fury);
        }
        furyStep++;
      });

      // Slow harmonic drift so long battles keep evolving
      const tensionChords = [
        [scNote(3,1), scNote(7,1)],
        [scNote(5,1), scNote(9,1)],
        [scNote(0,1), scNote(4,1)],
        [scNote(2,1), scNote(5,1)],
        [scNote(3,1), scNote(10,1)],
      ];
      let tcIdx = 0;
      const tcId = setInterval(()=>{
        if (!str1 || !str2 || !str3 || !ctx || !musicBus) return;
        tcIdx = (tcIdx + 1) % tensionChords.length;
        const [f1, f2] = tensionChords[tcIdx];
        const ramp = ctx.currentTime + 0.25;
        str1.osc.frequency.exponentialRampToValueAtTime(f1, ramp);
        str2.osc.frequency.exponentialRampToValueAtTime(f1 * 1.003, ramp);
        str3.osc.frequency.exponentialRampToValueAtTime(f2, ramp);
      }, BAR * 4 * 1000);
      musicTimers.push(tcId);

      ctl.apply(battleIntensity, true);
    }

    // ── Public music API ──────────────────────────────────────
    function setMusicMood(mood){
      // mood: 'ambient' | 'battle' | 'off'
      if (mood && mood !== 'off') desiredMusicMood = mood;
      if (!enabled) return;
      if (mood === 'off'){
        stopMusic(0.8);
        return;
      }
      if (mood === musicMood) return;
      if (musicMood !== null) stopMusic(1.4);
      if (mood === 'ambient') setTimeout(startAmbient, 200);
      else if (mood === 'battle') setTimeout(startBattleMusic, 200);
    }

    function setBattleIntensity(v, immediate){
      battleIntensity = clamp(+v || 0, 0, 1);
      if (musicMood === 'battle' && battleCtl) battleCtl.apply(battleIntensity, !!immediate);
    }

    function setMusicVolume(v){
      musicVol = clamp(+v, 0, 1);
      if (musicBus && ctx) musicBus.gain.setTargetAtTime(musicVol, ctx.currentTime, 0.05);
    }

    return {
      unlock, beginFrame,
      setEnabled: setEnabledFull, setVolume,
      laser, shieldHit, hullCrack, explosion, craftExplosion,
      click, engineHum, warpJump, repair, orderAck,
      chargeUp, victory, alert, hangarLaunch,
      setMusicMood, setMusicVolume, setBattleIntensity,
      get enabled(){ return enabled; }, get volume(){ return volume; },
      get musicVolume(){ return musicVol; },
      get battleIntensity(){ return battleIntensity; }
    };
  })();


  // ---------- Assets (AUTO) ----------
  // These files are already present in the folder (as you uploaded them).
  const ASSET_FILES = {
    airStation: 'Air Station.png',

    repDread: 'Republican Dreadnought.png',
    repBattle: 'Republican Battleship.png',
    repHeavyCruiser: 'Republican Heavy Cruiser.png',
    repLightCruiser: 'Republican Light Cruiser.png',
    repDestroyer: 'Republican Destroyer.png',
    repFrigate: 'Republican Frigate.png',
    repCorvette: 'Republican Corvette.png',
    repCarrierHeavy: 'Republican Heavy Carrier.png',
    repCarrierLight: 'Republican Light Carrier.png',

    empBattle: 'Imperial Battleship.png',
    empDestroyer: 'Imperial Destroyer.png',
    empDread: 'Imperial Remnant Dreadnought.png',

    // Imperial Remnant (new)
    remnantMothership: 'Imperial Remnant Mothership.png',

    stealthDestroyer: 'Phantom Stealth Destroyer.png',
    strikeCruiser: 'Tempest-Class Strike Cruiser.png',
    vanguardFrigate: 'Vanguard Multi-Role Frigate.png',
    commandCarrier: 'Sovereign Command Carrier.png',

    patrol: 'Republican & Imperial Patrol Ship.png',
    arcLight: 'Arc-Light Corvette.png',
    bastion: 'Bastion Defense Battleship.png',
    executor: 'Executor Super Star Destroyer.png',
    mc80a: 'MC80A Heavy Star Cruiser.png',
    isd2: 'Imperial II Star Destroyer.png',

    // Five Star Alignment
    fsaCapitalStation: 'Five Star Capital Station.png',
    fsaCarrier:        'Five Star Carrier.png',
    fsaBattleship:     'Five Star Battleship.png',
    fsaDestroyer:      'Five Star Destroyer.png',
    fsaFrigate:        'Five Star Frigate.png',
    fsaCorvette:       'Five Star Corvette.png',

    // Rebel Coalition
    rebelCommandCruiser:  'Rebel Command Cruiser.png',
    rebelFrigate:         'Rebel Frigate.png',
    rebelGunship:         'Rebel Gunship.png',
    rebelBlockadeRunner:  'Rebel Blockade Runner.png',
    rebelCorvette:        'Rebel Corvette.png',

    // United Earth Federation
    // United Nations Orbital Command (late 21st century theoretical designs)
    unoc_orionScout:         'UNOC Orion Scout.png',
    unoc_orionCruiser:       'UNOC Orion Cruiser.png',
    unoc_orionBattleship:    'UNOC Orion Battleship.png',
    unoc_superOrion:         'UNOC Super Orion.png',
    unoc_daedalus:           'UNOC Daedalus.png',
    unoc_longshot:           'UNOC Longshot.png',
    unoc_nervaGunship:       'UNOC NERVA Gunship.png',
    unoc_polyus:             'UNOC Polyus Platform.png',
    unoc_rodsFromGod:        'UNOC Rods From God.png',
    unoc_oNeillCarrier:      'UNOC O\'Neill Carrier.png',
    unoc_stanfordTorus:      'UNOC Stanford Torus.png',
    unoc_bernalSphere:       'UNOC Bernal Sphere.png',

    // 21st Century Earth (SpaceX / NASA era)
    ece_falcon1:          '21CE Falcon 1.png',
    ece_falcon9:          '21CE Falcon 9.png',
    ece_falconHeavy:      '21CE Falcon Heavy.png',
    ece_starship:         '21CE Starship.png',
    ece_starship2:        '21CE Starship 2.0.png',
    ece_starshipCarrier:  '21CE Starship Carrier.png',
    ece_iss:              '21CE ISS.png',
    ece_starlab:          '21CE Starlab.png',
    ece_axiom:            '21CE Axiom Station.png',
    ece_orbitalReef:      '21CE Orbital Reef.png',
    ece_gateway:          '21CE Lunar Gateway.png',

    uefOrbitalFortress:   'UEF Orbital Fortress.png',
    uefDreadnought:       'UEF Dreadnought.png',
    uefTitanCarrier:      'UEF Titan Carrier.png',
    uefBattlecruiser:     'UEF Battlecruiser.png',
    uefAssaultCruiser:    'UEF Assault Cruiser.png',
    uefEscortFrigate:     'UEF Escort Frigate.png',
    uefDestroyer:         'UEF Destroyer.png',
    uefCorvette:          'UEF Corvette.png',
    uefStealthScout:      'UEF Stealth Scout.png',
  };

  const images = new Map(); // key -> {img, ok}
  function loadImage(key, filename){
    const img = new Image();
    const rec = { img, ok:false, w:0, h:0, filename };
    images.set(key, rec);
    img.onload = () => { rec.ok=true; rec.w=img.naturalWidth; rec.h=img.naturalHeight; };
    img.onerror = () => { rec.ok=false; };
    img.src = assetPath(filename);
  }
  Object.entries(ASSET_FILES).forEach(([k,f])=>loadImage(k,f));

  // ---------- Game Data ----------
  const FACTIONS = {
    republic: { id:'republic', name:'Grand Republic',                tint:[35,95,220],   ai:false, team: 1 },
    csn:      { id:'csn',      name:'CSN',                          tint:[110,200,255], ai:true,  team: 2 },
    ngr:      { id:'ngr',      name:'New Grand Republic',           tint:[120,220,255], ai:true,  team: 2 },
    empire:   { id:'empire',   name:'Grand Empire',                 tint:[235,72,72],   ai:true,  team: 3 },
    remnant:  { id:'remnant',  name:'Imperial Remnant',             tint:[140,25,25],   ai:true,  team: 3 },
    starwars: { id:'starwars', name:'Star Wars',                    tint:[190,190,190], ai:false, team: 4 },
    fsa:      { id:'fsa',      name:'Five Star Alignment',          tint:[255,210,40],  ai:true,  team: 5 },
    rebel:    { id:'rebel',    name:'Rebel Coalition',              tint:[255,153,51],  ai:false, team: 2 },
    earth:    { id:'earth',    name:'United Earth Federation',      tint:[51,204,119],  ai:true,  team: 1 },
    ece:      { id:'ece',      name:'21st Century Earth',           tint:[200,220,255], ai:true,  team: 1 },
    unoc:     { id:'unoc',     name:'United Nations Orbital Command', tint:[240,200,80], ai:true,  team: 1 },
  };

  // Diplomacy: same team = allied, different team = hostile
  function isAlliedFaction(aId, bId){
    return (FACTIONS[aId]?.team ?? aId) === (FACTIONS[bId]?.team ?? bId);
  }
  function isHostileFaction(aId, bId){
    return !isAlliedFaction(aId, bId);
  }

  

  function countByFactionAndType(ships){
    const out = {};
    for (const s of ships){
      if (!s || !s.def) continue;
      const f = s.faction;
      const t = s.def.name;
      out[f] ??= {};
      out[f][t] = (out[f][t] || 0) + 1;
    }
    return out;
  }

  function incNested(map, factionId, typeName, n=1){
    map[factionId] ??= {};
    map[factionId][typeName] = (map[factionId][typeName] || 0) + n;
  }

  function makeBattleReportHTML(){
    const rep = world.battleReport;
    if (!rep) return '<div class="muted">No report available.</div>';
    const endCounts = countByFactionAndType(world.ships.filter(s=>s.isAlive()));
    const factions = Object.keys(FACTIONS).map(k=>FACTIONS[k].id);

    // Build a unified list of unit types per faction (from starts + destroyed + remaining)
    const rows = [];
    for (const fid of factions){
      const start = rep.startCounts[fid] || {};
      const dead  = rep.destroyedCounts[fid] || {};
      const end   = endCounts[fid] || {};
      const types = new Set([...Object.keys(start), ...Object.keys(dead), ...Object.keys(end)]);
      for (const type of Array.from(types).sort()){
        const s0 = start[type] || 0;
        const d0 = dead[type] || 0;
        const e0 = end[type] || 0;
        if (s0===0 && d0===0 && e0===0) continue;
        rows.push({fid, type, start:s0, destroyed:d0, remaining:e0});
      }
    }

    const factionHeader = (fid)=>{
      const f = FACTIONS[fid];
      return f ? f.name : fid;
    };

    const grouped = {};
    for (const r of rows){
      grouped[r.fid] ??= [];
      grouped[r.fid].push(r);
    }

    const duration = rep.endedAt && rep.startedAt ? Math.max(0,(rep.endedAt-rep.startedAt)/1000) : null;

    let html = '';
    html += `<div class="report-meta">
      <div><b>Duration:</b> ${duration!==null ? duration.toFixed(1)+'s' : '—'}</div>
      <div><b>Total Destroyed:</b> ${rep.totalDestroyed}</div>
    </div>`;

    for (const fid of factions){
      const list = grouped[fid] || [];
      // skip factions that never appeared
      const ever = Object.keys(rep.startCounts[fid]||{}).length || Object.keys(rep.destroyedCounts[fid]||{}).length || Object.keys(endCounts[fid]||{}).length;
      if (!ever) continue;

      const totals = list.reduce((acc,r)=>{acc.start+=r.start; acc.destroyed+=r.destroyed; acc.remaining+=r.remaining; return acc;},{start:0,destroyed:0,remaining:0});
      html += `<h3 class="report-h3">${factionHeader(fid)}</h3>`;
      html += `<div class="report-totals">Start: <b>${totals.start}</b> · Destroyed: <b>${totals.destroyed}</b> · Remaining: <b>${totals.remaining}</b></div>`;
      html += `<div class="table-wrap"><table class="report-table">
        <thead><tr><th>Unit Type</th><th>Start</th><th>Destroyed</th><th>Remaining</th></tr></thead><tbody>`;
      for (const r of list){
        html += `<tr><td>${escapeHTML(r.type)}</td><td>${r.start}</td><td>${r.destroyed}</td><td>${r.remaining}</td></tr>`;
      }
      html += `</tbody></table></div>`;
    }

    // CSV download
    const csvLines = ['Faction,Unit Type,Start,Destroyed,Remaining'];
    for (const r of rows){
      const fname = factionHeader(r.fid).replaceAll(',', ' ');
      const tname = r.type.replaceAll(',', ' ');
      csvLines.push(`${fname},${tname},${r.start},${r.destroyed},${r.remaining}`);
    }
    const csv = csvLines.join('\n');
    html += `<button class="btn btn-primary" id="btnDownloadReport">Download CSV</button>`;
    // store CSV for button handler
    rep._csv = csv;
    return html;
  }

  function escapeHTML(str){
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }

  // Damage types (ion good vs shields, plasma good vs hull)
  const DAMAGE = {
    ion:    { shield: 1.35, hull: 0.55 },
    plasma: { shield: 0.85, hull: 1.25 },
    kinetic:{ shield: 1.00, hull: 1.00 },
  };

    // Unit definitions.
  // "spriteKey" must exist in ASSET_FILES above to auto-use an image.
  // If spriteKey is missing, a vector silhouette is drawn (used for small craft).
  const UNIT_DEFS = [
    // ---------- Shared ----------
    { key:'air_station', name:'Air Station', role:'station', spriteKey:'airStation',
      r: 140, mass: 9000, speed: 0, shields: 9000, hull: 14000,
      weapons:[
        { name:'Defense Grid', type:'ion', dmg: 22, range: 620, cooldown: 0.12, pSpeed: 820, spread: 0.04 },
        { name:'Heavy Batteries', type:'plasma', dmg: 90, range: 720, cooldown: 1.2, pSpeed: 650, spread: 0.02 },
      ]
    },

    // ---------- Grand Republic (dark blue) ----------
    { key:'rep_carrier_heavy', name:'Republican Heavy Carrier', role:'carrier', spriteKey:'repCarrierHeavy',
      r: 76, mass: 3200, speed: 48, shields: 3600, hull: 5200,
      weapons:[
        { name:'Defense Grid', type:'ion', dmg: 18, range: 560, cooldown: 0.18, pSpeed: 880, spread: 0.06 },
        { name:'Plasma Turrets', type:'plasma', dmg: 34, range: 600, cooldown: 0.75, pSpeed: 660, spread: 0.03 },
      ]
    },
    { key:'rep_dread', name:'Republican Dreadnought', role:'capital', spriteKey:'repDread',
      r: 92, mass: 5200, speed: 45, shields: 5200, hull: 8200,
      weapons:[
        // Player-triggered super weapon:
        // - Target an enemy with T + click (focus target)
        { name:'Super Plasma Cannon', type:'plasma', dmg: 5000, range: 5000, cooldown: 20, windup: 2, pSpeed: 520, spread: 0.002, pierceShields:true, special:true, manual:true },
        { name:'Heavy Turrets', type:'plasma', dmg: 70, range: 720, cooldown: 1.25, pSpeed: 640, spread: 0.02 },
        { name:'Ion Lances', type:'ion', dmg: 26, range: 620, cooldown: 0.18, pSpeed: 820, spread: 0.05 },
      ]
    },
    { key:'rep_carrier_light', name:'Republican Light Carrier', role:'carrier', spriteKey:'repCarrierLight',
      r: 60, mass: 2100, speed: 60, shields: 2400, hull: 3400,
      weapons:[ { name:'Defense Ion', type:'ion', dmg: 16, range: 520, cooldown: 0.20, pSpeed: 880, spread: 0.07 } ]
    },
    { key:'rep_battle', name:'Republican Battleship', role:'capital', spriteKey:'repBattle',
      r: 84, mass: 4200, speed: 52, shields: 4600, hull: 7200,
      weapons:[
        { name:'Ion Screens', type:'ion', dmg: 18, range: 610, cooldown: 0.18, pSpeed: 900, spread: 0.06 },
        { name:'Plasma Batteries', type:'plasma', dmg: 58, range: 680, cooldown: 0.95, pSpeed: 700, spread: 0.03 },
      ]
    },

        { key:'rep_hcruiser', name:'Republican Heavy Cruiser', role:'escort', spriteKey:'repHeavyCruiser',
      r: 62, mass: 2400, speed: 70, shields: 2500, hull: 3300,
      weapons:[
        { name:'Plasma Turrets', type:'plasma', dmg: 36, range: 560, cooldown: 0.70, pSpeed: 660, spread: 0.03 },
        { name:'Ion Pods', type:'ion', dmg: 18, range: 520, cooldown: 0.22, pSpeed: 850, spread: 0.06 },
      ]
    },
    { key:'rep_destroyer', name:'Republican Destroyer', role:'screen', spriteKey:'repDestroyer',
      r: 40, mass: 920, speed: 115, shields: 950, hull: 1200,
      weapons:[
        { name:'Ion Cannons', type:'ion', dmg: 12, range: 460, cooldown: 0.16, pSpeed: 900, spread: 0.08 },
        { name:'Light Plasma', type:'plasma', dmg: 16, range: 440, cooldown: 0.55, pSpeed: 720, spread: 0.04 },
      ]
    },
    { key:'rep_lcruiser', name:'Republican Light Cruiser', role:'escort', spriteKey:'repLightCruiser',
      r: 52, mass: 1600, speed: 85, shields: 1650, hull: 2200,
      weapons:[
        { name:'Dual Plasma', type:'plasma', dmg: 26, range: 510, cooldown: 0.62, pSpeed: 690, spread: 0.03 },
        { name:'Ion Blasters', type:'ion', dmg: 14, range: 480, cooldown: 0.20, pSpeed: 880, spread: 0.07 },
      ]
    },
    { key:'rep_frigate', name:'Republican Frigate', role:'screen', spriteKey:'repFrigate',
      r: 34, mass: 720, speed: 125, shields: 720, hull: 900,
      weapons:[
        { name:'Kinetic Point Defense', type:'kinetic', dmg: 7, range: 360, cooldown: 0.10, pSpeed: 980, spread: 0.10 },
        { name:'Ion Emitters', type:'ion', dmg: 10, range: 420, cooldown: 0.18, pSpeed: 900, spread: 0.09 },
      ]
    },
    { key:'rep_corvette', name:'Republican Corvette', role:'strike', spriteKey:'repCorvette',
      r: 24, mass: 320, speed: 170, shields: 320, hull: 380,
      weapons:[ { name:'Pulse Plasma', type:'plasma', dmg: 10, range: 320, cooldown: 0.26, pSpeed: 820, spread: 0.10 } ]
    },
    { key:'patrol', name:'Patrol Ship', role:'strike', spriteKey:'patrol',
      r: 18, mass: 180, speed: 210, shields: 150, hull: 180,
      weapons:[ { name:'Light Kinetic', type:'kinetic', dmg: 5, range: 260, cooldown: 0.12, pSpeed: 980, spread: 0.12 } ]
    },

    // ---------- Grand Empire (red) ----------
    { key:'emp_battle', name:'Imperial Battleship', role:'capital', spriteKey:'empBattle',
      r: 80, mass: 3800, speed: 52, shields: 3300, hull: 6200,
      weapons:[
        { name:'Main Batteries', type:'plasma', dmg: 66, range: 690, cooldown: 1.00, pSpeed: 640, spread: 0.02 },
        { name:'Kinetic PD', type:'kinetic', dmg: 8, range: 380, cooldown: 0.10, pSpeed: 980, spread: 0.10 },
      ]
    },
    { key:'emp_destroyer', name:'Imperial Destroyer', role:'escort', spriteKey:'empDestroyer',
      r: 58, mass: 2100, speed: 72, shields: 1900, hull: 3600,
      weapons:[
        { name:'Plasma Turrets', type:'plasma', dmg: 38, range: 580, cooldown: 0.74, pSpeed: 660, spread: 0.03 },
        { name:'Ion Blasters', type:'ion', dmg: 18, range: 520, cooldown: 0.20, pSpeed: 880, spread: 0.06 },
      ]
    },


    // ---------- Star Wars (gray) ----------
    { key:'sw_executor', name:'Executor Super Star Destroyer', role:'capital', spriteKey: 'executor',
      // Length: 19,000m (19km). Visual scale vs 4.5km Air Station => r ≈ (19/4.5)*140 ≈ 591
      r: 591, mass: 24000, speed: 22, shields: 18000, hull: 28000,
      weapons:[
        { name:'Axial Super Turbolaser', type:'plasma', dmg: 950, range: 1850, cooldown: 18, windup: 2.8, pSpeed: 700, spread: 0.004, pierceShields:true, special:true },
        { name:'Heavy Turbolaser Battery A', type:'plasma', dmg: 140, range: 980, cooldown: 1.05, pSpeed: 720, spread: 0.016 },
        { name:'Heavy Turbolaser Battery B', type:'plasma', dmg: 140, range: 980, cooldown: 1.05, pSpeed: 720, spread: 0.016 },
        { name:'Heavy Turbolaser Battery C', type:'plasma', dmg: 140, range: 980, cooldown: 1.05, pSpeed: 720, spread: 0.016 },
        { name:'Heavy Turbolaser Battery D', type:'plasma', dmg: 140, range: 980, cooldown: 1.05, pSpeed: 720, spread: 0.016 },
        { name:'Ion Cannon Array A', type:'ion', dmg: 46, range: 920, cooldown: 0.20, pSpeed: 920, spread: 0.040 },
        { name:'Ion Cannon Array B', type:'ion', dmg: 46, range: 920, cooldown: 0.20, pSpeed: 920, spread: 0.040 },
        { name:'Kinetic Point Defense Grid', type:'kinetic', dmg: 11, range: 560, cooldown: 0.08, pSpeed: 980, spread: 0.090 },
        { name:'Ion Flak Screen', type:'ion', dmg: 20, range: 600, cooldown: 0.12, pSpeed: 980, spread: 0.085 },
      ]
    },

    { key:'sw_mc80a', name:'Mon Calamari MC80A Heavy Star Cruiser', role:'capital', spriteKey: 'mc80a',
      // Length: 1,200m (1.2km). Visual scale => r ≈ 37
      r: 37, mass: 5200, speed: 46, shields: 7000, hull: 9500,
      weapons:[
        { name:'Turbolaser Broadside', type:'plasma', dmg: 78, range: 760, cooldown: 1.05, pSpeed: 700, spread: 0.022 },
        { name:'Turbolaser Broadside', type:'plasma', dmg: 78, range: 760, cooldown: 1.05, pSpeed: 700, spread: 0.022 },
        { name:'Ion Cannon Battery', type:'ion', dmg: 28, range: 720, cooldown: 0.20, pSpeed: 900, spread: 0.055 },
        { name:'Kinetic Point Defense', type:'kinetic', dmg: 9, range: 460, cooldown: 0.10, pSpeed: 980, spread: 0.10 },
      ]
    },

    { key:'sw_isd2', name:'Class II ISD (Imperial II-class)', role:'capital', spriteKey: 'isd2',
      // Length: 1,600m (1.6km). Visual scale => r ≈ 50
      r: 50, mass: 6500, speed: 48, shields: 8000, hull: 11500,
      weapons:[
        { name:'Heavy Turbolasers', type:'plasma', dmg: 92, range: 820, cooldown: 1.05, pSpeed: 700, spread: 0.020 },
        { name:'Heavy Turbolasers', type:'plasma', dmg: 92, range: 820, cooldown: 1.05, pSpeed: 700, spread: 0.020 },
        { name:'Ion Cannons', type:'ion', dmg: 32, range: 760, cooldown: 0.18, pSpeed: 920, spread: 0.050 },
        { name:'Kinetic Point Defense', type:'kinetic', dmg: 9, range: 460, cooldown: 0.10, pSpeed: 980, spread: 0.10 },
      ]
    },

    // ---------- Imperial Remnant (dark red) ----------
    { key:'remnant_mothership', name:'Imperial Remnant Mothership', role:'capital', spriteKey:'remnantMothership',
      // Visual scale: 20km ("true size" relative to 4.5km Air Station)
      // r = (20 / 4.5) * 140 ≈ 622
      r: 622, mass: 28000, speed: 18, shields: 22000, hull: 36000,
      weapons:[
        // Super-heavy spinal cannon (limited uses)
        { name:'Annihilator Spinal Cannon', type:'plasma', dmg: 1150, range: 1700, cooldown: 28, windup: 2.8, pSpeed: 620, spread: 0.006, breachShields:true, pierceShields:true, usesMax: 3, special:true },

        // Heavy batteries (lots of guns)
        { name:'Heavy Plasma Battery A', type:'plasma', dmg: 120, range: 950, cooldown: 1.05, pSpeed: 700, spread: 0.018 },
        { name:'Heavy Plasma Battery B', type:'plasma', dmg: 120, range: 950, cooldown: 1.05, pSpeed: 700, spread: 0.018 },
        { name:'Heavy Plasma Battery C', type:'plasma', dmg: 120, range: 950, cooldown: 1.05, pSpeed: 700, spread: 0.018 },
        { name:'Heavy Plasma Battery D', type:'plasma', dmg: 120, range: 950, cooldown: 1.05, pSpeed: 700, spread: 0.018 },

        // Ion lances
        { name:'Ion Lance Array A', type:'ion', dmg: 42, range: 880, cooldown: 0.20, pSpeed: 900, spread: 0.040 },
        { name:'Ion Lance Array B', type:'ion', dmg: 42, range: 880, cooldown: 0.20, pSpeed: 900, spread: 0.040 },
        { name:'Ion Lance Array C', type:'ion', dmg: 42, range: 880, cooldown: 0.20, pSpeed: 900, spread: 0.040 },

        // Point defense grid
        { name:'Kinetic Point Defense Grid', type:'kinetic', dmg: 10, range: 520, cooldown: 0.08, pSpeed: 980, spread: 0.090 },
        { name:'Ion Flak Screen', type:'ion', dmg: 18, range: 560, cooldown: 0.12, pSpeed: 980, spread: 0.085 },
      ]
    },

    { key:'remnant_dread', name:'Imperial Remnant Dreadnought', role:'capital', spriteKey:'empDread',
      r: 92, mass: 5600, speed: 42, shields: 4800, hull: 9400,
      weapons:[
        // Special: shield-breaching gun (3 uses, 30s cooldown, with windup delay).
        { name:'Shield Breach Cannon', type:'plasma', dmg: 520, range: 1100, cooldown: 30, windup: 1.8, pSpeed: 560, spread: 0.01, breachShields:true, pierceShields:true, usesMax: 3, special:true },
        { name:'Heavy Turrets', type:'plasma', dmg: 72, range: 720, cooldown: 1.18, pSpeed: 640, spread: 0.02 },
        { name:'Ion Lances', type:'ion', dmg: 28, range: 640, cooldown: 0.18, pSpeed: 820, spread: 0.05 },
      ]
    },

    // ---------- CSN (light blue) ----------
    { key:'csn_sovereign', name:'Sovereign Command Carrier', role:'carrier', spriteKey:'commandCarrier',
      r: 88, mass: 4200, speed: 44, shields: 4200, hull: 6800,
      weapons:[
        { name:'Defense Grid', type:'ion', dmg: 20, range: 600, cooldown: 0.18, pSpeed: 880, spread: 0.06 },
        { name:'Heavy Plasma', type:'plasma', dmg: 54, range: 680, cooldown: 0.95, pSpeed: 640, spread: 0.02 },
      ]
    },
    { key:'csn_bastion', name:'Bastion Defense Battleship', role:'capital', spriteKey:'bastion',
      r: 82, mass: 4200, speed: 38, shields: 5200, hull: 7200,
      weapons:[
        { name:'Bulwark Plasma', type:'plasma', dmg: 78, range: 720, cooldown: 1.15, pSpeed: 630, spread: 0.02 },
        { name:'Ion Lances', type:'ion', dmg: 24, range: 640, cooldown: 0.18, pSpeed: 820, spread: 0.05 },
      ]
    },
    { key:'csn_tempest', name:'Tempest-Class Strike Cruiser', role:'escort', spriteKey:'strikeCruiser',
      r: 66, mass: 2500, speed: 78, shields: 2200, hull: 3400,
      weapons:[
        { name:'Plasma Barrage', type:'plasma', dmg: 44, range: 620, cooldown: 0.85, pSpeed: 660, spread: 0.03 },
        { name:'Ion Lances', type:'ion', dmg: 16, range: 580, cooldown: 0.18, pSpeed: 900, spread: 0.06 },
      ]
    },
    { key:'csn_phantom', name:'Phantom Stealth Destroyer', role:'strike', spriteKey:'stealthDestroyer',
      r: 44, mass: 980, speed: 140, shields: 700, hull: 1200,
      weapons:[
        { name:'Silent Plasma', type:'plasma', dmg: 18, range: 520, cooldown: 0.65, pSpeed: 720, spread: 0.02 },
        { name:'Ion Needle', type:'ion', dmg: 10, range: 500, cooldown: 0.16, pSpeed: 980, spread: 0.03 },
      ],
      traits:{ stealth: true }
    },
    { key:'csn_vanguard', name:'Vanguard Multi-Role Frigate', role:'screen', spriteKey:'vanguardFrigate',
      r: 40, mass: 980, speed: 118, shields: 980, hull: 1300,
      weapons:[
        { name:'Kinetic PD', type:'kinetic', dmg: 7, range: 380, cooldown: 0.10, pSpeed: 980, spread: 0.10 },
        { name:'Ion Emitters', type:'ion', dmg: 12, range: 460, cooldown: 0.18, pSpeed: 900, spread: 0.08 },
      ]
    },
    { key:'csn_arc', name:'Arc-Light Corvette', role:'strike', spriteKey:'arcLight',
      r: 26, mass: 360, speed: 185, shields: 340, hull: 420,
      weapons:[ { name:'Arc Plasma', type:'plasma', dmg: 11, range: 340, cooldown: 0.22, pSpeed: 860, spread: 0.10 } ]
    },

    // ---------- Five Star Alignment (gold) ----------
    // Scale: Air Station = 4.5 km → r=140.  Formula: r = (km / 4.5) * 140
    //   Capital Star Station : 12 km  → (12/4.5)*140 = 373
    //   Five Star Carrier    :  6 km  → (6/4.5)*140  = 187
    //   Five Star Battleship :  3 km  → (3/4.5)*140  = 93
    //   Five Star Destroyer  :  1.5km → (1.5/4.5)*140= 47
    //   Five Star Frigate    : 250 m  → clamped to 14 for visibility
    //   Five Star Corvette   :  60 m  → clamped to 8  (craft-scale vector)

    { key:'fsa_capital_station', name:'Capital Star Station', role:'station', spriteKey:'fsaCapitalStation',
      // 12 km — massive fortress-station; bristling broadside arrays and a spinal superweapon
      r: 373, mass: 18000, speed: 0, shields: 20000, hull: 32000,
      weapons:[
        { name:'Stellar Lance',           type:'plasma',  dmg:1400, range:2200, cooldown:35,  windup:3.5, pSpeed:580, spread:0.003, pierceShields:true, breachShields:true, usesMax:5, special:true },
        { name:'Orbital Plasma Array A',  type:'plasma',  dmg:130,  range:1100, cooldown:1.10, pSpeed:680, spread:0.016 },
        { name:'Orbital Plasma Array B',  type:'plasma',  dmg:130,  range:1100, cooldown:1.10, pSpeed:680, spread:0.016 },
        { name:'Orbital Plasma Array C',  type:'plasma',  dmg:130,  range:1100, cooldown:1.10, pSpeed:680, spread:0.016 },
        { name:'Orbital Plasma Array D',  type:'plasma',  dmg:130,  range:1100, cooldown:1.10, pSpeed:680, spread:0.016 },
        { name:'Ion Suppression Grid A',  type:'ion',     dmg:50,   range:1000, cooldown:0.20, pSpeed:900, spread:0.038 },
        { name:'Ion Suppression Grid B',  type:'ion',     dmg:50,   range:1000, cooldown:0.20, pSpeed:900, spread:0.038 },
        { name:'Ion Suppression Grid C',  type:'ion',     dmg:50,   range:1000, cooldown:0.20, pSpeed:900, spread:0.038 },
        { name:'Kinetic Defense Web',     type:'kinetic', dmg:13,   range:580,  cooldown:0.07, pSpeed:980, spread:0.085 },
        { name:'Ion Flak Curtain',        type:'ion',     dmg:22,   range:620,  cooldown:0.11, pSpeed:980, spread:0.080 },
      ]
    },

    { key:'fsa_carrier', name:'Five Star Carrier', role:'carrier', spriteKey:'fsaCarrier',
      // 6 km — primary carrier; hangar for all craft types, heavy self-defense batteries
      r: 187, mass: 12000, speed: 28, shields: 11000, hull: 18000,
      weapons:[
        { name:'Carrier Plasma Battery A', type:'plasma',  dmg:100, range:980, cooldown:1.05, pSpeed:700, spread:0.018 },
        { name:'Carrier Plasma Battery B', type:'plasma',  dmg:100, range:980, cooldown:1.05, pSpeed:700, spread:0.018 },
        { name:'Ion Lances A',             type:'ion',     dmg:44,  range:920, cooldown:0.20, pSpeed:900, spread:0.040 },
        { name:'Ion Lances B',             type:'ion',     dmg:44,  range:920, cooldown:0.20, pSpeed:900, spread:0.040 },
        { name:'Kinetic PD Grid',          type:'kinetic', dmg:12,  range:560, cooldown:0.08, pSpeed:980, spread:0.090 },
        { name:'Ion Flak Screen',          type:'ion',     dmg:20,  range:600, cooldown:0.12, pSpeed:980, spread:0.082 },
      ]
    },

    { key:'fsa_battleship', name:'Five Star Battleship', role:'capital', spriteKey:'fsaBattleship',
      // 3 km — heavy capital ship; shield-breaching main gun + broadside batteries
      r: 93, mass: 7200, speed: 38, shields: 8500, hull: 13000,
      weapons:[
        { name:'Stellar Breach Cannon', type:'plasma', dmg:680, range:1350, cooldown:28, windup:2.2, pSpeed:560, spread:0.008, breachShields:true, pierceShields:true, usesMax:4, special:true },
        { name:'Heavy Battery A',       type:'plasma', dmg:105, range:880, cooldown:1.08, pSpeed:700, spread:0.020 },
        { name:'Heavy Battery B',       type:'plasma', dmg:105, range:880, cooldown:1.08, pSpeed:700, spread:0.020 },
        { name:'Ion Lance Array A',     type:'ion',    dmg:40,  range:820, cooldown:0.20, pSpeed:900, spread:0.042 },
        { name:'Ion Lance Array B',     type:'ion',    dmg:40,  range:820, cooldown:0.20, pSpeed:900, spread:0.042 },
        { name:'Kinetic PD',            type:'kinetic',dmg:11,  range:520, cooldown:0.08, pSpeed:980, spread:0.090 },
        { name:'Ion Flak',              type:'ion',    dmg:20,  range:560, cooldown:0.12, pSpeed:980, spread:0.085 },
      ]
    },

    { key:'fsa_destroyer', name:'Five Star Destroyer', role:'escort', spriteKey:'fsaDestroyer',
      // 1.5 km — fast escort; dual role as anti-ship skirmisher and craft support
      r: 47, mass: 2800, speed: 68, shields: 3200, hull: 5400,
      weapons:[
        { name:'Plasma Broadside A', type:'plasma',  dmg:58, range:700, cooldown:0.90, pSpeed:680, spread:0.024 },
        { name:'Plasma Broadside B', type:'plasma',  dmg:58, range:700, cooldown:0.90, pSpeed:680, spread:0.024 },
        { name:'Ion Lances A',       type:'ion',     dmg:26, range:660, cooldown:0.18, pSpeed:900, spread:0.048 },
        { name:'Ion Lances B',       type:'ion',     dmg:26, range:660, cooldown:0.18, pSpeed:900, spread:0.048 },
        { name:'Kinetic PD',         type:'kinetic', dmg:9,  range:420, cooldown:0.10, pSpeed:980, spread:0.100 },
      ]
    },

    { key:'fsa_frigate', name:'Five Star Frigate', role:'screen', spriteKey:'fsaFrigate',
      // 250 m — fast screening ship
      r: 30, mass: 420, speed: 130, shields: 450, hull: 600,
      weapons:[
        { name:'Twin Plasma Guns', type:'plasma',  dmg:18, range:420, cooldown:0.55, pSpeed:760, spread:0.040 },
        { name:'Ion Emitters',     type:'ion',     dmg:10, range:400, cooldown:0.18, pSpeed:900, spread:0.090 },
        { name:'Kinetic PD',       type:'kinetic', dmg:6,  range:300, cooldown:0.10, pSpeed:980, spread:0.120 },
      ]
    },

    { key:'fsa_corvette', name:'Five Star Corvette', role:'strike', spriteKey:'fsaCorvette',
      // 60 m — nimble strike ship
      r: 20, mass: 160, speed: 190, shields: 160, hull: 210,
      weapons:[
        { name:'Pulse Plasma', type:'plasma', dmg:11, range:310, cooldown:0.28, pSpeed:840, spread:0.100 },
        { name:'Ion Stinger',  type:'ion',    dmg:7,  range:290, cooldown:0.16, pSpeed:960, spread:0.110 },
      ]
    },

    // ---------- Five Star Alignment craft ----------
    { key:'fsa_fighter',     name:'FSA Fighter',     role:'craft', craft:'fighter',     r:9,  mass:34,  speed:320, shields:38,  hull:48,
      weapons:[ { name:'Star Pulse',    type:'ion',     dmg:5.2, range:265, cooldown:0.12, pSpeed:980, spread:0.12 } ]
    },
    { key:'fsa_bomber',      name:'FSA Bomber',      role:'craft', craft:'bomber',      r:11, mass:48,  speed:235, shields:60,  hull:75,
      weapons:[ { name:'Nova Torpedo',  type:'plasma',  dmg:26,  range:340, cooldown:1.10, pSpeed:540, spread:0.06 } ]
    },
    { key:'fsa_interceptor', name:'FSA Interceptor', role:'craft', craft:'interceptor', r:8,  mass:28,  speed:355, shields:30,  hull:38,
      weapons:[ { name:'Kinetic Burst', type:'kinetic', dmg:4.5, range:245, cooldown:0.10, pSpeed:980, spread:0.14 } ]
    },
    { key:'fsa_shuttle',     name:'FSA Shuttle',     role:'craft', craft:'shuttle',     r:10, mass:42,  speed:255, shields:44,  hull:58,
      weapons:[ { name:'Light Kinetic', type:'kinetic', dmg:2.6, range:225, cooldown:0.18, pSpeed:980, spread:0.14 } ]
    },
    { key:'fsa_drone',       name:'FSA Drone',       role:'craft', craft:'drone',       r:7,  mass:20,  speed:310, shields:20,  hull:25,
      weapons:[ { name:'Micro Plasma',  type:'plasma',  dmg:3.6, range:225, cooldown:0.11, pSpeed:940, spread:0.16 } ]
    },

    // ---------- Craft (no sprites) ----------
    // Republic craft
    { key:'rep_shuttle', name:'Republican Shuttle', role:'craft', craft:'shuttle', r: 10, mass: 40, speed: 260, shields: 40, hull: 55,
      weapons:[ { name:'Light Kinetic', type:'kinetic', dmg: 2.5, range: 220, cooldown: 0.18, pSpeed: 980, spread: 0.14 } ]
    },
    { key:'rep_bomber', name:'Republican Bomber', role:'craft', craft:'bomber', r: 11, mass: 46, speed: 240, shields: 55, hull: 65,
      weapons:[ { name:'Plasma Torpedo', type:'plasma', dmg: 22, range: 320, cooldown: 1.10, pSpeed: 560, spread: 0.06 } ]
    },
    { key:'rep_fighter', name:'Republican Fighter', role:'craft', craft:'fighter', r: 9, mass: 34, speed: 310, shields: 35, hull: 42,
      weapons:[ { name:'Ion Pulse', type:'ion', dmg: 4.8, range: 260, cooldown: 0.12, pSpeed: 980, spread: 0.12 } ]
    },
    { key:'rep_interceptor', name:'Republican Interceptor', role:'craft', craft:'interceptor', r: 8, mass: 28, speed: 340, shields: 28, hull: 34,
      weapons:[ { name:'Kinetic Burst', type:'kinetic', dmg: 4.2, range: 240, cooldown: 0.10, pSpeed: 980, spread: 0.14 } ]
    },
    { key:'rep_drone', name:'Republican Drone', role:'craft', craft:'drone', r: 7, mass: 20, speed: 300, shields: 18, hull: 22,
      weapons:[ { name:'Micro Ion', type:'ion', dmg: 3.3, range: 220, cooldown: 0.11, pSpeed: 980, spread: 0.16 } ]
    },

    // Empire craft
    { key:'emp_bomber', name:'Imperial Bomber', role:'craft', craft:'bomber', r: 11, mass: 46, speed: 235, shields: 55, hull: 70,
      weapons:[ { name:'Plasma Torpedo', type:'plasma', dmg: 24, range: 330, cooldown: 1.12, pSpeed: 560, spread: 0.06 } ]
    },
    { key:'emp_fighter', name:'Imperial Fighter', role:'craft', craft:'fighter', r: 9, mass: 34, speed: 300, shields: 34, hull: 46,
      weapons:[ { name:'Plasma Pulse', type:'plasma', dmg: 4.8, range: 260, cooldown: 0.12, pSpeed: 940, spread: 0.12 } ]
    },
    { key:'emp_interceptor', name:'Imperial Interceptor', role:'craft', craft:'interceptor', r: 8, mass: 28, speed: 340, shields: 26, hull: 36,
      weapons:[ { name:'Kinetic Burst', type:'kinetic', dmg: 4.4, range: 240, cooldown: 0.10, pSpeed: 980, spread: 0.14 } ]
    },
    { key:'emp_drone', name:'Imperial Drone', role:'craft', craft:'drone', r: 7, mass: 20, speed: 295, shields: 18, hull: 24,
      weapons:[ { name:'Micro Plasma', type:'plasma', dmg: 3.4, range: 220, cooldown: 0.11, pSpeed: 940, spread: 0.16 } ]
    },

    // Remnant craft
    { key:'rem_bomber', name:'Remnant Bomber', role:'craft', craft:'bomber', r: 11, mass: 48, speed: 230, shields: 60, hull: 78,
      weapons:[ { name:'Siege Torpedo', type:'plasma', dmg: 28, range: 340, cooldown: 1.18, pSpeed: 540, spread: 0.06 } ]
    },
    { key:'rem_fighter', name:'Remnant Fighter', role:'craft', craft:'fighter', r: 9, mass: 36, speed: 295, shields: 36, hull: 52,
      weapons:[ { name:'Ion Pulse', type:'ion', dmg: 5.0, range: 270, cooldown: 0.12, pSpeed: 980, spread: 0.12 } ]
    },
    { key:'rem_interceptor', name:'Remnant Interceptor', role:'craft', craft:'interceptor', r: 8, mass: 30, speed: 335, shields: 28, hull: 40,
      weapons:[ { name:'Kinetic Burst', type:'kinetic', dmg: 4.6, range: 250, cooldown: 0.10, pSpeed: 980, spread: 0.14 } ]
    },
    { key:'rem_drone', name:'Remnant Drone', role:'craft', craft:'drone', r: 7, mass: 22, speed: 290, shields: 20, hull: 26,
      weapons:[ { name:'Micro Ion', type:'ion', dmg: 3.6, range: 230, cooldown: 0.11, pSpeed: 980, spread: 0.16 } ]
    },

    // CSN craft
    { key:'csn_bomber', name:'CSN Bomber', role:'craft', craft:'bomber', r: 11, mass: 46, speed: 245, shields: 58, hull: 70,
      weapons:[ { name:'Plasma Torpedo', type:'plasma', dmg: 23, range: 330, cooldown: 1.08, pSpeed: 570, spread: 0.06 } ]
    },
    { key:'csn_fighter', name:'CSN Fighter', role:'craft', craft:'fighter', r: 9, mass: 34, speed: 315, shields: 38, hull: 46,
      weapons:[ { name:'Ion Pulse', type:'ion', dmg: 5.0, range: 270, cooldown: 0.12, pSpeed: 980, spread: 0.12 } ]
    },
    { key:'csn_interceptor', name:'CSN Interceptor', role:'craft', craft:'interceptor', r: 8, mass: 28, speed: 345, shields: 30, hull: 36,
      weapons:[ { name:'Kinetic Burst', type:'kinetic', dmg: 4.3, range: 250, cooldown: 0.10, pSpeed: 980, spread: 0.14 } ]
    },
    { key:'csn_drone', name:'CSN Drone', role:'craft', craft:'drone', r: 7, mass: 20, speed: 305, shields: 20, hull: 24,
      weapons:[ { name:'Micro Ion', type:'ion', dmg: 3.4, range: 230, cooldown: 0.11, pSpeed: 980, spread: 0.16 } ]
    },

    // ═══════════════════════════════════════════════════════════
    // REBEL COALITION
    // ═══════════════════════════════════════════════════════════
    { key:'rebel_command_cruiser', name:'Rebel Command Cruiser', role:'capital', spriteKey:'rebelCommandCruiser',
      r: 78, mass: 4000, speed: 55, shields: 3200, hull: 5800,
      weapons:[
        { name:'Heavy Plasma Battery',  type:'plasma',  dmg:95, range:680, cooldown:1.80, pSpeed:640, spread:0.04 },
        { name:'Ion Broadside',         type:'ion',     dmg:70, range:580, cooldown:1.40, pSpeed:720, spread:0.06 },
        { name:'Kinetic Point Defence', type:'kinetic', dmg:22, range:340, cooldown:0.30, pSpeed:980, spread:0.12 },
      ]
    },
    { key:'rebel_frigate', name:'Rebel Frigate', role:'escort', spriteKey:'rebelFrigate',
      r: 60, mass: 1800, speed: 110, shields: 1100, hull: 1600,
      weapons:[
        { name:'Salvaged Ion Cannon', type:'ion',     dmg:42, range:540, cooldown:1.10, pSpeed:760, spread:0.07 },
        { name:'Rail Gun',            type:'kinetic', dmg:30, range:500, cooldown:0.80, pSpeed:900, spread:0.09 },
        { name:'Point Defence',       type:'kinetic', dmg:12, range:280, cooldown:0.22, pSpeed:980, spread:0.13 },
      ]
    },
    { key:'rebel_gunship', name:'Rebel Gunship', role:'screen', spriteKey:'rebelGunship',
      r: 38, mass: 820, speed: 145, shields: 600, hull: 850,
      weapons:[
        { name:'Plasma Burst Array', type:'plasma', dmg:28, range:370, cooldown:0.55, pSpeed:800, spread:0.09 },
        { name:'Ion Repeater',       type:'ion',    dmg:18, range:320, cooldown:0.35, pSpeed:900, spread:0.11 },
      ]
    },
    { key:'rebel_blockade_runner', name:'Rebel Blockade Runner', role:'strike', spriteKey:'rebelBlockadeRunner',
      r: 28, mass: 480, speed: 210, shields: 380, hull: 490,
      weapons:[
        { name:'Nose Ion Lance', type:'ion',    dmg:34, range:480, cooldown:0.90, pSpeed:820, spread:0.06 },
        { name:'Torpedo Tube',   type:'plasma', dmg:55, range:520, cooldown:2.20, pSpeed:560, spread:0.05 },
      ]
    },
    { key:'rebel_corvette', name:'Rebel Corvette', role:'strike', spriteKey:'rebelCorvette',
      r: 22, mass: 280, speed: 190, shields: 220, hull: 300,
      weapons:[
        { name:'Forward Ion Gun', type:'ion',    dmg:16, range:330, cooldown:0.55, pSpeed:860, spread:0.10 },
        { name:'Torpedo',         type:'plasma', dmg:38, range:360, cooldown:2.00, pSpeed:540, spread:0.07 },
      ]
    },
    { key:'rebel_fighter',     name:'Rebel Fighter',     role:'craft', craft:'fighter',     r:9,  mass:34, speed:315, shields:36, hull:44,
      weapons:[ { name:'Ion Pulse',       type:'ion',     dmg:4.9, range:265, cooldown:0.12, pSpeed:980, spread:0.12 } ]
    },
    { key:'rebel_bomber',      name:'Rebel Bomber',      role:'craft', craft:'bomber',      r:11, mass:46, speed:240, shields:55, hull:68,
      weapons:[ { name:'Plasma Torpedo',  type:'plasma',  dmg:23,  range:325, cooldown:1.10, pSpeed:555, spread:0.06 } ]
    },
    { key:'rebel_interceptor', name:'Rebel Interceptor', role:'craft', craft:'interceptor', r:8,  mass:28, speed:340, shields:28, hull:36,
      weapons:[ { name:'Kinetic Burst',   type:'kinetic', dmg:4.2, range:245, cooldown:0.10, pSpeed:980, spread:0.14 } ]
    },

    // ═══════════════════════════════════════════════════════════
    // UNITED EARTH FEDERATION
    // ═══════════════════════════════════════════════════════════
    { key:'uef_orbital_fortress', name:'UEF Orbital Fortress', role:'station', spriteKey:'uefOrbitalFortress',
      r: 200, mass: 85000, speed: 0, shields: 32000, hull: 48000,
      weapons:[
        { name:'Planetary Siege Cannon',  type:'plasma',  dmg:420, range:1100, cooldown:4.50, pSpeed:560, spread:0.02, windup:2.5 },
        { name:'Mass Driver Battery',     type:'kinetic', dmg:130, range:820,  cooldown:1.20, pSpeed:980, spread:0.04 },
        { name:'Ion Siege Array',         type:'ion',     dmg:200, range:900,  cooldown:2.20, pSpeed:720, spread:0.03 },
        { name:'Point Defence Grid',      type:'kinetic', dmg:18,  range:380,  cooldown:0.18, pSpeed:980, spread:0.10 },
        { name:'Interceptor Missile',     type:'plasma',  dmg:55,  range:620,  cooldown:1.10, pSpeed:680, spread:0.08 },
      ]
    },
    { key:'uef_dreadnought', name:'UEF Dreadnought', role:'capital', spriteKey:'uefDreadnought',
      r: 96, mass: 28000, speed: 28, shields: 16000, hull: 26000,
      weapons:[
        { name:'Supermass Driver',       type:'kinetic', dmg:340, range:950, cooldown:3.80, pSpeed:980, spread:0.02, windup:2.0 },
        { name:'Plasma Siege Battery',   type:'plasma',  dmg:220, range:840, cooldown:2.60, pSpeed:600, spread:0.03 },
        { name:'Ion Broadside Array',    type:'ion',     dmg:110, range:720, cooldown:1.50, pSpeed:740, spread:0.05 },
        { name:'Point Defence Cluster',  type:'kinetic', dmg:24,  range:360, cooldown:0.22, pSpeed:980, spread:0.11 },
      ]
    },
    { key:'uef_titan_carrier', name:'UEF Titan Carrier', role:'carrier', spriteKey:'uefTitanCarrier',
      r: 100, mass: 32000, speed: 22, shields: 12000, hull: 20000,
      weapons:[
        { name:'Carrier Defence Battery', type:'kinetic', dmg:80,  range:680, cooldown:1.20, pSpeed:900, spread:0.06 },
        { name:'Point Defence Grid',      type:'kinetic', dmg:20,  range:380, cooldown:0.20, pSpeed:980, spread:0.10 },
        { name:'Anti-Ship Missile',       type:'plasma',  dmg:120, range:760, cooldown:2.40, pSpeed:640, spread:0.05 },
      ]
    },
    { key:'uef_battlecruiser', name:'UEF Battlecruiser', role:'capital', spriteKey:'uefBattlecruiser',
      r: 84, mass: 9600, speed: 58, shields: 7200, hull: 11500,
      weapons:[
        { name:'Forward Kinetic Battery', type:'kinetic', dmg:160, range:800, cooldown:2.20, pSpeed:980, spread:0.04 },
        { name:'Plasma Broadside',        type:'plasma',  dmg:110, range:720, cooldown:1.80, pSpeed:640, spread:0.05 },
        { name:'Ion Disruptor',           type:'ion',     dmg:70,  range:640, cooldown:1.30, pSpeed:760, spread:0.07 },
        { name:'Close Defence',           type:'kinetic', dmg:20,  range:320, cooldown:0.25, pSpeed:980, spread:0.12 },
      ]
    },
    { key:'uef_assault_cruiser', name:'UEF Assault Cruiser', role:'escort', spriteKey:'uefAssaultCruiser',
      r: 64, mass: 3200, speed: 85, shields: 3000, hull: 4800,
      weapons:[
        { name:'Anti-Ship Missile Pod', type:'plasma',  dmg:85, range:700, cooldown:1.80, pSpeed:660, spread:0.06 },
        { name:'Kinetic Cannon',        type:'kinetic', dmg:48, range:560, cooldown:0.90, pSpeed:940, spread:0.08 },
        { name:'Point Defence',         type:'kinetic', dmg:16, range:300, cooldown:0.20, pSpeed:980, spread:0.12 },
      ]
    },
    { key:'uef_escort_frigate', name:'UEF Escort Frigate', role:'escort', spriteKey:'uefEscortFrigate',
      r: 50, mass: 1400, speed: 118, shields: 1000, hull: 1400,
      weapons:[
        { name:'Main Gun',      type:'kinetic', dmg:36, range:520, cooldown:0.85, pSpeed:940, spread:0.08 },
        { name:'Missile Pod',   type:'plasma',  dmg:48, range:560, cooldown:1.40, pSpeed:660, spread:0.07 },
        { name:'Point Defence', type:'kinetic', dmg:12, range:270, cooldown:0.20, pSpeed:980, spread:0.13 },
      ]
    },
    { key:'uef_destroyer', name:'UEF Destroyer', role:'screen', spriteKey:'uefDestroyer',
      r: 38, mass: 720, speed: 152, shields: 560, hull: 780,
      weapons:[
        { name:'Rapid Kinetic Cannon', type:'kinetic', dmg:22, range:400, cooldown:0.35, pSpeed:980, spread:0.10 },
        { name:'Interceptor Missile',  type:'plasma',  dmg:40, range:460, cooldown:1.20, pSpeed:680, spread:0.08 },
      ]
    },
    { key:'uef_corvette', name:'UEF Corvette', role:'strike', spriteKey:'uefCorvette',
      r: 24, mass: 260, speed: 200, shields: 210, hull: 280,
      weapons:[
        { name:'Torpedo Tube',  type:'plasma',  dmg:52, range:480, cooldown:2.20, pSpeed:560, spread:0.05 },
        { name:'Light Kinetic', type:'kinetic', dmg:14, range:320, cooldown:0.40, pSpeed:980, spread:0.12 },
      ]
    },
    { key:'uef_stealth_scout', name:'UEF Stealth Scout', role:'strike', spriteKey:'uefStealthScout',
      r: 32, mass: 340, speed: 230, shields: 180, hull: 240,
      traits: { stealth: true },
      weapons:[
        { name:'Stealth Ion Lance', type:'ion',    dmg:38, range:500, cooldown:1.10, pSpeed:840, spread:0.06 },
        { name:'Micro Torpedo',     type:'plasma', dmg:44, range:440, cooldown:2.00, pSpeed:580, spread:0.05 },
      ]
    },
    { key:'uef_fighter',     name:'UEF Fighter',     role:'craft', craft:'fighter',     r:9,  mass:34, speed:320, shields:38, hull:48,
      weapons:[ { name:'Kinetic Burst',  type:'kinetic', dmg:5.0, range:265, cooldown:0.11, pSpeed:980, spread:0.12 } ]
    },
    { key:'uef_bomber',      name:'UEF Bomber',      role:'craft', craft:'bomber',      r:11, mass:48, speed:238, shields:58, hull:72,
      weapons:[ { name:'Guided Torpedo', type:'plasma',  dmg:25,  range:335, cooldown:1.12, pSpeed:560, spread:0.06 } ]
    },
    { key:'uef_interceptor', name:'UEF Interceptor', role:'craft', craft:'interceptor', r:8,  mass:28, speed:350, shields:30, hull:38,
      weapons:[ { name:'Kinetic Burst',  type:'kinetic', dmg:4.5, range:250, cooldown:0.10, pSpeed:980, spread:0.14 } ]
    },
    { key:'uef_drone',       name:'UEF Drone',       role:'craft', craft:'drone',       r:7,  mass:20, speed:310, shields:20, hull:26,
      weapons:[ { name:'Micro Plasma',   type:'plasma',  dmg:3.5, range:225, cooldown:0.11, pSpeed:940, spread:0.16 } ]
    },

    // ═══════════════════════════════════════════════════════════
    // UNITED NATIONS ORBITAL COMMAND  (late-21st century theoretical designs)
    // ── DELIBERATELY THE WEAKEST FACTION in the game ──
    // These are near-future concepts built with 21st-century materials and propulsion.
    // No shields of any kind. Hulls are thin steel/aluminium trusses — not exotic armour.
    // Weapons are chemical or fission rockets moving at a fraction of sci-fi projectile speeds;
    // any advanced PD system will intercept them long before they arrive.
    // MIRACL lasers do ~1 MW — a curiosity, not a threat, against shielded warship hulls.
    // Reference ceiling: a Republic Patrol Ship (shields 150, hull 180, dmg 5) beats any
    // single UNOC escort handily. UNOC wins only through sheer drone numbers.
    // ═══════════════════════════════════════════════════════════

    // ── Longshot (~50 m nuclear probe-gunship → r=10) ──────────────────────────────
    { key:'unoc_longshot', name:'Longshot Nuclear Probe', role:'strike', spriteKey:'unoc_longshot',
      r: 10, mass: 80, speed: 300, shields: 0, hull: 40,
      weapons:[
        { name:'CIWS Gatling',              type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'Nuclear Micro-Missile (×4)',type:'plasma',  dmg:20, range:480, cooldown:8.00, pSpeed:280, spread:0.10 },
        { name:'Defensive Missile (×6)',    type:'kinetic', dmg:3, range:160, cooldown:0.16, pSpeed:700, spread:0.14 },
      ]
    },

    // ── NERVA Gunship (~60 m nuclear rocket gunship → r=12) ───────────────────────
    { key:'unoc_nervaGunship', name:'NERVA Nuclear Gunship', role:'screen', spriteKey:'unoc_nervaGunship',
      r: 12, mass: 140, speed: 220, shields: 0, hull: 80,
      weapons:[
        { name:'CIWS Gatling A',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Gatling B',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'Nuclear Missile (×6)',      type:'plasma',  dmg:28, range:540, cooldown:7.00, pSpeed:260, spread:0.09 },
        { name:'Defensive Missile (×10)',   type:'kinetic', dmg:3, range:170, cooldown:0.16, pSpeed:700, spread:0.14 },
        { name:'MIRACL Megawatt Laser',     type:'kinetic', dmg:7, range:600, cooldown:5.50, pSpeed:9999, spread:0.010 },
      ]
    },

    // ── Polyus Platform (~37 m Soviet space weapons platform → r=14) ──────────────
    { key:'unoc_polyus', name:'Polyus Weapons Platform', role:'strike', spriteKey:'unoc_polyus',
      r: 14, mass: 80000, speed: 10, shields: 0, hull: 110,
      weapons:[
        { name:'Polyus Megawatt Laser A',   type:'kinetic', dmg:8, range:650, cooldown:5.00, pSpeed:9999, spread:0.010 },
        { name:'Polyus Megawatt Laser B',   type:'kinetic', dmg:8, range:650, cooldown:5.00, pSpeed:9999, spread:0.010 },
        { name:'Nuclear Mine Launcher',     type:'plasma',  dmg:45, range:260, cooldown:12.0, pSpeed:180, spread:0.12 },
        { name:'CIWS Gatling',              type:'kinetic', dmg:1, range:120, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'Defensive Missile (×8)',    type:'kinetic', dmg:3, range:160, cooldown:0.16, pSpeed:700, spread:0.14 },
      ]
    },

    // ── Rods from God Platform (~30 m platform → r=10, stationary) ────────────────
    { key:'unoc_rodsFromGod', name:'Rods from God Platform', role:'station', spriteKey:'unoc_rodsFromGod',
      // The rods are devastating vs planetary surface targets but in ship-to-ship combat
      // the 5-second windup telegraphs the shot; any maneuvering ship sidesteps it.
      // Platform itself is paper-thin — one energy volley destroys it.
      r: 10, mass: 20000, speed: 0, shields: 0, hull: 70,
      weapons:[
        { name:'Tungsten Kinetic Rod A',    type:'kinetic', dmg:150, range:1100, cooldown:30.0, windup:5.0, pSpeed:600, spread:0.005, special:true },
        { name:'Tungsten Kinetic Rod B',    type:'kinetic', dmg:150, range:1100, cooldown:30.0, windup:5.0, pSpeed:600, spread:0.005, special:true },
        { name:'CIWS Gatling',              type:'kinetic', dmg:1, range:120, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'Defensive Missile (×12)',   type:'kinetic', dmg:3, range:160, cooldown:0.16, pSpeed:700, spread:0.14 },
      ]
    },

    // ── Orion Scout (~100 m nuclear pulse → r=18) ─────────────────────────────────
    { key:'unoc_orionScout', name:'Orion Scout (Nuclear Pulse)', role:'escort', spriteKey:'unoc_orionScout',
      r: 18, mass: 2200, speed: 155, shields: 0, hull: 520,
      weapons:[
        { name:'CIWS Gatling A',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Gatling B',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'Nuclear Pulse Bomb (×8)',   type:'plasma',  dmg:35, range:440, cooldown:6.00, pSpeed:260, spread:0.08 },
        { name:'Nuclear Missile (×6)',      type:'plasma',  dmg:30, range:560, cooldown:7.50, pSpeed:250, spread:0.09 },
        { name:'Defensive Missile (×14)',   type:'kinetic', dmg:3, range:180, cooldown:0.14, pSpeed:700, spread:0.12 },
        { name:'MIRACL Megawatt Laser',     type:'kinetic', dmg:8, range:620, cooldown:5.00, pSpeed:9999, spread:0.010 },
      ]
    },

    // ── Daedalus (~190 m fusion pulse → r=22) ─────────────────────────────────────
    { key:'unoc_daedalus', name:'Daedalus Fusion Pulse Ship', role:'escort', spriteKey:'unoc_daedalus',
      r: 22, mass: 4800, speed: 110, shields: 0, hull: 900,
      weapons:[
        { name:'CIWS Gatling A',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Gatling B',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'Fusion Pellet Cannon A',    type:'plasma',  dmg:14, range:520, cooldown:3.50, pSpeed:340, spread:0.09 },
        { name:'Fusion Pellet Cannon B',    type:'plasma',  dmg:14, range:520, cooldown:3.50, pSpeed:340, spread:0.09 },
        { name:'Nuclear Missile (×10)',     type:'plasma',  dmg:32, range:560, cooldown:7.50, pSpeed:250, spread:0.09 },
        { name:'Defensive Missile (×18)',   type:'kinetic', dmg:3, range:180, cooldown:0.14, pSpeed:700, spread:0.12 },
        { name:'MIRACL Megawatt Laser A',   type:'kinetic', dmg:8, range:620, cooldown:5.00, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser B',   type:'kinetic', dmg:8, range:620, cooldown:5.00, pSpeed:9999, spread:0.010 },
      ]
    },

    // ── Orion Cruiser (~200 m nuclear pulse → r=36) ───────────────────────────────
    { key:'unoc_orionCruiser', name:'Orion Cruiser (Nuclear Pulse)', role:'capital', spriteKey:'unoc_orionCruiser',
      r: 36, mass: 12000, speed: 90, shields: 0, hull: 2800,
      weapons:[
        { name:'CIWS Gatling A',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Gatling B',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Gatling C',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'Nuclear Pulse Bomb (×20)',  type:'plasma',  dmg:40, range:440, cooldown:6.00, pSpeed:260, spread:0.08 },
        { name:'Nuclear Missile Silo A',    type:'plasma',  dmg:45, range:580, cooldown:9.00, pSpeed:240, spread:0.07 },
        { name:'Nuclear Missile Silo B',    type:'plasma',  dmg:45, range:580, cooldown:9.00, pSpeed:240, spread:0.07 },
        { name:'Defensive Missile (×24)',   type:'kinetic', dmg:3, range:190, cooldown:0.14, pSpeed:700, spread:0.12 },
        { name:'MIRACL Megawatt Laser A',   type:'kinetic', dmg:9, range:640, cooldown:5.00, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser B',   type:'kinetic', dmg:9, range:640, cooldown:5.00, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser C',   type:'kinetic', dmg:9, range:640, cooldown:5.00, pSpeed:9999, spread:0.010 },
      ]
    },

    // ── Orion Battleship (~400 m nuclear pulse → r=82) ────────────────────────────
    { key:'unoc_orionBattleship', name:'Orion Battleship (Nuclear Pulse)', role:'capital', spriteKey:'unoc_orionBattleship',
      // UNOC's most powerful true warship. Still loses badly to any shielded capital.
      r: 82, mass: 55000, speed: 55, shields: 0, hull: 9500,
      weapons:[
        { name:'CIWS Gatling A',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Gatling B',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Gatling C',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Gatling D',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'Nuclear Pulse Bomb (×40)',  type:'plasma',  dmg:50, range:450, cooldown:5.50, pSpeed:260, spread:0.07 },
        { name:'Nuclear Pulse Bomb (×40)',  type:'plasma',  dmg:50, range:450, cooldown:5.50, pSpeed:260, spread:0.07 },
        { name:'ICBM Battery A',            type:'plasma',  dmg:70, range:680, cooldown:14.0, windup:3.0, pSpeed:220, spread:0.05, special:true },
        { name:'ICBM Battery B',            type:'plasma',  dmg:70, range:680, cooldown:14.0, windup:3.0, pSpeed:220, spread:0.05, special:true },
        { name:'Defensive Missile (×40)',   type:'kinetic', dmg:3, range:200, cooldown:0.13, pSpeed:700, spread:0.12 },
        { name:'MIRACL Megawatt Laser A',   type:'kinetic', dmg:10, range:650, cooldown:4.80, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser B',   type:'kinetic', dmg:10, range:650, cooldown:4.80, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser C',   type:'kinetic', dmg:10, range:650, cooldown:4.80, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser D',   type:'kinetic', dmg:10, range:650, cooldown:4.80, pSpeed:9999, spread:0.010 },
      ]
    },

    // ── Super Orion (~400 m, 8 MILLION tonne, the true colossus → r=160) ──────────
    { key:'unoc_superOrion', name:'Super Orion Dreadnought', role:'capital', spriteKey:'unoc_superOrion',
      // Freeman Dyson's 8-million-tonne "Super Orion" — a city-ship, not a warship.
      // Enormous hull absorbs punishment but weapons are primitive; the Tsar Bomba ICBMs
      // crawl at pSpeed 200 and have a 6-second windup — any competent fleet ignores them.
      r: 160, mass: 8000000, speed: 22, shields: 0, hull: 38000,
      weapons:[
        { name:'CIWS Battery A',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Battery B',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Battery C',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Battery D',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Battery E',            type:'kinetic', dmg:1, range:130, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'Nuclear Pulse Salvo A',     type:'plasma',  dmg:60, range:460, cooldown:5.00, pSpeed:255, spread:0.07 },
        { name:'Nuclear Pulse Salvo B',     type:'plasma',  dmg:60, range:460, cooldown:5.00, pSpeed:255, spread:0.07 },
        { name:'Nuclear Pulse Salvo C',     type:'plasma',  dmg:60, range:460, cooldown:5.00, pSpeed:255, spread:0.07 },
        { name:'Nuclear Pulse Salvo D',     type:'plasma',  dmg:60, range:460, cooldown:5.00, pSpeed:255, spread:0.07 },
        { name:'Tsar Bomba ICBM A',         type:'plasma',  dmg:280, range:900, cooldown:38.0, windup:6.0, pSpeed:200, spread:0.015, usesMax:3, special:true },
        { name:'Tsar Bomba ICBM B',         type:'plasma',  dmg:280, range:900, cooldown:38.0, windup:6.0, pSpeed:200, spread:0.015, usesMax:3, special:true },
        { name:'Tsar Bomba ICBM C',         type:'plasma',  dmg:280, range:900, cooldown:38.0, windup:6.0, pSpeed:200, spread:0.015, usesMax:3, special:true },
        { name:'Defensive Missile (×80)',   type:'kinetic', dmg:3, range:210, cooldown:0.13, pSpeed:700, spread:0.12 },
        { name:'MIRACL Megawatt Laser A',   type:'kinetic', dmg:11, range:660, cooldown:4.60, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser B',   type:'kinetic', dmg:11, range:660, cooldown:4.60, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser C',   type:'kinetic', dmg:11, range:660, cooldown:4.60, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser D',   type:'kinetic', dmg:11, range:660, cooldown:4.60, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser E',   type:'kinetic', dmg:11, range:660, cooldown:4.60, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser F',   type:'kinetic', dmg:11, range:660, cooldown:4.60, pSpeed:9999, spread:0.010 },
      ]
    },

    // ── Bernal Sphere Station (~500 m → r=16) ─────────────────────────────────────
    { key:'unoc_bernalSphere', name:'Bernal Sphere Station', role:'station', spriteKey:'unoc_bernalSphere',
      // Habitat first, weapons platform last. Glass-panel pressure hull — a frigate
      // broadside kills it. Nuclear missile batteries have enough punch to threaten
      // other UNOC or unshielded ECE ships, nothing more.
      r: 16, mass: 500000, speed: 0, shields: 0, hull: 2200,
      weapons:[
        { name:'CIWS Battery A',            type:'kinetic', dmg:1, range:120, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Battery B',            type:'kinetic', dmg:1, range:120, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Battery C',            type:'kinetic', dmg:1, range:120, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'Nuclear Missile Battery A', type:'plasma',  dmg:40, range:560, cooldown:8.00, pSpeed:260, spread:0.08 },
        { name:'Nuclear Missile Battery B', type:'plasma',  dmg:40, range:560, cooldown:8.00, pSpeed:260, spread:0.08 },
        { name:'Nuclear Missile Battery C', type:'plasma',  dmg:40, range:560, cooldown:8.00, pSpeed:260, spread:0.08 },
        { name:'Defensive Missile (×30)',   type:'kinetic', dmg:3, range:180, cooldown:0.15, pSpeed:700, spread:0.13 },
        { name:'MIRACL Megawatt Laser A',   type:'kinetic', dmg:9, range:630, cooldown:5.00, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser B',   type:'kinetic', dmg:9, range:630, cooldown:5.00, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser C',   type:'kinetic', dmg:9, range:630, cooldown:5.00, pSpeed:9999, spread:0.010 },
      ]
    },

    // ── Stanford Torus Station (~1.8 km → r=56) ───────────────────────────────────
    { key:'unoc_stanfordTorus', name:'Stanford Torus Station', role:'station', spriteKey:'unoc_stanfordTorus',
      // 360° weapon coverage, but the ring frame is fragile habitat modules.
      // Kinetic rods do high damage if they land — 30-second cooldown and 5s windup
      // make them irrelevant against any mobile target.
      r: 56, mass: 10000000, speed: 0, shields: 0, hull: 10000,
      weapons:[
        { name:'CIWS Ring A',               type:'kinetic', dmg:1, range:120, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Ring B',               type:'kinetic', dmg:1, range:120, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Ring C',               type:'kinetic', dmg:1, range:120, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Ring D',               type:'kinetic', dmg:1, range:120, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'Nuclear Missile Battery A', type:'plasma',  dmg:48, range:580, cooldown:8.00, pSpeed:250, spread:0.07 },
        { name:'Nuclear Missile Battery B', type:'plasma',  dmg:48, range:580, cooldown:8.00, pSpeed:250, spread:0.07 },
        { name:'Nuclear Missile Battery C', type:'plasma',  dmg:48, range:580, cooldown:8.00, pSpeed:250, spread:0.07 },
        { name:'Nuclear Missile Battery D', type:'plasma',  dmg:48, range:580, cooldown:8.00, pSpeed:250, spread:0.07 },
        { name:'Kinetic Rod Launcher A',    type:'kinetic', dmg:160, range:1000, cooldown:30.0, windup:5.0, pSpeed:600, spread:0.006, special:true },
        { name:'Kinetic Rod Launcher B',    type:'kinetic', dmg:160, range:1000, cooldown:30.0, windup:5.0, pSpeed:600, spread:0.006, special:true },
        { name:'Defensive Missile (×60)',   type:'kinetic', dmg:3, range:190, cooldown:0.14, pSpeed:700, spread:0.12 },
        { name:'MIRACL Megawatt Laser A',   type:'kinetic', dmg:10, range:650, cooldown:4.80, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser B',   type:'kinetic', dmg:10, range:650, cooldown:4.80, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser C',   type:'kinetic', dmg:10, range:650, cooldown:4.80, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser D',   type:'kinetic', dmg:10, range:650, cooldown:4.80, pSpeed:9999, spread:0.010 },
      ]
    },

    // ── O'Neill Carrier (~3.2 km → r=100) ─────────────────────────────────────────
    { key:'unoc_oNeillCarrier', name:'O\'Neill Cylinder Carrier', role:'carrier', spriteKey:'unoc_oNeillCarrier',
      // UNOC flagship — its true value is the drone swarm it carries, not its own guns.
      // Hull is huge but unshielded; any capital ship focus-fires it down quickly.
      r: 100, mass: 50000000, speed: 10, shields: 0, hull: 28000,
      weapons:[
        { name:'CIWS Battery A',            type:'kinetic', dmg:1, range:120, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Battery B',            type:'kinetic', dmg:1, range:120, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Battery C',            type:'kinetic', dmg:1, range:120, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Battery D',            type:'kinetic', dmg:1, range:120, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'CIWS Battery E',            type:'kinetic', dmg:1, range:120, cooldown:0.14, pSpeed:700, spread:0.18 },
        { name:'Nuclear Missile Battery A', type:'plasma',  dmg:50, range:580, cooldown:8.00, pSpeed:250, spread:0.07 },
        { name:'Nuclear Missile Battery B', type:'plasma',  dmg:50, range:580, cooldown:8.00, pSpeed:250, spread:0.07 },
        { name:'Nuclear Missile Battery C', type:'plasma',  dmg:50, range:580, cooldown:8.00, pSpeed:250, spread:0.07 },
        { name:'Nuclear Missile Battery D', type:'plasma',  dmg:50, range:580, cooldown:8.00, pSpeed:250, spread:0.07 },
        { name:'Kinetic Rod Launcher A',    type:'kinetic', dmg:165, range:1000, cooldown:30.0, windup:5.0, pSpeed:600, spread:0.006, special:true },
        { name:'Kinetic Rod Launcher B',    type:'kinetic', dmg:165, range:1000, cooldown:30.0, windup:5.0, pSpeed:600, spread:0.006, special:true },
        { name:'Defensive Missile (×100)', type:'kinetic', dmg:3, range:200, cooldown:0.14, pSpeed:700, spread:0.12 },
        { name:'MIRACL Megawatt Laser A',   type:'kinetic', dmg:11, range:660, cooldown:4.60, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser B',   type:'kinetic', dmg:11, range:660, cooldown:4.60, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser C',   type:'kinetic', dmg:11, range:660, cooldown:4.60, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser D',   type:'kinetic', dmg:11, range:660, cooldown:4.60, pSpeed:9999, spread:0.010 },
        { name:'MIRACL Megawatt Laser E',   type:'kinetic', dmg:11, range:660, cooldown:4.60, pSpeed:9999, spread:0.010 },
      ]
    },

    // ── UNOC Drone (only craft type — AI combat drones) ───────────────────────────
    { key:'unoc_drone', name:'UNOC Combat Drone', role:'craft', craft:'drone', r:5, mass:12, speed:320, shields:0, hull:8,
      // Disposable AI combat drone — no shields, fragile, conventional warhead.
      // Dangerous only in the enormous swarms the O'Neill Carrier deploys.
      weapons:[ { name:'Conventional Warhead', type:'kinetic', dmg:4, range:220, cooldown:1.20, pSpeed:480, spread:0.15 } ]
    },

    // ═══════════════════════════════════════════════════════════
    // 21ST CENTURY EARTH  (SpaceX / NASA era — no shields, primitive weapons)
    // ── DELIBERATELY THE WEAKEST FACTION alongside UNOC ──
    // These are real or near-real 2020s rockets repurposed as gunships.
    // No shields. No exotic armour. Thin aluminium-lithium alloy skins.
    // Weapons are air-launched missiles and minigun derivatives — effective against
    // other ECE or unshielded UNOC ships, laughable against sci-fi hull armour.
    // Reference ceiling: a Republic Patrol Ship (shields 150, hull 180) wins comfortably
    // against any single ECE capital. MIRACL lasers do ~1 MW — scratches paint.
    // ═══════════════════════════════════════════════════════════

    // ── Falcon 1 (light rocket, real length ~20 m → r=4) ──────────────────────────
    { key:'ece_falcon1', name:'Falcon 1', role:'strike', spriteKey:'ece_falcon1',
      r: 4, mass: 35, speed: 300, shields: 0, hull: 30,
      weapons:[
        { name:'M61 Gatling',               type:'kinetic', dmg:1, range:140, cooldown:0.12, pSpeed:780, spread:0.16 },
        { name:'Light Missile Rack (×10)',   type:'plasma',  dmg:8, range:380, cooldown:1.20, pSpeed:500, spread:0.09 },
        { name:'Defensive Missile (×5)',     type:'kinetic', dmg:3, range:160, cooldown:0.16, pSpeed:720, spread:0.14 },
      ]
    },

    // ── Falcon 9 (medium rocket, real length ~70 m → r=6) ─────────────────────────
    { key:'ece_falcon9', name:'Falcon 9', role:'screen', spriteKey:'ece_falcon9',
      r: 6, mass: 90, speed: 230, shields: 0, hull: 70,
      weapons:[
        { name:'M61 Gatling',               type:'kinetic', dmg:1, range:140, cooldown:0.12, pSpeed:780, spread:0.16 },
        { name:'Light Missile Rack (×10)',   type:'plasma',  dmg:8, range:380, cooldown:1.20, pSpeed:500, spread:0.09 },
        { name:'Defensive Missile (×10)',    type:'kinetic', dmg:3, range:170, cooldown:0.16, pSpeed:720, spread:0.13 },
        { name:'MIRACL-Class Laser',         type:'kinetic', dmg:6, range:500, cooldown:6.00, pSpeed:9999, spread:0.014 },
      ]
    },

    // ── Falcon Heavy (heavy rocket → r=8) ─────────────────────────────────────────
    { key:'ece_falconHeavy', name:'Falcon Heavy', role:'escort', spriteKey:'ece_falconHeavy',
      r: 8, mass: 220, speed: 170, shields: 0, hull: 160,
      weapons:[
        { name:'M61 Gatling A',             type:'kinetic', dmg:1, range:140, cooldown:0.12, pSpeed:780, spread:0.16 },
        { name:'M61 Gatling B',             type:'kinetic', dmg:1, range:140, cooldown:0.12, pSpeed:780, spread:0.16 },
        { name:'Light Missile Rack (×10)',   type:'plasma',  dmg:8, range:380, cooldown:1.20, pSpeed:500, spread:0.09 },
        { name:'Heavy Missile Pod (×5)',     type:'plasma',  dmg:22, range:540, cooldown:4.00, pSpeed:420, spread:0.06 },
        { name:'Defensive Missile (×15)',    type:'kinetic', dmg:3, range:180, cooldown:0.15, pSpeed:720, spread:0.13 },
        { name:'MIRACL-Class Laser',         type:'kinetic', dmg:6, range:500, cooldown:6.00, pSpeed:9999, spread:0.014 },
      ]
    },

    // ── Starship (~121 m → r=9) ────────────────────────────────────────────────────
    { key:'ece_starship', name:'Starship', role:'capital', spriteKey:'ece_starship',
      r: 9, mass: 450, speed: 125, shields: 0, hull: 340,
      weapons:[
        { name:'M61 Gatling A',             type:'kinetic', dmg:1, range:140, cooldown:0.12, pSpeed:780, spread:0.16 },
        { name:'M61 Gatling B',             type:'kinetic', dmg:1, range:140, cooldown:0.12, pSpeed:780, spread:0.16 },
        { name:'Light Missile Rack (×25)',   type:'plasma',  dmg:8, range:380, cooldown:1.10, pSpeed:500, spread:0.09 },
        { name:'Heavy Missile Pod (×5)',     type:'plasma',  dmg:22, range:540, cooldown:3.80, pSpeed:420, spread:0.06 },
        { name:'Defensive Missile (×20)',    type:'kinetic', dmg:3, range:190, cooldown:0.14, pSpeed:720, spread:0.12 },
        { name:'MIRACL-Class Laser A',       type:'kinetic', dmg:6, range:500, cooldown:6.00, pSpeed:9999, spread:0.014 },
        { name:'MIRACL-Class Laser B',       type:'kinetic', dmg:6, range:500, cooldown:6.00, pSpeed:9999, spread:0.014 },
      ]
    },

    // ── Starship 2.0 (~130 m → r=10) ──────────────────────────────────────────────
    { key:'ece_starship2', name:'Starship 2.0', role:'capital', spriteKey:'ece_starship2',
      r: 10, mass: 520, speed: 115, shields: 0, hull: 440,
      weapons:[
        { name:'M61 Gatling A',             type:'kinetic', dmg:1, range:140, cooldown:0.12, pSpeed:780, spread:0.16 },
        { name:'M61 Gatling B',             type:'kinetic', dmg:1, range:140, cooldown:0.12, pSpeed:780, spread:0.16 },
        { name:'Light Missile Rack (×30)',   type:'plasma',  dmg:8, range:380, cooldown:1.00, pSpeed:500, spread:0.09 },
        { name:'Heavy Missile Pod (×10)',    type:'plasma',  dmg:22, range:540, cooldown:3.50, pSpeed:420, spread:0.06 },
        { name:'Defensive Missile (×25)',    type:'kinetic', dmg:3, range:200, cooldown:0.13, pSpeed:720, spread:0.12 },
        { name:'MIRACL-Class Laser A',       type:'kinetic', dmg:6, range:500, cooldown:6.00, pSpeed:9999, spread:0.014 },
        { name:'MIRACL-Class Laser B',       type:'kinetic', dmg:6, range:500, cooldown:6.00, pSpeed:9999, spread:0.014 },
        { name:'MIRACL-Class Laser C',       type:'kinetic', dmg:6, range:500, cooldown:6.00, pSpeed:9999, spread:0.014 },
      ]
    },

    // ── Starship Carrier (~150 m → r=12) ──────────────────────────────────────────
    { key:'ece_starshipCarrier', name:'Starship Carrier', role:'carrier', spriteKey:'ece_starshipCarrier',
      r: 12, mass: 680, speed: 95, shields: 0, hull: 520,
      weapons:[
        { name:'M61 Gatling A',             type:'kinetic', dmg:1, range:140, cooldown:0.12, pSpeed:780, spread:0.16 },
        { name:'M61 Gatling B',             type:'kinetic', dmg:1, range:140, cooldown:0.12, pSpeed:780, spread:0.16 },
        { name:'M61 Gatling C',             type:'kinetic', dmg:1, range:140, cooldown:0.12, pSpeed:780, spread:0.16 },
        { name:'Light Missile Rack (×5)',    type:'plasma',  dmg:8, range:380, cooldown:1.40, pSpeed:500, spread:0.09 },
        { name:'Heavy Missile Pod (×2)',     type:'plasma',  dmg:22, range:540, cooldown:4.50, pSpeed:420, spread:0.06 },
        { name:'Defensive Missile (×30)',    type:'kinetic', dmg:3, range:200, cooldown:0.13, pSpeed:720, spread:0.12 },
        { name:'MIRACL-Class Laser',         type:'kinetic', dmg:6, range:500, cooldown:6.00, pSpeed:9999, spread:0.014 },
      ]
    },

    // ── Space Stations ─────────────────────────────────────────────────────────────
    // ISS (~109 m truss → r=8)
    { key:'ece_iss', name:'ISS', role:'station', spriteKey:'ece_iss',
      r: 8, mass: 400000, speed: 0, shields: 0, hull: 1400,
      weapons:[
        { name:'CIWS Phalanx (20mm)',        type:'kinetic', dmg:3, range:170, cooldown:0.11, pSpeed:780, spread:0.14 },
        { name:'Defensive Missile (×12)',     type:'kinetic', dmg:3, range:180, cooldown:0.14, pSpeed:720, spread:0.13 },
        { name:'AIM-120 AMRAAM Rack (×8)',   type:'plasma',  dmg:14, range:380, cooldown:1.80, pSpeed:520, spread:0.09 },
      ]
    },
    // Starlab (~100 m → r=7)
    { key:'ece_starlab', name:'Starlab Space Station', role:'station', spriteKey:'ece_starlab',
      r: 7, mass: 120000, speed: 0, shields: 0, hull: 1100,
      weapons:[
        { name:'CIWS Phalanx (20mm)',        type:'kinetic', dmg:3, range:170, cooldown:0.11, pSpeed:780, spread:0.14 },
        { name:'Defensive Missile (×10)',     type:'kinetic', dmg:3, range:180, cooldown:0.14, pSpeed:720, spread:0.13 },
        { name:'AIM-120 AMRAAM Rack (×6)',   type:'plasma',  dmg:14, range:380, cooldown:1.80, pSpeed:520, spread:0.09 },
      ]
    },
    // Axiom Station (~80 m → r=6)
    { key:'ece_axiom', name:'Axiom Station', role:'station', spriteKey:'ece_axiom',
      r: 6, mass: 80000, speed: 0, shields: 0, hull: 800,
      weapons:[
        { name:'CIWS Phalanx (20mm)',        type:'kinetic', dmg:3, range:170, cooldown:0.11, pSpeed:780, spread:0.14 },
        { name:'Defensive Missile (×8)',      type:'kinetic', dmg:3, range:180, cooldown:0.14, pSpeed:720, spread:0.13 },
        { name:'AIM-120 AMRAAM Rack (×4)',   type:'plasma',  dmg:14, range:380, cooldown:2.00, pSpeed:520, spread:0.09 },
      ]
    },
    // Orbital Reef (~100 m → r=7)
    { key:'ece_orbitalReef', name:'Orbital Reef Space Station', role:'station', spriteKey:'ece_orbitalReef',
      r: 7, mass: 140000, speed: 0, shields: 0, hull: 1200,
      weapons:[
        { name:'CIWS Phalanx (20mm)',        type:'kinetic', dmg:3, range:170, cooldown:0.11, pSpeed:780, spread:0.14 },
        { name:'Defensive Missile (×12)',     type:'kinetic', dmg:3, range:180, cooldown:0.14, pSpeed:720, spread:0.13 },
        { name:'AIM-120 AMRAAM Rack (×8)',   type:'plasma',  dmg:14, range:380, cooldown:1.80, pSpeed:520, spread:0.09 },
      ]
    },
    // Lunar Gateway (~30 m → r=4)
    { key:'ece_gateway', name:'Gateway (Lunar Gateway)', role:'station', spriteKey:'ece_gateway',
      r: 4, mass: 40000, speed: 0, shields: 0, hull: 600,
      weapons:[
        { name:'CIWS Phalanx (20mm)',        type:'kinetic', dmg:3, range:170, cooldown:0.11, pSpeed:780, spread:0.14 },
        { name:'Defensive Missile (×6)',      type:'kinetic', dmg:3, range:180, cooldown:0.14, pSpeed:720, spread:0.13 },
        { name:'AIM-120 AMRAAM Rack (×4)',   type:'plasma',  dmg:14, range:380, cooldown:2.20, pSpeed:520, spread:0.09 },
      ]
    },

    // ── 21CE Drone ────────────────────────────────────────────────────────────────
    { key:'ece_drone', name:'21CE Combat Drone', role:'craft', craft:'drone', r:5, mass:12, speed:340, shields:0, hull:12,
      // MQ-9 / X-47B analogue — lightweight, no shields, conventional Hellfire warhead.
      // Dangerous in swarms against other ECE/unshielded targets only.
      weapons:[ { name:'Hellfire Missile', type:'plasma', dmg:5, range:260, cooldown:0.80, pSpeed:500, spread:0.14 } ]
    },
  ];

  const DEF_BY_KEY = new Map(UNIT_DEFS.map(d => [d.key, d]));

  // Allowed unit lists per faction (big -> small as provided).
  const FACTION_LOADOUTS = {
    starwars: [
      'sw_executor',
      'sw_isd2',
      'sw_mc80a',
    ],
    republic: [
      'air_station',
      'rep_carrier_heavy',
      'rep_dread',
      'rep_battle',
      'rep_carrier_light',
      'rep_hcruiser',
      'rep_lcruiser',       // Light Cruiser above Destroyer
      'rep_destroyer',
      'rep_frigate',
      'rep_corvette',
      'patrol',
      'rep_shuttle',
      'rep_bomber',
      'rep_fighter',
      'rep_interceptor',
      'rep_drone',
    ],
    empire: [
      'air_station',
      'emp_battle',
      'emp_destroyer',
      'patrol',
      'emp_fighter',
      'emp_bomber',
      'emp_interceptor',
      'emp_drone',
    ],
    remnant: [
      'remnant_mothership',
      'remnant_dread',
      'rem_fighter',
      'rem_bomber',
      'rem_interceptor',
      'rem_drone',
    ],
    ngr: [
      'rep_drone',
      'rep_fighter',
      'rep_bomber',
      'rep_interceptor',
      'rep_shuttle',
      'patrol',
      'rep_corvette',
      'rep_frigate',
      'rep_lcruiser',
      'rep_hcruiser',
      'rep_carrier_light',
      'rep_carrier_heavy',
    ],
    csn: [
      'csn_sovereign',
      'csn_bastion',
      'csn_tempest',
      'csn_phantom',
      'csn_vanguard',
      'csn_arc',
      'csn_fighter',
      'csn_bomber',
      'csn_interceptor',
      'csn_drone',
    ],
    fsa: [
      'fsa_capital_station',
      'fsa_carrier',
      'fsa_battleship',
      'fsa_destroyer',
      'fsa_frigate',
      'fsa_corvette',
      'fsa_fighter',
      'fsa_bomber',
      'fsa_interceptor',
      'fsa_shuttle',
      'fsa_drone',
    ],
    rebel: [
      'rebel_command_cruiser',
      'rebel_frigate',
      'rebel_gunship',
      'rebel_blockade_runner',
      'rebel_corvette',
      'rebel_fighter',
      'rebel_bomber',
      'rebel_interceptor',
    ],
    earth: [
      'uef_orbital_fortress',
      'uef_dreadnought',
      'uef_titan_carrier',
      'uef_battlecruiser',
      'uef_assault_cruiser',
      'uef_escort_frigate',
      'uef_destroyer',
      'uef_corvette',
      'uef_stealth_scout',
      'uef_fighter',
      'uef_bomber',
      'uef_interceptor',
      'uef_drone',
    ],
    unoc: [
      'unoc_oNeillCarrier',
      'unoc_stanfordTorus',
      'unoc_bernalSphere',
      'unoc_rodsFromGod',
      'unoc_polyus',
      'unoc_superOrion',
      'unoc_orionBattleship',
      'unoc_orionCruiser',
      'unoc_daedalus',
      'unoc_orionScout',
      'unoc_nervaGunship',
      'unoc_longshot',
      'unoc_drone',
    ],
    ece: [
      // Stations (largest first)
      'ece_iss',
      'ece_starlab',
      'ece_orbitalReef',
      'ece_axiom',
      'ece_gateway',
      // Rockets (largest first)
      'ece_starshipCarrier',
      'ece_starship2',
      'ece_starship',
      'ece_falconHeavy',
      'ece_falcon9',
      'ece_falcon1',
      // Drone (only craft type)
      'ece_drone',
    ],
  };

  // ---------- World ----------
  const world = {
    w: 6200,
    h: 4200,
    ships: [],
    projectiles: [],
    effects: [],
    nextId: 1,
    time: 0,
    paused: false,
    running: false, // setup mode until Start Battle

    gameOver: false,
    winner: null,
    musicIntensity: 0,
    musicIntensityLabel: 'Ambient',
  };

  // ---------- Camera ----------
  const cam = {
    x: world.w/2,
    y: world.h/2,
    zoom: 1.0,
    // Allow further zoom-out so ultra-large units (e.g., 20km Mothership) can be viewed comfortably.
    minZoom: 0.12,
    maxZoom: 2.4,
    pan: false,
    panStart: v2(),
    camStart: v2(),
  };

  function resize(){
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener('resize', () => { resize(); invalidateFrameRect(); });

  function screenToWorld(sx, sy){
    const rect = getFrameRect();
    const x = (sx - rect.left);
    const y = (sy - rect.top);
    const wx = cam.x + (x - rect.width/2) / cam.zoom;
    const wy = cam.y + (y - rect.height/2) / cam.zoom;
    return {x: wx, y: wy};
  }

  function worldToScreen(wx, wy){
    const rect = getFrameRect();
    const sx = (wx - cam.x) * cam.zoom + rect.width/2;
    const sy = (wy - cam.y) * cam.zoom + rect.height/2;
    return {x:sx, y:sy};
  }

  // ---------- Entities ----------
  class Ship {
    constructor(defKey, factionId, x, y){
      this.id = world.nextId++;
      this.defKey = defKey;
      this.def = DEF_BY_KEY.get(defKey);
      this.faction = factionId;
      this.pos = v2(x,y);
      this.vel = v2(0,0);
      this.angle = rand(0, TAU);
      this.radius = this.def.r;
      this.mass = this.def.mass;

      this.maxShields = this.def.shields;
      this.maxHull = this.def.hull;
      this.shields = this.def.shields;
      this.hull = this.def.hull;

      this.holdFire = false;
      this.selected = false;

      this.order = { type:'idle', point:null, targetId:null, attackMove:false, issuedAt: world.time };
      this.focusTargetId = null;

      this.weapons = (this.def.weapons || []).map(w => ({
        ...w,
        cd: w.special ? 0 : rand(0, w.cooldown),
        usesMax: (typeof w.usesMax === 'number') ? w.usesMax : null,
        usesLeft: (typeof w.usesMax === 'number') ? w.usesMax : null,
      }));

      this.pendingShots = []; // { fireAt:number, weaponRef:object, targetId:number }

      this.traits = this.def.traits || {};
      this._aiBrain = { anchorId:null, roamT:0 };

      // Hyperspace jump-in
      this._warp = { active: true, t: 0, dur: 0.72, startX: x, startY: y };    }

    isAlive(){ return this.hull > 0; }

    takeDamage(amount, dtype, hitPos){
      // pierce behavior handled in projectile
      const mult = DAMAGE[dtype] || DAMAGE.kinetic;

      if (this.shields > 0){
        const shieldDmg = amount * mult.shield;
        const used = Math.min(this.shields, shieldDmg);
        this.shields -= used;
        amount -= used / mult.shield;
        // Shield flash visual + sound (only for larger ships to avoid cacophony)
        this._shieldFlash = 1.0;
        if (hitPos){
          world.effects.push({ kind:'shieldHit', x:hitPos.x, y:hitPos.y, t:0, dur:0.38, scale:this.radius });
          if (this.radius >= 22) audio.shieldHit(this.radius >= 55);
        }
      }
      if (amount > 0){
        this.hull -= amount * mult.hull;
        if (hitPos){
          spawnDmgText(hitPos.x, hitPos.y, amount * mult.hull, dtype);
          // Hull crack sound for meaningful hits on medium+ ships
          if (this.radius >= 30 && amount * mult.hull > 25) audio.hullCrack(this.radius >= 55);
        }
      }
      if (this.hull <= 0){
        this.hull = 0;
        spawnExplosion(this.pos.x, this.pos.y, this.radius*1.1);
      }
    }

    desiredSpeed(){
      return this.def.speed;
    }

    update(dt){
      if (!this.isAlive()) return;

      // Hyperspace arrival — ship is invulnerable and can't fire during warp
      if (this._warp && this._warp.active){
        this._warp.t += dt;
        if (this._warp.t >= this._warp.dur) this._warp.active = false;
        return;
      }

      // Resolve any windup shots that have finished charging.
      if (this.pendingShots.length){
        const ready = [];
        const keep = [];
        for (const ps of this.pendingShots){
          if (ps.fireAt <= world.time) ready.push(ps);
          else keep.push(ps);
        }
        this.pendingShots = keep;
        for (const ps of ready){
          const w = ps.weaponRef;
          const t = getShipById(ps.targetId);
          if (!t || !t.isAlive() || t.faction === this.faction) continue;
          // re-check range at fire time
          if (len(sub(t.pos, this.pos)) <= w.range * 1.05){
            fireProjectile(this, t, w);
          }
        }
      }

      // Player hangar ships still auto-launch craft, but keep manual movement / combat control.
      if (world.running && isPlayerFaction(this.faction) && (this.id % AI_SLOTS === aiSlotFrame)){
        const brain = this._aiBrain;
        brain.launchT = (brain.launchT || 0) - dt * AI_SLOTS;
        const enemy = getHangarDef(this) ? nearestEnemy(this) : null;
        if (enemy){
          const healthFrac = (this.hull + this.shields) / (this.maxHull + this.maxShields);
          tryHangarLaunch(this, brain, enemy, healthFrac);
        }
      }

      // Full ship AI runs only for non-player factions.
      const faction = FACTIONS[this.faction];
      if (world.running && !isPlayerFaction(this.faction) && faction && (this.id % AI_SLOTS === aiSlotFrame)){
        aiUpdateShip(this, dt * AI_SLOTS); // compensate dt for the stagger
      }

      // Setup mode: no weapons / target acquisition
      if (!world.running){
        this._combatTarget = null;
        return;
      }

      // Combat target selection (unless hold fire)
      if (!this.holdFire){
        // Choose target: focus > order target > nearest within range
        let target = null;
        if (this.focusTargetId) target = getShipById(this.focusTargetId);
        if (!target && this.order.targetId) target = getShipById(this.order.targetId);
        if (!target || !target.isAlive() || target.faction === this.faction){
          target = findBestTarget(this);
        }
        this._combatTarget = target && target.isAlive() ? target : null;
      } else {
        this._combatTarget = null;
      }

      // Fire weapons
      if (this._combatTarget){
        const t = this._combatTarget;
        const dist = len(sub(t.pos, this.pos));
        for (const w of this.weapons){
          w.cd -= dt;
          if (w.cd <= 0 && dist <= w.range && (w.usesLeft === null || w.usesLeft > 0)){
            // Manual specials should only attempt to fire when the player has a focused target.
            if (w.manual && isPlayerFaction(this.faction)){
              if (!this.focusTargetId || t.id !== this.focusTargetId){
                w.cd = 0; // stay ready until player focuses a target
                continue;
              }
            }
            if (tryFireWeapon(this, t, w)){
              w.cd = w.cooldown;
            } else {
              // slight delay if no good firing solution
              w.cd = Math.min(0.15, w.cooldown*0.2);
            }
          }
        }
      } else {
        for (const w of this.weapons) w.cd = Math.max(0, w.cd - dt);
      }

      // Movement orders
      let desired = v2(0,0);
      let maxSpeed = this.desiredSpeed();
      let slow = 1.0;

      if (this.order.type === 'move' && this.order.point){
        const to = sub(this.order.point, this.pos);
        const d = len(to);
        if (d < Math.max(18, this.radius*0.6)){
          this.order.type = 'idle';
          this.order.point = null;
        } else {
          desired = norm(to);
          slow = clamp(d/240, 0.25, 1.0);
        }
      }
      if (this.order.type === 'attackmove' && this.order.point){
        const to = sub(this.order.point, this.pos);
        const d = len(to);
        if (d < Math.max(24, this.radius*0.8)){
          this.order.type = 'idle';
          this.order.point = null;
        } else {
          // if a target exists, drift toward it; else continue to waypoint
          const t = this._combatTarget;
          if (t){
            const toward = sub(t.pos, this.pos);
            desired = norm(toward);
            slow = clamp(len(toward)/260, 0.35, 1.0);
          } else {
            desired = norm(to);
            slow = clamp(d/260, 0.35, 1.0);
          }
        }
      }

      // Stations: no movement.
      if (maxSpeed <= 0.01) desired = v2(0,0);

      // Simple collision avoidance (soft)
      if (len(desired) > 0){
        const avoid = separationVector(this, 220);
        desired = norm(add(desired, mul(avoid, 1.15)));
      }

      // Steering
      const desiredVel = mul(desired, maxSpeed * slow);
      // damped acceleration
      this.vel.x = lerp(this.vel.x, desiredVel.x, clamp(dt*1.8, 0, 1));
      this.vel.y = lerp(this.vel.y, desiredVel.y, clamp(dt*1.8, 0, 1));

      // integrate
      this.pos.x += this.vel.x * dt;
      this.pos.y += this.vel.y * dt;

      // keep in bounds
      this.pos.x = clamp(this.pos.x, this.radius, world.w - this.radius);
      this.pos.y = clamp(this.pos.y, this.radius, world.h - this.radius);

      applyCapitalAutoRepair(this, dt);

      // Engine hum (subtle). Uses a single shared oscillator.
      // Only triggers when the ship is moving noticeably.
      const spd = len(this.vel);
      if (spd > 28) audio.engineHum(this.radius, spd);


      // angle (just for indicator)
      const v = this.vel;
      if (len(v) > 2) this.angle = Math.atan2(v.y, v.x);
    }
  }

  class Projectile {
    constructor(opts){
      this.id = world.nextId++;
      this.pos = v2(opts.x, opts.y);
      this.vel = v2(opts.vx, opts.vy);
      this.ownerId = opts.ownerId;
      this.faction = opts.faction;
      this.targetId = opts.targetId || null;

      this.damage = opts.damage;
      this.type = opts.type;
      this.radius = opts.radius || 2.2;
      this.life = opts.life || 2.0;
      this.pierceShields = !!opts.pierceShields;
      this.breachShields = !!opts.breachShields;
    }

    update(dt){
      this.life -= dt;
      this.pos.x += this.vel.x * dt;
      this.pos.y += this.vel.y * dt;

      if (this.life <= 0) return false;

      // Hit-test using spatial grid — only checks ships in nearby cells
      const candidates = grid.query(this.pos.x, this.pos.y, 160);
      for (const s of candidates){
        if (!s.isAlive()) continue;
        if (isAlliedFaction(s.faction, this.faction)) continue;
        const dx = s.pos.x-this.pos.x, dy = s.pos.y-this.pos.y;
        if (dx*dx+dy*dy <= s.radius*s.radius){
          if (this.breachShields){
            if (s.shields > 0) s.shields = Math.max(0, s.shields - s.maxShields * 0.85);
            s.hull -= this.damage * (DAMAGE[this.type]?.hull ?? 1);
            if (s.hull <= 0){ s.hull = 0; spawnExplosion(s.pos.x, s.pos.y, s.radius*1.1); }
            spawnDmgText(this.pos.x, this.pos.y, this.damage, this.type);
          } else if (this.pierceShields && s.shields > 0){
            const half = this.damage * 0.5;
            s.hull -= half * (DAMAGE[this.type]?.hull ?? 1);
            s.takeDamage(this.damage * 0.5, this.type, this.pos);
          } else {
            s.takeDamage(this.damage, this.type, this.pos);
          }
          spawnHit(this.pos.x, this.pos.y, this.type);
          return false;
        }
      }

      return true;
    }
  }

  // ---------- Effects ----------
  function spawnExplosion(x,y,scale){
    world.effects.push({ kind:'explosion', x,y, t:0, dur:0.9, scale });

    // NEW: light flash
    world.effects.push({
      kind:'light',
      x, y,
      t:0,
      dur: 0.35,            // quick bright flash
      radius: scale * 2.4,  // how far light reaches
      intensity: 1.0
    });
  }
  function spawnHit(x,y,type){
    world.effects.push({ kind:'hit', x,y, t:0, dur:0.25, type });
  }

  function spawnCharge(x,y,scale,factionId){
    world.effects.push({ kind:'charge', x,y, t:0, dur:0.9, scale, factionId });
  }

  function spawnWarpIn(x, y, radius, factionId){
    world.effects.push({ kind:'warpIn', x, y, t:0, dur:0.72, radius, factionId });
  }

  // ---------- Targeting / Weapons ----------

  function findBestTarget(self){
    const maxRange = (self.weapons.reduce((m,w) => Math.max(m, w.range), 0)) || 0;
    if (maxRange === 0) return null;
    let best = null, bestScore = Infinity;
    const candidates = grid.query(self.pos.x, self.pos.y, maxRange);
    for (const s of candidates){
      if (!s.isAlive() || isAlliedFaction(s.faction, self.faction)) continue;
      const dx = s.pos.x-self.pos.x, dy = s.pos.y-self.pos.y;
      const d  = Math.sqrt(dx*dx+dy*dy);
      if (d > maxRange) continue;
      const threat  = (s.def.mass / 1500) + (s.def.r / 40);
      const hpFrac  = (s.shields+s.hull) / (s.maxShields+s.maxHull);
      const score   = d - threat*18 + (1-hpFrac)*24;
      if (score < bestScore){ bestScore=score; best=s; }
    }
    return best;
  }

    function fireProjectile(shooter, target, weapon){
    // lead target: solve for intercept with constant velocity
    const rel = sub(target.pos, shooter.pos);
    const tv = target.vel;
    const sp = weapon.pSpeed;

    // Quadratic: |rel + tv*t| = sp*t
    const a = dot(tv,tv) - sp*sp;
    const b = 2*dot(rel,tv);
    const c = dot(rel,rel);

    let t = 0;
    if (Math.abs(a) < 1e-6){
      t = (-c) / (b || -1e-6);
    } else {
      const disc = b*b - 4*a*c;
      if (disc < 0) return false;
      const sdisc = Math.sqrt(disc);
      const t1 = (-b - sdisc) / (2*a);
      const t2 = (-b + sdisc) / (2*a);
      t = Math.min(t1, t2);
      if (t < 0) t = Math.max(t1, t2);
    }
    t = clamp(t, 0.02, 2.4);

    const aim = add(rel, mul(tv, t));
    const dir = norm(aim);

    // spread (in radians)
    const ang = Math.atan2(dir.y, dir.x) + rand(-weapon.spread, weapon.spread);
    const vx = Math.cos(ang) * sp;
    const vy = Math.sin(ang) * sp;

    // spawn slightly in front
    const muzzle = add(shooter.pos, mul({x:Math.cos(ang), y:Math.sin(ang)}, shooter.radius*0.65));

    const life = clamp(weapon.range / sp * 1.25, 0.25, 4.0);
    world.projectiles.push(new Projectile({
      x: muzzle.x, y: muzzle.y,
      vx, vy,
      ownerId: shooter.id,
      faction: shooter.faction,
      targetId: target.id,
      damage: weapon.dmg,
      type: weapon.type,
      radius: weapon.special ? 22 : weapon.type === 'plasma' ? 4.5 : (weapon.type === 'ion' ? 3.0 : 2.2),
      life,
      pierceShields: weapon.pierceShields || false,
      breachShields: weapon.breachShields || false,
    }));

    audio.laser(weapon.type, !!weapon.special || !!weapon.breachShields || !!weapon.pierceShields);
    return true;
  }

  function tryFireWeapon(shooter, target, weapon){
    if (weapon.usesLeft !== null && weapon.usesLeft <= 0) return false;

    // Manual special weapons (player-triggered): only fire when the player has explicitly
    // focused a target (T + LMB).
    if (weapon.manual && isPlayerFaction(shooter.faction)){
      if (!shooter.focusTargetId) return false;
      if (target.id !== shooter.focusTargetId) return false;
    }

    // Windup weapons schedule a delayed shot.
    if (weapon.windup && weapon.windup > 0.01){
      shooter.pendingShots.push({ fireAt: world.time + weapon.windup, weaponRef: weapon, targetId: target.id });
      if (weapon.usesLeft !== null) weapon.usesLeft -= 1;
      spawnCharge(shooter.pos.x, shooter.pos.y, shooter.radius*1.15, shooter.faction);
      return true;
    }

    const ok = fireProjectile(shooter, target, weapon);
    if (ok && weapon.usesLeft !== null) weapon.usesLeft -= 1;
    return ok;
  }

  function separationVector(self, radius){
    let ax = 0, ay = 0, count = 0;
    const nearby = grid.query(self.pos.x, self.pos.y, radius);
    for (const s of nearby){
      if (s === self) continue;
      const dx = self.pos.x - s.pos.x;
      const dy = self.pos.y - s.pos.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < radius*radius && d2 > 0.0001){
        const d = Math.sqrt(d2);
        const push = (radius - d) / radius;
        const min  = self.radius + s.radius + 10;
        const scale = push * min / (d + 1);
        ax += (dx/d) * scale;
        ay += (dy/d) * scale;
        count++;
      }
    }
    if (count === 0) return v2(0,0);
    return { x: ax/count, y: ay/count };
  }

  // ---------- AI ----------

  // Craft spawn data per faction: [craftKey, weight] — used by carrier launch logic
  // ---------- Hangar Definitions -------------------------------------------
  // ONLY ships listed here can launch craft.  Every other ship is silent.
  // Each slot: { craftKey, max (lifetime cap), wave (craft spawned per launch) }
  // Craft keys must map to a valid UNIT_DEF.  Unknown keys are silently skipped.
  const HANGAR_DEFS = {
    // ── Star Wars ──────────────────────────────────────────
    sw_isd2: [
      { craftKey:'emp_fighter',     max:25,   wave:5  },
      { craftKey:'emp_bomber',      max:15,   wave:3  },
      { craftKey:'emp_interceptor', max:15,   wave:3  },
      { craftKey:'rep_shuttle',     max:1,    wave:1  },
    ],
    sw_mc80a: [
      { craftKey:'rep_fighter',     max:30,   wave:3  },
      { craftKey:'rep_bomber',      max:10,   wave:2  },
      { craftKey:'rep_interceptor', max:2,    wave:1  },
      { craftKey:'rep_shuttle',     max:2,    wave:1  },
    ],
    sw_executor: [
      { craftKey:'emp_fighter',     max:100,  wave:10 },
      { craftKey:'emp_bomber',      max:50,   wave:5  },
      { craftKey:'emp_interceptor', max:50,   wave:5  },
      { craftKey:'rep_shuttle',     max:10,   wave:2  },
    ],
    // ── Imperial Remnant ───────────────────────────────────
    remnant_dread: [
      { craftKey:'rem_fighter',     max:6,    wave:2  },
      { craftKey:'rem_bomber',      max:3,    wave:1  },
      { craftKey:'rem_interceptor', max:3,    wave:1  },
      { craftKey:'rem_drone',       max:12,   wave:4  },
      { craftKey:'rep_shuttle',     max:1,    wave:1  },
    ],
    remnant_mothership: [
      { craftKey:'rem_fighter',     max:100,  wave:10 },
      { craftKey:'rem_bomber',      max:50,   wave:5  },
      { craftKey:'rem_interceptor', max:50,   wave:5  },
      { craftKey:'rem_drone',       max:1000, wave:25 },
      { craftKey:'rep_shuttle',     max:10,   wave:2  },
    ],
    // ── CSN ────────────────────────────────────────────────
    csn_bastion: [
      { craftKey:'csn_drone',       max:12,   wave:4  },
    ],
    csn_sovereign: [
      { craftKey:'csn_drone',       max:12,   wave:3  },
      { craftKey:'csn_fighter',     max:4,    wave:2  },
      { craftKey:'rep_shuttle',     max:1,    wave:1  },
    ],
    // ── Grand Empire ───────────────────────────────────────
    emp_destroyer: [
      { craftKey:'emp_drone',       max:9,    wave:3  },
      { craftKey:'emp_fighter',     max:3,    wave:1  },
      { craftKey:'emp_bomber',      max:3,    wave:1  },
      { craftKey:'emp_interceptor', max:3,    wave:1  },
      { craftKey:'rep_shuttle',     max:1,    wave:1  },
    ],
    emp_battle: [
      { craftKey:'emp_drone',       max:12,   wave:3  },
      { craftKey:'emp_fighter',     max:4,    wave:2  },
      { craftKey:'emp_bomber',      max:4,    wave:2  },
      { craftKey:'emp_interceptor', max:4,    wave:2  },
      { craftKey:'rep_shuttle',     max:1,    wave:1  },
    ],
    // air_station entries are faction-specific (set after FACTION_LOADOUTS)
    // ── Grand Republic ─────────────────────────────────────
    rep_carrier_heavy: [
      { craftKey:'rep_drone',       max:220,  wave:20 },
      { craftKey:'rep_fighter',     max:50,   wave:25 },
      { craftKey:'rep_bomber',      max:10,   wave:5  },
      { craftKey:'rep_interceptor', max:20,   wave:10 },
      { craftKey:'rep_shuttle',     max:2,    wave:1  },
    ],
    rep_carrier_light: [
      { craftKey:'rep_drone',       max:180,  wave:15 },
      { craftKey:'rep_fighter',     max:40,   wave:20 },
      { craftKey:'rep_bomber',      max:8,    wave:4  },
      { craftKey:'rep_interceptor', max:14,   wave:7  },
      { craftKey:'rep_shuttle',     max:2,    wave:1  },
    ],
    rep_dread: [
      { craftKey:'rep_drone',       max:12,   wave:3  },
      { craftKey:'rep_fighter',     max:4,    wave:2  },
      { craftKey:'rep_bomber',      max:4,    wave:2  },
      { craftKey:'rep_interceptor', max:4,    wave:2  },
      { craftKey:'rep_shuttle',     max:1,    wave:1  },
    ],
    rep_battle: [
      { craftKey:'rep_drone',       max:12,   wave:3  },
      { craftKey:'rep_fighter',     max:4,    wave:2  },
      { craftKey:'rep_bomber',      max:4,    wave:2  },
      { craftKey:'rep_interceptor', max:4,    wave:2  },
      { craftKey:'rep_shuttle',     max:1,    wave:1  },
    ],
    rep_hcruiser: [
      { craftKey:'rep_drone',       max:15,   wave:5  },
    ],
    rep_lcruiser: [
      { craftKey:'rep_drone',       max:15,   wave:5  },
    ],
    rep_destroyer: [
      { craftKey:'rep_drone',       max:9,    wave:3  },
      { craftKey:'rep_fighter',     max:3,    wave:1  },
      { craftKey:'rep_bomber',      max:3,    wave:1  },
      { craftKey:'rep_interceptor', max:3,    wave:1  },
      { craftKey:'rep_shuttle',     max:1,    wave:1  },
    ],
    rep_frigate: [
      { craftKey:'rep_drone',       max:4,    wave:2  },
    ],
    // ── Five Star Alignment ────────────────────────────────
    fsa_capital_station: [
      { craftKey:'fsa_drone',       max:25000, wave:25 },
      { craftKey:'fsa_fighter',     max:500,   wave:20 },
      { craftKey:'fsa_bomber',      max:300,   wave:8  },
      { craftKey:'fsa_interceptor', max:400,   wave:15 },
      { craftKey:'fsa_shuttle',     max:80,    wave:4  },
    ],
    fsa_carrier: [
      { craftKey:'fsa_drone',       max:300,   wave:20 },
      { craftKey:'fsa_fighter',     max:80,    wave:15 },
      { craftKey:'fsa_bomber',      max:20,    wave:5  },
      { craftKey:'fsa_interceptor', max:40,    wave:10 },
      { craftKey:'fsa_shuttle',     max:4,     wave:1  },
    ],
    fsa_battleship: [
      { craftKey:'fsa_drone',       max:18,    wave:4  },
      { craftKey:'fsa_fighter',     max:6,     wave:2  },
      { craftKey:'fsa_bomber',      max:6,     wave:2  },
      { craftKey:'fsa_interceptor', max:6,     wave:2  },
      { craftKey:'fsa_shuttle',     max:1,     wave:1  },
    ],
    fsa_destroyer: [
      { craftKey:'fsa_drone',       max:10,    wave:3  },
      { craftKey:'fsa_fighter',     max:4,     wave:1  },
      { craftKey:'fsa_interceptor', max:4,     wave:1  },
    ],
    fsa_frigate: [
      { craftKey:'fsa_drone',       max:6,     wave:2  },
    ],
    // ── Rebel Coalition ────────────────────────────────────
    rebel_command_cruiser: [
      { craftKey:'rebel_fighter',     max:12,   wave:3  },
      { craftKey:'rebel_bomber',      max:6,    wave:2  },
      { craftKey:'rebel_interceptor', max:6,    wave:2  },
    ],
    rebel_frigate: [
      { craftKey:'rebel_fighter',     max:4,    wave:2  },
      { craftKey:'rebel_interceptor', max:4,    wave:2  },
    ],
    // ── United Earth Federation ────────────────────────────
    uef_orbital_fortress: [
      { craftKey:'uef_drone',         max:20000, wave:25 },
      { craftKey:'uef_fighter',       max:400,   wave:20 },
      { craftKey:'uef_bomber',        max:200,   wave:8  },
      { craftKey:'uef_interceptor',   max:300,   wave:15 },
    ],
    uef_titan_carrier: [
      { craftKey:'uef_drone',         max:300,   wave:20 },
      { craftKey:'uef_fighter',       max:80,    wave:15 },
      { craftKey:'uef_bomber',        max:20,    wave:5  },
      { craftKey:'uef_interceptor',   max:40,    wave:10 },
    ],
    uef_dreadnought: [
      { craftKey:'uef_drone',         max:12,    wave:3  },
      { craftKey:'uef_fighter',       max:4,     wave:2  },
      { craftKey:'uef_bomber',        max:4,     wave:2  },
      { craftKey:'uef_interceptor',   max:4,     wave:2  },
    ],
    uef_battlecruiser: [
      { craftKey:'uef_drone',         max:12,    wave:3  },
      { craftKey:'uef_fighter',       max:4,     wave:2  },
      { craftKey:'uef_interceptor',   max:4,     wave:2  },
    ],
    uef_assault_cruiser: [
      { craftKey:'uef_drone',         max:9,     wave:3  },
      { craftKey:'uef_fighter',       max:3,     wave:1  },
    ],
    uef_escort_frigate: [
      { craftKey:'uef_drone',         max:4,     wave:2  },
    ],
    uef_destroyer: [
      { craftKey:'uef_drone',         max:6,     wave:2  },
      { craftKey:'uef_interceptor',   max:3,     wave:1  },
    ],

    // ── United Nations Orbital Command (drones only) ───────────
    unoc_oNeillCarrier: [
      { craftKey:'unoc_drone', max:2000, wave:30 },
    ],
    unoc_stanfordTorus: [
      { craftKey:'unoc_drone', max:800,  wave:20 },
    ],
    unoc_bernalSphere: [
      { craftKey:'unoc_drone', max:200,  wave:10 },
    ],
    unoc_superOrion: [
      { craftKey:'unoc_drone', max:120,  wave:8  },
    ],
    unoc_orionBattleship: [
      { craftKey:'unoc_drone', max:60,   wave:6  },
    ],
    unoc_orionCruiser: [
      { craftKey:'unoc_drone', max:30,   wave:4  },
    ],
    unoc_daedalus: [
      { craftKey:'unoc_drone', max:20,   wave:4  },
    ],
    unoc_orionScout: [
      { craftKey:'unoc_drone', max:12,   wave:3  },
    ],
    unoc_nervaGunship: [
      { craftKey:'unoc_drone', max:8,    wave:2  },
    ],
    unoc_polyus: [
      { craftKey:'unoc_drone', max:6,    wave:2  },
    ],
    unoc_rodsFromGod: [
      { craftKey:'unoc_drone', max:4,    wave:2  },
    ],

    // ── 21st Century Earth (drones only) ──────────────────────
    // Starship Carrier: full 100-drone complement
    ece_starshipCarrier: [
      { craftKey:'ece_drone', max:100, wave:10 },
    ],
    // Starship: small drone complement in payload bay
    ece_starship: [
      { craftKey:'ece_drone', max:12, wave:4 },
    ],
    // Starship 2.0: improved drone capacity
    ece_starship2: [
      { craftKey:'ece_drone', max:18, wave:5 },
    ],
    // Space Stations: patrol drone wings
    ece_iss: [
      { craftKey:'ece_drone', max:20, wave:4 },
    ],
    ece_starlab: [
      { craftKey:'ece_drone', max:16, wave:4 },
    ],
    ece_orbitalReef: [
      { craftKey:'ece_drone', max:20, wave:4 },
    ],
    ece_axiom: [
      { craftKey:'ece_drone', max:12, wave:3 },
    ],
    ece_gateway: [
      { craftKey:'ece_drone', max:8,  wave:2 },
    ],
  };

  // Air Station hangar — same totals for both republic and empire factions
  const AIR_STATION_HANGAR = [
    { craftKey:'rep_drone',       max:20000, wave:20 },
    { craftKey:'rep_fighter',     max:250,   wave:15 },
    { craftKey:'rep_bomber',      max:150,   wave:5  },
    { craftKey:'rep_interceptor', max:200,   wave:10 },
    { craftKey:'rep_shuttle',     max:50,    wave:3  },
  ];
  // Empire air station uses empire craft keys
  const AIR_STATION_HANGAR_EMPIRE = [
    { craftKey:'emp_drone',       max:20000, wave:20 },
    { craftKey:'emp_fighter',     max:250,   wave:15 },
    { craftKey:'emp_bomber',      max:150,   wave:5  },
    { craftKey:'emp_interceptor', max:200,   wave:10 },
    { craftKey:'rep_shuttle',     max:50,    wave:3  },
  ];

  // Returns the hangar definition for a given ship (faction-aware for air_station)
  function getHangarDef(ship){
    if (ship.defKey === 'air_station'){
      return ship.faction === 'empire' ? AIR_STATION_HANGAR_EMPIRE : AIR_STATION_HANGAR;
    }
    return HANGAR_DEFS[ship.defKey] || null;
  }

  // Shared helper — try to launch one wave from the hangar.
  // Called by carrier, station, capital, escort, and screen role handlers.
  function tryHangarLaunch(ship, brain, enemy, healthFrac){
    const hangar = getHangarDef(ship);
    if (!hangar || !world.running) return;
    if ((brain.launchT || 0) > 0) return;

    if (!brain.hangarSpawned) brain.hangarSpawned = {};
    if (brain.hangarIdx === undefined) brain.hangarIdx = 0;

    let launched = false;
    const n = hangar.length;
    for (let tries = 0; tries < n; tries++){
      const slot  = hangar[brain.hangarIdx % n];
      brain.hangarIdx = (brain.hangarIdx + 1) % n;
      const key   = slot.craftKey;
      if (!DEF_BY_KEY.has(key)) continue;          // skip unknown craft
      const spent = brain.hangarSpawned[key] || 0;
      if (spent >= slot.max) continue;              // lifetime cap reached

      const waveSize = Math.min(slot.wave, slot.max - spent);
      for (let wi = 0; wi < waveSize; wi++){
        const ang = rand(0, TAU);
        const nc  = spawnShip(key, ship.faction,
          ship.pos.x + Math.cos(ang) * ship.radius * 1.4,
          ship.pos.y + Math.sin(ang) * ship.radius * 1.4);
        nc.order.type     = 'attackmove';
        nc.order.point    = enemy.pos;
        nc.order.issuedAt = world.time;
        nc.focusTargetId  = enemy.id;
      }
      brain.hangarSpawned[key] = spent + waveSize;
      brain.launchT = rand(3.5, 6.5) / Math.max(0.5, 1 - healthFrac * 0.5);
      launched = true;
      break;
    }
    if (!launched) brain.launchT = 10; // all caps hit — recheck later
  }

  function nearestEnemy(self){
    // First check within a medium radius via grid, fall back to full sweep only if needed
    const SEARCH = 1800;
    let best = null, bestD2 = Infinity;
    const candidates = grid.query(self.pos.x, self.pos.y, SEARCH);
    for (const s of candidates){
      if (!s.isAlive()) continue;
      if (isAlliedFaction(s.faction, self.faction)) continue;
      const dx = s.pos.x - self.pos.x, dy = s.pos.y - self.pos.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2){ bestD2=d2; best=s; }
    }
    if (best) return best;
    // Full sweep fallback (enemy is far away)
    for (const s of world.ships){
      if (!s.isAlive() || isAlliedFaction(s.faction, self.faction)) continue;
      const dx = s.pos.x - self.pos.x, dy = s.pos.y - self.pos.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2){ bestD2=d2; best=s; }
    }
    return best;
  }

  // Nearest enemy weighted by threat (big slow ships are high-priority bomber targets)
  function bestBomberTarget(self){
    let best=null, bestScore=-Infinity;
    const RANGE = 900;
    const RANGE2 = RANGE*RANGE;
    const candidates = grid.query(self.pos.x, self.pos.y, RANGE);
    for (const s of candidates){
      if (!s.isAlive() || isAlliedFaction(s.faction, self.faction)) continue;
      const dx = s.pos.x-self.pos.x, dy = s.pos.y-self.pos.y;
      const d2 = dx*dx+dy*dy;
      if (d2 > RANGE2) continue;
      const d = Math.sqrt(d2);
      const hpFrac = (s.shields+s.hull) / (s.maxShields+s.maxHull+1);
      const score = (s.def.mass/500) + (s.def.r/10) - hpFrac*40 - d*0.02;
      if (score > bestScore){ bestScore=score; best=s; }
    }
    return best || nearestEnemy(self);
  }

  // Nearest small/fast enemy (good fighter/interceptor targets)
  function bestFighterTarget(self){
    let best=null, bestScore=-Infinity;
    const RANGE = 700;
    const RANGE2 = RANGE*RANGE;
    const candidates = grid.query(self.pos.x, self.pos.y, RANGE);
    for (const s of candidates){
      if (!s.isAlive() || isAlliedFaction(s.faction, self.faction)) continue;
      const dx = s.pos.x-self.pos.x, dy = s.pos.y-self.pos.y;
      const d2 = dx*dx+dy*dy;
      if (d2 > RANGE2) continue;
      const d = Math.sqrt(d2);
      const smallBonus = s.def.role === 'craft' ? 60 : (s.def.mass < 400 ? 20 : 0);
      const hpFrac = (s.shields+s.hull) / (s.maxShields+s.maxHull+1);
      const score = smallBonus - hpFrac*25 - d*0.025;
      if (score > bestScore){ bestScore=score; best=s; }
    }
    return best || nearestEnemy(self);
  }

  function nearestFriendlyCapital(self){
    let best=null, bestD2=Infinity;
    // Capitals/carriers tend to be large and nearby — grid query is plenty
    const candidates = grid.query(self.pos.x, self.pos.y, 2400);
    for (const s of candidates){
      if (!s.isAlive() || isHostileFaction(s.faction, self.faction)) continue;
      if (s.def.role !== 'capital' && s.def.role !== 'carrier') continue;
      const dx=s.pos.x-self.pos.x, dy=s.pos.y-self.pos.y;
      const d2=dx*dx+dy*dy;
      if (d2<bestD2){bestD2=d2;best=s;}
    }
    if (best) return best;
    // Full fallback
    for (const s of world.ships){
      if (!s.isAlive() || isHostileFaction(s.faction, self.faction)) continue;
      if (s.def.role !== 'capital' && s.def.role !== 'carrier') continue;
      const dx=s.pos.x-self.pos.x, dy=s.pos.y-self.pos.y;
      const d2=dx*dx+dy*dy;
      if (d2<bestD2){bestD2=d2;best=s;}
    }
    return best;
  }

  // Count friendly craft nearby (for carrier launch throttle)
  function countFriendlyCraft(self, radius){
    let n = 0;
    const r2 = radius*radius;
    const candidates = grid.query(self.pos.x, self.pos.y, radius);
    for (const s of candidates){
      if (!s.isAlive() || s === self) continue;
      if (isHostileFaction(s.faction, self.faction)) continue;
      if (s.def.role !== 'craft') continue;
      const dx=s.pos.x-self.pos.x, dy=s.pos.y-self.pos.y;
      if (dx*dx+dy*dy <= r2) n++;
    }
    return n;
  }

  // Count alive enemies
  function countAliveEnemies(self){
    let n=0;
    for (const s of world.ships){
      if (s.isAlive() && isHostileFaction(s.faction, self.faction)) n++;
    }
    return n;
  }

  // Average position of all alive enemies (for flanking)
  function enemyMassCenter(self){
    let sx=0, sy=0, n=0;
    for (const s of world.ships){
      if (!s.isAlive()) continue;
      if (isAlliedFaction(s.faction, self.faction)) continue;
      sx+=s.pos.x; sy+=s.pos.y; n++;
    }
    if (!n) return null;
    return {x:sx/n, y:sy/n};
  }

  // Pick a flanking approach angle perpendicular to the main threat axis
  function flankPoint(self, center, radius){
    const toCenter = sub(center, self.pos);
    const d = len(toCenter);
    const perp = { x: -toCenter.y/d, y: toCenter.x/d };
    const side = (self.id % 2 === 0) ? 1 : -1;
    return add(center, mul(perp, side * radius));
  }

  function isSupportShip(ship){
    if (!ship || !ship.def) return false;
    if (ship.def.craft === 'shuttle') return true;
    return ship.defKey === 'patrol' || ship.def.role === 'escort' || ship.def.role === 'screen';
  }

  function nearestFriendlySupport(self, radius=1800){
    let best=null, bestD2=Infinity;
    const candidates = grid.query(self.pos.x, self.pos.y, radius);
    for (const s of candidates){
      if (!s.isAlive() || s === self || isHostileFaction(s.faction, self.faction)) continue;
      if (!isSupportShip(s)) continue;
      const dx=s.pos.x-self.pos.x, dy=s.pos.y-self.pos.y;
      const d2=dx*dx+dy*dy;
      if (d2 < bestD2){ bestD2=d2; best=s; }
    }
    return best;
  }

  function hasNearbyFriendlySupport(self, radius=260){
    const r2 = radius * radius;
    const candidates = grid.query(self.pos.x, self.pos.y, radius);
    for (const s of candidates){
      if (!s.isAlive() || s === self || isHostileFaction(s.faction, self.faction)) continue;
      if (!isSupportShip(s)) continue;
      const dx=s.pos.x-self.pos.x, dy=s.pos.y-self.pos.y;
      if (dx*dx + dy*dy <= r2) return true;
    }
    return false;
  }

  function applyCapitalAutoRepair(ship, dt){
    if (!ship?.isAlive() || ship.def.role !== 'capital') return;
    const brain = ship._aiBrain || {};
    if (!brain.repairMode) return;
    if (!hasNearbyFriendlySupport(ship, 260)) return;
    const enemy = nearestEnemy(ship);
    if (enemy && len(sub(enemy.pos, ship.pos)) < 520) return;

    const hullRate = ship.maxHull * 0.0022;
    const shieldRate = ship.maxShields * 0.0032;
    ship.hull = Math.min(ship.maxHull, ship.hull + hullRate * dt);
    ship.shields = Math.min(ship.maxShields, ship.shields + shieldRate * dt);

    brain.repairFxT = (brain.repairFxT || 0) - dt;
    if (brain.repairFxT <= 0){
      world.effects.push({ kind:'repair', x:ship.pos.x, y:ship.pos.y, t:0, dur:0.55, radius:ship.radius * 0.9 });
      brain.repairFxT = 1.25;
    }
  }

  // AI update stagger: spread AI updates across multiple frames to reduce per-frame spike
  // Each ship gets a "slot" based on its id; only ships in the current slot update AI this frame
  const AI_SLOTS     = 3;   // update 1/3 of AI ships per frame
  let   aiSlotFrame  = 0;

  function aiUpdateShip(ship, dt){
    const brain = ship._aiBrain;
    brain.roamT = (brain.roamT || 0) - dt;
    brain.retreatT = (brain.retreatT || 0) - dt;
    brain.launchT = (brain.launchT || 0) - dt;
    brain.flankT = (brain.flankT || 0) - dt;
    brain.focusTimer = (brain.focusTimer || 0) - dt;

    // Respect very recent explicit orders
    if (world.time - ship.order.issuedAt < 0.25) return;

    const role = ship.def.role;
    const enemy = nearestEnemy(ship);
    if (!enemy){ ship.order.type='idle'; return; }

    const hullFrac = ship.hull / ship.maxHull;
    const shieldFrac = ship.shields / ship.maxShields;
    const healthFrac = (ship.hull + ship.shields) / (ship.maxHull + ship.maxShields);

    // -------- CARRIER / STATION: launch craft + hold position --------
    if (role === 'carrier' || role === 'station'){
      const prefer = (role === 'carrier') ? 700 : 0;
      const to = sub(enemy.pos, ship.pos);
      const d = len(to);

      // Carrier movement: maintain range, kite if needed
      if (role === 'carrier'){
        if (d > prefer + 160){
          ship.order.type = 'attackmove';
          ship.order.point = add(ship.pos, mul(norm(to), Math.min(300, d - prefer)));
          ship.order.issuedAt = world.time;
        } else if (d < prefer * 0.55 && hullFrac < 0.6){
          // Retreat if too close and damaged
          ship.order.type = 'move';
          ship.order.point = add(ship.pos, mul(norm(mul(to,-1)), 340));
          ship.order.issuedAt = world.time;
        } else {
          ship.order.type = 'attackmove';
          ship.order.point = ship.pos;
          ship.order.issuedAt = world.time;
        }
        ship.focusTargetId = enemy.id;
      }

      // Launch craft — only if this ship has a hangar definition
      tryHangarLaunch(ship, brain, enemy, healthFrac);
      return;
    }

    // -------- CAPITAL SHIPS: aggressive advance + focus fire --------
    if (role === 'capital'){
      const prefer = 560;
      const to = sub(enemy.pos, ship.pos);
      const d = len(to);
      const support = nearestFriendlySupport(ship, 2000);
      const lowHealth = healthFrac < 0.35 || hullFrac < 0.30;

      if (lowHealth && ship.def.speed > 10){
        brain.repairMode = true;
      } else if (healthFrac > 0.82){
        brain.repairMode = false;
      }

      // Damaged capitals disengage, regroup with support ships, and repair very slowly.
      if (brain.repairMode && ship.def.speed > 10){
        const away = norm(mul(to, -1));
        let retreat = add(ship.pos, mul(away, support ? 260 : 520));
        if (support){
          const pull = add(ship.pos, mul(away, 200));
          retreat = { x:(support.pos.x + pull.x) * 0.5, y:(support.pos.y + pull.y) * 0.5 };
          ship.focusTargetId = null;
        } else {
          ship.focusTargetId = enemy.id;
        }
        ship.order.type = 'move';
        ship.order.point = retreat;
        ship.order.issuedAt = world.time;
        brain.retreatT = 2.8;
        return;
      }

      if (d > prefer){
        // Advance — use flanking approach for variety
        if (brain.flankT <= 0){
          const center = enemyMassCenter(ship);
          if (center && d > 800){
            const fp = flankPoint(ship, center, 260);
            ship.order.type = 'attackmove';
            ship.order.point = fp;
            brain.flankT = rand(3,6);
          } else {
            ship.order.type = 'attackmove';
            ship.order.point = add(ship.pos, mul(norm(to), Math.min(380, d - prefer)));
          }
          ship.order.issuedAt = world.time;
        }
      } else if (d < prefer * 0.6){
        ship.order.type = 'move';
        ship.order.point = add(ship.pos, mul(norm(mul(to,-1)), 240));
        ship.order.issuedAt = world.time;
      } else {
        ship.order.type = 'attackmove';
        ship.order.point = ship.pos;
        ship.order.issuedAt = world.time;
      }

      // Focus fire: pick the most-damaged enemy capital, else nearest
      if (brain.focusTimer <= 0){
        let pick = enemy, bestScore = -Infinity;
        const focusCandidates = grid.query(ship.pos.x, ship.pos.y, 1100);
        for (const s of focusCandidates){
          if (!s.isAlive() || isAlliedFaction(s.faction, ship.faction)) continue;
          const dist = len(sub(s.pos, ship.pos));
          if (dist > 1100) continue;
          const hp = (s.shields+s.hull)/(s.maxShields+s.maxHull+1);
          const score = (s.def.mass/800) - hp*30 - dist*0.01;
          if (score > bestScore){ bestScore=score; pick=s; }
        }
        ship.focusTargetId = pick.id;
        brain.focusTimer = rand(2,4);
      }
      // Capital ships with hangar definitions also launch craft
      tryHangarLaunch(ship, brain, enemy, healthFrac);
      return;
    }
    if (role === 'escort' || role === 'screen'){
      const anchor = nearestFriendlyCapital(ship);
      const dE = len(sub(enemy.pos, ship.pos));
      const engageRange = role === 'screen' ? 560 : 720;

      if (anchor){
        const ring = role === 'screen' ? 180 : 280;
        const ang = ((ship.id * 1.618) % TAU);
        const goal = add(anchor.pos, { x:Math.cos(ang)*ring, y:Math.sin(ang)*ring });

        if (dE < engageRange){
          // Engage — escorts are aggressive once enemies close
          ship.order.type = 'attackmove';
          ship.order.point = enemy.pos;
          ship.focusTargetId = enemy.id;
          ship.order.issuedAt = world.time;
        } else {
          // Orbit the anchor
          ship.order.type = 'move';
          ship.order.point = goal;
          ship.order.issuedAt = world.time;
        }
        tryHangarLaunch(ship, brain, enemy, healthFrac);
        return;
      }
      // No capital to protect — just engage
      ship.order.type = 'attackmove';
      ship.order.point = enemy.pos;
      ship.focusTargetId = enemy.id;
      ship.order.issuedAt = world.time;
      tryHangarLaunch(ship, brain, enemy, healthFrac);
      return;
    }

    // -------- STRIKE: fast ships attack and retreat (kiting) --------
    if (role === 'strike'){
      let pick = enemy, bestScore=-Infinity;
      const strikeCandidates = grid.query(ship.pos.x, ship.pos.y, 680);
      for (const s of strikeCandidates){
        if (!s.isAlive() || isAlliedFaction(s.faction, ship.faction)) continue;
        const d = len(sub(s.pos, ship.pos));
        if (d > 680) continue;
        const hp = (s.shields+s.hull)/(s.maxShields+s.maxHull+1);
        const score = (1-hp)*35 - d*0.018 - (s.def.mass/600);
        if (score > bestScore){ bestScore=score; pick=s; }
      }
      ship.focusTargetId = pick.id;
      ship.order.type = 'attackmove';
      ship.order.point = pick.pos;
      ship.order.issuedAt = world.time;
      return;
    }

    // -------- CRAFT: role-specific small-craft AI --------
    if (role === 'craft'){
      const craft = ship.def.craft;

      // Bombers: high-value target hunting, stay near max weapon range to avoid PD fire
      if (craft === 'bomber'){
        const target = bestBomberTarget(ship);
        if (target){
          const dT = len(sub(target.pos, ship.pos));
          const wRange = ship.weapons[0]?.range ?? 320;
          ship.focusTargetId = target.id;
          if (dT > wRange * 0.85){
            // Approach
            ship.order.type = 'attackmove';
            ship.order.point = target.pos;
          } else if (dT < wRange * 0.5){
            // Too close (PD threat) — pull back to optimal range
            const pullDir = norm(sub(ship.pos, target.pos));
            ship.order.type = 'move';
            ship.order.point = add(ship.pos, mul(pullDir, 120));
          } else {
            // In optimal range — strafe sideways
            const strafe = { x: -(target.pos.y-ship.pos.y), y: target.pos.x-ship.pos.x };
            const sLen = len(strafe);
            if (sLen > 0.1){
              const side = (ship.id%2===0)?1:-1;
              ship.order.type = 'move';
              ship.order.point = add(ship.pos, mul({x:strafe.x/sLen,y:strafe.y/sLen}, side*180));
            } else {
              ship.order.type = 'attackmove';
              ship.order.point = target.pos;
            }
          }
          ship.order.issuedAt = world.time;
        }
        return;
      }

      // Interceptors: hunt enemy craft and fast ships
      if (craft === 'interceptor'){
        // First look for enemy craft
        let craftTarget = null, bestD = Infinity;
        for (const s of world.ships){
          if (!s.isAlive() || isAlliedFaction(s.faction, ship.faction)) continue;
          if (s.def.role !== 'craft') continue;
          const d = len(sub(s.pos, ship.pos));
          if (d < bestD){ bestD=d; craftTarget=s; }
        }
        const target = (craftTarget && bestD < 720) ? craftTarget : enemy;
        ship.focusTargetId = target.id;
        ship.order.type = 'attackmove';
        ship.order.point = target.pos;
        ship.order.issuedAt = world.time;
        return;
      }

      // Fighters: flexible — attack nearby enemies, focus damaged targets
      if (craft === 'fighter'){
        const target = bestFighterTarget(ship);
        ship.focusTargetId = target ? target.id : enemy.id;
        ship.order.type = 'attackmove';
        ship.order.point = (target || enemy).pos;
        ship.order.issuedAt = world.time;
        return;
      }

      // Drones: swarm nearest enemy, no retreat
      if (craft === 'drone'){
        ship.focusTargetId = enemy.id;
        ship.order.type = 'attackmove';
        ship.order.point = enemy.pos;
        ship.order.issuedAt = world.time;
        return;
      }

      // Shuttles: stay near friendly capital, light support
      if (craft === 'shuttle'){
        const anchor = nearestFriendlyCapital(ship);
        if (anchor){
          const dE = len(sub(enemy.pos, ship.pos));
          if (dE < 340){
            ship.order.type = 'attackmove';
            ship.order.point = enemy.pos;
            ship.focusTargetId = enemy.id;
          } else {
            const ang = (ship.id * 2.1) % TAU;
            ship.order.type = 'move';
            ship.order.point = add(anchor.pos, {x:Math.cos(ang)*150, y:Math.sin(ang)*150});
          }
          ship.order.issuedAt = world.time;
          return;
        }
        // No anchor: engage
        ship.focusTargetId = enemy.id;
        ship.order.type = 'attackmove';
        ship.order.point = enemy.pos;
        ship.order.issuedAt = world.time;
        return;
      }

      // Generic craft fallback
      ship.focusTargetId = enemy.id;
      ship.order.type = 'attackmove';
      ship.order.point = enemy.pos;
      ship.order.issuedAt = world.time;
      return;
    }

    // -------- FALLBACK --------
    ship.focusTargetId = enemy.id;
    ship.order.type = 'attackmove';
    ship.order.point = enemy.pos;
    ship.order.issuedAt = world.time;
  }

  // ---------- Input / Selection ----------
  const input = {
    mouseClient: v2(0,0),
    mouseLocal: v2(0,0),
    lmb:false,
    rmb:false,
    mmb:false,
    dragging:false,
    dragStartClient: v2(0,0),
    dragNowClient: v2(0,0),
    dragStartLocal: v2(0,0),
    dragNowLocal: v2(0,0),
    boxSelect:false,
    potentialPlace:false,
    downOnShip:false,
    placing:false,
    keyA:false,
    keyT:false,
    keyW:false,   // W held = warp-jump mode
    camL:false, camR:false, camU:false, camD:false,  // arrow key camera pan
    shift:false,
    ctrl:false,
    hoveredShip: null,
  };

  function shipsInBox(aLocal,bLocal){
    const minx = Math.min(aLocal.x,bLocal.x), maxx = Math.max(aLocal.x,bLocal.x);
    const miny = Math.min(aLocal.y,bLocal.y), maxy = Math.max(aLocal.y,bLocal.y);
    const out = [];
    for (const s of world.ships){
      if (!s.isAlive()) continue;
      const sp = worldToScreen(s.pos.x, s.pos.y);
      if (sp.x >= minx && sp.x <= maxx && sp.y >= miny && sp.y <= maxy) out.push(s);
    }
    return out;
  }

  function deselectAll(){
    for (const s of world.ships) s.selected = false;
  }
  // Player-controllable ships only (for orders)
  function selectedShips(){
    return world.ships.filter(s => s.selected && s.isAlive() && isPlayerFaction(s.faction));
  }
  // ALL selected ships regardless of faction (for delete)
  function allSelectedShips(){
    return world.ships.filter(s => s.selected && s.isAlive());
  }

  // ── Repair: restore 25% hull + 20% shields, show green effect (R) ──
  function repairSelected(){
    const sel = selectedShips();
    let did = false;
    for (const s of sel){
      if (s.hull < s.maxHull || s.shields < s.maxShields){
        s.hull    = Math.min(s.maxHull,    s.hull    + s.maxHull    * 0.25);
        s.shields = Math.min(s.maxShields, s.shields + s.maxShields * 0.20);
        world.effects.push({ kind:'repair', x:s.pos.x, y:s.pos.y, t:0, dur:0.85, radius:s.radius });
        did = true;
      }
    }
    if (did) audio.repair();
  }

  // ── Recall: send selected craft back to nearest friendly carrier (C) ──
  function recallCraft(){
    const crafts = selectedShips().filter(s => s.def.role === 'craft');
    if (!crafts.length) return;
    for (const c of crafts){
      const carrier = world.ships.find(s =>
        s.isAlive() && s.faction === c.faction &&
        (s.def.role === 'carrier' || s.def.role === 'station')
      );
      if (carrier){
        c.order = { type:'move', point:{ x: carrier.pos.x + rand(-carrier.radius*0.5, carrier.radius*0.5),
                                         y: carrier.pos.y + rand(-carrier.radius*0.5, carrier.radius*0.5) },
                    targetId:null, issuedAt: world.time };
        c.focusTargetId = null;
        c.holdFire = true;
      }
    }
    audio.orderAck();
  }

  // ── Scatter: burst selected ships away from each other (E) ──
  function scatterSelected(){
    const sel = selectedShips();
    if (!sel.length) return;
    const cx = sel.reduce((s,u) => s + u.pos.x, 0) / sel.length;
    const cy = sel.reduce((s,u) => s + u.pos.y, 0) / sel.length;
    for (const s of sel){
      const away = norm(sub(s.pos, {x:cx, y:cy}));
      const dist  = 160 + rand(30, 100);
      s.order = { type:'move', point: add(s.pos, mul(away.x||away, dist)), targetId:null, issuedAt:world.time };
    }
    audio.orderAck();
  }

  // ── Warp-jump selected ships to a world point (W + RMB) ──
  function warpMoveSelected(wx, wy){
    const sel = selectedShips();
    if (!sel.length) return;
    sel.forEach((s, i) => {
      const a = (i / Math.max(1, sel.length)) * TAU;
      const spread = Math.min(55, 8 + Math.sqrt(sel.length) * 13);
      const tx = wx + Math.cos(a) * spread * (sel.length > 1 ? 0.9 : 0) + rand(-5,5);
      const ty = wy + Math.sin(a) * spread * (sel.length > 1 ? 0.9 : 0) + rand(-5,5);
      // departure flash at old position
      spawnWarpIn(s.pos.x, s.pos.y, s.radius, s.faction);
      s.pos.x = tx; s.pos.y = ty;
      s.vel   = v2(0, 0);
      s._warp = { active:true, t:0, dur:0.52, startX:tx, startY:ty };
      spawnWarpIn(tx, ty, s.radius, s.faction);
      audio.warpJump(s.radius >= 55);
    });
  }

  // ── Select all player-controlled ships (Ctrl+A) ──
  function selectAllFriendly(){
    for (const s of world.ships)
      if (s.isAlive() && isPlayerFaction(s.faction)) s.selected = true;
  }

  // ── Focus camera on selection centroid (G) ──
  function focusCamOnSelection(){
    const sel = allSelectedShips();
    if (!sel.length) return;
    cam.x = sel.reduce((a,s) => a + s.pos.x, 0) / sel.length;
    cam.y = sel.reduce((a,s) => a + s.pos.y, 0) / sel.length;
  }

  function pickShipAtScreen(sx, sy){
    const wp = screenToWorld(sx, sy);
    let best=null, bestD=Infinity;
    for (const s of world.ships){
      if (!s.isAlive()) continue;
      const d = len(sub(s.pos, wp));
      if (d <= s.radius){
        if (d < bestD){ bestD=d; best=s; }
      }
    }
    return best;
  }

  function applyFormationAndOrder(sel, destWorld, type){
    if (sel.length === 0) return;

    const sorted = [...sel].sort((a,b)=>a.id-b.id);
    const n = sorted.length;
    const avgR = sorted.reduce((s,u)=>s+u.radius, 0)/n;
    const gap = clamp(avgR * 2.0, 32, 130);

    const offsets = [];

    if (type === 'free' || type === 'natural' || !type){
      // ── EAW-style natural spread ──────────────────────────────
      // Ships spread organically from the destination, sorted by size (largest central).
      // Uses a sunflower/phyllotaxis spiral so ships never stack and spacing scales
      // with their actual radii — just like Empire At War.
      const bySize = [...sorted].sort((a,b) => b.radius - a.radius);
      const phi = (1 + Math.sqrt(5)) / 2; // golden ratio
      for (let i = 0; i < n; i++){
        const ship = bySize[i];
        const r = ship.radius;
        // index 0 = center, rest spiral outward
        if (i === 0){
          offsets[sorted.indexOf(ship)] = { x:0, y:0 };
        } else {
          const dist = gap * 0.72 * Math.sqrt(i);
          const angle = i * TAU / (phi * phi); // golden angle
          const jitter = rand(-r * 0.15, r * 0.15);
          offsets[sorted.indexOf(ship)] = {
            x: Math.cos(angle) * (dist + jitter),
            y: Math.sin(angle) * (dist + jitter)
          };
        }
      }
    } else if (type === 'line'){
      for (let i=0;i<n;i++) offsets.push({x:0, y:(i-(n-1)/2)*gap});
    } else if (type === 'line_h'){
      for (let i=0;i<n;i++) offsets.push({x:(i-(n-1)/2)*gap, y:0});
    } else if (type === 'wedge'){
      offsets.push({x:0,y:0});
      let row=1, placed=1;
      while (placed < n){
        for (let k=0;k<row*2 && placed<n;k++){
          const side = (k%2===0)?-1:1;
          const idx = Math.floor(k/2)+1;
          offsets.push({ x: side*idx*gap, y: row*gap*0.85 });
          placed++;
        }
        row++;
      }
    } else if (type === 'ring'){
      const radius = Math.max(40, gap * Math.sqrt(n));
      for (let i=0;i<n;i++){
        const a = (i/n)*TAU;
        offsets.push({ x: Math.cos(a)*radius, y: Math.sin(a)*radius });
      }
    } else if (type === 'wall'){
      const cols = Math.max(2, Math.ceil(Math.sqrt(n * 1.6)));
      for (let i=0;i<n;i++){
        const row = Math.floor(i / cols);
        const col = i % cols;
        offsets.push({
          x: (col - (cols - 1) / 2) * gap,
          y: (row - (Math.ceil(n / cols) - 1) / 2) * gap * 0.9,
        });
      }
    } else if (type === 'echelon'){
      for (let i=0;i<n;i++){
        offsets.push({ x:(i-(n-1)/2)*gap*0.9, y:(i-(n-1)/2)*gap*0.9 });
      }
    } else {
      // fallback: natural spread
      const phi = (1 + Math.sqrt(5)) / 2;
      for (let i=0;i<n;i++){
        if (i===0){ offsets.push({x:0,y:0}); continue; }
        const dist = gap * 0.72 * Math.sqrt(i);
        const angle = i * TAU / (phi * phi);
        offsets.push({ x: Math.cos(angle)*dist, y: Math.sin(angle)*dist });
      }
    }

    for (let i=0;i<n;i++){
      const s = sorted[i];
      const p = add(destWorld, offsets[i] || {x:0,y:0});
      s.order.type = input.keyA ? 'attackmove' : 'move';
      s.order.point = p;
      s.order.targetId = null;
      s.order.issuedAt = world.time;
    }
  }

  // ---------- Spawn ----------
  function spawnShip(defKey, faction, x, y){
    const s = new Ship(defKey, faction, x, y);
    world.ships.push(s);
    _shipsSortDirty = true;
    // Hyperspace arrival visual + sound
    spawnWarpIn(x, y, s.radius, faction);
    audio.warpJump(s.radius >= 55);
    return s;
  }

    function populateSpawnList(){
    const faction = el.spawnFaction.value;
    const allowed = FACTION_LOADOUTS[faction] || [];

    // Group by role, preserving faction loadout order within each group
    const ROLE_LABELS = {
      station: '🏛  Stations',
      capital: '⚔️  Capital Ships',
      carrier: '🚀  Carriers',
      escort:  '🛡  Cruisers / Escorts',
      screen:  '⚡  Destroyers / Screens',
      strike:  '🎯  Corvettes / Strike',
      craft:   '✈️  Craft',
    };
    const ROLE_ORDER = ['station','capital','carrier','escort','screen','strike','craft'];
    const groups = {};
    for (const key of allowed){
      const d = DEF_BY_KEY.get(key);
      if (!d) continue;
      const r = d.role || 'craft';
      (groups[r] = groups[r] || []).push(d);
    }

    el.spawnType.innerHTML = '';
    for (const role of ROLE_ORDER){
      const defs = groups[role];
      if (!defs || !defs.length) continue;
      const grp = document.createElement('optgroup');
      grp.label = ROLE_LABELS[role] || role;
      for (const d of defs){
        const opt = document.createElement('option');
        opt.value = d.key;
        opt.textContent = d.name;
        grp.appendChild(opt);
      }
      el.spawnType.appendChild(grp);
    }
  }

  // ---------- Scenario ----------
  function exportScenario(){
    const data = {
      world: { w: world.w, h: world.h },
      ships: world.ships.filter(s=>s.isAlive()).map(s => ({
        defKey: s.defKey,
        faction: s.faction,
        x: s.pos.x, y: s.pos.y,
        shields: s.shields, hull: s.hull
      })),
      camera: { x: cam.x, y: cam.y, zoom: cam.zoom }
    };
    el.scenarioBox.value = JSON.stringify(data, null, 2);
  }

  function importScenario(){
    let data = null;
    try { data = JSON.parse(el.scenarioBox.value || '{}'); }
    catch { return; }

    resetWorld(false);

    if (data.world){
      world.w = data.world.w || world.w;
      world.h = data.world.h || world.h;
    }
    if (Array.isArray(data.ships)){
      for (const s of data.ships){
        if (!DEF_BY_KEY.has(s.defKey)) continue;
        const ship = spawnShip(s.defKey, s.faction || 'republic', s.x||0, s.y||0);
        if (typeof s.shields === 'number') ship.shields = clamp(s.shields, 0, ship.maxShields);
        if (typeof s.hull === 'number') ship.hull = clamp(s.hull, 0, ship.maxHull);
      }
    }
    if (data.camera){
      cam.x = data.camera.x ?? cam.x;
      cam.y = data.camera.y ?? cam.y;
      cam.zoom = clamp(data.camera.zoom ?? cam.zoom, cam.minZoom, cam.maxZoom);
    }
  }

  let recentCasualties = 0;
  let musicEvalTimer = 0;

  function battleIntensityInfo(){
    if (!world.running || world.gameOver || !world.ships.length){
      return { value: 0, label: 'Ambient' };
    }

    const roleWeight = { station: 5.2, capital: 4.0, carrier: 3.0, escort: 1.9, screen: 1.25, strike: 0.95, craft: 0.24 };
    let weightedShips = 0;
    let capitals = 0;
    let missingPower = 0;
    let knifeFightPressure = 0;
    let liveTeams = new Set();

    for (const s of world.ships){
      if (!s.isAlive()) continue;
      const role = s.def.role || 'craft';
      weightedShips += roleWeight[role] || 1;
      if (role === 'capital' || role === 'station') capitals += 1;
      const maxPool = Math.max(1, (s.maxHull || 0) + (s.maxShields || 0));
      const nowPool = Math.max(0, (s.hull || 0) + (s.shields || 0));
      missingPower += (1 - nowPool / maxPool) * Math.min((roleWeight[role] || 1) * 0.28, 1.4);
      if (nearestEnemy(s) && len(sub(nearestEnemy(s).pos, s.pos)) < Math.max(520, s.radius * 7)) knifeFightPressure += Math.min((roleWeight[role] || 1) * 0.12, 0.9);
      liveTeams.add(FACTIONS[s.faction]?.team ?? s.faction);
    }

    const shipPressure = clamp(weightedShips / 52, 0, 1);
    const projectilePressure = clamp(world.projectiles.length / 140, 0, 1);
    const capitalPressure = clamp(capitals / 8, 0, 1);
    const damagePressure = clamp(missingPower / 10.5, 0, 1);
    const casualtyPressure = clamp(recentCasualties / 4.5, 0, 1);
    const knifeFight = clamp(knifeFightPressure / 8.5, 0, 1);
    const teamPressure = clamp((liveTeams.size - 1) / 3, 0, 1);

    const value = clamp(
      shipPressure * 0.24 +
      projectilePressure * 0.20 +
      capitalPressure * 0.16 +
      damagePressure * 0.14 +
      casualtyPressure * 0.10 +
      knifeFight * 0.10 +
      teamPressure * 0.06,
      0, 1
    );

    let label = 'Calm';
    if (value >= 0.82) label = 'Cataclysm';
    else if (value >= 0.60) label = 'All-Out War';
    else if (value >= 0.34) label = 'Engaged';
    else if (value >= 0.12) label = 'Skirmish';

    return { value, label };
  }

  function updateDynamicMusic(dt){
    recentCasualties = Math.max(0, recentCasualties - dt * 0.72);
    if (!world.running || world.gameOver){
      world.musicIntensity = 0;
      world.musicIntensityLabel = 'Ambient';
      audio.setBattleIntensity(0, true);
      return;
    }
    musicEvalTimer -= dt;
    if (musicEvalTimer > 0) return;
    musicEvalTimer = 0.22;
    const info = battleIntensityInfo();
    world.musicIntensity = info.value;
    world.musicIntensityLabel = info.label;
    audio.setBattleIntensity(info.value);
  }

  // ---------- World reset / quick battle ----------
  function resetWorld(clearScenarioBox=true){
    playerFaction = el.playerFaction?.value || 'republic';
    if (el.spawnFaction) el.spawnFaction.value = playerFaction;
    world.ships.length = 0;
    world.projectiles.length = 0;
    world.effects.length = 0;
    world.nextId = 1;
    world.time = 0;
    world.running = false;
    world.battleReport = null;
    _shipsSortDirty = true;
    el.btnStart.disabled = false;
    el.btnStart.textContent = 'Start Battle';
    world.gameOver = false;
    world.winner = null;
    world.musicIntensity = 0;
    world.musicIntensityLabel = 'Ambient';
    recentCasualties = 0;
    musicEvalTimer = 0;
    audio.setBattleIntensity(0, true);
    audio.setMusicMood('ambient');
    hideOverlay();

    if (clearScenarioBox) el.scenarioBox.value = '';

    // place camera
    cam.x = world.w/2;
    cam.y = world.h/2;
    cam.zoom = 0.95;
    setBattleButton();
    // Map starts empty by design (no auto-spawns).
  }

    function quickBattle(){
    resetWorld(false);

    // Republic task force
    spawnShip('rep_dread',         'republic', world.w*0.24, world.h*0.54);
    spawnShip('rep_carrier_heavy', 'republic', world.w*0.19, world.h*0.48);
    spawnShip('rep_carrier_light', 'republic', world.w*0.19, world.h*0.60);
    spawnShip('rep_hcruiser',      'republic', world.w*0.20, world.h*0.43);
    spawnShip('rep_hcruiser',      'republic', world.w*0.20, world.h*0.65);
    for (let i=0;i<5;i++) spawnShip('rep_destroyer','republic', world.w*0.15+rand(-80,80), world.h*0.54+rand(-90,90));
    for (let i=0;i<4;i++) spawnShip('rep_frigate','republic',   world.w*0.13+rand(-60,60), world.h*0.54+rand(-80,80));
    for (let i=0;i<6;i++) spawnShip('rep_fighter',     'republic', world.w*0.22+rand(-130,130), world.h*0.54+rand(-120,120));
    for (let i=0;i<4;i++) spawnShip('rep_interceptor', 'republic', world.w*0.22+rand(-120,120), world.h*0.54+rand(-100,100));
    for (let i=0;i<3;i++) spawnShip('rep_bomber',      'republic', world.w*0.21+rand(-90,90),   world.h*0.54+rand(-90,90));
    for (let i=0;i<4;i++) spawnShip('rep_drone',       'republic', world.w*0.21+rand(-100,100), world.h*0.54+rand(-100,100));

    // Empire fleet
    spawnShip('emp_battle',    'empire', world.w*0.78, world.h*0.54);
    spawnShip('emp_destroyer', 'empire', world.w*0.82, world.h*0.46);
    spawnShip('emp_destroyer', 'empire', world.w*0.82, world.h*0.62);
    for (let i=0;i<8;i++) spawnShip('patrol','empire',       world.w*0.86+rand(-120,120), world.h*0.54+rand(-100,100));
    for (let i=0;i<6;i++) spawnShip('emp_fighter',     'empire', world.w*0.78+rand(-140,140), world.h*0.54+rand(-130,130));
    for (let i=0;i<4;i++) spawnShip('emp_interceptor', 'empire', world.w*0.78+rand(-130,130), world.h*0.54+rand(-110,110));
    for (let i=0;i<3;i++) spawnShip('emp_bomber',      'empire', world.w*0.79+rand(-100,100), world.h*0.54+rand(-90,90));
    for (let i=0;i<5;i++) spawnShip('emp_drone',       'empire', world.w*0.80+rand(-120,120), world.h*0.54+rand(-110,110));

    setBattleButton();

    // start immediately
    startBattle();
  }

  function setBattleButton(){
    if (!el.btnStart) return;
    if (world.running){
      el.btnStart.textContent = 'Battle Running';
      el.btnStart.disabled = true;
      el.btnStart.classList.add('btn-primary');
      el.btnStart.classList.remove('btn-danger');
    } else {
      el.btnStart.textContent = 'Start Battle';
      el.btnStart.disabled = false;
      el.btnStart.classList.add('btn-primary');
      el.btnStart.classList.remove('btn-danger');
    }
  }

  function startBattle(){
    if (world.gameOver) hideOverlay();
    if (world.running) return; // already running
    world.battleReport = {
      startedAt: performance.now(),
      endedAt: null,
      startCounts: countByFactionAndType(world.ships),
      destroyedCounts: {},
      totalDestroyed: 0,
    };
    world.running = true;
    recentCasualties = 0;
    musicEvalTimer = 0;
    const info = battleIntensityInfo();
    world.musicIntensity = info.value;
    world.musicIntensityLabel = info.label;
    audio.setBattleIntensity(Math.max(0.18, info.value), true);
    audio.setMusicMood('battle');
    setBattleButton();
    el.status.textContent = 'Battle started. Units will engage based on diplomacy.';
  }

  function stopBattle(){
    world.running = false;
    world.projectiles.length = 0;
    world.effects.length = 0;
    for (const s of world.ships){
      s.targetId = null;
      s.focusTargetId = null;
    }
    world.gameOver = false;
    world.winner = null;
    world.musicIntensity = 0;
    world.musicIntensityLabel = 'Ambient';
    audio.setBattleIntensity(0, true);
    audio.setMusicMood('ambient');
    hideOverlay();
    setBattleButton();
    el.status.textContent = "Setup mode. Place units, then press Start Battle.";
  }


  // ---------- UI ----------
    function updateStatus(){
    const aliveCounts = {};
    for (const f of Object.keys(FACTIONS)) aliveCounts[f] = 0;
    for (const s of world.ships) if (s.isAlive()) aliveCounts[s.faction] = (aliveCounts[s.faction]||0)+1;

    const sel = selectedShips();
    const z = cam.zoom.toFixed(2);

    const lines = [];
    for (const f of Object.keys(FACTIONS)){
      const count = aliveCounts[f]||0;
      if (count === 0 && !world.running) continue;
      const col = FACTIONS[f].tint;
      const destroyed = world.battleReport ? Object.values(world.battleReport.destroyedCounts[f]||{}).reduce((a,b)=>a+b,0) : 0;
      const destroyedStr = world.running && destroyed > 0 ? ` <span style="color:#ff7777">(-${destroyed})</span>` : '';
      lines.push(`<div><b style="color:rgb(${col[0]},${col[1]},${col[2]})">${FACTIONS[f].name}</b>: ${count}${destroyedStr}</div>`);
    }
    lines.push(`<div style="margin-top:4px"><b>Mode</b>: ${world.running ? '⚔️ Battle' : '🛠 Setup'} &nbsp;|&nbsp; <b>Speed</b>: ${gameSpeed}x</div>`);
    if (sel.length) lines.push(`<div><b>Selected</b>: ${sel.length} unit${sel.length>1?'s':''}</div>`);
    lines.push(`<div><b>Zoom</b>: ${z} &nbsp;<span style="color:#556688">+/- to change speed</span></div>`);

    // Special weapon readout for selected ships (if any)
    const specials = [];
    for (const s of sel){
      const sp = (s.weapons||[]).filter(w=>w.special);
      if (!sp.length) continue;
      for (const w of sp){
        const uses = (w.usesLeft ?? 0);
        const max = (w.usesMax ?? 0);
        const cd = Math.max(0, w.cd ?? 0);
        specials.push(`${s.def.name}: ${w.name} — ${uses}/${max} uses, ${cd.toFixed(0)}s CD`);
      }
    }
    if (specials.length){
      lines.push(`<div style="margin-top:6px;color:#cdd7f0"><b>Specials</b><br>${specials.slice(0,6).join('<br>')}</div>`);
    }

    el.status.innerHTML = lines.join('');
  }

  function showOverlay(title, html){
    el.overlayTitle.textContent = title;
    el.overlayText.innerHTML = html;
    el.overlay.classList.remove('hidden');

  }

  function hideOverlay(){
    el.overlay.classList.add('hidden');
  }

  // ---------- Background themes ----------
  const BG_THEMES = {
    deepspace: {
      skyColor: '#02040e',
      nebulaColors: [[55,75,175],[110,35,155],[25,95,175],[165,35,55],[35,130,115]],
      nebulaAlpha: [0.028, 0.085],
      nebulaCount: 7,
      dustColor: [80,100,180],
      dustAlpha: 0.018,
      starTint: [[255,255,255],[200,220,255],[255,240,220]],
      clusterColor: [160,190,255],
      brightStars: true,
    },
    nebula: {
      skyColor: '#060210',
      nebulaColors: [[140,30,200],[80,10,160],[200,50,160],[60,20,140],[180,80,220]],
      nebulaAlpha: [0.06, 0.18],
      nebulaCount: 9,
      dustColor: [160,60,220],
      dustAlpha: 0.04,
      starTint: [[255,200,255],[220,180,255],[255,255,255]],
      clusterColor: [200,160,255],
      brightStars: true,
    },
    redgiant: {
      skyColor: '#0a0200',
      nebulaColors: [[200,50,10],[180,30,5],[220,90,20],[160,20,30],[200,60,40]],
      nebulaAlpha: [0.05, 0.16],
      nebulaCount: 8,
      dustColor: [220,80,30],
      dustAlpha: 0.035,
      starTint: [[255,200,150],[255,160,100],[255,240,200]],
      clusterColor: [255,160,80],
      brightStars: false,
    },
    bluedwarf: {
      skyColor: '#000208',
      nebulaColors: [[20,60,200],[10,80,220],[30,120,200],[15,50,180],[40,100,220]],
      nebulaAlpha: [0.04, 0.14],
      nebulaCount: 7,
      dustColor: [40,100,255],
      dustAlpha: 0.03,
      starTint: [[180,210,255],[150,190,255],[255,255,255]],
      clusterColor: [100,160,255],
      brightStars: true,
    },
    supernova: {
      skyColor: '#050300',
      nebulaColors: [[220,160,10],[200,100,10],[240,200,30],[180,60,10],[255,180,50]],
      nebulaAlpha: [0.06, 0.20],
      nebulaCount: 10,
      dustColor: [240,160,20],
      dustAlpha: 0.05,
      starTint: [[255,240,180],[255,220,120],[255,255,220]],
      clusterColor: [255,200,80],
      brightStars: true,
    },
    voidrift: {
      skyColor: '#000a06',
      nebulaColors: [[10,180,140],[20,200,120],[10,160,180],[30,140,160],[15,200,160]],
      nebulaAlpha: [0.04, 0.14],
      nebulaCount: 7,
      dustColor: [20,200,160],
      dustAlpha: 0.03,
      starTint: [[150,255,220],[180,255,240],[255,255,255]],
      clusterColor: [50,220,180],
      brightStars: true,
    },
    ashfield: {
      skyColor: '#060504',
      nebulaColors: [[90,75,55],[80,70,60],[100,85,65],[70,60,50],[95,80,60]],
      nebulaAlpha: [0.04, 0.13],
      nebulaCount: 8,
      dustColor: [120,100,70],
      dustAlpha: 0.045,
      starTint: [[220,210,190],[200,190,170],[255,250,240]],
      clusterColor: [180,160,120],
      brightStars: false,
    },
    goldcluster: {
      skyColor: '#050400',
      nebulaColors: [[200,150,20],[180,120,10],[220,180,30],[160,100,15],[210,160,40]],
      nebulaAlpha: [0.05, 0.18],
      nebulaCount: 12,
      dustColor: [220,180,40],
      dustAlpha: 0.04,
      starTint: [[255,240,160],[255,220,100],[255,255,200]],
      clusterColor: [255,210,80],
      brightStars: true,
    },
  };

  let activeBgTheme = 'deepspace';

  // Expose setter for the HTML picker
  window.setBattleBackground = function(name){
    if (!BG_THEMES[name]) return;
    activeBgTheme = name;
    BG.rebuild();
  };

  // ---------- Background (stars + nebula + dust, generated per theme) ----------
  const BG = (() => {
    let stars = [];
    let nebulas = [];
    let dustParticles = [];
    let clusters = [];
    let nebulaCanvas = null;
    let nebulaZoom   = -1;
    let builtTheme   = null;

    function build(){
      const theme = BG_THEMES[activeBgTheme];
      builtTheme = activeBgTheme;
      nebulaCanvas = null;
      nebulaZoom = -1;

      // Stars — 3 parallax layers with theme tint
      const layers = [
        { count:360, minR:0.35, maxR:1.0,  alpha:0.50, parallax:0.07 },
        { count:200, minR:0.7,  maxR:1.7,  alpha:0.72, parallax:0.13 },
        { count: 70, minR:1.3,  maxR:2.8,  alpha:0.88, parallax:0.21 },
      ];
      stars = [];
      for (const L of layers){
        for (let i=0;i<L.count;i++){
          const tintIdx = Math.floor(Math.random() * theme.starTint.length);
          stars.push({
            wx: rand(0, world.w), wy: rand(0, world.h),
            r: rand(L.minR, L.maxR),
            alpha: rand(L.alpha*0.55, L.alpha),
            parallax: L.parallax,
            twinkle: rand(0, TAU),
            twinkleSpeed: rand(0.4, 2.0),
            tint: theme.starTint[tintIdx],
          });
        }
      }

      // Bright star spikes for vivid themes
      if (theme.brightStars){
        for (let i=0;i<18;i++){
          const tintIdx = Math.floor(Math.random() * theme.starTint.length);
          stars.push({
            wx: rand(0, world.w), wy: rand(0, world.h),
            r: rand(2.2, 4.5),
            alpha: rand(0.55, 0.95),
            parallax: 0.18,
            twinkle: rand(0, TAU),
            twinkleSpeed: rand(0.3, 0.9),
            tint: theme.starTint[tintIdx],
            spike: true,
          });
        }
      }

      // Star clusters — dense local concentrations
      clusters = [];
      for (let c=0; c<5; c++){
        const cx = rand(100, world.w-100), cy = rand(100, world.h-100);
        const tintIdx = Math.floor(Math.random() * theme.starTint.length);
        for (let i=0; i<40; i++){
          const a = rand(0, TAU), d = rand(0, 220);
          stars.push({
            wx: cx + Math.cos(a)*d, wy: cy + Math.sin(a)*d,
            r: rand(0.3, 1.2),
            alpha: rand(0.3, 0.7) * (1 - d/220),
            parallax: 0.10,
            twinkle: rand(0, TAU),
            twinkleSpeed: rand(0.5, 1.8),
            tint: theme.starTint[tintIdx],
          });
        }
      }

      // Nebulas
      nebulas = [];
      for (let i=0;i<theme.nebulaCount;i++){
        const col = theme.nebulaColors[i % theme.nebulaColors.length];
        nebulas.push({
          wx: rand(150, world.w-150),
          wy: rand(150, world.h-150),
          rx: rand(280, 1000),
          ry: rand(180, 650),
          angle: rand(0, TAU),
          alpha: rand(theme.nebulaAlpha[0], theme.nebulaAlpha[1]),
          col,
          parallax: 0.04,
        });
      }

      // Dust lane — long thin diagonal streak across the world
      dustParticles = [];
      const dc = theme.dustColor;
      const da = theme.dustAlpha;
      for (let i=0; i<5; i++){
        dustParticles.push({
          wx: rand(0, world.w), wy: rand(0, world.h),
          rx: rand(500, 1400), ry: rand(80, 300),
          angle: rand(-0.6, 0.6),
          alpha: rand(da*0.5, da),
          col: dc,
          parallax: 0.03,
        });
      }
    }

    function buildNebulaCanvas(zoom){
      const W = Math.ceil(world.w * zoom), H = Math.ceil(world.h * zoom);
      const oc = document.createElement('canvas');
      oc.width = W; oc.height = H;
      const cx2 = oc.getContext('2d');

      // Draw dust lanes first (underneath)
      for (const n of dustParticles){
        const px = n.wx * zoom, py = n.wy * zoom;
        const rx = n.rx * zoom, ry = n.ry * zoom;
        cx2.save();
        cx2.globalAlpha = n.alpha;
        cx2.translate(px, py);
        cx2.rotate(n.angle);
        const grd = cx2.createRadialGradient(0,0,0,0,0,rx);
        grd.addColorStop(0, `rgba(${n.col[0]},${n.col[1]},${n.col[2]},0.7)`);
        grd.addColorStop(0.5, `rgba(${n.col[0]},${n.col[1]},${n.col[2]},0.3)`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        cx2.scale(1, ry/rx);
        cx2.beginPath(); cx2.ellipse(0,0,rx,rx,0,0,TAU);
        cx2.fillStyle = grd; cx2.fill();
        cx2.restore();
      }

      // Nebulas on top
      for (const n of nebulas){
        const px = n.wx * zoom, py = n.wy * zoom;
        const rx = n.rx * zoom, ry = n.ry * zoom;
        cx2.save();
        cx2.globalAlpha = n.alpha;
        cx2.translate(px, py);
        cx2.rotate(n.angle);
        const grd = cx2.createRadialGradient(0,0,0,0,0,rx);
        grd.addColorStop(0,   `rgba(${n.col[0]},${n.col[1]},${n.col[2]},1.0)`);
        grd.addColorStop(0.4, `rgba(${n.col[0]},${n.col[1]},${n.col[2]},0.55)`);
        grd.addColorStop(1,   'rgba(0,0,0,0)');
        cx2.scale(1, ry/rx);
        cx2.beginPath(); cx2.arc(0,0,rx,0,TAU);
        cx2.fillStyle = grd; cx2.fill();
        cx2.restore();
      }
      return oc;
    }

    build(); // initial build

    return {
      get stars(){ return stars; },
      get nebulaCanvas(){ return nebulaCanvas; },
      get nebulaZoom(){ return nebulaZoom; },
      rebuild(){ build(); },
      rebuildNebula(zoom){
        nebulaCanvas = buildNebulaCanvas(zoom);
        nebulaZoom = zoom;
      },
    };
  })();

  // Screen-shake state
  const shake = { x:0, y:0, trauma:0 };
  function addTrauma(amount){ shake.trauma = clamp(shake.trauma + amount, 0, 1); }

  function updateShake(dt){
    shake.trauma = Math.max(0, shake.trauma - dt * 1.8);
    const mag = shake.trauma * shake.trauma * 18;
    shake.x = (Math.random()*2-1) * mag;
    shake.y = (Math.random()*2-1) * mag;
  }

  // ---------- Rendering ----------
  function drawBackground(){
    const rect = getFrameRect();
    const W = rect.width, H = rect.height;
    const theme = BG_THEMES[activeBgTheme];

    // Sky fill — use theme color
    ctx.fillStyle = theme.skyColor;
    ctx.fillRect(0, 0, W, H);

    // Nebulas + dust — composite pre-rendered offscreen canvas
    const zoomKey = Math.round(cam.zoom * 50) / 50; // quantize finer
    if (BG.nebulaZoom !== zoomKey) BG.rebuildNebula(zoomKey);
    if (BG.nebulaCanvas){
      const px = -(cam.x * (1 - 0.04)) * cam.zoom + W/2;
      const py = -(cam.y * (1 - 0.04)) * cam.zoom + H/2;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.85;
      ctx.drawImage(BG.nebulaCanvas, px, py);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Stars
    const t = world.time;
    ctx.save();
    for (const star of BG.stars){
      const px = (star.wx - cam.x) * (1 - star.parallax) * cam.zoom + W/2;
      const py = (star.wy - cam.y) * (1 - star.parallax) * cam.zoom + H/2;
      if (px < -8 || px > W+8 || py < -8 || py > H+8) continue;

      const twinkle = 0.6 + 0.4*Math.sin(t*star.twinkleSpeed + star.twinkle);
      const r = Math.max(0.4, star.r * cam.zoom * (0.85 + 0.15*twinkle));
      const [sr, sg, sb] = star.tint;

      // Bright spiked stars: draw 4-point cross
      if (star.spike && r > 1.5){
        const spikeLen = r * 5;
        ctx.globalAlpha = star.alpha * twinkle * 0.6;
        ctx.strokeStyle = `rgb(${sr},${sg},${sb})`;
        ctx.lineWidth = r * 0.4;
        ctx.beginPath();
        ctx.moveTo(px - spikeLen, py); ctx.lineTo(px + spikeLen, py);
        ctx.moveTo(px, py - spikeLen); ctx.lineTo(px, py + spikeLen);
        ctx.stroke();
        ctx.globalAlpha = star.alpha * twinkle;
        // Soft halo
        const haloR = r * 2.2;
        const hg = ctx.createRadialGradient(px,py,0,px,py,haloR);
        hg.addColorStop(0, `rgba(${sr},${sg},${sb},0.7)`);
        hg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(px, py, haloR, 0, TAU); ctx.fill();
      }

      ctx.globalAlpha = star.alpha * twinkle;
      ctx.fillStyle = `rgb(${sr},${sg},${sb})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawGrid(){
    const theme = BG_THEMES[activeBgTheme];
    const tc = theme.nebulaColors[0];
    const step = 220;
    const rect = getFrameRect();
    const left   = cam.x - rect.width  / (2*cam.zoom);
    const right  = cam.x + rect.width  / (2*cam.zoom);
    const top    = cam.y - rect.height / (2*cam.zoom);
    const bottom = cam.y + rect.height / (2*cam.zoom);
    const startX = Math.floor(left/step)*step;
    const startY = Math.floor(top/step)*step;
    const hw = rect.width/2, hh = rect.height/2;

    // Major grid lines
    ctx.globalAlpha = 0.06;
    ctx.lineWidth   = 1;
    ctx.strokeStyle = `rgba(${tc[0]},${tc[1]},${tc[2]},0.35)`;
    ctx.beginPath();
    for (let x=startX; x<right+step; x+=step){
      const ax = (x    - cam.x)*cam.zoom + hw;
      const ay = (top  - cam.y)*cam.zoom + hh;
      const by = (bottom - cam.y)*cam.zoom + hh;
      ctx.moveTo(ax, ay); ctx.lineTo(ax, by);
    }
    for (let y=startY; y<bottom+step; y+=step){
      const ax = (left  - cam.x)*cam.zoom + hw;
      const ay = (y     - cam.y)*cam.zoom + hh;
      const bx = (right - cam.x)*cam.zoom + hw;
      ctx.moveTo(ax, ay); ctx.lineTo(bx, ay);
    }
    ctx.stroke();

    // Sub-grid (minor lines) at 1/4 step, only when zoomed in enough
    if (cam.zoom > 0.45){
      const subStep = step / 4;
      const subStartX = Math.floor(left/subStep)*subStep;
      const subStartY = Math.floor(top/subStep)*subStep;
      ctx.globalAlpha = 0.025;
      ctx.strokeStyle = `rgba(${tc[0]},${tc[1]},${tc[2]},0.25)`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x=subStartX; x<right+subStep; x+=subStep){
        if (Math.abs(x % step) < 1) continue; // skip majors
        const ax = (x - cam.x)*cam.zoom + hw;
        ctx.moveTo(ax, (top - cam.y)*cam.zoom + hh);
        ctx.lineTo(ax, (bottom - cam.y)*cam.zoom + hh);
      }
      for (let y=subStartY; y<bottom+subStep; y+=subStep){
        if (Math.abs(y % step) < 1) continue;
        const ay = (y - cam.y)*cam.zoom + hh;
        ctx.moveTo((left - cam.x)*cam.zoom + hw, ay);
        ctx.lineTo((right - cam.x)*cam.zoom + hw, ay);
      }
      ctx.stroke();
    }

    // Grid intersection dots at major crossings
    if (cam.zoom > 0.3){
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = `rgba(${tc[0]},${tc[1]},${tc[2]},0.8)`;
      for (let x=startX; x<right+step; x+=step){
        for (let y=startY; y<bottom+step; y+=step){
          const ax = (x - cam.x)*cam.zoom + hw;
          const ay = (y - cam.y)*cam.zoom + hh;
          ctx.beginPath(); ctx.arc(ax, ay, 1.2, 0, TAU); ctx.fill();
        }
      }
    }

    ctx.globalAlpha = 1;
  }

  function drawShipSprite(ship){
    const rect = getFrameRect();

    // ── Frustum cull: skip entirely if not on screen ──
    const glowR = ship.radius * 1.8; // largest possible visual extent
    if (!isOnScreen(ship.pos.x, ship.pos.y, glowR, rect)) return;

    const def = ship.def;
    const rec = images.get(def.spriteKey);
    const sx = (ship.pos.x - cam.x) * cam.zoom + rect.width  / 2;
    const sy = (ship.pos.y - cam.y) * cam.zoom + rect.height / 2;
    const faction = FACTIONS[ship.faction] || FACTIONS.republic;
    const col = faction.tint;
    const spd = len(ship.vel);
    const warpAlpha = (ship._warp && ship._warp.active)
      ? clamp((ship._warp.t - 0.45) / 0.27, 0, 1) : 1;

    const screenR = ship.radius * cam.zoom;

    // ── Engine trail (no gradient creation when zoomed far out) ──
    if (spd > 20 && def.speed > 0 && cam.zoom > 0.18){
      const trailLen = clamp(spd * 0.55, 12, 80) * cam.zoom;
      const isCraft   = def.role === 'craft';
      const invSpd    = 1 / spd;
      const dirX = ship.vel.x * invSpd, dirY = ship.vel.y * invSpd;
      const tx = sx - dirX * trailLen, ty = sy - dirY * trailLen;
      const trailW = Math.max(2, ship.radius * 0.38) * cam.zoom;
      const ta = isCraft ? 0.55 : 0.38;
      const tc2 = getTrailColors(col);

      const grad = ctx.createLinearGradient(sx, sy, tx, ty);
      grad.addColorStop(0,   tc2.headA + ta + ')');
      grad.addColorStop(0.4, tc2.midA);
      grad.addColorStop(1,   tc2.tail);
      ctx.lineWidth   = trailW;
      ctx.lineCap     = 'round';
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }

    // ── Shield glow — pre-baked sprite, no radialGradient per frame ──
    const shieldFrac = ship.maxShields > 0 ? ship.shields / ship.maxShields : 0;
    if (shieldFrac > 0.05){
      const shieldR   = screenR * 1.45;
      const spriteSize = Math.max(4, Math.round(shieldR));
      const sprite     = getShieldSprite(spriteSize);
      const alpha      = shieldFrac * 0.18 + (ship._shieldFlash || 0) * 0.55;
      ctx.globalAlpha  = alpha;
      ctx.drawImage(sprite, sx - spriteSize, sy - spriteSize, spriteSize*2, spriteSize*2);
      ctx.globalAlpha  = 1;
    }
    if (ship._shieldFlash > 0) ship._shieldFlash = Math.max(0, ship._shieldFlash - 0.06);

    // ── Damage effects — fire particles, smoke, and sparks ──
    const hullFrac = ship.maxHull > 0 ? ship.hull / ship.maxHull : 1;

    if (hullFrac < 0.65 && cam.zoom > 0.12){
      const dmgSeverity = clamp((0.65 - hullFrac) / 0.65, 0, 1);
      const t = world.time;

      // ── Smoke wisps (dark puffs rising from damage points) ──
      if (hullFrac < 0.55 && cam.zoom > 0.14){
        const smokeCount = hullFrac < 0.25 ? 4 : 2;
        for (let i = 0; i < smokeCount; i++){
          const seed = ship.id * 3.7 + i * 2.13;
          const ox = Math.sin(seed * 1.3) * screenR * 0.45;
          const oy = Math.cos(seed * 0.9) * screenR * 0.3;
          const phase = ((t * 0.95 + i * 0.71) % 2.2) / 2.2;
          if (phase > 0.85) continue;
          const riseY = -phase * screenR * 2.2;
          const driftX = Math.sin(phase * 4.5 + seed) * screenR * 0.22;
          const smokeR = Math.max(2.5, screenR * (0.2 + phase * 0.55));
          const grey = 28 + Math.floor(phase * 38);
          const alpha = (1 - phase / 0.85) * 0.48 * dmgSeverity;
          ctx.globalAlpha = clamp(alpha, 0, 0.55);
          ctx.fillStyle = `rgb(${grey},${grey},${grey+5})`;
          ctx.beginPath();
          ctx.arc(sx + ox + driftX, sy + oy + riseY, smokeR, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // ── Realistic fire: multiple flame tongues per damage point ──
      if (hullFrac < 0.42 && cam.zoom > 0.13){
        // Number of independent fire sources scales with damage
        const fireSources = hullFrac < 0.2 ? 3 : hullFrac < 0.32 ? 2 : 1;
        ctx.save();

        for (let src = 0; src < fireSources; src++){
          const srcSeed = ship.id * 5.1 + src * 4.37;
          const srcOx = Math.sin(srcSeed * 1.1) * screenR * 0.38;
          const srcOy = Math.cos(srcSeed * 0.8) * screenR * 0.28;
          const bx = sx + srcOx, by = sy + srcOy;

          // Each source has 3-5 layered flame tongues
          const tongueCount = 3 + src;
          for (let ti = 0; ti < tongueCount; ti++){
            const tSeed = srcSeed + ti * 1.77;
            // Stagger phase so tongues don't all pulse together
            const phase = ((t * (1.8 + ti * 0.35 + src * 0.2) + tSeed) % 1.0);
            const flameH = screenR * (0.55 + ti * 0.18 + Math.sin(t * 7 + tSeed) * 0.12) * dmgSeverity;
            const flameW = screenR * (0.18 + ti * 0.04);
            const lean   = Math.sin(t * 2.1 + tSeed * 0.7) * flameW * 0.55; // wind lean

            // Flame drawn as a teardrop bezier path
            ctx.beginPath();
            ctx.moveTo(bx - flameW * 0.5, by);
            ctx.bezierCurveTo(
              bx - flameW + lean * 0.3, by - flameH * 0.35,
              bx + lean,                by - flameH * 0.9,
              bx + lean * 0.8,          by - flameH        // tip
            );
            ctx.bezierCurveTo(
              bx + lean * 0.4,          by - flameH * 0.9,
              bx + flameW + lean * 0.3, by - flameH * 0.35,
              bx + flameW * 0.5,        by
            );
            ctx.closePath();

            // Inner gradient: white-yellow core → orange mid → transparent red tip
            // We approximate with globalAlpha + fillStyle layers
            const pBase = 0.65 - phase * 0.65; // brightness 0..0.65
            const hotness = 1 - (ti / tongueCount) * 0.4; // inner tongues hotter
            const rC = 255;
            const gC = Math.floor(clamp(200 * hotness - phase * 160, 30, 230));
            const bC = Math.floor(clamp(60 * hotness - phase * 80, 0, 80));
            const alpha = clamp(pBase * dmgSeverity * (0.55 + hotness * 0.4), 0, 0.88);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = `rgb(${rC},${gC},${bC})`;
            ctx.fill();

            // Bright inner core (white-yellow) on top for depth
            if (hotness > 0.6 && flameH > 4){
              const coreH = flameH * 0.38;
              const coreW = flameW * 0.35;
              ctx.beginPath();
              ctx.moveTo(bx - coreW * 0.5, by);
              ctx.bezierCurveTo(
                bx - coreW + lean * 0.2, by - coreH * 0.4,
                bx + lean * 0.5,         by - coreH * 0.85,
                bx + lean * 0.6,         by - coreH
              );
              ctx.bezierCurveTo(
                bx + lean * 0.3,         by - coreH * 0.85,
                bx + coreW + lean * 0.2, by - coreH * 0.4,
                bx + coreW * 0.5,        by
              );
              ctx.closePath();
              ctx.globalAlpha = clamp(alpha * 0.7, 0, 0.7);
              ctx.fillStyle = `rgb(255,${Math.floor(235 + gC * 0.08)},${Math.floor(120 + bC)})`;
              ctx.fill();
            }
          }
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // ── Electrical sparks for critically damaged ships ──
      if (hullFrac < 0.22 && cam.zoom > 0.18){
        const sparkCycle = (t * 4.2 + ship.id * 1.3) % 1.0;
        if (sparkCycle < 0.35){
          const sparkCount = 3 + Math.floor(dmgSeverity * 4);
          ctx.save();
          for (let i = 0; i < sparkCount; i++){
            const ang = rand(0, TAU);
            const dist = rand(0.05, 0.9) * screenR;
            const sLen = rand(2.5, 8) * cam.zoom;
            const ex = sx + Math.cos(ang) * dist;
            const ey = sy + Math.sin(ang) * dist;
            const fade = 1 - sparkCycle / 0.35;
            ctx.globalAlpha = fade * 0.9;
            // Branching: draw main spark + 1 branch
            const ang2 = ang + rand(-1.1, 1.1);
            ctx.strokeStyle = Math.random() < 0.55 ? 'rgba(200,225,255,1)' : 'rgba(255,240,100,1)';
            ctx.lineWidth = Math.random() < 0.4 ? 1.8 : 1.0;
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex + Math.cos(ang2) * sLen, ey + Math.sin(ang2) * sLen);
            ctx.stroke();
            if (Math.random() < 0.5){
              ctx.lineWidth = 0.7;
              ctx.beginPath();
              ctx.moveTo(ex + Math.cos(ang2) * sLen * 0.5, ey + Math.sin(ang2) * sLen * 0.5);
              ctx.lineTo(ex + Math.cos(ang2 + rand(-0.8, 0.8)) * sLen * 0.7,
                         ey + Math.sin(ang2 + rand(-0.8, 0.8)) * sLen * 0.7);
              ctx.stroke();
            }
          }
          ctx.restore();
          ctx.globalAlpha = 1;
        }

        // Pulsing red warning aura
        const pulse = 0.10 + 0.08 * Math.sin(t * 9 + ship.id * 0.5);
        const critR = Math.max(3, Math.round(screenR * 1.25));
        const critSprite = getGlowSprite(255, 20, 20, critR);
        ctx.globalAlpha = pulse;
        ctx.drawImage(critSprite, sx - critR, sy - critR, critR*2, critR*2);
        ctx.globalAlpha = 1;
      }

      // ── Base orange damage glow (pre-baked sprite underneath everything) ──
      if (hullFrac < 0.38 && cam.zoom > 0.13){
        const baseAlpha = (0.38 - hullFrac) / 0.38 * 0.35 * (0.78 + 0.22 * Math.sin(t * 5.5 + ship.id));
        const fireR = screenR * 1.0;
        const spriteSize = Math.max(4, Math.round(fireR));
        const sprite = getFireSprite(spriteSize);
        ctx.globalAlpha = clamp(baseAlpha, 0, 0.5);
        ctx.drawImage(sprite, sx - spriteSize, sy - spriteSize, spriteSize*2, spriteSize*2);
        ctx.globalAlpha = 1;
      }
    }

    // ── Main ship body ──
    if (rec && rec.ok){
      const img = rec.img;
      const w = screenR * 2.4;
      const h = w * (rec.h / rec.w);
      const facingLeft = ship.vel.x < -8;

      // Glow: draw the pre-baked faction glow sprite underneath instead of shadowBlur
      if (cam.zoom > 0.25){
        const gs = Math.max(4, Math.round(w * 0.85));
        const gsp = getGlowSprite(col[0], col[1], col[2], gs);
        ctx.globalAlpha = 0.45 * warpAlpha;
        ctx.drawImage(gsp, sx - gs, sy - gs, gs*2, gs*2);
        ctx.globalAlpha = 1;
      }

      ctx.globalAlpha = warpAlpha;
      if (facingLeft){
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(-1, 1);
        ctx.drawImage(img, -w/2, -h/2, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(img, sx - w/2, sy - h/2, w, h);
      }
      ctx.globalAlpha = 1;

    } else {
      // ── Vector fallback (craft / large ships) ──
      ctx.save();
      ctx.globalAlpha = 0.92 * warpAlpha;

      if (def.role === 'craft'){
        const r = screenR * 1.9;
        const facingLeft = ship.vel.x < -8;
        ctx.translate(sx, sy);
        if (facingLeft) ctx.scale(-1, 1);
        ctx.rotate(ship.angle);

        // Glow sprite instead of shadowBlur
        if (cam.zoom > 0.2){
          const gs = Math.max(4, Math.round(r * 1.8));
          const gsp = getGlowSprite(col[0], col[1], col[2], gs);
          ctx.globalAlpha = 0.6 * warpAlpha;
          ctx.drawImage(gsp, -gs, -gs, gs*2, gs*2);
          ctx.globalAlpha = 0.92 * warpAlpha;
        }

        ctx.beginPath();
        if (def.craft === 'bomber'){
          ctx.moveTo(r*0.9,0); ctx.lineTo(r*0.1,r*0.65); ctx.lineTo(-r*0.7,r*0.4);
          ctx.lineTo(-r*0.5,0); ctx.lineTo(-r*0.7,-r*0.4); ctx.lineTo(r*0.1,-r*0.65);
        } else if (def.craft === 'shuttle'){
          ctx.moveTo(r,0); ctx.lineTo(-r*0.5,r*0.6); ctx.lineTo(-r*0.2,0); ctx.lineTo(-r*0.5,-r*0.6);
        } else if (def.craft === 'drone'){
          ctx.moveTo(r*0.85,0); ctx.lineTo(r*0.1,r*0.45); ctx.lineTo(-r*0.5,0); ctx.lineTo(r*0.1,-r*0.45);
        } else if (def.craft === 'interceptor'){
          ctx.moveTo(r,0); ctx.lineTo(-r*0.3,r*0.32); ctx.lineTo(-r*0.6,r*0.18);
          ctx.lineTo(-r*0.55,0); ctx.lineTo(-r*0.6,-r*0.18); ctx.lineTo(-r*0.3,-r*0.32);
        } else {
          ctx.moveTo(r,0); ctx.lineTo(-r*0.4,r*0.6); ctx.lineTo(-r*0.55,r*0.25);
          ctx.lineTo(-r*0.45,0); ctx.lineTo(-r*0.55,-r*0.25); ctx.lineTo(-r*0.4,-r*0.6);
        }
        ctx.closePath();

        const vc = getVecColors(col);
        const fillGrad = ctx.createLinearGradient(-r, 0, r, 0);
        fillGrad.addColorStop(0,   vc.fill0);
        fillGrad.addColorStop(0.6, vc.fill06);
        fillGrad.addColorStop(1,   vc.fill1);
        ctx.fillStyle   = fillGrad;
        ctx.fill();
        ctx.strokeStyle = vc.stroke;
        ctx.lineWidth   = 1.5;
        ctx.stroke();

      } else {
        // Large ship vector ellipse
        const facingLeft = ship.vel.x < -8;
        ctx.translate(sx, sy);
        if (facingLeft) ctx.scale(-1, 1);
        ctx.rotate(ship.angle);

        const rw = screenR * 1.4, rh = screenR * 0.7;

        // Glow sprite instead of shadowBlur
        if (cam.zoom > 0.2){
          const gs = Math.max(4, Math.round(rw * 1.6));
          const gsp = getGlowSprite(col[0], col[1], col[2], gs);
          ctx.globalAlpha = 0.4 * warpAlpha;
          ctx.drawImage(gsp, -gs, -gs, gs*2, gs*2);
          ctx.globalAlpha = 0.92 * warpAlpha;
        }

        const vc2 = getVecColors(col);
        const bodyGrad = ctx.createLinearGradient(-rw, 0, rw, 0);
        bodyGrad.addColorStop(0,   vc2.body0);
        bodyGrad.addColorStop(0.5, vc2.body05);
        bodyGrad.addColorStop(1,   vc2.body1);
        ctx.beginPath();
        ctx.ellipse(0, 0, rw, rh, 0, 0, TAU);
        ctx.fillStyle   = bodyGrad;
        ctx.fill();
        ctx.strokeStyle = vc2.bodyStroke;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── Selection ring (no shadowBlur — use opacity instead) ──
    if (ship.selected){
      const selR = screenR * 1.55;
      ctx.save();
      ctx.lineWidth      = 2;
      ctx.setLineDash([8*cam.zoom, 5*cam.zoom]);
      ctx.lineDashOffset = -world.time * 40;
      ctx.strokeStyle    = `rgba(${col[0]},${col[1]},${col[2]},0.9)`;
      ctx.globalAlpha    = 0.9;
      ctx.beginPath();
      ctx.arc(sx, sy, selR, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── Health bars — skip when zoomed too far out ──
    if (cam.zoom >= 0.28){
      const barW = Math.max(36, ship.radius * 1.6) * cam.zoom;
      const barH = 4;
      const x0   = sx - barW / 2;
      const y0   = sy - screenR * 1.18 - 14;
      const sFrac = clamp(shieldFrac, 0, 1);
      const hFrac = clamp(hullFrac,   0, 1);
      const grads = getHBGrads(barW, x0);
      const isCritical = hullFrac < 0.22;

      // Use a transform so gradient coords (0..barW) line up with bar position
      ctx.save();
      ctx.translate(x0, 0);
      ctx.globalAlpha = 0.95;

      // Subtle backdrop for the whole bar group
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.beginPath(); ctx.roundRect(-2, y0-2, barW+4, (barH+3)*2+1, 4); ctx.fill();

      // Shield bar
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.roundRect(0, y0, barW, barH, 2); ctx.fill();
      if (sFrac > 0){
        ctx.fillStyle = grads.g_shield;
        ctx.beginPath(); ctx.roundRect(0, y0, barW*sFrac, barH, 2); ctx.fill();
      }

      // Hull bar
      const hullY = y0 + barH + 3;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.roundRect(0, hullY, barW, barH, 2); ctx.fill();
      if (hFrac > 0){
        // Critical: pulsing red fill
        if (isCritical){
          const pulse = 0.75 + 0.25 * Math.sin(world.time * 10 + ship.id * 0.3);
          ctx.globalAlpha = 0.95 * pulse;
        }
        ctx.fillStyle = hFrac > 0.5 ? grads.g_hp_high : hFrac > 0.25 ? grads.g_hp_mid : grads.g_hp_low;
        ctx.beginPath(); ctx.roundRect(0, hullY, barW*hFrac, barH, 2); ctx.fill();
        ctx.globalAlpha = 0.95;
      }

      // Critical warning — thin red border flash around entire bar
      if (isCritical){
        const bPulse = 0.5 + 0.5 * Math.sin(world.time * 9 + ship.id * 0.3);
        ctx.strokeStyle = `rgba(255,60,60,${0.55 * bPulse})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(-1.5, y0-1.5, barW+3, (barH+3)*2+1, 4); ctx.stroke();
      }

      ctx.restore();
    }
  }

  function drawProjectiles(){
    if (!world.projectiles.length) return;
    const rect = getFrameRect();
    const CULL_PAD = 18;
    ctx.save();
    ctx.lineCap = 'round';

    // Pre-built colour strings — avoids template-literal allocation per projectile per frame
    // Layout: [trailHead, trailMid(auraA*1.1), coreStr, fillStr, auraStr]
    const PROJ_COLORS = {
      special: {
        cR:215, cG:248, cB:255, coreR:2.4, trailMult:8.0, auraR:4.2, auraA:0.38,
        trailHead:'rgba(215,248,255,0.95)',
        trailMid: `rgba(215,248,255,${(0.38*1.1).toFixed(3)})`,
        coreStr:  'rgba(255,255,255,1)',
        auraStr:  'rgba(215,248,255,0.55)',
      },
      plasma: {
        cR:255, cG:155, cB:50,  coreR:1.3, trailMult:3.8, auraR:2.6, auraA:0.25,
        trailHead:'rgba(255,155,50,0.95)',
        trailMid: `rgba(255,155,50,${(0.25*1.1).toFixed(3)})`,
        coreStr:  'rgba(255,195,90,1)',
        auraStr:  'rgba(255,155,50,0.55)',
      },
      ion: {
        cR:70,  cG:210, cB:255, coreR:1.2, trailMult:4.5, auraR:2.4, auraA:0.28,
        trailHead:'rgba(70,210,255,0.95)',
        trailMid: `rgba(70,210,255,${(0.28*1.1).toFixed(3)})`,
        coreStr:  'rgba(110,250,255,1)',
        auraStr:  'rgba(70,210,255,0.55)',
      },
      kinetic: {
        cR:235, cG:242, cB:255, coreR:1.0, trailMult:2.4, auraR:1.7, auraA:0.14,
        trailHead:'rgba(235,242,255,0.95)',
        trailMid: `rgba(235,242,255,${(0.14*1.1).toFixed(3)})`,
        coreStr:  'rgba(255,255,255,1)',
        auraStr:  'rgba(235,242,255,0.55)',
      },
    };

    for (const p of world.projectiles){
      const sx = (p.pos.x - cam.x) * cam.zoom + rect.width  / 2;
      const sy = (p.pos.y - cam.y) * cam.zoom + rect.height / 2;
      if (sx < -CULL_PAD || sx > rect.width+CULL_PAD || sy < -CULL_PAD || sy > rect.height+CULL_PAD) continue;

      const r    = p.radius * cam.zoom;
      const spd  = len(p.vel);
      const invS = spd > 0 ? 1/spd : 0;
      const dX   = p.vel.x * invS, dY = p.vel.y * invS;

      // Per-type visual profile — use pre-built strings
      const pc = p.special ? PROJ_COLORS.special
               : p.type === 'plasma' ? PROJ_COLORS.plasma
               : p.type === 'ion'    ? PROJ_COLORS.ion
               :                       PROJ_COLORS.kinetic;
      const { cR, cG, cB, coreR, trailMult, auraR, auraA } = pc;

      const tLen = clamp(spd * 0.040, 0.9, 2.8) * r * trailMult;
      const tx   = sx - dX * tLen, ty = sy - dY * tLen;

      // Soft outer aura halo — draw before trail so it sits underneath
      if (cam.zoom > 0.18 && auraA > 0){
        const aR = r * auraR;
        if (p.special){
          const gs  = Math.max(4, Math.round(aR * 1.8));
          const gsp = getGlowSprite(cR, cG, cB, gs);
          ctx.globalAlpha = 0.50;
          ctx.drawImage(gsp, sx-gs, sy-gs, gs*2, gs*2);
          ctx.globalAlpha = 1;
        } else {
          ctx.globalAlpha = auraA;
          ctx.fillStyle   = pc.auraStr;
          ctx.beginPath(); ctx.arc(sx, sy, aR, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // Trail: gradient from bright core → transparent tail
      const tg = ctx.createLinearGradient(sx, sy, tx, ty);
      tg.addColorStop(0,    pc.trailHead);
      tg.addColorStop(0.28, pc.trailMid);
      tg.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.strokeStyle = tg;
      ctx.lineWidth   = r * (p.special ? 3.2 : 2.1);
      ctx.globalAlpha = 0.90;
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(tx,ty); ctx.stroke();
      ctx.globalAlpha = 1;

      // Bright core dot
      ctx.fillStyle = pc.coreStr;
      ctx.beginPath(); ctx.arc(sx, sy, r * coreR, 0, TAU); ctx.fill();

      // Ion: pulsing ring halo
      if (p.type === 'ion' && !p.special && cam.zoom > 0.25){
        const pulse = 0.5 + 0.5 * Math.sin(world.time * 20 + p.pos.x * 0.008);
        ctx.globalAlpha = 0.45 * pulse;
        ctx.strokeStyle = 'rgba(140,235,255,0.9)';
        ctx.lineWidth   = 0.9;
        ctx.beginPath(); ctx.arc(sx, sy, r * 2.1, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }

  // Floating damage numbers
  const floatTexts = [];
  function spawnDmgText(x, y, amount, type){
    if (world.ships.length > 100) return; // skip in large battles to save draw calls
    const col = type === 'ion' ? '#88eeff' : (type === 'plasma' ? '#ffaa44' : '#ffffff');
    floatTexts.push({ wx:x, wy:y, text: Math.round(amount).toString(), col, t:0, dur:1.1, vy:-28 });
  }

  function drawFloatTexts(){
    if (!floatTexts.length) return;
    const rect = getFrameRect();
    ctx.save();
    ctx.textAlign = 'center';
    for (const ft of floatTexts){
      const sx = (ft.wx - cam.x) * cam.zoom + rect.width  / 2;
      const sy = (ft.wy - cam.y) * cam.zoom + rect.height / 2;
      if (sx < -50 || sx > rect.width+50 || sy < -50 || sy > rect.height+50) continue;
      const t     = ft.t / ft.dur;
      const alpha = t < 0.3 ? t/0.3 : 1-(t-0.3)/0.7;
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.font        = `bold ${Math.round(10 + 4*(1-t))}px ui-sans-serif`;
      ctx.fillStyle   = ft.col;
      ctx.fillText(ft.text, sx, sy - ft.t * ft.vy * 0.016);
    }
    ctx.restore();
  }

  function drawEffects(dt){
    const rect = getFrameRect();

    for (const e of world.effects){
      e.t += dt;
      const t  = clamp(e.t / e.dur, 0, 1);
      const sx = (e.x - cam.x) * cam.zoom + rect.width  / 2;
      const sy = (e.y - cam.y) * cam.zoom + rect.height / 2;

      // Frustum cull effects
      const effR = (e.scale || e.radius || 60) * cam.zoom * 3.5;
      if (sx + effR < 0 || sx - effR > rect.width ||
          sy + effR < 0 || sy - effR > rect.height) continue;

      if (e.kind === 'explosion'){
        const k  = 1 - t;
        const r1 = e.scale * cam.zoom * (0.12 + t * 1.65);

        // Expanding smoke cloud (appears after fireball starts fading)
        if (t > 0.18 && e.scale * cam.zoom > 6){
          const sR = e.scale * cam.zoom * (0.5 + t * 3.0);
          ctx.globalAlpha = 0.16 * k * k;
          ctx.fillStyle = 'rgba(70,55,45,0.8)';
          ctx.beginPath(); ctx.arc(sx, sy, sR, 0, TAU); ctx.fill();
        }

        // Core fireball
        ctx.save();
        ctx.globalAlpha = 0.92 * k * k;
        const fg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r1);
        fg.addColorStop(0,   'rgba(255,255,220,1)');
        fg.addColorStop(0.18,'rgba(255,230,100,0.98)');
        fg.addColorStop(0.45,'rgba(255,110,20,0.85)');
        fg.addColorStop(0.75,'rgba(190,45,10,0.50)');
        fg.addColorStop(1,   'rgba(60,20,10,0)');
        ctx.beginPath(); ctx.arc(sx, sy, r1, 0, TAU);
        ctx.fillStyle = fg; ctx.fill();
        ctx.restore();

        // Primary shockwave ring
        if (t > 0.04){
          const shockR = e.scale * cam.zoom * (0.45 + t * 2.5);
          ctx.globalAlpha = 0.60 * k * k;
          ctx.strokeStyle = `rgba(255,185,75,${0.8*k})`;
          ctx.lineWidth   = 3.5 * cam.zoom * k;
          ctx.beginPath(); ctx.arc(sx, sy, shockR, 0, TAU); ctx.stroke();
          // Secondary thinner ring slightly behind
          if (t < 0.65){
            const shockR2 = e.scale * cam.zoom * (0.2 + t * 1.4);
            ctx.globalAlpha = 0.30 * (1-t/0.65);
            ctx.strokeStyle = 'rgba(255,240,180,0.9)';
            ctx.lineWidth   = 1.8 * cam.zoom;
            ctx.beginPath(); ctx.arc(sx, sy, shockR2, 0, TAU); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }

        // Debris chunks
        if (!e.debris){
          e.debris = [];
          const cnt = Math.min(18, Math.max(4, Math.floor(e.scale / 7)));
          for (let i=0; i<cnt; i++){
            const ang = rand(0,TAU), spd2 = rand(45,200)*cam.zoom;
            e.debris.push({ x:sx, y:sy, vx:Math.cos(ang)*spd2, vy:Math.sin(ang)*spd2,
              r: rand(1.2,5)*cam.zoom, life: rand(0.3, e.dur*0.88), hot: Math.random()<0.55 });
          }
        }
        for (const d of e.debris){
          if (e.t > d.life) continue;
          const df = e.t / d.life;
          d.x += d.vx*dt*0.5; d.y += d.vy*dt*0.5;
          d.vx *= 0.965; d.vy *= 0.965;
          ctx.globalAlpha = (1-df)*0.92;
          ctx.fillStyle = d.hot ? (df<0.4?'#ffe855':df<0.7?'#ff7722':'#cc3311') : (df<0.5?'#ff9933':'#aa3311');
          ctx.beginPath(); ctx.arc(d.x, d.y, d.r*(1-df*0.55), 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;

      } else if (e.kind === 'charge'){
        const k = 1 - t;
        const faction = FACTIONS[e.factionId] || FACTIONS.republic;
        const c = faction.tint;
        const r = (e.scale||40)*cam.zoom*(0.3+t*0.8);
        for (let i=0; i<2; i++){
          ctx.globalAlpha = 0.65*k*(i===0?1:0.5);
          ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},0.9)`;
          ctx.lineWidth   = (3-i)*1.5;
          ctx.beginPath(); ctx.arc(sx, sy, r*(1+i*0.3), 0, TAU); ctx.stroke();
        }
        ctx.globalAlpha = 1;

      } else if (e.kind === 'hit'){
        const k  = 1 - t;
        const r  = 20*cam.zoom*(0.32+t*0.95);
        const cStr = e.type==='ion' ? '90,215,255' : (e.type==='plasma' ? '255,138,35' : '235,242,255');
        const cFill = e.type==='ion' ? '#aaeeff' : (e.type==='plasma' ? '#ffdd88' : '#ffffff');
        // Expanding ring
        ctx.globalAlpha = 0.88*k;
        ctx.strokeStyle = `rgba(${cStr},0.95)`;
        ctx.lineWidth   = 2.5;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.stroke();
        // Bright core flash (early only)
        if (t < 0.28){
          ctx.globalAlpha = (1-t/0.28)*0.95;
          ctx.fillStyle   = cFill;
          ctx.beginPath(); ctx.arc(sx, sy, r*0.42, 0, TAU); ctx.fill();
        }
        // Spark streaks radiating outward
        if (!e.sparks){
          const n = e.type==='plasma' ? 7 : (e.type==='ion' ? 5 : 4);
          e.sparks = Array.from({length:n}, ()=>({
            a: rand(0,TAU), spd: rand(38,110)*cam.zoom, len: rand(4,11)*cam.zoom
          }));
        }
        ctx.globalAlpha = 0.82*k;
        ctx.strokeStyle = cFill;
        ctx.lineWidth   = 1.3;
        for (const sp of e.sparks){
          const dist = sp.spd * e.t;
          const ex = sx + Math.cos(sp.a)*dist, ey = sy + Math.sin(sp.a)*dist;
          ctx.beginPath(); ctx.moveTo(ex - Math.cos(sp.a)*sp.len, ey - Math.sin(sp.a)*sp.len);
          ctx.lineTo(ex, ey); ctx.stroke();
        }
        ctx.globalAlpha = 1;

      } else if (e.kind === 'shieldHit'){
        const k    = 1-t;
        const base = (e.scale||40)*cam.zoom;
        const r    = base*(0.88+t*0.65);
        // Primary ring
        ctx.globalAlpha = 0.80*k;
        ctx.strokeStyle = `rgba(110,195,255,0.95)`;
        ctx.lineWidth   = 3.8*k;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.stroke();
        // Inner blue-white fill flash (first 25% of lifetime)
        if (t < 0.25){
          const fa = (1-t/0.25)*0.28*k;
          ctx.globalAlpha = fa;
          ctx.fillStyle   = 'rgba(150,220,255,0.9)';
          ctx.beginPath(); ctx.arc(sx, sy, r*0.82, 0, TAU); ctx.fill();
        }
        // Second outer ring expands later
        if (t > 0.10){
          const r2 = base*(1.45 + (t-0.10)*0.90);
          ctx.globalAlpha = 0.32*k*k;
          ctx.strokeStyle = 'rgba(80,160,255,0.85)';
          ctx.lineWidth   = 2*k;
          ctx.beginPath(); ctx.arc(sx, sy, r2, 0, TAU); ctx.stroke();
        }
        ctx.globalAlpha = 1;

      } else if (e.kind === 'repair'){
        const k  = 1 - t;
        const br = (e.radius || 25) * cam.zoom;
        for (let i = 0; i < 3; i++){
          const ph = (t + i * 0.3) % 1;
          ctx.globalAlpha = (1 - ph) * 0.75 * k;
          ctx.strokeStyle = 'rgba(50,220,120,0.9)';
          ctx.lineWidth   = 2;
          ctx.beginPath(); ctx.arc(sx, sy, br * (0.3 + ph * 1.5), 0, TAU); ctx.stroke();
        }
        ctx.globalAlpha = 0.9 * k;
        ctx.strokeStyle = '#66ffbb';
        ctx.lineWidth   = 2.5;
        const cs = br * 0.38;
        ctx.beginPath(); ctx.moveTo(sx-cs,sy); ctx.lineTo(sx+cs,sy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx,sy-cs); ctx.lineTo(sx,sy+cs); ctx.stroke();
        ctx.globalAlpha = 1;

      } else if (e.kind === 'warpIn'){
        const faction = FACTIONS[e.factionId] || FACTIONS.republic;
        const c       = faction.tint;
        const baseR   = (e.radius || 20) * cam.zoom;
        const phase1  = Math.min(t / 0.45, 1);
        const phase2  = t > 0.45 ? (t - 0.45) / 0.55 : 0;

        // Streak (phase 1)
        const streakAlpha = phase1 < 1 ? 0.85 * (1 - phase1 * 0.5) : 0;
        if (streakAlpha > 0.01){
          const streakH = baseR * (14 * (1 - phase1) + 1.2);
          const streakW = baseR * 0.55 * (1 - phase1 * 0.7);
          const streakY = sy - streakH * (1 - phase1);
          const sg = ctx.createLinearGradient(sx, streakY - streakH, sx, sy);
          sg.addColorStop(0,   'rgba(255,255,255,0)');
          sg.addColorStop(0.5, `rgba(${Math.min(255,c[0]+80)},${Math.min(255,c[1]+80)},255,0.6)`);
          sg.addColorStop(1,   `rgba(255,255,255,${streakAlpha})`);
          ctx.globalAlpha = streakAlpha;
          ctx.fillStyle   = sg;
          ctx.beginPath(); ctx.ellipse(sx, streakY, streakW, streakH, 0, 0, TAU); ctx.fill();
        }

        // Arrival ring flash (phase 2)
        if (phase2 > 0){
          const ringR     = baseR * (1.0 + phase2 * 2.8);
          const ringAlpha = (1 - phase2) * 0.9;
          ctx.globalAlpha = ringAlpha;
          ctx.strokeStyle = `rgba(${Math.min(255,c[0]+60)},${Math.min(255,c[1]+80)},255,1)`;
          ctx.lineWidth   = (3 - phase2 * 2) * cam.zoom;
          ctx.beginPath(); ctx.arc(sx, sy, ringR, 0, TAU); ctx.stroke();
          ctx.globalAlpha = ringAlpha * 0.4;
          ctx.fillStyle   = 'rgba(200,230,255,0.6)';
          ctx.beginPath(); ctx.arc(sx, sy, baseR * (1.5 - phase2), 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    // Float texts — update, cap at 80, draw
    for (const ft of floatTexts) ft.t += dt;
    let wi = 0;
    for (let ri = 0; ri < floatTexts.length; ri++){
      if (floatTexts[ri].t < floatTexts[ri].dur) floatTexts[wi++] = floatTexts[ri];
    }
    floatTexts.length = Math.min(wi, 80);
    drawFloatTexts();

    // Cull expired effects in-place, hard cap at 200
    wi = 0;
    for (let ri = 0; ri < world.effects.length; ri++){
      if (world.effects[ri].t < world.effects[ri].dur) world.effects[wi++] = world.effects[ri];
    }
    world.effects.length = Math.min(wi, 200);
  }

  const CAM_PAN_SPEED = 340; // world units per second
  const EDGE_ZONE     = 30;  // pixels from edge to trigger scroll

  function updateCameraPan(dt){
    const spd = CAM_PAN_SPEED / cam.zoom;
    if (input.camL) cam.x = clamp(cam.x - spd*dt, 0, world.w);
    if (input.camR) cam.x = clamp(cam.x + spd*dt, 0, world.w);
    if (input.camU) cam.y = clamp(cam.y - spd*dt, 0, world.h);
    if (input.camD) cam.y = clamp(cam.y + spd*dt, 0, world.h);
  }

  function updateEdgeScroll(dt){
    const rect = getFrameRect();
    const mx = input.mouseLocal.x, my = input.mouseLocal.y;
    // Don't edge-scroll if mouse is outside canvas entirely
    if (mx < 0 || my < 0 || mx > rect.width || my > rect.height) return;
    const spd = CAM_PAN_SPEED * 0.85 / cam.zoom;
    if (mx < EDGE_ZONE) cam.x = clamp(cam.x - spd*dt*(1-mx/EDGE_ZONE), 0, world.w);
    else if (mx > rect.width  - EDGE_ZONE) cam.x = clamp(cam.x + spd*dt*(1-(rect.width -mx)/EDGE_ZONE), 0, world.w);
    if (my < EDGE_ZONE) cam.y = clamp(cam.y - spd*dt*(1-my/EDGE_ZONE), 0, world.h);
    else if (my > rect.height - EDGE_ZONE) cam.y = clamp(cam.y + spd*dt*(1-(rect.height-my)/EDGE_ZONE), 0, world.h);
  }

  function drawTooltip(){
    const ship = input.hoveredShip;
    if (!ship || !ship.isAlive()) return;
    const s       = worldToScreen(ship.pos.x, ship.pos.y);
    const rect    = getFrameRect();
    const def     = ship.def;
    const faction = FACTIONS[ship.faction] || FACTIONS.republic;
    const col     = faction.tint;
    const hFrac   = ship.hull / ship.maxHull;

    const TYPE_COL = { ion:'#55ccff', plasma:'#ff9944', kinetic:'#aabbcc' };

    const lines = [
      { text: def.name,     bold:true,  color:`rgb(${col[0]},${col[1]},${col[2]})` },
      { text: faction.name, bold:false, color:'#7888aa' },
      { text: '─────────────────────────────', bold:false, color:'#1e2d44' },
      { text: `Shields ${Math.ceil(ship.shields)} / ${ship.maxShields}`,
        bold:false, color:'#5599ff' },
      { text: `Hull    ${Math.ceil(ship.hull)} / ${ship.maxHull}`,
        bold:false, color: hFrac > 0.6 ? '#33dd88' : hFrac > 0.3 ? '#ffcc33' : '#ff4444' },
      { text: `Role: ${def.role}${def.craft?' · '+def.craft:''}   Speed: ${def.speed}   Mass: ${def.mass}`,
        bold:false, color:'#556688' },
    ];

    // Hangar summary if this ship has one
    const hangar = getHangarDef(ship);
    if (hangar && hangar.length){
      lines.push({ text:'─────────────────────────────', bold:false, color:'#1e2d44' });
      lines.push({ text:'HANGAR', bold:true, color:'#66ffcc' });
      for (const slot of hangar){
        const cd = DEF_BY_KEY.get(slot.craftKey);
        const nm = cd ? cd.name.replace(/^(Republican|Imperial|Remnant|CSN)\s/,'') : slot.craftKey;
        lines.push({ text:`  ${nm}  ×${slot.max}  (wave ${slot.wave})`, bold:false, color:'#55bb99' });
      }
    }

    // Full weapon specs — every gun
    if (def.weapons && def.weapons.length){
      lines.push({ text:'─────────────────────────────', bold:false, color:'#1e2d44' });
      lines.push({ text:'WEAPONS', bold:true, color:'#ffddaa' });
      for (const w of def.weapons){
        const tc    = w.special ? '#cc88ff' : (TYPE_COL[w.type] || '#aabbcc');
        const dps   = (w.dmg / w.cooldown).toFixed(1);
        const star  = w.special ? ' ★' : '';
        const flags = [
          w.pierceShields  ? '⚡pierce'  : '',
          w.breachShields  ? '🔥breach'  : '',
          w.usesMax        ? `${w.usesMax}use` : '',
          w.windup         ? `${w.windup}sw`   : '',
        ].filter(Boolean).join(' ');
        lines.push({ text: `⚙ ${w.name}${star}`, bold:true, color: tc });
        lines.push({ text: `  ${w.type.toUpperCase()}  ${w.dmg}dmg  ${dps}DPS  rng:${Math.round(w.range)}  cd:${w.cooldown}s${flags?' · '+flags:''}`,
          bold:false, color:'#99aabf' });
      }
    }

    const fs = 10.5, lh = 14, padX = 10, padY = 8, W = 290;
    const H  = lines.length * lh + padY * 2;
    let tx = s.x + ship.radius * cam.zoom + 12;
    let ty = s.y - H / 2;
    if (tx + W > rect.width - 8) tx = s.x - ship.radius * cam.zoom - W - 12;
    ty = clamp(ty, 4, rect.height - H - 4);

    ctx.save();
    ctx.fillStyle   = 'rgba(3,7,18,0.96)';
    ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},0.5)`;
    ctx.lineWidth   = 1;
    ctx.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},0.2)`;
    ctx.shadowBlur  = 12;
    ctx.beginPath(); ctx.roundRect(tx, ty, W, H, 6); ctx.fill(); ctx.stroke();
    ctx.shadowBlur  = 0;

    ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++){
      const L = lines[i];
      ctx.font      = `${L.bold ? 'bold ' : ''}${fs}px ui-sans-serif,system-ui`;
      ctx.fillStyle = L.color;
      ctx.fillText(L.text, tx + padX, ty + padY + i * lh);
    }
    ctx.restore();
  }

  function drawWarpModeHint(){
    if (!input.keyW || !selectedShips().length) return;
    const rect = getFrameRect();
    ctx.save();
    ctx.font        = 'bold 12px ui-sans-serif';
    ctx.fillStyle   = 'rgba(100,200,255,0.85)';
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#0088cc';
    ctx.shadowBlur  = 10;
    ctx.fillText('⚡  WARP-JUMP MODE  —  Right-click target location', rect.width/2, rect.height - 32);
    ctx.restore();
  }

  function drawSelectionBox(){
    if (!input.boxSelect) return;
    const a = input.dragStartLocal;
    const b = input.dragNowLocal;
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = 'rgba(90,167,255,0.9)';
    ctx.fillStyle = 'rgba(90,167,255,0.07)';
    const x = Math.min(a.x,b.x);
    const y = Math.min(a.y,b.y);
    const w = Math.abs(a.x-b.x);
    const h = Math.abs(a.y-b.y);
    ctx.fillRect(x,y,w,h);
    ctx.strokeRect(x,y,w,h);
    ctx.restore();
  }

  function drawMinimap(){
    const rect = getFrameRect();
    const mmW = 190, mmH = Math.round(mmW * world.h/world.w);
    const mmX = rect.width - mmW - 10;
    const mmY = rect.height - mmH - 10;
    const scaleX = mmW / world.w;
    const scaleY = mmH / world.h;
    const theme = BG_THEMES[activeBgTheme];
    const tc = theme.nebulaColors[0];

    ctx.save();

    // Background with theme-tinted gradient
    const mmBg = ctx.createLinearGradient(mmX, mmY, mmX, mmY+mmH);
    mmBg.addColorStop(0, `rgba(${Math.floor(tc[0]*0.12)},${Math.floor(tc[1]*0.12)},${Math.floor(tc[2]*0.12)},0.92)`);
    mmBg.addColorStop(1, 'rgba(3,5,14,0.92)');
    ctx.fillStyle = mmBg;
    ctx.strokeStyle = `rgba(${tc[0]},${tc[1]},${tc[2]},0.4)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(mmX, mmY, mmW, mmH, 7); ctx.fill(); ctx.stroke();

    // Subtle nebula hint on minimap — tiny version of actual nebula positions
    ctx.globalAlpha = 0.18;
    for (let i=0; i<3; i++){
      const star = BG.stars[i*30];
      if (!star) continue;
      const nx = mmX + star.wx * scaleX, ny = mmY + star.wy * scaleY;
      const nr = 18 + i*8;
      const ng = ctx.createRadialGradient(nx,ny,0,nx,ny,nr);
      ng.addColorStop(0, `rgba(${tc[0]},${tc[1]},${tc[2]},0.6)`);
      ng.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ng;
      ctx.beginPath(); ctx.arc(nx, ny, nr, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Ship dots — colored by faction, size by ship mass, outline if selected
    const factionKeys = Object.keys(FACTIONS);
    for (const fk of factionKeys){
      const col = FACTIONS[fk].tint;
      for (const s of world.ships){
        if (!s.isAlive() || s.faction !== fk) continue;
        const mx = mmX + s.pos.x * scaleX;
        const my = mmY + s.pos.y * scaleY;
        const mr = clamp(s.radius * scaleX * 1.6, 1.2, 5.0);
        const hf = s.hull / s.maxHull;
        // Dim dead/dying ships
        ctx.globalAlpha = 0.5 + hf * 0.5;
        // Health-tinted fill: green → yellow → red
        const hr = hf > 0.5 ? Math.floor(col[0]*0.5 + (1-hf*2+1)*80) : Math.floor(col[0]*0.3+180);
        const hg2 = hf > 0.5 ? col[1] : Math.floor(col[1]*0.5);
        ctx.fillStyle = `rgb(${clamp(hr,0,255)},${clamp(hg2,0,255)},${col[2]})`;
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
        if (s.selected){
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(mx, my, mr+1.2, 0, TAU); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;

    // Camera viewport rect
    const vW = rect.width  / cam.zoom * scaleX;
    const vH = rect.height / cam.zoom * scaleY;
    const vX = mmX + (cam.x - rect.width  / (2*cam.zoom)) * scaleX;
    const vY = mmY + (cam.y - rect.height / (2*cam.zoom)) * scaleY;
    ctx.strokeStyle = `rgba(${tc[0]},${Math.min(255,tc[1]+80)},255,0.7)`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3,2]);
    ctx.globalAlpha = 0.7;
    ctx.strokeRect(vX, vY, vW, vH);

    // Label
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = `rgb(${tc[0]},${Math.min(255,tc[1]+60)},${Math.min(255,tc[2]+80)})`;
    ctx.font = 'bold 8px ui-sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('TACTICAL MAP', mmX+5, mmY+10);
    ctx.restore();
  }

  // Speed controls
  let gameSpeed = 1.0;
  const SPEED_STEPS = [0.25, 0.5, 1.0, 1.5, 2.0, 3.0];
  let speedIdx = 2;

  function drawSpeedHUD(){
    const rect = getFrameRect();
    const x = rect.width - 200;
    const y = 10;
    ctx.save();
    ctx.font = 'bold 11px ui-monospace';
    ctx.textAlign = 'left';
    for (let i=0;i<SPEED_STEPS.length;i++){
      const active = i === speedIdx;
      const bx = x + i*30;
      ctx.fillStyle = active ? 'rgba(90,167,255,0.22)' : 'rgba(0,0,0,0.22)';
      ctx.strokeStyle = active ? 'rgba(90,167,255,0.9)' : 'rgba(60,80,140,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(bx, y, 26, 18, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = active ? '#cce8ff' : '#556688';
      ctx.textAlign = 'center';
      ctx.fillText(SPEED_STEPS[i]+'x', bx+13, y+13);
    }
    ctx.restore();
  }

  function render(dt){
    invalidateFrameRect(); // reset per-frame layout cache
    const rect = getFrameRect();
    ctx.clearRect(0,0,rect.width,rect.height);

    // Apply screen shake
    if (shake.trauma > 0.01){
      ctx.save();
      ctx.translate(shake.x, shake.y);
    }

    drawBackground();
    drawGrid();

    // Draw ships sorted by radius (capitals under escorts under craft).
    // Only re-sort when ships are added or removed (_shipsSortDirty), not every frame.
    const ships = world.ships;
    if (_shipsSortDirty){
      ships.sort((a,b) => b.radius - a.radius);
      _shipsSortDirty = false;
    }
    for (const s of ships) drawShipSprite(s);

    drawProjectiles();
    drawEffects(dt);
    drawSelectionBox();

    if (shake.trauma > 0.01) ctx.restore();

    // HUD elements (no shake)
    drawMinimap();
    drawSpeedHUD();

    // Hover → tooltip — use spatial grid instead of full scan
    const wp = screenToWorld(input.mouseClient.x, input.mouseClient.y);
    let hovered = null, bestD2 = Infinity;
    const hoverCandidates = grid.query(wp.x, wp.y, 120);
    for (const s of hoverCandidates){
      if (!s.isAlive()) continue;
      const dx = s.pos.x - wp.x, dy = s.pos.y - wp.y;
      const d2 = dx*dx + dy*dy;
      const thresh = s.radius * 1.5;
      if (d2 <= thresh*thresh && d2 < bestD2){ bestD2 = d2; hovered = s; }
    }
    input.hoveredShip = hovered;
    drawTooltip();
    drawWarpModeHint();
  }

  // ---------- Simulation ----------
    function tick(dt){
    if (world.paused || world.gameOver) return;

    const scaledDt = dt * gameSpeed;
    world.time += scaledDt;

    updateShake(dt);
    updateCameraPan(dt);
    updateEdgeScroll(dt);

    // Rebuild spatial index once per tick — O(n), pays off for all O(n²) queries
    grid.rebuild(world.ships);
    shipMapRebuild();
    aiSlotFrame = (aiSlotFrame + 1) % AI_SLOTS;

    for (const s of world.ships) s.update(scaledDt);
    // Update projectiles in-place — no new array allocation
    let pwi = 0;
    for (let pri = 0; pri < world.projectiles.length; pri++){
      if (world.projectiles[pri].update(scaledDt)) world.projectiles[pwi++] = world.projectiles[pri];
    }
    world.projectiles.length = pwi;

    // remove dead ships
    // record deaths for report (once)
    if (world.running && world.battleReport){
      for (const s of world.ships){
        if (!s.isAlive() && !s._countedDead){
          s._countedDead = true;
          incNested(world.battleReport.destroyedCounts, s.faction, s.def.name, 1);
          world.battleReport.totalDestroyed += 1;
          const big = s.radius >= 55 || s.def.role === 'station' || s.def.role === 'capital';
          if (s.def.role === 'craft') audio.craftExplosion();
          else audio.explosion(big);
          addTrauma(big ? 0.45 : (s.def.role==='craft' ? 0.04 : 0.18));
          recentCasualties += big ? 1.1 : (s.def.role === 'craft' ? 0.12 : 0.38);
        }
      }
    }

    const beforeCount = world.ships.length;
    world.ships = world.ships.filter(s => s.isAlive());
    if (world.ships.length !== beforeCount) _shipsSortDirty = true;
    updateDynamicMusic(scaledDt);

    // victory: last TEAM standing (only during battle)
    const aliveTeams = new Set();
    for (const s of world.ships){
      const t = FACTIONS[s.faction]?.team ?? s.faction;
      aliveTeams.add(t);
    }
    if (world.running && !world.gameOver && aliveTeams.size <= 1){
      world.gameOver = true;
      const winnerTeam = aliveTeams.size === 1 ? [...aliveTeams][0] : null;
      world.winner = winnerTeam;

      if (world.battleReport){
        world.battleReport.endedAt = performance.now();
      }

      const teamName = (t)=>{
        if (t === 1) return FACTIONS.republic.name;
        if (t === 2) return `${FACTIONS.csn.name} / ${FACTIONS.ngr.name}`;
        if (t === 3) return `${FACTIONS.empire.name} / ${FACTIONS.remnant.name}`;
        if (t === 4) return FACTIONS.starwars.name;
        if (t === 5) return FACTIONS.fsa.name;
        return String(t);
      };

      if (winnerTeam !== null){
        const playerTeam = FACTIONS[playerFaction]?.team ?? -1;
        if (winnerTeam === playerTeam) audio.victory(); else audio.alert();
        setTimeout(() => audio.setMusicMood('ambient'), 2200); // let fanfare finish first
        // Campaign handoff: write result so campaign.js can read it back
        try {
          if (sessionStorage.getItem('campaign_battle_pending')) {
            sessionStorage.setItem('campaign_battle_result', JSON.stringify({
              winnerTeam, playerTeam,
              playerWon: winnerTeam === playerTeam,
              timestamp: Date.now()
            }));
            sessionStorage.removeItem('campaign_battle_pending');
          }
        } catch(e){}
        showOverlay('Battle Result', `<div class="result-line"><b>${teamName(winnerTeam)}</b> wins the engagement.</div>` + makeBattleReportHTML());
      } else {
        audio.alert();
        setTimeout(() => audio.setMusicMood('ambient'), 1000);
        try {
          if (sessionStorage.getItem('campaign_battle_pending')) {
            sessionStorage.setItem('campaign_battle_result', JSON.stringify({
              winnerTeam: null, playerTeam: FACTIONS[playerFaction]?.team ?? -1,
              playerWon: false, timestamp: Date.now()
            }));
            sessionStorage.removeItem('campaign_battle_pending');
          }
        } catch(e){}
        showOverlay('Battle Result', `<div class="result-line"><b>Draw</b> — no ships remain.</div>` + makeBattleReportHTML());
      }
    }
  }


  // ---------- Event wiring ----------
  function bind(){
    populateSpawnList();
    resize();

    // Buttons
    el.btnStart.addEventListener("click", () => { audio.unlock(); audio.click(); startBattle(); });

    el.btnPause.addEventListener("click", () => { audio.unlock(); audio.click();
      world.paused = !world.paused;
      el.btnPause.textContent = world.paused ? 'Resume' : 'Pause';
    });

    el.btnReset.addEventListener("click", () => { audio.unlock(); audio.click(); resetWorld(true); });
    el.btnQuick.addEventListener("click", () => { audio.unlock(); audio.click(); quickBattle(); });

    // Sound UI
    if (el.soundVol) audio.setVolume(el.soundVol.value);
    if (el.soundVol) el.soundVol.addEventListener("input", () => audio.setVolume(el.soundVol.value));
    if (el.musicVol) audio.setMusicVolume(el.musicVol.value);
    if (el.musicVol) el.musicVol.addEventListener("input", () => audio.setMusicVolume(el.musicVol.value));
    if (el.btnSound) el.btnSound.addEventListener("click", () => { audio.unlock(); audio.setEnabled(!audio.enabled); audio.click(); });

    // Unlock audio on first user gesture
    window.addEventListener("pointerdown", () => {
      audio.unlock();
      // Start ambient music on first interaction (browsers require gesture)
      setTimeout(() => audio.setMusicMood('ambient'), 300);
    }, { once: true, passive: true });


    el.btnExport.addEventListener('click', exportScenario);
    el.btnImport.addEventListener('click', importScenario);

    el.btnPlayAgain.addEventListener('click', () => resetWorld(true));
    el.btnCloseOverlay.addEventListener('click', hideOverlay);

    if (el.btnDownloadCSV){
      el.btnDownloadCSV.addEventListener("click", () => {
        audio.unlock();
        audio.click();
        const rep = world.battleReport;
        const csv = rep ? (rep._csv || "") : "";
        const blob = new Blob([csv], {type: "text/csv;charset=utf-8"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "battle_report.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 250);
      });
    }


    el.btnDeselect.addEventListener('click', deselectAll);
    el.btnDelete.addEventListener('click', () => {
      const sel = allSelectedShips();
      for (const s of sel) { s.hull = 0; spawnExplosion(s.pos.x, s.pos.y, s.radius*1.1); }
      deselectAll();
    });

    el.btnHold.addEventListener('click', () => { for (const s of selectedShips()) s.holdFire = true; });
    el.btnFree.addEventListener('click', () => { for (const s of selectedShips()) s.holdFire = false; });

    if (el.btnRepair)    el.btnRepair.addEventListener('click',    () => { audio.unlock(); repairSelected(); });
    if (el.btnScatter)   el.btnScatter.addEventListener('click',   () => { audio.unlock(); scatterSelected(); });
    if (el.btnRecall)    el.btnRecall.addEventListener('click',    () => { audio.unlock(); recallCraft(); });
    if (el.btnSelectAll) el.btnSelectAll.addEventListener('click', () => { audio.unlock(); selectAllFriendly(); });
    if (el.btnFocusCam)  el.btnFocusCam.addEventListener('click',  () => { audio.unlock(); focusCamOnSelection(); });

    el.formation.addEventListener('change', () => {});
    el.playerFaction?.addEventListener('change', () => {
      playerFaction = el.playerFaction.value;
      if (el.spawnFaction) el.spawnFaction.value = playerFaction;
      populateSpawnList();
    });
    el.spawnFaction.addEventListener('change', () => { populateSpawnList(); });
    el.spawnType.addEventListener('change', () => {});

    // Spawn Center button removed — placement is via canvas clicks.

    // Canvas mouse
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('mousedown', (e) => {
      input.shift = e.shiftKey;
      input.ctrl = e.ctrlKey || e.metaKey;

      if (e.button === 1){
        input.mmb = true;
        cam.pan = true;
        cam.panStart = v2(e.clientX, e.clientY);
        cam.camStart = v2(cam.x, cam.y);
        return;
      }

      
      if (e.button === 0){
        input.lmb = true;
        input.shift = e.shiftKey;
        input.ctrl = e.ctrlKey || e.metaKey;

        const rect = getFrameRect();

        // ── Minimap click → pan camera ──
        const mmW = 180, mmH = Math.round(mmW * world.h / world.w);
        const mmX = rect.width - mmW - 10, mmY = rect.height - mmH - 10;
        const mlx = e.clientX - rect.left, mly = e.clientY - rect.top;
        if (mlx >= mmX && mlx <= mmX+mmW && mly >= mmY && mly <= mmY+mmH){
          cam.x = clamp(((mlx - mmX) / mmW) * world.w, 0, world.w);
          cam.y = clamp(((mly - mmY) / mmH) * world.h, 0, world.h);
          return;
        }
        input.dragStartClient = v2(e.clientX, e.clientY);
        input.dragNowClient = v2(e.clientX, e.clientY);
        input.dragStartLocal = v2(e.clientX - rect.left, e.clientY - rect.top);
        input.dragNowLocal = v2(e.clientX - rect.left, e.clientY - rect.top);

        // Focus target mode (T + LMB)
        if (input.keyT){
          const picked = pickShipAtScreen(e.clientX, e.clientY);
          if (picked){
            for (const s of selectedShips()){
              s.focusTargetId = picked.id;
              s.order.targetId = picked.id;
              s.order.type = 'attackmove';
              s.order.point = picked.pos;
              s.order.issuedAt = world.time;
            }
          }
          return;
        }

        // If you click on a ship: select it (selection has priority over placing)
        const picked = pickShipAtScreen(e.clientX, e.clientY);
        input.downOnShip = !!picked;

        // Shift+Click always places, even on top of ships
        if (input.shift && !input.keyT){
          const wp = screenToWorld(e.clientX, e.clientY);
          const count = clamp(parseInt(el.spawnCount.value||"1",10), 1, 50);
          const defKey = el.spawnType.value;
          const faction = el.spawnFaction.value;
          for (let i=0;i<count;i++){
            spawnShip(defKey, faction, wp.x + rand(-18,18), wp.y + rand(-18,18));
          }
          return;
        }

        if (picked){
          if (!input.ctrl) deselectAll();
          if (input.ctrl){
            picked.selected = !picked.selected;
          } else {
            picked.selected = true;
          }
          input.potentialPlace = false;
          input.boxSelect = false;
          // RMB orders only affect player-controlled ships (selectedShips()),
          // so selecting enemies is safe — it lets the player delete them.
        } else {
          // Click on empty space: potential place (unless you drag -> box select)
          if (!input.ctrl) deselectAll();
          input.potentialPlace = true;
          input.boxSelect = false;
        }
      }

      if (e.button === 2){
        input.rmb = true;
        const wp = screenToWorld(e.clientX, e.clientY);
        // W + RMB → warp-jump
        if (input.keyW && selectedShips().length){
          warpMoveSelected(wp.x, wp.y);
          return;
        }
        const sel = selectedShips();
        const formVal = el.formation.value;
        applyFormationAndOrder(sel, wp, formVal === 'natural' ? 'natural' : formVal);
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      input.mouseClient = v2(e.clientX, e.clientY);
      const rect = getFrameRect();
      input.mouseLocal = v2(e.clientX - rect.left, e.clientY - rect.top);
      if (cam.pan && input.mmb){
        const dx = (e.clientX - cam.panStart.x) / cam.zoom;
        const dy = (e.clientY - cam.panStart.y) / cam.zoom;
        cam.x = clamp(cam.camStart.x - dx, 0, world.w);
        cam.y = clamp(cam.camStart.y - dy, 0, world.h);
      }
      if (input.lmb){
        input.dragNowClient = v2(e.clientX, e.clientY);
        const rect2 = getFrameRect();
        input.dragNowLocal = v2(e.clientX - rect2.left, e.clientY - rect2.top);

        // If we pressed on empty space, decide between placing vs box-select based on drag distance
        if (input.potentialPlace && !input.downOnShip){
          const dx = input.dragNowLocal.x - input.dragStartLocal.x;
          const dy = input.dragNowLocal.y - input.dragStartLocal.y;
          const dist2 = dx*dx + dy*dy;
          if (dist2 > 36){ // 6px threshold
            input.boxSelect = true;
            input.potentialPlace = false;
          }
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 1){
        input.mmb = false;
        cam.pan = false;
      }
      if (e.button === 0){
        input.lmb = false;

        // Finish box select
        if (input.boxSelect){
          input.boxSelect = false;
          const picked = shipsInBox(input.dragStartLocal, input.dragNowLocal);
          for (const s of picked){
            s.selected = true; // select ALL ships including enemies
          }
        } else if (input.potentialPlace && !input.downOnShip){
          // Click-release on empty space (no drag): place the selected unit(s)
          const wp = screenToWorld(input.dragNowClient.x, input.dragNowClient.y);
          const count = clamp(parseInt(el.spawnCount.value||"1",10), 1, 50);
          const defKey = el.spawnType.value;
          const faction = el.spawnFaction.value;

          // Only spawn if a unit type is actually selected
          if (defKey) {
            const spread = Math.min(26, 6 + Math.sqrt(count)*6);
            for (let i=0;i<count;i++){
              const a = (i / Math.max(1,count)) * Math.PI * 2;
              const r = (count === 1) ? 0 : spread * (0.35 + 0.65*(i/(count-1)));
              spawnShip(defKey, faction, wp.x + Math.cos(a)*r + rand(-4,4), wp.y + Math.sin(a)*r + rand(-4,4));
            }
          }
        }

        input.potentialPlace = false;
        input.downOnShip = false;
      }
      if (e.button === 2) input.rmb = false;
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = getFrameRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const before = screenToWorld(e.clientX, e.clientY);

      const delta = Math.sign(e.deltaY);
      const factor = delta > 0 ? 0.92 : 1.08;
      cam.zoom = clamp(cam.zoom * factor, cam.minZoom, cam.maxZoom);

      // zoom to cursor
      const after = screenToWorld(e.clientX, e.clientY);
      cam.x += (before.x - after.x);
      cam.y += (before.y - after.y);
      cam.x = clamp(cam.x, 0, world.w);
      cam.y = clamp(cam.y, 0, world.h);
    }, { passive:false });

    // Keyboard
    window.addEventListener('keydown', (e) => {
      // Don't steal keys from text inputs
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

      if (e.key === 'Escape'){ deselectAll(); hideOverlay(); }
      if (e.key === ' '){ e.preventDefault(); world.paused = !world.paused; el.btnPause.textContent = world.paused ? 'Resume' : 'Pause'; }
      if (e.key === 'Delete' || e.key === 'Backspace'){
        const sel = allSelectedShips();
        for (const s of sel){ s.hull = 0; spawnExplosion(s.pos.x, s.pos.y, s.radius*1.1); }
        deselectAll();
      }

      const k = e.key.toLowerCase();
      if (k === 'a' && !e.ctrlKey && !e.metaKey) input.keyA = true;
      if (k === 't') input.keyT = true;
      if (k === 'w') input.keyW = true;

      // Arrow key camera pan
      if (e.key === 'ArrowLeft')  input.camL = true;
      if (e.key === 'ArrowRight') input.camR = true;
      if (e.key === 'ArrowUp')    input.camU = true;
      if (e.key === 'ArrowDown')  input.camD = true;

      // Ctrl+A → select all friendly
      if ((e.ctrlKey || e.metaKey) && k === 'a'){ e.preventDefault(); selectAllFriendly(); }

      if (e.key === '1') el.formation.value = 'line';
      if (e.key === '2') el.formation.value = 'wedge';
      if (e.key === '3') el.formation.value = 'ring';

      // Speed controls
      if (e.key === '=' || e.key === '+'){ speedIdx = Math.min(SPEED_STEPS.length-1, speedIdx+1); gameSpeed = SPEED_STEPS[speedIdx]; }
      if (e.key === '-' || e.key === '_'){ speedIdx = Math.max(0, speedIdx-1);                     gameSpeed = SPEED_STEPS[speedIdx]; }

      if (k === 'h') for (const s of selectedShips()) s.holdFire = true;
      if (k === 'f') for (const s of selectedShips()) s.holdFire = false;

      // R → repair selected
      if (k === 'r') repairSelected();

      // E → scatter/evasive burst
      if (k === 'e') scatterSelected();

      // C → recall craft to carrier
      if (k === 'c') recallCraft();

      // G → centre camera on selection
      if (k === 'g') focusCamOnSelection();
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'a') input.keyA = false;
      if (k === 't') input.keyT = false;
      if (k === 'w') input.keyW = false;
      if (e.key === 'ArrowLeft')  input.camL = false;
      if (e.key === 'ArrowRight') input.camR = false;
      if (e.key === 'ArrowUp')    input.camU = false;
      if (e.key === 'ArrowDown')  input.camD = false;
    });
  }

  // ---------- Loop ----------
  let last = performance.now();
  function loop(now){
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;

    audio.beginFrame();
    tick(dt);
    render(dt);
    updateStatus();

    requestAnimationFrame(loop);
  }

  // ---------- Start ----------
  bind();

  // Auto-load campaign battle scenario if launched from campaign
  (function loadCampaignBattle(){
    try {
      const raw = sessionStorage.getItem('campaign_battle_scenario');
      if (!raw) { sessionStorage.removeItem('campaign_battle_pending'); resetWorld(true); return; }
      sessionStorage.removeItem('campaign_battle_scenario');
      sessionStorage.setItem('campaign_battle_pending', '1');
      const data = JSON.parse(raw);
      // Set player faction from campaign
      if (data.playerFaction && el.playerFaction) {
        el.playerFaction.value = data.playerFaction;
        playerFaction = data.playerFaction;
      }
      // Hide the left spawn/scenario panel — no free spawning in campaign battles
      // Use a body class so CSS can collapse the grid column cleanly
      document.body.classList.add('campaign-battle');
      const aside = document.querySelector('aside.panel');
      if (aside) { aside.style.visibility = 'hidden'; aside.style.width = '0'; aside.style.padding = '0'; aside.style.overflow = 'hidden'; aside.style.minWidth = '0'; }
      // Collapse the grid column so the canvas fills the full width
      const layout = document.querySelector('.layout');
      if (layout) layout.style.gridTemplateColumns = '0 1fr';
      // Also update subtitle to show campaign context
      const subtitle = document.querySelector('.subtitle');
      if (subtitle) subtitle.textContent = 'Campaign Battle';
      // Show a "Return to Campaign" button in the topbar
      const retBtn = document.createElement('button');
      retBtn.className = 'btn';
      retBtn.textContent = '← Campaign';
      retBtn.style.cssText = 'background:rgba(255,200,40,.1);border-color:rgba(255,200,40,.5);color:#ffc828;font-weight:600';
      retBtn.addEventListener('click', () => { window.location.href = 'index.html'; });
      document.querySelector('.top-controls')?.prepend(retBtn);
      // Import the scenario
      el.scenarioBox.value = JSON.stringify(data.scenario || {});
      importScenario();
      // Trigger canvas resize after layout settles (grid column collapse needs a frame)
      requestAnimationFrame(() => { requestAnimationFrame(() => { resize(); }); });
      // Auto-start battle
      setTimeout(() => startBattle(), 600);
    } catch(e){ resetWorld(true); }
  })();

  requestAnimationFrame(loop);

  // Expose data for the Ship Docs modal (runs after this IIFE)
  window.SHIP_DOCS = {
    factions: FACTIONS,
    units:    UNIT_DEFS,
    hangars:  HANGAR_DEFS,
    airStationHangar: AIR_STATION_HANGAR,
    airStationHangarEmpire: AIR_STATION_HANGAR_EMPIRE,
    loadouts: FACTION_LOADOUTS,
    assets:   ASSET_FILES,   // spriteKey → filename (e.g. 'repDread' → 'Republican Dreadnought.png')
  };

})();