const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Full-screen — must happen before any constant derived from canvas.width/height
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;

// ── Constants ─────────────────────────────────────────────────────────────────

// Sprite source layouts (pixels in the sheet files)
// Barbarian Run.png  — 2048×2048, 512×512 frames, 4 cols × 4 rows
// attack animations.png — 2048×2048, 512×512 frames, 4 cols × 4 rows
// Barb slam *.png — 2912×1440, 728×720 frames, 4 cols × 2 rows (8 frames)
// Barb Whirlwind.png — 2914×1440, 728×720 frames, top row only (4 frames)

const BARB_MOVE_FW = 512;
const BARB_MOVE_FH = 512;
const BARB_MOVE_XS = [0, 512, 1024, 1536];

const BARB_WALK = {
  down:  { srcY: 0,    srcH: BARB_MOVE_FH, xs: BARB_MOVE_XS },
  up:    { srcY: 512,  srcH: BARB_MOVE_FH, xs: BARB_MOVE_XS },
  right: { srcY: 1024, srcH: BARB_MOVE_FH, xs: BARB_MOVE_XS },
  left:  { srcY: 1536, srcH: BARB_MOVE_FH, xs: BARB_MOVE_XS }
};

const BARB_ATK = {
  down:  { srcY: 0,    srcH: BARB_MOVE_FH, xs: BARB_MOVE_XS },
  up:    { srcY: 512,  srcH: BARB_MOVE_FH, xs: BARB_MOVE_XS },
  right: { srcY: 1024, srcH: BARB_MOVE_FH, xs: BARB_MOVE_XS },
  left:  { srcY: 1536, srcH: BARB_MOVE_FH, xs: BARB_MOVE_XS }
};

const SLAM_FW     = 728;
const SLAM_FH     = 720;
const SLAM_XS     = [0, 728, 1456, 2184];
const SLAM_XS_R   = [2184, 1456, 728, 0];   // reversed for mirrored left sheet
// Berserk slam2 sheets: 1782×883, 4 frames per row, 2 rows
const BERSERK_SLAM_FW  = Math.floor(1782 / 4);   // 445
const BERSERK_SLAM_FH  = Math.floor(883  / 2);   // 441
const BERSERK_SLAM_XS  = [0, BERSERK_SLAM_FW, BERSERK_SLAM_FW*2, BERSERK_SLAM_FW*3];
const BERSERK_SLAM_XS_R = [BERSERK_SLAM_FW*3, BERSERK_SLAM_FW*2, BERSERK_SLAM_FW, 0];
const SLAM_FRAMES = 8;
const SLAM_IMPACT = 4;   // row-1 frame 0 = strike lands
const BARB_DEATH_FRAMES = 4;

const WHIRL_FW     = 728;
const WHIRL_FH     = 720;
const WHIRL_XS     = [0, 728, 1456, 2184];
const WHIRL_FRAMES = 4;
const WHIRL_IMPACT = 1;
function barbWhirlSrcY(isBerserkSheet, direction) {
  if (!isBerserkSheet) return 0;
  return (direction === 'left' || direction === 'down') ? 1 : 0;
}
function barbWhirlFrameRect(sheet, isBerserkSheet, direction, frame) {
  const row = barbWhirlSrcY(isBerserkSheet, direction);
  const fw = isBerserkSheet ? sheet.width / 4 : WHIRL_FW;
  const fh = isBerserkSheet ? sheet.height / 2 : WHIRL_FH;
  return { sx: Math.min(frame, 3) * fw, sy: row * fh, sw: fw, sh: fh };
}
const BARB_BERSERK_SKILL_FRAMES = 5;
const FIREBALL_EXPLOSION_ROW_START = 0;
const FIREBALL_EXPLOSION_FRAMES = 8;

const GOBLIN_SCATTER_DUR = 70;
const MINOTAUR_WALL_STUN = 90;
const ARCHER_VOLLEY_WINDUP = 45;
const ORC_CLEAVE_WINDUP = 38;
const TROLL_RUBBLE_DUR = 300;
const GHOUL_FEEDING_FRENZY = 150;

// John Pork sprites
const JP_FW = 256;
const JP_FH = 256;

// ── Screen-relative sizes (everything scales with window height) ──────────────
// DISPLAY_SIZE: how large one character tile is on screen
const DISPLAY_SIZE = Math.min(Math.round(canvas.height / 12), 96);
const TILE_SIZE    = Math.round(DISPLAY_SIZE / 2);
const ABILITY_DISP = DISPLAY_SIZE * 2;   // slam / whirlwind animations
const FIREBALL_EXPLOSION_RADIUS = Math.round(DISPLAY_SIZE * 0.94);

// Ability animation display sizes — scaled so the character inside each frame
// matches the walk character size. Slam char fills ~57% of frame height vs ~97%
// for walk (×1.70); whirlwind fills ~75% (×1.30).
const SLAM_DISP  = Math.round(DISPLAY_SIZE * 1.70);
const WHIRL_DISP = Math.round(DISPLAY_SIZE * 1.30);

const FRAME_SPEED  = 8;
const ATK_SPEED    = 8;
const IMPACT_FRAME = 1;

const UI_HEIGHT  = 130;
const MAP_COLS    = Math.floor(canvas.width  / TILE_SIZE);
const MAP_ROWS    = Math.floor((canvas.height - UI_HEIGHT) / TILE_SIZE);
const GAME_HEIGHT = MAP_ROWS * TILE_SIZE;  // snapped to tile grid so HUD sits flush
const FLOOR = 0;
const WALL  = 1;
// Door: 3-tile-wide opening near the painted doorway in the stage art.
const DOOR_COL    = Math.max(1, Math.min(MAP_COLS - 4, Math.round(MAP_COLS * 0.745 - 1.5)));

// Enemy ranges — proportional to DISPLAY_SIZE so they feel the same at any resolution
const CHASE_RANGE  = Math.round(DISPLAY_SIZE * 3.1);
const ATTACK_RANGE = Math.round(DISPLAY_SIZE * 1.1);
const ENEMY_SPEED  = Math.max(1, Math.round(DISPLAY_SIZE / 48));
const ENEMY_COUNT  = 4;
const ATK_COOLDOWN = 180;
const SLOT_SIZE    = 76;
const SLOT_GAP     = 14;

const GOLEM_SLAM_RANGE    = Math.round(DISPLAY_SIZE * 2.2);
const GOLEM_SLAM_START_RANGE = Math.round(DISPLAY_SIZE * 1.25);
const GOLEM_SLAM_WINDUP   = 80;
const GOLEM_SLAM_COOLDOWN = 160;
const GOLEM_SLAM_DAMAGE   = 32;
const GOLEM_SLOW_DUR      = 180;
const GOLEM_HP            = 60;   // low enough for a level 1-2 player with only Q/one skill
const GOLEM_SPEED         = Math.max(2, Math.round(DISPLAY_SIZE / 34));

const GOBLIN_HP        = 10;
const GOBLIN_DAMAGE    = 10;
const GOBLIN_SPEED     = Math.max(2, Math.round(DISPLAY_SIZE / 30));
const GOBLIN_ATK_RANGE = Math.round(DISPLAY_SIZE * 0.9);
const GOBLIN_ATK_CD    = 120;
const GOBLIN_CHASE     = Math.round(DISPLAY_SIZE * 4.7);

const MINOTAUR_HP           = 500;
const MINOTAUR_CHARGE_DMG   = 60;
const MINOTAUR_WINDUP_DUR   = 90;
const MINOTAUR_CHARGE_SPEED = Math.round(DISPLAY_SIZE / 7);
const MINOTAUR_CHARGE_DUR   = 45;
const MINOTAUR_CHARGE_CD       = 300;
const MINOTAUR_ENRAGE_SPEED    = Math.round(DISPLAY_SIZE / 4);

const ARCHER_HP          = 20;
const ARCHER_DAMAGE      = 25;
const ARCHER_SHOOT_CD    = 90;
const ARCHER_FLEE_RANGE  = Math.round(DISPLAY_SIZE * 2.2);
const ARCHER_SHOOT_RANGE = Math.round(DISPLAY_SIZE * 4.5);
const ARROW_SPEED        = Math.max(3, Math.round(DISPLAY_SIZE * 0.1));

const SKELETAL_CHAMPION_HP       = 260;
const SKELETAL_CHAMPION_DAMAGE   = 32;
const SKELETAL_CHAMPION_SPEED    = Math.max(1, Math.round(DISPLAY_SIZE / 74));
const SKELETAL_CHAMPION_SIZE     = Math.round(DISPLAY_SIZE * 1.15);
const SKELETAL_CHAMPION_ATK_RANGE= Math.round(DISPLAY_SIZE * 1.15);
const SKELETAL_CHAMPION_ATK_CD   = 95;
const SKELETAL_CHAMPION_BLOCK_CD = 300;
const SKELETAL_CHAMPION_WINDUP   = 28;

const ORC_HP           = 220;
const ORC_DAMAGE       = 42;
const ORC_SPEED        = Math.max(1, Math.round(DISPLAY_SIZE / 50));
const ORC_CHARGE_SPEED = Math.max(4, Math.round(DISPLAY_SIZE / 16));
const ORC_ATK_RANGE    = Math.round(DISPLAY_SIZE * 1.3);
const ORC_ATK_CD       = 80;
const ORC_CHASE        = Math.round(DISPLAY_SIZE * 5);

const TROLL_HP         = 200;
const TROLL_DAMAGE     = 20;
const TROLL_SPEED      = Math.max(1, Math.round(DISPLAY_SIZE / 80));
const TROLL_THROW_CD   = 300;
const TROLL_THROW_RANGE = DISPLAY_SIZE * 999;
const ROCK_SPEED       = Math.max(2, Math.round(DISPLAY_SIZE * 0.07));
const ROCK_AOE         = Math.round(DISPLAY_SIZE * 2.8);

const GHOUL_HP        = 20;
const GHOUL_DAMAGE    = 15;
const GHOUL_SPEED     = Math.max(3, Math.round(DISPLAY_SIZE / 18));
const GHOUL_ATK_RANGE = Math.round(DISPLAY_SIZE * 0.9);
const GHOUL_ATK_CD    = 52;
const GHOUL_CHASE     = DISPLAY_SIZE * 999; // always chase — ghouls swarm the whole room

const GHOUL_WAVES     = [8, 12, 16, 22];

const ABOM_HP              = 900;
const ABOM_HP_CAP          = 1800;  // max HP after feeding
const ABOM_SPEED           = Math.max(2, Math.round(DISPLAY_SIZE / 32));
const ABOM_DAMAGE          = 40;
const ABOM_ATK_CD          = 80;
const ABOM_WINDUP          = 22;
const ABOM_ATK_RANGE       = Math.round(DISPLAY_SIZE * 1.25);
const ABOM_SIZE            = Math.round(DISPLAY_SIZE * 1.5);
const ABOM_FEED_RANGE      = Math.round(DISPLAY_SIZE * 3.5);
const ABOM_DEVOUR_RANGE    = Math.round(DISPLAY_SIZE * 1.8); // must be adjacent to corpse to devour it
const ABOM_DEVOUR_CD       = 120; // 2 seconds at 60fps
const ABOM_FEED_HP         = 45;
const ABOM_FEED_SPEED_DUR  = 60; // 1-second lunge after feeding

const GUARDIAN_HP          = 1000;
const GUARDIAN_DAMAGE      = 60;
const GUARDIAN_SPEED       = Math.max(2, Math.round(DISPLAY_SIZE / 42));
const GUARDIAN_ATK_RANGE   = Math.round(DISPLAY_SIZE * 2.5); // trigger distance
const GUARDIAN_SPEAR_RANGE = Math.round(DISPLAY_SIZE * 4.2); // spear lunge reach
const GUARDIAN_WINDUP_DUR  = 32;
const GUARDIAN_SPEAR_EFFECT_DUR = 14;
const GUARDIAN_ATK_CD      = 95;
const GUARDIAN_CHASE       = DISPLAY_SIZE * 999; // always chase

const TRIB_SENTINEL_HP = 900;
const TRIB_WARDEN_HP   = 650;
const TRIB_PRIEST_HP   = 250;
const TRIB_SENTINEL_SIZE = Math.round(DISPLAY_SIZE * 1.55);
const TRIB_WARDEN_SIZE   = Math.round(DISPLAY_SIZE * 1.25);
const TRIB_PRIEST_SIZE   = Math.round(DISPLAY_SIZE * 1.05);
const TRIB_SENTINEL_WINDUP = 34;
const TRIB_WARDEN_WINDUP   = 20;
const TRIB_PRIEST_HEAL_CD  = 210;
const TRIB_PRIEST_HEAL     = 100;
const ROGUE_SLICE_DICE_RADIUS = Math.round(DISPLAY_SIZE * 2.15);

// Per-monster rendered sizes (affects both draw and hitbox)
const GOBLIN_SIZE   = Math.round(DISPLAY_SIZE * 0.70);
const GOLEM_SIZE    = Math.round(DISPLAY_SIZE * 1.20);
const ARCHER_SIZE   = Math.round(DISPLAY_SIZE * 0.85);
const ORC_SIZE      = Math.round(DISPLAY_SIZE * 1.10);
const GUARDIAN_SIZE = Math.round(DISPLAY_SIZE * 2.0);

let stage = 1;

// ── Map ───────────────────────────────────────────────────────────────────────

const map = [];
for (let r = 0; r < MAP_ROWS; r++) {
  map[r] = [];
  for (let c = 0; c < MAP_COLS; c++) {
    map[r][c] = (r === 0 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1) ? WALL : FLOOR;
  }
}

// ── John Pork animation tables ────────────────────────────────────────────────

const JP_MOVE = {
  down:  { row: 0, frames: [0,1,2,3] },
  left:  { row: 1, frames: [0,1,2,3] },
  right: { row: 2, frames: [0,1,2,3] },
  up:    { row: 3, frames: [0,1,2,3] }
};

const JP_ATKS = [
  { row: 0, frames: [0,1,2,3], damage: 15 },
  { row: 1, frames: [0,1,2,3], damage: 25 },
  { row: 2, frames: [0,1,2,3], damage: 20 },
  { row: 3, frames: [0,1,2,3], damage: 10 }
];

// ── Abilities ─────────────────────────────────────────────────────────────────

let abilities = [];
const ABILITY_KEY_ORDER = ['q', 'w', 'e', 'r'];

const TALENT_UNLOCK_LEVELS = [3, 6, 9];
const TALENT_LEVELS = new Set(TALENT_UNLOCK_LEVELS);

// 3 paths × 3 tiers. Tier 2 requires tier 1 of same path; tier 3 requires tier 2.
// Unlock levels: tier 1 -> lvl 3, tier 2 -> lvl 6, tier 3 -> lvl 9.
const TALENT_TREE = [
  {
    path: 'Offensive', color: '#e94560',
    tiers: [
      { label: 'Haste',      desc: 'Cooldowns recover 15% faster' },
      { label: 'Bloodlust',  desc: '8% lifesteal, doubled for 2s after kills' },
      { label: 'Executioner', desc: '+25% damage vs enemies below 35% HP' },
    ]
  },
  {
    path: 'Defensive', color: '#3498db',
    tiers: [
      { label: 'Stoneskin',          desc: '15% less damage taken' },
      { label: 'Lifeblood',          desc: 'Regen 1% max HP every 3s when not surrounded' },
      { label: 'Ancient Bulwark',    desc: '+50% max HP, stage-start shield' },
    ]
  },
  {
    path: 'Utility', color: '#2ecc71',
    tiers: [
      { label: 'Plasticity',         desc: '+3 to all stats now' },
      { label: 'Assassin',           desc: 'Every 15s, next hit deals +1.5x primary stat' },
      { label: 'Eternal Focus',      desc: 'Every third skill cast refunds 50% of that skill cooldown' },
    ]
  }
];

const CLASSES = [
  {
    name: 'Barbarian', primaryStat: 'str', color: '#e94560',
    desc: 'Mighty warrior. Crushing melee power and endurance.',
    str: 10, agi: 8, int: 4,
    abilityLabels: 'Q: Slash  W: Whirlwind  E: Slam  R: Berserk',
  },
  {
    name: 'Rogue', primaryStat: 'agi', color: '#2ecc71',
    desc: 'Swift and deadly. Strikes fast from any angle.',
    str: 6, agi: 10, int: 6,
    abilityLabels: 'Q: Slash  W: Throw  E: Wind Walk  R: Slice & Dice',
  },
  {
    name: 'Mage', primaryStat: 'int', color: '#3498db',
    desc: 'Arcane master. Devastating spells from a distance.',
    str: 4, agi: 6, int: 12,
    abilityLabels: 'Q: Blastwave  W: Fireball  E: Frost Nova  R: Blink',
  },
];
let selectedClass = 0;

let gameState     = 'title'; // title | menu | classconfirm | playing | levelup | stagechoice | stageclear | gameover | pendant | win | devsetup | johnporkintro
let titleSelected = 0;
let devMode = false;
let gameMode = 'normal';

// Class confirm splash
let classConfirmAlpha = 0;
let classConfirmTimer = 0;
let pendingClassIdx   = 0;

// Dev setup state
let devSetupLevel   = 1;
let devSetupStage   = 1;
let devSetupSection = 0;      // 0=level, 1=skills, 2=stats, 3=talents, 4=pendants, 5=stage
let devPendantCursor = 0;
let devSkillAlloc   = [0, 0, 0, 0];    // extra skill levels assigned to [Q, W, E, R]
let devSkillCursor  = 0;               // 0=Q 1=W 2=E 3=R
let devStatAlloc    = [0, 0, 0];    // points assigned to [STR, AGI, INT]
let devStatCursor   = 0;            // 0=STR 1=AGI 2=INT
let devTalentSlots  = [-1, -1, -1]; // path chosen per talent slot (-1=none, 0=Off, 1=Def, 2=Util)
let devTalentCursor = 0;            // which slot row is highlighted
let devPrimaryStat  = null;         // optional Plasticity primary-stat override
const DEV_PENDANTS = [
  { name: 'Vitality',      color: '#e74c3c', desc: '+50 HP',
    apply: p => { p.maxHp += 50; p.hp = Math.min(p.hp + 50, p.maxHp); } },
  { name: 'Swiftness',     color: '#2ecc71', desc: '+20% speed',
    apply: p => { p.speed = Math.round(p.speed*1.2*10)/10; p.baseSpeed = p.speed; } },
  { name: 'Acuity',        color: '#3498db', desc: 'All CDs −1s',
    apply: () => { abilities.forEach(a => { a.cooldown = Math.max(30, a.cooldown-60); }); } },
  { name: 'Might',         color: '#c0392b', desc: '+10 STR · +25% range',
    apply: p => { p.str+=10; p.maxHp+=100; p.hp=Math.min(p.hp+100,p.maxHp); p.atkRange=Math.round(p.atkRange*1.25); p.mightBonus=true; } },
  { name: 'the Assassin',  color: '#27ae60', desc: '+10 AGI · proc dmg',
    apply: p => { p.agi+=10; p.baseSpeed=Math.round(2.5*(1+p.agi*0.05)*10)/10; p.speed=p.baseSpeed; p.assassinProc=true; p.assassinProcCD=0; } },
  { name: 'Enlightenment', color: '#2980b9', desc: '+10 INT · damage shield',
    apply: p => { p.int+=10; abilities.forEach(a=>{a.cooldown=Math.max(30,a.cooldown-150);}); p.enlightenShield=true; p.enlightenShieldCD=0; } },
];
let devSelectedPendants = [false, false, false, false, false, false];
const TITLE_ITEMS = ['New Game', 'Softcore', 'Dev Test'];
let levelupPhase  = 'skill'; // skill | stats | talent | talentConfirm | primattr
let levelupStatsLeft = 0;
let levelupStatCursor = 0;
let levelupTalentCursor = 0;
let pendingPendant = null;
let pendingLevelup  = false;
let talentConfirmData = null; // { mode, pathIdx, tierIdx, name, desc, color }
let doorOpen = false;         // true when all enemies dead and exit door is unlocked
let ghoulWaveIndex = 0;       // stage 7 wave tracker
// Stage transition (fade → art reveal → key to continue)
let transitionFade = 0;
let transitionPhase = 'fade'; // 'fade' | 'art'
let transitionNextStage = 0;
let transitionGatePlayed = false;
let johnPorkIntroImg = null;
let johnPorkIntroTimer = 0;
let mouseX = 0, mouseY = 0;

function devSkillPointsForLevel(level) {
  return Math.max(0, level - 1);
}

function devSkillBaseLevel(skillIdx) {
  return skillIdx === 0 ? 1 : 0;
}

function devSkillMaxLevel(skillIdx) {
  return skillIdx === 3 ? 2 : 3;
}

function isDevSkillUnlocked(skillIdx) {
  return skillIdx < 3 || devSetupLevel >= 6;
}

function devSkillUsed() {
  return devSkillAlloc.reduce((sum, value) => sum + value, 0);
}

function clampDevChoicesForLevel() {
  const totalSkillPts = devSkillPointsForLevel(devSetupLevel);
  devSkillAlloc = devSkillAlloc.map((value, idx) => {
    if (!isDevSkillUnlocked(idx)) return 0;
    return Math.max(0, Math.min(value, devSkillMaxLevel(idx) - devSkillBaseLevel(idx)));
  });
  while (devSkillUsed() > totalSkillPts) {
    for (let i = devSkillAlloc.length - 1; i >= 0 && devSkillUsed() > totalSkillPts; i--) {
      if (devSkillAlloc[i] > 0) devSkillAlloc[i]--;
    }
  }

  const totalStatPts = (devSetupLevel - 1) * 3;
  while (devStatAlloc[0] + devStatAlloc[1] + devStatAlloc[2] > totalStatPts) {
    for (let i = devStatAlloc.length - 1; i >= 0 && devStatAlloc[0] + devStatAlloc[1] + devStatAlloc[2] > totalStatPts; i--) {
      if (devStatAlloc[i] > 0) devStatAlloc[i]--;
    }
  }
  if (devSetupLevel < 9)  devTalentSlots[2] = -1;
  if (devSetupLevel < 6)  devTalentSlots[1] = -1;
  if (devSetupLevel < 3)  devTalentSlots[0] = -1;
}

function devHasPlasticitySelected() {
  return devSetupLevel >= 3 && devTalentSlots[0] === 2;
}

// ── Sprites ───────────────────────────────────────────────────────────────────

function makeOffscreen(img) {
  const oc   = document.createElement('canvas');
  const octx = oc.getContext('2d');
  oc.width = img.width; oc.height = img.height;
  octx.drawImage(img, 0, 0);
  const id = octx.getImageData(0, 0, img.width, img.height);
  const d  = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i+3] === 0) continue;
    const r = d[i], g = d[i+1], b = d[i+2];
    // Olive checkerboard (bark full v2.png attacks)
    const dOliveL = Math.sqrt((r-107)**2 + (g-106)**2 + (b-93)**2);
    const dOliveD = Math.sqrt((r-58)**2  + (g-58)**2  + (b-50)**2);
    if (Math.min(dOliveL, dOliveD) < 30) { d[i+3] = 0; continue; }
    // Gray checkerboard (barb movement.png + attack animations.png)
    const dGrayD = Math.sqrt((r-116)**2 + (g-116)**2 + (b-114)**2);
    const dGrayL = Math.sqrt((r-165)**2 + (g-165)**2 + (b-163)**2);
    if (Math.min(dGrayD, dGrayL) < 45) { d[i+3] = 0; continue; }
    // Near-white (label text + white sprite backgrounds)
    if (r > 200 && g > 200 && b > 200) d[i+3] = 0;
  }
  octx.putImageData(id, 0, 0);
  return oc;
}

// Remove pure-black (monster sprite) backgrounds + near-white
function makeMonsterSheet(img, removeGrayBg = false) {
  const oc = document.createElement('canvas');
  const octx = oc.getContext('2d');
  oc.width = img.width; oc.height = img.height;
  octx.drawImage(img, 0, 0);
  const id = octx.getImageData(0, 0, img.width, img.height);
  const d  = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i+3] === 0) continue;
    const r = d[i], g = d[i+1], b = d[i+2];
    if (r < 22 && g < 22 && b < 22) { d[i+3] = 0; continue; }
    if (removeGrayBg) {
      const dGrayD = Math.sqrt((r-112)**2 + (g-112)**2 + (b-110)**2);
      const dGrayL = Math.sqrt((r-165)**2 + (g-165)**2 + (b-163)**2);
      if (Math.min(dGrayD, dGrayL) < 45) { d[i+3] = 0; continue; }
    }
    if (r > 200 && g > 200 && b > 200) { d[i+3] = 0; continue; }
  }
  octx.putImageData(id, 0, 0);
  return oc;
}

// For sheets with dark outlines/shadows, clear only background pixels connected to
// frame edges instead of deleting every black pixel in the sprite.
function makeMonsterSheetKeepDarkPixels(img, cols = 4, rows = 4) {
  const oc = document.createElement('canvas');
  const octx = oc.getContext('2d');
  oc.width = img.width; oc.height = img.height;
  octx.drawImage(img, 0, 0);
  const id = octx.getImageData(0, 0, img.width, img.height);
  const d = id.data;
  const w = img.width, h = img.height;
  const frameW = Math.floor(w / cols), frameH = Math.floor(h / rows);
  const visited = new Uint8Array(w * h);

  const isBg = idx => {
    if (d[idx + 3] === 0) return true;
    const r = d[idx], g = d[idx + 1], b = d[idx + 2];
    return (r < 8 && g < 8 && b < 8) || (r > 200 && g > 200 && b > 200);
  };

  function clearFrameEdgeBackground(fx, fy, fw, fh) {
    const x0 = fx, y0 = fy, x1 = fx + fw - 1, y1 = fy + fh - 1;
    const q = [];
    const push = (x, y) => {
      if (x < x0 || x > x1 || y < y0 || y > y1) return;
      const p = y * w + x;
      if (visited[p]) return;
      const idx = p * 4;
      if (!isBg(idx)) return;
      visited[p] = 1;
      q.push(p);
    };
    for (let x = x0; x <= x1; x++) { push(x, y0); push(x, y1); }
    for (let y = y0; y <= y1; y++) { push(x0, y); push(x1, y); }
    for (let qi = 0; qi < q.length; qi++) {
      const p = q[qi];
      d[p * 4 + 3] = 0;
      const x = p % w, y = Math.floor(p / w);
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      clearFrameEdgeBackground(col * frameW, row * frameH, frameW, frameH);
    }
  }
  octx.putImageData(id, 0, 0);
  return oc;
}

let barbWalkSheet, barbAtkSheet, jpMoveSheet, jpAtkSheet;
let barbSlamRSheet, barbSlamLSheet, barbWhirlSheet, barbDeathSheet;
let barbBerserkWalkSheet, barbBerserkAtkSheet, barbBerserkSkillSheet;
let barbBerserkSlamRSheet, barbBerserkSlamLSheet, barbBerserkWhirlSheet;
// Portraits
let barbPortrait, roguePortrait, magePortrait;
// Skill icons — keyed by ability name matching the mkab 'name' field
const skillIcons = {};
// Class confirm splash art (fullscreen selected images — optional per class)
let barbSelectedImg = null, rogueSelectedImg = null, mageSelectedImg = null;
// Rogue sheets
let rogueRunSheet, rogueAtkSheet, rogueThrowSheet, rogueWindwalkSheet, rogueSliceDiceSheet, rogueDeathSheet, daggerSheet;
// Mage sheets
let mageRunSheet, mageAtkSheet, mageDeathSheet, mageFireballCastSheet, mageFireballProjSheet, mageFireballExplosionSheet, mageFrostNovaSheet, mageBlinkSheet;
// Monster sprite sheets
let goblinRunSheet, goblinAtkSheet, goblinDeathSheet;
let golemRunSheet,  golemAtkSheet,  golemDeathSheet, golemSheet;
let minotaurRunSheet, minotaurAtkSheet, minotaurDeathSheet;
let orcRunSheet, orcAtkSheet, orcDeathSheet;
let skelRunSheet, skelAtkSheet, arrowSheet;
let skeletalChampionSheet;
let ghoulRunSheet, ghoulAtkSheet, ghoulDeathSheet;
let trollRunSheet, trollAtkSheet, trollBoulderSheet;
let guardianRunSheet, guardianAtkSheet, guardianDeathSheet, guardianSpearSheet;
let ironSentinelRunSheet, ironSentinelAtkSheet, ironSentinelBlockSheet, ironSentinelDeathSheet;
let chainWardenRunSheet, chainWardenAtkSheet, chainWardenDeathSheet, chainWardenChainSheet;
let ashPriestRunSheet, ashPriestHealSheet, ashPriestDeathSheet;
let titleBgImg = null, heroSelectBgImg = null, hudBgImg = null;
let abominationSheet = null;
let golemTransitionArt = null, minotaurTransitionArt = null, skeletonCryptTransitionArt = null, orcTransitionArt = null, trollTransitionArt = null, ghoulPitTransitionArt = null, tribunalTransitionArt = null, twinGuardianTransitionArt = null;
const stageBgImgs = {};
// Master sprite sheet layout constants (2048×2048, each quadrant 1024×1024, frames 256×256)
const MASTER_FRAME = 256;
const MASTER_QUAD  = 1024;
const STAGE_BLOCKERS = {
  1: [], // Stage 1 uses STAGE_PLAY_AREAS instead of rectangular blockers.
  2: [] // Stage 2 uses STAGE_PLAY_AREAS instead of rectangular blockers.
};
const STAGE_DOORS = {
  1: { x: 0.728, y: 0.045, w: 0.095, h: 0.205 },
  2: { x: 0.466, y: 0.020, w: 0.075, h: 0.205 },
  3: { x: 0.435, y: 0.000, w: 0.160, h: 0.260 },
  4: { x: 0.462, y: 0.010, w: 0.085, h: 0.210 },
  5: { x: 0.462, y: 0.010, w: 0.085, h: 0.210 },
  6: { x: 0.462, y: 0.010, w: 0.085, h: 0.210 },
  7: { x: 0.462, y: 0.010, w: 0.085, h: 0.210 },
  8: { x: 0.462, y: 0.010, w: 0.085, h: 0.210 },
  9: { x: 0.462, y: 0.010, w: 0.085, h: 0.210 },
  10: { x: 0.462, y: 0.010, w: 0.085, h: 0.210 }
};
const STAGE_PLAY_AREAS = {
  1: [
    // Normalized from Game Art/Stage Art/Stage 1 blockers.png.
    // The bottom is intentionally open; the door area is exempted separately.
    [0.018, 1.000], [0.021, 0.830], [0.041, 0.675], [0.036, 0.535],
    [0.063, 0.423], [0.092, 0.349], [0.117, 0.252], [0.126, 0.185],
    [0.143, 0.149], [0.169, 0.135], [0.230, 0.130], [0.335, 0.126],
    [0.580, 0.128], [0.680, 0.128], [0.716, 0.146], [0.742, 0.145],
    [0.748, 0.085], [0.765, 0.047], [0.801, 0.038], [0.837, 0.052],
    [0.855, 0.098], [0.858, 0.152], [0.886, 0.170], [0.919, 0.174],
    [0.947, 0.210], [0.951, 0.287], [0.970, 0.354], [0.989, 0.448],
    [0.989, 0.731], [0.995, 1.000],
  ],
  2: [
    // Normalized from Game Art/Stage Art/Stage 2 blockers.png.
    // Points follow the blue boundary; outside this polygon is inaccessible.
    [0.422, 0.000], [0.422, 0.109], [0.396, 0.109], [0.367, 0.073],
    [0.325, 0.068], [0.284, 0.081], [0.258, 0.111], [0.239, 0.157],
    [0.199, 0.214], [0.128, 0.269], [0.119, 0.289], [0.119, 0.411],
    [0.113, 0.505], [0.094, 0.546], [0.094, 0.620], [0.112, 0.663],
    [0.158, 0.730], [0.229, 0.812], [0.300, 0.886], [0.345, 0.984],
    [0.345, 1.000], [0.810, 1.000], [0.810, 0.907], [0.822, 0.833],
    [0.860, 0.714], [0.899, 0.628], [0.916, 0.553], [0.961, 0.502],
    [1.000, 0.502], [1.000, 0.329], [0.948, 0.351], [0.928, 0.343],
    [0.876, 0.284], [0.821, 0.215], [0.779, 0.156], [0.735, 0.132],
    [0.690, 0.126], [0.667, 0.109], [0.649, 0.000],
  ],
  3: [
    // Normalized from Game Art/Stage Art/Stage 3 blockers.png.
    // The blue line traces the arena wall/prop edge; outside this polygon is blocked.
    [0.115, 0.145], [0.157, 0.136], [0.311, 0.136], [0.452, 0.134],
    [0.454, 0.000], [0.577, 0.000], [0.585, 0.127], [0.723, 0.128],
    [0.735, 0.139], [0.825, 0.136], [0.894, 0.145], [0.900, 0.282],
    [0.982, 0.308], [0.977, 0.461], [0.959, 0.480], [0.941, 0.758],
    [0.944, 0.853], [1.000, 1.000], [0.000, 1.000], [0.118, 0.855],
    [0.117, 0.692], [0.041, 0.674], [0.041, 0.286], [0.099, 0.271],
    [0.116, 0.244],
  ]
};

let loaded = 0;
const TOTAL_IMAGES = 106; // +3: abomination/golem master/stage art; +8 transition art; +4 mage skill icons; +9 Stage 2-10 art; +John Pork intro; +hero select bg
const ASSET_VERSION = Date.now();
function assetUrl(src) {
  return `${src}?v=${ASSET_VERSION}`;
}

function onLoad() {
  if (++loaded === TOTAL_IMAGES) {
    tryStartMusic();
    loop();
  }
}

const barbMoveImg = new Image();
barbMoveImg.src = 'Barbarian Animations/Barbarian Run.png';
barbMoveImg.onload = () => { barbWalkSheet = barbMoveImg; onLoad(); };

const barbAtkImg = new Image();
barbAtkImg.src = 'attack animations.png';
barbAtkImg.onload = () => { barbAtkSheet = makeOffscreen(barbAtkImg); onLoad(); };

const barbSlamRImg = new Image();
barbSlamRImg.src = 'Barbarian Animations/Barb slam right animation.png';
barbSlamRImg.onload = () => { barbSlamRSheet = barbSlamRImg; onLoad(); };

const barbSlamLImg = new Image();
barbSlamLImg.src = 'Barbarian Animations/Barb slam left animation mirrored.png';
barbSlamLImg.onload = () => { barbSlamLSheet = barbSlamLImg; onLoad(); };

const barbBerserkSlamRImg = new Image();
barbBerserkSlamRImg.src = 'Barbarian Animations/Barbarian Berserk Slam right2.png';
barbBerserkSlamRImg.onload = () => { barbBerserkSlamRSheet = barbBerserkSlamRImg; onLoad(); };

const barbBerserkSlamLImg = new Image();
barbBerserkSlamLImg.src = 'Barbarian Animations/Barbarian Berserk Slam left2.png';
barbBerserkSlamLImg.onload = () => { barbBerserkSlamLSheet = barbBerserkSlamLImg; onLoad(); };

const barbWhirlImg = new Image();
barbWhirlImg.src = 'Barbarian Animations/Barb Whirlwind.png';
barbWhirlImg.onload = () => { barbWhirlSheet = barbWhirlImg; onLoad(); };

const barbDeathImg = new Image();
barbDeathImg.src = assetUrl('Barbarian Animations/Barbarian Death.png');
barbDeathImg.onload = () => { barbDeathSheet = barbDeathImg; onLoad(); };

(function loadBarbarianBerserkSheets() {
  const sheets = [
    ['Barbarian Animations/Barbarian Berserk.png',            s => barbBerserkWalkSheet  = s],
    ['Barbarian Animations/Barbarian Berserk Attack.png',     s => barbBerserkAtkSheet   = s],
    ['Barbarian Animations/Barbarian Berserk Skill.png',      s => barbBerserkSkillSheet = s],
    ['Barbarian Animations/Barbarian Berserk Whirlwind.png',  s => barbBerserkWhirlSheet = s],
  ];
  sheets.forEach(([src, assign]) => {
    const img = new Image();
    img.src = assetUrl(src);
    img.onload = () => { assign(img); onLoad(); };
    img.onerror = () => { onLoad(); };
  });
})();

const jpMoveImg = new Image();
jpMoveImg.src = 'john pork movement.png';
jpMoveImg.onload = () => { jpMoveSheet = makeOffscreen(jpMoveImg); onLoad(); };

const jpAtkImg = new Image();
jpAtkImg.src = 'John pork attack.png';
jpAtkImg.onload = () => { jpAtkSheet = makeOffscreen(jpAtkImg); onLoad(); };

// Portraits — loaded raw (no background strip)
(function loadPortraits() {
  [['Game Art/Barbarian portrait.png', i => barbPortrait  = i],
   ['Game Art/Rogue Portrait.png',     i => roguePortrait = i],
   ['Game Art/Mage portrait.png',      i => magePortrait  = i]].forEach(([src, assign]) => {
    const img = new Image();
    img.src = assetUrl(src);
    img.onload = () => { assign(img); onLoad(); };
  });
})();

// Class confirm splash art — only Barbarian has art now; Rogue/Mage optional, loaded silently
(function loadSelectedArt() {
  // Barbarian Selected counts toward TOTAL_IMAGES
  const barbSel = new Image();
  barbSel.src = 'Game Art/Barbarian Selected.png';
  barbSel.onload = () => { barbSelectedImg = barbSel; onLoad(); };
  barbSel.onerror = () => { onLoad(); }; // still unblock if file moves

  // Future entries — not counted, just loaded opportunistically
  const rogueSel = new Image();
  rogueSel.src = 'Game Art/Rogue Selected.png';
  rogueSel.onload = () => { rogueSelectedImg = rogueSel; };

  const mageSel = new Image();
  mageSel.src = 'Game Art/Mage Selected.png';
  mageSel.onload = () => { mageSelectedImg = mageSel; };
})();

// Skill icons — counted in TOTAL_IMAGES (8 icons); Berserk2 optional
(function loadSkillIcons() {
  const icons = [
    ['Game Art/Game Icons/Barbarian/Slash.png',         'slash'],
    ['Game Art/Game Icons/Barbarian/Whirlwind.png',     'whirlwind'],
    ['Game Art/Game Icons/Barbarian/Slam.png',          'slam'],
    ['Game Art/Game Icons/Barbarian/Berserk2.png',      'berserk'],
    ['Game Art/Game Icons/Rogue/Slash.png',             'rogue_slash'],
    ['Game Art/Game Icons/Rogue/Throw.png',             'rogue_throw'],
    ['Game Art/Game Icons/Rogue/Windwalk.png',          'rogue_windwalk'],
    ['Game Art/Game Icons/Rogue/Slice and Dice.png',    'rogue_slicedice'],
    ['Game Art/Game Icons/Mage/Blastwave.png',          'mage_blastwave'],
    ['Game Art/Game Icons/Mage/Fireball.png',           'mage_fireball'],
    ['Game Art/Game Icons/Mage/Frost Nova.png',         'mage_frostnova'],
    ['Game Art/Game Icons/Mage/Blink.png',              'mage_blink'],
  ];
  icons.forEach(([src, key]) => {
    const img = new Image();
    img.src = src;
    img.onload = () => { skillIcons[key] = img; onLoad(); };
    img.onerror = () => { onLoad(); };
  });
})();

// Rogue sheets (same black-bg removal as monster sheets)
(function loadRogueSheets() {
  const sheets = [
    ['Rouge Animations/Rogue run.png',           s => rogueRunSheet      = s],
    ['Rouge Animations/Rogue Attack.png',         s => rogueAtkSheet      = s],
    ['Rouge Animations/Rogue Throw.png',          s => rogueThrowSheet    = s],
    ['Rouge Animations/Rogue Windwalk.png',       s => rogueWindwalkSheet = s],
    ['Rouge Animations/Rogue Slice and Dice.png', s => rogueSliceDiceSheet= s],
    ['Rouge Animations/Rogue Death.png',          s => rogueDeathSheet    = s],
    ['Rouge Animations/Dagger throw projectile.png', s => daggerSheet     = s],
  ];
  for (const [src, assign] of sheets) {
    const img = new Image();
    img.src = src;
    img.onload = () => { assign(makeMonsterSheet(img)); onLoad(); };
  }
})();

// Mage sheets
(function loadMageSheets() {
  const sheets = [
    ['Mage Animations/Mage Run.png',                s => mageRunSheet = s],
    ['Mage Animations/Mage attack.png',             s => mageAtkSheet = s],
    ['Mage Animations/Mage Death.png',              s => mageDeathSheet = s],
    ['Mage Animations/Mage fireball cast.png',      s => mageFireballCastSheet = s],
    ['Mage Animations/Mage Fireball Projective.png', s => mageFireballProjSheet = s],
    ['Mage Animations/Mage Fireball Explosion.png', s => mageFireballExplosionSheet = s],
    ['Mage Animations/Mage Frost Nova.png',         s => mageFrostNovaSheet = s],
    ['Mage Animations/Mage blink.png',              s => mageBlinkSheet = s],
  ];
  for (const [src, assign] of sheets) {
    const img = new Image();
    img.src = assetUrl(src);
    img.onload = () => { assign(makeMonsterSheet(img)); onLoad(); };
    img.onerror = () => { onLoad(); };
  }
})();

// Monster sheets
(function loadMonsterSheets() {
  const sheets = [
    ['Monster animations/Goblin run.png',                 s => goblinRunSheet   = s],
    ['Monster animations/Goblin attack.png',              s => goblinAtkSheet   = s, 'keepDark'],
    ['Monster animations/Goblin Death.png',               s => goblinDeathSheet = s],
    ['Monster animations/Golem run.png',                  s => golemRunSheet    = s],
    ['Monster animations/Golem attack.png',               s => golemAtkSheet    = s],
    ['Monster animations/Golem Death.png',                s => golemDeathSheet  = s],
    ['Monster animations/Minotaur run.png',               s => minotaurRunSheet   = s],
    ['Monster animations/Minotaur attack charge.png',     s => minotaurAtkSheet   = s],
    ['Monster animations/Minotaur death.png',             s => minotaurDeathSheet = s],
    ['Monster animations/Orc Run.png',                    s => orcRunSheet  = s],
    ['Monster animations/Orc Attack.png',                 s => orcAtkSheet  = s],
    ['Monster animations/Orc Death.png',                  s => orcDeathSheet= s],
    ['Monster animations/Skeleton archer run.png',        s => skelRunSheet = s],
    ['Monster animations/Skeleton archer attack.png',     s => skelAtkSheet = s],
    ['Monster animations/Skeleton arrow projectile.png',  s => arrowSheet   = s],
    ['Monster animations/Skeletal Champion Master.png',   s => skeletalChampionSheet = s],
    ['Monster animations/Ghoul Run.png',                  s => ghoulRunSheet= s],
    ['Monster animations/Ghoul Attack.png',               s => ghoulAtkSheet= s],
    ['Monster animations/Ghoul Death.png',                s => ghoulDeathSheet= s],
    ['Monster animations/Troll Run.png',                  s => trollRunSheet = s, 'keepDark'],
    ['Monster animations/Troll attack.png',               s => trollAtkSheet = s, 'keepDark'],
    ['Monster animations/Troll Boulder.png',              s => trollBoulderSheet = s, 'keepDark'],
    ['Monster animations/Twin Guardian run.png',          s => guardianRunSheet = s],
    ['Monster animations/Twin Guardian Attack.png',       s => guardianAtkSheet = s],
    ['Monster animations/Twin Guardian death.png',        s => guardianDeathSheet = s],
    ['Monster animations/Twin Guardian Spear Projectile.png?v=3600x1600', s => guardianSpearSheet = s],
    ['Monster animations/Iron Sentinel Run.png',          s => ironSentinelRunSheet = s],
    ['Monster animations/Iron Sentinel Attack.png',       s => ironSentinelAtkSheet = s],
    ['Monster animations/Iron Sentinel Block.png',        s => ironSentinelBlockSheet = s],
    ['Monster animations/Iron Sentinel Death.png',        s => ironSentinelDeathSheet = s],
    ['Monster animations/Chain Warden Run.png',           s => chainWardenRunSheet = s],
    ['Monster animations/Chain Warden Attack.png',        s => chainWardenAtkSheet = s],
    ['Monster animations/Chain Warden Death.png',         s => chainWardenDeathSheet = s],
    ['Monster animations/Chain Warden Chain Projectile.png', s => chainWardenChainSheet = s],
    ['Monster animations/Ash Priest Run.png',             s => ashPriestRunSheet = s],
    ['Monster animations/Ash Priest Heal.png',            s => ashPriestHealSheet = s],
    ['Monster animations/Ash Priest Death.png',           s => ashPriestDeathSheet = s],
  ];
  for (const [src, assign, cleanupMode] of sheets) {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      assign(cleanupMode === 'keepDark' ? makeMonsterSheetKeepDarkPixels(img) : makeMonsterSheet(img, Boolean(cleanupMode)));
      onLoad();
    };
  }
})();

// Title background
(function loadTitleBg() {
  const img = new Image();
  img.src = assetUrl('Game Art/Intro Art 3.png');
  img.onload = () => { titleBgImg = img; onLoad(); };
})();

// Hero selection background
(function loadHeroSelectBg() {
  const img = new Image();
  img.src = assetUrl('Game Art/Hero Selection background.png');
  img.onload = () => { heroSelectBgImg = img; onLoad(); };
  img.onerror = () => { onLoad(); };
})();

// HUD panel art
(function loadHudBg() {
  const img = new Image();
  img.src = assetUrl('Game Art/Game HUD.png');
  img.onload = () => { hudBgImg = img; onLoad(); };
  img.onerror = () => { onLoad(); };
})();

// Abomination master sprite sheet (4096×4096 quad layout)
(function loadAbominationSheet() {
  const img = new Image();
  img.src = 'Monster animations/Abomination Master.png';
  img.onload = () => { abominationSheet = makeMonsterSheet(img); onLoad(); };
  img.onerror = () => { onLoad(); };
})();

// Golem master sprite sheet (2048×2048 quad layout)
(function loadGolemSheet() {
  const img = new Image();
  img.src = 'Monster animations/Golem Master.png';
  img.onload = () => { golemSheet = makeMonsterSheet(img); onLoad(); };
  img.onerror = () => { onLoad(); };
})();

// Stage transition art
(function loadTransitionArt() {
  [['Game Art/Golem Art.png',          i => golemTransitionArt        = i],
   ['Game Art/Minotaur Art.png',       i => minotaurTransitionArt     = i],
   ['Game Art/Skeleton Crypt Art.png', i => skeletonCryptTransitionArt = i],
   ['Game Art/Orc Art.png',            i => orcTransitionArt          = i],
   ['Game Art/Troll art.png',          i => trollTransitionArt        = i],
   ['Game Art/Ghoul Pit Art.png',      i => ghoulPitTransitionArt     = i],
   ['Game Art/Iron Tribunal Art.png',  i => tribunalTransitionArt     = i],
   ['Game Art/Twin Guardian Art.png',  i => twinGuardianTransitionArt = i]].forEach(([src, assign]) => {
    const img = new Image();
    img.src = assetUrl(src);
    img.onload = () => { assign(img); onLoad(); };
    img.onerror = () => { onLoad(); };
  });
})();

// Stage backgrounds
(function loadStageArt() {
  [
    [1, 'Game Art/Stage Art/Stage 1.png'],
    [2, 'Game Art/Stage Art/Stage 2.png'],
    [3, 'Game Art/Stage Art/Stage 3.png'],
    [4, 'Game Art/Stage Art/Stage 4.png'],
    [5, 'Game Art/Stage Art/Stage 5.png'],
    [6, 'Game Art/Stage Art/Stage 6.png'],
    [7, 'Game Art/Stage Art/Stage 7.png'],
    [8, 'Game Art/Stage Art/Stage 8.png'],
    [9, 'Game Art/Stage Art/Stage 9.png'],
    [10, 'Game Art/Stage Art/Stage 10.png'],
  ].forEach(([stageNum, src]) => {
    const img = new Image();
    img.src = assetUrl(src);
    img.onload = () => { stageBgImgs[stageNum] = img; onLoad(); };
    img.onerror = () => { onLoad(); };
  });
})();

// ── Player ────────────────────────────────────────────────────────────────────

// John Pork stage intro splash
(function loadJohnPorkIntro() {
  const img = new Image();
  img.src = assetUrl('Game Art/John Pork.png');
  img.onload = () => { johnPorkIntroImg = img; onLoad(); };
  img.onerror = () => { onLoad(); };
})();

let player = {
  x: Math.floor(MAP_COLS / 2) * TILE_SIZE,
  y: Math.floor(MAP_ROWS / 2) * TILE_SIZE,
  speed: 3, baseSpeed: 3,
  direction: 'down',
  frameIndex: 0, frameTick: 0, moving: false,
  hp: 100, maxHp: 100, hitFlash: 0,
  state: 'idle', activeAbility: null,
  attackFrame: 0, atkFrameTick: 0, hitDealt: false,
  level: 1, exp: 0, expToNext: 100, atkRange: 90,
  str: 10, agi: 8, int: 4,
  className: 'Barbarian', primaryStat: 'str',
  slowTimer: 0, berserkTimer: 0,
  berserkCasting: false, berserkCastFrame: 0, berserkCastTick: 0,
  windwalkActive: false, windwalkTimer: 0, windwalkDmg: 0,
  windwalkEntering: false, windwalkEnterFrame: 0, windwalkEnterTick: 0,
  windwalkExiting: false, windwalkExitFrame: 0, windwalkExitTick: 0,
  mageBlinkPhase: null, mageBlinkFrame: 0, mageBlinkTick: 0, mageBlinkTargetX: 0, mageBlinkTargetY: 0,
  dying: false, deathFrame: 0, deathTick: 0, deathTimer: 0,
  talentPaths: [-1,-1,-1],
  talentTaken: [[false,false,false], [false,false,false], [false,false,false]],
  lifesteal: 0, lifeRegenActive: false, lifeRegenTimer: 0,
  bloodlustKillTimer: 0, executionerActive: false,
  avatarActive: false, damageReduction: 0,
  cooldownRegenMult: 1, bulwarkActive: false, bulwarkShield: 0,
  assassinTalent: false, eternalFocusActive: false, eternalFocusCasts: 0,
  pendants: [],
};

// ── Enemies ───────────────────────────────────────────────────────────────────

function spawnEnemy() {
  let x, y;
  const topRows = Math.max(3, Math.floor(MAP_ROWS * 0.45));
  do {
    x = (1 + Math.floor(Math.random() * (MAP_COLS - 2))) * TILE_SIZE;
    y = (1 + Math.floor(Math.random() * topRows)) * TILE_SIZE;
  } while (Math.hypot(x - player.x, y - player.y) < DISPLAY_SIZE * 3 || !canMoveTo(x, y));
  return {
    type: 'johnpork', x, y, direction: 'down',
    frameIndex: 0, frameTick: 0,
    wanderDx: 0, wanderDy: 0, wanderTimer: 0,
    hp: 150, maxHp: 150, hitFlash: 0,
    state: 'wander', slowTimer: 0, aliveFrames: 0,
    attackTimer: 0, currentAttack: 0,
    attackFrame: 0, atkFrameTick: 0,
    dying: false, deathFrame: 0, deathTick: 0, deathDone: false, corpseTimer: 0
  };
}

function spawnGolem() {
  let x, y;
  const topRows = Math.max(3, Math.floor(MAP_ROWS * 0.45));
  do {
    x = (1 + Math.floor(Math.random() * (MAP_COLS - 2))) * TILE_SIZE;
    y = (1 + Math.floor(Math.random() * topRows)) * TILE_SIZE;
  } while (Math.hypot(x - player.x, y - player.y) < DISPLAY_SIZE * 3 || !canMoveTo(x, y));
  return {
    type: 'golem', x, y, direction: 'down',
    hp: GOLEM_HP, maxHp: GOLEM_HP, hitFlash: 0,
    state: 'wander', slamTimer: 0, slamEffect: 0, slamDamageDealt: false,
    slowTimer: 0, enraged: false, aliveFrames: 0,
    wanderDx: 0, wanderDy: 0, wanderTimer: 0,
    frameIndex: 0, frameTick: 0,
    dying: false, deathFrame: 0, deathTick: 0, dead: false
  };
}

function spawnGolemAt(nx, ny) {
  const pt = stagePointToWorld(nx, ny, GOLEM_SIZE, GOLEM_SIZE);
  return {
    type: 'golem', x: pt.x, y: pt.y, direction: 'down',
    hp: GOLEM_HP, maxHp: GOLEM_HP, hitFlash: 0,
    state: 'chase', slamTimer: 0, slamEffect: 0, slamDamageDealt: false,
    slowTimer: 0, enraged: false, aliveFrames: 0,
    wanderDx: 0, wanderDy: 0, wanderTimer: 0,
    frameIndex: 0, frameTick: 0,
    dying: false, deathFrame: 0, deathTick: 0, dead: false
  };
}

function spawnGoblin() {
  let x, y;
  const topRows = Math.max(3, Math.floor(MAP_ROWS * 0.45));
  do {
    x = (1 + Math.floor(Math.random() * (MAP_COLS - 2))) * TILE_SIZE;
    y = (1 + Math.floor(Math.random() * topRows)) * TILE_SIZE;
  } while (Math.hypot(x - player.x, y - player.y) < DISPLAY_SIZE * 3 || !canMoveTo(x, y));
  return {
    type: 'goblin', x, y, direction: 'down',
    hp: GOBLIN_HP, maxHp: GOBLIN_HP, hitFlash: 0,
    state: 'wander', attackTimer: 0, slowTimer: 0,
    aliveFrames: 0, wanderDx: 0, wanderDy: 0, wanderTimer: 0,
    frameIndex: 0, frameTick: 0,
    dying: false, deathFrame: 0, deathTick: 0, dead: false
  };
}

function spawnMinotaur() {
  let x, y;
  const topRows = Math.max(3, Math.floor(MAP_ROWS * 0.45));
  do {
    x = (1 + Math.floor(Math.random() * (MAP_COLS - 2))) * TILE_SIZE;
    y = (1 + Math.floor(Math.random() * topRows)) * TILE_SIZE;
  } while (Math.hypot(x - player.x, y - player.y) < DISPLAY_SIZE * 5 || !canRectMoveTo(x, y, DISPLAY_SIZE * 2, DISPLAY_SIZE * 2));
  return {
    type: 'minotaur', x, y, direction: 'down',
    hp: MINOTAUR_HP, maxHp: MINOTAUR_HP, hitFlash: 0,
    state: 'wander', chargeTimer: 0, chargeCooldown: 0,
    chargeDx: 0, chargeDy: 0, chargeHit: false, slowTimer: 0,
    aliveFrames: 0, wanderDx: 0, wanderDy: 0, wanderTimer: 0,
    frameIndex: 0, frameTick: 0,
    dying: false, deathFrame: 0, deathTick: 0, dead: false
  };
}

function spawnAt(minDist) {
  let x, y;
  const topRows = Math.max(3, Math.floor(MAP_ROWS * 0.45));
  do {
    x = (1 + Math.floor(Math.random() * (MAP_COLS - 2))) * TILE_SIZE;
    y = (1 + Math.floor(Math.random() * topRows)) * TILE_SIZE;
  } while (Math.hypot(x - player.x, y - player.y) < minDist || !canMoveTo(x, y));
  return { x, y };
}

function spawnArcher() {
  const { x, y } = spawnAt(DISPLAY_SIZE * 3);
  return { type:'archer', x, y, direction:'down',
    hp: ARCHER_HP, maxHp: ARCHER_HP, hitFlash: 0,
    state: 'wander', shootTimer: 0, slowTimer: 0, aliveFrames: 0,
    wanderDx: 0, wanderDy: 0, wanderTimer: 0, frameIndex: 0, frameTick: 0,
    dying: false, deathFrame: 0, deathTick: 0, dead: false };
}

function spawnSkeletalChampion(offset = 0) {
  const x = Math.max(TILE_SIZE, Math.min(canvas.width - SKELETAL_CHAMPION_SIZE - TILE_SIZE,
    Math.floor(MAP_COLS / 2) * TILE_SIZE + offset));
  const y = Math.max(TILE_SIZE, Math.floor(MAP_ROWS * 0.45) * TILE_SIZE);
  const spawnIndex = offset < 0 ? 0 : offset > 0 ? 1 : 0;
  return { type:'skeletal_champion', x, y, direction:'down',
    hp: SKELETAL_CHAMPION_HP, maxHp: SKELETAL_CHAMPION_HP, hitFlash: 0,
    state: 'chase', attackTimer: 0, slowTimer: 0, aliveFrames: 0,
    blockCooldown: 0, blockTimer: 0, spawnIndex,
    wanderDx: 0, wanderDy: 0, wanderTimer: 0, frameIndex: 0, frameTick: 0,
    dying: false, deathFrame: 0, deathTick: 0, deathDone: false, corpseTimer: 0 };
}

function spawnOrc(shielded = false, brute = false) {
  const { x, y } = spawnAt(DISPLAY_SIZE * 3);
  return { type:'orc', x, y, direction:'down',
    hp: brute ? ORC_HP * 2 : ORC_HP, maxHp: brute ? ORC_HP * 2 : ORC_HP, hitFlash: 0,
    state: 'wander', attackTimer: 0, slowTimer: 0,
    shielded, brute,
    chargeTimer: 0, enraged: false, chargeDx: 0, chargeDy: 0,
    aliveFrames: 0, wanderDx: 0, wanderDy: 0, wanderTimer: 0, frameIndex: 0, frameTick: 0,
    dying: false, deathFrame: 0, deathTick: 0, dead: false };
}

function spawnTroll() {
  const { x, y } = spawnAt(DISPLAY_SIZE * 3);
  return { type:'troll', x, y, direction:'down',
    hp: TROLL_HP, maxHp: TROLL_HP, hitFlash: 0,
    state: 'wander', throwTimer: 0, slowTimer: 0, aliveFrames: 0,
    wanderDx: 0, wanderDy: 0, wanderTimer: 0, frameIndex: 0, frameTick: 0 };
}

function spawnGhoul(side = null) {
  let x, y;
  const chosenSide = side || (Math.random() < 0.5 ? 'left' : 'right');
  let attempts = 0;
  do {
    x = chosenSide === 'left'
      ? (1 + Math.floor(Math.random() * 2)) * TILE_SIZE
      : (MAP_COLS - 3 + Math.floor(Math.random() * 2)) * TILE_SIZE;
    y = (2 + Math.floor(Math.random() * Math.max(1, MAP_ROWS - 5))) * TILE_SIZE;
    attempts++;
  } while ((!canMoveTo(x, y) || Math.hypot(x - player.x, y - player.y) < DISPLAY_SIZE * 2.5) && attempts < 80);

  if (attempts >= 80) ({ x, y } = spawnAt(DISPLAY_SIZE * 2.5));
  return { type:'ghoul', x, y, direction:'down',
    hp: GHOUL_HP, maxHp: GHOUL_HP, hitFlash: 0,
    state: 'wander', attackTimer: 0, slowTimer: 0, aliveFrames: 0,
    wanderDx: 0, wanderDy: 0, wanderTimer: 0, frameIndex: 0, frameTick: 0,
    dying: false, deathFrame: 0, deathTick: 0, dead: false };
}

function spawnAbomination() {
  let x, y, attempts = 0;
  do {
    x = (2 + Math.floor(Math.random() * (MAP_COLS - 4))) * TILE_SIZE;
    y = (2 + Math.floor(Math.random() * Math.max(1, Math.floor(MAP_ROWS * 0.3)))) * TILE_SIZE;
    attempts++;
  } while ((!canMoveTo(x, y) || Math.hypot(x - player.x, y - player.y) < DISPLAY_SIZE * 5) && attempts < 80);
  if (attempts >= 80) ({ x, y } = spawnAt(DISPLAY_SIZE * 4));
  return {
    type: 'abomination', x, y, direction: 'down',
    hp: ABOM_HP, maxHp: ABOM_HP, hitFlash: 0,
    state: 'chase', attackTimer: 0, slowTimer: 0, aliveFrames: 0,
    feedSpeedTimer: 0, fedPulse: 0,
    devourCooldown: 0,
    wanderDx: 0, wanderDy: 0, wanderTimer: 0, frameIndex: 0, frameTick: 0,
    dying: false, deathFrame: 0, deathTick: 0, dead: false
  };
}

function spawnGhoulWave(waveIdx) {
  const count = GHOUL_WAVES[Math.min(waveIdx, GHOUL_WAVES.length - 1)] || 0;
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 'left' : 'right';
    const ghoul = spawnGhoul(side);
    ghoul.spawnWarning = 35 + Math.floor(i / 2) * 2;
    enemies.push(ghoul);
  }
  if (count > 0) playsfx('ghoulIntro');
  // Abomination bursts in at wave 2 (index 1) — before it, just ghouls
  if (waveIdx === 1) {
    const abom = spawnAbomination();
    abom.spawnWarning = 50; // slightly delayed entrance after ghouls
    enemies.push(abom);
  }
}

function spawnGuardian() {
  const { x, y } = spawnAt(DISPLAY_SIZE * 4);
  return { type:'guardian', x, y, direction:'down',
    hp: GUARDIAN_HP, maxHp: GUARDIAN_HP, hitFlash: 0,
    state: 'wander', attackTimer: 0, slowTimer: 0, enraged: false,
    windupDir: 'down', spearEffect: 0, aliveFrames: 0,
    wanderDx: 0, wanderDy: 0, wanderTimer: 0, frameIndex: 0, frameTick: 0,
    dying: false, deathFrame: 0, deathTick: 0, dead: false };
}

function spawnTribunal() {
  const cx = Math.floor(MAP_COLS / 2) * TILE_SIZE;
  const cy = Math.floor(MAP_ROWS * 0.34) * TILE_SIZE;
  return [
    { type:'trib_sentinel', x: cx - DISPLAY_SIZE * 2.1, y: cy, direction:'down',
      hp: TRIB_SENTINEL_HP, maxHp: TRIB_SENTINEL_HP, hitFlash: 0,
      state:'chase', attackTimer: 0, slowTimer: 0, aliveFrames: 0,
      wanderDx: 0, wanderDy: 0, wanderTimer: 0, frameIndex: 0, frameTick: 0,
      dying: false, deathFrame: 0, deathTick: 0, deathDone: false, corpseTimer: 0 },
    { type:'trib_priest', x: cx, y: cy - DISPLAY_SIZE * 0.6, direction:'down',
      hp: TRIB_PRIEST_HP, maxHp: TRIB_PRIEST_HP, hitFlash: 0,
      state:'support', attackTimer: TRIB_PRIEST_HEAL_CD, slowTimer: 0, aliveFrames: 0,
      wanderDx: 0, wanderDy: 0, wanderTimer: 0, frameIndex: 0, frameTick: 0,
      dying: false, deathFrame: 0, deathTick: 0, deathDone: false, corpseTimer: 0 },
    { type:'trib_warden', x: cx + DISPLAY_SIZE * 2.1, y: cy, direction:'down',
      hp: TRIB_WARDEN_HP, maxHp: TRIB_WARDEN_HP, hitFlash: 0,
      state:'chase', attackTimer: 0, slowTimer: 0, aliveFrames: 0,
      wanderDx: 0, wanderDy: 0, wanderTimer: 0, frameIndex: 0, frameTick: 0,
      dying: false, deathFrame: 0, deathTick: 0, deathDone: false, corpseTimer: 0 }
  ];
}

function spawnMimic() {
  const { x, y } = spawnAt(DISPLAY_SIZE * 3);
  // Mirror player at level+1: add 3 to primary stat, 1 to others
  const ps  = player.primaryStat;
  const str = player.str + (ps === 'str' ? 3 : 1);
  const agi = player.agi + (ps === 'agi' ? 3 : 1);
  const int = player.int + (ps === 'int' ? 3 : 1);
  const primaryVal = ps === 'str' ? str : ps === 'agi' ? agi : int;
  const hp    = Math.round(str * 10 * 2);
  const speed = Math.round(2.5 * (1 + agi * 0.05) * 10) / 10;
  const ranked = abilities.filter(a => a.level > 0).sort((a, b) =>
    b.level - a.level || ['q','w','e','r'].indexOf(a.key) - ['q','w','e','r'].indexOf(b.key));
  const opener = ranked.find(a => a.key !== 'q')?.key || ranked[0]?.key || 'q';
  const mimicSkills = orderedAbilities(abilities.filter(a => a.level > 0)).map(a => a.key);
  if (player.className === 'Barbarian' && !mimicSkills.includes('r')) mimicSkills.push('r');
  // Random extra-leveled ability (Q/W/E — same as a real level-up would give)
  const extraAbility = ['q', 'w', 'e'][Math.floor(Math.random() * 3)];
  return {
    type: 'mimic', x, y, direction: 'down',
    hp, maxHp: hp, hitFlash: 0,
    state: 'wander', attackTimer: 0, slowTimer: 0,
    wanderDx: 0, wanderDy: 0, wanderTimer: 0, frameIndex: 0, frameTick: 0,
    mimicClass:     player.className,
    mimicPrimary:   ps,
    mimicStr: str,  mimicAgi: agi,  mimicInt: int,
    mimicDamage:    primaryVal,
    mimicSpeed:     Math.max(speed * 0.9, player.speed * 0.95),
    mimicLevel:     player.level + 1,
    mimicExtra:     extraAbility,
    mimicOpener: opener, mimicSkills, mimicSkillCursor: 0, mimicCooldowns: { q: 0, w: 0, e: 0, r: 0 }, mimicGlobalCooldown: 0,
    echoKey: null, echoTimer: 0,
    activeAbility: null, atkFrame: 0,
    dying: false, deathFrame: 0, deathTick: 0, deathDone: false, corpseTimer: 0
  };
}

function spawnStage(n) {
  player.x = Math.floor(MAP_COLS / 2) * TILE_SIZE;
  player.y = (MAP_ROWS - 3) * TILE_SIZE;
  player.direction = 'up';
  enemies.length = 0;
  projectiles.forEach(p => stopSfxInstance(p.flySound));
  projectiles.length = 0;
  spellEffects.length = 0;
  markers.length = 0;
  hazards.length = 0;
  telegraphs.length = 0;
  doorOpen = false;
  abilities.forEach(ab => { ab.timer = 0; });
  refreshBulwarkShield();
  if      (n === 1)  { for (let i=0;i<6;i++)  enemies.push(spawnGoblin()); }
  else if (n === 2)  {
    const hero = stagePointToWorld(0.50, 0.705, DISPLAY_SIZE, DISPLAY_SIZE);
    player.x = hero.x;
    player.y = hero.y;
    player.direction = 'up';
    enemies.push(
      spawnGolemAt(0.365, 0.315),
      spawnGolemAt(0.635, 0.315),
      spawnGolemAt(0.500, 0.475)
    );
  }
  else if (n === 3)  {
    const hero = stagePointToWorld(0.50, 0.805, DISPLAY_SIZE, DISPLAY_SIZE);
    player.x = hero.x;
    player.y = hero.y;
    player.direction = 'up';
    const minotaur = spawnMinotaur();
    const pos = stagePointToWorld(0.50, 0.380, DISPLAY_SIZE * 2, DISPLAY_SIZE * 2);
    minotaur.x = pos.x;
    minotaur.y = pos.y;
    minotaur.direction = 'down';
    enemies.push(minotaur);
  }
  else if (n === 4)  {
    for (let i=0;i<6;i++) enemies.push(spawnArcher());
    enemies.push(spawnSkeletalChampion(-DISPLAY_SIZE * 1.4), spawnSkeletalChampion(DISPLAY_SIZE * 1.4));
  }
  else if (n === 5)  { for (let i=0;i<4;i++)  enemies.push(spawnOrc(i === 0)); enemies.push(spawnOrc(false, true)); }
  else if (n === 6)  { enemies.push(spawnTroll(), spawnTroll()); }
  else if (n === 7)  { ghoulWaveIndex = 0; spawnGhoulWave(ghoulWaveIndex); }
  else if (n === 8)  { enemies.push(spawnMimic()); }
  else if (n === 9)  { enemies.push(spawnGuardian(), spawnGuardian()); }
  else if (n === 10) { enemies.push(...spawnTribunal()); }
  else if (n === 11) { enemies.push(spawnEnemy()); } // John Pork
  else               { for (let i=0;i<Math.min(n+2,8);i++) enemies.push(spawnGoblin()); }
}

const enemies = [];
const projectiles = [];
const spellEffects = [];
const hazards = [];
const telegraphs = [];

// ── Damage markers ────────────────────────────────────────────────────────────

const markers = [];
function addMarker(x, y, text, color) {
  markers.push({ x, y, text, color, life: 60 });
}

// ── Audio ─────────────────────────────────────────────────────────────────────

const bgMusic = new Audio('sounds/Ashes in the Nave (1).mp3');
bgMusic.loop   = true;
bgMusic.volume = 0.4;
const facebookRing = new Audio('sounds/Voice lines/facebook_call.mp3');
facebookRing.loop = true;
facebookRing.volume = 0.9;
let musicStarted = false;
function tryStartMusic() {
  if (gameState === 'johnporkintro' || (gameState === 'playing' && stage >= 11)) return;
  if (musicStarted && !bgMusic.paused) return;
  bgMusic.play()
    .then(() => { musicStarted = true; })
    .catch(() => {});
}

function startJohnPorkIntro() {
  clearMovementKeys();
  bgMusic.pause();
  facebookRing.currentTime = 0;
  facebookRing.play().catch(() => {});
  johnPorkIntroTimer = 600; // 10 seconds at 60fps
  gameState = 'johnporkintro';
}

function finishJohnPorkIntro() {
  facebookRing.pause();
  facebookRing.currentTime = 0;
  stage = 11;
  spawnStage(11);
  clearMovementKeys();
  gameState = 'playing';
}

const sfx = {
  hit:            new Audio('sounds/fx/hit.wav'),
  swing:          new Audio('sounds/fx/swing.mp3'),
  damage:         new Audio('sounds/fx/damage.wav'),
  barbarianDeath: new Audio('sounds/fx/Barbarian Death.mp3'),
  rogueDeath:     new Audio('sounds/fx/Rogue Death.wav'),
  mageDeath:      new Audio('sounds/fx/Mage Death.wav'),
  rogueHit:       new Audio('sounds/fx/Rogue hit.wav'),
  mageHit:        new Audio('sounds/fx/Mage hit.wav'),
  whirlwind:      new Audio('sounds/fx/Whirlwind2.wav'),
  hitWhirlwind:   new Audio('sounds/fx/hit_whirlwind.wav'),
  rogueSlash:     new Audio('sounds/fx/Rogue slash.wav'),
  stoneCrash:     new Audio('sounds/fx/Stone Crash.wav'),
  goblinDeath:    new Audio('sounds/fx/goblin death.wav'),
  golemDeath:     new Audio('sounds/fx/Golem Death.mp3'),
  slam:           new Audio('sounds/fx/Ground Smash.wav'),
  minotaurRoar:   new Audio('sounds/fx/Roar.mp3'),
  bowShot:        new Audio('sounds/fx/bow.wav'),
  skeletonDeath:  new Audio('sounds/fx/Skeleton death.wav'),
  bruteDeath:     new Audio('sounds/fx/Brute Death.wav'),
  orcDeath:       new Audio('sounds/fx/Orc Death.wav'),
  orcHit:         new Audio('sounds/fx/Orc hit.wav'),
  shieldBlock:    new Audio('sounds/fx/Shield block.wav'),
  ghoulIntro:     new Audio('sounds/fx/Ghoul pit intro.wav'),
  ghoulAttack:    new Audio('sounds/fx/Ghoul attack.wav'),
  ghoulDeath:     new Audio('sounds/fx/Ghoul death.wav'),
  guardianDeath:  new Audio('sounds/fx/Guardian Death.wav'),
  guardianHit:    new Audio('sounds/fx/Guardian Hit.wav'),
  fireballCast:   new Audio('sounds/fx/Fireballcast.mp3'),
  fireballFly:    new Audio('sounds/fx/Fireball flying.wav'),
  fireballImpact: new Audio('sounds/fx/Fireball impact.wav'),
  knifeThrow:     new Audio('sounds/fx/Knife Throw.mp3'),
  knifeImpact:    new Audio('sounds/fx/Knife Throw Impact.wav'),
  blastwave:      new Audio('sounds/fx/Blastwave.wav'),
  heavyGate:      new Audio('sounds/fx/Heavy Gate.wav'),
  frostNova:      new Audio('sounds/fx/Forst Nova.wav'),
  mageBlink:      new Audio('sounds/fx/Mage Blink.mp3'),
};
sfx.hit.volume            = 0.7;
sfx.swing.volume          = 0.5;
sfx.damage.volume         = 0.8;
sfx.barbarianDeath.volume = 0.9;
sfx.rogueDeath.volume     = 0.9;
sfx.mageDeath.volume      = 0.9;
sfx.rogueHit.volume       = 0.75;
sfx.mageHit.volume        = 0.75;
sfx.whirlwind.volume      = 0.5;
sfx.hitWhirlwind.volume   = 0.5;
sfx.rogueSlash.volume     = 0.7;
sfx.stoneCrash.volume     = 0.7;
sfx.goblinDeath.volume    = 0.7;
sfx.golemDeath.volume     = 0.8;
sfx.slam.volume           = 0.7;
sfx.minotaurRoar.volume   = 1.0;
sfx.bowShot.volume        = 0.6;
sfx.skeletonDeath.volume  = 0.7;
sfx.bruteDeath.volume     = 0.8;
sfx.orcDeath.volume       = 0.9;
sfx.orcHit.volume         = 0.7;
sfx.shieldBlock.volume    = 0.75;
sfx.ghoulIntro.volume     = 0.8;
sfx.ghoulAttack.volume    = 0.6;
sfx.ghoulDeath.volume     = 0.7;
sfx.guardianDeath.volume  = 0.8;
sfx.guardianHit.volume    = 0.7;
sfx.fireballCast.volume   = 0.75;
sfx.fireballFly.volume    = 0.45;
sfx.fireballImpact.volume = 0.85;
sfx.knifeThrow.volume     = 0.7;
sfx.knifeImpact.volume    = 0.75;
sfx.blastwave.volume      = 0.8;
sfx.heavyGate.volume      = 1.0;
sfx.frostNova.volume      = 0.8;
sfx.mageBlink.volume      = 0.8;

// Character select voice lines (one per class — Mage added when file is available)
const charSelectVoice = {
  Barbarian: new Audio(assetUrl('sounds/Voice lines/Barbarian Character Select.mp3')),
  Rogue:     new Audio(assetUrl('sounds/Voice lines/Rogue Character Select.mp3')),
  Mage:      new Audio(assetUrl('sounds/Voice lines/Mage Character selected.mp3')),
};
charSelectVoice.Barbarian.volume = 1.0;
charSelectVoice.Rogue.volume     = 1.0;
charSelectVoice.Mage.volume      = 1.0;
let lastVoiceClass = -1;

function playCharVoice(classIdx) {
  const name = CLASSES[classIdx]?.name;
  if (classIdx === lastVoiceClass || !name) return;
  lastVoiceClass = classIdx;
  const vo = charSelectVoice[name];
  if (!vo) return;
  // Stop any currently playing voice before starting new one
  Object.values(charSelectVoice).forEach(v => { v.pause(); v.currentTime = 0; });
  vo.play().catch(() => {});
}
function playsfx(name) {
  if (name === 'damage') {
    if (player.className === 'Rogue' && sfx.rogueHit) name = 'rogueHit';
    else if (player.className === 'Mage' && sfx.mageHit) name = 'mageHit';
  }
  if (!sfx[name]) return;
  const s = sfx[name].cloneNode();
  s.volume = sfx[name].volume;
  s.play().catch(() => {});
}
function playSfxBurst(name, count = 3, delayMs = 150) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => playsfx(name), i * delayMs);
  }
}
function startLoopingSfx(name) {
  if (!sfx[name]) return null;
  const s = sfx[name].cloneNode();
  s.volume = sfx[name].volume;
  s.loop = true;
  s.play().catch(() => {});
  return s;
}
function stopSfxInstance(s) {
  if (!s) return;
  s.pause();
  s.currentTime = 0;
}

// ── Class setup ───────────────────────────────────────────────────────────────

function setupAbilitiesForClass(cls) {
  const cdR = cls.int * 12;  // 0.2s per INT point at 60fps
  const ps  = cls[cls.primaryStat]; // primary stat value — changes with Plasticity
  abilities.length = 0;
  // Q starts at level 1 (usable immediately). W/E/R start at 0 (locked until leveled up).
  const mkab = (key, label, name, color, cd, dmg, tooltipText) => ({
    key, label, name, color,
    cooldown: Math.max(60, cd - cdR), timer: 0,
    damage: dmg, level: key === 'q' ? 1 : 0, maxLevel: key === 'r' ? 2 : 3,
    tooltip: tooltipText
  });
  if (cls.name === 'Barbarian') {
    abilities.push(
      mkab('q','Q','slash',    '#e94560', 240, ps,                   qTooltipText('slash', ps, cls.primaryStat, cls[cls.primaryStat])),
      mkab('w','W','whirlwind','#e67e22', 480, Math.round(ps*1.5),   `Spin attack. ${Math.round(ps*1.5)} dmg to all nearby enemies.`),
      mkab('e','E','slam',     '#f1c40f', 840, Math.round(ps*1.75),  `Ground slam. ${Math.round(ps*1.75)} dmg, slows enemies 50% for 2s.`),
      mkab('r','R','berserk',  '#9b59b6',1800, 0,                    berserkTooltipText(1, cls.primaryStat, cls[cls.primaryStat]))
    );
  } else if (cls.name === 'Rogue') {
    abilities.push(
      mkab('q','Q','slash',     '#2ecc71', 240,  ps,                 qTooltipText('slash', ps, cls.primaryStat, cls[cls.primaryStat])),
      mkab('w','W','throw',     '#27ae60', 360,  ps,                  `Throw dagger. ${ps} dmg in the direction you face.`),
      mkab('e','E','windwalk',  '#d8d0b8', 840,  0,                   windwalkTooltipText(1, cls.primaryStat, cls[cls.primaryStat])),
      mkab('r','R','slicedice', '#16a085', 1800, Math.round(ps*3),   `Slice and Dice. ${Math.round(ps*3)} AoE damage around you (3x ${primaryStatLabel(cls.primaryStat)} base).`)
    );
  } else {
    abilities.push(
      mkab('q','Q','blastwave','#3498db', 240, ps,                   qTooltipText('blastwave', ps, cls.primaryStat, cls[cls.primaryStat])),
      mkab('w','W','fireball', '#e74c3c', 660, Math.round(ps*1.75),  `Fireball. ${Math.round(ps*1.75)} dmg in facing direction with splash.`),
      mkab('e','E','frostnova','#1abc9c', 840, Math.round(ps*1.75),  `Frost Nova. ${Math.round(ps*1.75)} dmg, freezes enemies for 2s (1s stun, then 1s slow).`),
      mkab('r','R','blink',    '#8e44ad', 1200, 0,                   `Blink. Teleport forward 8 hero lengths. Lv 2: grants a second charge usable 1s after the first (full 20s CD resets after second blink).`)
    );
  }
}

function orderedAbilities(list = abilities) {
  const orderOf = ab => {
    const idx = ABILITY_KEY_ORDER.indexOf(ab.key);
    return idx === -1 ? ABILITY_KEY_ORDER.length : idx;
  };
  return [...list].sort((a, b) => orderOf(a) - orderOf(b));
}

function startGame(classIdx) {
  const cls = CLASSES[classIdx];
  const speed = Math.round(2.5 * (1 + cls.agi * 0.05) * 10) / 10;
  const hp = cls.str * 10;
  player.x = Math.floor(MAP_COLS / 2) * TILE_SIZE;
  player.y = Math.floor(MAP_ROWS / 2) * TILE_SIZE;
  player.speed = speed; player.baseSpeed = speed;
  player.direction = 'down';
  player.castDirection = 'down';
  player.frameIndex = 0; player.frameTick = 0; player.moving = false;
  player.hp = hp; player.maxHp = hp; player.hitFlash = 0;
  player.state = 'idle'; player.activeAbility = null;
  player.attackFrame = 0; player.atkFrameTick = 0; player.hitDealt = false;
  player.level = 1; player.exp = 0; player.expToNext = 100;
  player.atkRange = Math.round(DISPLAY_SIZE * 1.4);
  player.str = cls.str; player.agi = cls.agi; player.int = cls.int;
  player.className = cls.name; player.primaryStat = cls.primaryStat;
  player.dying = false; player.deathFrame = 0; player.deathTick = 0; player.deathTimer = 0;
  player.slowTimer = 0; player.berserkTimer = 0;
  player.berserkCasting = false; player.berserkCastFrame = 0; player.berserkCastTick = 0;
  player.windwalkActive = false; player.windwalkTimer = 0; player.windwalkDmg = 0;
  player.windwalkEntering = false; player.windwalkEnterFrame = 0; player.windwalkEnterTick = 0;
  player.windwalkExiting = false; player.windwalkExitFrame = 0; player.windwalkExitTick = 0;
  player.mageBlinkPhase = null; player.mageBlinkFrame = 0; player.mageBlinkTick = 0;
  player.blinkChargeAvailable = false;
  player.talentPaths = [-1,-1,-1];
  player.talentTaken = [[false,false,false], [false,false,false], [false,false,false]];
  player.lifesteal = 0; player.lifeRegenActive = false; player.lifeRegenTimer = 0;
  player.bloodlustKillTimer = 0; player.executionerActive = false;
  player.avatarActive = false; player.damageReduction = 0;
  player.cooldownRegenMult = 1; player.bulwarkActive = false; player.bulwarkShield = 0;
  player.undyingRage = false; player.undyingRageUsed = false;
  player.pendants = [];
  player.bonusStatPoints = 0;
  player.mightBonus = false;
  player.assassinProc = false; player.assassinProcCD = 0; player.assassinTalent = false;
  player.enlightenShield = false; player.enlightenShieldCD = 0;
  player.eternalFocusActive = false; player.eternalFocusCasts = 0;
  player.slamImmunity = 0;
  setupAbilitiesForClass(cls);
  stage = 1;
  spawnStage(1);
  gameState = 'playing';
}

function expForEnemy(e) {
  // Base XP by type. Stages with many weaker enemies use lower bases so
  // the total XP per stage stays comparable to solo/duo stages.
  const base = {
    goblin:   20,  // ×6  → up to 120 fresh
    golem:    45,  // ×3  → up to 135 fresh
    minotaur: 180, // ×1  → boss reward
    archer:   25,  // ×6  → up to 150 fresh (ranged, easy to ignore)
    skeletal_champion: 45,
    orc:      55,  // ×4  → up to 220 fresh
    troll:    70,  // ×2  → up to 140 fresh
    ghoul:        2,
    abomination:  250,
    mimic:        230,
    guardian: 75,  // ×2  → up to 150 fresh
    trib_sentinel: 85,
    trib_warden:   85,
    trib_priest:   85,
    johnpork: 150,
  }[e.type] ?? 150;

  // Decay: XP halves every 45 seconds (2700 frames). Fast kills rewarded.
  // Formula: base * 0.5^(aliveFrames/2700), floored to 1.
  const frames = e.aliveFrames || 0;
  const decayed = Math.max(1, Math.round(base * Math.pow(0.5, frames / 2700)));
  return decayed;
}

// ── Input ─────────────────────────────────────────────────────────────────────

const keys = {};
const MOVEMENT_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
function isMovementKey(key) {
  return MOVEMENT_KEYS.includes(key);
}
function clearMovementKeys() {
  MOVEMENT_KEYS.forEach(k => { keys[k] = false; });
}
['pointerdown', 'mousedown', 'touchstart'].forEach(eventName => {
  document.addEventListener(eventName, tryStartMusic, { passive: true });
});

document.addEventListener('keydown', (e) => {
  tryStartMusic();
  if (gameState === 'johnporkintro') return;
  const moveKey = isMovementKey(e.key);
  if (moveKey) e.preventDefault();
  if ((gameState === 'pendant' || gameState === 'levelup' ||
       gameState === 'stagechoice' || gameState === 'stageclear') && moveKey) {
    clearMovementKeys();
    return;
  }

  if (gameState === 'title') {
    if (e.key === 'ArrowUp')   titleSelected = (titleSelected - 1 + TITLE_ITEMS.length) % TITLE_ITEMS.length;
    if (e.key === 'ArrowDown') titleSelected = (titleSelected + 1) % TITLE_ITEMS.length;
    if (e.key === 'Enter' || e.key === ' ') {
      if (TITLE_ITEMS[titleSelected] === 'New Game')  { devMode = false; gameMode = 'normal';   gameState = 'menu'; selectedClass = 0; }
      if (TITLE_ITEMS[titleSelected] === 'Softcore')  { devMode = false; gameMode = 'softcore'; gameState = 'menu'; selectedClass = 0; }
      if (TITLE_ITEMS[titleSelected] === 'Dev Test')  { devMode = true;  gameMode = 'dev';      gameState = 'menu'; selectedClass = 0; }
    }
    return;
  }

  if (gameState === 'classconfirm') {
    // Any key after fade-in jumps to start of fade-out (preserving the clean dissolve)
    const FADE_IN = 90, HOLD = 240;
    if (classConfirmTimer > FADE_IN) classConfirmTimer = FADE_IN + HOLD;
    return;
  }

  if (gameState === 'devsetup') {
    const SECTIONS = 6;
    if (e.key === 'ArrowUp')   devSetupSection = (devSetupSection - 1 + SECTIONS) % SECTIONS;
    if (e.key === 'ArrowDown') devSetupSection = (devSetupSection + 1) % SECTIONS;

    if (devSetupSection === 0) { // ── Level ──
      if (e.key === 'ArrowLeft')  {
        devSetupLevel = Math.max(1, devSetupLevel - 1);
        clampDevChoicesForLevel();
      }
      if (e.key === 'ArrowRight') {
        devSetupLevel = Math.min(10, devSetupLevel + 1);
        clampDevChoicesForLevel();
      }

    } else if (devSetupSection === 1) { // Skills
      const totalPts = devSkillPointsForLevel(devSetupLevel);
      const usedPts  = devSkillUsed();
      if (e.key === 'ArrowLeft')  devSkillCursor = (devSkillCursor - 1 + 4) % 4;
      if (e.key === 'ArrowRight') devSkillCursor = (devSkillCursor + 1) % 4;
      const maxExtra = devSkillMaxLevel(devSkillCursor) - devSkillBaseLevel(devSkillCursor);
      if ((e.key === ' ' || e.key === 'z') && usedPts < totalPts &&
          isDevSkillUnlocked(devSkillCursor) && devSkillAlloc[devSkillCursor] < maxExtra) {
        devSkillAlloc[devSkillCursor]++;
      }
      if ((e.key === 'Backspace' || e.key === 'x') && devSkillAlloc[devSkillCursor] > 0)
        devSkillAlloc[devSkillCursor]--;

    } else if (devSetupSection === 2) { // Stats
      const totalPts = (devSetupLevel - 1) * 3;
      const usedPts  = devStatAlloc[0] + devStatAlloc[1] + devStatAlloc[2];
      if (e.key === 'ArrowLeft')  devStatCursor = (devStatCursor - 1 + 3) % 3;
      if (e.key === 'ArrowRight') devStatCursor = (devStatCursor + 1) % 3;
      if ((e.key === ' ' || e.key === 'z') && usedPts < totalPts)
        devStatAlloc[devStatCursor]++;
      if ((e.key === 'Backspace' || e.key === 'x') && devStatAlloc[devStatCursor] > 0)
        devStatAlloc[devStatCursor]--;

    } else if (devSetupSection === 3) { // ── Talents ──
      const availSlots = [devSetupLevel>=3, devSetupLevel>=7, devSetupLevel>=10].filter(Boolean).length;
      if (availSlots > 0) {
        if (e.key === 'ArrowLeft')  devTalentCursor = (devTalentCursor - 1 + availSlots) % availSlots;
        if (e.key === 'ArrowRight') devTalentCursor = (devTalentCursor + 1) % availSlots;
        if (e.key === ' ') {
          // cycle: -1(none) → 0(Off) → 1(Def) → 2(Util) → -1 ...
          devTalentSlots[devTalentCursor] = devTalentSlots[devTalentCursor] >= 2 ? -1 : devTalentSlots[devTalentCursor] + 1;
          if (!devHasPlasticitySelected()) devPrimaryStat = null;
        }
        const statMap = { '1': 'str', '2': 'agi', '3': 'int' };
        if (devHasPlasticitySelected() && statMap[e.key]) devPrimaryStat = statMap[e.key];
      }

    } else if (devSetupSection === 4) { // ── Pendants ──
      if (e.key === 'ArrowLeft')  devPendantCursor = Math.max(0, devPendantCursor - 1);
      if (e.key === 'ArrowRight') devPendantCursor = Math.min(DEV_PENDANTS.length - 1, devPendantCursor + 1);
      if (e.key === ' ' || e.key === 'Enter') devSelectedPendants[devPendantCursor] = !devSelectedPendants[devPendantCursor];

    } else { // ── Stage (section 5) ──
      if (e.key === 'ArrowLeft')  devSetupStage = Math.max(1, devSetupStage - 1);
      if (e.key === 'ArrowRight') devSetupStage = Math.min(11, devSetupStage + 1);
      if (e.key === 'Enter') applyDevConfig();
    }
    return;
  }

  if (gameState === 'menu') {
    if (e.key === 'ArrowLeft')  selectedClass = (selectedClass - 1 + CLASSES.length) % CLASSES.length;
    if (e.key === 'ArrowRight') selectedClass = (selectedClass + 1) % CLASSES.length;
    const confirmClass = (idx) => {
      pendingClassIdx      = idx;
      classConfirmAlpha    = 0;
      classConfirmTimer    = 0;
      lastVoiceClass       = -1;
      playCharVoice(idx);
      gameState = 'classconfirm';
    };
    if (e.key === 'Enter') confirmClass(selectedClass);
    return;
  }

  if (gameState === 'gameover') {
    if (devMode && e.key.toLowerCase() === 'r') {
      player.hp = player.maxHp;
      player.state = 'idle'; player.activeAbility = null;
      player.dying = false; player.deathFrame = 0; player.deathTick = 0; player.deathTimer = 0;
      Object.keys(keys).forEach(k => { keys[k] = false; });
      spawnStage(stage);
      gameState = 'playing';
    } else if (devMode && e.key.toLowerCase() === 's') {
      stage = Math.min(stage + 1, 11);
      player.hp = player.maxHp;
      player.state = 'idle';
      player.dying = false; player.deathFrame = 0; player.deathTick = 0; player.deathTimer = 0;
      Object.keys(keys).forEach(k => { keys[k] = false; });
      spawnStage(stage);
      gameState = 'playing';
    } else {
      // Normal mode: any key restarts the game from the beginning
      devMode = false;
      gameMode = 'normal';
      gameState = 'title';
    }
    return;
  }

  if (gameState === 'win') {
    devMode = false;
    gameMode = 'normal';
    gameState = 'title';
    return;
  }

  if (gameState === 'pendant') {
    if (e.key === 'Enter' || e.key === ' ') {
      clearMovementKeys();
      pendingPendant = null;
      gameState = 'playing';
      if (pendingLevelup) {
        pendingLevelup = false;
        triggerLevelUp();
      }
    }
    return;
  }

  if (gameState === 'levelup') {
    const numKey = parseInt(e.key) - 1;

    if (levelupPhase === 'skill') {
      const levelable = getLevelableSkills();
      if (numKey >= 0 && numKey < levelable.length) {
        levelSkill(levelable[numKey]);
        levelupStatsLeft = 3 + (player.bonusStatPoints || 0);
        levelupStatCursor = 0;
        levelupPhase = 'stats';
      }
      return;
    }

    if (levelupPhase === 'stats') {
      const statMap = { '1': 'str', '2': 'agi', '3': 'int' };
      const stats = ['str', 'agi', 'int'];
      if (e.key === 'ArrowLeft') levelupStatCursor = (levelupStatCursor + 2) % 3;
      if (e.key === 'ArrowRight') levelupStatCursor = (levelupStatCursor + 1) % 3;
      if (e.key === 'Enter' || e.key === ' ') {
        spendLevelupStat(stats[levelupStatCursor], e.shiftKey ? levelupStatsLeft : 1);
        clearMovementKeys();
      }
      if (statMap[e.key]) {
        levelupStatCursor = stats.indexOf(statMap[e.key]);
        spendLevelupStat(statMap[e.key], e.shiftKey ? levelupStatsLeft : 1);
        clearMovementKeys();
      }
      return;
    }

    if (levelupPhase === 'talent') {
      const tierIdx = currentTalentTier();
      const avail = [0, 1, 2].filter(pi => tierIdx >= 0 && !isTalentTaken(pi, tierIdx));
      if (avail.length) {
        if (e.key === 'ArrowLeft') levelupTalentCursor = (levelupTalentCursor - 1 + avail.length) % avail.length;
        if (e.key === 'ArrowRight') levelupTalentCursor = (levelupTalentCursor + 1) % avail.length;
        if (e.key === 'Enter' || e.key === ' ') {
          chooseLevelupTalent(avail[levelupTalentCursor], true);
          clearMovementKeys();
        }
      }
      if (numKey >= 0 && numKey < avail.length) {
        levelupTalentCursor = numKey;
        chooseLevelupTalent(avail[numKey]);
        clearMovementKeys();
      }
      clearMovementKeys();
      return;
    }

    if (levelupPhase === 'talentConfirm') {
      if (talentConfirmData?.mode === 'confirm') {
        if ((e.key === 'Enter' || e.key === ' ') && talentConfirmData.armed !== false) confirmPendingTalent();
        if (e.key === 'Escape' || e.key === 'Backspace') {
          talentConfirmData = null;
          levelupPhase = 'talent';
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        talentConfirmData = null;
        levelupPhase = 'skill';
        clearMovementKeys();
        gameState = 'playing';
      }
      return;
    }

    if (levelupPhase === 'primattr') {
      const statMap = { '1': 'str', '2': 'agi', '3': 'int' };
      if (statMap[e.key]) {
        choosePrimaryAttr(statMap[e.key]);
        talentConfirmData = {
          mode: 'acquired',
          name: 'Plasticity',
          desc: `Primary attribute changed to ${statMap[e.key].toUpperCase()}.`,
          color: primaryStatColor(statMap[e.key])
        };
        levelupPhase = 'talentConfirm';
        clearMovementKeys();
      }
      return;
    }
  }

  if (gameState === 'stagechoice') {
    if (e.key === '1') {
      // Rest: full heal, lose EXP progress in current level
      player.hp = player.maxHp;
      player.exp = 0;
    }
    // key '2' = Continue: no change
    if (e.key === '1' || e.key === '2') {
      player.undyingRageUsed = false;
      const nextStage = stage + 1;
      clearMovementKeys();
      if (nextStage === 11) {
        startJohnPorkIntro();
      } else if (getTransitionArt(nextStage)) {
        transitionNextStage = nextStage;
        transitionFade = 0; transitionPhase = 'fade'; transitionGatePlayed = false;
        gameState = 'stagetransition';
      } else {
        stage = nextStage;
        spawnStage(stage);
        gameState = 'playing';
      }
    }
    return;
  }

  if (gameState === 'stageclear') {
    if (e.key === 'Enter' || e.key === ' ') {
      player.undyingRageUsed = false;
      const nextStage = stage + 1;
      clearMovementKeys();
      if (nextStage === 11) {
        startJohnPorkIntro();
      } else if (getTransitionArt(nextStage)) {
        transitionNextStage = nextStage;
        transitionFade = 0; transitionPhase = 'fade'; transitionGatePlayed = false;
        gameState = 'stagetransition';
      } else {
        stage = nextStage;
        spawnStage(stage);
        gameState = 'playing';
      }
    }
    return;
  }

  if (gameState === 'stagetransition') {
    if (transitionPhase === 'art') {
      stage = transitionNextStage;
      spawnStage(transitionNextStage);
      clearMovementKeys();
      gameState = 'playing';
    }
    return;
  }

  keys[e.key] = true;

  if (player.state === 'idle') {
    abilities.forEach(ab => {
      if (e.key.toLowerCase() === ab.key && ab.timer === 0 && ab.level > 0) {
      ab.timer = ab.cooldown;
      player.castDirection = player.direction;
      if (ab.name === 'berserk') { registerSkillCast(ab); startBerserkCast(); return; }
      if (ab.name === 'blink') {
        if (ab.level >= 2 && player.blinkChargeAvailable) {
          // Second charge — consume it and start full CD
          player.blinkChargeAvailable = false;
          ab.timer = ab.cooldown;
        } else {
          // First blink — if Lv 2, short 1s gap before second charge; else full CD
          if (ab.level >= 2) {
            player.blinkChargeAvailable = true;
            ab.timer = 60; // 1s gap
          }
          // (Lv 1: ab.timer already set to ab.cooldown above)
        }
        registerSkillCast(ab);
        startMageBlink();
        return;
      }
      if (ab.name === 'fireball') playsfx('fireballCast');
      registerSkillCast(ab);
      player.state         = 'attacking';
        player.activeAbility = ab.key;
        player.attackFrame   = 0;
        player.atkFrameTick  = 0;
        player.hitDealt      = false;
      }
    });
  }
});
document.addEventListener('keyup', (e) => {
  keys[e.key] = false;
  if (gameState === 'levelup' && levelupPhase === 'talentConfirm' &&
      talentConfirmData?.mode === 'confirm' && (e.key === 'Enter' || e.key === ' ')) {
    talentConfirmData.armed = true;
  }
});
document.addEventListener('mousemove', (ev) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = ev.clientX - rect.left;
  mouseY = ev.clientY - rect.top;
});
document.addEventListener('click', (ev) => {
  tryStartMusic();
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  handleGameClick(x, y, ev.shiftKey);
});

function handleGameClick(x, y, shiftKey = false) {
  if (gameState !== 'levelup') return;
  if (levelupPhase === 'stats') {
    const stats = ['str', 'agi', 'int'];
    const cW = 200, cH = 130, cGap = 24, totW = 3 * cW + 2 * cGap;
    const sx = (canvas.width - totW) / 2;
    for (let i = 0; i < stats.length; i++) {
      const cx = sx + i * (cW + cGap), cy = 108;
      if (x >= cx && x <= cx + cW && y >= cy && y <= cy + cH) {
        levelupStatCursor = i;
        spendLevelupStat(stats[i], shiftKey ? levelupStatsLeft : 1);
        clearMovementKeys();
        return;
      }
    }
  }
  if (levelupPhase === 'talent') {
    const cardW = 240, cardH = 150, colGap = 28, rowGap = 14;
    const totalW = 3 * cardW + 2 * colGap;
    const startX = (canvas.width - totalW) / 2;
    const gridY = 162;
    const ti = currentTalentTier();
    for (let pi = 0; pi < 3; pi++) {
      if (ti < 0 || ti > 2) continue;
      const colX = startX + pi * (cardW + colGap);
      const cy = gridY + ti * (cardH + rowGap);
      if (x >= colX && x <= colX + cardW && y >= cy && y <= cy + cardH) {
        const avail = [0, 1, 2].filter(pathIdx => !isTalentTaken(pathIdx, ti));
        levelupTalentCursor = Math.max(0, avail.indexOf(pi));
        chooseLevelupTalent(pi);
        clearMovementKeys();
        return;
      }
    }
  }
}

// ── Collision ─────────────────────────────────────────────────────────────────

function isSolid(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return true;
  // Door tiles at top wall — passable only when open
  if (!getStageDoorRect(stage) && row === 0 && col >= DOOR_COL && col < DOOR_COL + 3) return !doorOpen;
  const stageDoor = getStageDoorRect(stage);
  if (stageDoor && stage === 2 && x >= stageDoor.x && x <= stageDoor.x + stageDoor.w &&
      y >= stageDoor.y && y <= stageDoor.y + stageDoor.h) {
    return !doorOpen;
  }
  if (isStageArtBlocked(x, y)) return true;
  return map[row][col] === WALL;
}

function canMoveTo(x, y) {
  return !isSolid(x, y) &&
         !isSolid(x + DISPLAY_SIZE - 1, y) &&
         !isSolid(x, y + DISPLAY_SIZE - 1) &&
         !isSolid(x + DISPLAY_SIZE - 1, y + DISPLAY_SIZE - 1);
}

function canRectMoveTo(x, y, w, h) {
  return !isSolid(x, y) &&
         !isSolid(x + w - 1, y) &&
         !isSolid(x, y + h - 1) &&
         !isSolid(x + w - 1, y + h - 1);
}

function minotaurHitsSideWall(x, w) {
  return x <= TILE_SIZE || x + w >= canvas.width - TILE_SIZE;
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function pointInPoly(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];
    const crosses = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / ((yj - yi) || 0.00001) + xi);
    if (crosses) inside = !inside;
  }
  return inside;
}

function getStageBgRect(stageNum = stage) {
  const img = stageBgImgs[stageNum];
  if (!img) return null;
  const scale = Math.max(canvas.width / img.width, GAME_HEIGHT / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  return { x: (canvas.width - dw) / 2, y: (GAME_HEIGHT - dh) / 2, w: dw, h: dh };
}

function stagePointToWorld(nx, ny, w = DISPLAY_SIZE, h = DISPLAY_SIZE, stageNum = stage) {
  const bgRect = getStageBgRect(stageNum);
  const cx = bgRect ? bgRect.x + nx * bgRect.w : nx * canvas.width;
  const cy = bgRect ? bgRect.y + ny * bgRect.h : ny * GAME_HEIGHT;
  return {
    x: Math.max(TILE_SIZE, Math.min(canvas.width - w - TILE_SIZE, cx - w / 2)),
    y: Math.max(TILE_SIZE, Math.min(GAME_HEIGHT - h - TILE_SIZE, cy - h / 2)),
  };
}

function getStageDoorRect(stageNum = stage) {
  const door = STAGE_DOORS[stageNum];
  const bgRect = door && getStageBgRect(stageNum);
  if (!bgRect) return null;
  return {
    x: bgRect.x + door.x * bgRect.w,
    y: bgRect.y + door.y * bgRect.h,
    w: door.w * bgRect.w,
    h: door.h * bgRect.h,
  };
}

function isStageArtBlocked(x, y) {
  const stageDoor = getStageDoorRect(stage);
  if (stageDoor && x >= stageDoor.x && x <= stageDoor.x + stageDoor.w &&
      y >= stageDoor.y && y <= stageDoor.y + stageDoor.h + TILE_SIZE) {
    return false;
  }

  const playArea = STAGE_PLAY_AREAS[stage];
  const playAreaBgRect = playArea && getStageBgRect(stage);
  if (playAreaBgRect) {
    const nx = (x - playAreaBgRect.x) / playAreaBgRect.w;
    const ny = (y - playAreaBgRect.y) / playAreaBgRect.h;
    if (!pointInPoly(nx, ny, playArea)) return true;
  }

  const blockers = STAGE_BLOCKERS[stage];
  const bgRect = blockers && getStageBgRect(stage);
  if (!bgRect) return false;

  for (const b of blockers) {
    const rx = bgRect.x + b.x * bgRect.w;
    const ry = bgRect.y + b.y * bgRect.h;
    const rw = b.w * bgRect.w;
    const rh = b.h * bgRect.h;
    if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) return true;
  }
  return false;
}

// ── AI helpers ────────────────────────────────────────────────────────────────

// Returns smoothly normalized movement vector toward (dx,dy) — eliminates the
// stutter caused by Math.sign snapping to 8 fixed directions every frame.
function chaseVec(dx, dy, spd) {
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return { mx: 0, my: 0 };
  return { mx: (dx / dist) * spd, my: (dy / dist) * spd };
}

// Push overlapping enemies gently apart so they don't stack on each other.
function separationVec(e, radius) {
  let fx = 0, fy = 0;
  for (const o of enemies) {
    if (o === e || o.dying || o.deathDone) continue;
    const sdx = e.x - o.x, sdy = e.y - o.y;
    const sd  = Math.hypot(sdx, sdy);
    if (sd < radius && sd > 0.1) {
      const push = (radius - sd) / radius;
      fx += (sdx / sd) * push * 1.5;
      fy += (sdy / sd) * push * 1.5;
    }
  }
  return { fx, fy };
}

function countNearbyEnemies(e, type, radius) {
  let count = 0;
  const ex = e.x + (enemyHitbox(e).w || DISPLAY_SIZE) / 2;
  const ey = e.y + (enemyHitbox(e).h || DISPLAY_SIZE) / 2;
  enemies.forEach(o => {
    if (o === e || o.type !== type || o.dying || o.deathDone || o.hp <= 0) return;
    const ob = enemyHitbox(o);
    if (Math.hypot(ex - (ob.x + ob.w / 2), ey - (ob.y + ob.h / 2)) < radius) count++;
  });
  return count;
}

function rectInFrontOf(e, range, width, size = DISPLAY_SIZE) {
  const cx = e.x + size / 2;
  const cy = e.y + size / 2;
  if (e.direction === 'right') return { x: cx, y: cy - width / 2, w: range, h: width };
  if (e.direction === 'left')  return { x: cx - range, y: cy - width / 2, w: range, h: width };
  if (e.direction === 'down')  return { x: cx - width / 2, y: cy, w: width, h: range };
  return { x: cx - width / 2, y: cy - range, w: width, h: range };
}

function isInFrontArc(e, tx, ty, size = DISPLAY_SIZE) {
  const cx = e.x + size / 2, cy = e.y + size / 2;
  const dx = tx - cx, dy = ty - cy;
  if (e.direction === 'right') return dx > 0 && Math.abs(dy) < Math.abs(dx) * 1.2;
  if (e.direction === 'left')  return dx < 0 && Math.abs(dy) < Math.abs(dx) * 1.2;
  if (e.direction === 'down')  return dy > 0 && Math.abs(dx) < Math.abs(dy) * 1.2;
  return dy < 0 && Math.abs(dx) < Math.abs(dy) * 1.2;
}

function addHazard(type, x, y, r, life, opts = {}) {
  hazards.push({ type, x, y, r, life, maxLife: life, tick: 0, ...opts });
}

function applyFreezeStatus(e) {
  e.frozenTimer = Math.max(e.frozenTimer || 0, 60);
  e.slowTimer = Math.max(e.slowTimer || 0, 60);
  e.frostTintTimer = Math.max(e.frostTintTimer || 0, 120);
}

function tickEnemyControlStatus(e) {
  if (e.frostTintTimer > 0) e.frostTintTimer--;
  if (e.frozenTimer > 0) {
    e.frozenTimer--;
    if (e.hitFlash > 0) e.hitFlash--;
    return true;
  }
  return false;
}

function updateHazards() {
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    h.tick++;
    if (h.damage && h.tick % (h.damageEvery || 30) === 0) {
      const pcx = player.x + DISPLAY_SIZE / 2, pcy = player.y + DISPLAY_SIZE / 2;
      if (Math.hypot(pcx - h.x, pcy - h.y) < h.r) {
        const base = player.berserkTimer > 0 ? Math.round(h.damage * 1.5) : h.damage;
        const dmg = damagePlayer(base, 10);
        if (dmg > 0) addMarker(pcx, player.y, `-${dmg}`, h.color || '#cc8844');
      }
    }
    if (--h.life <= 0) hazards.splice(i, 1);
  }
}

function updateTelegraphs() {
  for (let i = telegraphs.length - 1; i >= 0; i--) {
    if (--telegraphs[i].life <= 0) telegraphs.splice(i, 1);
  }
}

function playerHazardSlowMult() {
  const pcx = player.x + DISPLAY_SIZE / 2, pcy = player.y + DISPLAY_SIZE / 2;
  return hazards.some(h => h.slow && Math.hypot(pcx - h.x, pcy - h.y) < h.r) ? 0.55 : 1;
}

function blocksPlayerMove(nx, ny) {
  const px = nx + DISPLAY_SIZE / 2, py = ny + DISPLAY_SIZE / 2;
  if (hazards.some(h => h.block && Math.hypot(px - h.x, py - h.y) < h.r)) return true;
  return false;
}

// ── Combat ────────────────────────────────────────────────────────────────────

function playerCollisionCircleAt(x, y) {
  return {
    x: x + DISPLAY_SIZE / 2,
    y: y + DISPLAY_SIZE * 0.66,
    r: Math.max(8, Math.round(DISPLAY_SIZE * 0.22))
  };
}

function canPlayerMoveTo(x, y) {
  const c = playerCollisionCircleAt(x, y);
  const samples = [
    [0, 0],
    [c.r, 0], [-c.r, 0], [0, c.r], [0, -c.r],
    [c.r * 0.7, c.r * 0.7], [-c.r * 0.7, c.r * 0.7],
    [c.r * 0.7, -c.r * 0.7], [-c.r * 0.7, -c.r * 0.7],
  ];
  if (hazards.some(h => h.block && Math.hypot(c.x - h.x, c.y - h.y) < h.r + c.r)) return false;
  return samples.every(([sx, sy]) => !isSolid(c.x + sx, c.y + sy));
}

function movePlayerWithSlide(dx, dy) {
  let moved = false;
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (canPlayerMoveTo(nx, ny)) {
    player.x = nx;
    player.y = ny;
    return dx !== 0 || dy !== 0;
  }
  if (dx !== 0 && canPlayerMoveTo(player.x + dx, player.y)) {
    player.x += dx;
    moved = true;
  }
  if (dy !== 0 && canPlayerMoveTo(player.x, player.y + dy)) {
    player.y += dy;
    moved = true;
  }
  return moved;
}

function entityCollisionCircleAt(e, x = e.x, y = e.y) {
  const hb = enemyHitbox(e);
  const size = Math.max(hb.w, hb.h);
  return {
    x: x + hb.w / 2,
    y: y + hb.h * 0.66,
    r: Math.max(6, Math.round(size * 0.22))
  };
}

function canEntityMoveTo(e, x, y) {
  const c = entityCollisionCircleAt(e, x, y);
  const samples = [
    [0, 0],
    [c.r, 0], [-c.r, 0], [0, c.r], [0, -c.r],
    [c.r * 0.7, c.r * 0.7], [-c.r * 0.7, c.r * 0.7],
    [c.r * 0.7, -c.r * 0.7], [-c.r * 0.7, -c.r * 0.7],
  ];
  return samples.every(([sx, sy]) => !isSolid(c.x + sx, c.y + sy));
}

function moveEntityWithSlide(e, dx, dy) {
  let moved = false;
  if (canEntityMoveTo(e, e.x + dx, e.y + dy)) {
    e.x += dx;
    e.y += dy;
    return dx !== 0 || dy !== 0;
  }
  if (dx !== 0 && canEntityMoveTo(e, e.x + dx, e.y)) {
    e.x += dx;
    moved = true;
  }
  if (dy !== 0 && canEntityMoveTo(e, e.x, e.y + dy)) {
    e.y += dy;
    moved = true;
  }
  return moved;
}

function keepOutFromPlayerVec(e, minDist, speed) {
  const ec = entityCollisionCircleAt(e);
  const pc = playerCollisionCircleAt(player.x, player.y);
  const dx = ec.x - pc.x;
  const dy = ec.y - pc.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= minDist) return null;
  if (dist < 0.1) return { mx: speed, my: 0 };
  const push = Math.min(speed, Math.max(speed * 0.45, (minDist - dist) * 0.18));
  return { mx: (dx / dist) * push, my: (dy / dist) * push };
}

function enemyHitbox(e) {
  switch (e.type) {
    case 'goblin':   return { x: e.x, y: e.y, w: GOBLIN_SIZE,                 h: GOBLIN_SIZE };
    case 'golem':    return { x: e.x, y: e.y, w: GOLEM_SIZE,                  h: GOLEM_SIZE };
    case 'archer':   return { x: e.x, y: e.y, w: ARCHER_SIZE,                 h: ARCHER_SIZE };
    case 'skeletal_champion': return { x: e.x, y: e.y, w: SKELETAL_CHAMPION_SIZE, h: SKELETAL_CHAMPION_SIZE };
    case 'orc': {
      const size = e.brute ? ORC_SIZE * 2 : ORC_SIZE;
      return { x: e.x, y: e.y, w: size, h: size };
    }
    case 'minotaur': return { x: e.x, y: e.y, w: DISPLAY_SIZE*2,              h: DISPLAY_SIZE*2 };
    case 'troll':    return { x: e.x, y: e.y, w: DISPLAY_SIZE*2,              h: DISPLAY_SIZE*2 };
    case 'guardian': return { x: e.x, y: e.y, w: GUARDIAN_SIZE,               h: GUARDIAN_SIZE };
    case 'trib_sentinel': return { x: e.x, y: e.y, w: TRIB_SENTINEL_SIZE,      h: TRIB_SENTINEL_SIZE };
    case 'trib_warden':   return { x: e.x, y: e.y, w: TRIB_WARDEN_SIZE,        h: TRIB_WARDEN_SIZE };
    case 'trib_priest':   return { x: e.x, y: e.y, w: TRIB_PRIEST_SIZE,        h: TRIB_PRIEST_SIZE };
    case 'ghoul':        return { x: e.x, y: e.y, w: Math.round(DISPLAY_SIZE*0.8),h: Math.round(DISPLAY_SIZE*0.8) };
    case 'abomination':  return { x: e.x, y: e.y, w: ABOM_SIZE, h: ABOM_SIZE };
    default:         return { x: e.x, y: e.y, w: DISPLAY_SIZE,                h: DISPLAY_SIZE };
  }
}

function getHitbox() {
  const enlarged = player.avatarActive;
  const ds  = enlarged ? DISPLAY_SIZE * 2 : DISPLAY_SIZE;
  const offX = enlarged ? -DISPLAY_SIZE / 2 : 0;
  const offY = enlarged ? -DISPLAY_SIZE / 2 : 0;
  const cx  = player.x + offX + ds / 2;
  const cy  = player.y + offY + ds / 2;
  const r   = player.atkRange;
  const px  = player.x + offX;
  const py  = player.y + offY;
  switch (player.direction) {
    case 'down':  return { x: cx - r/2, y: py + ds, w: r, h: r };
    case 'up':    return { x: cx - r/2, y: py - r,  w: r, h: r };
    case 'left':  return { x: px - r,   y: cy - r/2, w: r, h: r };
    case 'right': return { x: px + ds,  y: cy - r/2, w: r, h: r };
  }
}

function damagePlayer(baseDmg, flashDur) {
  if (player.slamImmunity > 0) return 0;
  if (player.enlightenShield && player.enlightenShieldCD <= 0) {
    player.enlightenShieldCD = 600;
    player.hitFlash = flashDur || 15;
    addMarker(player.x + DISPLAY_SIZE / 2, player.y, 'ABSORBED!', '#3498db');
    return 0;
  }
  let d = Math.round(baseDmg * (1 - (player.damageReduction || 0)));
  if ((player.bulwarkShield || 0) > 0) {
    const absorbed = Math.min(player.bulwarkShield, d);
    player.bulwarkShield -= absorbed;
    d -= absorbed;
    addMarker(player.x + DISPLAY_SIZE / 2, player.y, `-${absorbed} SHIELD`, '#8fc8f4');
  }
  player.hp = Math.max(0, player.hp - d);
  if (player.hp === 0 && player.undyingRage && !player.undyingRageUsed) {
    player.hp = 15;
    player.undyingRageUsed = true;
    addMarker(player.x + DISPLAY_SIZE / 2, player.y, 'UNDYING!', '#ffd700');
  }
  player.hitFlash = flashDur || 15;
  return d;
}

function berserkDamageMultiplier() {
  if (player.berserkTimer <= 0) return 1;
  const berserk = abilities.find(a => a.name === 'berserk');
  return berserkMultiplierForLevel(berserk);
}

function berserkMultiplierForLevel(levelOrAb = abilities.find(a => a.name === 'berserk')) {
  const lvl = typeof levelOrAb === 'number' ? levelOrAb : (levelOrAb?.level || 1);
  return lvl >= 2 ? 1.75 : 1.5;
}

function berserkTooltipText(levelOrAb = abilities.find(a => a.name === 'berserk'), stat = player.primaryStat, statValue = player[player.primaryStat]) {
  const mult = berserkMultiplierForLevel(levelOrAb);
  return `Berserk rage. ${statFormulaMultiplierText(mult)} dmg dealt, 1.5x dmg taken for 10s.`;
}

function applyDamageToEnemy(e, baseDmg, color) {
  let dmg = baseDmg * berserkDamageMultiplier();
  if (e.type === 'mimic' && e.state === 'mimicCast') {
    dmg *= 0.7;
  }
  if (player.executionerActive && e.hp / e.maxHp <= 0.35) {
    dmg *= 1.25;
  }
  if (player.assassinProc) {
    const assassinBonus = player.assassinTalent ? Math.round((player[player.primaryStat] || 1) * 1.5) : 15;
    dmg += assassinBonus;
    player.assassinProc = false;
    player.assassinProcCD = 900;
    addMarker(e.x + DISPLAY_SIZE / 2, e.y - 20, `+${assassinBonus}!`, '#27ae60');
  }
  if (e.type === 'orc' && e.shielded && !e.enraged && isInFrontArc(e, player.x + DISPLAY_SIZE / 2, player.y + DISPLAY_SIZE / 2, ORC_SIZE)) {
    dmg *= 0.45;
    addMarker(e.x + ORC_SIZE / 2, e.y - 20, 'BLOCK', '#b0c4de');
    playsfx('shieldBlock');
  }
  if (e.type === 'skeletal_champion' && (e.blockCooldown || 0) <= 0 &&
      isInFrontArc(e, player.x + DISPLAY_SIZE / 2, player.y + DISPLAY_SIZE / 2, SKELETAL_CHAMPION_SIZE)) {
    e.blockCooldown = SKELETAL_CHAMPION_BLOCK_CD;
    e.blockTimer = 24;
    addMarker(e.x + SKELETAL_CHAMPION_SIZE / 2, e.y - 20, 'BLOCK', '#d9f2ff');
    playsfx('shieldBlock');
    return;
  }
  if (e.type === 'trib_sentinel' && isInFrontArc(e, player.x + DISPLAY_SIZE / 2, player.y + DISPLAY_SIZE / 2, TRIB_SENTINEL_SIZE)) {
    dmg *= 0.6;
    e.blockTimer = 20;
    addMarker(e.x + TRIB_SENTINEL_SIZE / 2, e.y - 22, 'GUARD', '#b0c4de');
    playsfx('shieldBlock');
  }
  dmg = Math.round(dmg);
  e.hp -= dmg;
  e.hitFlash = 12;
  addMarker(e.x + DISPLAY_SIZE / 2, e.y, `-${dmg}`, color || '#ff4444');
  if (player.lifesteal > 0) {
    const steal = player.bloodlustKillTimer > 0 ? player.lifesteal * 2 : player.lifesteal;
    const heal = Math.max(1, Math.round(dmg * steal));
    player.hp = Math.min(player.maxHp, player.hp + heal);
    addMarker(player.x + DISPLAY_SIZE / 2, player.y, `+${heal}`, '#2ecc71');
  }
  if (e.hp <= 0 && !e.dying && !e.deathDone) {
    // Pick a random death animation row from this enemy's death sheet
    const deathRowCounts = { minotaur: 4, orc: 4 };
    const deathRows = { goblin: [1, 2, 3] };
    const directionalDeath = e.type === 'ghoul' || e.type === 'golem' || e.type === 'skeletal_champion' || e.type === 'trib_sentinel' || e.type === 'trib_warden' || e.type === 'trib_priest';
    const hasCorpse = e.type in deathRowCounts || e.type in deathRows || directionalDeath;
    const rows = deathRowCounts[e.type] || 1;
    e.dying = true; e.deathFrame = 0; e.deathTick = 0; e.deathDone = false;
    e.deathRow = deathRows[e.type]
      ? deathRows[e.type][Math.floor(Math.random() * deathRows[e.type].length)]
      : directionalDeath ? dirToRow(e.direction)
      : Math.floor(Math.random() * rows);
    e.corpseTimer = hasCorpse ? 999999 : 0; // bodies linger until stage clears
    if (e.type === 'goblin') {
      enemies.forEach(o => {
        if (o.type === 'goblin' && o !== e && !o.dying && o.hp > 0) {
          const ob = enemyHitbox(o);
          if (Math.hypot((ob.x + ob.w/2) - (e.x + GOBLIN_SIZE/2), (ob.y + ob.h/2) - (e.y + GOBLIN_SIZE/2)) < DISPLAY_SIZE * 3.5) {
            o.scatterTimer = GOBLIN_SCATTER_DUR;
            o.state = 'scatter';
          }
        }
      });
    }
    // Abomination feeding — ghoul dies near it, heals it and triggers speed lunge
    if (e.type === 'ghoul') {
      const abom = enemies.find(a => a.type === 'abomination' && !a.dying && !a.deathDone && a.hp > 0);
      if (abom) {
        const abomCx = abom.x + ABOM_SIZE / 2, abomCy = abom.y + ABOM_SIZE / 2;
        const eCx = e.x + Math.round(DISPLAY_SIZE * 0.8) / 2, eCy = e.y + Math.round(DISPLAY_SIZE * 0.8) / 2;
        if (Math.hypot(abomCx - eCx, abomCy - eCy) < ABOM_FEED_RANGE) {
          const hpGain = Math.min(ABOM_FEED_HP, ABOM_HP_CAP - abom.hp);
          if (hpGain > 0) {
            abom.hp += hpGain;
            if (abom.hp > abom.maxHp) abom.maxHp = abom.hp;
            abom.fedPulse = 30;
            abom.feedSpeedTimer = ABOM_FEED_SPEED_DUR;
            addMarker(abom.x + ABOM_SIZE / 2, abom.y - 16, `FED +${hpGain}`, '#55dd33');
          }
        }
      }
    }
    if (player.lifesteal > 0) player.bloodlustKillTimer = 120;
    if (e.type === 'minotaur') tryDropPendant(e, STAGE3_PENDANTS);
    if (e.type === 'mimic')    tryDropPendant(e, STAGE8_PENDANTS);
    if      (e.type === 'goblin')      playsfx('goblinDeath');
    else if (e.type === 'golem')       playsfx('golemDeath');
    else if (e.type === 'archer' || e.type === 'skeletal_champion') playsfx('skeletonDeath');
    else if (e.type === 'orc')         playsfx('orcDeath');
    else if (e.type === 'troll')       playsfx('bruteDeath');
    else if (e.type === 'ghoul')       playsfx('ghoulDeath');
    else if (e.type === 'guardian')    playsfx('guardianDeath');
    else if (e.type === 'abomination') playsfx('golemDeath');
    else if (e.type === 'mimic') {
      const mc = e.mimicClass || player.className;
      if (mc === 'Barbarian') playsfx('barbarianDeath');
      else if (mc === 'Rogue') playsfx('rogueDeath');
      else if (mc === 'Mage')  playsfx('mageDeath');
    }
    else if (e.type === 'johnpork')    playsfx('bruteDeath');
    const xp = expForEnemy(e);
    grantExp(xp);
    addMarker(e.x + DISPLAY_SIZE / 2, e.y - 14, `+${xp} EXP`, '#cc88ff');
  }
}

const STAGE3_PENDANTS = [
  { name: 'Vitality',  color: '#e74c3c', desc: '+50 HP',
    apply: p => { p.maxHp += 50; p.hp = Math.min(p.hp + 50, p.maxHp); } },
  { name: 'Swiftness', color: '#2ecc71', desc: '+20% speed',
    apply: p => { p.speed = Math.round(p.speed * 1.2 * 10)/10; p.baseSpeed = p.speed; } },
  { name: 'Acuity',    color: '#3498db', desc: 'All CDs −1s',
    apply: () => { abilities.forEach(a => { a.cooldown = Math.max(30, a.cooldown - 60); }); } },
];

const STAGE8_PENDANTS = [
  { name: 'Might',          color: '#c0392b',
    desc: '+10 STR · +25% skill range & AoE',
    apply: p => {
      p.str += 10; p.maxHp += 100; p.hp = Math.min(p.hp + 100, p.maxHp);
      p.atkRange = Math.round(p.atkRange * 1.25);
      p.mightBonus = true;
    }
  },
  { name: 'the Assassin',   color: '#27ae60',
    desc: '+10 AGI · next skill hit deals +15 bonus dmg (15s CD)',
    apply: p => {
      p.agi += 10;
      p.baseSpeed = Math.round(2.5 * (1 + p.agi * 0.05) * 10) / 10;
      p.speed = p.baseSpeed;
      p.assassinProc = true; p.assassinProcCD = 0;
    }
  },
  { name: 'Enlightenment',  color: '#2980b9',
    desc: '+10 INT · absorbs 1 hit every 10s',
    apply: p => {
      p.int += 10;
      abilities.forEach(a => { a.cooldown = Math.max(30, a.cooldown - 150); });
      p.enlightenShield = true; p.enlightenShieldCD = 0;
    }
  },
];

function tryDropPendant(e, table) {
  const roll = Math.random();
  let cumulative = 0;
  for (const p of table) {
    cumulative += 1 / table.length;
    if (roll < cumulative) { acquirePendant(p); return; }
  }
  acquirePendant(table[table.length - 1]);
}

function acquirePendant(p) {
  player.pendants.push({ name: p.name, color: p.color, desc: p.desc });
  p.apply(player);
  pendingPendant = { name: p.name, color: p.color, desc: p.desc };
  gameState = 'pendant';
}

function startWindwalkExit() {
  player.windwalkActive = false;
  player.windwalkTimer = 0;
  player.speed = player.baseSpeed;
  player.windwalkEntering = false;
  player.windwalkExiting = true;
  player.windwalkExitFrame = 0;
  player.windwalkExitTick = 0;
}

function startBerserkCast() {
  player.berserkTimer = player.avatarActive ? 900 : 600;
  player.berserkCasting = true;
  player.berserkCastFrame = 0;
  player.berserkCastTick = 0;
}

function startMageBlink() {
  const dirs = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
  const [dx, dy] = dirs[player.direction] || [0, 1];
  const step = DISPLAY_SIZE;
  const maxDist = DISPLAY_SIZE * 8;
  let targetX = player.x;
  let targetY = player.y;
  for (let d = step; d <= maxDist; d += step) {
    const nx = player.x + dx * d;
    const ny = player.y + dy * d;
    if (!canPlayerMoveTo(nx, ny)) break;
    targetX = nx;
    targetY = ny;
  }
  player.mageBlinkPhase = 'out';
  player.mageBlinkFrame = 0;
  player.mageBlinkTick = 0;
  player.mageBlinkTargetX = targetX;
  player.mageBlinkTargetY = targetY;
  playsfx('mageBlink');
}

function registerSkillCast(ab) {
  if (!player.eternalFocusActive || !ab) return;
  player.eternalFocusCasts = (player.eternalFocusCasts || 0) + 1;
  if (player.eternalFocusCasts % 3 !== 0) return;
  ab.timer = Math.max(0, Math.round(ab.timer * 0.5));
  addMarker(player.x + DISPLAY_SIZE / 2, player.y - 18, 'ETERNAL FOCUS', '#2ecc71');
}

function fireAbility() {
  const ab = abilities.find(a => a.key === player.activeAbility);
  if (!ab || ab.level === 0) return; // locked until leveled up

  const enlarged = player.avatarActive;
  const atkMult  = enlarged ? 1.5 : 1;
  enemies.forEach(e => {
    if (e.type === 'mimic' && !e.dying && e.hp > 0 && Math.random() < 0.75) {
      e.echoKey = ab.key;
      e.echoTimer = 45;
    }
  });

  if (ab.name === 'whirlwind') {
    const ds = enlarged ? DISPLAY_SIZE * 2 : DISPLAY_SIZE;
    const offX = enlarged ? -DISPLAY_SIZE/2 : 0, offY = enlarged ? -DISPLAY_SIZE/2 : 0;
    const cx = player.x + offX + ds/2, cy = player.y + offY + ds/2;
    const r  = DISPLAY_SIZE * 1.6 * atkMult * (player.mightBonus ? 1.25 : 1);
    let landed = false;
    enemies.forEach(e => {
      if (e.hp <= 0) return;
      const eb = enemyHitbox(e);
      if (rectsOverlap(cx-r, cy-r, r*2, r*2, eb.x, eb.y, eb.w, eb.h)) {
        landed = true;
        applyDamageToEnemy(e, ab.damage, '#e67e22');
      }
    });
    playsfx('whirlwind');
    if (landed) playsfx('hitWhirlwind');
    return;
  }

  if (ab.name === 'slam') {
    const ds = enlarged ? DISPLAY_SIZE * 2 : DISPLAY_SIZE;
    const offX = enlarged ? -DISPLAY_SIZE/2 : 0, offY = enlarged ? -DISPLAY_SIZE/2 : 0;
    const cx = player.x + offX + ds/2, cy = player.y + offY + ds/2;
    const r  = DISPLAY_SIZE * 2.2 * atkMult * (player.mightBonus ? 1.25 : 1);
    player.slamImmunity = 15;
    enemies.forEach(e => {
      if (e.hp <= 0) return;
      const eb = enemyHitbox(e);
      if (rectsOverlap(cx-r, cy-r, r*2, r*2, eb.x, eb.y, eb.w, eb.h)) {
        e.slowTimer = 120;
        applyDamageToEnemy(e, ab.damage, '#f1c40f');
      }
    });
    playsfx('stoneCrash');
    return;
  }

  if (ab.name === 'throw') {
    if (player.windwalkActive) startWindwalkExit();
    // Spawn a dagger projectile in the direction the rogue faces
    const cx = player.x + DISPLAY_SIZE / 2, cy = player.y + DISPLAY_SIZE / 2;
    const spd = Math.max(7, Math.round(DISPLAY_SIZE * 0.20));
    const dirs = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
    const [dx, dy] = dirs[player.castDirection || player.direction] || [0, 1];
    const proj = { x: cx, y: cy, dx: dx * spd, dy: dy * spd,
      damage: ab.damage, type: 'dagger', life: 500, hit: false };
    projectiles.push(proj);
    playsfx('knifeThrow');
    return;
  }

  if (ab.name === 'windwalk') {
    player.windwalkActive = true;
    player.windwalkTimer  = 600;  // 10 seconds
    player.windwalkDmg    = windwalkBonusDamage(ab);
    player.speed          = player.baseSpeed * 2;
    player.windwalkEntering = true;
    player.windwalkEnterFrame = 0;
    player.windwalkEnterTick = 0;
    player.windwalkExiting = false;
    return;
  }

  if (ab.name === 'slicedice') {
    if (player.windwalkActive) startWindwalkExit();
    const cx = player.x + DISPLAY_SIZE / 2;
    const cy = player.y + DISPLAY_SIZE / 2;
    enemies.forEach(e => {
      if (e.hp <= 0) return;
      const eb = enemyHitbox(e);
      const ex = eb.x + eb.w / 2;
      const ey = eb.y + eb.h / 2;
      if (Math.hypot(ex - cx, ey - cy) <= ROGUE_SLICE_DICE_RADIUS + Math.max(eb.w, eb.h) * 0.25) {
        applyDamageToEnemy(e, ab.damage, '#16a085');
      }
    });
    player.sliceDiceTimer = 22;
    playSfxBurst('rogueSlash', 3, 150);
    return;
  }

  if (ab.name === 'fireball') {
    const cx = player.x + DISPLAY_SIZE / 2, cy = player.y + DISPLAY_SIZE / 2;
    const spd = Math.max(5, Math.round(DISPLAY_SIZE * 0.14));
    const dirs = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
    const [dx, dy] = dirs[player.castDirection || player.direction] || [0, 1];
    projectiles.push({
      x: cx, y: cy, dx: dx * spd, dy: dy * spd,
      damage: ab.damage, type: 'fireball', life: 500, hit: false, frame: 0, frameTick: 0,
      flySound: startLoopingSfx('fireballFly')
    });
    return;
  }

  if (ab.name === 'frostnova') {
    const cx = player.x + DISPLAY_SIZE / 2;
    const cy = player.y + DISPLAY_SIZE / 2;
    const r = DISPLAY_SIZE * 2.4 * 1.2 * (player.mightBonus ? 1.25 : 1);
    spellEffects.push({ type: 'frostnova', x: cx, y: cy, frame: 0, tick: 0, life: 32, size: r * 2.2 });
    enemies.forEach(e => {
      if (e.hp <= 0) return;
      const eb = enemyHitbox(e);
      const ex = eb.x + eb.w / 2, ey = eb.y + eb.h / 2;
      if (Math.hypot(ex - cx, ey - cy) <= r + Math.max(eb.w, eb.h) * 0.25) {
        applyFreezeStatus(e);
        applyDamageToEnemy(e, ab.damage, '#1abc9c');
      }
    });
    playsfx('frostNova');
    return;
  }

  if (ab.name === 'blink') {
    return;
  }

  // Default directional attack (Q slash + non-specialised)
  const hb = getHitbox();
  // If windwalk is active, Q breaks it and adds a primary-stat bonus to Slash.
  const windwalkBonus = player.windwalkActive ? (player.windwalkDmg || 0) : 0;
  if (player.windwalkActive) {
    startWindwalkExit();
  }
  let landed = false;
  enemies.forEach(e => {
    if (e.hp <= 0) return;
    const eb = enemyHitbox(e);
    if (rectsOverlap(hb.x, hb.y, hb.w, hb.h, eb.x, eb.y, eb.w, eb.h)) {
      landed = true;
      applyDamageToEnemy(e, ab.damage + windwalkBonus, '#2ecc71');
    }
  });
  if (ab.name === 'blastwave') playsfx('blastwave');
  else if (windwalkBonus > 0) playsfx('rogueSlash');
  else playsfx(landed ? 'hit' : 'swing');
}

function grantExp(amount) {
  if (amount <= 0) return;
  player.exp += amount;
  let leveled = false;
  while (player.exp >= player.expToNext && player.level < 10) {
    player.exp -= player.expToNext;
    player.level++;
    player.expToNext = 100; // flat per level as per design doc
    leveled = true;
  }
  if (player.level >= 10 && player.exp >= player.expToNext) {
    player.exp = player.expToNext;
  }
  if (leveled) {
    triggerLevelUp();
  }
}

function triggerLevelUp() {
  if (gameState === 'pendant') {
    pendingLevelup = true;
    return;
  }
  player.state = 'idle';
  Object.keys(keys).forEach(k => { keys[k] = false; });
  if (getLevelableSkills().length === 0) {
    levelupStatsLeft = 3 + (player.bonusStatPoints || 0);
    levelupStatCursor = 0;
    levelupPhase = 'stats';
  } else {
    levelupPhase = 'skill';
  }
  gameState = 'levelup';
}

function getLevelableSkills() {
  return orderedAbilities(abilities).filter(a => {
    if (a.level >= a.maxLevel) return false;
    if (a.key === 'r' && player.level < 6) return false;
    // W/E can be selected from level 2 onward even if still at level 0
    return true;
  });
}

function levelSkill(ab) {
  ab.level++;
  if (ab.damage > 0) ab.damage = Math.round(ab.damage * 1.3);
  if (ab.key === 'q') {
    refreshQTooltip(ab);
    return;
  }
  if (ab.name === 'berserk') {
    refreshBerserkTooltip(ab);
    return;
  }
  if (ab.name === 'windwalk') {
    ab.tooltip = windwalkTooltipText(ab);
    return;
  }
  if (ab.name === 'slicedice') {
    refreshSliceDiceTooltip(ab);
    return;
  }
  // tooltip update
  ab.tooltip = ab.tooltip.replace(/\d+ dmg/, `${ab.damage} dmg`);
}

function statFormulaMultiplierText(mult) {
  const rounded = Math.round(mult * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}x`;
}

function primaryStatFullLabel(stat = player.primaryStat) {
  return stat === 'str' ? 'Strength' : stat === 'agi' ? 'Agility' : 'Intellect';
}

function qTooltipText(name, damage, stat = player.primaryStat, statValue = player[stat]) {
  const value = Math.max(1, statValue || player[stat] || 1);
  const mult = statFormulaMultiplierText(damage / value);
  const label = name === 'blastwave' ? 'Blastwave' : 'Slash';
  return `${label}. Deals ${mult} ${primaryStatFullLabel(stat)} in damage in front (${damage} dmg).`;
}

function refreshQTooltip(ab = abilities.find(a => a.key === 'q')) {
  if (ab) ab.tooltip = qTooltipText(ab.name, ab.damage);
}

function refreshBerserkTooltip(ab = abilities.find(a => a.name === 'berserk')) {
  if (ab) ab.tooltip = berserkTooltipText(ab);
}

function windwalkBonusMult(levelOrAb = abilities.find(a => a.name === 'windwalk')) {
  const lvl = typeof levelOrAb === 'number' ? levelOrAb : (levelOrAb?.level || 1);
  return 1.45 + lvl * 0.30;
}

function windwalkBonusDamage(ab = abilities.find(a => a.name === 'windwalk')) {
  return Math.round((player[player.primaryStat] || 1) * windwalkBonusMult(ab));
}

function windwalkTooltipText(levelOrAb = abilities.find(a => a.name === 'windwalk'), stat = player.primaryStat, statValue = player[player.primaryStat]) {
  const lvl = typeof levelOrAb === 'number' ? levelOrAb : (levelOrAb?.level || 1);
  const mult = windwalkBonusMult(lvl);
  const value = statValue || player[stat] || 1;
  return `Wind Walk. Double speed + invisible for 10s. First damaging hit adds ${mult.toFixed(2)}x ${primaryStatLabel(stat)} (${Math.round(value * mult)} bonus dmg) to Slash damage.`;
}

function refreshWindwalkTooltip() {
  const ww = abilities.find(a => a.name === 'windwalk');
  if (ww) ww.tooltip = windwalkTooltipText(ww);
}

function refreshSliceDiceTooltip(ab = abilities.find(a => a.name === 'slicedice')) {
  if (ab) ab.tooltip = `Slice and Dice. ${ab.damage} AoE damage around you (3x ${primaryStatLabel()} base).`;
}

function refreshMageSkillTooltips() {
  const fireball = abilities.find(a => a.name === 'fireball');
  if (fireball) fireball.tooltip = `Fireball. ${fireball.damage} dmg in facing direction with splash.`;
  const frostnova = abilities.find(a => a.name === 'frostnova');
  if (frostnova) frostnova.tooltip = `Frost Nova. ${frostnova.damage} dmg, freezes enemies for 2s (1s stun, then 1s slow).`;
}

function applyStatPoint(stat) {
  const oldPrimary = player[player.primaryStat];
  player[stat]++;
  if (stat === 'str') {
    player.maxHp += 10;
    player.hp = Math.min(player.hp + 5, player.maxHp);
  } else if (stat === 'agi') {
    player.baseSpeed = Math.round(2.5 * (1 + player.agi * 0.05) * 10) / 10;
    player.speed = player.baseSpeed;
  } else {
    abilities.forEach(a => { a.cooldown = Math.max(30, a.cooldown - 12); });
  }
  if (stat === player.primaryStat) {
    const newPrimary = player[player.primaryStat];
    abilities.forEach(a => {
      if (a.damage > 0) a.damage = Math.max(1, Math.round(a.damage * newPrimary / oldPrimary));
    });
  }
  refreshQTooltip();
  refreshBerserkTooltip();
  refreshWindwalkTooltip();
  refreshSliceDiceTooltip();
  refreshMageSkillTooltips();
  refreshBulwarkShield();
}

function finishLevelupStatsIfDone() {
  if (levelupStatsLeft > 0) return;
  if (TALENT_LEVELS.has(player.level)) {
    levelupTalentCursor = 0;
    levelupPhase = 'talent';
  } else {
    clearMovementKeys();
    gameState = 'playing';
  }
}

function spendLevelupStat(stat, amount = 1) {
  if (gameState !== 'levelup' || levelupPhase !== 'stats' || levelupStatsLeft <= 0) return;
  const count = Math.max(1, Math.min(levelupStatsLeft, amount));
  for (let i = 0; i < count; i++) applyStatPoint(stat);
  levelupStatsLeft -= count;
  finishLevelupStatsIfDone();
}

function currentTalentTier() {
  return TALENT_UNLOCK_LEVELS.indexOf(player.level);
}

function isTalentTaken(pathIdx, tierIdx) {
  return !!player.talentTaken?.[pathIdx]?.[tierIdx];
}

function markTalentTaken(pathIdx, tierIdx) {
  if (!player.talentTaken) player.talentTaken = [[false,false,false], [false,false,false], [false,false,false]];
  player.talentTaken[pathIdx][tierIdx] = true;
  player.talentPaths[pathIdx] = Math.max(player.talentPaths[pathIdx] ?? -1, tierIdx);
}

function chooseLevelupTalent(pathIdx, requireRelease = false) {
  const ti = currentTalentTier();
  if (gameState !== 'levelup' || levelupPhase !== 'talent' || ti < 0 || isTalentTaken(pathIdx, ti)) return;
  const path = TALENT_TREE[pathIdx];
  const tier = path.tiers[ti];
  talentConfirmData = {
    mode: 'confirm',
    pathIdx,
    tierIdx: ti,
    name: tier.label,
    desc: tier.desc,
    color: path.color,
    armed: !requireRelease
  };
  levelupPhase = 'talentConfirm';
}

function confirmPendingTalent() {
  if (!talentConfirmData || talentConfirmData.mode !== 'confirm') return;
  const pathIdx = talentConfirmData.pathIdx;
  const ti = talentConfirmData.tierIdx;
  markTalentTaken(pathIdx, ti);
  applyTalentEffect(pathIdx, ti);
  if (pathIdx === 2 && ti === 0) {
    talentConfirmData = null;
    levelupPhase = 'primattr';
  } else {
    const path = TALENT_TREE[pathIdx];
    const tier = path.tiers[ti];
    talentConfirmData = { mode: 'acquired', name: tier.label, desc: tier.desc, color: path.color };
    levelupPhase = 'talentConfirm';
  }
}

function choosePrimaryAttr(newStat) {
  const oldVal = player[player.primaryStat] || 1;
  const newVal = player[newStat] || 1;
  abilities.forEach(a => {
    if (a.damage > 0) a.damage = Math.max(1, Math.round(a.damage * newVal / oldVal));
  });
  player.primaryStat = newStat;
  refreshQTooltip();
  refreshBerserkTooltip();
  refreshWindwalkTooltip();
  refreshSliceDiceTooltip();
  refreshMageSkillTooltips();
}

function primaryStatColor(stat) {
  return stat === 'str' ? '#e74c3c' : stat === 'agi' ? '#2ecc71' : '#3498db';
}

function primaryStatLabel(stat = player.primaryStat) {
  return stat === 'str' ? 'STR' : stat === 'agi' ? 'AGI' : 'INT';
}

function refreshBulwarkShield() {
  if (!player.bulwarkActive) return;
  player.bulwarkShield = Math.max(player.bulwarkShield || 0, Math.round(player.maxHp * 0.20));
}

function applyTalentEffect(pi, ti) {
  if (pi === 0) {       // Offensive
    if (ti === 0) {     // Haste
      player.cooldownRegenMult = Math.max(player.cooldownRegenMult || 1, 1.15);
    } else if (ti === 1) { // Bloodlust
      player.lifesteal = Math.max(player.lifesteal || 0, 0.08);
    } else {            // Executioner
      player.executionerActive = true;
    }
  } else if (pi === 1) { // Defensive
    if (ti === 0) {     // Stoneskin
      player.damageReduction = Math.min(0.6, (player.damageReduction || 0) + 0.15);
    } else if (ti === 1) { // Lifeblood
      player.lifeRegenActive = true;
    } else {            // Ancient Bulwark
      player.maxHp = Math.round(player.maxHp * 1.5);
      player.hp = player.maxHp;
      player.bulwarkActive = true;
      refreshBulwarkShield();
    }
  } else {              // Utility
    if (ti === 0) {     // Plasticity — primary attr choice handled in keydown after this
      for (let i = 0; i < 3; i++) ['str','agi','int'].forEach(s => applyStatPoint(s));
    } else if (ti === 1) { // Assassin
      player.assassinTalent = true;
      player.assassinProc = true;
      player.assassinProcCD = 0;
    } else {            // Eternal Focus
      player.eternalFocusActive = true;
      player.eternalFocusCasts = 0;
    }
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

function updatePlayer() {
  if (player.dying) return;
  if (player.slowTimer > 0)    player.slowTimer--;
  if (player.berserkTimer > 0) player.berserkTimer--;
  if (player.bloodlustKillTimer > 0) player.bloodlustKillTimer--;
  if (player.berserkCasting) {
    if (++player.berserkCastTick >= ATK_SPEED) {
      player.berserkCastTick = 0;
      player.berserkCastFrame++;
      if (player.berserkCastFrame >= BARB_BERSERK_SKILL_FRAMES) player.berserkCasting = false;
    }
  }
  if (player.slamImmunity > 0) player.slamImmunity--;
  if (player.windwalkTimer > 0) {
    player.windwalkTimer--;
    if (player.windwalkTimer <= 0) {
      startWindwalkExit();
    }
  }
  if (player.lifeRegenActive) {
    player.lifeRegenTimer = (player.lifeRegenTimer || 0) + 1;
    if (player.lifeRegenTimer >= 180) {
      player.lifeRegenTimer = 0;
      const pcx = player.x + DISPLAY_SIZE / 2;
      const pcy = player.y + DISPLAY_SIZE / 2;
      const surrounded = enemies.some(e => {
        if (e.dying || e.deathDone || e.hp <= 0) return false;
        const eb = enemyHitbox(e);
        return Math.hypot((eb.x + eb.w / 2) - pcx, (eb.y + eb.h / 2) - pcy) < DISPLAY_SIZE * 1.65;
      });
      if (!surrounded) {
        const heal = Math.max(1, Math.round(player.maxHp * 0.01));
        player.hp = Math.min(player.maxHp, player.hp + heal);
      }
    }
  }
  if (player.mageBlinkPhase) {
    if (++player.mageBlinkTick >= Math.max(3, Math.floor(ATK_SPEED * 0.65))) {
      player.mageBlinkTick = 0;
      if (player.mageBlinkPhase === 'out') player.mageBlinkFrame++;
      else player.mageBlinkFrame--;
      if (player.mageBlinkPhase === 'out' && player.mageBlinkFrame >= 4) {
        player.x = player.mageBlinkTargetX;
        player.y = player.mageBlinkTargetY;
        player.mageBlinkPhase = 'in';
        player.mageBlinkFrame = 3;
      } else if (player.mageBlinkPhase === 'in' && player.mageBlinkFrame < 0) {
        player.mageBlinkPhase = null;
        player.mageBlinkFrame = 0;
      }
    }
  }
  const hazardSlow = playerHazardSlowMult();
  const spd = (player.slowTimer > 0 ? Math.max(1, player.speed * 0.5) : player.speed) * hazardSlow;

  let dx = 0, dy = 0;
  if (keys['ArrowUp'])    { dy = -spd; player.direction = 'up'; }
  if (keys['ArrowDown'])  { dy =  spd; player.direction = 'down'; }
  if (keys['ArrowLeft'])  { dx = -spd; player.direction = 'left'; }
  if (keys['ArrowRight']) { dx =  spd; player.direction = 'right'; }

  player.moving = movePlayerWithSlide(dx, dy);

  // Door entry — player stepped into the open exit door at the top of the map
  const stageDoor = getStageDoorRect(stage);
  const playerCx = player.x + DISPLAY_SIZE / 2;
  const playerCy = player.y + DISPLAY_SIZE / 2;
  const enteredStageDoor = stageDoor &&
    playerCx >= stageDoor.x && playerCx <= stageDoor.x + stageDoor.w &&
    playerCy >= stageDoor.y && playerCy <= stageDoor.y + stageDoor.h + TILE_SIZE;
  if (doorOpen && (enteredStageDoor || (!stageDoor && player.y < TILE_SIZE))) {
    player.y = (MAP_ROWS - 3) * TILE_SIZE;
    player.direction = 'up';
    doorOpen = false;
    gameState = 'stagechoice';
    return;
  }

  if (player.windwalkExiting) {
    if (++player.windwalkExitTick >= ATK_SPEED) {
      player.windwalkExitTick = 0;
      player.windwalkExitFrame++;
      if (player.windwalkExitFrame >= 4) player.windwalkExiting = false;
    }
  }
  if (player.windwalkEntering) {
    if (++player.windwalkEnterTick >= ATK_SPEED) {
      player.windwalkEnterTick = 0;
      player.windwalkEnterFrame++;
      if (player.windwalkEnterFrame >= 4) player.windwalkEntering = false;
    }
  }

  if (player.state === 'attacking') {
    const ab = player.activeAbility;
    const isRogue = player.className === 'Rogue';
    const isMage = player.className === 'Mage';
    const maxFrames  = isMage || isRogue ? 4 : ab === 'e' ? SLAM_FRAMES   : ab === 'w' ? WHIRL_FRAMES : 4;
    const impactAt   = isMage ? 2 : isRogue ? IMPACT_FRAME : ab === 'e' ? SLAM_IMPACT : ab === 'w' ? WHIRL_IMPACT : IMPACT_FRAME;
    if (!player.hitDealt && player.attackFrame === impactAt) {
      player.hitDealt = true;
      fireAbility();
    }
    player.atkFrameTick++;
    if (player.atkFrameTick >= ATK_SPEED) {
      player.atkFrameTick = 0;
      player.attackFrame++;
      if (player.attackFrame >= maxFrames) {
        player.attackFrame = 0;
        player.state = 'idle';
        player.activeAbility = null;
      }
    }
  } else {
    if (player.moving) {
      player.frameTick++;
      if (player.frameTick >= FRAME_SPEED) {
        player.frameTick = 0;
        player.frameIndex = (player.frameIndex + 1) % 4;
      }
    } else {
      player.frameIndex = 0;
      player.frameTick = 0;
    }
  }

  if (player.hitFlash > 0) player.hitFlash--;
}

function updateGolem(e) {
  if (e.dying || e.hp <= 0) return;
  e.aliveFrames++;
  if (e.hitFlash > 0) e.hitFlash--;
  if (e.slamEffect > 0) e.slamEffect--;

  // Enrage at 40% HP — faster and slams more often
  if (!e.enraged && e.hp <= e.maxHp * 0.4) {
    e.enraged = true;
    if (e.state === 'cooldown') e.slamTimer = Math.min(e.slamTimer, 40);
  }
  const chaseSpd   = e.enraged ? GOLEM_SPEED + 1 : GOLEM_SPEED;
  const slamCD     = e.enraged ? Math.round(GOLEM_SLAM_COOLDOWN * 0.6) : GOLEM_SLAM_COOLDOWN;
  const slamDmg    = e.enraged ? Math.round(GOLEM_SLAM_DAMAGE * 1.35) : GOLEM_SLAM_DAMAGE;

  const dx = (player.x + DISPLAY_SIZE / 2) - (e.x + GOLEM_SIZE / 2);
  const dy = (player.y + DISPLAY_SIZE / 2) - (e.y + GOLEM_SIZE / 2);
  const dist = Math.hypot(dx, dy);

  if (e.state === 'windup') {
    // Damage + sound trigger at the start of the last animation frame (frame 3)
    const lastFrameStart = Math.round(GOLEM_SLAM_WINDUP / 4);
    if (!e.slamDamageDealt && e.slamTimer <= lastFrameStart) {
      e.slamDamageDealt = true;
      if (dist < GOLEM_SLAM_RANGE) {
        const base = player.berserkTimer > 0 ? Math.round(slamDmg * 1.5) : slamDmg;
        const dmg = damagePlayer(base, 15);
        player.slowTimer = GOLEM_SLOW_DUR;
        addMarker(player.x + DISPLAY_SIZE / 2, player.y, `-${dmg}`, '#ff8800');
        playsfx('damage');
      }
      e.slamEffect = 30;
      addHazard(e.enraged ? 'rubble' : 'cracked', e.x + GOLEM_SIZE / 2, e.y + GOLEM_SIZE / 2,
        e.enraged ? GOLEM_SLAM_RANGE * 0.45 : GOLEM_SLAM_RANGE * 0.7,
        e.enraged ? 240 : 120,
        e.enraged
          ? { slow: true, color: '#9b6a3d' }
          : { slow: true, damage: 5, damageEvery: 40, color: '#d08a30' });
      playsfx('slam');
    }
    if (--e.slamTimer <= 0) {
      e.slamDamageDealt = false;
      e.state = 'cooldown';
      e.slamTimer = slamCD;
    }
    return;
  }

  if (e.state === 'cooldown') {
    if (--e.slamTimer <= 0) e.state = 'chase';
  } else if (dist < GOLEM_SLAM_START_RANGE) {
    e.state = 'windup';
    e.slamTimer = GOLEM_SLAM_WINDUP;
    e.slamDamageDealt = false;
    return;
  }

  let moveDx = 0, moveDy = 0;
  if (e.state !== 'cooldown') {
    e.state = 'chase';
    const cv = chaseVec(dx, dy, chaseSpd);
    moveDx = cv.mx; moveDy = cv.my;
    // Spread out so they surround rather than pile up
    const sep = separationVec(e, GOLEM_SIZE * 1.6);
    moveDx += sep.fx * 0.8; moveDy += sep.fy * 0.8;
  }

  if (Math.abs(moveDx) >= Math.abs(moveDy)) {
    if (moveDx > 0) e.direction = 'right';
    else if (moveDx < 0) e.direction = 'left';
  } else {
    if (moveDy > 0) e.direction = 'down';
    else if (moveDy < 0) e.direction = 'up';
  }

  moveEntityWithSlide(e, moveDx, moveDy);

  if (moveDx !== 0 || moveDy !== 0) {
    if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex = (e.frameIndex + 1) % 4; }
  } else {
    e.frameIndex = 0; e.frameTick = 0;
  }
}

function updateGoblin(e) {
  if (e.dying || e.hp <= 0) return;
  e.aliveFrames++;
  if (e.hitFlash > 0) e.hitFlash--;
  if (e.slowTimer > 0) e.slowTimer--;
  const packCourage = countNearbyEnemies(e, 'goblin', DISPLAY_SIZE * 2.2) >= 2;
  const spdBase = packCourage ? GOBLIN_SPEED * 1.35 : GOBLIN_SPEED;
  const atkCooldown = packCourage ? Math.round(GOBLIN_ATK_CD * 0.65) : GOBLIN_ATK_CD;
  const spd = e.slowTimer > 0 ? Math.max(1, spdBase * 0.5) : spdBase;

  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);

  if (e.scatterTimer > 0) {
    e.scatterTimer--;
    e.state = 'scatter';
    const cv = chaseVec(-dx, -dy, spd * 1.25);
    const side = (e.x + e.y) % 2 === 0 ? 1 : -1;
    const moveDx = cv.mx + (-dy / (dist || 1)) * side * spd * 0.35;
    const moveDy = cv.my + ( dx / (dist || 1)) * side * spd * 0.35;
    if (Math.abs(moveDx) >= Math.abs(moveDy)) {
      if (moveDx > 0) e.direction = 'right'; else if (moveDx < 0) e.direction = 'left';
    } else {
      if (moveDy > 0) e.direction = 'down'; else if (moveDy < 0) e.direction = 'up';
    }
    moveEntityWithSlide(e, moveDx, moveDy);
    if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex = (e.frameIndex + 1) % 4; }
    return;
  }

  if (e.state === 'attacking') {
    if (++e.frameTick >= Math.max(3, Math.floor(ATK_SPEED * 0.55))) {
      e.frameTick = 0;
      e.attackFrame = ((e.attackFrame || 0) + 1) % 4;
    }
    if (--e.attackTimer <= 0) {
      if (dist < GOBLIN_ATK_RANGE + Math.round(DISPLAY_SIZE * 0.3)) {
        const base = player.berserkTimer > 0 ? Math.round(GOBLIN_DAMAGE * 1.5) : GOBLIN_DAMAGE;
        const dmg = damagePlayer(base, 15);
        addMarker(player.x + DISPLAY_SIZE / 2, player.y, `-${dmg}`, '#ff8800');
        playsfx('damage');
      }
      e.state = 'cooldown';
      e.attackTimer = atkCooldown;
    }
    return;
  }

  if (e.state === 'cooldown') {
    if (--e.attackTimer <= 0) e.state = 'chase';
  }

  let moveDx = 0, moveDy = 0;
  if (dist < GOBLIN_ATK_RANGE && e.state !== 'cooldown') {
    e.state = 'attacking';
    e.attackTimer = 24;
    e.attackFrame = 0;
    e.frameTick = 0;
    return;
  } else if (dist < GOBLIN_CHASE) {
    if (e.state !== 'cooldown') e.state = 'chase';
    const cv = chaseVec(dx, dy, spd);
    moveDx = cv.mx; moveDy = cv.my;
    // Separation: push away from overlapping goblins so they spread around the player
    const sep = separationVec(e, GOBLIN_SIZE * 1.4);
    moveDx += sep.fx; moveDy += sep.fy;
  } else {
    if (e.state !== 'cooldown') e.state = 'wander';
    if (--e.wanderTimer <= 0) {
      const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},{dx:0,dy:0}];
      const c = dirs[Math.floor(Math.random() * dirs.length)];
      e.wanderDx = c.dx; e.wanderDy = c.dy;
      e.wanderTimer = 60 + Math.floor(Math.random() * 60);
    }
    moveDx = e.wanderDx * spd; moveDy = e.wanderDy * spd;
  }

  if (Math.abs(moveDx) >= Math.abs(moveDy)) {
    if (moveDx > 0) e.direction = 'right'; else if (moveDx < 0) e.direction = 'left';
  } else {
    if (moveDy > 0) e.direction = 'down'; else if (moveDy < 0) e.direction = 'up';
  }
  moveEntityWithSlide(e, moveDx, moveDy);
  if (moveDx !== 0 || moveDy !== 0) {
    if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex = (e.frameIndex + 1) % 4; }
  } else { e.frameIndex = 0; e.frameTick = 0; }
}

function updateMinotaur(e) {
  if (e.dying || e.hp <= 0) return;
  const size = DISPLAY_SIZE * 2;
  e.aliveFrames++;
  if (e.hitFlash > 0) e.hitFlash--;
  if (e.slowTimer > 0) e.slowTimer--;
  if (e.chargeCooldown > 0) e.chargeCooldown--;
  const spd = e.slowTimer > 0 ? 1 : ENEMY_SPEED;

  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);

  if (e.state === 'stunned') {
    if (--e.stunTimer <= 0) { e.state = 'wander'; e.chargeCooldown = MINOTAUR_CHARGE_CD; }
    return;
  }

  if (e.state === 'windup') {
    if (--e.chargeTimer <= 0) {
      e.state = 'charging';
      e.chargeTimer = MINOTAUR_CHARGE_DUR;
      e.chargeHit = false;
    }
    return;
  }

  if (e.state === 'charging') {
    const enraged = e.hp / e.maxHp <= 0.5;
    const chargeSpd = enraged ? MINOTAUR_ENRAGE_SPEED : MINOTAUR_CHARGE_SPEED;
    const cdx = e.chargeDx * chargeSpd;
    const cdy = e.chargeDy * chargeSpd;
    const nx = e.x + cdx;
    const ny = e.y + cdy;
    if (stage === 3 && minotaurHitsSideWall(nx, size)) {
      e.state = 'stunned';
      e.stunTimer = MINOTAUR_WALL_STUN;
      e.hitFlash = 30;
      addMarker(e.x + size / 2, e.y - 10, 'STUNNED!', '#ffd700');
      playsfx('stoneCrash');
      return;
    }
    if (stage !== 3 && !canRectMoveTo(nx, ny, size, size)) {
      e.state = 'stunned';
      e.stunTimer = MINOTAUR_WALL_STUN;
      e.hitFlash = 30;
      addMarker(e.x + size / 2, e.y - 10, 'STUNNED!', '#ffd700');
      playsfx('stoneCrash');
      return;
    }
    e.x = stage === 3 ? Math.max(TILE_SIZE, Math.min(canvas.width - size - TILE_SIZE, nx)) : nx;
    e.y = stage === 3 ? Math.max(TILE_SIZE, Math.min(GAME_HEIGHT - size, ny)) : ny;
    if (!e.chargeHit && rectsOverlap(e.x, e.y, size, size, player.x, player.y, DISPLAY_SIZE, DISPLAY_SIZE)) {
      e.chargeHit = true;
      const base = player.berserkTimer > 0 ? Math.round(MINOTAUR_CHARGE_DMG * 1.5) : MINOTAUR_CHARGE_DMG;
      const dmg = damagePlayer(base, 20);
      addMarker(player.x + DISPLAY_SIZE / 2, player.y, `-${dmg}`, '#ff4400');
      playsfx('damage');
    }
    if (--e.chargeTimer <= 0) { e.state = 'wander'; e.chargeCooldown = MINOTAUR_CHARGE_CD; }
    return;
  }

  let moveDx = 0, moveDy = 0;
  if (dist < DISPLAY_SIZE * 3.5 && e.chargeCooldown <= 0) {
    e.state = 'windup';
    e.chargeTimer = MINOTAUR_WINDUP_DUR;
    const mag = dist || 1;
    e.chargeDx = dx / mag; e.chargeDy = dy / mag;
    // Lock facing direction toward charge target and play roar on windup start
    e.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    playsfx('minotaurRoar');
    return;
  } else {
    e.state = 'chase';
    const cv = chaseVec(dx, dy, spd);
    moveDx = cv.mx; moveDy = cv.my;
  }

  if (Math.abs(moveDx) >= Math.abs(moveDy)) {
    if (moveDx > 0) e.direction = 'right'; else if (moveDx < 0) e.direction = 'left';
  } else {
    if (moveDy > 0) e.direction = 'down'; else if (moveDy < 0) e.direction = 'up';
  }
  moveEntityWithSlide(e, moveDx, moveDy);
  if (moveDx !== 0 || moveDy !== 0) {
    if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex = (e.frameIndex + 1) % 4; }
  } else { e.frameIndex = 0; e.frameTick = 0; }
}

// ── Projectile system ─────────────────────────────────────────────────────────

function spawnProjectile(sx, sy, damage, speed, type) {
  const tx = player.x + DISPLAY_SIZE / 2, ty = player.y + DISPLAY_SIZE / 2;
  const dx = tx - sx, dy = ty - sy, mag = Math.hypot(dx, dy) || 1;
  const proj = { x: sx, y: sy, dx: dx/mag * speed, dy: dy/mag * speed,
    damage, type, life: 400, hit: false };
  if (type === 'rock') {
    proj.targetX = tx; proj.targetY = ty;
    proj.shadowLife = Math.max(20, Math.ceil(Math.hypot(tx - sx, ty - sy) / Math.max(1, speed)));
  }
  projectiles.push(proj);
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.dx; p.y += p.dy;
    if (p.frameTick !== undefined && ++p.frameTick >= 6) {
      p.frameTick = 0;
      p.frame = ((p.frame || 0) + 1) % 4;
    }

    if (p.type === 'rock') {
      const toTarget = Math.hypot(p.x - p.targetX, p.y - p.targetY);
      const stepDist = Math.hypot(p.dx, p.dy);
      if (--p.life <= 0 || toTarget <= stepDist + 2) {
        p.x = p.targetX; p.y = p.targetY;
        checkRockSplash(p);
        spawnTrollRockImpact(p.x, p.y);
        projectiles.splice(i, 1);
      }
      continue;
    }

    if (--p.life <= 0 || isSolid(p.x, p.y)) {
      if (p.type === 'fireball') {
        stopSfxInstance(p.flySound);
        applyFireballSplash(p.x, p.y, Math.round(p.damage * 0.65));
        spawnFireballExplosion(p.x, p.y);
        playsfx('fireballImpact');
      }
      projectiles.splice(i, 1);
      continue;
    }
    if (p.type === 'fireball') {
      let hit = false;
      enemies.forEach(e => {
        if (hit || e.hp <= 0 || e.dying) return;
        const eb = enemyHitbox(e);
        if (p.x >= eb.x && p.x <= eb.x + eb.w && p.y >= eb.y && p.y <= eb.y + eb.h) {
          applyFireballSplash(p.x, p.y, p.damage, e);
          stopSfxInstance(p.flySound);
          spawnFireballExplosion(p.x, p.y);
          playsfx('fireballImpact');
          hit = true;
        }
      });
      if (hit) projectiles.splice(i, 1);
      continue;
    }
    if (p.type === 'dagger') {
      // Dagger hits enemies (player-fired), not the player
      let hit = false;
      enemies.forEach(e => {
        if (hit || e.hp <= 0 || e.dying) return;
        const eb = enemyHitbox(e);
        if (p.x >= eb.x && p.x <= eb.x + eb.w && p.y >= eb.y && p.y <= eb.y + eb.h) {
          applyDamageToEnemy(e, p.damage, '#2ecc71');
          playsfx('knifeImpact');
          hit = true;
        }
      });
      if (hit) { projectiles.splice(i, 1); }
      continue;
    }
    if (!p.hit) {
      const dist = Math.hypot(p.x - (player.x + DISPLAY_SIZE/2), p.y - (player.y + DISPLAY_SIZE/2));
      if (dist < DISPLAY_SIZE * 0.6) {
        p.hit = true;
        const base = player.berserkTimer > 0 ? Math.round(p.damage * 1.5) : p.damage;
        const dmg = damagePlayer(base, 15);
        if (dmg > 0) addMarker(player.x + DISPLAY_SIZE/2, player.y, `-${dmg}`, '#aaccff');
        playsfx('damage');
        projectiles.splice(i, 1);
      }
    }
  }
}

function spawnFireballExplosion(x, y) {
  spellEffects.push({
    type: 'fireballExplosion',
    x, y,
    frame: 0,
    tick: 0,
    life: FIREBALL_EXPLOSION_FRAMES * 4,
    size: Math.round(DISPLAY_SIZE * 1.45)
  });
}

const TROLL_BOULDER_IMPACT_FRAMES = 15;
function spawnTrollRockImpact(x, y) {
  spellEffects.push({
    type: 'trollRockImpact',
    x, y,
    frame: 0,
    tick: 0,
    life: TROLL_BOULDER_IMPACT_FRAMES * 2,
    size: Math.round(DISPLAY_SIZE * 1.55)
  });
}

function applyFireballSplash(x, y, damage, directHit = null) {
  enemies.forEach(e => {
    if (e.hp <= 0 || e.dying) return;
    const eb = enemyHitbox(e);
    const ex = eb.x + eb.w / 2;
    const ey = eb.y + eb.h / 2;
    if (Math.hypot(ex - x, ey - y) <= FIREBALL_EXPLOSION_RADIUS + Math.max(eb.w, eb.h) * 0.25) {
      const dealt = e === directHit ? damage : Math.round(damage * 0.65);
      applyDamageToEnemy(e, dealt, '#e74c3c');
    }
  });
}

function updateSpellEffects() {
  for (let i = spellEffects.length - 1; i >= 0; i--) {
    const fx = spellEffects[i];
    const frameSpeed = fx.type === 'trollRockImpact' ? 2 : 4;
    if (++fx.tick >= frameSpeed) {
      fx.tick = 0;
      fx.frame++;
    }
    const maxFrames = fx.type === 'fireballExplosion' ? FIREBALL_EXPLOSION_FRAMES :
      fx.type === 'trollRockImpact' ? TROLL_BOULDER_IMPACT_FRAMES : 4;
    if (--fx.life <= 0 || fx.frame >= maxFrames) spellEffects.splice(i, 1);
  }
}

function checkRockSplash(p) {
  playsfx('slam');
  const cx = p.x, cy = p.y;
  addHazard('rubble', cx, cy, ROCK_AOE * 0.45, TROLL_RUBBLE_DUR, { slow: true, color: '#777' });
  if (!p.hit && Math.hypot(cx - (player.x + DISPLAY_SIZE/2), cy - (player.y + DISPLAY_SIZE/2)) < ROCK_AOE) {
    const base = player.berserkTimer > 0 ? Math.round(p.damage * 1.5) : p.damage;
    const dmg = damagePlayer(base, 15);
    addMarker(player.x + DISPLAY_SIZE/2, player.y, `-${dmg}`, '#888');
    playsfx('damage');
  }
}

// Arrow sprite sheet: row 0=down, row 1=up, row 2=right, row 3=left (each 4 frames wide)
const ARROW_DISPLAY = Math.round(DISPLAY_SIZE * 0.4);
function arrowSpriteRow(p) {
  const ax = p.dx, ay = p.dy;
  if (Math.abs(ax) > Math.abs(ay)) return ax > 0 ? 2 : 3;
  return ay > 0 ? 0 : 1;
}

function drawProjectiles() {
  projectiles.forEach(p => {
    if (p.type === 'rock') {
      const progress = 1 - Math.max(0, p.life) / 400;
      const pulse = 0.35 + Math.min(0.45, progress * 0.6);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#aaaaaa';
      ctx.fillStyle = 'rgba(40,35,30,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.targetX, p.targetY, ROCK_AOE, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (p.type === 'arrow' && arrowSheet) {
      const row = arrowSpriteRow(p);
      const sz  = ARROW_DISPLAY;
      ctx.drawImage(arrowSheet,
        0, row * MON_FRAME_SIZE, MON_FRAME_SIZE, MON_FRAME_SIZE,
        p.x - sz / 2, p.y - sz / 2, sz, sz);
      return;
    }
    if (p.type === 'dagger' && daggerSheet) {
      const row = arrowSpriteRow(p); // same direction-to-row logic
      const sz  = Math.round(DISPLAY_SIZE * 0.5);
      ctx.drawImage(daggerSheet,
        0, row * MON_FRAME_SIZE, MON_FRAME_SIZE, MON_FRAME_SIZE,
        p.x - sz / 2, p.y - sz / 2, sz, sz);
      return;
    }
    if (p.type === 'fireball' && mageFireballProjSheet) {
      const row = arrowSpriteRow(p);
      const col = p.frame || 0;
      const sz  = Math.round(DISPLAY_SIZE * 0.72);
      drawMonSprite(mageFireballProjSheet, col, row, p.x - sz / 2, p.y - sz / 2, sz, sz);
      return;
    }
    // Rock / other projectiles
    if (p.type === 'rock' && trollBoulderSheet) {
      const sz = Math.round(DISPLAY_SIZE * 0.8);
      drawSheetSprite(trollBoulderSheet, 0, 0, p.x - sz / 2, p.y - sz / 2, sz, sz, 4, 4);
      return;
    }
    ctx.fillStyle = p.type === 'dagger' ? '#bbb' : '#888';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.type === 'rock' ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    if (p.type === 'rock') { ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.stroke(); }
  });
}

// ── Simple melee helper ───────────────────────────────────────────────────────

function drawSpellEffects() {
  spellEffects.forEach(fx => {
    if (fx.type === 'fireballExplosion' && mageFireballExplosionSheet) {
      const col = Math.min(3, fx.frame % 4);
      const row = FIREBALL_EXPLOSION_ROW_START + Math.min(1, Math.floor(fx.frame / 4));
      const sz = fx.size;
      drawSheetSprite(mageFireballExplosionSheet, col, row, fx.x - sz / 2, fx.y - sz / 2, sz, sz, 4, 4);
    } else if (fx.type === 'frostnova' && mageFrostNovaSheet) {
      const col = Math.min(3, fx.frame);
      const sz = fx.size;
      ctx.save();
      ctx.globalAlpha = Math.max(0.2, fx.life / 32);
      drawMonSprite(mageFrostNovaSheet, col, 2, fx.x - sz / 2, fx.y - sz / 2, sz, sz);
      ctx.restore();
    } else if (fx.type === 'trollRockImpact' && trollBoulderSheet) {
      const frame = Math.min(15, fx.frame + 1);
      const col = frame % 4;
      const row = Math.floor(frame / 4);
      const sz = fx.size;
      drawSheetSprite(trollBoulderSheet, col, row, fx.x - sz / 2, fx.y - sz / 2, sz, sz, 4, 4);
    }
  });
}

function updateSimpleMelee(e, hp, dmg, speed, atkRange, atkCD, chaseRange) {
  if (e.dying || e.hp <= 0) return;
  e.aliveFrames = (e.aliveFrames || 0) + 1;
  if (e.hitFlash > 0) e.hitFlash--;
  if (e.slowTimer > 0) e.slowTimer--;
  if (e.spearEffect > 0) e.spearEffect--;
  if (e.frenzyTimer > 0) e.frenzyTimer--;
  const baseSpeed = e.frenzyTimer > 0 ? speed * 1.35 : speed;
  const spd = e.slowTimer > 0 ? Math.max(1, Math.round(baseSpeed * 0.5)) : baseSpeed;
  const dx = player.x - e.x, dy = player.y - e.y, dist = Math.hypot(dx, dy);
  const ghoulKeepOut = e.type === 'ghoul'
    ? keepOutFromPlayerVec(e, DISPLAY_SIZE * 0.74, Math.max(1.5, spd * 0.85))
    : null;

  if (e.state === 'attacking') {
    if (++e.frameTick >= Math.max(4, Math.floor(ATK_SPEED * 0.75))) {
      e.frameTick = 0;
      e.attackFrame = ((e.attackFrame || 0) + 1) % 4;
    }
    if (--e.attackTimer <= 0) {
      if (dist < atkRange + Math.round(DISPLAY_SIZE * 0.3)) {
        const base = player.berserkTimer > 0 ? Math.round(dmg * 1.5) : dmg;
        const hit = damagePlayer(base, 15);
        addMarker(player.x + DISPLAY_SIZE/2, player.y, `-${hit}`, '#ff8800');
        if (e.type === 'ghoul') e.frenzyTimer = GHOUL_FEEDING_FRENZY;
        if      (e.type === 'ghoul')    playsfx('ghoulAttack');
        else if (e.type === 'guardian') playsfx('guardianHit');
        else if (e.type === 'orc')      playsfx('orcHit');
        playsfx('damage');
      }
      e.state = 'cooldown'; e.attackTimer = atkCD;
    }
    return;
  }
  if (e.state === 'cooldown') {
    if (--e.attackTimer <= 0) e.state = 'chase';
    if (ghoulKeepOut) {
      moveEntityWithSlide(e, ghoulKeepOut.mx, ghoulKeepOut.my);
      if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex = (e.frameIndex+1)%4; }
    }
    return;
  }

  let mx = 0, my = 0;
  if (ghoulKeepOut) {
    e.state = 'chase';
    mx = ghoulKeepOut.mx;
    my = ghoulKeepOut.my;
  } else if (dist < atkRange && e.state !== 'cooldown') {
    e.state = 'attacking'; e.attackTimer = 15;
    if (e.type === 'guardian') playsfx('guardianHit');
    else if (e.type === 'ghoul') playsfx('ghoulAttack');
    return;
  } else if (dist < chaseRange) {
    if (e.state !== 'cooldown') e.state = 'chase';
    const cv = chaseVec(dx, dy, spd);
    mx = cv.mx; my = cv.my;
    // Ghouls get separation so the swarm spreads and doesn't pile into one spot
    if (e.type === 'ghoul') {
      const sep = separationVec(e, DISPLAY_SIZE * 0.9);
      mx += sep.fx; my += sep.fy;
    }
  } else {
    if (e.state !== 'cooldown') e.state = 'wander';
    if (--e.wanderTimer <= 0) {
      const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},{dx:0,dy:0}];
      const c = dirs[Math.floor(Math.random() * dirs.length)];
      e.wanderDx = c.dx; e.wanderDy = c.dy;
      e.wanderTimer = 60 + Math.floor(Math.random() * 90);
    }
    mx = e.wanderDx * spd; my = e.wanderDy * spd;
  }
  if (Math.abs(mx) >= Math.abs(my)) { if (mx > 0) e.direction='right'; else if (mx < 0) e.direction='left'; }
  else { if (my > 0) e.direction='down'; else if (my < 0) e.direction='up'; }
  moveEntityWithSlide(e, mx, my);
  if (mx !== 0 || my !== 0) { if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex = (e.frameIndex+1)%4; } }
  else { e.frameIndex = 0; e.frameTick = 0; }
}

function updateArcher(e) {
  if (e.dying || e.hp <= 0) return;
  e.aliveFrames++;
  if (e.hitFlash > 0) e.hitFlash--;
  if (e.shootTimer > 0) e.shootTimer--;
  // Flip strafe direction occasionally so archers circle rather than stand still
  if (!e.strafeDir) e.strafeDir = Math.random() < 0.5 ? 1 : -1;
  if (--e.wanderTimer <= 0) { e.strafeDir = -e.strafeDir; e.wanderTimer = 90 + Math.floor(Math.random() * 90); }

  const dx = player.x - e.x, dy = player.y - e.y, dist = Math.hypot(dx, dy);
  let mx = 0, my = 0;

  if (e.state === 'volley') {
    if (--e.volleyTimer <= 0) {
      spawnProjectile(e.x + ARCHER_SIZE/2, e.y + ARCHER_SIZE/2, ARCHER_DAMAGE, ARROW_SPEED, 'arrow');
      playsfx('bowShot');
      e.shootTimer = ARCHER_SHOOT_CD;
      e.state = 'idle';
    }
    return;
  }

  if (dist < ARCHER_FLEE_RANGE) {
    // Flee directly away — normalized so it doesn't jitter
    const cv = chaseVec(-dx, -dy, GOBLIN_SPEED);
    mx = cv.mx; my = cv.my;
    e.state = 'flee';
    const boneStepX = (-dy / (dist || 1)) * e.strafeDir * GOBLIN_SPEED;
    const boneStepY = ( dx / (dist || 1)) * e.strafeDir * GOBLIN_SPEED;
    if (!canEntityMoveTo(e, e.x + mx, e.y)) mx = boneStepX;
    if (!canEntityMoveTo(e, e.x, e.y + my)) my = boneStepY;
  } else if (dist < ARCHER_SHOOT_RANGE) {
    // Shoot and strafe perpendicular to maintain distance + dodge
    if (e.shootTimer <= 0) {
      const archers = enemies.filter(o => o.type === 'archer' && !o.dying && o.hp > 0);
      if (archers.length >= 3 && Math.random() < 0.35) {
        archers.forEach(o => {
          o.state = 'volley';
          o.volleyTimer = ARCHER_VOLLEY_WINDUP + Math.floor(Math.random() * 10);
          o.shootTimer = ARCHER_SHOOT_CD;
        });
      } else {
        spawnProjectile(e.x + DISPLAY_SIZE/2, e.y + DISPLAY_SIZE/2, ARCHER_DAMAGE, ARROW_SPEED, 'arrow');
        playsfx('bowShot');
        e.shootTimer = ARCHER_SHOOT_CD;
        e.state = 'attacking';
      }
    } else {
      e.state = 'idle';
    }
    // Strafe perpendicularly while shooting
    const perpX = (-dy / (dist || 1)) * e.strafeDir;
    const perpY = ( dx / (dist || 1)) * e.strafeDir;
    mx = perpX * GOBLIN_SPEED * 0.6;
    my = perpY * GOBLIN_SPEED * 0.6;
  } else {
    // Close gap to get into firing range
    e.state = 'chase';
    const cv = chaseVec(dx, dy, GOBLIN_SPEED);
    mx = cv.mx; my = cv.my;
  }

  if (Math.abs(mx) >= Math.abs(my)) { if (mx > 0) e.direction='right'; else if (mx < 0) e.direction='left'; }
  else { if (my > 0) e.direction='down'; else if (my < 0) e.direction='up'; }
  moveEntityWithSlide(e, mx, my);
  if (mx !== 0 || my !== 0) { if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex=(e.frameIndex+1)%4; } }
  else { e.frameIndex = 0; e.frameTick = 0; }
}

function updateSkeletalChampion(e) {
  if (e.dying || e.hp <= 0) return;
  e.aliveFrames = (e.aliveFrames || 0) + 1;
  if (e.hitFlash > 0) e.hitFlash--;
  if (e.slowTimer > 0) e.slowTimer--;
  if (e.blockCooldown > 0) e.blockCooldown--;
  if (e.blockTimer > 0) e.blockTimer--;

  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);
  if (e.state === 'attacking') {
    if (++e.frameTick >= Math.max(4, Math.floor(ATK_SPEED * 0.9))) {
      e.frameTick = 0;
      e.attackFrame = ((e.attackFrame || 0) + 1) % 4;
    }
    if (--e.attackTimer <= 0) {
      if (dist < SKELETAL_CHAMPION_ATK_RANGE + DISPLAY_SIZE * 0.25) {
        const hit = damagePlayer(SKELETAL_CHAMPION_DAMAGE, 16);
        if (hit > 0) addMarker(player.x + DISPLAY_SIZE / 2, player.y, `-${hit}`, '#d9f2ff');
        playsfx('damage');
      }
      e.state = 'cooldown';
      e.attackTimer = SKELETAL_CHAMPION_ATK_CD;
    }
    return;
  }
  if (e.state === 'cooldown') {
    if (--e.attackTimer <= 0) e.state = 'chase';
    return;
  }
  if (dist < SKELETAL_CHAMPION_ATK_RANGE) {
    e.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    e.state = 'attacking';
    e.attackTimer = SKELETAL_CHAMPION_WINDUP;
    e.attackFrame = 0;
    e.frameTick = 0;
    return;
  }

  const archers = enemies.filter(o => o.type === 'archer' && !o.dying && o.hp > 0);
  let tx = player.x, ty = player.y;
  if (archers.length) {
    const ax = archers.reduce((sum, a) => sum + a.x, 0) / archers.length;
    const ay = archers.reduce((sum, a) => sum + a.y, 0) / archers.length;
    const vx = ax - player.x;
    const vy = ay - player.y;
    const mag = Math.hypot(vx, vy) || 1;
    const champions = enemies.filter(o => o.type === 'skeletal_champion' && !o.dying && o.hp > 0)
      .sort((a, b) => a.spawnIndex - b.spawnIndex);
    const idx = Math.max(0, champions.indexOf(e));
    const side = champions.length > 1 ? (idx - (champions.length - 1) / 2) : 0;
    const wallX = player.x + vx * 0.45;
    const wallY = player.y + vy * 0.45;
    const perpX = -vy / mag;
    const perpY = vx / mag;
    tx = wallX + perpX * side * SKELETAL_CHAMPION_SIZE * 1.45;
    ty = wallY + perpY * side * SKELETAL_CHAMPION_SIZE * 1.45;
  }
  const cv = chaseVec(tx - e.x, ty - e.y, e.slowTimer > 0 ? SKELETAL_CHAMPION_SPEED * 0.5 : SKELETAL_CHAMPION_SPEED);
  if (Math.abs(cv.mx) >= Math.abs(cv.my)) { if (cv.mx > 0) e.direction='right'; else if (cv.mx < 0) e.direction='left'; }
  else { if (cv.my > 0) e.direction='down'; else if (cv.my < 0) e.direction='up'; }
  moveEntityWithSlide(e, cv.mx, cv.my);
  const sep = separationVec(e, SKELETAL_CHAMPION_SIZE * 1.35);
  if (sep.fx || sep.fy) {
    moveEntityWithSlide(e, sep.fx, sep.fy);
  }
  if (cv.mx !== 0 || cv.my !== 0 || sep.fx || sep.fy) { if (++e.frameTick >= FRAME_SPEED + 3) { e.frameTick = 0; e.frameIndex=(e.frameIndex+1)%4; } }
  else { e.frameIndex = 0; e.frameTick = 0; }
}

function updateOrc(e) {
  if (e.dying || e.hp <= 0) return;
  e.aliveFrames++;
  if (e.hitFlash > 0) e.hitFlash--;
  if (e.slowTimer > 0) e.slowTimer--;

  // Enrage at 40% HP: trigger a charge toward the player
  if (!e.enraged && e.hp <= e.maxHp * 0.4) {
    e.enraged = true;
    const dx2 = player.x - e.x, dy2 = player.y - e.y;
    const mag2 = Math.hypot(dx2, dy2) || 1;
    e.chargeDx = dx2 / mag2; e.chargeDy = dy2 / mag2;
    e.chargeTimer = 50; // ~0.85s at 60fps
    e.state = 'charge';
    playsfx('orcHit'); // battle cry on enrage
  }

  const dx = player.x - e.x, dy = player.y - e.y, dist = Math.hypot(dx, dy);
  const orcSize = e.brute ? ORC_SIZE * 2 : ORC_SIZE;
  const orcAtkRange = e.brute ? ORC_ATK_RANGE * 1.45 : ORC_ATK_RANGE;

  // Charge state — lunge at player
  if (e.state === 'charge') {
    if (e.chargeTimer > 0) {
      e.chargeTimer--;
      const mx = e.chargeDx * ORC_CHARGE_SPEED;
      const my = e.chargeDy * ORC_CHARGE_SPEED;
      if (Math.abs(mx) >= Math.abs(my)) { e.direction = mx > 0 ? 'right' : 'left'; }
      else { e.direction = my > 0 ? 'down' : 'up'; }
      moveEntityWithSlide(e, mx, my);
      // Deal damage if close enough during the charge
      if (dist < orcAtkRange) {
        const base = player.berserkTimer > 0 ? Math.round(ORC_DAMAGE * 1.5) : ORC_DAMAGE;
        const hit = damagePlayer(base, 15);
        addMarker(player.x + DISPLAY_SIZE/2, player.y, `-${hit}`, '#ff4400');
        playsfx('orcHit'); playsfx('damage');
        e.chargeTimer = 0; // end charge after landing
      }
      if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex = (e.frameIndex+1)%4; }
      return;
    }
    e.state = 'cooldown'; e.attackTimer = ORC_ATK_CD;
  }

  if (e.state === 'attacking') {
    const elapsed = ORC_CLEAVE_WINDUP - e.attackTimer;
    e.attackFrame = Math.min(3, Math.max(0, Math.floor(elapsed / Math.max(1, ORC_CLEAVE_WINDUP / 4))));
    if (--e.attackTimer <= 0) {
      const cleave = rectInFrontOf(e, orcAtkRange * 0.99, orcSize * 1.15, orcSize);
      if (rectsOverlap(cleave.x, cleave.y, cleave.w, cleave.h, player.x, player.y, DISPLAY_SIZE, DISPLAY_SIZE)) {
        const base = player.berserkTimer > 0 ? Math.round(ORC_DAMAGE * 1.5) : ORC_DAMAGE;
        const hit = damagePlayer(base, 15);
        addMarker(player.x + DISPLAY_SIZE/2, player.y, `-${hit}`, '#ff8800');
        playsfx('orcHit'); playsfx('damage');
      }
      e.state = 'cooldown'; e.attackTimer = ORC_ATK_CD;
    }
    return;
  }
  if (e.state === 'cooldown') { if (--e.attackTimer <= 0) e.state = 'chase'; }

  let mx = 0, my = 0;
  const spd = e.slowTimer > 0 ? Math.max(1, Math.round(ORC_SPEED * 0.5)) : ORC_SPEED;
  if (dist < orcAtkRange && e.state !== 'cooldown') {
    e.state = 'attacking';
    e.attackTimer = ORC_CLEAVE_WINDUP;
    e.attackFrame = 0;
    e.frameTick = 0;
    e.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    return;
  } else if (dist < ORC_CHASE && e.state !== 'cooldown') {
    e.state = 'chase';
    const cv = chaseVec(dx, dy, spd);
    mx = cv.mx; my = cv.my;
    const sep = separationVec(e, ORC_SIZE * 1.5);
    mx += sep.fx * 0.6; my += sep.fy * 0.6;
  } else {
    if (e.state !== 'cooldown') e.state = 'wander';
    if (--e.wanderTimer <= 0) {
      const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
      const c = dirs[Math.floor(Math.random() * dirs.length)];
      e.wanderDx = c.dx; e.wanderDy = c.dy;
      e.wanderTimer = 60 + Math.floor(Math.random() * 90);
    }
    mx = e.wanderDx * spd; my = e.wanderDy * spd;
  }
  if (Math.abs(mx) >= Math.abs(my)) { if (mx > 0) e.direction='right'; else if (mx < 0) e.direction='left'; }
  else { if (my > 0) e.direction='down'; else if (my < 0) e.direction='up'; }
  moveEntityWithSlide(e, mx, my);
  if (mx !== 0 || my !== 0) { if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex=(e.frameIndex+1)%4; } }
  else { e.frameIndex = 0; e.frameTick = 0; }
}

function updateGuardian(e) {
  if (e.dying || e.hp <= 0) return;
  e.aliveFrames++;
  if (e.hitFlash > 0) e.hitFlash--;
  if (e.spearEffect > 0) e.spearEffect--;

  // Enrage if the other guardian is dead
  if (!e.enraged) {
    const otherDead = enemies.every(o => o === e || o.type !== 'guardian' || o.dying || o.hp <= 0);
    if (otherDead) { e.enraged = true; }
  }
  const spd    = e.enraged ? GUARDIAN_SPEED * 2 : GUARDIAN_SPEED;
  const dmg    = e.enraged ? Math.round(GUARDIAN_DAMAGE * 1.4) : GUARDIAN_DAMAGE;
  const atkCD  = e.enraged ? Math.round(GUARDIAN_ATK_CD * 0.45) : GUARDIAN_ATK_CD;

  const dx = player.x - e.x, dy = player.y - e.y, dist = Math.hypot(dx, dy);

  // Windup phase — face locked, count down
  if (e.state === 'windup') {
    if (--e.attackTimer <= 0) {
      // Spear lunge hits in a long rectangle forward from the guardian
      const spearHit = (() => {
        const gCx = e.x + DISPLAY_SIZE / 2, gCy = e.y + DISPLAY_SIZE / 2;
        const pCx = player.x + DISPLAY_SIZE / 2, pCy = player.y + DISPLAY_SIZE / 2;
        const SR = e.enraged ? GUARDIAN_SPEAR_RANGE * 1.2 : GUARDIAN_SPEAR_RANGE;
        const SW = e.enraged ? DISPLAY_SIZE * 1.25 : DISPLAY_SIZE * 0.55;
        if (e.windupDir === 'right' && pCx > gCx && pCx < gCx + SR && Math.abs(pCy - gCy) < SW) return true;
        if (e.windupDir === 'left'  && pCx < gCx && pCx > gCx - SR && Math.abs(pCy - gCy) < SW) return true;
        if (e.windupDir === 'down'  && pCy > gCy && pCy < gCy + SR && Math.abs(pCx - gCx) < SW) return true;
        if (e.windupDir === 'up'    && pCy < gCy && pCy > gCy - SR && Math.abs(pCx - gCx) < SW) return true;
        return false;
      })();
      if (spearHit) {
        const base = player.berserkTimer > 0 ? Math.round(dmg * 1.5) : dmg;
        const hit = damagePlayer(base, 15);
        addMarker(player.x + DISPLAY_SIZE/2, player.y, `-${hit}`, '#ff4444');
        playsfx('guardianHit'); playsfx('damage');
      }
      e.spearEffect = 0;
      playsfx('guardianHit');
      e.state = 'cooldown'; e.attackTimer = atkCD;
    }
    return;
  }

  if (e.state === 'cooldown') { if (--e.attackTimer <= 0) e.state = 'chase'; }

  // Trigger windup when player enters attack range
  if (e.state !== 'cooldown' && dist < GUARDIAN_ATK_RANGE) {
    e.state = 'windup';
    e.attackTimer = GUARDIAN_WINDUP_DUR;
    // Lock direction toward player at windup start
    e.windupDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    e.direction = e.windupDir;
    return;
  }

  // Chase — always pursue, use separation so they flank from different angles
  let mx = 0, my = 0;
  if (e.state !== 'cooldown') {
    e.state = 'chase';
    const partners = enemies.filter(o => o.type === 'guardian' && o !== e && !o.dying && o.hp > 0);
    const flank = partners.length ? (enemies.indexOf(e) % 2 === 0 ? 1 : -1) : 0;
    const fdx = flank ? dx + (-dy / (dist || 1)) * DISPLAY_SIZE * 1.8 * flank : dx;
    const fdy = flank ? dy + ( dx / (dist || 1)) * DISPLAY_SIZE * 1.8 * flank : dy;
    const cv = chaseVec(fdx, fdy, spd);
    mx = cv.mx; my = cv.my;
    const sep = separationVec(e, DISPLAY_SIZE * 1.8);
    mx += sep.fx * 1.2; my += sep.fy * 1.2;
  }
  if (Math.abs(mx) >= Math.abs(my)) { if (mx > 0) e.direction='right'; else if (mx < 0) e.direction='left'; }
  else { if (my > 0) e.direction='down'; else if (my < 0) e.direction='up'; }
  moveEntityWithSlide(e, mx, my);
  if (mx !== 0 || my !== 0) { if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex=(e.frameIndex+1)%4; } }
  else { e.frameIndex = 0; e.frameTick = 0; }
}

function updateTroll(e) {
  if (e.dying || e.hp <= 0) return;
  e.aliveFrames++;
  if (e.hitFlash > 0) e.hitFlash--;
  if (e.throwTimer > 0) e.throwTimer--;
  const dx = player.x - e.x, dy = player.y - e.y, dist = Math.hypot(dx, dy);
  let mx = 0, my = 0;
  if (dist < TROLL_THROW_RANGE) {
    if (e.throwTimer <= 0) {
      e.state = 'attacking';
      e.attackFrame = 0;
      e.attackAnimTimer = 32;
      spawnProjectile(e.x + DISPLAY_SIZE/2, e.y + DISPLAY_SIZE/2, TROLL_DAMAGE, ROCK_SPEED, 'rock');
      if (e.hp <= e.maxHp * 0.5) {
        const leadX = player.x + DISPLAY_SIZE / 2 + (player.moving ? (player.direction === 'right' ? DISPLAY_SIZE : player.direction === 'left' ? -DISPLAY_SIZE : 0) : 0);
        const leadY = player.y + DISPLAY_SIZE / 2 + (player.moving ? (player.direction === 'down' ? DISPLAY_SIZE : player.direction === 'up' ? -DISPLAY_SIZE : 0) : 0);
        const sx = e.x + DISPLAY_SIZE/2, sy = e.y + DISPLAY_SIZE/2;
        const dx2 = leadX - sx, dy2 = leadY - sy, mag2 = Math.hypot(dx2, dy2) || 1;
        projectiles.push({ x: sx, y: sy, dx: dx2/mag2 * ROCK_SPEED, dy: dy2/mag2 * ROCK_SPEED,
          damage: TROLL_DAMAGE, type: 'rock', life: 430, hit: false, targetX: leadX, targetY: leadY });
      }
      e.throwTimer = TROLL_THROW_CD;
    }
    // Troll slowly wanders even while in range
    if (--e.wanderTimer <= 0) {
      const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},{dx:0,dy:0}];
      const c = dirs[Math.floor(Math.random() * dirs.length)];
      e.wanderDx = c.dx; e.wanderDy = c.dy;
      e.wanderTimer = 90 + Math.floor(Math.random() * 120);
    }
    mx = e.wanderDx * TROLL_SPEED; my = e.wanderDy * TROLL_SPEED;
  }
  if (Math.abs(mx) >= Math.abs(my)) { if (mx > 0) e.direction='right'; else if (mx < 0) e.direction='left'; }
  else { if (my > 0) e.direction='down'; else if (my < 0) e.direction='up'; }
  moveEntityWithSlide(e, mx, my);
  if (e.attackAnimTimer > 0) {
    e.attackAnimTimer--;
    if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.attackFrame = (e.attackFrame + 1) % 4; }
    if (e.attackAnimTimer <= 0) e.state = 'wander';
  } else if (mx !== 0 || my !== 0) { if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex=(e.frameIndex+1)%4; } }
  else { e.frameIndex = 0; e.frameTick = 0; }
}

function mimicUseAbility(e, key) {
  const dmg = e.mimicDamage || 25;
  const faceDx = player.x - e.x;
  const faceDy = player.y - e.y;
  if (Math.abs(faceDx) >= Math.abs(faceDy)) e.direction = faceDx >= 0 ? 'right' : 'left';
  else e.direction = faceDy >= 0 ? 'down' : 'up';
  const cx = e.x + DISPLAY_SIZE / 2, cy = e.y + DISPLAY_SIZE / 2;
  if (key === 'r') {
    e.enraged = true;
    addMarker(cx, e.y - 14, 'ECHO R', '#bb66ff');
    return;
  }
  if (key === 'w') {
    const r = DISPLAY_SIZE * 2.0;
    if (Math.hypot((player.x + DISPLAY_SIZE/2) - cx, (player.y + DISPLAY_SIZE/2) - cy) < r) {
      const hit = damagePlayer(Math.round(dmg * 1.5), 15);
      addMarker(player.x + DISPLAY_SIZE/2, player.y, `-${hit}`, '#bb66ff');
      playsfx('damage');
    }
    e.spearEffect = 20;
    return;
  }
  if (key === 'e') {
    const r = DISPLAY_SIZE * 2.65;
    if (Math.hypot((player.x + DISPLAY_SIZE/2) - cx, (player.y + DISPLAY_SIZE/2) - cy) < r) {
      const hit = damagePlayer(Math.round(dmg * 2), 15);
      player.slowTimer = 90;
      addMarker(player.x + DISPLAY_SIZE/2, player.y, `-${hit}`, '#bb66ff');
      playsfx('damage');
    }
    addHazard('shadow', cx, cy, r * 0.55, 90, { slow: true, color: '#8e44ad' });
    return;
  }
  const hb = rectInFrontOf(e, DISPLAY_SIZE * 1.8, DISPLAY_SIZE * 1.35, DISPLAY_SIZE);
  if (rectsOverlap(hb.x, hb.y, hb.w, hb.h, player.x, player.y, DISPLAY_SIZE, DISPLAY_SIZE)) {
    const hit = damagePlayer(dmg, 15);
    addMarker(player.x + DISPLAY_SIZE/2, player.y, `-${hit}`, '#bb66ff');
    playsfx('damage');
  }
}

function startMimicCast(e, key, windup = 30) {
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  if (Math.abs(dx) >= Math.abs(dy)) e.direction = dx >= 0 ? 'right' : 'left';
  else e.direction = dy >= 0 ? 'down' : 'up';
  e.state = 'mimicCast';
  e.attackTimer = windup;
  e.attackFrame = 0;
  e.frameTick = 0;
  e.activeAbility = key || 'q';
  if (!e.mimicCooldowns) e.mimicCooldowns = { q: 0, w: 0, e: 0, r: 0 };
  e.mimicCooldowns[e.activeAbility] = mimicCooldownFrames(e.activeAbility);
  e.mimicGlobalCooldown = mimicCooldownFrames(e.activeAbility);
}

function mimicCastRange(key) {
  if (key === 'w') return DISPLAY_SIZE * 1.85;
  if (key === 'e') return DISPLAY_SIZE * 2.45;
  if (key === 'q') return DISPLAY_SIZE * 1.55;
  return DISPLAY_SIZE * 999;
}

function mimicCanCastAtDistance(key, dist) {
  return key === 'r' || dist <= mimicCastRange(key);
}

function mimicCooldownFrames(key) {
  const ab = abilities.find(a => a.key === key);
  return Math.max(20, Math.round(((ab && ab.cooldown) || 120) * 0.5));
}

function mimicCooldownReady(e, key) {
  return !e.mimicCooldowns || (e.mimicCooldowns[key] || 0) <= 0;
}

function tickMimicCooldowns(e) {
  if (!e.mimicCooldowns) e.mimicCooldowns = { q: 0, w: 0, e: 0, r: 0 };
  Object.keys(e.mimicCooldowns).forEach(key => {
    if (e.mimicCooldowns[key] > 0) e.mimicCooldowns[key]--;
  });
  if (e.state !== 'mimicCast' && e.mimicGlobalCooldown > 0) e.mimicGlobalCooldown--;
}

function updateMimic(e) {
  if (e.dying || e.hp <= 0) return;
  e.aliveFrames = (e.aliveFrames || 0) + 1;
  tickMimicCooldowns(e);
  if (e.hitFlash > 0) e.hitFlash--;
  if (e.slowTimer > 0) e.slowTimer--;
  const dx = player.x - e.x, dy = player.y - e.y, dist = Math.hypot(dx, dy);
  const skillKeys = (e.mimicSkills && e.mimicSkills.length ? e.mimicSkills : ['q']);
  if (!e.phaseTwo && e.hp <= e.maxHp * 0.5) {
    e.phaseTwo = true;
    e.enraged = true;
    addMarker(e.x + DISPLAY_SIZE / 2, e.y - 24, 'ADAPTED', '#bb66ff');
    const phaseKey = e.mimicOpener || skillKeys[0] || 'q';
    if ((e.mimicGlobalCooldown || 0) <= 0 && mimicCooldownReady(e, phaseKey) && mimicCanCastAtDistance(phaseKey, dist)) startMimicCast(e, phaseKey, 24);
    else e.forceSkillKey = phaseKey;
    return;
  }
  const speedFloor = Math.max(e.mimicSpeed || GOBLIN_SPEED, player.speed * 0.95);
  const spdBase = speedFloor * (e.enraged ? 1.15 : 1);
  const spd = e.slowTimer > 0 ? Math.max(1, spdBase * 0.5) : spdBase;

  if (!e.opened && e.aliveFrames > 10) {
    const opener = e.mimicOpener || 'q';
    if ((e.mimicGlobalCooldown || 0) <= 0 && mimicCooldownReady(e, opener) && mimicCanCastAtDistance(opener, dist)) {
      e.opened = true;
      startMimicCast(e, opener, 24);
      return;
    }
    e.forceSkillKey = opener;
  }
  if (e.echoTimer > 0 && --e.echoTimer <= 0 && e.echoKey) {
    if ((e.mimicGlobalCooldown || 0) <= 0 && mimicCooldownReady(e, e.echoKey) && mimicCanCastAtDistance(e.echoKey, dist)) {
      startMimicCast(e, e.echoKey, 24);
      e.echoKey = null;
      return;
    }
    e.forceSkillKey = e.echoKey;
    e.echoTimer = 8;
  }
  if (e.state === 'mimicCast') {
    const castDx = player.x - e.x;
    const castDy = player.y - e.y;
    const castDist = Math.hypot(castDx, castDy);
    if (Math.abs(castDx) >= Math.abs(castDy)) e.direction = castDx >= 0 ? 'right' : 'left';
    else e.direction = castDy >= 0 ? 'down' : 'up';
    if (!mimicCanCastAtDistance(e.activeAbility || 'q', castDist)) {
      const slide = chaseVec(castDx, castDy, spd * 0.45);
      moveEntityWithSlide(e, slide.mx, slide.my);
    }
    if (++e.frameTick >= Math.max(4, Math.floor(ATK_SPEED * 0.75))) {
      e.frameTick = 0;
      e.attackFrame = ((e.attackFrame || 0) + 1) % 4;
    }
    if (--e.attackTimer <= 0) {
      const impactDist = Math.hypot(player.x - e.x, player.y - e.y);
      if (!mimicCanCastAtDistance(e.activeAbility || 'q', impactDist)) {
        e.attackTimer = 6;
        return;
      }
      const usedKey = e.activeAbility || 'q';
      mimicUseAbility(e, usedKey);
      if (!e.mimicCooldowns) e.mimicCooldowns = { q: 0, w: 0, e: 0, r: 0 };
      e.mimicCooldowns[usedKey] = Math.max(e.mimicCooldowns[usedKey] || 0, mimicCooldownFrames(usedKey));
      e.mimicGlobalCooldown = Math.max(e.mimicGlobalCooldown || 0, mimicCooldownFrames(usedKey));
      e.state = 'cooldown';
      e.attackTimer = 20;
    }
    return;
  }
  if (e.state === 'cooldown') { if (--e.attackTimer <= 0) e.state = 'chase'; }

  let mx = 0, my = 0;
  const pendingKey = e.forceSkillKey || null;
  if ((e.mimicGlobalCooldown || 0) <= 0 && (pendingKey || skillKeys.some(key => mimicCooldownReady(e, key))) && e.state !== 'cooldown') {
    let key = pendingKey;
    if (!key) {
      const readyKeys = skillKeys.filter(k => mimicCooldownReady(e, k));
      e.mimicSkillCursor = (e.mimicSkillCursor || 0) % readyKeys.length;
      key = readyKeys[e.mimicSkillCursor];
      e.mimicSkillCursor = (e.mimicSkillCursor + 1) % readyKeys.length;
    }
    if (key && mimicCooldownReady(e, key) && mimicCanCastAtDistance(key, dist)) {
      e.forceSkillKey = null;
      if (e.echoKey === key) e.echoKey = null;
      startMimicCast(e, key, key === 'r' ? 24 : 26);
      if (!e.opened && key === e.mimicOpener) e.opened = true;
      return;
    }
    if (key && mimicCooldownReady(e, key)) e.forceSkillKey = key;
  }
  if (dist < DISPLAY_SIZE * 1.2 && e.state !== 'cooldown' && (e.mimicGlobalCooldown || 0) <= 0 && mimicCooldownReady(e, 'q')) {
    startMimicCast(e, 'q', 18);
    return;
  }
  const cv = chaseVec(dx, dy, spd);
  mx = cv.mx; my = cv.my;
  e.state = 'chase';
  if (Math.abs(mx) >= Math.abs(my)) { if (mx > 0) e.direction='right'; else if (mx < 0) e.direction='left'; }
  else { if (my > 0) e.direction='down'; else if (my < 0) e.direction='up'; }
  moveEntityWithSlide(e, mx, my);
  if (mx !== 0 || my !== 0) { if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex=(e.frameIndex+1)%4; } }
  else { e.frameIndex = 0; e.frameTick = 0; }
}

function tribunalAllies(e) {
  return enemies.filter(o =>
    o !== e &&
    (o.type === 'trib_sentinel' || o.type === 'trib_warden' || o.type === 'trib_priest') &&
    !o.dying && !o.deathDone && o.hp > 0
  );
}

function updateTribunalPriest(e) {
  e.aliveFrames = (e.aliveFrames || 0) + 1;
  if (e.hitFlash > 0) e.hitFlash--;
  if (e.slowTimer > 0) e.slowTimer--;
  if (e.spearEffect > 0) e.spearEffect--;

  if (--e.attackTimer <= 0) {
    const wounded = tribunalAllies(e)
      .concat(e)
      .filter(o => o.hp > 0 && o.hp < o.maxHp)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    if (wounded) {
      const heal = Math.min(TRIB_PRIEST_HEAL, wounded.maxHp - wounded.hp);
      wounded.hp += heal;
      addMarker(wounded.x + enemyHitbox(wounded).w / 2, wounded.y - 18, `+${heal}`, '#76ff9b');
      e.spearEffect = 35;
    }
    e.attackTimer = TRIB_PRIEST_HEAL_CD;
  }

  const dx = player.x - e.x, dy = player.y - e.y, dist = Math.hypot(dx, dy) || 1;
  let mx = 0, my = 0;
  const spd = Math.max(1, Math.round(DISPLAY_SIZE / 58));
  if (dist < DISPLAY_SIZE * 3.2) {
    mx = (-dx / dist) * spd;
    my = (-dy / dist) * spd;
  } else {
    const allies = tribunalAllies(e);
    const sentinel = allies.find(o => o.type === 'trib_sentinel') || allies[0];
    if (sentinel) {
      const tx = sentinel.x + DISPLAY_SIZE * 0.8;
      const ty = sentinel.y - DISPLAY_SIZE * 0.7;
      const cv = chaseVec(tx - e.x, ty - e.y, spd * 0.7);
      mx = cv.mx; my = cv.my;
    }
  }
  if (Math.abs(mx) >= Math.abs(my)) { if (mx > 0) e.direction='right'; else if (mx < 0) e.direction='left'; }
  else { if (my > 0) e.direction='down'; else if (my < 0) e.direction='up'; }
  moveEntityWithSlide(e, mx, my);
  if (mx !== 0 || my !== 0) { if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex=(e.frameIndex+1)%4; } }
}

function updateTribunalSentinel(e) {
  e.aliveFrames = (e.aliveFrames || 0) + 1;
  if (e.hitFlash > 0) e.hitFlash--;
  if (e.slowTimer > 0) e.slowTimer--;
  if (e.blockTimer > 0) e.blockTimer--;
  const dx = player.x - e.x, dy = player.y - e.y, dist = Math.hypot(dx, dy);
  const spd = Math.max(1, Math.round(DISPLAY_SIZE / 60));

  if (e.state === 'attacking') {
    if (--e.attackTimer <= 0) {
      const cleave = rectInFrontOf(e, DISPLAY_SIZE * 2.25, TRIB_SENTINEL_SIZE * 1.1, TRIB_SENTINEL_SIZE);
      if (rectsOverlap(cleave.x, cleave.y, cleave.w, cleave.h, player.x, player.y, DISPLAY_SIZE, DISPLAY_SIZE)) {
        const hit = damagePlayer(95, 22);
        addMarker(player.x + DISPLAY_SIZE / 2, player.y, `-${hit}`, '#d6d6d6');
        playsfx('damage');
      }
      playsfx('slam');
      e.state = 'cooldown';
      e.attackTimer = 80;
    }
    return;
  }
  if (e.state === 'cooldown') { if (--e.attackTimer <= 0) e.state = 'chase'; return; }
  if (dist < DISPLAY_SIZE * 2.0) {
    e.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    e.state = 'attacking';
    e.attackTimer = TRIB_SENTINEL_WINDUP;
    return;
  }
  const cv = chaseVec(dx, dy, e.slowTimer > 0 ? spd * 0.5 : spd);
  if (Math.abs(cv.mx) >= Math.abs(cv.my)) { if (cv.mx > 0) e.direction='right'; else if (cv.mx < 0) e.direction='left'; }
  else { if (cv.my > 0) e.direction='down'; else if (cv.my < 0) e.direction='up'; }
  moveEntityWithSlide(e, cv.mx, cv.my);
  if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex=(e.frameIndex+1)%4; }
}

function updateTribunalWarden(e) {
  e.aliveFrames = (e.aliveFrames || 0) + 1;
  if (e.hitFlash > 0) e.hitFlash--;
  if (e.slowTimer > 0) e.slowTimer--;
  const dx = player.x - e.x, dy = player.y - e.y, dist = Math.hypot(dx, dy);
  const spd = Math.max(3, Math.round(DISPLAY_SIZE / 32));

  if (e.state === 'attacking') {
    if (--e.attackTimer <= 0) {
      const hitLine = rectInFrontOf(e, DISPLAY_SIZE * 3.0, DISPLAY_SIZE * 0.75, TRIB_WARDEN_SIZE);
      if (rectsOverlap(hitLine.x, hitLine.y, hitLine.w, hitLine.h, player.x, player.y, DISPLAY_SIZE, DISPLAY_SIZE)) {
        const hit = damagePlayer(42, 16);
        player.slowTimer = Math.max(player.slowTimer || 0, 80);
        addMarker(player.x + DISPLAY_SIZE / 2, player.y, `-${hit} SNARED`, '#8ecbff');
        playsfx('damage');
      }
      e.state = 'cooldown';
      e.attackTimer = 70;
    }
    return;
  }
  if (e.state === 'cooldown') { if (--e.attackTimer <= 0) e.state = 'chase'; return; }
  if (dist < DISPLAY_SIZE * 3.1) {
    e.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    e.state = 'attacking';
    e.attackTimer = TRIB_WARDEN_WINDUP;
    return;
  }
  const cv = chaseVec(dx, dy, e.slowTimer > 0 ? spd * 0.5 : spd);
  if (Math.abs(cv.mx) >= Math.abs(cv.my)) { if (cv.mx > 0) e.direction='right'; else if (cv.mx < 0) e.direction='left'; }
  else { if (cv.my > 0) e.direction='down'; else if (cv.my < 0) e.direction='up'; }
  moveEntityWithSlide(e, cv.mx, cv.my);
  if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex=(e.frameIndex+1)%4; }
}

function updateAbomination(e) {
  if (e.dying || e.hp <= 0) return;
  e.aliveFrames++;
  if (e.hitFlash > 0)      e.hitFlash--;
  if (e.slowTimer > 0)     e.slowTimer--;
  if (e.feedSpeedTimer > 0) e.feedSpeedTimer--;
  if (e.fedPulse > 0)      e.fedPulse--;
  if (e.devourCooldown > 0) e.devourCooldown--;

  // Devour nearby ghoul corpses — heals equal to ghoul max HP, once every 2s
  if (e.devourCooldown <= 0) {
    const abomCx = e.x + ABOM_SIZE / 2, abomCy = e.y + ABOM_SIZE / 2;
    const GSIZE = Math.round(DISPLAY_SIZE * 0.8);
    const corpse = enemies.find(g =>
      g.type === 'ghoul' && g.deathDone && g.corpseTimer > 0 &&
      Math.hypot((g.x + GSIZE/2) - abomCx, (g.y + GSIZE/2) - abomCy) < ABOM_DEVOUR_RANGE
    );
    if (corpse) {
      const hpGain = Math.min(corpse.maxHp, ABOM_HP_CAP - e.hp);
      e.hp += hpGain;
      if (e.hp > e.maxHp) e.maxHp = e.hp;
      corpse.corpseTimer = 0; // consumed — removed next tick
      e.fedPulse = 30;
      e.devourCooldown = ABOM_DEVOUR_CD;
      addMarker(e.x + ABOM_SIZE / 2, e.y - 16, `DEVOURED +${hpGain}`, '#55dd33');
    }
  }

  const spd = e.feedSpeedTimer > 0
    ? ABOM_SPEED * 1.7  // brief lunge after eating a ghoul
    : e.slowTimer > 0 ? Math.max(1, ABOM_SPEED * 0.5) : ABOM_SPEED;

  const dx = (player.x + DISPLAY_SIZE / 2) - (e.x + ABOM_SIZE / 2);
  const dy = (player.y + DISPLAY_SIZE / 2) - (e.y + ABOM_SIZE / 2);
  const dist = Math.hypot(dx, dy);

  if (e.state === 'attacking') {
    if (--e.attackTimer <= 0) {
      if (dist < ABOM_ATK_RANGE + ABOM_SIZE * 0.5) {
        const base = player.berserkTimer > 0 ? Math.round(ABOM_DAMAGE * 1.5) : ABOM_DAMAGE;
        const dmg = damagePlayer(base, 18);
        if (dmg > 0) { addMarker(player.x + DISPLAY_SIZE / 2, player.y, `-${dmg}`, '#55dd33'); playsfx('damage'); }
      }
      e.state = 'cooldown';
      e.attackTimer = ABOM_ATK_CD;
    }
    return;
  }
  if (e.state === 'cooldown') {
    if (--e.attackTimer <= 0) e.state = 'chase';
  }
  if (dist < ABOM_ATK_RANGE + ABOM_SIZE * 0.35 && e.state !== 'cooldown') {
    e.state = 'attacking';
    e.attackTimer = ABOM_WINDUP;
    e.frameIndex = 0; e.frameTick = 0;
    return;
  }

  // Relentless chase — never wanders, always hunts
  e.state = 'chase';
  const cv = chaseVec(dx, dy, spd);
  if (Math.abs(cv.mx) >= Math.abs(cv.my)) {
    if (cv.mx > 0) e.direction = 'right'; else if (cv.mx < 0) e.direction = 'left';
  } else {
    if (cv.my > 0) e.direction = 'down'; else if (cv.my < 0) e.direction = 'up';
  }
  moveEntityWithSlide(e, cv.mx, cv.my);
  if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex = (e.frameIndex + 1) % 4; }
}

function updateEnemy(e) {
  if (e.dying || e.deathDone) return; // handled in death ticker
  if (e.spawnWarning > 0) {
    e.spawnWarning--;
    return;
  }
  if (tickEnemyControlStatus(e)) return;
  // Abomination ignores windwalk — it hunts by more than sight
  if (e.type === 'abomination') return updateAbomination(e);
  if (player.windwalkActive && e.hp > 0) {
    // Enemies wander aimlessly while player is invisible
    if (e.hitFlash > 0) e.hitFlash--;
    e.wanderDx = e.wanderDx || 0;
    e.wanderDy = e.wanderDy || 0;
    e.wanderTimer = e.wanderTimer || 0;
    if (--e.wanderTimer <= 0) {
      const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},{dx:0,dy:0}];
      const c = dirs[Math.floor(Math.random() * dirs.length)];
      e.wanderDx = c.dx; e.wanderDy = c.dy;
      e.wanderTimer = 60 + Math.floor(Math.random() * 90);
    }
    const mx = e.wanderDx, my = e.wanderDy;
    moveEntityWithSlide(e, mx, my);
    if (Math.abs(mx) >= Math.abs(my)) { if (mx > 0) e.direction='right'; else if (mx < 0) e.direction='left'; }
    else { if (my > 0) e.direction='down'; else if (my < 0) e.direction='up'; }
    if (mx !== 0 || my !== 0) { if (++e.frameTick >= FRAME_SPEED) { e.frameTick = 0; e.frameIndex=(e.frameIndex+1)%4; } }
    else { e.frameIndex = 0; e.frameTick = 0; }
    return;
  }
  if (e.type === 'golem')    return updateGolem(e);
  if (e.type === 'goblin')   return updateGoblin(e);
  if (e.type === 'minotaur') return updateMinotaur(e);
  if (e.type === 'archer')   return updateArcher(e);
  if (e.type === 'skeletal_champion') return updateSkeletalChampion(e);
  if (e.type === 'orc')      return updateOrc(e);
  if (e.type === 'ghoul')    return updateSimpleMelee(e, GHOUL_HP, GHOUL_DAMAGE, GHOUL_SPEED, GHOUL_ATK_RANGE, GHOUL_ATK_CD, GHOUL_CHASE);
  if (e.type === 'guardian') return updateGuardian(e);
  if (e.type === 'troll')    return updateTroll(e);
  if (e.type === 'mimic')    return updateMimic(e);
  if (e.type === 'trib_sentinel') return updateTribunalSentinel(e);
  if (e.type === 'trib_warden')   return updateTribunalWarden(e);
  if (e.type === 'trib_priest')   return updateTribunalPriest(e);
  if (e.dying || e.hp <= 0) return;
  e.aliveFrames = (e.aliveFrames || 0) + 1;
  if (e.hitFlash > 0) e.hitFlash--;
  if (e.slowTimer > 0) e.slowTimer--;

  if (e.state === 'attacking') {
    e.atkFrameTick++;
    if (e.atkFrameTick >= ATK_SPEED) {
      e.atkFrameTick = 0;
      e.attackFrame++;
      const atk = JP_ATKS[e.currentAttack];
      if (e.attackFrame >= atk.frames.length) {
        if (Math.hypot(player.x - e.x, player.y - e.y) < ATTACK_RANGE + 40) {
          const base = player.berserkTimer > 0 ? Math.round(atk.damage * 1.5) : atk.damage;
          const dmg = damagePlayer(base, 15);
          addMarker(player.x + DISPLAY_SIZE / 2, player.y, `-${dmg}`, '#ff8800');
          playsfx('damage');
        }
        e.attackFrame = 0;
        e.state = 'cooldown';
        e.attackTimer = ATK_COOLDOWN;
      }
    }
    return;
  }

  if (e.state === 'cooldown') {
    if (--e.attackTimer <= 0) e.state = 'chase';
  }

  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);
  let moveDx = 0, moveDy = 0;

  if (dist < ATTACK_RANGE && e.state !== 'cooldown') {
    e.state = 'attacking';
    e.currentAttack = Math.floor(Math.random() * JP_ATKS.length);
    e.attackFrame = 0; e.atkFrameTick = 0;
    return;
  } else if (dist < CHASE_RANGE) {
    if (e.state !== 'cooldown') e.state = 'chase';
    const jpSpeed = e.slowTimer > 0 ? Math.max(1, ENEMY_SPEED * 0.5) : ENEMY_SPEED;
    const cv = chaseVec(dx, dy, jpSpeed);
    moveDx = cv.mx; moveDy = cv.my;
  } else {
    if (e.state !== 'cooldown') e.state = 'wander';
    if (--e.wanderTimer <= 0) {
      const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},{dx:0,dy:0}];
      const c = dirs[Math.floor(Math.random() * dirs.length)];
      e.wanderDx = c.dx; e.wanderDy = c.dy;
      e.wanderTimer = 60 + Math.floor(Math.random() * 120);
    }
    const jpSpeed = e.slowTimer > 0 ? Math.max(1, ENEMY_SPEED * 0.5) : ENEMY_SPEED;
    moveDx = e.wanderDx * jpSpeed;
    moveDy = e.wanderDy * jpSpeed;
  }

  if (Math.abs(moveDx) >= Math.abs(moveDy)) {
    if (moveDx > 0) e.direction = 'right';
    else if (moveDx < 0) e.direction = 'left';
  } else {
    if (moveDy > 0) e.direction = 'down';
    else if (moveDy < 0) e.direction = 'up';
  }

  moveEntityWithSlide(e, moveDx, moveDy);

  const moving = moveDx !== 0 || moveDy !== 0;
  if (moving) {
    if (++e.frameTick >= FRAME_SPEED) {
      e.frameTick = 0;
      e.frameIndex = (e.frameIndex + 1) % 4;
    }
  } else {
    e.frameIndex = 0; e.frameTick = 0;
  }
}

function restartCurrentStageSoftcore() {
  player.exp = 0;
  player.hp = player.maxHp;
  player.state = 'idle';
  player.activeAbility = null;
  player.dying = false;
  player.deathFrame = 0;
  player.deathTick = 0;
  player.deathTimer = 0;
  player.hitFlash = 0;
  player.slowTimer = 0;
  player.berserkTimer = 0;
  player.berserkCasting = false;
  player.sliceDiceTimer = 0;
  player.windwalkActive = false;
  player.windwalkTimer = 0;
  player.windwalkDmg = 0;
  player.windwalkEntering = false;
  player.windwalkExiting = false;
  player.speed = player.baseSpeed;
  player.mageBlinkPhase = null;
  player.blinkChargeAvailable = false;
  Object.keys(keys).forEach(k => { keys[k] = false; });
  spawnStage(stage);
  addMarker(player.x + DISPLAY_SIZE / 2, player.y - 16, 'SOFTCORE RETRY', '#ffd700');
  gameState = 'playing';
}

function update() {
  updatePlayer();
  enemies.forEach(updateEnemy);
  updateProjectiles();
  updateSpellEffects();
  updateHazards();
  updateTelegraphs();
  abilities.forEach(ab => { if (ab.timer > 0) ab.timer = Math.max(0, ab.timer - (player.cooldownRegenMult || 1)); });
  // Slice and dice: extra cooldown tick for double recharge rate
  if (player.sliceDiceTimer > 0) {
    player.sliceDiceTimer--;
  }
  if (player.enlightenShieldCD > 0) player.enlightenShieldCD--;
  if (player.assassinProcCD > 0) {
    player.assassinProcCD--;
  } else if (player.assassinTalent || (player.pendants && player.pendants.some(p => p.name === 'the Assassin'))) {
    player.assassinProc = true;
  }
  for (let i = markers.length - 1; i >= 0; i--) {
    if (--markers[i].life <= 0) markers.splice(i, 1);
  }
  if (player.hp <= 0) {
    if (!player.dying) {
      player.dying = true;
      player.deathFrame = 0; player.deathTick = 0; player.deathTimer = 0;
      if (player.className === 'Barbarian')     playsfx('barbarianDeath');
      else if (player.className === 'Rogue')    playsfx('rogueDeath');
      else if (player.className === 'Mage')     playsfx('mageDeath');
    }
    if (++player.deathTick >= FRAME_SPEED) {
      player.deathTick = 0;
      const deathFrames = player.className === 'Barbarian' ? BARB_DEATH_FRAMES : 4;
      if (player.deathFrame < deathFrames - 1) {
        player.deathFrame++;
      } else if (++player.deathTimer >= 12) {
        if (gameMode === 'softcore') {
          restartCurrentStageSoftcore();
          return;
        }
        gameState = 'gameover';
        return;
      }
    }
  }
  // Advance death animations then hold corpse on screen
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.deathDone) {
      if (e.corpseTimer > 0) { e.corpseTimer--; }
      else { enemies.splice(i, 1); }
      continue;
    }
    if (!e.dying) continue;
    if (++e.deathTick >= FRAME_SPEED) {
      e.deathTick = 0;
      e.deathFrame++;
      if (e.deathFrame >= 4) {
        e.deathFrame = 3; // freeze on last frame
        e.dying = false;
        e.deathDone = true;
      }
    }
  }
  // Ghoul pit waves: next side wave spawns only after every ghoul is gone.
  if (stage === 7 && ghoulWaveIndex < GHOUL_WAVES.length - 1) {
    const ghoulsRemaining = enemies.some(e => e.type === 'ghoul' && e.hp > 0);
    if (!ghoulsRemaining) {
      ghoulWaveIndex++;
      spawnGhoulWave(ghoulWaveIndex);
    }
  }

  // Door opens / stage ends once all enemies are at least dying
  const stageCombatDone = enemies.length === 0 || enemies.every(e => e.dying || e.deathDone);
  const waitingForGhoulWave = stage === 7 && ghoulWaveIndex < GHOUL_WAVES.length - 1;
  if (stageCombatDone && !waitingForGhoulWave) {
    if (!doorOpen && stage < 11) doorOpen = true;
    if (stage >= 11) { gameState = 'win'; return; }
  }
}

// ── Draw ──────────────────────────────────────────────────────────────────────

function applyHitFlash(hitFlash) {
  if (hitFlash > 0 && Math.floor(hitFlash / 3) % 2 === 0)
    ctx.filter = 'brightness(8) saturate(0)';
}

function drawFlipped(sheet, sx, sy, sw, sh, dx, dy, dw, dh) {
  ctx.save();
  ctx.translate(dx + dw, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(sheet, sx, sy, sw, sh, 0, dy, dw, dh);
  ctx.restore();
}

function drawMap() {
  const stageBg = stageBgImgs[stage];
  if (stageBg) {
    const bgRect = getStageBgRect(stage);
    ctx.drawImage(stageBg, bgRect.x, bgRect.y, bgRect.w, bgRect.h);
    drawDoor();
    return;
  }

  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      // Door tiles are drawn separately
      if (r === 0 && c >= DOOR_COL && c < DOOR_COL + 3) continue;
      const x = c * TILE_SIZE, y = r * TILE_SIZE;
      if (map[r][c] === WALL) {
        ctx.fillStyle = '#0a0f1e';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#1a2040';
        ctx.fillRect(x, y, TILE_SIZE, 3);
      } else {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#16213e' : '#19253f';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }
  }
  drawDoor();
}

function drawDoor() {
  const hasStageDoorArt = Boolean(stageBgImgs[stage]);
  const stageDoorRect = getStageDoorRect(stage);
  const dx   = stageDoorRect ? stageDoorRect.x : DOOR_COL * TILE_SIZE;
  const dy   = stageDoorRect ? stageDoorRect.y : 0;
  const dw   = stageDoorRect ? stageDoorRect.w : 3 * TILE_SIZE;
  const dh   = stageDoorRect ? stageDoorRect.h : Math.round(TILE_SIZE * 2.5);
  const cx   = dx + dw / 2;
  const pilW = Math.round(TILE_SIZE * 0.35);  // stone pillar width each side

  if (doorOpen) {
    if (hasStageDoorArt) {
      const pulse = 0.65 + Math.sin(Date.now() / 240) * 0.18;
      ctx.save();
      ctx.shadowColor = '#ffd86b';
      ctx.shadowBlur = 20;
      const grad = ctx.createLinearGradient(dx, dy, dx, dy + dh);
      grad.addColorStop(0, `rgba(255,230,130,${0.45 * pulse})`);
      grad.addColorStop(0.6, `rgba(255,185,55,${0.22 * pulse})`);
      grad.addColorStop(1, 'rgba(255,160,0,0.03)');
      ctx.fillStyle = grad;
      ctx.fillRect(dx + dw * 0.18, dy + dh * 0.12, dw * 0.64, dh * 0.82);
      ctx.strokeStyle = `rgba(255,220,110,${0.9 * pulse})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(dx + dw * 0.16, dy + dh * 0.1, dw * 0.68, dh * 0.84);
      ctx.fillStyle = `rgba(255,220,110,${0.95 * pulse})`;
      ctx.font = `bold ${Math.round(TILE_SIZE * 0.42)}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('EXIT', cx, dy + dh + Math.round(TILE_SIZE * 0.45));
      ctx.restore();
      ctx.textAlign = 'left';
      return;
    }

    // ── Open door: golden glowing arch ────────────────────────────────────────
    // Background glow
    ctx.save();
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur  = 28;

    const grad = ctx.createLinearGradient(dx, dy, dx, dy + dh);
    grad.addColorStop(0, 'rgba(255,230,80,0.85)');
    grad.addColorStop(0.5,'rgba(255,200,50,0.4)');
    grad.addColorStop(1, 'rgba(255,160,0,0.05)');
    ctx.fillStyle = grad;
    ctx.fillRect(dx + pilW, dy, dw - pilW * 2, dh);

    // Stone pillars
    ctx.fillStyle = '#2a3560';
    ctx.fillRect(dx, dy, pilW, dh);
    ctx.fillRect(dx + dw - pilW, dy, pilW, dh);

    // Pillar highlight edge
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(dx + pilW - 2, dy, 2, dh);
    ctx.fillRect(dx + dw - pilW, dy, 2, dh);

    ctx.restore();

    // "EXIT" label inside arch
    ctx.save();
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(TILE_SIZE * 0.45)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', cx, dy + Math.round(TILE_SIZE * 0.7));
    ctx.restore();

    // Bouncing arrow below the door opening
    const bounce = Math.round(Math.sin(Date.now() / 280) * 5);
    ctx.save();
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffd700';
    ctx.font = `bold ${Math.round(TILE_SIZE * 0.55)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('▲', cx, dy + dh + Math.round(TILE_SIZE * 0.55) + bounce);
    ctx.restore();
    ctx.textAlign = 'left';

  } else {
    // ── Closed door: stone arch with wooden panels ─────────────────────────────
    if (hasStageDoorArt) {
      const alive = enemies.filter(e => e.hp > 0).length;
      if (alive > 0) {
        ctx.save();
        ctx.shadowColor = '#e74c3c'; ctx.shadowBlur = 12;
        ctx.fillStyle = '#e74c3c';
        ctx.font = `${Math.round(TILE_SIZE * 0.38)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(`${alive} remain`, cx, dy + dh + Math.round(TILE_SIZE * 0.5));
        ctx.restore();
        ctx.textAlign = 'left';
      }
      return;
    }

    // Stone surround
    ctx.fillStyle = '#0d1225';
    ctx.fillRect(dx, dy, dw, dh);

    // Stone pillar detail
    ctx.fillStyle = '#1a2040';
    ctx.fillRect(dx, dy, pilW, dh);
    ctx.fillRect(dx + dw - pilW, dy, pilW, dh);
    ctx.fillStyle = '#141832';
    ctx.fillRect(dx, dy, pilW, 3);
    ctx.fillRect(dx + dw - pilW, dy, pilW, 3);

    // Arch top bar
    ctx.fillStyle = '#1a2040';
    ctx.fillRect(dx + pilW, dy, dw - pilW * 2, Math.round(TILE_SIZE * 0.25));

    // Left door panel
    const panelX  = dx + pilW + 2;
    const panelY  = dy + Math.round(TILE_SIZE * 0.25);
    const panelW2 = Math.floor((dw - pilW * 2 - 6) / 2);
    const panelH  = dh - Math.round(TILE_SIZE * 0.25);
    ctx.fillStyle = '#3d2b1f';
    ctx.fillRect(panelX, panelY, panelW2, panelH);
    ctx.fillRect(panelX + panelW2 + 2, panelY, panelW2, panelH);

    // Panel inset lines
    ctx.strokeStyle = '#5c3d2e';
    ctx.lineWidth = 1;
    const inset = 4;
    ctx.strokeRect(panelX + inset, panelY + inset, panelW2 - inset*2, panelH - inset*2);
    ctx.strokeRect(panelX + panelW2 + 2 + inset, panelY + inset, panelW2 - inset*2, panelH - inset*2);

    // Central lock
    const lx = cx - 4, ly = panelY + Math.round(panelH * 0.45);
    ctx.fillStyle = '#c0a030';
    ctx.fillRect(lx, ly, 8, 6);          // lock body
    ctx.strokeStyle = '#c0a030';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, ly, 4, Math.PI, 0);  // lock shackle arc
    ctx.stroke();

    // Red "LOCKED" glow
    ctx.save();
    ctx.shadowColor = '#e74c3c'; ctx.shadowBlur = 14;
    ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2;
    ctx.strokeRect(dx + pilW, dy, dw - pilW * 2, dh);
    ctx.restore();

    // Monster count hint below door
    const alive = enemies.filter(e => e.hp > 0).length;
    if (alive > 0) {
      ctx.fillStyle = '#e74c3c';
      ctx.font = `${Math.round(TILE_SIZE * 0.38)}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(`${alive} remain`, cx, dy + dh + Math.round(TILE_SIZE * 0.5));
      ctx.textAlign = 'left';
    }
  }
}

function drawHazards() {
  hazards.forEach(h => {
    const alpha = Math.max(0.12, Math.min(0.55, h.life / h.maxLife));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = h.type === 'rubble' ? 'rgba(95,80,65,0.75)' : h.type === 'shadow' ? 'rgba(100,40,150,0.45)' : 'rgba(170,90,25,0.45)';
    ctx.strokeStyle = h.color || '#cc8844';
    ctx.lineWidth = h.block ? 3 : 2;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
}

function drawAttackRange() {
  if (player.state !== 'attacking') return;
  const ab = player.activeAbility;
  const enlarged = player.avatarActive;
  const ds  = enlarged ? DISPLAY_SIZE * 2 : DISPLAY_SIZE;
  const offX = enlarged ? -DISPLAY_SIZE / 2 : 0;
  const offY = enlarged ? -DISPLAY_SIZE / 2 : 0;
  const cx  = player.x + offX + ds / 2;
  const cy  = player.y + offY + ds / 2;

  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 2;

  const isBarbAoE = player.className === 'Barbarian' && (ab === 'w' || ab === 'e');
  const isMageAoE = player.className === 'Mage' && ab === 'e';
  const isRogueUlt = player.className === 'Rogue' && ab === 'r';

  if (isBarbAoE) {
    const r = ab === 'w'
      ? DISPLAY_SIZE * 1.6 * (enlarged ? 1.5 : 1) * (player.mightBonus ? 1.25 : 1)
      : DISPLAY_SIZE * 2.2 * (enlarged ? 1.5 : 1) * (player.mightBonus ? 1.25 : 1);
    ctx.strokeStyle = ab === 'w' ? 'rgba(230, 126, 34, 0.7)' : 'rgba(241, 196, 15, 0.7)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  } else if (isMageAoE) {
    const r = DISPLAY_SIZE * 2.4 * 1.2 * (player.mightBonus ? 1.25 : 1);
    ctx.strokeStyle = 'rgba(26, 188, 156, 0.7)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  } else if (isRogueUlt) {
    ctx.strokeStyle = 'rgba(22, 160, 133, 0.8)';
    ctx.beginPath(); ctx.arc(cx, cy, ROGUE_SLICE_DICE_RADIUS, 0, Math.PI * 2); ctx.stroke();
  } else {
    const hb = getHitbox();
    if (hb) {
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.65)';
      ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
    }
  }

  ctx.setLineDash([]);
  ctx.restore();
}

function drawPlayerEffects(drawX, drawY, dsize) {
  if (player.berserkTimer > 0 && Math.floor(player.berserkTimer / 4) % 2 === 0) {
    ctx.save();
    ctx.shadowColor = '#cc00ff'; ctx.shadowBlur = 22;
    ctx.strokeStyle = '#cc00ff'; ctx.lineWidth = 3;
    ctx.strokeRect(drawX + 2, drawY + 2, dsize - 4, dsize - 4);
    ctx.restore();
  }
  if (player.avatarActive) {
    ctx.save();
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 16;
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4;
    ctx.strokeRect(drawX, drawY, dsize, dsize);
    ctx.restore();
  }
  if (player.slowTimer > 0) {
    ctx.save();
    const pulse = 0.55 + 0.25 * Math.sin(player.slowTimer / 5);
    const footY = drawY + dsize * 0.82;
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#2f3742';
    ctx.lineWidth = Math.max(2, Math.round(dsize * 0.04));
    ctx.beginPath();
    ctx.ellipse(drawX + dsize * 0.5, footY, dsize * 0.42, dsize * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#a7aeb8';
    ctx.lineWidth = Math.max(1, Math.round(dsize * 0.025));
    for (let i = 0; i < 4; i++) {
      const x = drawX + dsize * (0.25 + i * 0.16);
      ctx.beginPath();
      ctx.arc(x, footY, dsize * 0.07, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (player.sliceDiceTimer > 0 && Math.floor(player.sliceDiceTimer / 4) % 2 === 0) {
    ctx.save();
    ctx.shadowColor = '#16a085'; ctx.shadowBlur = 18;
    ctx.strokeStyle = '#16a085'; ctx.lineWidth = 2;
    ctx.strokeRect(drawX + 1, drawY + 1, dsize - 2, dsize - 2);
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(drawX + dsize / 2, drawY + dsize / 2, ROGUE_SLICE_DICE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawRogue() {
  const dsize = DISPLAY_SIZE;
  const drawX = player.x, drawY = player.y;
  if (player.dying) {
    drawMonSprite(rogueDeathSheet, Math.min(player.deathFrame, 3), 0, drawX, drawY, dsize, dsize);
    return;
  }
  drawAttackRange();
  applyHitFlash(player.hitFlash);

  let sheet = rogueRunSheet;
  let col   = player.frameIndex % 4;
  let row   = dirToRow(player.direction);

  if (player.windwalkEntering) {
    sheet = rogueWindwalkSheet;
    col   = player.windwalkEnterFrame % 4;
    row   = 0;
  } else if (player.windwalkExiting) {
    sheet = rogueWindwalkSheet;
    col   = player.windwalkExitFrame % 4;
    row   = 0;
  } else if (player.state === 'attacking') {
    const ab = player.activeAbility;
    col = player.attackFrame % 4;
    if      (ab === 'w') sheet = rogueThrowSheet;
    else if (ab === 'e') { sheet = rogueWindwalkSheet; row = 0; }
    else if (ab === 'r') sheet = rogueSliceDiceSheet;
    else                 sheet = rogueAtkSheet;
  }

  drawMonSprite(sheet || rogueRunSheet, col, row, drawX, drawY, dsize, dsize);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  drawPlayerEffects(drawX, drawY, dsize);
}

function drawBarbarianDeath() {
  if (!barbDeathSheet) {
    drawMonSprite(barbWalkSheet, 0, dirToRow(player.direction), player.x, player.y, DISPLAY_SIZE, DISPLAY_SIZE);
    return;
  }
  const frame = Math.min(player.deathFrame, BARB_DEATH_FRAMES - 1);
  const col = frame;
  const row = 0;
  const dsize = Math.round(DISPLAY_SIZE * 1.3);
  const off = Math.round((dsize - DISPLAY_SIZE) / 2);
  ctx.drawImage(
    barbDeathSheet,
    SLAM_XS[col], row * SLAM_FH, SLAM_FW, SLAM_FH,
    player.x - off, player.y - off, dsize, dsize
  );
}

function drawMage() {
  const dsize = DISPLAY_SIZE;
  const drawX = player.x, drawY = player.y;
  const row = dirToRow(player.direction);
  let sheet = mageRunSheet;
  let col = player.frameIndex % 4;

  if (player.dying) {
    drawMonSprite(mageDeathSheet || mageRunSheet, Math.min(player.deathFrame, 3), row, drawX, drawY, dsize, dsize);
    return;
  }

  drawAttackRange();
  applyHitFlash(player.hitFlash);

  if (player.mageBlinkPhase) {
    const frame = Math.max(0, Math.min(3, player.mageBlinkFrame));
    drawMonSprite(mageBlinkSheet || mageRunSheet, frame, row, drawX, drawY, dsize, dsize);
    ctx.filter = 'none';
    drawPlayerEffects(drawX, drawY, dsize);
    return;
  }

  if (player.state === 'attacking') {
    const ab = player.activeAbility;
    col = player.attackFrame % 4;
    if (ab === 'w') {
      sheet = mageFireballCastSheet || mageAtkSheet || mageRunSheet;
    } else if (ab === 'e') {
      const fxSize = Math.round(DISPLAY_SIZE * 3.24);
      const fxOff = Math.round((fxSize - dsize) / 2);
      if (mageFrostNovaSheet) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        drawMonSprite(mageFrostNovaSheet, col, 2, drawX - fxOff, drawY - fxOff, fxSize, fxSize);
        ctx.restore();
      }
      sheet = mageFrostNovaSheet || mageAtkSheet || mageRunSheet;
      drawMonSprite(sheet || mageRunSheet, col, Math.min(1, row), drawX, drawY, dsize, dsize);
      ctx.filter = 'none';
      drawPlayerEffects(drawX, drawY, dsize);
      return;
    } else {
      sheet = mageAtkSheet || mageRunSheet;
      if (ab === 'q') {
        drawMonSpriteInset(sheet || mageRunSheet, col, row, drawX, drawY, dsize, dsize, 6);
        ctx.filter = 'none';
        drawPlayerEffects(drawX, drawY, dsize);
        return;
      }
    }
  }

  drawMonSprite(sheet || mageRunSheet, col, row, drawX, drawY, dsize, dsize);
  ctx.filter = 'none';
  drawPlayerEffects(drawX, drawY, dsize);
}

function drawPlayer() {
  if (player.className === 'Rogue') return drawRogue();
  if (player.className === 'Mage') return drawMage();

  if (player.dying) {
    if (player.className === 'Barbarian') {
      drawBarbarianDeath();
    } else {
      drawMonSprite(barbWalkSheet, 0, dirToRow(player.direction), player.x, player.y, DISPLAY_SIZE, DISPLAY_SIZE);
    }
    return;
  }

  const isBerserk = player.berserkTimer > 0;
  const enlarged = player.avatarActive;
  const dsize = enlarged ? DISPLAY_SIZE * 2 : DISPLAY_SIZE;
  const drawX = enlarged ? player.x - DISPLAY_SIZE / 2 : player.x;
  const drawY = enlarged ? player.y - DISPLAY_SIZE / 2 : player.y;

  drawAttackRange();
  drawPlayerEffects(drawX, drawY, dsize);
  applyHitFlash(player.hitFlash);

  if (player.className === 'Barbarian' && player.berserkCasting) {
    const frame = Math.min(player.berserkCastFrame, BARB_BERSERK_SKILL_FRAMES - 1);
    const row = Math.floor(frame / 4);
    const col = frame % 4;
    drawMonSprite(barbBerserkSkillSheet || barbBerserkWalkSheet || barbWalkSheet, col, row, drawX, drawY, dsize, dsize);
    ctx.filter = 'none';
    return;
  }

  const barbMoveSheet = isBerserk ? (barbBerserkWalkSheet || barbWalkSheet) : barbWalkSheet;
  const barbAttackSheet = isBerserk ? (barbBerserkAtkSheet || barbAtkSheet) : barbAtkSheet;
  const barbSlamRightSheet = isBerserk ? (barbBerserkSlamRSheet || barbSlamRSheet) : barbSlamRSheet;
  const barbSlamLeftSheet = isBerserk ? (barbBerserkSlamLSheet || barbSlamLSheet) : barbSlamLSheet;
  const barbWhirlSheetActive = isBerserk ? (barbBerserkWhirlSheet || barbWhirlSheet) : barbWhirlSheet;

  if (player.state === 'attacking') {
    const ab = player.activeAbility;
    const sd = enlarged ? SLAM_DISP * 2 : SLAM_DISP;
    const wd = enlarged ? WHIRL_DISP * 2 : WHIRL_DISP;

    if (ab === 'e') {
      const useRight = player.direction === 'right' || player.direction === 'down';
      const sheet    = useRight ? barbSlamRightSheet : barbSlamLeftSheet;
      const useBerserkSheet = isBerserk && (useRight ? barbBerserkSlamRSheet : barbBerserkSlamLSheet);
      const fw   = useBerserkSheet ? BERSERK_SLAM_FW   : SLAM_FW;
      const fh   = useBerserkSheet ? BERSERK_SLAM_FH   : SLAM_FH;
      const xsR  = useBerserkSheet ? BERSERK_SLAM_XS   : SLAM_XS;
      const xsL  = useBerserkSheet ? BERSERK_SLAM_XS_R : SLAM_XS_R;
      const xs   = useRight ? xsR : xsL;
      const col  = player.attackFrame < 4 ? player.attackFrame : player.attackFrame - 4;
      const srcY = player.attackFrame < 4 ? 0 : fh;
      const sOff = Math.round((sd - dsize) / 2);
      ctx.drawImage(sheet, xs[col], srcY, fw, fh, drawX - sOff, drawY - sOff, sd, sd);

    } else if (ab === 'w') {
      const whirlRect = barbWhirlFrameRect(barbWhirlSheetActive, isBerserk && barbBerserkWhirlSheet, player.direction, player.attackFrame);
      const wOff = Math.round((wd - dsize) / 2);
      ctx.drawImage(barbWhirlSheetActive, whirlRect.sx, whirlRect.sy, whirlRect.sw, whirlRect.sh, drawX - wOff, drawY - wOff, wd, wd);

    } else {
      const anim = BARB_ATK[player.direction];
      const sx   = anim.xs[player.attackFrame];
      ctx.drawImage(barbAttackSheet, sx, anim.srcY, BARB_MOVE_FW, anim.srcH, drawX, drawY, dsize, dsize);
    }

  } else {
    const anim = BARB_WALK[player.direction];
    const sx   = anim.xs[player.frameIndex];
    ctx.drawImage(barbMoveSheet, sx, anim.srcY, BARB_MOVE_FW, anim.srcH, drawX, drawY, dsize, dsize);
  }
  ctx.filter = 'none';
}

// Sprite sheet helpers for 4×4 monster sheets (2048×2048, 512px per frame)
const MON_SHEET_COLS = 4;
const MON_FRAME_SIZE = 512;
function dirToRow(dir) {
  if (dir === 'down')  return 0;
  if (dir === 'up')    return 1;
  if (dir === 'right') return 2;
  if (dir === 'left')  return 3;
  return 0;
}
function drawMonSprite(sheet, col, row, dx, dy, dw, dh) {
  if (!sheet) return;
  ctx.drawImage(sheet,
    col * MON_FRAME_SIZE, row * MON_FRAME_SIZE, MON_FRAME_SIZE, MON_FRAME_SIZE,
    dx, dy, dw, dh);
}
function drawMonSpriteInset(sheet, col, row, dx, dy, dw, dh, inset = 3) {
  if (!sheet) return;
  const sx = col * MON_FRAME_SIZE + inset;
  const sy = row * MON_FRAME_SIZE + inset;
  const sw = MON_FRAME_SIZE - inset * 2;
  const sh = MON_FRAME_SIZE - inset * 2;
  ctx.drawImage(sheet, sx, sy, sw, sh, dx, dy, dw, dh);
}
function drawSheetSprite(sheet, col, row, dx, dy, dw, dh, cols = 4, rows = 4) {
  if (!sheet) return;
  const fw = sheet.width / cols;
  const fh = sheet.height / rows;
  ctx.drawImage(sheet,
    col * fw, row * fh, fw, fh,
    dx, dy, dw, dh);
}
function drawMasterQuadrantSprite(sheet, quadrant, col, row, dx, dy, dw, dh) {
  if (!sheet) return;
  const qW = sheet.width / 2;
  const qH = sheet.height / 2;
  const fw = qW / 4;
  const fh = qH / 4;
  const qx = quadrant === 'attack' || quadrant === 'death' ? qW : 0;
  const qy = quadrant === 'block' || quadrant === 'death' ? qH : 0;
  const inset = 1;
  ctx.drawImage(sheet, qx + col * fw + inset, qy + row * fh + inset, fw - inset * 2, fh - inset * 2, dx, dy, dw, dh);
}
function drawRotatedSheetSprite(sheet, col, row, cx, cy, dw, dh, angle, cols = 4, rows = 4, ox = 0, oy = 0) {
  if (!sheet) return;
  const fw = sheet.width / cols;
  const fh = sheet.height / rows;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.drawImage(sheet,
    col * fw, row * fh, fw, fh,
    ox, oy, dw, dh);
  ctx.restore();
}
function drawRotatedFrameSprite(sheet, frame, row, frameCount, rowCount, cx, cy, dw, dh, angle, ox = 0, oy = 0) {
  if (!sheet) return;
  const sx = Math.round(sheet.width * frame / frameCount);
  const nextX = Math.round(sheet.width * (frame + 1) / frameCount);
  const sy = Math.round(sheet.height * row / rowCount);
  const nextY = Math.round(sheet.height * (row + 1) / rowCount);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.drawImage(sheet, sx, sy, nextX - sx, nextY - sy, ox, oy, dw, dh);
  ctx.restore();
}
function drawGuardianSpearFrame(sheet, frame, cx, cy, dw, dh, angle, ox = 0, oy = 0) {
  if (!sheet) return;
  const frameCount = 6;
  const cropBottoms = [836, 956, 1218, 1752, 1908, 1920];
  const exactSixColumnSheet = sheet.width === 3600 && sheet.height === 1600;
  const frameW = exactSixColumnSheet ? 600 : sheet.width / frameCount;
  const sx = Math.round(frameW * frame);
  const sw = Math.round(frameW);
  const sh = exactSixColumnSheet ? sheet.height : Math.min(sheet.height, cropBottoms[frame] || sheet.height);
  const maxH = exactSixColumnSheet ? sheet.height : Math.max(...cropBottoms);
  const drawH = exactSixColumnSheet ? dh : dh * (sh / maxH);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.drawImage(sheet, sx, 0, sw, sh, ox, oy, dw, drawH);
  ctx.restore();
}
function drawOneRowEffectFrame(sheet, frame, frameCount, cx, cy, dw, dh, angle, ox = 0, oy = 0) {
  if (!sheet) return;
  const sx = Math.round(sheet.width * frame / frameCount);
  const nextX = Math.round(sheet.width * (frame + 1) / frameCount);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.drawImage(sheet, sx, 0, nextX - sx, sheet.height, ox, oy, dw, dh);
  ctx.restore();
}
function drawDeathAnim(sheet, e, dw, dh) {
  if (!sheet) return;
  const col = Math.min(e.deathFrame, 3);
  const row = e.deathRow || 0;
  drawMonSprite(sheet, col, row, e.x, e.y, dw, dh);
}
function drawEnemyHpBar(e, W, yOff) {
  ctx.fillStyle = '#333'; ctx.fillRect(e.x, e.y + yOff, W, 5);
  ctx.fillStyle = '#e74c3c'; ctx.fillRect(e.x, e.y + yOff, W * Math.max(0, e.hp / e.maxHp), 5);
}

function drawGoblin(e) {
  const W = GOBLIN_SIZE, H = GOBLIN_SIZE;
  if (e.dying || e.deathDone) {
    drawDeathAnim(goblinDeathSheet, e, W, H);
    return;
  }
  if (e.hp <= 0) return;
  applyHitFlash(e.hitFlash);
  const row = dirToRow(e.direction);
  const col = e.state === 'attacking' ? (e.attackFrame || 0) % 4 : e.frameIndex % 4;
  const sheet = e.state === 'attacking' ? goblinAtkSheet : goblinRunSheet;
  drawMonSprite(sheet, col, row, e.x, e.y, W, H);
  ctx.filter = 'none';
  drawEnemyHpBar(e, W, -10);
}

function drawMinotaur(e) {
  const W = DISPLAY_SIZE * 2, H = DISPLAY_SIZE * 2;
  if (e.dying || e.deathDone) {
    drawDeathAnim(minotaurDeathSheet, e, W, H);
    return;
  }
  if (e.hp <= 0) return;

  const winding = e.state === 'windup', charging = e.state === 'charging';
  if (e.state === 'stunned') {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('STUNNED', e.x + W / 2, e.y - 34);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  applyHitFlash(e.hitFlash);
  if (winding && !(e.hitFlash > 0)) {
    ctx.filter = 'sepia(0.45) saturate(1.85) hue-rotate(315deg) brightness(1.12)';
  }
  const row = dirToRow(e.direction);
  const col = (e.state === 'attacking' || e.state === 'charge') ? (e.attackFrame ?? e.frameIndex ?? 0) % 4 : e.frameIndex % 4;
  const useAtk = charging || winding;
  const sheet = useAtk ? (minotaurAtkSheet || minotaurRunSheet) : minotaurRunSheet;
  drawMonSprite(sheet, col, row, e.x, e.y, W, H);
  ctx.filter = 'none';

  ctx.fillStyle = '#333'; ctx.fillRect(e.x, e.y - 18, W, 7);
  ctx.fillStyle = '#e74c3c'; ctx.fillRect(e.x, e.y - 18, W * Math.max(0, e.hp / e.maxHp), 7);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 11px Arial';
  ctx.fillText('MINOTAUR', e.x + W / 2, e.y - 22);
  ctx.textAlign = 'left';
}

function drawGolem(e) {
  const W = GOLEM_SIZE, H = GOLEM_SIZE;

  if (e.dying || e.deathDone) {
    if (golemSheet) {
      const row = e.deathRow || 0;
      const col = Math.min(3, e.deathFrame);
      ctx.globalAlpha = e.deathDone ? 0.55 : 1;
      ctx.drawImage(golemSheet, MASTER_QUAD + col * MASTER_FRAME, MASTER_QUAD + row * MASTER_FRAME, MASTER_FRAME, MASTER_FRAME, e.x, e.y, W, H);
      ctx.globalAlpha = 1;
    } else {
      drawDeathAnim(golemDeathSheet, e, W, H);
    }
    return;
  }
  if (e.hp <= 0) return;

  if (e.state === 'windup') {
    const windupFrac = 1 - (e.slamTimer / GOLEM_SLAM_WINDUP);
    const slamCol = Math.min(3, Math.floor(windupFrac * 4));

    // AoE telegraph circle grows as windup builds
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.55 * windupFrac;
    ctx.strokeStyle = '#ff6600'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x + W / 2, e.y + H / 2, GOLEM_SLAM_RANGE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // White flash: starts subtle, peaks fully white on last frame
    const brightness = 1 + windupFrac * 3;
    const saturation = Math.max(0, 1 - windupFrac * 0.95);
    ctx.filter = `brightness(${brightness.toFixed(2)}) saturate(${saturation.toFixed(2)})`;

    // Row 1 (index 1) of the attack quadrant — dedicated slam animation
    if (golemSheet) {
      ctx.drawImage(golemSheet, MASTER_QUAD + slamCol * MASTER_FRAME, 1 * MASTER_FRAME, MASTER_FRAME, MASTER_FRAME, e.x, e.y, W, H);
    } else {
      drawMonSprite(golemAtkSheet, slamCol, 1, e.x, e.y, W, H);
    }
    ctx.filter = 'none';
    drawEnemyHpBar(e, W, -10);
    if (e.enraged) {
      ctx.fillStyle = '#ff4400'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
      ctx.fillText('ENRAGED', e.x + W/2, e.y - 14); ctx.textAlign = 'left';
    }
    return;
  }

  // Slam aftermath circle
  if (e.slamEffect > 0) {
    ctx.save();
    ctx.globalAlpha = 0.6 * (e.slamEffect / 30);
    ctx.strokeStyle = '#ff6600'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x + W / 2, e.y + H / 2, GOLEM_SLAM_RANGE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  applyHitFlash(e.hitFlash);
  if (e.enraged) ctx.filter = 'hue-rotate(330deg) brightness(1.25) saturate(1.5)';
  const row = dirToRow(e.direction);
  const col = e.frameIndex % 4;
  if (golemSheet) {
    ctx.drawImage(golemSheet, col * MASTER_FRAME, row * MASTER_FRAME, MASTER_FRAME, MASTER_FRAME, e.x, e.y, W, H);
  } else {
    drawMonSprite(golemRunSheet, col, row, e.x, e.y, W, H);
  }
  ctx.filter = 'none';
  drawEnemyHpBar(e, W, -10);
  if (e.enraged) {
    ctx.fillStyle = '#ff4400'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
    ctx.fillText('ENRAGED', e.x + W/2, e.y - 14); ctx.textAlign = 'left';
  }
}

function drawArcher(e) {
  const W = ARCHER_SIZE, H = ARCHER_SIZE;
  if (e.dying) {
    ctx.globalAlpha = Math.max(0, 1 - e.deathFrame / 3);
    drawMonSprite(skelRunSheet, 0, dirToRow(e.direction), e.x, e.y, W, H);
    ctx.globalAlpha = 1;
    return;
  }
  if (e.deathDone) {
    ctx.globalAlpha = 0.5;
    drawMonSprite(skelRunSheet, 0, dirToRow(e.direction), e.x, e.y, W, H);
    ctx.globalAlpha = 1;
    return;
  }
  if (e.hp <= 0) return;
  if (e.state === 'volley') {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.45 * (1 - e.volleyTimer / ARCHER_VOLLEY_WINDUP);
    ctx.strokeStyle = '#d9f2ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x + W/2, e.y + H/2, W * 0.72, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  applyHitFlash(e.hitFlash);
  const row = dirToRow(e.direction);
  const col = e.frameIndex % 4;
  const sheet = e.state === 'attacking' ? skelAtkSheet : skelRunSheet;
  drawMonSprite(sheet, col, row, e.x, e.y, W, H);
  ctx.filter = 'none';
  drawEnemyHpBar(e, W, -10);
}

function drawSkeletalChampion(e) {
  const W = SKELETAL_CHAMPION_SIZE, H = SKELETAL_CHAMPION_SIZE;
  const row = e.deathRow ?? dirToRow(e.direction);
  if (e.dying || e.deathDone) {
    ctx.save();
    ctx.globalAlpha = e.deathDone ? 0.7 : 1;
    drawMasterQuadrantSprite(skeletalChampionSheet, 'death', Math.min(e.deathFrame, 3), row, e.x, e.y, W, H);
    ctx.restore();
    return;
  }
  if (e.hp <= 0) return;
  applyHitFlash(e.hitFlash);
  const blocking = e.blockTimer > 0;
  const attacking = e.state === 'attacking';
  const quadrant = blocking ? 'block' : attacking ? 'attack' : 'run';
  const col = blocking
    ? Math.min(3, Math.floor((24 - e.blockTimer) / 6))
    : attacking ? (e.attackFrame || 0) % 4 : e.frameIndex % 4;
  drawMasterQuadrantSprite(skeletalChampionSheet, quadrant, col, row, e.x, e.y, W, H);
  ctx.filter = 'none';
  drawEnemyHpBar(e, W, -10);
  if (e.blockCooldown <= 0) {
    ctx.fillStyle = '#d9f2ff'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
    ctx.fillText('BLOCK', e.x + W / 2, e.y - 14); ctx.textAlign = 'left';
  }
}

function drawOrc(e) {
  const W = e.brute ? ORC_SIZE * 2 : ORC_SIZE;
  const H = W;
  if (e.dying || e.deathDone) {
    drawDeathAnim(orcDeathSheet, e, W, H);
    return;
  }
  if (e.hp <= 0) return;
  if (e.state === 'attacking') {
    const range = e.brute ? ORC_ATK_RANGE * 1.45 : ORC_ATK_RANGE;
    const cleave = rectInFrontOf(e, range * 0.99, W * 1.15, W);
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.35 * (1 - e.attackTimer / ORC_CLEAVE_WINDUP);
    ctx.fillStyle = '#ff6b2a';
    ctx.strokeStyle = '#ffcc66';
    ctx.fillRect(cleave.x, cleave.y, cleave.w, cleave.h);
    ctx.strokeRect(cleave.x, cleave.y, cleave.w, cleave.h);
    ctx.restore();
  }
  applyHitFlash(e.hitFlash);
  if (e.state === 'charge') ctx.filter = 'hue-rotate(330deg) brightness(1.4) saturate(2)';
  else if (e.enraged) ctx.filter = 'hue-rotate(330deg) brightness(1.15) saturate(1.4)';
  const row = dirToRow(e.direction);
  const col = (e.state === 'attacking' || e.state === 'charge') ? (e.attackFrame ?? e.frameIndex ?? 0) % 4 : e.frameIndex % 4;
  const sheet = (e.state === 'attacking' || e.state === 'charge') ? orcAtkSheet : orcRunSheet;
  drawMonSprite(sheet, col, row, e.x, e.y, W, H);
  ctx.filter = 'none';
  drawEnemyHpBar(e, W, -10);
  if (e.shielded && !e.enraged) {
    ctx.fillStyle = '#b0c4de'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
    ctx.fillText('SHIELD', e.x + W/2, e.y - 24); ctx.textAlign = 'left';
  }
  if (e.brute) {
    ctx.fillStyle = '#ffd166'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center';
    ctx.fillText('BRUTE', e.x + W/2, e.y - 24); ctx.textAlign = 'left';
  }
  if (e.enraged && e.state !== 'charge') {
    ctx.fillStyle = '#ff4400'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
    ctx.fillText('ENRAGED', e.x + W/2, e.y - 14); ctx.textAlign = 'left';
  }
}

function drawGhoul(e) {
  const W = Math.round(DISPLAY_SIZE * 0.8), H = Math.round(DISPLAY_SIZE * 0.8);
  if (e.spawnWarning > 0) {
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.45 * (1 - e.spawnWarning / 45);
    ctx.fillStyle = '#28412d';
    ctx.beginPath();
    ctx.ellipse(e.x + W/2, e.y + H * 0.75, W * 0.75, H * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (e.dying) {
    if (ghoulDeathSheet) drawDeathAnim(ghoulDeathSheet, e, W, H);
    else {
      ctx.globalAlpha = Math.max(0, 1 - e.deathFrame / 3);
      drawMonSprite(ghoulRunSheet, 0, dirToRow(e.direction), e.x, e.y, W, H);
      ctx.globalAlpha = 1;
    }
    return;
  }
  if (e.deathDone) {
    // On stage 7, bodies remain on the floor until the Abomination devours them
    if (ghoulDeathSheet) {
      ctx.globalAlpha = 0.55;
      drawMonSprite(ghoulDeathSheet, 3, e.deathRow || 0, e.x, e.y, W, H);
      ctx.globalAlpha = 1;
    }
    return;
  }
  if (e.hp <= 0) return;
  applyHitFlash(e.hitFlash);
  if (e.frenzyTimer > 0) ctx.filter = 'hue-rotate(330deg) brightness(1.25) saturate(1.4)';
  const row = dirToRow(e.direction);
  const col = e.state === 'attacking' ? (e.attackFrame || 0) % 4 : e.frameIndex % 4;
  const sheet = e.state === 'attacking' ? (ghoulAtkSheet || ghoulRunSheet) : ghoulRunSheet;
  drawMonSprite(sheet, col, row, e.x, e.y, W, H);
  ctx.filter = 'none';
  drawEnemyHpBar(e, W, -10);
}

function drawAbomination(e) {
  const W = ABOM_SIZE, H = ABOM_SIZE;

  // Spawn emergence shadow
  if (e.spawnWarning > 0) {
    ctx.save();
    ctx.globalAlpha = 0.15 + 0.55 * (1 - e.spawnWarning / 50);
    ctx.fillStyle = '#1a3320';
    ctx.beginPath();
    ctx.ellipse(e.x + W/2, e.y + H * 0.8, W * 0.55, H * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const row = dirToRow(e.direction);
  if (e.dying) {
    if (abominationSheet) {
      ctx.globalAlpha = Math.max(0, 1 - e.deathFrame / 4);
      ctx.drawImage(abominationSheet, MASTER_QUAD + Math.min(3, e.deathFrame) * MASTER_FRAME, MASTER_QUAD + row * MASTER_FRAME, MASTER_FRAME, MASTER_FRAME, e.x, e.y, W, H);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = Math.max(0, 1 - e.deathFrame / 3);
      ctx.fillStyle = '#1c2c1a';
      ctx.beginPath(); ctx.ellipse(e.x + W/2, e.y + H*0.55, W*0.45, H*0.38, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    return;
  }
  if (e.deathDone || e.hp <= 0) return;

  // Green fed glow radiates outward
  if (e.fedPulse > 0) {
    ctx.save();
    ctx.globalAlpha = (e.fedPulse / 30) * 0.5;
    ctx.fillStyle = '#44ff55';
    ctx.beginPath();
    ctx.ellipse(e.x + W/2, e.y + H/2, W * 0.78, H * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  applyHitFlash(e.hitFlash);
  if (e.feedSpeedTimer > 0) ctx.filter = 'hue-rotate(95deg) brightness(1.35) saturate(1.9)';

  // Draw sprite or procedural fallback
  if (abominationSheet) {
    if (e.state === 'attacking') {
      const atkCol = Math.min(3, Math.floor((ABOM_WINDUP - Math.max(0, e.attackTimer)) / (ABOM_WINDUP / 4)));
      ctx.drawImage(abominationSheet, MASTER_QUAD + atkCol * MASTER_FRAME, row * MASTER_FRAME, MASTER_FRAME, MASTER_FRAME, e.x, e.y, W, H);
    } else {
      ctx.drawImage(abominationSheet, (e.frameIndex % 4) * MASTER_FRAME, row * MASTER_FRAME, MASTER_FRAME, MASTER_FRAME, e.x, e.y, W, H);
    }
  } else {
    // Procedural fallback
    ctx.fillStyle = '#1c2c1a';
    ctx.beginPath(); ctx.ellipse(e.x + W/2, e.y + H*0.58, W*0.46, H*0.42, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#243022';
    ctx.fillRect(e.x + Math.round(W*0.04), e.y + Math.round(H*0.28), Math.round(W*0.20), Math.round(H*0.44));
    ctx.fillRect(e.x + Math.round(W*0.76), e.y + Math.round(H*0.28), Math.round(W*0.20), Math.round(H*0.44));
    ctx.fillStyle = '#263624';
    ctx.beginPath(); ctx.ellipse(e.x + W/2, e.y + H*0.23, W*0.27, H*0.21, 0, 0, Math.PI*2); ctx.fill();
    const eyeCol = e.feedSpeedTimer > 0 ? '#aaff44' : '#88cc33';
    ctx.fillStyle = eyeCol;
    ctx.beginPath(); ctx.ellipse(e.x + W*0.38, e.y + H*0.21, W*0.055, H*0.044, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(e.x + W*0.62, e.y + H*0.21, W*0.055, H*0.044, 0, 0, Math.PI*2); ctx.fill();
  }

  // Attack windup telegraph — green smear in front
  if (e.state === 'attacking' && e.attackTimer > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35 * (1 - e.attackTimer / ABOM_WINDUP);
    ctx.fillStyle = '#44ff44';
    const r = rectInFrontOf(e, ABOM_ATK_RANGE, ABOM_SIZE * 0.8, ABOM_SIZE);
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  ctx.filter = 'none';

  // HP bar — green to reflect fed nature; gold tick marks the original max
  const barW = W;
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(e.x, e.y - 13, barW, 7);
  ctx.fillStyle = '#44cc22'; ctx.fillRect(e.x, e.y - 13, barW * Math.max(0, e.hp / e.maxHp), 7);
  if (e.maxHp > ABOM_HP) {
    // Gold tick shows where base HP cap was — fed HP is beyond it
    const capX = e.x + barW * (ABOM_HP / e.maxHp);
    ctx.fillStyle = '#ffd700'; ctx.fillRect(capX - 1, e.y - 14, 2, 9);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#66dd44'; ctx.font = 'bold 10px Arial';
  ctx.fillText('ABOMINATION', e.x + W/2, e.y - 17);
  ctx.textAlign = 'left';
}

function drawSimpleEnemy(e, bodyColor, headColor, eyeColor, W, H) {
  if (e.dying) {
    ctx.globalAlpha = Math.max(0, 1 - e.deathFrame / 3);
    ctx.fillStyle = bodyColor;
    ctx.fillRect(e.x + Math.round(W*0.15), e.y + Math.round(H*0.35), Math.round(W*0.7), Math.round(H*0.65));
    ctx.fillStyle = headColor;
    ctx.fillRect(e.x + Math.round(W*0.2), e.y, Math.round(W*0.6), Math.round(H*0.38));
    ctx.globalAlpha = 1;
    return;
  }
  if (e.deathDone || e.hp <= 0) return;
  applyHitFlash(e.hitFlash);
  ctx.fillStyle = bodyColor;
  ctx.fillRect(e.x + Math.round(W*0.15), e.y + Math.round(H*0.35), Math.round(W*0.7), Math.round(H*0.65));
  ctx.fillStyle = headColor;
  ctx.fillRect(e.x + Math.round(W*0.2), e.y, Math.round(W*0.6), Math.round(H*0.38));
  ctx.fillStyle = eyeColor;
  ctx.fillRect(e.x + Math.round(W*0.28), e.y + Math.round(H*0.1), Math.round(W*0.12), Math.round(H*0.12));
  ctx.fillRect(e.x + Math.round(W*0.6),  e.y + Math.round(H*0.1), Math.round(W*0.12), Math.round(H*0.12));
  ctx.filter = 'none';
  ctx.fillStyle = '#333'; ctx.fillRect(e.x, e.y - 10, W, 5);
  ctx.fillStyle = '#e74c3c'; ctx.fillRect(e.x, e.y - 10, W * (e.hp / e.maxHp), 5);
}

function drawTroll(e) {
  const W = DISPLAY_SIZE * 2, H = DISPLAY_SIZE * 2;
  if (e.dying) {
    ctx.globalAlpha = Math.max(0, 1 - e.deathFrame / 3);
    drawMonSprite(trollRunSheet, Math.min(e.deathFrame, 3), dirToRow(e.direction), e.x, e.y, W, H);
    ctx.globalAlpha = 1;
    return;
  }
  if (e.deathDone) {
    ctx.globalAlpha = 0.5;
    drawMonSprite(trollRunSheet, 3, dirToRow(e.direction), e.x, e.y, W, H);
    ctx.globalAlpha = 1;
    return;
  }
  if (e.hp <= 0) return;
  applyHitFlash(e.hitFlash);
  const row = dirToRow(e.direction);
  const col = e.state === 'attacking' ? (e.attackFrame || 0) % 4 : e.frameIndex % 4;
  const sheet = e.state === 'attacking' ? (trollAtkSheet || trollRunSheet) : trollRunSheet;
  drawMonSprite(sheet, col, row, e.x, e.y, W, H);
  ctx.filter = 'none';
  drawEnemyHpBar(e, W, -12);
}

function drawGuardian(e) {
  const W = GUARDIAN_SIZE, H = GUARDIAN_SIZE;

  if (e.dying || e.deathDone) {
    ctx.globalAlpha = e.deathDone ? 0.55 : 1;
    drawDeathAnim(guardianDeathSheet, e, W, H);
    ctx.globalAlpha = 1;
    return;
  }
  if (e.hp <= 0) return;

  // Windup telegraph — expanding red arc in the attack direction
  if (e.state === 'windup' && e.attackTimer > 0) {
    const gx = e.x + W/2, gy = e.y + H/2;
    const progress = 1 - e.attackTimer / GUARDIAN_WINDUP_DUR;
    ctx.save();
    ctx.globalAlpha = 0.2 + 0.5 * progress;
    ctx.strokeStyle = '#ff3300'; ctx.lineWidth = 3;
    // Draw a line in the windup direction showing spear reach
    let ex = gx, ey = gy;
    const reach = GUARDIAN_SPEAR_RANGE * progress;
    if (e.windupDir === 'right') ex = gx + reach;
    else if (e.windupDir === 'left')  ex = gx - reach;
    else if (e.windupDir === 'down')  ey = gy + reach;
    else if (e.windupDir === 'up')    ey = gy - reach;
    ctx.setLineDash([8, 5]);
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  const drawSpearFlash = (progress) => {
    const gx = e.x + W/2, gy = e.y + H/2;
    ctx.save();
    ctx.globalAlpha = Math.min(0.7, progress * 0.7);
    ctx.strokeStyle = '#ffdd88'; ctx.lineWidth = 6;
    let ex = gx, ey = gy;
    if (e.windupDir === 'right') ex = gx + GUARDIAN_SPEAR_RANGE;
    else if (e.windupDir === 'left')  ex = gx - GUARDIAN_SPEAR_RANGE;
    else if (e.windupDir === 'down')  ey = gy + GUARDIAN_SPEAR_RANGE;
    else if (e.windupDir === 'up')    ey = gy - GUARDIAN_SPEAR_RANGE;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.restore();
  };

  const drawSpearProjectile = (progress) => {
    if (!guardianSpearSheet) return false;
    const frameCount = 6;
    const frame = Math.min(frameCount - 1, Math.floor(progress * frameCount));
    const gx = e.x + W / 2;
    const gy = e.y + H / 2;
    const spearW = Math.round(DISPLAY_SIZE * 1.55);
    const spearH = Math.round(GUARDIAN_SPEAR_RANGE * (e.enraged ? 1.2 : 1.05));
    const angles = { down: 0, right: -Math.PI / 2, up: Math.PI, left: Math.PI / 2 };
    const angle = angles[e.windupDir] ?? 0;
    ctx.save();
    ctx.globalAlpha = Math.min(1, 0.35 + progress * 0.75);
    drawGuardianSpearFrame(
      guardianSpearSheet,
      frame,
      gx,
      gy,
      spearW,
      spearH,
      angle,
      -spearW / 2,
      -DISPLAY_SIZE * 0.12
    );
    ctx.restore();
    return true;
  };

  const windupSpearProgress = e.state === 'windup' && e.attackTimer <= GUARDIAN_SPEAR_EFFECT_DUR
    ? 1 - Math.max(0, e.attackTimer) / GUARDIAN_SPEAR_EFFECT_DUR
    : 0;
  if (windupSpearProgress > 0 && !drawSpearProjectile(windupSpearProgress)) drawSpearFlash(windupSpearProgress);

  applyHitFlash(e.hitFlash);

  // Enrage tint
  if (e.enraged) ctx.filter = 'hue-rotate(330deg) brightness(1.3)';

  const row = dirToRow(e.direction);
  const col = e.state === 'windup' ? Math.floor((GUARDIAN_WINDUP_DUR - e.attackTimer) / Math.max(1, Math.floor(GUARDIAN_WINDUP_DUR / 4))) % 4 : e.frameIndex % 4;
  const sheet = e.state === 'windup' || e.spearEffect > 0 ? (guardianAtkSheet || guardianRunSheet) : guardianRunSheet;
  drawMonSprite(sheet, col, row, e.x, e.y, W, H);

  ctx.filter = 'none';
  // HP bar
  ctx.fillStyle = '#333'; ctx.fillRect(e.x, e.y - 10, W, 5);
  ctx.fillStyle = e.enraged ? '#ff4400' : '#e74c3c';
  ctx.fillRect(e.x, e.y - 10, W * Math.max(0, e.hp / e.maxHp), 5);
  if (e.enraged) {
    ctx.fillStyle = '#ff6622'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
    ctx.fillText('ENRAGED', e.x + W/2, e.y - 14); ctx.textAlign = 'left';
  }
}

// Draw the mimic using its copied hero sprite, tinted with a hue shift so it's
// clearly a "shadow clone" but still recognisable as the player's class.
function drawMimicSprite(e, alpha) {
  const cls  = e.mimicClass || player.className;
  const dsize = DISPLAY_SIZE;
  const row  = dirToRow(e.direction);
  const attacking = e.state === 'mimicCast';
  const col  = attacking ? (e.attackFrame || 0) % 4 : e.frameIndex % 4;
  const ab = attacking ? (e.activeAbility || 'q') : null;

  ctx.save();
  ctx.globalAlpha = alpha;
  // Hue-rotate 195° pushes warm reds/greens into cool purple/violet range
  ctx.filter = 'hue-rotate(195deg) saturate(1.8) brightness(0.8)';

  if (cls === 'Barbarian' && barbWalkSheet) {
    const isBerserkMimic = e.enraged;
    const mimicWalkSheet = isBerserkMimic ? (barbBerserkWalkSheet || barbWalkSheet) : barbWalkSheet;
    const mimicAtkSheet = isBerserkMimic ? (barbBerserkAtkSheet || barbAtkSheet) : barbAtkSheet;
    const mimicSlamRSheet = isBerserkMimic ? (barbBerserkSlamRSheet || barbSlamRSheet) : barbSlamRSheet;
    const mimicSlamLSheet = isBerserkMimic ? (barbBerserkSlamLSheet || barbSlamLSheet) : barbSlamLSheet;
    const mimicWhirlSheet = isBerserkMimic ? (barbBerserkWhirlSheet || barbWhirlSheet) : barbWhirlSheet;
    if (attacking && ab === 'w') {
      const whirlRect = barbWhirlFrameRect(mimicWhirlSheet || mimicAtkSheet || mimicWalkSheet, isBerserkMimic && barbBerserkWhirlSheet, e.direction, col);
      const wd = WHIRL_DISP;
      const off = Math.round((wd - dsize) / 2);
      ctx.drawImage(mimicWhirlSheet || mimicAtkSheet || mimicWalkSheet, whirlRect.sx, whirlRect.sy, whirlRect.sw, whirlRect.sh, e.x - off, e.y - off, wd, wd);
    } else if (attacking && ab === 'e') {
      const useRight = e.direction === 'right' || e.direction === 'down';
      const sheet = useRight ? (mimicSlamRSheet || mimicAtkSheet) : (mimicSlamLSheet || mimicAtkSheet);
      const useBerserkSheet = isBerserkMimic && (useRight ? barbBerserkSlamRSheet : barbBerserkSlamLSheet);
      const fw  = useBerserkSheet ? BERSERK_SLAM_FW   : SLAM_FW;
      const fh  = useBerserkSheet ? BERSERK_SLAM_FH   : SLAM_FH;
      const xsR = useBerserkSheet ? BERSERK_SLAM_XS   : SLAM_XS;
      const xsL = useBerserkSheet ? BERSERK_SLAM_XS_R : SLAM_XS_R;
      const xs  = useRight ? xsR : xsL;
      const sd  = SLAM_DISP;
      const off = Math.round((sd - dsize) / 2);
      ctx.drawImage(sheet, xs[Math.min(col, 3)], 0, fw, fh, e.x - off, e.y - off, sd, sd);
    } else if (attacking && ab === 'r') {
      const frame = Math.min(col, BARB_BERSERK_SKILL_FRAMES - 1);
      drawMonSprite(barbBerserkSkillSheet || mimicAtkSheet || mimicWalkSheet, frame % 4, Math.floor(frame / 4), e.x, e.y, dsize, dsize);
    } else {
      const anim = BARB_WALK[e.direction];
      const sx   = anim.xs[col];
      const sheet = attacking ? (mimicAtkSheet || mimicWalkSheet) : mimicWalkSheet;
      ctx.drawImage(sheet, sx, anim.srcY, BARB_MOVE_FW, anim.srcH, e.x, e.y, dsize, dsize);
    }
  } else if (cls === 'Rogue' && rogueRunSheet) {
    let sheet = attacking ? (rogueAtkSheet || rogueRunSheet) : rogueRunSheet;
    let drawRow = row;
    if (attacking && ab === 'w') sheet = rogueThrowSheet || sheet;
    if (attacking && ab === 'e') { sheet = rogueWindwalkSheet || sheet; drawRow = 0; }
    if (attacking && ab === 'r') sheet = rogueSliceDiceSheet || sheet;
    drawMonSprite(sheet, col, drawRow, e.x, e.y, dsize, dsize);
  } else if (cls === 'Mage' && mageRunSheet) {
    let sheet = attacking ? (mageAtkSheet || mageRunSheet) : mageRunSheet;
    let drawRow = row;
    if (attacking && ab === 'w') sheet = mageFireballCastSheet || sheet;
    if (attacking && ab === 'e') { sheet = mageFrostNovaSheet || sheet; drawRow = Math.min(1, row); }
    if (attacking && ab === 'r') sheet = mageBlinkSheet || sheet;
    drawMonSprite(sheet, col, drawRow, e.x, e.y, dsize, dsize);
  } else {
    // Mage / fallback — draw a tinted silhouette box
    ctx.fillStyle = attacking ? '#c06cff' : '#9944ff';
    ctx.fillRect(e.x + Math.round(dsize*0.2), e.y, Math.round(dsize*0.6), dsize);
    if (attacking) {
      ctx.strokeStyle = '#e6c6ff'; ctx.lineWidth = 3;
      ctx.strokeRect(e.x + Math.round(dsize*0.12), e.y + Math.round(dsize*0.08), Math.round(dsize*0.76), Math.round(dsize*0.84));
    }
  }

  ctx.restore();
}

function drawTribunalEnemy(e) {
  const hb = enemyHitbox(e);
  const cx = e.x + hb.w / 2;
  const cy = e.y + hb.h / 2;
  const row = e.deathRow ?? dirToRow(e.direction);
  const animCol = (duration) => Math.min(3, Math.floor((duration - e.attackTimer) / Math.max(1, duration / 4)));
  const drawFallbackBody = () => {
    ctx.fillStyle = e.type === 'trib_priest' ? '#183828' : e.type === 'trib_warden' ? '#26384b' : '#525b67';
    ctx.fillRect(e.x + hb.w * 0.2, e.y + hb.h * 0.18, hb.w * 0.6, hb.h * 0.78);
    ctx.fillStyle = e.type === 'trib_priest' ? '#76ff9b' : e.type === 'trib_warden' ? '#8ecbff' : '#b9c0c8';
    ctx.fillRect(e.x + hb.w * 0.28, e.y, hb.w * 0.44, hb.h * 0.34);
  };
  if (e.dying || e.deathDone) {
    const deathSheet = e.type === 'trib_sentinel'
      ? ironSentinelDeathSheet
      : e.type === 'trib_warden'
        ? chainWardenDeathSheet
        : e.type === 'trib_priest' ? ashPriestDeathSheet : null;
    ctx.save();
    ctx.globalAlpha = e.deathDone ? 0.65 : 1;
    if (deathSheet) drawSheetSprite(deathSheet, Math.min(e.deathFrame, 3), row, e.x, e.y, hb.w, hb.h);
    else {
      ctx.globalAlpha = e.deathDone ? 0.45 : Math.max(0.25, 1 - e.deathFrame / 4);
      ctx.fillStyle = e.type === 'trib_warden' ? '#8ecbff' : '#b9c0c8';
      ctx.fillRect(e.x, e.y + hb.h * 0.25, hb.w, hb.h * 0.65);
    }
    ctx.restore();
    return;
  }
  if (e.hp <= 0) return;

  applyHitFlash(e.hitFlash);
  ctx.save();
  if (e.type === 'trib_sentinel') {
    if (e.state === 'attacking') {
      const cleave = rectInFrontOf(e, DISPLAY_SIZE * 2.25, TRIB_SENTINEL_SIZE * 1.1, TRIB_SENTINEL_SIZE);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#d6d6d6';
      ctx.fillRect(cleave.x, cleave.y, cleave.w, cleave.h);
      ctx.globalAlpha = 1;
    }
    const sheet = e.blockTimer > 0
      ? (ironSentinelBlockSheet || ironSentinelRunSheet)
      : e.state === 'attacking' ? (ironSentinelAtkSheet || ironSentinelRunSheet) : ironSentinelRunSheet;
    if (sheet) {
      const col = e.blockTimer > 0
        ? Math.min(3, Math.floor((20 - e.blockTimer) / 5))
        : e.state === 'attacking' ? animCol(TRIB_SENTINEL_WINDUP) : e.frameIndex % 4;
      drawSheetSprite(sheet, col, row, e.x, e.y, hb.w, hb.h);
    } else {
      drawFallbackBody();
      ctx.fillStyle = '#9fb0c6';
      ctx.fillRect(e.direction === 'left' ? e.x : e.x + hb.w * 0.58, e.y + hb.h * 0.28, hb.w * 0.34, hb.h * 0.48);
    }
  } else if (e.type === 'trib_warden') {
    if (e.state === 'attacking') {
      const line = rectInFrontOf(e, DISPLAY_SIZE * 3.0, DISPLAY_SIZE * 0.75, TRIB_WARDEN_SIZE);
      if (chainWardenChainSheet) {
        const progress = 1 - Math.max(0, e.attackTimer) / TRIB_WARDEN_WINDUP;
        const frameCount = 6;
        const frame = Math.min(frameCount - 1, Math.floor(progress * frameCount));
        const chainW = Math.round(DISPLAY_SIZE * 0.9);
        const chainH = Math.round(DISPLAY_SIZE * 3.25);
        const angles = { down: 0, right: -Math.PI / 2, up: Math.PI, left: Math.PI / 2 };
        ctx.globalAlpha = Math.min(1, 0.35 + progress * 0.7);
        drawOneRowEffectFrame(
          chainWardenChainSheet,
          frame,
          frameCount,
          cx,
          cy,
          chainW,
          chainH,
          angles[e.direction] ?? 0,
          -chainW / 2,
          -DISPLAY_SIZE * 0.06
        );
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#8ecbff';
        ctx.fillRect(line.x, line.y, line.w, line.h);
        ctx.globalAlpha = 1;
      }
    }
    const sheet = e.state === 'attacking' ? (chainWardenAtkSheet || chainWardenRunSheet) : chainWardenRunSheet;
    if (sheet) {
      const col = e.state === 'attacking' ? animCol(TRIB_WARDEN_WINDUP) : e.frameIndex % 4;
      drawSheetSprite(sheet, col, row, e.x, e.y, hb.w, hb.h);
    } else {
      drawFallbackBody();
      ctx.strokeStyle = '#8ecbff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, hb.w * 0.42, 0, Math.PI * 1.65); ctx.stroke();
    }
  } else {
    if (e.spearEffect > 0) {
      ctx.globalAlpha = e.spearEffect / 35;
      ctx.strokeStyle = '#76ff9b'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, hb.w * 0.85, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const sheet = e.spearEffect > 0 ? (ashPriestHealSheet || ashPriestRunSheet) : ashPriestRunSheet;
    if (sheet) {
      const col = e.spearEffect > 0 ? Math.min(3, Math.floor((35 - e.spearEffect) / Math.max(1, 35 / 4))) : e.frameIndex % 4;
      drawSheetSprite(sheet, col, row, e.x, e.y, hb.w, hb.h);
    } else {
      drawFallbackBody();
      ctx.fillStyle = '#d8ffe2';
      ctx.fillRect(e.x + hb.w * 0.46, e.y + hb.h * 0.22, hb.w * 0.08, hb.h * 0.55);
    }
  }
  ctx.restore();
  ctx.filter = 'none';

  drawEnemyHpBar(e, hb.w, -10);
  ctx.textAlign = 'center';
  ctx.fillStyle = e.type === 'trib_priest' ? '#76ff9b' : e.type === 'trib_warden' ? '#8ecbff' : '#d6d6d6';
  ctx.font = 'bold 10px Arial';
  const label = e.type === 'trib_priest' ? 'ASH PRIEST' : e.type === 'trib_warden' ? 'CHAIN WARDEN' : 'IRON SENTINEL';
  ctx.fillText(label, cx, e.y - 14);
  ctx.textAlign = 'left';
}

function drawEnemy(e) {
  if (e.type === 'golem')    return drawGolem(e);
  if (e.type === 'goblin')   return drawGoblin(e);
  if (e.type === 'minotaur') return drawMinotaur(e);
  if (e.type === 'archer')   return drawArcher(e);
  if (e.type === 'skeletal_champion') return drawSkeletalChampion(e);
  if (e.type === 'orc')      return drawOrc(e);
  if (e.type === 'ghoul')        return drawGhoul(e);
  if (e.type === 'abomination')  return drawAbomination(e);
  if (e.type === 'troll')        return drawTroll(e);
  if (e.type === 'guardian') return drawGuardian(e);
  if (e.type === 'trib_sentinel' || e.type === 'trib_warden' || e.type === 'trib_priest') return drawTribunalEnemy(e);
  if (e.type === 'mimic') {
    if (e.dying || e.deathDone) {
      const fadeAlpha = e.deathDone ? 0 : Math.max(0, 1 - e.deathFrame / 3);
      if (fadeAlpha > 0) drawMimicSprite(e, fadeAlpha);
      return;
    }
    if (e.hp <= 0) return;
    applyHitFlash(e.hitFlash);
    drawMimicSprite(e, 1.0);
    ctx.filter = 'none';
    // HP bar
    ctx.fillStyle = '#333'; ctx.fillRect(e.x, e.y - 10, DISPLAY_SIZE, 5);
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(e.x, e.y - 10, DISPLAY_SIZE * Math.max(0, e.hp / e.maxHp), 5);
    // Label shows class + level
    const lbl = `${e.mimicClass || 'MIMIC'} Lv${e.mimicLevel || '?'}`;
    ctx.textAlign = 'center'; ctx.fillStyle = '#bb66ff'; ctx.font = 'bold 10px Arial';
    ctx.fillText(lbl, e.x + DISPLAY_SIZE / 2, e.y - 14);
    ctx.textAlign = 'left';
    return;
  }
  if (e.hp <= 0 && !e.dying) return;
  applyHitFlash(e.hitFlash);

  if (e.state === 'attacking') {
    const atk  = JP_ATKS[e.currentAttack] || JP_ATKS[0];
    const srcX = atk.frames[Math.min(e.attackFrame, atk.frames.length - 1)] * JP_FW;
    if (jpAtkSheet) ctx.drawImage(jpAtkSheet, srcX, atk.row * JP_FH, JP_FW, JP_FH, e.x, e.y, DISPLAY_SIZE, DISPLAY_SIZE);
  } else {
    const anim = JP_MOVE[e.direction] || JP_MOVE.down;
    const srcX = anim.frames[e.frameIndex] * JP_FW;
    if (jpMoveSheet) ctx.drawImage(jpMoveSheet, srcX, anim.row * JP_FH, JP_FW, JP_FH, e.x, e.y, DISPLAY_SIZE, DISPLAY_SIZE);
  }

  ctx.filter = 'none';

  // HP bar
  ctx.fillStyle = '#333';
  ctx.fillRect(e.x, e.y - 10, DISPLAY_SIZE, 5);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(e.x, e.y - 10, DISPLAY_SIZE * (e.hp / e.maxHp), 5);
}

function drawFrostTint(e) {
  if (!e.frostTintTimer || e.dying || e.deathDone || e.hp <= 0) return;
  const hb = enemyHitbox(e);
  ctx.save();
  ctx.globalAlpha = e.frozenTimer > 0 ? 0.38 : 0.22;
  ctx.fillStyle = '#62c7ff';
  ctx.beginPath();
  ctx.ellipse(hb.x + hb.w / 2, hb.y + hb.h / 2, hb.w * 0.48, hb.h * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMarkers() {
  ctx.textAlign = 'center';
  markers.forEach(m => {
    ctx.globalAlpha = m.life / 60;
    ctx.fillStyle = m.color;
    ctx.font = 'bold 16px Arial';
    ctx.fillText(m.text, m.x, m.y - (60 - m.life) * 0.5);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function drawUI() {
  const U = GAME_HEIGHT; // top of UI bar

  if (hudBgImg) {
    const scale = Math.max(canvas.width / hudBgImg.width, UI_HEIGHT / hudBgImg.height);
    const sw = canvas.width / scale;
    const sh = UI_HEIGHT / scale;
    const sx = Math.max(0, (hudBgImg.width - sw) / 2);
    const hudContentCenterY = hudBgImg.height * 0.497;
    const sy = Math.max(0, Math.min(hudBgImg.height - sh, hudContentCenterY - sh / 2));
    ctx.drawImage(hudBgImg, sx, sy, sw, sh, 0, U, canvas.width, UI_HEIGHT);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, U, canvas.width, UI_HEIGHT);
  } else {
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, U, canvas.width, UI_HEIGHT);
  }
  ctx.strokeStyle = '#2a2a4a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, U); ctx.lineTo(canvas.width, U); ctx.stroke();

  // ── Left: portrait filling full UI height ───────────────────────────────
  const portSize = UI_HEIGHT - 4, portX = 2, portY = U + 2;
  const cls = CLASSES.find(c => c.name === player.className);
  const pColor = primaryStatColor(player.primaryStat) || cls?.color || '#e94560';
  ctx.fillStyle = '#1a1a3a'; ctx.fillRect(portX, portY, portSize, portSize);
  const portrait = player.className === 'Barbarian' ? barbPortrait
                 : player.className === 'Rogue'     ? roguePortrait
                 : player.className === 'Mage'      ? magePortrait : null;
  if (portrait) {
    ctx.drawImage(portrait, portX, portY, portSize, portSize);
  } else {
    ctx.fillStyle = '#aaa'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
    ctx.fillText(player.className || '?', portX + portSize/2, portY + portSize/2);
  }
  // Class-colored border + level tag
  ctx.strokeStyle = pColor; ctx.lineWidth = 2; ctx.strokeRect(portX, portY, portSize, portSize);
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(portX, portY + portSize - 18, portSize, 18);
  ctx.fillStyle = pColor; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
  ctx.fillText(`Lv ${player.level}  ${player.className}`, portX + portSize/2, portY + portSize - 5);
  ctx.textAlign = 'left';

  const infoX = portX + portSize + 6;

  // HP bar
  const hpW = 120, hpH = 14;
  ctx.fillStyle = '#333'; ctx.fillRect(infoX, U + 8, hpW, hpH);
  ctx.fillStyle = '#e74c3c'; ctx.fillRect(infoX, U + 8, hpW * (player.hp / player.maxHp), hpH);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(infoX, U + 8, hpW, hpH);
  ctx.fillStyle = '#fff'; ctx.font = '10px Arial'; ctx.textAlign = 'left';
  ctx.fillText(`HP ${player.hp}/${player.maxHp}`, infoX + 3, U + 19);

  // EXP bar — fixed width, clamped fill
  const expW = 120, expH = 10;
  const expFrac = Math.min(1, player.exp / player.expToNext);
  ctx.fillStyle = '#333'; ctx.fillRect(infoX, U + 26, expW, expH);
  ctx.fillStyle = '#9b59b6';
  ctx.fillRect(infoX, U + 26, expW * expFrac, expH);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(infoX, U + 26, expW, expH);
  ctx.fillStyle = '#ccc'; ctx.font = '9px Arial';
  ctx.fillText(`EXP ${player.exp}/${player.expToNext}`, infoX + 3, U + 34);

  // Stats
  ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 10px Arial'; ctx.fillText(`STR ${player.str}`, infoX,      U + 50);
  ctx.fillStyle = '#2ecc71'; ctx.fillText(`AGI ${player.agi}`, infoX + 44, U + 50);
  ctx.fillStyle = '#3498db'; ctx.fillText(`INT ${player.int}`, infoX + 88, U + 50);

  // Active pendant effects listed below stats
  if (player.pendants && player.pendants.length > 0) {
    ctx.font = '8px Arial';
    player.pendants.forEach((p, i) => {
      ctx.fillStyle = p.color;
      ctx.fillText(`◆ ${p.desc}`, infoX, U + 62 + i * 11);
    });
  }

  // Taken talents (compact) — shifted down if pendants present
  const pendantRows = player.pendants ? player.pendants.length : 0;
  const talentBaseY = U + 62 + pendantRows * 11 + (pendantRows > 0 ? 3 : 3);
  const takenTalents = [];
  (player.talentTaken || []).forEach((tiers, pi) => {
    tiers.forEach((taken, ti) => {
      if (taken) takenTalents.push(TALENT_TREE[pi].tiers[ti].label);
    });
  });
  ctx.fillStyle = '#ffd700'; ctx.font = '9px Arial';
  takenTalents.slice(0, 3).forEach((t, i) => ctx.fillText(`★ ${t}`, infoX + (i % 3) * 80, talentBaseY + Math.floor(i / 3) * 12));

  // Status indicators
  let statusX = infoX + 130;
  if (player.berserkTimer > 0) {
    ctx.fillStyle = '#cc00ff'; ctx.font = 'bold 10px Arial';
    ctx.fillText(`BERSERK ${Math.ceil(player.berserkTimer/60)}s`, statusX, U + 18); statusX += 80;
  }
  if (player.windwalkActive) {
    ctx.fillStyle = '#d8d0b8'; ctx.font = 'bold 10px Arial';
    ctx.fillText(`WINDWALK ${Math.ceil(player.windwalkTimer/60)}s`, statusX, U + 18); statusX += 90;
  }
  if (player.sliceDiceTimer > 0) {
    ctx.fillStyle = '#16a085'; ctx.font = 'bold 10px Arial';
    ctx.fillText(`SLICE&DICE ${Math.ceil(player.sliceDiceTimer/60)}s`, statusX, U + 18); statusX += 100;
  }
  if ((player.bulwarkShield || 0) > 0) {
    ctx.fillStyle = '#8fc8f4'; ctx.font = 'bold 10px Arial';
    ctx.fillText(`SHIELD ${Math.round(player.bulwarkShield)}`, statusX, U + 18); statusX += 80;
  }
  if (player.slowTimer > 0) {
    ctx.fillStyle = '#4488ff'; ctx.font = 'bold 10px Arial';
    ctx.fillText(`SLOWED ${Math.ceil(player.slowTimer/60)}s`, statusX, U + 18);
  }
  ctx.fillStyle = '#555'; ctx.font = '10px Arial';
  ctx.fillText(`Stage ${stage}`, infoX + 130, U + 34);

  // ── Center: ability slots (only show unlocked abilities, i.e. level > 0) ──
  const unlockedAbs = orderedAbilities(abilities.filter(ab => ab.level > 0));
  const totalW = unlockedAbs.length * SLOT_SIZE + (unlockedAbs.length - 1) * SLOT_GAP;
  const startX = (canvas.width - totalW) / 2;
  const slotY  = U + (UI_HEIGHT - SLOT_SIZE) / 2;

  let tooltipAb = null;
  unlockedAbs.forEach((ab, i) => {
    const x = startX + i * (SLOT_SIZE + SLOT_GAP);
    const cd = ab.timer > 0;
    ctx.fillStyle = cd ? '#1a1a2e' : '#16213e'; ctx.fillRect(x, slotY, SLOT_SIZE, SLOT_SIZE);
    if (cd) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(x, slotY, SLOT_SIZE, SLOT_SIZE * (ab.timer / ab.cooldown));
    }
    ctx.strokeStyle = cd ? '#444' : ab.color; ctx.lineWidth = 2;
    ctx.strokeRect(x, slotY, SLOT_SIZE, SLOT_SIZE);

    const icon = skillIcons[player.className.toLowerCase() + '_' + ab.name] || skillIcons[ab.name];
    if (icon) {
      // Draw icon filling the slot, dimmed when on cooldown
      ctx.save();
      ctx.globalAlpha = cd ? 0.3 : 1.0;
      ctx.drawImage(icon, x + 5, slotY + 5, SLOT_SIZE - 10, SLOT_SIZE - 10);
      ctx.restore();
      // Key label — small badge top-left
      ctx.fillStyle = cd ? '#555' : 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 13px Arial'; ctx.textAlign = 'left';
      ctx.fillText(ab.label, x + 6, slotY + 16);
    } else {
      // Fallback: large key label centred (no icon)
      ctx.fillStyle = cd ? '#555' : '#fff'; ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(ab.label, x + SLOT_SIZE/2, slotY + SLOT_SIZE/2 + 6);
    }

    // Skill name — bottom centre
    const skillDisplayName = ab.name.charAt(0).toUpperCase() + ab.name.slice(1);
    ctx.textAlign = 'center';
    ctx.fillStyle = cd ? '#444' : '#aaddff'; ctx.font = '9px Arial';
    ctx.fillText(skillDisplayName, x + SLOT_SIZE/2, slotY + SLOT_SIZE - 17);
    // Level / cooldown indicator
    ctx.fillStyle = cd ? '#444' : '#666'; ctx.font = '10px Arial';
    ctx.fillText(`Lv ${ab.level}`, x + SLOT_SIZE/2, slotY + SLOT_SIZE - 6);
    if (cd) {
      ctx.fillStyle = '#aaa'; ctx.font = '12px Arial';
      ctx.fillText(Math.ceil(ab.timer / 60) + 's', x + SLOT_SIZE/2, slotY + SLOT_SIZE - 18);
    }
    if (mouseX >= x && mouseX <= x + SLOT_SIZE && mouseY >= slotY && mouseY <= slotY + SLOT_SIZE) {
      tooltipAb = { ab, x, slotY };
    }
  });

  // Tooltip for hovered ability
  if (tooltipAb) {
    const { ab, x } = tooltipAb;
    const tw = 200, th = 60;
    const tx = Math.min(x - 10, canvas.width - tw - 5);
    const ty = slotY - th - 8;
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(tx, ty, tw, th);
    ctx.strokeStyle = ab.color; ctx.lineWidth = 1; ctx.strokeRect(tx, ty, tw, th);
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'left';
    ctx.fillText(`${ab.name.charAt(0).toUpperCase()+ab.name.slice(1)} (Lv ${ab.level}/${ab.maxLevel})`, tx+6, ty+16);
    ctx.fillStyle = '#ddd'; ctx.font = '11px Arial';
    const words = ab.tooltip.split(' ');
    let line = '', ly = ty+32;
    words.forEach(w => {
      const test = line + (line?' ':'') + w;
      if (ctx.measureText(test).width > tw-12) { ctx.fillText(line,tx+6,ly); line=w; ly+=13; }
      else line=test;
    });
    ctx.fillText(line, tx+6, ly);
  }

  // ── Right: pendant slots ──────────────────────────────────────────────────
  if (player.pendants && player.pendants.length > 0) {
    const pSlot = 68;
    const pGap  = 6;
    const pStartX = canvas.width - (player.pendants.length * (pSlot + pGap)) - 8;
    player.pendants.forEach((p, i) => {
      const px = pStartX + i*(pSlot+pGap);
      const py = U + (UI_HEIGHT - pSlot)/2;
      // Background
      ctx.fillStyle = '#0d0d22'; ctx.fillRect(px, py, pSlot, pSlot);
      ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.strokeRect(px, py, pSlot, pSlot);
      // Gem circle (placeholder for future sprite)
      ctx.save();
      ctx.beginPath(); ctx.arc(px+pSlot/2, py+pSlot*0.42, pSlot*0.29, 0, Math.PI*2);
      ctx.fillStyle = p.color; ctx.globalAlpha = 0.25; ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      // Short label — first word of the name, capped to 8 chars
      const shortName = p.name.split(' ').find(w => w.toLowerCase() !== 'the') || p.name;
      const label = shortName.length > 8 ? shortName.slice(0,7) + '…' : shortName;
      ctx.fillStyle = p.color; ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center';
      ctx.fillText(label, px+pSlot/2, py+pSlot-6);
      // Tooltip on hover
      if (mouseX >= px && mouseX <= px+pSlot && mouseY >= py && mouseY <= py+pSlot) {
        const fullName = `Pendant of ${p.name}`;
        const tw = Math.max(180, ctx.measureText(fullName).width + 20);
        const th = 46;
        const tx = Math.min(Math.max(px - tw/2, 2), canvas.width - tw - 2);
        const ty = py - th - 5;
        ctx.fillStyle='#1a1a2e'; ctx.fillRect(tx,ty,tw,th);
        ctx.strokeStyle=p.color; ctx.lineWidth=1; ctx.strokeRect(tx,ty,tw,th);
        ctx.fillStyle=p.color; ctx.font='bold 11px Arial'; ctx.textAlign='center';
        ctx.fillText(fullName, tx+tw/2, ty+16);
        ctx.fillStyle='#ccc'; ctx.font='10px Arial';
        ctx.fillText(p.desc, tx+tw/2, ty+34);
      }
    });
    ctx.textAlign = 'left';
  }
}

function drawTalentScreen() {
  drawMedievalScreenBackdrop(0.56);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#d8b45d';
  ctx.font = `700 34px 'Cinzel Decorative', serif`;
  ctx.fillText(`LEVEL UP!  —  Level ${player.level}`, canvas.width / 2, 62);
  ctx.fillStyle = '#d8c29a';
  ctx.font = `600 16px 'Cinzel', serif`;
  ctx.fillText('Use arrows then Enter, or press 1  2  3, to preview a talent', canvas.width / 2, 92);

  const cardW = 240, cardH = 150, colGap = 28, rowGap = 14;
  const totalW = 3 * cardW + 2 * colGap;
  const startX = (canvas.width - totalW) / 2;
  const headerY = 118;
  const gridY   = 162;
  const activeTier = currentTalentTier();
  const avail   = [0,1,2].filter(pi => activeTier >= 0 && !isTalentTaken(pi, activeTier));

  TALENT_TREE.forEach((path, pi) => {
    const colX = startX + pi * (cardW + colGap);
    const cx   = colX + cardW / 2;
    ctx.fillStyle = path.color; ctx.font = `700 18px 'Cinzel Decorative', serif`;
    ctx.fillText(path.path, cx, headerY);
    const ki = avail.indexOf(pi);
    if (ki >= 0) { ctx.fillStyle = '#d8b45d'; ctx.font = `700 14px 'Cinzel', serif`; ctx.fillText(`[ ${ki+1} ]`, cx, headerY + 22); }

    path.tiers.forEach((tier, ti) => {
      const cy = gridY + ti * (cardH + rowGap);
      let state = isTalentTaken(pi, ti) ? 'taken' : ti === activeTier ? 'available' : 'locked';

      drawWoodPanel(colX, cy, cardW, cardH, state==='available' ? path.color : state==='taken' ? '#d8b45d' : '#3b291c', 2);
      if (state === 'locked') {
        ctx.fillStyle = 'rgba(0,0,0,0.52)';
        ctx.fillRect(colX, cy, cardW, cardH);
      } else if (state === 'taken') {
        ctx.fillStyle = 'rgba(40,65,25,0.22)';
        ctx.fillRect(colX, cy, cardW, cardH);
      }
      ctx.lineWidth = state==='available' ? 3 : 2;
      const cursorOnCard = state === 'available' && ki === levelupTalentCursor;
      ctx.strokeStyle = state==='taken' ? '#ffd700' : cursorOnCard ? '#fff' : state==='available' ? path.color : '#2a2a2a';
      ctx.strokeRect(colX, cy, cardW, cardH);

      if (state === 'available') {
        ctx.save();
        ctx.shadowColor = path.color;
        ctx.shadowBlur = 18;
        ctx.strokeStyle = path.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(colX, cy, cardW, cardH);
        ctx.restore();
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = state==='locked' ? '#5c4b36' : '#b79661'; ctx.font = `600 11px 'Cinzel', serif`;
      ctx.fillText(`Tier ${ti+1}`, colX+8, cy+16);
      ctx.textAlign = 'right';
      if (state==='taken')       { ctx.fillStyle='#ffd700'; ctx.font='bold 11px Arial'; ctx.fillText('✓ TAKEN',   colX+cardW-8, cy+16); }
      else if (state==='available') { ctx.fillStyle=path.color; ctx.font='bold 11px Arial'; ctx.fillText('◉ SELECT', colX+cardW-8, cy+16); }
      else if (state==='locked')  { ctx.fillStyle='#333'; ctx.font='11px Arial'; ctx.fillText('LOCKED', colX+cardW-8, cy+16); }
      ctx.textAlign = 'center';

      ctx.fillStyle = state==='locked' ? '#5c4b36' : state==='taken' ? '#d8b45d' : '#f2e3bd';
      setFittingFont(tier.label, cardW - 28, state==='available' ? 18 : 16, 13, 700, 'Cinzel');
      ctx.fillText(tier.label, colX + cardW/2, cy + 58);

      ctx.fillStyle = state==='locked' ? '#4a3b2b' : '#d8c29a';
      ctx.font = `600 12px 'Cinzel', serif`;
      drawCenteredWrappedText(tier.desc, colX + cardW/2, cy + 82, cardW - 24, 14, 3);

      if (state === 'available' && ki >= 0) {
        ctx.fillStyle = '#d8b45d'; ctx.font = `700 13px 'Cinzel', serif`;
        ctx.fillText(cursorOnCard ? 'Enter to preview' : `Press [${ki+1}] or click`, colX + cardW/2, cy + 136);
      }
    });
  });
  ctx.textAlign = 'left';
}

function drawTalentConfirm() {
  if (!talentConfirmData) return;
  drawMedievalScreenBackdrop(0.62);
  const pw = 560, ph = 230;
  const px = (canvas.width - pw) / 2;
  const py = GAME_HEIGHT / 2 - 120;
  drawWoodPanel(px, py, pw, ph, talentConfirmData.color, 3);

  ctx.textAlign = 'center';
  const confirmMode = talentConfirmData.mode === 'confirm';
  ctx.fillStyle = talentConfirmData.color;
  ctx.font = `700 14px 'Cinzel', serif`;
  ctx.fillText(confirmMode ? 'CONFIRM TALENT' : 'TALENT ACQUIRED', canvas.width / 2, GAME_HEIGHT / 2 - 80);

  ctx.save();
  ctx.shadowColor = talentConfirmData.color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#f2e3bd';
  setFittingFont(talentConfirmData.name, pw - 60, 36, 24, 700, 'Cinzel Decorative');
  ctx.fillText(talentConfirmData.name, canvas.width / 2, GAME_HEIGHT / 2 - 30);
  ctx.restore();

  ctx.fillStyle = '#ead9b9'; ctx.font = `600 18px 'Cinzel', serif`;
  drawCenteredWrappedText(talentConfirmData.desc, canvas.width / 2, GAME_HEIGHT / 2 + 10, pw - 64, 22, 2);
  if (confirmMode) {
    ctx.fillStyle = '#c7b08c'; ctx.font = `600 15px 'Cinzel', serif`;
    ctx.fillText('Are you sure you want to level this talent?', canvas.width / 2, GAME_HEIGHT / 2 + 52);
  }

  ctx.fillStyle = '#c7b08c'; ctx.font = `600 13px 'Cinzel', serif`;
  ctx.fillText(confirmMode ? 'Press Enter/Space to confirm, or Esc/Backspace to cancel' : 'Press Enter or Space to continue', canvas.width / 2, GAME_HEIGHT / 2 + 78);
  ctx.textAlign = 'left';
}

function drawStageChoice() {
  drawMedievalScreenBackdrop(0.58);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#d8b45d';
  ctx.font = `700 34px 'Cinzel Decorative', serif`;
  ctx.fillText(`STAGE ${stage} CLEAR!`, canvas.width / 2, GAME_HEIGHT / 2 - 130);

  ctx.fillStyle = '#d8c29a'; ctx.font = `600 14px 'Cinzel', serif`;
  ctx.fillText('You made it through the door. What will you do?', canvas.width / 2, GAME_HEIGHT / 2 - 94);

  const panelW = 540, panelH = 220;
  const px = (canvas.width - panelW) / 2, py = GAME_HEIGHT / 2 - 76;
  drawWoodPanel(px, py, panelW, panelH, '#7a512e', 3);

  ctx.fillStyle = '#f1d27a'; ctx.font = `700 18px 'Cinzel', serif`;
  ctx.fillText('Choose your path forward:', canvas.width / 2, py + 32);

  // Option 1: Rest
  const opt1x = px + 20, opt2x = px + panelW / 2 + 10;
  const optY = py + 55, optW = panelW / 2 - 30, optH = 130;

  drawWoodPanel(opt1x, optY, optW, optH, '#2ecc71', 2);
  ctx.fillStyle = 'rgba(20,70,35,0.18)';
  ctx.fillRect(opt1x, optY, optW, optH);
  ctx.fillStyle = '#2ecc71'; ctx.font = `700 17px 'Cinzel', serif`;
  ctx.fillText('[1]  Rest', opt1x + optW / 2, optY + 28);
  ctx.fillStyle = '#ead9b9'; ctx.font = `600 13px 'Cinzel', serif`;
  ctx.fillText('Heal to full HP', opt1x + optW / 2, optY + 54);
  ctx.fillStyle = '#e98572'; ctx.font = `600 12px 'Cinzel', serif`;
  ctx.fillText('Lose EXP progress in level', opt1x + optW / 2, optY + 74);
  ctx.fillStyle = '#f2e3bd'; ctx.font = `700 15px 'Cinzel', serif`;
  ctx.fillText(`${player.hp}  →  ${player.maxHp} HP`, opt1x + optW / 2, optY + 104);

  // Option 2: Continue
  drawWoodPanel(opt2x, optY, optW, optH, '#e94560', 2);
  ctx.fillStyle = 'rgba(120,30,25,0.14)';
  ctx.fillRect(opt2x, optY, optW, optH);
  ctx.fillStyle = '#e94560'; ctx.font = `700 17px 'Cinzel', serif`;
  ctx.fillText('[2]  Continue', opt2x + optW / 2, optY + 28);
  ctx.fillStyle = '#ead9b9'; ctx.font = `600 13px 'Cinzel', serif`;
  ctx.fillText('Keep EXP progress', opt2x + optW / 2, optY + 54);
  ctx.fillStyle = '#9ee070'; ctx.font = `600 12px 'Cinzel', serif`;
  ctx.fillText('No healing', opt2x + optW / 2, optY + 74);
  ctx.fillStyle = '#f2e3bd'; ctx.font = `700 15px 'Cinzel', serif`;
  ctx.fillText(`${player.hp} / ${player.maxHp} HP`, opt2x + optW / 2, optY + 104);

  ctx.textAlign = 'left';
}

function drawStageStats() {
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(0, 0, canvas.width, GAME_HEIGHT);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#e94560';
  ctx.font = 'bold 32px Arial';
  ctx.fillText(`STAGE ${stage} CLEAR!`, canvas.width / 2, 80);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 18px Arial';
  ctx.fillText(`Entering Stage ${stage + 1}`, canvas.width / 2, 116);
  ctx.fillStyle = '#aaa';
  ctx.font = '15px Arial';
  ctx.fillText('Press Enter or Space to continue', canvas.width / 2, 144);

  const panelW = 320, panelH = 220, panelX = (canvas.width - 320) / 2, panelY = 168;
  ctx.fillStyle = '#12122a';
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = '#e94560';
  ctx.lineWidth = 2;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Arial';
  ctx.fillText('Character Stats', canvas.width / 2, panelY + 28);

  const qab = abilities.find(a => a.key === 'q') || { damage: 0, cooldown: 0 };
  const stats = [
    { label: 'Damage',       value: qab.damage },
    { label: 'Move Speed',   value: player.speed },
    { label: 'Attack Range', value: player.atkRange + ' px' },
    { label: 'Health',       value: `${player.hp} / ${player.maxHp}` },
    { label: 'Atk Cooldown', value: (qab.cooldown / 60).toFixed(1) + 's' },
  ];

  stats.forEach((s, i) => {
    const y = panelY + 60 + i * 32;
    ctx.fillStyle = '#aaa';
    ctx.font = '15px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(s.label, panelX + 28, y);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.fillText(s.value, panelX + panelW - 28, y);
  });
  ctx.textAlign = 'left';
}

// ── Dev mode helpers ──────────────────────────────────────────────────────────

function applyDevConfig() {
  // ── Stat points: use manual allocation, remainder to primary stat ──────────
  const totalPts = (devSetupLevel - 1) * 3;
  const usedPts  = devStatAlloc[0] + devStatAlloc[1] + devStatAlloc[2];
  const remainder = totalPts - usedPts;
  ['str','agi','int'].forEach((stat, i) => {
    for (let j = 0; j < devStatAlloc[i]; j++) applyStatPoint(stat);
  });
  for (let i = 0; i < remainder; i++) applyStatPoint(player.primaryStat);

  // ── Skills: auto-level Q→max, W→max, E→max, R when eligible ──────────────
  clampDevChoicesForLevel();
  ABILITY_KEY_ORDER.forEach((key, idx) => {
    const ab = abilities.find(a => a.key === key);
    if (!ab) return;
    for (let i = 0; i < devSkillAlloc[idx]; i++) {
      if (ab.level < ab.maxLevel) levelSkill(ab);
    }
  });

  // ── Talents: apply chosen paths in slot order, tracking tier per path ──────
  const slotLevels  = [3, 6, 9];
  let plasticityApplied = false;
  devTalentSlots.forEach((pi, slotIdx) => {
    if (pi < 0 || devSetupLevel < slotLevels[slotIdx]) return;
    const ti = slotIdx;
    markTalentTaken(pi, ti);
    applyTalentEffect(pi, ti);
    if (pi === 2 && ti === 0) plasticityApplied = true;
  });

  if (plasticityApplied && devPrimaryStat) choosePrimaryAttr(devPrimaryStat);
  player.level = devSetupLevel;

  // ── Pendants ───────────────────────────────────────────────────────────────
  DEV_PENDANTS.forEach((p, i) => {
    if (!devSelectedPendants[i]) return;
    player.pendants.push({ name: p.name, color: p.color, desc: p.desc });
    p.apply(player);
  });

  if (devSetupStage === 11) {
    startJohnPorkIntro();
  } else {
    stage = devSetupStage;
    spawnStage(devSetupStage);
    gameState = 'playing';
  }
}

function drawDevSetup() {
  const W = canvas.width, H = GAME_HEIGHT;
  ctx.fillStyle = 'rgba(0,0,0,0.94)'; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 22px Arial';
  ctx.fillText('DEV TEST SETUP', W/2, 36);
  ctx.fillStyle = '#555'; ctx.font = '11px Arial';
  ctx.fillText('↑↓ sections  ←→ navigate/change  Space select/toggle  Backspace/X undo stat  Enter start (on Stage)', W/2, 56);

  // ── Section positions ────────────────────────────────────────────────────
  const SEC = [72, 138, 226, 314, 412, 530]; // Y of each section label

  function sectionLabel(si, lbl) {
    const active = devSetupSection === si;
    ctx.fillStyle = active ? '#ffd700' : '#555';
    ctx.font = `bold ${active ? 14 : 12}px Arial`;
    ctx.fillText(lbl, W/2, SEC[si]);
  }

  // ── 0: Level ─────────────────────────────────────────────────────────────
  sectionLabel(0, '── LEVEL ──');
  ctx.fillStyle = '#fff'; ctx.font = 'bold 42px Arial';
  ctx.fillText(devSetupLevel, W/2, SEC[0] + 46);
  ctx.fillStyle = '#666'; ctx.font = '12px Arial';
  ctx.fillText('◀  ▶  (resets stats & talents)', W/2, SEC[0] + 68);

  // ── 1: Stats ─────────────────────────────────────────────────────────────
  sectionLabel(1, 'SKILL POINTS');
  const skillKeys = ABILITY_KEY_ORDER.map(k => k.toUpperCase());
  const totalSkillPts = devSkillPointsForLevel(devSetupLevel);
  const usedSkillPts = devSkillUsed();
  const remSkillPts = totalSkillPts - usedSkillPts;
  const skillW = 82, skillGap = 10;
  const skillStartX = W/2 - (4 * skillW + 3 * skillGap) / 2;
  skillKeys.forEach((key, i) => {
    const x = skillStartX + i * (skillW + skillGap);
    const unlocked = isDevSkillUnlocked(i);
    const sel = devSetupSection === 1 && i === devSkillCursor;
    const finalLevel = devSkillBaseLevel(i) + devSkillAlloc[i];
    ctx.fillStyle = unlocked ? (sel ? '#1a1a3a' : '#0d0d20') : '#080812';
    ctx.strokeStyle = sel ? '#fff' : unlocked ? '#ffd70066' : '#333';
    ctx.lineWidth = sel ? 2 : 1;
    ctx.fillRect(x, SEC[1] + 10, skillW, 54);
    ctx.strokeRect(x, SEC[1] + 10, skillW, 54);
    ctx.fillStyle = unlocked ? '#ffd700' : '#555';
    ctx.font = 'bold 13px Arial';
    ctx.fillText(key, x + skillW/2, SEC[1] + 27);
    ctx.fillStyle = unlocked ? '#fff' : '#555';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(`Lv ${finalLevel}`, x + skillW/2, SEC[1] + 50);
  });
  ctx.fillStyle = remSkillPts > 0 ? '#ffd700' : '#2ecc71';
  ctx.font = '11px Arial';
  ctx.fillText(remSkillPts > 0 ? `${remSkillPts} skill point${remSkillPts!==1?'s':''} remaining` : 'All skill points allocated', W/2, SEC[1] + 80);

  sectionLabel(2, '── STAT POINTS ──');
  const totalPts   = (devSetupLevel - 1) * 3;
  const usedPts    = devStatAlloc[0] + devStatAlloc[1] + devStatAlloc[2];
  const remPts     = totalPts - usedPts;
  const statLabels = ['STR', 'AGI', 'INT'];
  const statColors = ['#e74c3c', '#2ecc71', '#3498db'];
  const colW = 90, statStartX = W/2 - colW;
  statLabels.forEach((lbl, i) => {
    const cx = statStartX + i * colW;
    const sel = devSetupSection === 2 && i === devStatCursor;
    ctx.strokeStyle = sel ? '#fff' : statColors[i] + '66';
    ctx.lineWidth = sel ? 2 : 1;
    ctx.fillStyle = sel ? '#1a1a3a' : '#0d0d20';
    ctx.beginPath(); ctx.rect(cx - 30, SEC[2] + 10, 60, 54); ctx.fill(); ctx.stroke();
    ctx.fillStyle = sel ? '#fff' : statColors[i];
    ctx.font = `bold 11px Arial`; ctx.fillText(lbl, cx, SEC[2] + 24);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Arial';
    ctx.fillText(devStatAlloc[i], cx, SEC[2] + 50);
  });
  ctx.fillStyle = remPts > 0 ? '#ffd700' : '#2ecc71';
  ctx.font = '11px Arial';
  ctx.fillText(remPts > 0 ? `${remPts} point${remPts!==1?'s':''} remaining — ←→ move  Space/Z add  Backspace/X remove` : 'All points allocated  ✓', W/2, SEC[2] + 78);

  // ── 2: Talents ───────────────────────────────────────────────────────────
  sectionLabel(3, '── TALENTS ──');
  const pathNames  = ['Offensive', 'Defensive', 'Utility'];
  const pathColors = ['#e94560',   '#3498db',   '#2ecc71'];
  const tierLabels = [
    ['Haste','Stoneskin','Plasticity'],
    ['Bloodlust','Lifeblood','Assassin'],
    ['Executioner','Ancient Bulwark','Eternal Focus'],
  ];
  const slotLevels = [3, 6, 9];
  const availSlots = slotLevels.filter(l => devSetupLevel >= l).length;
  if (availSlots === 0) {
    ctx.fillStyle = '#444'; ctx.font = '12px Arial';
    ctx.fillText('No talent slots until Level 3', W/2, SEC[3] + 20);
  } else {
    const rowH = 28, slotW = 200, slotGap = 16;
    const totalTW = availSlots * slotW + (availSlots - 1) * slotGap;
    const tStartX = W/2 - totalTW/2;
    for (let s = 0; s < availSlots; s++) {
      const tx = tStartX + s * (slotW + slotGap);
      const ty = SEC[3] + 8;
      const pi  = devTalentSlots[s];
      const sel = devSetupSection === 3 && s === devTalentCursor;
      ctx.fillStyle = pi >= 0 ? pathColors[pi] + '33' : '#111';
      ctx.strokeStyle = sel ? '#fff' : (pi >= 0 ? pathColors[pi] : '#333');
      ctx.lineWidth = sel ? 2 : 1;
      ctx.beginPath(); ctx.rect(tx, ty, slotW, rowH * 2 + 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#888'; ctx.font = 'bold 10px Arial';
      ctx.fillText(`Slot ${s+1}  (Lv${slotLevels[s]}+)`, tx + slotW/2, ty + 14);
      if (pi >= 0) {
        ctx.fillStyle = pathColors[pi]; ctx.font = 'bold 12px Arial';
        ctx.fillText(pathNames[pi], tx + slotW/2, ty + 30);
        ctx.fillStyle = '#ccc'; ctx.font = '10px Arial';
        ctx.fillText(tierLabels[s][pi] || '—', tx + slotW/2, ty + 46);
      } else {
        ctx.fillStyle = '#444'; ctx.font = '12px Arial';
        ctx.fillText('— None —', tx + slotW/2, ty + 38);
      }
    }
    ctx.fillStyle = '#555'; ctx.font = '10px Arial';
    ctx.fillText('←→ select slot   Space cycle path', W/2, SEC[3] + 84);
  }

  // ── 3: Pendants ──────────────────────────────────────────────────────────
  sectionLabel(4, '── PENDANTS ──');
  if (devHasPlasticitySelected()) {
    const chosenPrimary = devPrimaryStat || player.primaryStat;
    ctx.fillStyle = primaryStatColor(chosenPrimary);
    ctx.font = 'bold 10px Arial';
    ctx.fillText(`Plasticity primary: ${primaryStatLabel(chosenPrimary)}   press 1 STR / 2 AGI / 3 INT`, W/2, SEC[3] + 98);
  }
  {
    const slotW = 100, gap = 8;
    const totalPW = DEV_PENDANTS.length * (slotW + gap) - gap;
    const pStartX = (W - totalPW) / 2;
    const pActive = devSetupSection === 4;
    DEV_PENDANTS.forEach((p, pi) => {
      const px = pStartX + pi * (slotW + gap);
      const py = SEC[4] + 8;
      const checked = devSelectedPendants[pi];
      const cursor  = pActive && pi === devPendantCursor;
      ctx.fillStyle = checked ? p.color + '44' : '#0d0d1e';
      ctx.fillRect(px, py, slotW, 88);
      ctx.strokeStyle = cursor ? '#fff' : (checked ? p.color : '#2a2a3a');
      ctx.lineWidth = cursor ? 2 : 1;
      ctx.strokeRect(px, py, slotW, 88);
      ctx.fillStyle = checked ? '#fff' : '#777';
      ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
      ctx.fillText('Pendant of', px + slotW/2, py + 16);
      ctx.fillStyle = checked ? p.color : '#555';
      ctx.font = 'bold 10px Arial';
      ctx.fillText(p.name, px + slotW/2, py + 28);
      ctx.fillStyle = checked ? '#ccc' : '#444';
      ctx.font = '8px Arial';
      const words = p.desc.split(' ');
      ctx.fillText(words.slice(0,3).join(' '), px+slotW/2, py+46);
      if (words.length > 3) ctx.fillText(words.slice(3).join(' '), px+slotW/2, py+56);
      ctx.fillStyle = checked ? '#2ecc71' : '#333';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(checked ? '✓' : '○', px + slotW/2, py + 74);
    });
    ctx.textAlign = 'center';
  }

  // ── 4: Stage ─────────────────────────────────────────────────────────────
  sectionLabel(5, '── STAGE ──');
  const stageNames = ['','Goblins','Golems','Minotaur','Archers','Orcs','Trolls','Ghouls','Mimic','Guardians','Iron Tribunal','John Pork'];
  ctx.fillStyle = '#fff'; ctx.font = 'bold 36px Arial';
  ctx.fillText(devSetupStage, W/2, SEC[5] + 38);
  ctx.fillStyle = '#aaa'; ctx.font = '12px Arial';
  ctx.fillText(`${stageNames[devSetupStage] || ''}  ◀  ▶`, W/2, SEC[5] + 58);

  // ── Start button ─────────────────────────────────────────────────────────
  const startActive = devSetupSection === 5;
  ctx.fillStyle = startActive ? '#2ecc71' : '#555';
  ctx.font = `bold ${startActive ? 16 : 13}px Arial`;
  ctx.fillText(startActive ? '[ ENTER  →  Start Game ]' : 'Navigate to Stage section then press Enter', W/2, H - 20);
  ctx.textAlign = 'left';
}

function drawWin() {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, W, H);

  // Gold radial glow
  const glow = ctx.createRadialGradient(W/2, H*0.38, 20, W/2, H*0.38, 300);
  glow.addColorStop(0, 'rgba(255,215,0,0.25)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 64px Arial';
  ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 30;
  ctx.fillText('VICTORY!', W/2, H * 0.35);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fff'; ctx.font = '22px Arial';
  ctx.fillText('Rendfall Depths has been conquered.', W/2, H * 0.48);

  ctx.fillStyle = '#aaa'; ctx.font = '16px Arial';
  ctx.fillText(`Hero: ${player.className}  ·  Level: ${player.level}  ·  Stage: 11`, W/2, H * 0.55);
  ctx.fillText(`STR ${player.str}  ·  AGI ${player.agi}  ·  INT ${player.int}`, W/2, H * 0.60);

  if (player.pendants && player.pendants.length > 0) {
    ctx.fillStyle = '#9b59b6'; ctx.font = '14px Arial';
    ctx.fillText('Pendants: ' + player.pendants.map(p => 'Pendant of ' + p.name).join('  ·  '), W/2, H * 0.66);
  }

  if (Math.floor(Date.now() / 700) % 2 === 0) {
    ctx.fillStyle = '#ffd700'; ctx.font = '15px Arial';
    ctx.fillText('Press any key to return to the title', W/2, H * 0.82);
  }
  ctx.textAlign = 'left';
}

function drawTitle() {
  const W = canvas.width, H = canvas.height;

  // Background image — cover-fit
  if (titleBgImg) {
    const scale = Math.max(W / titleBgImg.width, H / titleBgImg.height);
    const dw = titleBgImg.width  * scale;
    const dh = titleBgImg.height * scale;
    ctx.drawImage(titleBgImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, W, H);
  }

  // Dark gradient overlay to ensure text readability
  const overlay = ctx.createLinearGradient(0, 0, 0, H);
  overlay.addColorStop(0, 'rgba(0,0,0,0.45)');
  overlay.addColorStop(0.5, 'rgba(0,0,0,0.25)');
  overlay.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);

  // ── Title text ──
  const titleY = H * 0.32;

  // Outer glow
  ctx.save();
  ctx.shadowColor = '#8b0000';
  ctx.shadowBlur  = 60;
  ctx.font        = `900 ${Math.round(H * 0.115)}px 'Cinzel Decorative', serif`;
  ctx.textAlign   = 'center';
  ctx.fillStyle   = 'rgba(139,0,0,0.5)';
  // disabled old background title pass
  ctx.restore();

  // Main gold title
  ctx.save();
  ctx.font      = `900 ${Math.round(H * 0.115)}px 'Cinzel Decorative', serif`;
  ctx.textAlign = 'center';
  const goldGrad = ctx.createLinearGradient(W/2 - 300, titleY - 80, W/2 + 300, titleY);
  goldGrad.addColorStop(0,   '#fff5c0');
  goldGrad.addColorStop(0.3, '#f5c842');
  goldGrad.addColorStop(0.6, '#d4a017');
  goldGrad.addColorStop(1,   '#b8860b');
  ctx.fillStyle   = goldGrad;
  ctx.shadowColor = 'rgba(200,120,0,0.7)';
  ctx.shadowBlur  = 20;
  // disabled old background title pass
  ctx.restore();

  // Subtitle / tagline
  ctx.save();
  ctx.font      = `400 ${Math.round(H * 0.024)}px 'Cinzel', serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(220,200,150,0.8)';
  ctx.letterSpacing = '0.25em';
  // disabled old background subtitle pass
  ctx.restore();

  // Decorative divider line
  const divY = titleY + Math.round(H * 0.105);
  const divW = Math.round(W * 0.3);
  ctx.save();
  ctx.strokeStyle = 'rgba(212,160,23,0.6)';
  ctx.lineWidth   = 1;
  // disabled old divider line
  ctx.restore();

  // ── Menu items ──
  ctx.save();
  const logoTop = H * 0.12;
  const logoBottom = H * 0.49;
  const veil = ctx.createLinearGradient(0, logoTop, 0, logoBottom);
  veil.addColorStop(0, 'rgba(0,0,0,0)');
  veil.addColorStop(0.22, 'rgba(0,0,0,0.72)');
  veil.addColorStop(0.78, 'rgba(0,0,0,0.68)');
  veil.addColorStop(1, 'rgba(0,0,0,0)');
  // disabled old split-title shadow band

  const logoY = H * 0.255;
  const topSize = Math.round(H * 0.112);
  const bottomSize = Math.round(H * 0.086);
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(120,0,0,0.95)';
  ctx.shadowBlur = 44;
  ctx.fillStyle = 'rgba(110,0,0,0.5)';
  ctx.font = `900 ${topSize}px 'Cinzel Decorative', serif`;
  // disabled old split-title pass
  ctx.font = `900 ${bottomSize}px 'Cinzel Decorative', serif`;
  // disabled old split-title pass

  ctx.shadowBlur = 0;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, Math.round(H * 0.006));
  ctx.strokeStyle = 'rgba(10,6,5,0.96)';
  ctx.font = `900 ${topSize}px 'Cinzel Decorative', serif`;
  // disabled old split-title pass
  ctx.font = `900 ${bottomSize}px 'Cinzel Decorative', serif`;
  // disabled old split-title pass

  const logoGold = ctx.createLinearGradient(0, logoY - topSize, 0, logoY + 12);
  logoGold.addColorStop(0, '#fff0aa');
  logoGold.addColorStop(0.38, '#d59a2c');
  logoGold.addColorStop(0.66, '#7b3f12');
  logoGold.addColorStop(1, '#f0c45b');
  ctx.shadowColor = 'rgba(240,160,40,0.55)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = logoGold;
  ctx.font = `900 ${topSize}px 'Cinzel Decorative', serif`;
  // disabled old split-title pass

  const logoSteel = ctx.createLinearGradient(0, logoY + Math.round(H * 0.02), 0, logoY + Math.round(H * 0.12));
  logoSteel.addColorStop(0, '#f1e0b2');
  logoSteel.addColorStop(0.42, '#8d7f68');
  logoSteel.addColorStop(0.75, '#312b29');
  logoSteel.addColorStop(1, '#c3a55b');
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = logoSteel;
  ctx.font = `900 ${bottomSize}px 'Cinzel Decorative', serif`;
  // disabled old split-title pass

  const logoDivY = logoY + Math.round(H * 0.177);
  const logoDivW = Math.round(W * 0.34);
  const logoLine = ctx.createLinearGradient(W/2 - logoDivW/2, logoDivY, W/2 + logoDivW/2, logoDivY);
  logoLine.addColorStop(0, 'rgba(212,160,23,0)');
  logoLine.addColorStop(0.5, 'rgba(212,160,23,0.82)');
  logoLine.addColorStop(1, 'rgba(212,160,23,0)');
  ctx.shadowBlur = 0;
  ctx.strokeStyle = logoLine;
  ctx.lineWidth = 2;
  // disabled old split-title divider
  ctx.restore();

  // Clean title pass: cover earlier experiments and draw a restrained logo.
  ctx.save();
  const cleanTop = H * 0.10;
  const cleanBottom = H * 0.50;
  const cleanTitleY = H * 0.31;
  ctx.textAlign = 'center';
  ctx.font = `900 ${Math.round(H * 0.096)}px 'Cinzel Decorative', serif`;
  ctx.lineWidth = Math.max(2, Math.round(H * 0.004));
  ctx.strokeStyle = 'rgba(18,10,7,0.96)';
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.strokeText('Rendfall Depths', W / 2, cleanTitleY);
  const cleanGold = ctx.createLinearGradient(0, cleanTitleY - H * 0.09, 0, cleanTitleY + H * 0.025);
  cleanGold.addColorStop(0, '#f4dfaa');
  cleanGold.addColorStop(0.48, '#b77c2a');
  cleanGold.addColorStop(1, '#5f2718');
  ctx.fillStyle = cleanGold;
  ctx.fillText('Rendfall Depths', W / 2, cleanTitleY);

  const cleanLineY = cleanTitleY + Math.round(H * 0.035);
  const cleanLineW = Math.round(W * 0.22);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(180,120,42,0.58)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - cleanLineW / 2, cleanLineY);
  ctx.lineTo(W / 2 + cleanLineW / 2, cleanLineY);
  ctx.stroke();
  ctx.restore();

  const menuStartY = H * 0.46;
  const menuSpacing = Math.round(H * 0.085);

  TITLE_ITEMS.forEach((item, i) => {
    const iy = menuStartY + i * menuSpacing;
    const selected = i === titleSelected;

    if (selected) {
      // Glow halo behind selected item
      ctx.save();
      ctx.shadowColor = 'rgba(212,160,23,0.9)';
      ctx.shadowBlur  = 30;
      ctx.font        = `700 ${Math.round(H * 0.052)}px 'Cinzel Decorative', serif`;
      ctx.textAlign   = 'center';
      ctx.fillStyle   = 'rgba(212,160,23,0.2)';
      ctx.fillText(item, W / 2, iy);
      ctx.restore();
    }

    // Item text
    ctx.save();
    const fsize = Math.round(H * (selected ? 0.052 : 0.044));
    const fweight = selected ? 700 : 400;
    ctx.font      = `${fweight} ${fsize}px 'Cinzel Decorative', serif`;
    ctx.textAlign = 'center';
    if (selected) {
      const selGrad = ctx.createLinearGradient(W/2 - 200, iy - 40, W/2 + 200, iy);
      selGrad.addColorStop(0, '#fff5c0');
      selGrad.addColorStop(0.5, '#f5c842');
      selGrad.addColorStop(1, '#d4a017');
      ctx.fillStyle   = selGrad;
      ctx.shadowColor = 'rgba(212,160,23,0.8)';
      ctx.shadowBlur  = 15;
    } else {
      ctx.fillStyle = 'rgba(200,180,120,0.75)';
    }
    ctx.fillText(item, W / 2, iy);
    const measuredWidth = selected ? ctx.measureText(item).width : 0;
    ctx.restore();

    // Selection ornaments
    if (selected) {
      const textWidth = measuredWidth * 1.15;
      ctx.save();
      ctx.font      = `400 ${Math.round(H * 0.032)}px 'Cinzel', serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(212,160,23,0.9)';
      ctx.fillText('❧', W/2 - textWidth/2 - 24, iy - 4);
      ctx.fillText('❦', W/2 + textWidth/2 + 24, iy - 4);
      ctx.restore();
    }
  });

  // Press Enter hint — blinking
  if (Math.floor(Date.now() / 600) % 2 === 0) {
    ctx.save();
    ctx.font      = `400 ${Math.round(H * 0.022)}px 'Cinzel', serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(200,180,120,0.65)';
    ctx.fillText('PRESS ENTER', W / 2, H * 0.88);
    ctx.restore();
  }
}

function drawMenu() {
  if (heroSelectBgImg) {
    const scale = Math.max(canvas.width / heroSelectBgImg.width, canvas.height / heroSelectBgImg.height);
    const dw = heroSelectBgImg.width * scale;
    const dh = heroSelectBgImg.height * scale;
    ctx.drawImage(heroSelectBgImg, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Subtle background vignette
  const vg = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 80, canvas.width/2, canvas.height/2, canvas.width*0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0.10)');
  vg.addColorStop(1, 'rgba(0,0,0,0.58)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#d8b45d';
  ctx.font = `700 ${Math.round(canvas.height * 0.052)}px 'Cinzel Decorative', serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 10;
  ctx.fillText('CHOOSE YOUR HERO', canvas.width / 2, 66);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(225,205,155,0.85)';
  ctx.font = `600 14px 'Cinzel', serif`;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(canvas.width / 2 - 190, 80, 380, 24);
  ctx.fillStyle = 'rgba(225,205,155,0.92)';
  ctx.fillText('Use arrows to choose, then press Enter', canvas.width / 2, 96);
  ctx.fillText('Press 1 · 2 · 3   or   ← → then Enter', canvas.width / 2, 94);

  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(canvas.width / 2 - 210, 80, 420, 26);
  ctx.fillStyle = 'rgba(225,205,155,0.95)';
  ctx.font = `600 14px 'Cinzel', serif`;
  ctx.fillText('Use arrows to choose, then press Enter', canvas.width / 2, 96);

  const PORTRAIT_H = 188;
  const cardW = 278, cardH = 456, gap = 40;
  const totalW = CLASSES.length * cardW + (CLASSES.length - 1) * gap;
  const startX = (canvas.width - totalW) / 2;
  const cardTop = Math.max(116, (GAME_HEIGHT - cardH) / 2 + 24);

  const portraits = { Barbarian: barbPortrait, Rogue: roguePortrait, Mage: magePortrait };

  CLASSES.forEach((cls, i) => {
    const cx = startX + i * (cardW + gap);
    const cy = cardTop;
    const sel = i === selectedClass;

    // Card background
    const wood = ctx.createLinearGradient(cx, cy, cx, cy + cardH);
    wood.addColorStop(0, sel ? '#5a3520' : '#3b2519');
    wood.addColorStop(0.48, sel ? '#2e1d14' : '#24170f');
    wood.addColorStop(1, sel ? '#6a4325' : '#3a2415');
    ctx.fillStyle = wood;
    ctx.fillRect(cx, cy, cardW, cardH);

    // ── Portrait section ─────────────────────────────────────────────────
    const portrait = portraits[cls.name];
    if (portrait) {
      // Clip portrait to top of card
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx, cy, cardW, PORTRAIT_H);
      ctx.clip();
      // Scale to fill width, center vertically
      const scale = cardW / portrait.width;
      const ph = portrait.height * scale;
      const py = cy + (PORTRAIT_H - ph) / 2;
      ctx.drawImage(portrait, cx, py, cardW, ph);
      ctx.restore();
    } else {
      // Placeholder for classes without a portrait yet
      const grad = ctx.createLinearGradient(cx, cy, cx, cy + PORTRAIT_H);
      grad.addColorStop(0, cls.color + '44');
      grad.addColorStop(1, '#24170f');
      ctx.fillStyle = grad;
      ctx.fillRect(cx, cy, cardW, PORTRAIT_H);
      ctx.fillStyle = cls.color + '88';
      ctx.font = 'bold 64px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(cls.name[0], cx + cardW / 2, cy + PORTRAIT_H / 2 + 22);
    }

    // Gradient fade at the bottom of the portrait into the card body
    const fade = ctx.createLinearGradient(cx, cy + PORTRAIT_H - 48, cx, cy + PORTRAIT_H);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, sel ? '#2e1d14' : '#24170f');
    ctx.fillStyle = fade;
    ctx.fillRect(cx, cy + PORTRAIT_H - 48, cardW, 48);

    // Card border (drawn over portrait)
    ctx.strokeStyle = sel ? cls.color : '#7a512e';
    ctx.lineWidth = sel ? 3 : 1;
    ctx.strokeRect(cx, cy, cardW, cardH);

    // Selected glow
    if (sel) {
      ctx.save();
      ctx.shadowColor = cls.color;
      ctx.shadowBlur = 22;
      ctx.strokeStyle = cls.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cardW, cardH);
      ctx.restore();
    }

    // ── Name ─────────────────────────────────────────────────────────────
    const nameY = cy + PORTRAIT_H + 26;
    ctx.fillStyle = cls.color;
    ctx.font = `700 ${sel ? 27 : 24}px 'Cinzel Decorative', serif`;
    ctx.textAlign = 'center';
    ctx.fillText(cls.name, cx + cardW / 2, nameY);

    // ── Description ──────────────────────────────────────────────────────
    ctx.fillStyle = '#d3c1a2'; ctx.font = `600 12px 'Cinzel', serif`;
    const words = cls.desc.split(' '), lines = [''];
    words.forEach(w => {
      const test = lines[lines.length - 1] + (lines[lines.length - 1] ? ' ' : '') + w;
      if (ctx.measureText(test).width < cardW - 24) lines[lines.length - 1] = test;
      else lines.push(w);
    });
    lines.forEach((l, li) => ctx.fillText(l, cx + cardW / 2, nameY + 20 + li * 16));

    // ── Stats ─────────────────────────────────────────────────────────────
    const sy = cy + PORTRAIT_H + 84;
    [
      { label: 'STR', val: cls.str, color: '#e74c3c' },
      { label: 'AGI', val: cls.agi, color: '#2ecc71' },
      { label: 'INT', val: cls.int, color: '#3498db' },
    ].forEach((s, si) => {
      const bar = (cardW - 72) * (s.val / 14);
      ctx.fillStyle = '#1b120d'; ctx.fillRect(cx + 36, sy + si * 26, cardW - 72, 12);
      ctx.fillStyle = s.color;   ctx.fillRect(cx + 36, sy + si * 26, bar, 12);
      ctx.fillStyle = '#ead9b9'; ctx.font = `700 11px 'Cinzel', serif`;
      ctx.textAlign = 'left';  ctx.fillText(s.label, cx + 8,  sy + si * 26 + 10);
      ctx.textAlign = 'right'; ctx.fillText(s.val,   cx + cardW - 6, sy + si * 26 + 10);
      ctx.textAlign = 'center';
    });

    // ── Summary line ─────────────────────────────────────────────────────
    const dspd = Math.round(2.5 * (1 + cls.agi * 0.05) * 10) / 10;
    const primaryText = `Primary: ${primaryStatLabel(cls.primaryStat)}`;
    ctx.fillStyle = '#d8c29a'; ctx.font = `600 11px 'Cinzel', serif`;
    ctx.fillText(`HP ${cls.str * 10}  ·  DMG ${cls[cls.primaryStat]}  ·  SPD ${dspd}`, cx + cardW / 2, sy + 88);

    // ── Abilities ────────────────────────────────────────────────────────
    ctx.fillStyle = '#ffd700'; ctx.font = `700 11px 'Cinzel', serif`;
    ctx.fillStyle = primaryStatColor(cls.primaryStat); ctx.font = `700 11px 'Cinzel', serif`;
    ctx.fillText(primaryText, cx + cardW / 2, sy + 104);
    ctx.fillStyle = '#f1d27a'; ctx.font = `700 11px 'Cinzel', serif`;
    ctx.fillText('Abilities', cx + cardW / 2, sy + 118);
    ctx.fillStyle = '#c7b08c'; ctx.font = `600 10px 'Cinzel', serif`;
    cls.abilityLabels.split('  ').forEach((l, li) =>
      ctx.fillText(l, cx + cardW / 2, sy + 132 + li * 14));
  });

  ctx.textAlign = 'left';
}

// Called when the class confirm splash should transition into the actual game
function launchConfirmedClass() {
  startGame(pendingClassIdx);
  if (devMode) {
    devSetupLevel = 1; devSetupStage = 1; devSetupSection = 0;
    devSkillAlloc = [0, 0, 0, 0]; devSkillCursor = 0;
    devStatAlloc = [0, 0, 0]; devStatCursor = 0;
    devTalentSlots = [-1, -1, -1]; devTalentCursor = 0; devPrimaryStat = null;
    devPendantCursor = 0; devSelectedPendants = devSelectedPendants.map(() => false);
    gameState = 'devsetup';
  }
}

function drawClassConfirm() {
  const W = canvas.width, H = canvas.height;
  const cls = CLASSES[pendingClassIdx];

  classConfirmTimer++;

  // Phase timings (frames @ 60fps)
  const FADE_IN  = 90;   // 1.5s fade from black
  const HOLD     = 240;  // 4s at full — time to admire + read prompt
  const FADE_OUT = 90;   // 1.5s fade to black, then game starts
  const TOTAL    = FADE_IN + HOLD + FADE_OUT;

  let alpha;
  if      (classConfirmTimer <= FADE_IN)             alpha = classConfirmTimer / FADE_IN;
  else if (classConfirmTimer <= FADE_IN + HOLD)      alpha = 1;
  else if (classConfirmTimer <= TOTAL)               alpha = 1 - (classConfirmTimer - FADE_IN - HOLD) / FADE_OUT;
  else    { launchConfirmedClass(); return; }

  // Always black canvas so fade reads correctly
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // ── Art cover-fitted, faded ──────────────────────────────────────────────
  const selectedImgs = { Barbarian: barbSelectedImg, Rogue: rogueSelectedImg, Mage: mageSelectedImg };
  const portraitImgs = { Barbarian: barbPortrait,    Rogue: roguePortrait,    Mage: magePortrait };
  const art = selectedImgs[cls.name] || portraitImgs[cls.name];

  if (art) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const scale = Math.max(W / art.width, H / art.height);
    const dw = art.width  * scale;
    const dh = art.height * scale;
    ctx.drawImage(art, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
  }

  // ── "Press any key" — appears after fade-in, blinks, fades with art ──────
  if (classConfirmTimer > FADE_IN && Math.floor(Date.now() / 550) % 2 === 0) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.textAlign   = 'center';
    ctx.font        = `400 ${Math.round(H * 0.022)}px 'Cinzel', serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = 'rgba(220,200,150,0.9)';
    ctx.fillText('Press any key to continue', W / 2, H * 0.9);
    ctx.restore();
  }
}

function drawPendantNotification() {
  if (!pendingPendant) return;
  drawMedievalScreenBackdrop(0.45);
  const pw = 380, ph = 200, px = (canvas.width - pw) / 2, py = (GAME_HEIGHT - ph) / 2;
  drawWoodPanel(px, py, pw, ph, pendingPendant.color, 3);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f1d27a'; ctx.font = `700 12px 'Cinzel', serif`;
  ctx.fillText('PENDANT ACQUIRED', px + pw/2, py + 22);
  ctx.fillStyle = pendingPendant.color; ctx.font = `700 22px 'Cinzel Decorative', serif`;
  ctx.fillText(`Pendant of ${pendingPendant.name}`, px + pw/2, py + 60);
  ctx.fillStyle = '#ead9b9'; ctx.font = `600 15px 'Cinzel', serif`;
  ctx.fillText(pendingPendant.desc, px + pw/2, py + 95);
  // Pendant icon
  ctx.fillStyle = pendingPendant.color;
  ctx.beginPath(); ctx.arc(px + pw/2, py + 140, 18, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#c7b08c'; ctx.font = `600 13px 'Cinzel', serif`;
  ctx.fillText('Press Enter or Space to continue', px + pw/2, py + 180);
  ctx.textAlign = 'left';
}

function drawMedievalScreenBackdrop(alpha = 0.55) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fillRect(0, 0, canvas.width, GAME_HEIGHT);
}

function drawWoodPanel(x, y, w, h, border = '#7a512e', lineWidth = 2) {
  const wood = ctx.createLinearGradient(x, y, x, y + h);
  wood.addColorStop(0, '#5a3520');
  wood.addColorStop(0.48, '#2e1d14');
  wood.addColorStop(1, '#6a4325');
  ctx.fillStyle = wood;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(x, y, w, h);
}

function drawMedievalHeading(text, y, size = 32, color = '#d8b45d') {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px 'Cinzel Decorative', serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 10;
  ctx.fillText(text, canvas.width / 2, y);
  ctx.restore();
}

function drawWrappedText(text, x, y, maxWidth, lineHeight, maxLines = 3, align = 'left') {
  const words = String(text || '').split(' ');
  let line = '';
  let lines = 0;
  ctx.textAlign = align;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      lines++;
      line = word;
      if (lines >= maxLines) return y;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y);
  return y + lineHeight;
}

function setFittingFont(text, maxWidth, baseSize, minSize, weight = 700, family = 'Cinzel') {
  let size = baseSize;
  do {
    ctx.font = `${weight} ${size}px '${family}', serif`;
    if (ctx.measureText(text).width <= maxWidth || size <= minSize) break;
    size--;
  } while (size > minSize);
  return size;
}

function drawCenteredWrappedText(text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = String(text || '').split(' ');
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      if (lines.length >= maxLines) break;
      line = word;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const drawn = lines.slice(0, maxLines);
  const displayedWords = drawn.join(' ').split(' ').filter(Boolean).length;
  if (displayedWords < words.length && drawn.length) {
    let last = drawn[drawn.length - 1];
    while (ctx.measureText(`${last}...`).width > maxWidth && last.length > 3) last = last.slice(0, -1);
    drawn[drawn.length - 1] = `${last}...`;
  }
  drawn.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineHeight));
  return y + drawn.length * lineHeight;
}

function drawLevelupSkill() {
  drawMedievalScreenBackdrop(0.56);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d8b45d'; ctx.font = `700 28px 'Cinzel Decorative', serif`;
  ctx.fillText(`LEVEL UP!  —  Level ${player.level}`, canvas.width/2, 55);
  ctx.fillStyle = '#d8c29a'; ctx.font = `600 14px 'Cinzel', serif`;
  ctx.fillText('Choose a skill to upgrade  ·  press 1  2  3 …', canvas.width/2, 82);

  const levelable = getLevelableSkills();
  const gap = 24;
  const cardW = Math.max(230, Math.min(300, (canvas.width - 96 - (levelable.length - 1) * gap) / Math.max(1, levelable.length)));
  const cardH = 176;
  const totalW = levelable.length * cardW + (levelable.length - 1) * gap;
  const startX = (canvas.width - totalW) / 2;
  const scaleText = `Scales with ${primaryStatLabel()} (${player[player.primaryStat]})`;
  ctx.fillStyle = primaryStatColor(player.primaryStat); ctx.font = `700 12px 'Cinzel', serif`;
  ctx.fillText(`Damage skills: ${scaleText}`, canvas.width/2, 99);

  levelable.forEach((ab, i) => {
    const cx = startX + i * (cardW + gap);
    const cy = 118;
    drawWoodPanel(cx, cy, cardW, cardH, ab.color, 2);

    const icon = skillIcons[player.className.toLowerCase() + '_' + ab.name] || skillIcons[ab.name];
    if (icon) {
      // Icon on left, text on right
      const iconSize = 72;
      const iconX = cx + 14, iconY = cy + 18;
      ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
      // Right column
      const tx = cx + iconSize + 28;
      const tW = cardW - iconSize - 42;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#d8b45d'; ctx.font = `700 17px 'Cinzel', serif`;
      ctx.fillText(`[${i+1}] ${ab.label} — ${ab.name.charAt(0).toUpperCase()+ab.name.slice(1)}`, tx, cy + 22);
      ctx.fillStyle = '#d8c29a'; ctx.font = `600 13px 'Cinzel', serif`;
      ctx.fillText(`Lv ${ab.level} → ${ab.level+1}  (max ${ab.maxLevel})`, tx, cy + 38);
      if (ab.damage > 0) {
        ctx.fillStyle = '#9ee070'; ctx.font = `700 13px 'Cinzel', serif`;
        ctx.fillText(`${ab.damage} → ${Math.round(ab.damage*1.3)} dmg`, tx, cy + 54);
      }
      if (ab.name === 'windwalk') {
        const nextBonus = Math.round((player[player.primaryStat] || 1) * windwalkBonusMult(ab.level + 1));
        ctx.fillStyle = '#9ee070'; ctx.font = `700 13px 'Cinzel', serif`;
        ctx.fillText(`Slash bonus: ${windwalkBonusDamage(ab)} -> ${nextBonus} dmg`, tx, cy + 54);
      }
      ctx.fillStyle = '#ead9b9'; ctx.font = `600 12px 'Cinzel', serif`;
      const words = ab.tooltip.split(' ');
      let line = '', lineY = cy + (ab.damage > 0 ? 70 : 58);
      if (ab.name === 'windwalk') lineY = cy + 70;
      words.forEach(w => {
        const test = line + (line ? ' ' : '') + w;
        if (ctx.measureText(test).width > tW) { ctx.fillText(line, tx, lineY); line = w; lineY += 12; }
        else line = test;
      });
      ctx.fillText(line, tx, lineY);
      ctx.textAlign = 'center';
    } else {
      // Fallback: centred layout (no icon)
      ctx.fillStyle = '#d8b45d'; ctx.font = `700 20px 'Cinzel', serif`;
      ctx.fillText(`[${i+1}]  ${ab.label}`, cx + cardW/2, cy + 28);
      ctx.fillStyle = '#f2e3bd'; ctx.font = `700 14px 'Cinzel', serif`;
      ctx.fillText(ab.name.charAt(0).toUpperCase() + ab.name.slice(1), cx + cardW/2, cy + 54);
      ctx.fillStyle = '#d8c29a'; ctx.font = `600 12px 'Cinzel', serif`;
      ctx.fillText(`Lv ${ab.level} → ${ab.level+1}  (max ${ab.maxLevel})`, cx + cardW/2, cy + 70);
      if (ab.damage > 0) {
        ctx.fillStyle = '#9ee070'; ctx.font = `700 11px 'Cinzel', serif`;
        ctx.fillText(`${ab.damage} → ${Math.round(ab.damage*1.3)} dmg  (+30%)`, cx + cardW/2, cy + 86);
      }
      if (ab.name === 'windwalk') {
        const nextBonus = Math.round((player[player.primaryStat] || 1) * windwalkBonusMult(ab.level + 1));
        ctx.fillStyle = '#9ee070'; ctx.font = `700 11px 'Cinzel', serif`;
        ctx.fillText(`Slash bonus: ${windwalkBonusDamage(ab)} -> ${nextBonus} dmg`, cx + cardW/2, cy + 86);
      }
      ctx.fillStyle = '#d8c29a'; ctx.font = `600 11px 'Cinzel', serif`;
      const words = ab.tooltip.split(' ');
      let line = '', lineY = cy + 94;
      words.forEach(w => {
        const test = line + (line ? ' ' : '') + w;
        if (ctx.measureText(test).width > cardW - 16) { ctx.fillText(line, cx+cardW/2, lineY); line = w; lineY += 13; }
        else line = test;
      });
      ctx.fillText(line, cx+cardW/2, lineY);
    }
  });

  // Also show maxed-out skills as greyed cards
  orderedAbilities(abilities.filter(a => a.level >= a.maxLevel)).forEach((ab, i) => {
    const cx = startX + (levelable.length + i) * (cardW + gap);
    if (cx + cardW > canvas.width) return;
    const cy = 118;
    drawWoodPanel(cx, cy, cardW, cardH, '#3b291c', 2);
    ctx.fillStyle = 'rgba(0,0,0,0.56)';
    ctx.fillRect(cx, cy, cardW, cardH);
    const icon = skillIcons[player.className.toLowerCase() + '_' + ab.name] || skillIcons[ab.name];
    if (icon) {
      ctx.save(); ctx.globalAlpha = 0.25;
      ctx.drawImage(icon, cx + 14, cy + 26, 72, 72);
      ctx.restore();
    }
    ctx.fillStyle = '#7d6a50'; ctx.font = `700 15px 'Cinzel', serif`;
    ctx.fillText(`${ab.label}: ${ab.name.charAt(0).toUpperCase() + ab.name.slice(1)}`, cx + cardW/2, cy + 44);
    ctx.fillStyle = '#d8b45d'; ctx.font = `700 13px 'Cinzel', serif`;
    ctx.fillText('MAX LEVEL', cx + cardW/2, cy + 65);
  });
  ctx.textAlign = 'left';
}

function drawLevelupStats() {
  drawMedievalScreenBackdrop(0.56);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d8b45d'; ctx.font = `700 26px 'Cinzel Decorative', serif`;
  ctx.fillText('DISTRIBUTE STAT POINTS', canvas.width/2, 55);
  ctx.fillStyle = '#d8c29a'; ctx.font = `600 14px 'Cinzel', serif`;
  ctx.fillText(`${levelupStatsLeft} point${levelupStatsLeft!==1?'s':''} remaining - arrows + Enter, 1/2/3, or Shift-click to spend all`, canvas.width/2, 82);

  const stats = [
    { key:'str', label:'STRENGTH', color:'#e74c3c', val: player.str, hint:'HP +10' },
    { key:'agi', label:'AGILITY',  color:'#2ecc71', val: player.agi, hint:'Move speed +5%' },
    { key:'int', label:'INTELLIGENCE', color:'#3498db', val: player.int, hint:'All cooldowns −0.25s' },
  ];
  const cW=200, cH=130, cGap=24, totW=3*cW+2*cGap;
  const sx = (canvas.width - totW) / 2;
  stats.forEach((s, i) => {
    const cx = sx + i*(cW+cGap), cy=108;
    const selected = i === levelupStatCursor;
    drawWoodPanel(cx, cy, cW, cH, selected ? '#f2e3bd' : s.color, selected ? 3 : 2);
    ctx.fillStyle = '#d8b45d'; ctx.font = `700 18px 'Cinzel', serif`;
    ctx.fillText(`[${i+1}]`, cx+cW/2, cy+26);
    ctx.fillStyle = s.color; ctx.font = `700 16px 'Cinzel', serif`;
    ctx.fillText(s.label, cx+cW/2, cy+52);
    ctx.fillStyle = '#f2e3bd'; ctx.font = `700 22px 'Cinzel', serif`;
    ctx.fillText(s.val, cx+cW/2, cy+80);
    ctx.fillStyle = '#d8c29a'; ctx.font = `600 12px 'Cinzel', serif`;
    ctx.fillText(s.hint, cx+cW/2, cy+105);
  });
  ctx.textAlign = 'left';
}

function drawPrimaryAttrPicker() {
  drawMedievalScreenBackdrop(0.58);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2ecc71'; ctx.font = `700 26px 'Cinzel Decorative', serif`;
  ctx.fillText('PLASTICITY — Choose Primary Attribute', canvas.width/2, 70);
  ctx.fillStyle = '#d8c29a'; ctx.font = `600 14px 'Cinzel', serif`;
  ctx.fillText('Your primary attribute determines base damage scaling  ·  press 1 2 3', canvas.width/2, 98);

  const stats = [
    { key:'str', label:'STRENGTH',     color:'#e74c3c', hint:'Melee power scales with STR' },
    { key:'agi', label:'AGILITY',      color:'#2ecc71', hint:'Speed & finesse scales with AGI' },
    { key:'int', label:'INTELLIGENCE', color:'#3498db', hint:'Skills scale with INT' },
  ];
  const cW=200, cH=130, cGap=24, totW=3*cW+2*cGap;
  const sx = (canvas.width - totW) / 2;
  stats.forEach((s, i) => {
    const cx = sx + i*(cW+cGap), cy=120;
    const isCurrent = player.primaryStat === s.key;
    drawWoodPanel(cx, cy, cW, cH, isCurrent ? '#d8b45d' : s.color, isCurrent ? 3 : 2);
    if (isCurrent) {
      ctx.fillStyle = 'rgba(46,204,113,0.14)';
      ctx.fillRect(cx, cy, cW, cH);
    }
    ctx.fillStyle = '#d8b45d'; ctx.font = `700 16px 'Cinzel', serif`;
    ctx.fillText(`[${i+1}]`, cx+cW/2, cy+24);
    if (isCurrent) { ctx.fillStyle='#d8b45d'; ctx.font=`700 11px 'Cinzel', serif`; ctx.fillText('CURRENT', cx+cW/2, cy+40); }
    ctx.fillStyle = s.color; ctx.font = `700 16px 'Cinzel', serif`;
    ctx.fillText(s.label, cx+cW/2, cy+60);
    ctx.fillStyle = '#f2e3bd'; ctx.font = `700 20px 'Cinzel', serif`;
    ctx.fillText(player[s.key], cx+cW/2, cy+88);
    ctx.fillStyle = '#d8c29a'; ctx.font = `600 12px 'Cinzel', serif`;
    ctx.fillText(s.hint, cx+cW/2, cy+112);
  });
  ctx.textAlign = 'left';
}

function getTransitionArt(stageNum) {
  if (stageNum === 2)  return golemTransitionArt;
  if (stageNum === 3)  return minotaurTransitionArt;
  if (stageNum === 4)  return skeletonCryptTransitionArt;
  if (stageNum === 5)  return orcTransitionArt;
  if (stageNum === 6)  return trollTransitionArt;
  if (stageNum === 7)  return ghoulPitTransitionArt;
  if (stageNum === 9)  return twinGuardianTransitionArt;
  if (stageNum === 10) return tribunalTransitionArt;
  return null;
}

function drawStageTransition() {
  if (transitionPhase === 'fade') {
    // Draw the frozen game world behind the fade
    drawMap();
    drawHazards();
    enemies.forEach(drawEnemy);
    enemies.forEach(drawFrostTint);
    drawUI();

    // Play gate sound as the black closes
    if (!transitionGatePlayed && transitionFade >= 0.45) {
      playsfx('heavyGate');
      transitionGatePlayed = true;
    }

    // Advancing black overlay
    transitionFade = Math.min(1, transitionFade + 1 / 45); // ~0.75s
    ctx.fillStyle = `rgba(0,0,0,${transitionFade})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (transitionFade >= 1) transitionPhase = 'art';
    return;
  }

  // Art phase — fullscreen stage reveal
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const art = getTransitionArt(transitionNextStage);
  if (art) {
    const scale = Math.max(canvas.width / art.width, canvas.height / art.height);
    const dw = art.width * scale, dh = art.height * scale;
    ctx.drawImage(art, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    // Subtle dark vignette over the art
    const vg = ctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.width*0.25, canvas.width/2, canvas.height/2, canvas.width*0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Blinking prompt
  if (Math.floor(Date.now() / 550) % 2 === 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 12;
    ctx.font = `bold ${Math.round(canvas.height * 0.032)}px 'Cinzel', serif`;
    ctx.fillStyle = 'rgba(255,245,200,0.92)';
    ctx.fillText('PRESS ANY KEY', canvas.width / 2, canvas.height * 0.90);
    ctx.restore();
  }
}

function drawJohnPorkIntro() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (johnPorkIntroImg) {
    const scale = Math.min(canvas.width / johnPorkIntroImg.width, canvas.height / johnPorkIntroImg.height);
    const dw = johnPorkIntroImg.width * scale;
    const dh = johnPorkIntroImg.height * scale;
    ctx.drawImage(johnPorkIntroImg, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
  }

  johnPorkIntroTimer--;
  if (johnPorkIntroTimer <= 0) finishJohnPorkIntro();
}

function drawGameOver() {
  drawMedievalScreenBackdrop(0.68);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b83a2f'; ctx.font = `700 56px 'Cinzel Decorative', serif`;
  ctx.fillText('YOU DIED', canvas.width / 2, canvas.height / 2 - 60);
  ctx.fillStyle = '#ead9b9'; ctx.font = `600 20px 'Cinzel', serif`;
  ctx.fillText(`Stage ${stage}  ·  Level ${player.level}`, canvas.width / 2, canvas.height / 2 - 14);
  ctx.fillStyle = '#c7b08c'; ctx.font = `600 15px 'Cinzel', serif`;
  ctx.fillText(devMode ? 'Any key → Title' : 'Any key → Title  (progress lost)', canvas.width / 2, canvas.height / 2 + 28);
  if (devMode) {
    drawWoodPanel(canvas.width/2 - 180, canvas.height/2 + 50, 360, 70, '#7a512e', 2);
    ctx.fillStyle = '#d8c29a'; ctx.font = `700 11px 'Cinzel', serif`;
    ctx.fillText('DEV MODE', canvas.width/2, canvas.height/2 + 68);
    ctx.fillStyle = '#9ee070'; ctx.font = `600 14px 'Cinzel', serif`;
    ctx.fillText('[R] Respawn at this stage', canvas.width/2, canvas.height/2 + 90);
    ctx.fillStyle = '#8fc8f4'; ctx.font = `600 14px 'Cinzel', serif`;
    ctx.fillText('[S] Skip to next stage', canvas.width/2, canvas.height/2 + 110);
  }
  ctx.textAlign = 'left';
}

// ── Loop ──────────────────────────────────────────────────────────────────────

function loop() {
  if (gameState === 'title') {
    drawTitle();
  } else if (gameState === 'classconfirm') {
    drawClassConfirm();
  } else if (gameState === 'devsetup') {
    drawDevSetup();
  } else if (gameState === 'win') {
    drawWin();
  } else if (gameState === 'menu') {
    drawMenu();
  } else if (gameState === 'stagetransition') {
    drawStageTransition();
  } else if (gameState === 'johnporkintro') {
    drawJohnPorkIntro();
  } else {
    if (gameState === 'playing') update();
    drawMap();
    drawHazards();
    enemies.forEach(drawEnemy);
    enemies.forEach(drawFrostTint);
    drawProjectiles();
    drawSpellEffects();
    drawPlayer();
    drawMarkers();
    drawUI();
    if (gameState === 'levelup') {
      if (levelupPhase === 'skill')          drawLevelupSkill();
      else if (levelupPhase === 'stats')     drawLevelupStats();
      else if (levelupPhase === 'talent')    drawTalentScreen();
      else if (levelupPhase === 'talentConfirm') drawTalentConfirm();
      else if (levelupPhase === 'primattr')  drawPrimaryAttrPicker();
    }
    if (gameState === 'pendant')     drawPendantNotification();
    if (gameState === 'stagechoice') drawStageChoice();
    if (gameState === 'stageclear') drawStageStats();
    if (gameState === 'gameover')   drawGameOver();
  }
  requestAnimationFrame(loop);
}

