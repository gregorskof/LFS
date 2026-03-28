// ═══════════════════════════════════════════════════════════════════════
// Fleet Commander: The Last Armada — Campaign Engine
// ═══════════════════════════════════════════════════════════════════════
'use strict';

// ── Faction definitions (mirror game.js colours) ──────────────────────
const CF = {
  republic: { name:'Grand Republic',      color:'#3a7aff', tint:'rgba(35,95,220,' },
  csn:      { name:'CSN',                 color:'#6bcfff', tint:'rgba(110,200,255,' },
  ngr:      { name:'New Grand Republic',  color:'#7adaff', tint:'rgba(120,220,255,' },
  empire:   { name:'Grand Empire',        color:'#ff4a4a', tint:'rgba(235,72,72,'  },
  remnant:  { name:'Imperial Remnant',    color:'#a81a1a', tint:'rgba(140,25,25,'  },
  fsa:      { name:'Five Star Alignment',    color:'#ffd228', tint:'rgba(255,210,40,' },
  rebel:    { name:'Rebel Coalition',         color:'#ff9933', tint:'rgba(255,153,51,' },
  earth:    { name:'United Earth Federation', color:'#33cc77', tint:'rgba(51,204,119,'  },
};

// ── Ship pool definitions (what units each faction can field per planet conquered) ─
// Each entry: [defKey, role, power] — used for fleet generation
const FLEET_POOLS = {
  republic: [
    {k:'rep_dread',         role:'capital',  pw:18, rare:true},
    {k:'air_station',       role:'station',  pw:22, rare:true},
    {k:'rep_carrier_heavy', role:'carrier',  pw:14, rare:true},
    {k:'rep_carrier_light', role:'carrier',  pw:10},
    {k:'rep_battle',        role:'capital',  pw:12},
    {k:'rep_hcruiser',      role:'escort',   pw:8},
    {k:'rep_lcruiser',      role:'escort',   pw:6},
    {k:'rep_destroyer',     role:'screen',   pw:4},
    {k:'rep_frigate',       role:'screen',   pw:3},
    {k:'rep_corvette',      role:'strike',   pw:2},
    {k:'patrol',            role:'strike',   pw:1},
    {k:'rep_fighter',       role:'craft',    pw:1},
    {k:'rep_bomber',        role:'craft',    pw:1},
    {k:'rep_interceptor',   role:'craft',    pw:1},
  ],
  csn: [
    {k:'csn_sovereign',    role:'carrier',  pw:14, rare:true},
    {k:'csn_bastion',      role:'capital',  pw:12},
    {k:'csn_tempest',      role:'escort',   pw:7},
    {k:'csn_phantom',      role:'screen',   pw:5},
    {k:'csn_vanguard',     role:'screen',   pw:4},
    {k:'csn_arc',          role:'strike',   pw:2},
    {k:'csn_fighter',      role:'craft',    pw:1},
    {k:'csn_bomber',       role:'craft',    pw:1},
    {k:'csn_interceptor',  role:'craft',    pw:1},
  ],
  ngr: [
    {k:'rep_carrier_heavy', role:'carrier', pw:14, rare:true},
    {k:'rep_carrier_light', role:'carrier', pw:10},
    {k:'rep_hcruiser',      role:'escort',  pw:8},
    {k:'rep_destroyer',     role:'screen',  pw:4},
    {k:'rep_frigate',       role:'screen',  pw:3},
    {k:'rep_fighter',       role:'craft',   pw:1},
    {k:'rep_bomber',        role:'craft',   pw:1},
  ],
  empire: [
    {k:'air_station',       role:'station', pw:22, rare:true},
    {k:'emp_battle',        role:'capital', pw:12},
    {k:'emp_destroyer',     role:'screen',  pw:4},
    {k:'patrol',            role:'strike',  pw:1},
    {k:'emp_fighter',       role:'craft',   pw:1},
    {k:'emp_bomber',        role:'craft',   pw:1},
    {k:'emp_interceptor',   role:'craft',   pw:1},
  ],
  remnant: [
    {k:'remnant_mothership',role:'capital', pw:20, rare:true},
    {k:'remnant_dread',     role:'capital', pw:15},
    {k:'rem_fighter',       role:'craft',   pw:1},
    {k:'rem_bomber',        role:'craft',   pw:1},
    {k:'rem_interceptor',   role:'craft',   pw:1},
  ],
  fsa: [
    {k:'fsa_capital_station',role:'station',pw:22, rare:true},
    {k:'fsa_carrier',       role:'carrier', pw:14, rare:true},
    {k:'fsa_battleship',    role:'capital', pw:11},
    {k:'fsa_destroyer',     role:'screen',  pw:4},
    {k:'fsa_frigate',       role:'screen',  pw:3},
    {k:'fsa_corvette',      role:'strike',  pw:2},
    {k:'fsa_fighter',       role:'craft',   pw:1},
    {k:'fsa_bomber',        role:'craft',   pw:1},
  ],
  rebel: [
    {k:'rebel_command_cruiser',  role:'capital', pw:10, rare:true},
    {k:'rebel_frigate',          role:'escort',  pw:6},
    {k:'rebel_gunship',          role:'screen',  pw:4},
    {k:'rebel_blockade_runner',  role:'strike',  pw:3},
    {k:'rebel_corvette',         role:'strike',  pw:2},
    {k:'patrol',                 role:'strike',  pw:1},
    {k:'rebel_fighter',          role:'craft',   pw:1},
    {k:'rebel_bomber',           role:'craft',   pw:1},
    {k:'rebel_interceptor',      role:'craft',   pw:1},
  ],
  earth: [
    {k:'uef_orbital_fortress',   role:'station', pw:22, rare:true},
    {k:'uef_dreadnought',        role:'capital', pw:16, rare:true},
    {k:'uef_titan_carrier',      role:'carrier', pw:14, rare:true},
    {k:'uef_battlecruiser',      role:'capital', pw:11},
    {k:'uef_assault_cruiser',    role:'escort',  pw:8},
    {k:'uef_escort_frigate',     role:'escort',  pw:6},
    {k:'uef_destroyer',          role:'screen',  pw:4},
    {k:'uef_corvette',           role:'strike',  pw:2},
    {k:'uef_stealth_scout',      role:'strike',  pw:2},
    {k:'uef_fighter',            role:'craft',   pw:1},
    {k:'uef_bomber',             role:'craft',   pw:1},
    {k:'uef_interceptor',        role:'craft',   pw:1},
    {k:'uef_drone',              role:'craft',   pw:1},
  ],
};

// ── Campaign definitions ───────────────────────────────────────────────
const CAMPAIGNS_DATA = [
  // ══════════════════════════════════════════════════════════
  // HISTORY
  // ══════════════════════════════════════════════════════════
  {
    id: 'h1',
    era: 'Ancient Era — Before the Republic',
    period: '~500 BGR — ~480 BGR',
    name: 'The Interplanetary Wars',
    description: 'Civilisation tears itself apart. Command one of the warring planetary nations in the final brutal years of the Interplanetary Wars — the catastrophe that will eventually forge the Grand Republic from exhaustion and ruin.',
    difficulty: 'Medium',
    planets: 20,
    startingPlanets: 8,
    objective: 'Eliminate all rival planetary factions.',
    factionPills: [
      {role:'You', name:'Rebel Coalition', color:'#ff9933'},
      {role:'Enemy', name:'Grand Republic', color:'#3a7aff'},
    ],
    playerFaction: 'rebel',
    factions: {
      rebel:   { team:1, role:'player', startPlanets:8,  ai:false },
      republic:{ team:2, role:'enemy',  startPlanets:12, ai:true  },
    },
    restrictions: {
      rebel:   { max_rebel_command_cruiser:2 },
      republic:{ max_air_station:1, max_rep_dread:1 },
    },
    aiAggressiveness: { republic:0.55 },
    winCondition: 'eliminate_faction', winTarget: 'republic',
    neutralFactions: [],
  },
  {
    id: 'h2',
    era: 'Republic Era — Rise and Slow Decay',
    period: '80 BGR — 21 BGR',
    name: 'The Outer Rebellion',
    description: 'The Grand Republic has grown fat and corrupt. You command the Rebel Coalition rising from the outer worlds — outgunned, outmanned, but not outmatched. Survive, expand, and prove the Republic can be broken.',
    difficulty: 'Hard',
    planets: 30,
    startingPlanets: 6,
    objective: 'Capture the Republic capital and break their fleet.',
    factionPills: [
      {role:'You', name:'Rebel Coalition', color:'#ff9933'},
      {role:'Enemy', name:'Grand Republic', color:'#3a7aff'},
    ],
    playerFaction: 'rebel',
    factions: {
      rebel:   { team:1, role:'player', startPlanets:6,  ai:false },
      republic:{ team:2, role:'enemy',  startPlanets:24, ai:true  },
    },
    restrictions: {
      rebel:   { max_rebel_command_cruiser:3 },
      republic:{ max_air_station:1, max_rep_dread:1 },
    },
    aiAggressiveness: { republic:0.70 },
    winCondition: 'eliminate_faction', winTarget: 'republic',
    neutralFactions: [],
  },
  // ══════════════════════════════════════════════════════════
  // LEGENDS
  // ══════════════════════════════════════════════════════════
  {
    id: 'l1',
    era: 'Legend — Before the Great Fall',
    period: '11 BGR — 10 BGR',
    name: 'First Contact',
    description: 'The Grand Republic has detected an anomalous portal leading to a different reality — our solar system. CSN stealth destroyers have been secretly mining asteroids there, invisible to Earth. Crush the operation before it can be reported.',
    difficulty: 'Easy',
    planets: 12,
    startingPlanets: 7,
    objective: 'Destroy all CSN forces in the solar system.',
    factionPills: [
      {role:'You', name:'Grand Republic', color:'#3a7aff'},
      {role:'Enemy', name:'CSN', color:'#6bcfff'},
    ],
    playerFaction: 'republic',
    factions: {
      republic:{ team:1, role:'player', startPlanets:7, ai:false },
      csn:     { team:2, role:'enemy',  startPlanets:5, ai:true  },
    },
    restrictions: {
      republic:{ max_air_station:1, max_rep_dread:1 },
      csn:     { max_csn_sovereign:1 },
    },
    aiAggressiveness: { csn:0.40 },
    winCondition: 'eliminate_faction', winTarget: 'csn',
    neutralFactions: [],
  },
  {
    id: 'l2',
    era: 'Legend — After the Great Fall',
    period: '5 AGR — 6 AGR',
    name: 'Imperial Folly',
    description: 'The Grand Empire has forced the dimensional portal open again and sent a fleet to conquer Earth. Their admirals see a primitive world ripe for conquest. They are wrong. You command the Empire — stop the Earth counter-attack before it destroys your invasion force.',
    difficulty: 'Medium',
    planets: 12,
    startingPlanets: 5,
    objective: 'Defeat the Earth Federation and hold your planets.',
    factionPills: [
      {role:'You', name:'Grand Empire', color:'#ff4a4a'},
      {role:'Enemy', name:'United Earth Federation', color:'#33cc77'},
    ],
    playerFaction: 'empire',
    factions: {
      empire:{ team:1, role:'player', startPlanets:5, ai:false },
      earth: { team:2, role:'enemy',  startPlanets:7, ai:true  },
    },
    restrictions: {
      empire:{ max_air_station:1 },
      earth: { max_uef_orbital_fortress:1, max_uef_dreadnought:1, max_uef_titan_carrier:1 },
    },
    aiAggressiveness: { earth:0.75 },
    winCondition: 'eliminate_faction', winTarget: 'earth',
    neutralFactions: [],
  },
  {
    id: 'l3',
    era: 'Legend — The Far Future',
    period: '~70 AGR',
    name: 'The Earth Remembers',
    description: 'The United Earth Federation has spent 30 years building a fleet from Republic blueprints. Now they force the portal open and send a vanguard through. Intercept and destroy them before they can report back.',
    difficulty: 'Hard',
    planets: 15,
    startingPlanets: 10,
    objective: 'Destroy the Earth Federation vanguard fleet.',
    factionPills: [
      {role:'You', name:'CSN', color:'#6bcfff'},
      {role:'Ally', name:'Rebel Coalition', color:'#ff9933'},
      {role:'Enemy', name:'United Earth Federation', color:'#33cc77'},
    ],
    playerFaction: 'csn',
    factions: {
      csn:  { team:1, role:'player', startPlanets:10, ai:false },
      earth:{ team:2, role:'enemy',  startPlanets:5,  ai:true  },
    },
    restrictions: {
      csn:  { max_csn_sovereign:3 },
      earth:{ max_uef_orbital_fortress:1, max_uef_dreadnought:2, max_uef_titan_carrier:1 },
    },
    aiAggressiveness: { earth:0.80 },
    winCondition: 'eliminate_faction', winTarget: 'earth',
    neutralFactions: [],
  },
  // ══════════════════════════════════════════════════════════
  // MAIN CAMPAIGNS
  // ══════════════════════════════════════════════════════════
  {
    id: 'c1',
    era: 'Before the Great Fall',
    period: '20 BGR — 0 BGR',
    name: 'Republican & CSN Conflict',
    description: 'The Grand Republic moves to crush the growing CSN independence movement before it can challenge the old order. A carefully managed conflict — the Republic must not overextend.',
    difficulty: 'Easy',
    planets: 30,
    startingPlanets: 20,
    objective: 'Capture all CSN planets and eliminate their fleet.',
    factionPills: [
      {role:'You', name:'Grand Republic', color:'#3a7aff'},
      {role:'Enemy', name:'CSN', color:'#6bcfff'},
    ],
    playerFaction: 'republic',
    factions: {
      republic: { team:1, role:'player',  startPlanets:20, ai:false },
      csn:      { team:2, role:'enemy',   startPlanets:10, ai:true  },
    },
    restrictions: {
      republic: { max_air_station:1, max_rep_dread:1 },
      csn:      { max_csn_sovereign:1 },
    },
    aiAggressiveness: { csn:0.45 },
    winCondition: 'eliminate_faction', winTarget: 'csn',
    neutralFactions: [],
  },
  {
    id: 'c2',
    era: 'After the Great Fall',
    period: '0 AGR — 15 AGR',
    name: 'Civil War',
    description: 'The Republic has fallen. The CSN rises amid chaos, fighting the Grand Empire for control of the galaxy. The Five Star Alignment watches from the edge — until provoked.',
    difficulty: 'Hard',
    planets: 30,
    startingPlanets: 13,
    objective: 'Destroy the Grand Empire\'s fleet and capture their planets.',
    factionPills: [
      {role:'You', name:'CSN', color:'#6bcfff'},
      {role:'Ally', name:'New Grand Republic', color:'#7adaff'},
      {role:'Ally', name:'Rebel Coalition', color:'#ff9933'},
      {role:'Enemy', name:'Grand Empire', color:'#ff4a4a'},
      {role:'Neutral', name:'Five Star Alignment', color:'#ffd228'},
    ],
    playerFaction: 'csn',
    factions: {
      csn:    { team:2, role:'player',  startPlanets:13, ai:false },
      ngr:    { team:2, role:'ally',    startPlanets:2,  ai:true  },
      rebel:  { team:2, role:'ally',    startPlanets:2,  ai:true  },
      empire: { team:3, role:'enemy',   startPlanets:10, ai:true  },
      fsa:    { team:5, role:'neutral', startPlanets:5,  ai:true  },
    },
    restrictions: {
      empire: { max_air_station:1 },
      csn:    { max_csn_sovereign:2 },
      rebel:  { max_rebel_command_cruiser:2 },
      fsa:    { max_fsa_capital_station:0 },  // FSA doesn't have the station yet
    },
    aiAggressiveness: { empire:0.80, ngr:0.55, rebel:0.60, fsa:0.15 },
    winCondition: 'eliminate_faction', winTarget: 'empire',
    neutralFactions: ['fsa'],
  },
  {
    id: 'c3',
    era: 'After the Great Fall',
    period: '15 AGR — 20 AGR',
    name: 'Remnant Wars',
    description: 'A new threat emerges from the Unknown Regions. The Imperial Remnant strikes without warning. The CSN must fight on two fronts as the Five Star Alignment holds its own territories.',
    difficulty: 'Medium',
    planets: 35,
    startingPlanets: 25,
    objective: 'Destroy the Imperial Remnant.',
    factionPills: [
      {role:'You', name:'CSN', color:'#6bcfff'},
      {role:'Ally', name:'Rebel Coalition', color:'#ff9933'},
      {role:'Enemy', name:'Imperial Remnant', color:'#a81a1a'},
      {role:'Neutral', name:'Five Star Alignment', color:'#ffd228'},
    ],
    playerFaction: 'csn',
    factions: {
      csn:     { team:2, role:'player',  startPlanets:25, ai:false },
      rebel:   { team:2, role:'ally',    startPlanets:3,  ai:true  },
      remnant: { team:3, role:'enemy',   startPlanets:5,  ai:true  },
      fsa:     { team:5, role:'neutral', startPlanets:5,  ai:true  },
    },
    restrictions: {
      remnant: { max_remnant_mothership:1 },
      csn:     { max_csn_sovereign:4 },
      rebel:   { max_rebel_command_cruiser:2 },
      fsa:     { max_fsa_capital_station:1 },
    },
    unknownRegion: true,
    aiAggressiveness: { remnant:0.75, rebel:0.65, fsa:0.20 },
    winCondition: 'eliminate_faction', winTarget: 'remnant',
    neutralFactions: ['fsa'],
  },
  {
    id: 'c4',
    era: 'After the Great Fall',
    period: '16 AGR — 18 AGR',
    name: 'Regional Five Star Conflict',
    description: 'The Five Star Alignment has grown bold. Their expansion threatens CSN border worlds. A surgical campaign must neutralise them before they become an existential threat.',
    difficulty: 'Medium',
    planets: 15,
    startingPlanets: 10,
    objective: 'Destroy the Five Star Alignment.',
    factionPills: [
      {role:'You', name:'CSN', color:'#6bcfff'},
      {role:'Ally', name:'Rebel Coalition', color:'#ff9933'},
      {role:'Enemy', name:'Five Star Alignment', color:'#ffd228'},
    ],
    playerFaction: 'csn',
    factions: {
      csn:   { team:2, role:'player', startPlanets:10, ai:false },
      rebel: { team:2, role:'ally',   startPlanets:2,  ai:true  },
      fsa:   { team:5, role:'enemy',  startPlanets:5,  ai:true  },
    },
    restrictions: {
      csn:   { max_csn_sovereign:3 },
      rebel: { max_rebel_command_cruiser:1 },
      fsa:   { max_fsa_capital_station:1 },
    },
    aiAggressiveness: { rebel:0.65, fsa:0.65 },
    winCondition: 'eliminate_faction', winTarget: 'fsa',
    neutralFactions: [],
  },
  {
    id: 'c5',
    era: 'The Far Future',
    period: '70 AGR — 74 AGR',
    name: 'The Last Armada',
    description: 'The United Earth Federation has invaded CSN space through a manually opened dimensional portal. Their fleet is the largest ever seen from another reality — disciplined, technologically sophisticated, and relentless. The CSN must fight for survival across its core worlds. Victory is possible. It will not come cheaply.',
    difficulty: 'Hard',
    planets: 35,
    startingPlanets: 20,
    objective: 'Destroy the Earth Federation fleet and seal the portal forever.',
    factionPills: [
      {role:'You', name:'CSN', color:'#6bcfff'},
      {role:'Enemy', name:'United Earth Federation', color:'#33cc77'},
    ],
    playerFaction: 'csn',
    factions: {
      csn:   { team:1, role:'player', startPlanets:20, ai:false },
      rebel: { team:1, role:'ally',   startPlanets:4,  ai:true  },
      earth: { team:2, role:'enemy',  startPlanets:15, ai:true  },
    },
    restrictions: {
      csn:   { max_csn_sovereign:4 },
      rebel: { max_rebel_command_cruiser:3 },
      earth: { max_uef_orbital_fortress:2, max_uef_dreadnought:3, max_uef_titan_carrier:2 },
    },
    aiAggressiveness: { rebel:0.75, earth:0.85 },
    winCondition: 'eliminate_faction', winTarget: 'earth',
    neutralFactions: [],
  },
];
window.CAMPAIGNS = CAMPAIGNS_DATA;

// ═══════════════════════════════════════════════════════════════════════
// Galaxy generator
// ═══════════════════════════════════════════════════════════════════════
function generateGalaxy(campDef){
  const N = campDef.planets;
  const fids = Object.keys(campDef.factions);
  const W = 900, H = 640;

  // Generate planet positions — split into main region and unknown region (C3 remnant)
  const planets = [];
  const MARGIN = 70, MIN_DIST = 80;

  const remCount = (campDef.unknownRegion && campDef.factions.remnant)
    ? campDef.factions.remnant.startPlanets : 0;
  const mainCount = N - remCount;
  // Main planets occupy left ~80% of map width when unknown region exists
  const mainMaxX = campDef.unknownRegion ? W * 0.76 : (W - MARGIN);

  let attempts = 0;
  while(planets.length < mainCount && attempts < mainCount * 120){
    attempts++;
    const x = MARGIN + Math.random() * (mainMaxX - MARGIN);
    const y = MARGIN + Math.random() * (H - MARGIN * 2);
    let ok = true;
    for(const p of planets){ if(Math.hypot(p.x-x, p.y-y) < MIN_DIST){ ok=false; break; } }
    if(ok) planets.push({x, y});
  }

  // Unknown region — right strip (remnant planets only)
  if(remCount > 0){
    let ua = 0;
    while(planets.length < mainCount + remCount && ua < remCount * 120){
      ua++;
      const x = W * 0.81 + Math.random() * (W * 0.14);
      const y = MARGIN + Math.random() * (H - MARGIN * 2);
      let ok = true;
      for(const p of planets){ if(Math.hypot(p.x-x, p.y-y) < MIN_DIST){ ok=false; break; } }
      if(ok) planets.push({x, y});
    }
  }

  // Assign planet names
  const NAMES = ['Arcturus','Vega','Sirius','Altair','Deneb','Capella','Rigel','Aldebaran',
    'Spica','Antares','Fomalhaut','Pollux','Castor','Procyon','Mimosa','Acrux','Hadar',
    'Alnilam','Saiph','Bellatrix','Alnair','Menkib','Alnitak','Nunki','Kaus','Shaula',
    'Sargas','Atria','Peacock','Izar','Alkaid','Unuk','Suhail','Avior','Miaplacidus',
    'Canopus','Zuben','Nashira','Sadalsuud','Enif','Scheat','Markab','Alpheratz','Mirach'];
  const usedNames = new Set();
  planets.forEach((p,i)=>{
    let n = NAMES[i % NAMES.length];
    let suffix = 1;
    while(usedNames.has(n)){ n = NAMES[i % NAMES.length]+' '+['I','II','III','IV','V'][suffix%5]; suffix++; }
    usedNames.add(n);
    p.name = n;
    p.id   = i;
  });

  // Assign ownership
  // Unknown-region planets (appended last) are pre-assigned to remnant before sorting
  if(remCount > 0){
    const unknownPlanets = planets.slice(mainCount); // the last remCount planets
    const remnantFleetCounts = {};
    unknownPlanets.forEach((p, j) => {
      p.owner = 'remnant';
      p.garrison = generateGarrison('remnant', campDef, 'medium', remnantFleetCounts);
      // update fleet-wide counts after each planet
      for(const k of p.garrison) remnantFleetCounts[k] = (remnantFleetCounts[k]||0)+1;
      p.income = 2 + Math.floor(Math.random()*3);
      p.isCapital = j === 0;
    });
  }

  // Assign the main planets by X position (left = player, right = enemy)
  const mainFids = fids.filter(f => f !== 'remnant' || !campDef.unknownRegion);
  const sorted = mainFids.slice().sort((a,b)=> campDef.factions[b].startPlanets - campDef.factions[a].startPlanets);
  const mainPlanets = remCount > 0 ? planets.slice(0, mainCount) : planets;
  const byX = mainPlanets.slice().sort((a,b)=>a.x-b.x);
  let pi = 0;
  const factionFleetCounts = {};
  for(const fid of sorted){
    if(fid === 'remnant' && campDef.unknownRegion) continue; // already assigned above
    const count = campDef.factions[fid].startPlanets;
    if(!factionFleetCounts[fid]) factionFleetCounts[fid] = {};
    for(let j=0;j<count&&pi<byX.length;j++,pi++){
      byX[pi].owner = fid;
      byX[pi].garrison = generateGarrison(fid, campDef, 'medium', factionFleetCounts[fid]);
      // update fleet-wide counts after each planet
      for(const k of byX[pi].garrison) factionFleetCounts[fid][k] = (factionFleetCounts[fid][k]||0)+1;
      byX[pi].income = 2 + Math.floor(Math.random()*3);
      byX[pi].isCapital = j===0;
    }
  }
  // Any unassigned main planets become neutral
  while(pi < byX.length){ byX[pi].owner='neutral'; byX[pi].garrison=[]; byX[pi].income=1; pi++; }

  // Generate lanes: Delaunay-ish — connect nearby planets
  const lanes = [];
  const laneSet = new Set();
  for(let i=0;i<planets.length;i++){
    // Find 2-4 nearest neighbours
    const dists = planets.map((p,j)=>({j,d:Math.hypot(p.x-planets[i].x,p.y-planets[i].y)}))
      .filter(o=>o.j!==i).sort((a,b)=>a.d-b.d);
    const conn = Math.min(3+Math.floor(Math.random()*2), dists.length);
    for(let k=0;k<conn;k++){
      const j = dists[k].j;
      const key = Math.min(i,j)+'-'+Math.max(i,j);
      if(!laneSet.has(key) && dists[k].d < 200){
        laneSet.add(key);
        lanes.push({a:i, b:j});
      }
    }
  }

  return { planets, lanes, W, H };
}

function generateGarrison(fid, campDef, size, fleetwideCounts){
  const pool = FLEET_POOLS[fid];
  if(!pool || !pool.length) return [];
  const restr = campDef.restrictions?.[fid] || {};
  const out = [];
  // counts starts from fleet-wide totals so rare/restricted ships can't exceed caps
  const counts = Object.assign({}, fleetwideCounts || {});

  const budgets = { small:8, medium:18, large:32 };
  let budget = budgets[size] || 18;

  const combat = pool.filter(e=>e.role!=='station'&&e.role!=='craft');
  const craft   = pool.filter(e=>e.role==='craft');

  function canAdd(entry){
    const rKey = 'max_'+entry.k;
    if(restr[rKey] !== undefined){
      if((counts[entry.k]||0) >= restr[rKey]) return false;
    }
    // rare items: max 1 fleet-wide
    if(entry.rare && (counts[entry.k]||0) >= 1) return false;
    return true;
  }
  function add(entry){
    if(canAdd(entry)){
      out.push(entry.k);
      counts[entry.k] = (counts[entry.k]||0)+1;
      budget -= entry.pw;
    }
  }

  // Add one rare capital/carrier if budget allows and not already in fleet
  for(const e of combat.filter(e=>e.rare)){
    if(budget >= e.pw && Math.random()<0.4) add(e);
  }
  // Fill with mid-tier ships
  for(const e of combat.filter(e=>!e.rare).sort((a,b)=>b.pw-a.pw)){
    while(budget >= e.pw && Math.random()<0.6) add(e);
  }
  // Add some craft
  if(craft.length){
    const maxCraft = Math.min(4, Math.floor(budget));
    for(let i=0;i<maxCraft;i++) add(craft[Math.floor(Math.random()*craft.length)]);
  }

  // Always ensure at least 2 ships for basic planets
  if(out.length === 0 && combat.length){
    const cheap = combat.filter(e=>!e.rare).sort((a,b)=>a.pw-b.pw);
    if(cheap.length) out.push(cheap[0].k);
  }

  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// Campaign state
// ═══════════════════════════════════════════════════════════════════════
let CS = null; // current campaign state

function newCampaignState(campDef){
  const gal = generateGalaxy(campDef);
  const state = {
    campId: campDef.id,
    turn: 1,
    phase: 'player', // 'player' | 'ai' | 'result'
    galaxy: gal,
    factions: {},
    credits: {},
    selectedPlanet: null,
    pendingAttack: null,  // {from, to} planet ids
    log: [],
    victory: null,  // null | 'win' | 'lose'
  };
  // Init faction states
  for(const [fid, fd] of Object.entries(campDef.factions)){
    state.factions[fid] = { ...fd };
    state.credits[fid] = fd.startPlanets * 3; // starting credits
  }
  return state;
}

// ═══════════════════════════════════════════════════════════════════════
// Campaign UI renderer
// ═══════════════════════════════════════════════════════════════════════
const MAP_CONTAINER = document.getElementById('campaignMap');

function startCampaign(campId){
  const campDef = CAMPAIGNS_DATA.find(c=>c.id===campId);
  if(!campDef) return;

  // Check for saved state
  const savedKey = 'campaign_save_'+campId;
  const saved = (() => { try{ const r=sessionStorage.getItem(savedKey); return r?JSON.parse(r):null; }catch(e){return null;} })();
  if(saved){
    if(confirm('Resume saved campaign?')){ CS = saved; }
    else { CS = newCampaignState(campDef); }
  } else {
    CS = newCampaignState(campDef);
  }
  CS._campDef = campDef;
  // Hide main menu elements so they don't affect layout
  document.getElementById('mainMenu').style.display = 'none';
  document.getElementById('campaignSelect').style.display = 'none';
  MAP_CONTAINER.style.display = 'flex';
  renderCampaignMap();
  checkVictory();
}
window.startCampaign = startCampaign;

// ── CSS injected once ──────────────────────────────────────────────────
const MAP_CSS = `
#campaignMap { flex-direction:column; overflow:hidden; }
#cm-topbar { height:52px;display:flex;align-items:center;gap:12px;padding:0 16px;
  border-bottom:1px solid rgba(30,50,110,.7);background:rgba(4,8,22,.95);flex-shrink:0; }
#cm-topbar .cm-brand { font-size:14px;font-weight:700;color:#cce4ff;margin-right:8px; }
#cm-topbar .cm-sep { width:1px;height:22px;background:rgba(40,60,130,.5); }
.cm-stat { font-size:11px;color:#556688; } .cm-stat b { color:#aaccff; }
#cm-turn-info { margin-left:auto;font-size:12px;color:#5a7799; }
.cm-btn { padding:7px 14px;border-radius:8px;border:1px solid rgba(90,150,255,.35);
  background:rgba(10,20,50,.7);color:#ddeeff;font-size:12px;cursor:pointer;font-family:inherit;
  font-weight:600;transition:.15s;white-space:nowrap; }
.cm-btn:hover { border-color:#5aa7ff;background:rgba(20,50,120,.7); }
.cm-btn.gold { border-color:rgba(255,200,40,.4);color:#ffd228; }
.cm-btn.gold:hover { border-color:rgba(255,200,40,.9);background:rgba(40,28,0,.7); }
.cm-btn.danger { border-color:rgba(255,80,80,.4);color:#ff7777; }
.cm-btn.danger:hover { border-color:#ff5b5b; }
#cm-body { flex:1;display:flex;overflow:hidden; }
#cm-sidebar { width:260px;flex-shrink:0;border-right:1px solid rgba(20,40,90,.7);
  background:rgba(4,8,20,.9);display:flex;flex-direction:column;overflow-y:auto; }
#cm-map-area { flex:1;position:relative;overflow:hidden; }
#cm-canvas { display:block;position:absolute;top:0;left:0; }
/* sidebar */
.cm-section { padding:12px 14px;border-bottom:1px solid rgba(15,30,70,.6); }
.cm-section h3 { font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#5aa7ff;
  margin-bottom:10px;font-weight:700; }
.cm-planet-info { }
.pi-name { font-size:16px;font-weight:800;color:#ddeeff;margin-bottom:4px; }
.pi-owner { font-size:11px;font-weight:600;margin-bottom:8px; }
.pi-stats { display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:11px;margin-bottom:10px; }
.pi-stat { background:rgba(15,28,65,.6);border-radius:6px;padding:5px 8px; }
.pi-stat-l { font-size:9px;color:#445566;text-transform:uppercase;letter-spacing:.5px; }
.pi-stat-v { font-size:13px;font-weight:700;color:#aaccff;margin-top:1px; }
.pi-fleet { font-size:10px;color:#5a7799;line-height:1.7;max-height:120px;overflow-y:auto; }
.pi-fleet b { color:#8899bb; }
.pi-actions { display:flex;flex-direction:column;gap:6px;margin-top:10px; }
/* log */
#cm-log { padding:0 14px;flex:1;overflow-y:auto; }
#cm-log h3 { font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#5aa7ff;
  margin:12px 0 8px;font-weight:700;position:sticky;top:0;background:rgba(4,8,20,.9);padding:6px 0; }
.log-entry { font-size:11px;color:#556688;margin-bottom:5px;padding:4px 8px;
  border-radius:4px;border-left:2px solid rgba(40,70,150,.3);line-height:1.5; }
.log-entry.player { border-color:rgba(90,150,255,.5);color:#7799cc; }
.log-entry.enemy { border-color:rgba(200,60,60,.5);color:#cc7777; }
.log-entry.win { border-color:rgba(60,220,150,.5);color:#6ddfaa; }
.log-entry.lose { border-color:rgba(220,60,60,.5);color:#ff7777; }
.log-entry.neutral { border-color:rgba(255,200,40,.4);color:#ccaa44; }
.log-entry.info { border-color:rgba(100,100,150,.3);color:#667799; }
/* victory overlay */
#cm-victory { position:absolute;inset:0;background:rgba(0,0,0,.8);display:flex;
  align-items:center;justify-content:center;z-index:100;display:none; }
.cv-card { background:linear-gradient(160deg,#090f22,#050810);
  border:1px solid rgba(90,150,255,.4);border-radius:18px;padding:36px 40px;
  text-align:center;max-width:440px; }
.cv-title { font-size:32px;font-weight:900;margin-bottom:10px; }
.cv-sub { font-size:15px;color:#8899bb;margin-bottom:24px;line-height:1.5; }
.cv-btns { display:flex;gap:12px;justify-content:center; }
/* phase banner */
#cm-phase-banner { position:absolute;top:12px;left:50%;transform:translateX(-50%);
  background:rgba(8,16,40,.9);border:1px solid rgba(90,150,255,.35);border-radius:99px;
  padding:6px 20px;font-size:12px;color:#aaccff;font-weight:600;pointer-events:none;
  white-space:nowrap; }
/* restrictions badge */
.restr-badge { font-size:9px;color:#cc9944;background:rgba(200,150,40,.08);
  border:1px solid rgba(200,150,40,.25);border-radius:4px;padding:2px 7px;margin-top:6px;display:inline-block; }
`;
(function injectCSS(){
  const s = document.createElement('style');
  s.textContent = MAP_CSS;
  document.head.appendChild(s);
})();

// ── Cheat key handler ─────────────────────────────────────────────────
function _cheatKeyHandler(e){
  if(!CS || CS.victory) return;
  const cd = CS._campDef;
  if(!cd) return;
  const playerFid = Object.keys(cd.factions).find(f=>cd.factions[f].role==='player');

  // $ (Shift+4) → +500 credits
  if(e.key === '$'){
    CS.credits[playerFid] = (CS.credits[playerFid]||0) + 500;
    updateHUD();
    showCheatToast('💰 +500 Credits');
    saveState();
  }
  // ^ (Shift+6) → +2000 credits (big cheat)
  if(e.key === '^'){
    CS.credits[playerFid] = (CS.credits[playerFid]||0) + 2000;
    updateHUD();
    showCheatToast('💰💰 +2000 Credits');
    saveState();
  }
  // * → reveal all planet fleets (just a log dump)
  if(e.key === '*'){
    const enemies = CS.galaxy.planets.filter(p=>p.owner!==playerFid&&p.owner!=='neutral');
    let msg = 'INTEL: ';
    for(const p of enemies) msg += `${p.name}(${p.garrison.length}) `;
    addLog('🔍 '+msg.trim(), 'info');
    showCheatToast('🔍 Intel revealed in log');
  }
}

function showCheatToast(msg){
  let toast = document.getElementById('cm-cheat-toast');
  if(!toast){
    toast = document.createElement('div');
    toast.id = 'cm-cheat-toast';
    toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:rgba(30,60,10,.95);border:1px solid rgba(100,220,80,.5);border-radius:99px;
      padding:9px 22px;font-size:13px;font-weight:700;color:#88ee44;z-index:9999;
      pointer-events:none;transition:opacity .4s`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>{ toast.style.opacity='0'; }, 1800);
}

// ── Main render ────────────────────────────────────────────────────────
function renderCampaignMap(){
  const cd = CS._campDef;
  MAP_CONTAINER.innerHTML = `
    <div id="cm-topbar">
      <span class="cm-brand">🌌 ${cd.name}</span>
      <div class="cm-sep"></div>
      <span class="cm-stat">Turn: <b id="cm-turn">1</b></span>
      <div class="cm-sep"></div>
      <span class="cm-stat">Credits: <b id="cm-credits">0</b></span>
      <div class="cm-sep"></div>
      <span class="cm-stat">Planets: <b id="cm-myplanets">0</b></span>
      <div class="cm-sep"></div>
      <span id="cm-turn-info" class="cm-stat"></span>
      <div class="cm-sep"></div>
      <button class="cm-btn gold" id="cm-end-turn">End Turn →</button>
      <button class="cm-btn" id="cm-reinforce">⚙ Reinforce</button>
      <button class="cm-btn danger" id="cm-quit">✕ Quit</button>
    </div>
    <div id="cm-body">
      <div id="cm-sidebar">
        <div class="cm-section" id="cm-planet-panel">
          <h3>Select a Planet</h3>
          <div style="font-size:11px;color:#445566;line-height:1.6">
            Click any planet on the map to view details and issue orders.
          </div>
        </div>
        <div id="cm-log"><h3>Battle Log</h3></div>
      </div>
      <div id="cm-map-area">
        <canvas id="cm-canvas"></canvas>
        <div id="cm-phase-banner">Your Turn — Select a planet</div>
        <div id="cm-victory">
          <div class="cv-card">
            <div class="cv-title" id="cv-title"></div>
            <div class="cv-sub" id="cv-sub"></div>
            <div class="cv-btns">
              <button class="cm-btn gold" id="cv-menu">Main Menu</button>
              <button class="cm-btn" id="cv-again">New Campaign</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire UI
  document.getElementById('cm-end-turn').addEventListener('click', endPlayerTurn);
  document.getElementById('cm-reinforce').addEventListener('click', openReinforce);
  document.getElementById('cm-quit').addEventListener('click', ()=>{
    if(confirm('Quit this campaign? Progress will be lost.')) {
      MAP_CONTAINER.style.display = 'none';
      window._menuShowCampaignSelect?.();
    }
  });
  document.getElementById('cv-menu').addEventListener('click', ()=>{
    MAP_CONTAINER.style.display='none';
    window._menuShowMain?.();
  });
  document.getElementById('cv-again').addEventListener('click', ()=>{
    MAP_CONTAINER.style.display='none';
    window._menuShowCampaignSelect?.();
  });

  // ── Cheat codes ──────────────────────────────────────────────────────
  // $ (Shift+4) = +500 credits
  // ^ (Shift+6) = +2000 credits (big cheat)
  document.addEventListener('keydown', _cheatKeyHandler);

  setupCanvas();
  updateHUD();
  addLog('Campaign started. Select a planet to begin.','info');
}

// ── Canvas galaxy map ─────────────────────────────────────────────────
let mapCanvas, mapCtx, mapScale=1, mapOX=0, mapOY=0;

function setupCanvas(){
  mapCanvas = document.getElementById('cm-canvas');
  mapCtx    = mapCanvas.getContext('2d');

  function resizeCanvas(){
    const area = document.getElementById('cm-map-area');
    if(!area) return;
    // Read from offsetWidth/Height which are always integer pixel values
    const w = area.offsetWidth;
    const h = area.offsetHeight;
    if(w < 10 || h < 10) return; // layout not ready yet
    mapCanvas.width  = w;
    mapCanvas.height = h;
    fitGalaxy();
    drawMap();
  }
  window.addEventListener('resize', resizeCanvas);
  // Wait for layout to fully settle using rAF instead of blind timeout
  requestAnimationFrame(() => requestAnimationFrame(resizeCanvas));

  mapCanvas.addEventListener('click', onMapClick);
  mapCanvas.addEventListener('mousemove', onMapHover);
  mapCanvas._hoverPlanet = null;
}

function fitGalaxy(){
  if(!mapCanvas||!CS) return;
  const {W, H} = CS.galaxy;
  const pad = 40;
  const sx = (mapCanvas.width  - pad*2) / W;
  const sy = (mapCanvas.height - pad*2) / H;
  mapScale = Math.min(sx, sy);
  mapOX = pad + (mapCanvas.width  - pad*2 - W*mapScale)/2;
  mapOY = pad + (mapCanvas.height - pad*2 - H*mapScale)/2;
}

function gToS(gx, gy){ return { x: mapOX + gx*mapScale, y: mapOY + gy*mapScale }; }
function sToG(sx, sy){ return { x:(sx-mapOX)/mapScale, y:(sy-mapOY)/mapScale }; }

function drawMap(){
  if(!mapCanvas||!mapCtx||!CS) return;
  const ctx = mapCtx;
  ctx.clearRect(0,0,mapCanvas.width,mapCanvas.height);

  const {planets, lanes} = CS.galaxy;
  const cd = CS._campDef;

  // Background gradient
  const bg = ctx.createRadialGradient(mapCanvas.width/2,mapCanvas.height/2,0,mapCanvas.width/2,mapCanvas.height/2,mapCanvas.width*0.7);
  bg.addColorStop(0,'rgba(8,14,38,.95)');
  bg.addColorStop(1,'rgba(2,4,14,1)');
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,mapCanvas.width,mapCanvas.height);

  // Unknown region shading
  if(cd.unknownRegion){
    const {W} = CS.galaxy;
    const sx0 = gToS(W-160, 0);
    const sx1 = gToS(W, CS.galaxy.H);
    const rg = ctx.createLinearGradient(sx0.x,0,mapCanvas.width,0);
    rg.addColorStop(0,'rgba(120,20,20,0)');
    rg.addColorStop(1,'rgba(120,20,20,.18)');
    ctx.fillStyle = rg;
    ctx.fillRect(sx0.x, 0, mapCanvas.width-sx0.x, mapCanvas.height);
    ctx.fillStyle = 'rgba(180,30,30,.12)';
    ctx.font = '10px ui-sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('UNKNOWN REGIONS', mapCanvas.width-8, mapCanvas.height-8);
    ctx.textAlign = 'left';
  }

  // Draw lanes
  for(const lane of lanes){
    const a = planets[lane.a], b = planets[lane.b];
    const sA = gToS(a.x,a.y), sB = gToS(b.x,b.y);
    // Colour lanes between same owner
    const sameOwner = a.owner && b.owner && a.owner===b.owner && a.owner!=='neutral';
    const ownerCol = sameOwner ? CF[a.owner]?.color : null;
    ctx.beginPath();
    ctx.moveTo(sA.x,sA.y); ctx.lineTo(sB.x,sB.y);
    ctx.strokeStyle = ownerCol ? ownerCol+'44' : 'rgba(40,70,150,.18)';
    ctx.lineWidth = sameOwner ? 1.5 : 0.8;
    ctx.stroke();
  }

  // Draw planets
  for(const p of planets){
    const s = gToS(p.x,p.y);
    const r = p.isCapital ? 10 : 7;
    const isSelected = CS.selectedPlanet === p.id;
    const isHover    = mapCanvas._hoverPlanet === p.id;
    const isAttackTarget = CS.pendingAttack?.to === p.id;
    const col = p.owner==='neutral' ? '#445566' : (CF[p.owner]?.color || '#aabbcc');

    // Glow for selected/hover
    if(isSelected||isHover){
      ctx.beginPath(); ctx.arc(s.x,s.y,r+5,0,Math.PI*2);
      ctx.fillStyle = isSelected ? col+'44' : col+'22';
      ctx.fill();
    }
    if(isAttackTarget){
      ctx.beginPath(); ctx.arc(s.x,s.y,r+7,0,Math.PI*2);
      ctx.strokeStyle = '#ff4a4a88';
      ctx.lineWidth = 2;
      ctx.setLineDash([4,3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Planet circle
    ctx.beginPath(); ctx.arc(s.x,s.y,r,0,Math.PI*2);
    const pg = ctx.createRadialGradient(s.x-r*0.3,s.y-r*0.3,r*0.1,s.x,s.y,r);
    pg.addColorStop(0, lighten(col,.6));
    pg.addColorStop(1, col);
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#ffffff88' : col+'88';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();

    // Capital star
    if(p.isCapital){
      ctx.fillStyle = '#ffffff99';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', s.x, s.y+3);
    }

    // Fleet size dot
    if(p.garrison && p.garrison.length > 0){
      const gs = gToS(p.x + (p.isCapital?12:9), p.y - (p.isCapital?10:8));
      ctx.beginPath(); ctx.arc(gs.x,gs.y,4,0,Math.PI*2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(Math.min(p.garrison.length,99), gs.x, gs.y+2);
    }

    // Planet name
    const nameY = s.y + r + 12;
    ctx.fillStyle = isSelected ? '#ddeeff' : '#8899bb';
    ctx.font = `${p.isCapital?'bold ':''} ${isSelected?11:9}px ui-sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(p.name, s.x, nameY);
  }

  // Pending attack arrow
  if(CS.pendingAttack){
    const a = planets[CS.pendingAttack.from], b = planets[CS.pendingAttack.to];
    if(a&&b){
      const sA = gToS(a.x,a.y), sB = gToS(b.x,b.y);
      drawArrow(ctx, sA.x,sA.y, sB.x,sB.y, '#ff4a4a');
    }
  }
}

function drawArrow(ctx, x1,y1,x2,y2, color){
  const ang = Math.atan2(y2-y1,x2-x1);
  const len = Math.hypot(x2-x1,y2-y1);
  const ax  = x1 + Math.cos(ang)*(len-20);
  const ay  = y1 + Math.sin(ang)*(len-20);
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(ax,ay);
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.setLineDash([5,4]); ctx.stroke(); ctx.setLineDash([]);
  // arrowhead
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2-12*Math.cos(ang-0.4), y2-12*Math.sin(ang-0.4));
  ctx.lineTo(x2-12*Math.cos(ang+0.4), y2-12*Math.sin(ang+0.4));
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}

function lighten(hex, amt){
  const n = parseInt(hex.replace('#',''),16);
  const r = Math.min(255,((n>>16)&0xff)+Math.round(255*amt));
  const g = Math.min(255,((n>>8)&0xff)+Math.round(255*amt));
  const b = Math.min(255,(n&0xff)+Math.round(255*amt));
  return `rgb(${r},${g},${b})`;
}

function onMapClick(e){
  if(CS.phase !== 'player') return;
  const rect = mapCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const gp = sToG(mx, my);
  const hit = pickPlanet(gp.x, gp.y);

  const cd = CS._campDef;
  const playerFid = Object.keys(cd.factions).find(f=>cd.factions[f].role==='player');

  // Clicked empty space — cancel everything
  if(hit === null){
    CS.pendingAttack = null;
    CS.selectedPlanet = null;
    document.getElementById('cm-phase-banner').textContent = 'Your Turn — Select a planet';
    renderSidebar();
    drawMap();
    return;
  }

  const planet = CS.galaxy.planets[hit];

  // ── ATTACK TARGET SELECTION MODE ──────────────────────────────────────
  // We are waiting for the player to pick a target (pendingAttack.from set, .to null)
  if(CS.pendingAttack && CS.pendingAttack.from !== null && CS.pendingAttack.to === null){

    // Clicked the source planet itself — cancel attack mode
    if(hit === CS.pendingAttack.from){
      CS.pendingAttack = null;
      CS.selectedPlanet = hit;
      document.getElementById('cm-phase-banner').textContent = 'Your Turn — Select a planet';
      renderSidebar();
      drawMap();
      return;
    }

    // Clicked another own planet — switch attack source to this planet
    if(planet.owner === playerFid){
      const adjEnemy2 = CS.galaxy.lanes
        .filter(l=>l.a===hit||l.b===hit)
        .map(l=>l.a===hit?l.b:l.a)
        .filter(id=>CS.galaxy.planets[id].owner !== playerFid);
      if(adjEnemy2.length > 0 && planet.garrison.length >= 1){
        CS.pendingAttack = {from: hit, to: null};
        CS.selectedPlanet = hit;
        document.getElementById('cm-phase-banner').textContent = `Select target to attack from ${planet.name}`;
        renderSidebar();
        drawMap();
      } else {
        CS.pendingAttack = null;
        CS.selectedPlanet = hit;
        document.getElementById('cm-phase-banner').textContent = 'Your Turn — Select a planet';
        renderSidebar();
        drawMap();
      }
      return;
    }

    // Clicked an enemy/neutral planet — check adjacency
    const connected = CS.galaxy.lanes.some(l=>
      (l.a===CS.pendingAttack.from && l.b===hit) ||
      (l.b===CS.pendingAttack.from && l.a===hit)
    );
    if(!connected){
      addLog(`${planet.name} is not connected to your attack origin — pick an adjacent planet.`, 'info');
      // Stay in attack-select mode, don't cancel
      drawMap();
      return;
    }

    // Valid target — set it and show confirm
    CS.pendingAttack.to = hit;
    CS.selectedPlanet = hit;
    document.getElementById('cm-phase-banner').textContent = `Confirm attack on ${planet.name}`;
    renderSidebar(true);
    drawMap();
    return;
  }

  // ── NORMAL SELECTION ──────────────────────────────────────────────────
  CS.pendingAttack = null;
  CS.selectedPlanet = hit;
  document.getElementById('cm-phase-banner').textContent = 'Your Turn — Select a planet';
  renderSidebar();
  drawMap();
}

function onMapHover(e){
  const rect = mapCanvas.getBoundingClientRect();
  const gp = sToG(e.clientX-rect.left, e.clientY-rect.top);
  const hit = pickPlanet(gp.x,gp.y);
  if(hit !== mapCanvas._hoverPlanet){
    mapCanvas._hoverPlanet = hit;
    mapCanvas.style.cursor = hit !== null ? 'pointer' : 'default';
    drawMap();
  }
}

function pickPlanet(gx, gy){
  const hitR = 14 / mapScale;
  for(const p of CS.galaxy.planets){
    if(Math.hypot(p.x-gx,p.y-gy) < hitR) return p.id;
  }
  return null;
}

// ── Sidebar ────────────────────────────────────────────────────────────
function renderSidebar(showAttackConfirm=false){
  const panel = document.getElementById('cm-planet-panel');
  if(!panel) return;
  const cd = CS._campDef;
  const playerFid = Object.keys(cd.factions).find(f=>cd.factions[f].role==='player');

  if(CS.selectedPlanet === null){ panel.innerHTML='<h3>Select a Planet</h3><div style="font-size:11px;color:#445566">Click any planet on the map to view details.</div>'; return; }

  const p = CS.galaxy.planets[CS.selectedPlanet];
  const isOwn = p.owner === playerFid;
  const isNeutral = p.owner === 'neutral';
  const isEnemy = !isOwn && !isNeutral;
  const ownerName = p.owner==='neutral' ? 'Unclaimed' : (CF[p.owner]?.name || p.owner);
  const ownerCol  = p.owner==='neutral' ? '#445566' : (CF[p.owner]?.color || '#aabbcc');
  const cd2 = CS._campDef;
  const neutralFids = cd2.neutralFactions||[];
  const isNeutralFaction = neutralFids.includes(p.owner);
  const garrisonByType = {};
  for(const k of (p.garrison||[])) garrisonByType[k]=(garrisonByType[k]||0)+1;
  const garrisonHtml = Object.entries(garrisonByType).map(([k,n])=>`<b>${n}×</b> ${k}`).join('<br>');

  let html = `
    <h3>${isOwn?'Your Planet':isNeutralFaction?'Neutral (Armed)':isNeutral?'Unclaimed':'Enemy Planet'}</h3>
    <div class="cm-planet-info">
      <div class="pi-name">${p.name}${p.isCapital?' ★':''}</div>
      <div class="pi-owner" style="color:${ownerCol}">${ownerName}</div>
      <div class="pi-stats">
        <div class="pi-stat"><div class="pi-stat-l">Income</div><div class="pi-stat-v">${p.income} cr/turn</div></div>
        <div class="pi-stat"><div class="pi-stat-l">Fleet</div><div class="pi-stat-v">${(p.garrison||[]).length} ships</div></div>
      </div>
      <div class="pi-fleet">${garrisonHtml||'No garrison'}</div>
      <div class="pi-actions">
  `;

  if(showAttackConfirm && CS.pendingAttack?.to === p.id){
    const src = CS.galaxy.planets[CS.pendingAttack.from];
    html += `
      <div style="font-size:11px;color:#cc7777;padding:8px;background:rgba(200,60,60,.08);border:1px solid rgba(200,60,60,.2);border-radius:8px;margin-bottom:8px">
        <b>Attack ${p.name}?</b><br>
        Launching from <b>${src.name}</b><br>
        <span style="color:#556688">Your fleet: ${src.garrison.length} ships vs ${p.garrison.length} defenders</span>
      </div>
      <button class="cm-btn" id="btn-confirm-attack" style="background:rgba(200,60,60,.15);border-color:rgba(200,60,60,.5);color:#ff7777">⚔ Confirm Attack</button>
      <button class="cm-btn" id="btn-cancel-attack">Cancel</button>
    `;
  } else if(isOwn){
    // Check adjacent unowned for attack
    const adjEnemy = CS.galaxy.lanes
      .filter(l=>l.a===p.id||l.b===p.id)
      .map(l=>l.a===p.id?l.b:l.a)
      .filter(id=>CS.galaxy.planets[id].owner !== playerFid);
    if(adjEnemy.length > 0 && p.garrison.length >= 1){
      html += `<button class="cm-btn" id="btn-launch-attack" style="background:rgba(200,60,60,.15);border-color:rgba(200,60,60,.4);color:#ff7777">⚔ Attack Adjacent</button>`;
    }
    if(p.garrison.length === 0){
      html += `<div style="font-size:10px;color:#556688;padding:4px">No ships here. Use Reinforce to add ships.</div>`;
    }
    html += `<button class="cm-btn" id="btn-reinforce-here">⚙ Reinforce Planet</button>`;
  } else if((isEnemy || isNeutral) && !isNeutralFaction){
    // Find adjacent own planet
    const adjOwn = CS.galaxy.lanes
      .filter(l=>l.a===p.id||l.b===p.id)
      .map(l=>l.a===p.id?l.b:l.a)
      .find(id=>CS.galaxy.planets[id].owner === playerFid);
    if(adjOwn !== undefined){
      html += `<button class="cm-btn" style="background:rgba(200,60,60,.15);border-color:rgba(200,60,60,.4);color:#ff7777"
        id="btn-quick-attack" data-from="${adjOwn}">⚔ Attack from ${CS.galaxy.planets[adjOwn].name}</button>`;
    } else {
      html += `<div style="font-size:10px;color:#445566;padding:4px">No adjacent friendly planet to attack from.</div>`;
    }
  } else if(isNeutralFaction){
    html += `<div class="restr-badge">⚠ Neutral faction — attacks politically costly</div>`;
    const adjOwn = CS.galaxy.lanes
      .filter(l=>l.a===p.id||l.b===p.id)
      .map(l=>l.a===p.id?l.b:l.a)
      .find(id=>CS.galaxy.planets[id].owner === playerFid);
    if(adjOwn !== undefined){
      html += `<button class="cm-btn" style="background:rgba(200,60,60,.1);border-color:rgba(200,60,60,.3);color:#cc7777;margin-top:6px"
        id="btn-quick-attack" data-from="${adjOwn}">⚔ Attack Neutral</button>`;
    }
  }

  html += '</div></div>';
  panel.innerHTML = html;

  document.getElementById('btn-confirm-attack')?.addEventListener('click', ()=>{
    launchBattle(CS.pendingAttack.from, CS.pendingAttack.to);
  });
  document.getElementById('btn-cancel-attack')?.addEventListener('click', ()=>{
    const prevFrom = CS.pendingAttack?.from ?? null;
    CS.pendingAttack = null;
    CS.selectedPlanet = prevFrom;
    document.getElementById('cm-phase-banner').textContent = 'Your Turn — Select a planet';
    renderSidebar(); drawMap();
  });
  document.getElementById('btn-launch-attack')?.addEventListener('click', ()=>{
    CS.pendingAttack = {from: p.id, to: null};
    document.getElementById('cm-phase-banner').textContent = `Select target to attack from ${p.name}`;
    drawMap();
  });
  document.getElementById('btn-reinforce-here')?.addEventListener('click', ()=>{ openReinforce(p.id); });
  document.getElementById('btn-quick-attack')?.addEventListener('click', (e)=>{
    const fromId = parseInt(e.currentTarget.dataset.from);
    CS.pendingAttack = {from:fromId, to:p.id};
    drawMap();
    renderSidebar(true);
  });
}

// ── HUD update ─────────────────────────────────────────────────────────
function updateHUD(){
  if(!CS) return;
  const cd = CS._campDef;
  const playerFid = Object.keys(cd.factions).find(f=>cd.factions[f].role==='player');
  const myPlanets = CS.galaxy.planets.filter(p=>p.owner===playerFid).length;
  const myCredits = CS.credits[playerFid]||0;

  const turnEl = document.getElementById('cm-turn');
  const credEl = document.getElementById('cm-credits');
  const planEl = document.getElementById('cm-myplanets');
  const infoEl = document.getElementById('cm-turn-info');

  if(turnEl) turnEl.textContent = CS.turn;
  if(credEl) credEl.textContent = myCredits;
  if(planEl) planEl.textContent = myPlanets;
  if(infoEl){
    const diff = CD()?.difficulty||'';
    infoEl.textContent = `${CD()?.name||''} · ${diff}`;
  }
}
function CD(){ return CS?._campDef; }

// ── Reinforce panel ────────────────────────────────────────────────────
function openReinforce(planetId){
  const cd = CS._campDef;
  const playerFid = Object.keys(cd.factions).find(f=>cd.factions[f].role==='player');
  const myPlanets = CS.galaxy.planets.filter(p=>p.owner===playerFid);
  const target    = planetId !== undefined ? CS.galaxy.planets[planetId] : null;
  const credits   = CS.credits[playerFid]||0;

  const restr = cd.restrictions?.[playerFid]||{};
  const pool  = FLEET_POOLS[playerFid]||[];

  // Count current fleet-wide caps
  const fleetCounts = {};
  for(const p of myPlanets) for(const k of p.garrison) fleetCounts[k]=(fleetCounts[k]||0)+1;

  // Build modal
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:linear-gradient(160deg,#090f22,#050810);border:1px solid rgba(90,150,255,.4);border-radius:14px;padding:24px;width:min(520px,94vw);max-height:85vh;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <h3 style="font-size:16px;font-weight:800;color:#ddeeff">⚙ Reinforce Fleet</h3>
        <button id="rf-close" class="cm-btn">✕</button>
      </div>
      <div style="font-size:12px;color:#556688">Credits: <b style="color:#aaccff">${credits} cr</b>  ·  Deploy to: <b style="color:#aaccff">${target?.name||'any friendly planet'}</b></div>
      <div id="rf-list" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px"></div>
      <div style="font-size:10px;color:#445566">Ship costs: Scout=1cr · Craft=1cr · Strike=2cr · Screen=3cr · Escort=5cr · Carrier=8cr · Capital=10cr · Station=15cr</div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('#rf-close').addEventListener('click',()=>modal.remove());

  const SHIP_COSTS = {station:15, capital:10, carrier:8, escort:5, screen:3, strike:2, craft:1};
  const list = modal.querySelector('#rf-list');

  function buildList(){
    list.innerHTML='';
    const pool2 = FLEET_POOLS[playerFid]||[];
    for(const entry of pool2){
      const cost = SHIP_COSTS[entry.role]||2;
      const rKey = 'max_'+entry.k;
      const cap = restr[rKey];
      const cur = fleetCounts[entry.k]||0;
      const atCap = cap !== undefined && cur >= cap;
      const canAfford = credits >= cost;

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;border:1px solid rgba(30,55,120,.4);background:rgba(8,16,40,.6)';
      row.innerHTML = `
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;color:${atCap?'#556688':'#ddeeff'}">${entry.k.replace(/_/g,' ')}</div>
          <div style="font-size:10px;color:#445566">${entry.role} · ${cost} cr · Fleet: ${cur}${cap!==undefined?' / '+cap:''}</div>
        </div>
        <button class="cm-btn rf-buy" data-key="${entry.k}" data-cost="${cost}"
          style="${atCap?'opacity:.35;cursor:not-allowed':''}${!canAfford?';opacity:.5':''}">
          ${atCap?'⚠ Cap':'Buy '+cost+'cr'}
        </button>
      `;
      list.appendChild(row);
    }
    list.querySelectorAll('.rf-buy').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const k = btn.dataset.key;
        const cost2 = parseInt(btn.dataset.cost);
        const cur2 = fleetCounts[k]||0;
        const rKey2 = 'max_'+k;
        const cap2 = restr[rKey2];
        if(cap2 !== undefined && cur2 >= cap2){ alert('Fleet cap reached for '+k); return; }
        if(CS.credits[playerFid] < cost2){ alert('Not enough credits!'); return; }
        // Find target planet
        const dest = target || myPlanets[0];
        if(!dest){ alert('No friendly planets to deploy to!'); return; }
        dest.garrison.push(k);
        fleetCounts[k]=(fleetCounts[k]||0)+1;
        CS.credits[playerFid] -= cost2;
        addLog(`Deployed ${k} to ${dest.name} (-${cost2} cr)`,'player');
        modal.querySelector('div[style*="Credits"]').innerHTML = `Credits: <b style="color:#aaccff">${CS.credits[playerFid]} cr</b>  ·  Deploy to: <b style="color:#aaccff">${dest?.name||'any friendly planet'}</b>`;
        updateHUD();
        buildList();
        saveState();
        drawMap();
      });
    });
  }
  buildList();
}

// ── Battle launch ──────────────────────────────────────────────────────
function launchBattle(fromId, toId){
  const cd = CS._campDef;
  const playerFid = Object.keys(cd.factions).find(f=>cd.factions[f].role==='player');
  const attacker  = CS.galaxy.planets[fromId];
  const defender  = CS.galaxy.planets[toId];

  if(!attacker || !defender) return;
  if(attacker.garrison.length === 0){ addLog('No ships to attack with!','info'); return; }

  const defFid = defender.owner==='neutral' ? 'neutral' : defender.owner;
  const defFidActual = defender.owner==='neutral' ? 'empire' : defender.owner; // fallback for neutral

  addLog(`⚔ Attacking ${defender.name} from ${attacker.name}…`, 'player');

  // Build scenario for skirmish engine
  const W = 6200, H = 4200;
  const shipEntries = [];

  // Attacker ships (player side)
  attacker.garrison.forEach((k,i)=>{
    shipEntries.push({ defKey:k, faction:playerFid,
      x: W*0.18 + (i%6)*90, y: H*0.35 + Math.floor(i/6)*90 });
  });

  // Defender ships
  defender.garrison.forEach((k,i)=>{
    shipEntries.push({ defKey:k, faction:defFid==='neutral' ? defFidActual : defFid,
      x: W*0.78 + (i%6)*90, y: H*0.35 + Math.floor(i/6)*90 });
  });

  const scenario = { world:{w:W,h:H}, ships:shipEntries, camera:{x:W/2,y:H/2,zoom:0.4} };

  // Save attack context so we can resolve after battle
  try {
    sessionStorage.setItem('campaign_battle_scenario', JSON.stringify({ playerFaction:playerFid, scenario }));
    sessionStorage.setItem('campaign_attack_context', JSON.stringify({ fromId, toId, defFid: defFid==='neutral'?defFidActual:defFid, campId: cd.id }));
    sessionStorage.removeItem('campaign_battle_result');
    sessionStorage.removeItem('campaign_battle_pending');
    saveState();
    window.location.href = 'index.html';
  } catch(e){ alert('Error launching battle: '+e.message); }
}

// ── Battle result resolution (called on return from skirmish) ─────────
function resolveBattleResult(){
  let result = null, ctx2 = null;
  try {
    const rRaw = sessionStorage.getItem('campaign_battle_result');
    const cRaw = sessionStorage.getItem('campaign_attack_context');
    if(!rRaw || !cRaw) return false;
    result = JSON.parse(rRaw);
    ctx2   = JSON.parse(cRaw);
    sessionStorage.removeItem('campaign_battle_result');
    sessionStorage.removeItem('campaign_battle_pending');
    sessionStorage.removeItem('campaign_attack_context');
  } catch(e){ return false; }

  // Restore campaign state
  const savedKey = 'campaign_save_'+ctx2.campId;
  try {
    const saved = JSON.parse(sessionStorage.getItem(savedKey));
    if(saved){
      const def = CAMPAIGNS_DATA.find(c=>c.id===ctx2.campId);
      CS = saved; CS._campDef = def;
    }
  } catch(e){}
  if(!CS) return false;

  const attacker = CS.galaxy.planets[ctx2.fromId];
  const defender = CS.galaxy.planets[ctx2.toId];
  const cd = CS._campDef;
  const playerFid = Object.keys(cd.factions).find(f=>cd.factions[f].role==='player');

  if(result.playerWon){
    // Player captured planet
    const oldOwner = defender.owner;
    defender.owner = playerFid;
    // Attacker loses half fleet (combat losses)
    attacker.garrison = attacker.garrison.slice(0, Math.ceil(attacker.garrison.length * 0.55));
    // Defender garrison cleared
    defender.garrison = generateGarrison(playerFid, cd, 'small');
    addLog(`✓ Captured ${defender.name}! (was ${CF[oldOwner]?.name||oldOwner})`, 'win');
  } else {
    // Player lost the attack
    // Attacker loses most fleet
    attacker.garrison = attacker.garrison.slice(0, Math.ceil(attacker.garrison.length * 0.25));
    // Defender loses some
    defender.garrison = defender.garrison.slice(0, Math.ceil(defender.garrison.length * 0.6));
    addLog(`✗ Attack on ${defender.name} failed — fleet retreats.`, 'lose');
  }

  CS.pendingAttack = null;
  CS.selectedPlanet = null;
  saveState();
  MAP_CONTAINER.style.display='flex';
  renderCampaignMap();
  checkVictory();
  return true;
}

// ── End player turn / AI turn ──────────────────────────────────────────
function endPlayerTurn(){
  CS.phase = 'ai';
  document.getElementById('cm-phase-banner').textContent = 'AI Turn…';
  // Collect income
  collectIncome();
  // Run AI for each AI faction
  const cd = CS._campDef;
  const playerFid = Object.keys(cd.factions).find(f=>cd.factions[f].role==='player');

  const aiFids = Object.keys(cd.factions).filter(f=>cd.factions[f].ai && cd.factions[f].role !== 'neutral');
  const neutralFids = cd.neutralFactions||[];
  // Allies also take their turn (attack enemies)
  const allAiFids = Object.keys(cd.factions).filter(f=>cd.factions[f].ai);

  setTimeout(()=>{
    let aiDelay = 0;
    for(const fid of allAiFids){
      setTimeout(()=>runAI(fid, playerFid, cd), aiDelay);
      aiDelay += 400;
    }
    setTimeout(()=>{
      // AI reinforcement
      for(const fid of allAiFids) aiReinforce(fid, cd);
      CS.turn++;
      CS.phase = 'player';
      document.getElementById('cm-phase-banner').textContent = 'Your Turn — Select a planet';
      updateHUD();
      drawMap();
      renderSidebar();
      checkVictory();
      saveState();
    }, aiDelay + 300);
  }, 100);
}

function collectIncome(){
  const cd = CS._campDef;
  for(const fid of Object.keys(cd.factions)){
    const income = CS.galaxy.planets.filter(p=>p.owner===fid).reduce((s,p)=>s+p.income,0);
    CS.credits[fid] = (CS.credits[fid]||0) + income;
  }
}

function runAI(fid, playerFid, cd){
  const aggression = cd.aiAggressiveness?.[fid] ?? 0.5;
  const neutralFids = cd.neutralFactions||[];
  const isNeutral = neutralFids.includes(fid);
  if(isNeutral) return; // neutral factions only attack if attacked (simplified: never attack)

  const isAlly = cd.factions[fid]?.role === 'ally';
  const myPlanets = CS.galaxy.planets.filter(p=>p.owner===fid);
  if(!myPlanets.length) return;

  // Decide targets: allies attack enemies of player, enemies attack player
  const hostileFids = isAlly
    ? Object.keys(cd.factions).filter(f=>cd.factions[f].role==='enemy')
    : [playerFid, ...Object.keys(cd.factions).filter(f=>f!==fid && cd.factions[f].team !== cd.factions[fid].team && !neutralFids.includes(f))];

  // Find attack opportunities
  const targets = [];
  for(const mp of myPlanets){
    if(mp.garrison.length < 2) continue;
    const adj = CS.galaxy.lanes
      .filter(l=>l.a===mp.id||l.b===mp.id)
      .map(l=>l.a===mp.id?l.b:l.a)
      .filter(id=>{
        const tp = CS.galaxy.planets[id];
        return hostileFids.includes(tp.owner) || tp.owner==='neutral';
      });
    for(const tid of adj) targets.push({from:mp.id, to:tid, myGarrison:mp.garrison.length});
  }

  if(!targets.length) return;
  // Pick best target (most favorable odds)
  targets.sort((a,b)=>(CS.galaxy.planets[b.from].garrison.length - CS.galaxy.planets[b.to].garrison.length) -
    (CS.galaxy.planets[a.from].garrison.length - CS.galaxy.planets[a.to].garrison.length));

  // Attempt attack based on aggression
  if(Math.random() < aggression){
    const t = targets[0];
    const atk = CS.galaxy.planets[t.from];
    const def = CS.galaxy.planets[t.to];
    // Simple resolution: power comparison
    const atkPow = atk.garrison.length + (Math.random()*4-2);
    const defPow = def.garrison.length + (Math.random()*3-1.5);
    const atkWins = atkPow > defPow;
    if(atkWins){
      const prevOwner = def.owner;
      def.owner = fid;
      atk.garrison = atk.garrison.slice(0, Math.ceil(atk.garrison.length * 0.60));
      def.garrison = generateGarrison(fid, cd, 'small');
      const isHostileToPlayer = hostileFids.includes(playerFid)&&fid!==playerFid;
      addLog(`${CF[fid]?.name||fid} captured ${def.name}${prevOwner===playerFid?' ⚠':''}`, isHostileToPlayer&&prevOwner===playerFid?'enemy':'info');
    } else {
      atk.garrison = atk.garrison.slice(0, Math.ceil(atk.garrison.length * 0.40));
      def.garrison = def.garrison.slice(0, Math.ceil(def.garrison.length * 0.70));
    }
  }
}

function aiReinforce(fid, cd){
  const credits = CS.credits[fid]||0;
  if(credits < 3) return;
  const pool = FLEET_POOLS[fid]||[];
  const restr = cd.restrictions?.[fid]||{};
  const myPlanets = CS.galaxy.planets.filter(p=>p.owner===fid);
  if(!myPlanets.length) return;
  const fleetCounts = {};
  for(const p of myPlanets) for(const k of p.garrison) fleetCounts[k]=(fleetCounts[k]||0)+1;

  // AI spends up to half income on reinforcements
  let budget = Math.floor(credits * 0.5);
  const SHIP_COSTS = {station:15, capital:10, carrier:8, escort:5, screen:3, strike:2, craft:1};
  const affordable = pool.filter(e=>{
    const cost = SHIP_COSTS[e.role]||2;
    if(cost > budget) return false;
    const rKey = 'max_'+e.k;
    const cap = restr[rKey];
    if(cap !== undefined && (fleetCounts[e.k]||0) >= cap) return false;
    return true;
  });
  if(!affordable.length) return;
  // Pick a random affordable ship, deploy to strongest planet
  const entry = affordable[Math.floor(Math.random()*affordable.length)];
  const cost  = SHIP_COSTS[entry.role]||2;
  const targetPlanet = myPlanets.sort((a,b)=>b.garrison.length-a.garrison.length)[0];
  targetPlanet.garrison.push(entry.k);
  CS.credits[fid] -= cost;
}

// ── Victory check ──────────────────────────────────────────────────────
function checkVictory(){
  if(!CS||!CS._campDef) return;
  const cd = CS._campDef;
  const playerFid = Object.keys(cd.factions).find(f=>cd.factions[f].role==='player');

  // Check win
  if(cd.winCondition === 'eliminate_faction'){
    const target = cd.winTarget;
    const targetPlanets = CS.galaxy.planets.filter(p=>p.owner===target).length;
    const targetFleet   = CS.galaxy.planets.reduce((s,p)=>s+(p.owner===target?p.garrison.length:0),0);
    if(targetPlanets === 0 && targetFleet === 0){
      showVictory(true, `${CF[target]?.name||target} has been eliminated. Victory!`);
      return;
    }
  }

  // Check lose — player has no planets
  const myPlanets = CS.galaxy.planets.filter(p=>p.owner===playerFid).length;
  if(myPlanets === 0){
    showVictory(false, 'All your planets have been captured. The fleet is destroyed.');
    return;
  }
}

function showVictory(won, msg){
  const vEl = document.getElementById('cm-victory');
  const tEl = document.getElementById('cv-title');
  const sEl = document.getElementById('cv-sub');
  if(!vEl||!tEl||!sEl) return;
  tEl.textContent = won ? '🏆 Victory' : '💀 Defeat';
  tEl.style.color  = won ? '#3ddc97' : '#ff5b5b';
  sEl.textContent  = msg;
  vEl.style.display = 'flex';
  CS.victory = won ? 'win' : 'lose';
  // Clear save on victory/defeat
  try { sessionStorage.removeItem('campaign_save_'+CS.campId); } catch(e){}
}

// ── Log ────────────────────────────────────────────────────────────────
function addLog(msg, type='info'){
  if(!CS) return;
  CS.log.push({msg,type,turn:CS?.turn||0});
  const log = document.getElementById('cm-log');
  if(!log) return;
  const el2 = document.createElement('div');
  el2.className = 'log-entry '+type;
  el2.innerHTML = `<span style="color:#334455">T${CS.turn}</span> ${msg}`;
  // Insert after h3
  const h3 = log.querySelector('h3');
  if(h3) log.insertBefore(el2, h3.nextSibling);
  else log.prepend(el2);
}

// ── Persist ────────────────────────────────────────────────────────────
function saveState(){
  if(!CS||!CS.campId) return;
  try {
    const toSave = { ...CS };
    delete toSave._campDef; // not serialisable
    sessionStorage.setItem('campaign_save_'+CS.campId, JSON.stringify(toSave));
  } catch(e){}
}

// ── On page load: check if returning from a battle ─────────────────────
(function onLoad(){
  const hasBattleResult = !!sessionStorage.getItem('campaign_battle_result');
  if(hasBattleResult){
    // Reconstruct campaign map and resolve
    const ctxRaw = sessionStorage.getItem('campaign_attack_context');
    if(ctxRaw){
      try {
        const ctx2 = JSON.parse(ctxRaw);
        const savedKey = 'campaign_save_'+ctx2.campId;
        const saved = JSON.parse(sessionStorage.getItem(savedKey)||'null');
        if(saved){
          const def = CAMPAIGNS_DATA.find(c=>c.id===ctx2.campId);
          CS = saved; CS._campDef = def;
          MAP_CONTAINER.style.display='flex';
          document.getElementById('mainMenu').style.display='none';
          document.getElementById('campaignSelect').style.display='none';
          resolveBattleResult();
        }
      } catch(e){ console.warn('Failed to resolve battle result', e); }
    }
  }
})();
