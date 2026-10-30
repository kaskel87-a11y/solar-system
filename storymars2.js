// v7.5 Mars story, part 2 (Jeff): the Rook finale and three new street chains across the Mars city districts.
//   rook-05-withdrawal  The Big Withdrawal: rob the First Junction Trust vault (Olympus Row) with the crew hired in rook-04.
//                       Runs on Ben's SSX.heist (registerHeist / startHeist, his safe-crack dial, cameras, alarm, applyTip,
//                       heist:escape) and the bank interior's vault door. Unlocked by Rook's barter offer
//                       rook-product-unlock-withdrawal (2 Quiet ledger chips), which was inert until now.
//   Doc Grieve (Red Tape Flats)     grieve-01..04  a struck-off surgeon patching gangsters, a bad Low-G batch, a ColSec raid.
//   Counselor Wolde (Olympus Row)   wolde-01..03   a crooked defence lawyer: a witness, an evidence-locker heist, a verdict.
//   Cassius Thorne (Helios Heights) thorne-01..03  a trust-fund idiot who wants to be a gangster: a stolen bike, a party, a ransom.
// Core step types (goto/defeat/take/clean/crack/race) run in game.js; this file drives the custom ones (hold, tail, escort,
// heist, raid, pick) and every external hook is feature-detected: SSX.heist, SSX.contraband, SSX.bark/registerBarks,
// SSX.garage, SSX.raids, SSX.danger. Missing module = a plain fallback, never a dead step.
// Import with plain relative paths (no ?v=): index.html's import map adds the version. Side-effect module: missions and
// contacts register at import, the runner starts once window.__app has a game.
import * as GM from './game.js';
import * as W from './world.js';
import { buildHuman, BARTER_STORY, DEFERRED } from './storymars.js';
import { CITY_DISTRICTS } from './city.js';
import { tap as hookTap } from './planets/hooks.js';
import { jobPay, boost } from './economy.js'; // money boost: SSX.economy.payoutMult (boost() keeps the '+N cr' labels = what's paid)

const MOBILE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const nextStep = g => (typeof g.advanceStep === 'function' ? g.advanceStep() : g.debug.advance());
const X = () => (typeof window !== 'undefined' && window.SSX) || {};
const toast = (app, t, ms = 3000) => { try { (X().city?.toast || app?.toast)?.(t, ms); } catch (e) { /* optional */ } };
const radio = (app, text, who) => { try { if (X().city?.radio) X().city.radio(text, who); else app?.toast?.('\ud83d\udcfb ' + text, 4200); } catch (e) { /* optional */ } };
const bark = (who, line) => { try { X().bark?.(who, line, { force: true }); } catch (e) { /* optional */ } };
const tapEl = (el, fn) => (typeof window !== 'undefined' && typeof window.__onTap === 'function' ? window.__onTap(el, fn) : hookTap(el, fn));
function failJob(app, g, why) {
  if (typeof g.failStep === 'function') return g.failStep(why);
  const q = g.info?.quest; g.abandon(); toast(app, `\u274c ${q ? q.title + ': ' : ''}${why} Talk to them again to retry.`, 4200);
}

// ---------- extra human wave types (Saltblood/Sable/bank types come from storymars.js) ----------
export const TYPES2 = {
  jacker: { name: 'Jacker', hp: 6, speed: 7, hover: 0, r: 0.8, cy: 1.15, attack: 'shoot', dmg: 5, burst: 2, cd: 2.1, range: 30, keep: 12, xp: 16, credits: 14, flank: true, human: true },
  hitter: { name: 'Contract hitter', hp: 16, armor: 0.25, speed: 5.5, hover: 0, r: 0.95, cy: 1.3, scale: 1.15, attack: 'shoot', dmg: 9, burst: 3, cd: 2.3, range: 36, keep: 11, xp: 40, credits: 35, human: true },
  colsec: { name: 'ColSec officer', hp: 10, armor: 0.3, speed: 6.2, hover: 0, r: 0.85, cy: 1.15, attack: 'shoot', dmg: 8, burst: 3, cd: 2.2, range: 38, keep: 13, xp: 28, credits: 20, flank: true, human: true }
};
const LOOK = { jacker: 'goon', hitter: 'enforcer', colsec: 'squad' };
for (const [t, T] of Object.entries(TYPES2)) GM.registerAgentType?.(t, T, () => buildHuman(LOOK[t]));

// ---------- new contacts (district-local metres; spawned by world.js with the district) ----------
const DIST = { flats: 'mars-rough', row: 'mars-downtown', heights: 'mars-gated' };
export const CONTACTS2 = {
  flats: { name: 'Doc Grieve', at: [-40, 4], blurb: 'Struck-off surgeon. Back-room clinic, steady hands, no questions, no licence.' },
  row: { name: 'Counselor Wolde', at: [-8, 20], blurb: 'Defence lawyer. Never lost a case he was paid enough to win.' },
  heights: { name: 'Cassius Thorne', at: [10, 14], blurb: 'Trust-fund heir. Wants to be a gangster. Has a tennis lesson at four.' }
};
for (const [k, c] of Object.entries(CONTACTS2)) { const D = CITY_DISTRICTS[DIST[k]]; if (D && !(D.contacts ||= []).some(x => x.name === c.name)) D.contacts.push({ ...c }); }

// ---------- the missions (AJ-relative metres: Olympus Row ~[0,-430], Red Tape Flats ~[-280,-40], Helios Heights ~[320,80]) ----------
const ROOK_ID = 'rook-05-withdrawal', BANK = 'FIRST JUNCTION TRUST';
const ROW = (x, z) => [x, z - 430], FLATS = (x, z) => [x - 280, z - 40], HTS = (x, z) => [x + 320, z + 80];
const M = (def) => ({ world: 'Mars', fiction: true, story: true, storymars2: true, city: true, ...def });
export const MISSIONS2 = [
  M({ id: ROOK_ID, contact: 'Rook', title: 'The Big Withdrawal', city: false, district: DIST.row,
    requires: ['rook-04-crew', ROOK_ID],
    intro: 'Rook: Tonight we rob the Quiet\u2019s bank. First Junction Trust, Olympus Row. Drill, grab, run. Do not get greedy. Every guard in the Row is about to hate you.',
    success: 'Rook: We\u2019re rich. Now we\u2019re targets.', failLine: 'Rook: Vault\u2019s blown, crew\u2019s scattered. Run.',
    reward: { xp: 500, credits: 5000, badge: 'Withdrawal Slip' },
    steps: [
      { type: 'goto', at: [18, -416], r: 4, text: 'Meet your crew in the Red Planet Noodle back booth' },
      { type: 'heist', heist: 'rook', advanceOn: 'crack', text: 'Hit the First Junction Trust vault' },
      { type: 'crack', building: BANK, id: 'bank-vault', difficulty: 3, loot: 0, text: 'Crack the vault' },
      { type: 'hold', at: 'bankdoor', r: 12, seconds: 30, wave: ['guard', 'guard', 'squad'], text: 'Hold the bank steps while the crew loads the van' },
      { type: 'goto', at: FLATS(-26, -24), r: 6, vehicle: 'any', wanted: 3, text: 'Drive the take to the Red Tape Flats lockup' },
      { type: 'pick', who: 'Rook', text: 'Decide what happens with Rook and the ledger', prompt: 'Under the cash: the Quiet\u2019s black ledger. Then Rook raises his gun. He\u2019s worked for Mr. Sable all along.',
        options: [
          { id: 'take_cut', label: 'Take the cut, give Rook the ledger (+2000 cr)', credits: 2000, flag: 'rook_loyal_to_sable', line: 'Rook: Smart. Paper gets people killed.' },
          { id: 'talk', label: 'Talk him down, keep the ledger', flag: ['ledger', 'rook_turned'], line: 'Rook: \u2026Fine. I always hated the old man.' },
          { id: 'shoot', label: 'Shoot Rook first', flag: ['ledger', 'rook_dead'], wanted: 1, line: 'Rook: Should\u2019ve asked a question.' }] },
      { type: 'clean', text: 'Lose the heat' }] }),
  M({ id: 'grieve-01-house-call', contact: 'Doc Grieve', title: 'House Call', district: DIST.flats,
    intro: 'Doc Grieve: I lost my licence, not my hands. A Saltblood kid is leaking behind the ration plant and the jackers who shot him are circling back. Bring my bag. Run.',
    success: 'Doc Grieve: He\u2019ll live. He\u2019ll owe me. Everybody owes me.', failLine: 'Doc Grieve: Great. Now I need a shovel, not a needle.',
    reward: { xp: 120, credits: 500 },
    steps: [
      { type: 'goto', at: FLATS(-37, 7), r: 3, item: 'medbag', text: 'Grab Doc\u2019s surgical bag' },
      { type: 'goto', at: FLATS(28, 30), r: 5, text: 'Get the bag to the kid behind the ration plant' },
      { type: 'hold', at: FLATS(28, 30), r: 12, seconds: 30, wave: ['jacker', 'jacker', 'jacker'], bark: 'Doc Grieve: Hold still. Somebody shoot those idiots.', text: 'Keep the jackers off while Doc stitches' }] }),
  M({ id: 'grieve-02-cold-chain', contact: 'Doc Grieve', title: 'Cold Chain', district: DIST.flats, requires: ['grieve-01-house-call'],
    intro: 'Doc Grieve: ColSec impounded my cold van. Forty units of plasma and a case of Low-G I was holding for a friend. Olympus Row impound row. Bring a hot ride home.',
    success: 'Doc Grieve: Plasma\u2019s still cold. You\u2019re useful. Don\u2019t let it go to your head.', failLine: 'Doc Grieve: The plasma\u2019s warm and so are the cops.',
    reward: { xp: 160, credits: 900 },
    steps: [
      { type: 'goto', at: ROW(-46, -18), r: 9, text: 'Get to the Olympus Row impound row' },
      { type: 'take', text: 'Hotwire a ride off the impound row' },
      { type: 'goto', at: FLATS(-36, 8), r: 6, vehicle: 'stolen', wanted: 2, text: 'Drive it to Doc\u2019s back door' },
      { type: 'clean', text: 'Lose ColSec' }],
    onDone: app => { if (addItem('lowg', 3)) toast(app, '\ud83c\udf88 Doc Grieve: Three Low-G caps, on the house. I\u2019m a doctor.', 3600); } }),
  M({ id: 'grieve-03-bad-batch', contact: 'Doc Grieve', title: 'Bad Batch', district: DIST.flats, requires: ['grieve-02-cold-chain'],
    intro: 'Doc Grieve: Three kids on my table tonight, lips blue, all on the same Low-G. Somebody\u2019s cutting it with rover coolant. Follow the courier, find the cook, make it stop.',
    success: 'Doc Grieve: No new blue lips tonight. That\u2019s the closest thing to a cure this place gets.', failLine: 'Doc Grieve: The cook\u2019s still cooking. Kids are still dropping.',
    reward: { xp: 220, credits: 1300 },
    steps: [
      { type: 'goto', at: FLATS(14, 20), r: 5, text: 'Find the courier at the Flats noodle cart' },
      { type: 'tail', vehicle: 'buggy', speed: 6, path: [FLATS(12, 14), FLATS(20, -6), FLATS(34, -18), FLATS(36, -28)], close: 6, lose: 50, text: 'Tail the courier\u2019s buggy (not too close)' },
      { type: 'defeat', at: FLATS(36, -28), r: 8, wave: ['jacker', 'jacker', 'hitter'], text: 'Take out the cook\u2019s crew' },
      { type: 'pick', who: 'Doc Grieve', text: 'Decide what happens to the cook', prompt: 'The cook is on his knees in a puddle of coolant, begging.',
        options: [
          { id: 'execute', label: 'Execute him', flag: 'sm2:cook_dead', wanted: 2, line: 'Doc Grieve: \u2026Good. I\u2019ll sleep. Eventually.' },
          { id: 'sell', label: 'Sell him to Saltblood (+600 cr)', credits: 600, flag: 'sm2:cook_sold', line: 'Saltblood drag him off by the ankles. You don\u2019t ask.' },
          { id: 'hire', label: 'Put him to work for Doc', flag: 'sm2:cook_hired', line: 'Doc Grieve: A chemist? I\u2019ve always wanted a chemist.' }] }] }),
  M({ id: 'grieve-04-malpractice', contact: 'Doc Grieve', title: 'Malpractice', district: DIST.flats, requires: ['grieve-03-bad-batch'],
    intro: 'Doc Grieve: ColSec found the clinic. Somebody talked. They\u2019re coming with a battering ram and no warrant. Hold the door, then walk me to the Saltblood safehouse.',
    success: 'Doc Grieve: New clinic, same blood. You\u2019re on my speed dial.', failLine: 'Doc Grieve: They\u2019ve got my hands in cuffs. These hands were worth something.',
    reward: { xp: 320, credits: 2200 },
    steps: [
      { type: 'raid', at: FLATS(-40, 4), r: 16, attackers: 'colsec', waves: 2, wave: ['colsec', 'colsec', 'colsec'], seconds: 40, text: 'Hold Doc\u2019s clinic against the ColSec raid' },
      { type: 'escort', who: 'Doc Grieve', look: 'accountant', at: FLATS(6, -30), r: 7, wave: ['colsec', 'colsec'], text: 'Walk Doc to the Saltblood safehouse' }],
    onDone: app => radio(app, 'Doc Grieve: Bring me product and I\u2019ll bring you miracles. Two Glow-dust wipes a star off your sheet. Four Low-G and Saltblood walk with you.', 'Doc Grieve') }),
  M({ id: 'wolde-01-witness', contact: 'Counselor Wolde', title: 'Hostile Witness', district: DIST.row,
    intro: 'Counselor Wolde: My client Dez Kincaid is innocent until somebody testifies. A dock clerk named Pruitt is in a ColSec van right now. Follow it. Make sure Pruitt forgets what he saw.',
    success: 'Counselor Wolde: The prosecution just lost its favourite clerk. I\u2019ll bill them for my time.', failLine: 'Counselor Wolde: Pruitt is singing. I hate musicals.',
    reward: { xp: 180, credits: 1000 },
    steps: [
      { type: 'goto', at: ROW(-34, 24), r: 6, text: 'Wait outside ColSec Downtown' },
      { type: 'tail', vehicle: 'hauler', speed: 8, path: [ROW(-34, 30), ROW(-62, 86), ROW(-140, 194), ROW(-218, 302), FLATS(18, -38)], close: 6, lose: 60, text: 'Tail the ColSec van (stay back)' },
      { type: 'defeat', at: FLATS(18, -38), r: 8, wave: ['colsec', 'colsec'], text: 'Drop Pruitt\u2019s ColSec babysitters' },
      { type: 'pick', who: 'Counselor Wolde', text: 'Deal with Pruitt', prompt: 'Pruitt is shaking behind the van door, holding his statement like a shield.',
        options: [
          { id: 'scare', label: 'Put the fear of Wolde in him', flag: 'sm2:pruitt_scared', line: 'Pruitt: I didn\u2019t see anything. I don\u2019t even have eyes.' },
          { id: 'buy', label: 'Pay him to leave Mars (800 cr)', cost: 800, flag: 'sm2:pruitt_bought', line: 'Counselor Wolde: Money well spent. Yours, specifically.' },
          { id: 'bury', label: 'Make sure he never testifies', flag: 'sm2:pruitt_dead', wanted: 3, line: 'Counselor Wolde: I didn\u2019t hear that. I bill by the hour, not by the body.' }] }] }),
  M({ id: 'wolde-02-discovery', contact: 'Counselor Wolde', title: 'Discovery', district: DIST.row, requires: ['wolde-01-witness'],
    intro: 'Counselor Wolde: The whole case sits on one evidence drive in the ColSec impound locker. I can\u2019t lose it. You can. Cameras, a fuse box, a locker. Case it, cut it, crack it.',
    success: 'Counselor Wolde: No drive, no case. Justice is blind, and now she\u2019s deaf too.', failLine: 'Counselor Wolde: You set off every alarm in the Row. Subtle as a brick.',
    reward: { xp: 240, credits: 1500 },
    steps: [
      { type: 'heist', heist: 'impound', text: 'Lift the evidence drive from the ColSec impound locker' },
      { type: 'clean', text: 'Lose the heat' }],
    onDone: app => { if (addItem('ledger_chip', 2)) toast(app, '\ud83d\udcce Two Quiet ledger chips were taped behind the drive. Rook will want those.', 4200); } }),
  M({ id: 'wolde-03-verdict', contact: 'Counselor Wolde', title: 'Not Guilty', district: DIST.row, requires: ['wolde-02-discovery'],
    intro: 'Counselor Wolde: Not guilty. Dez walks out of the precinct in ten minutes and every cop in the Row wants a word with him. Get him to the Flats breathing. Then we talk about what he knows.',
    success: 'Counselor Wolde: Case closed. Pleasure doing crimes with you.', failLine: 'Counselor Wolde: My client is dead. Do you know what that does to my win rate?',
    reward: { xp: 360, credits: 2600 },
    steps: [
      { type: 'goto', at: ROW(-30, 28), r: 5, text: 'Meet Dez outside the precinct' },
      { type: 'escort', who: 'Dez Kincaid', look: 'suit', at: FLATS(20, -30), r: 7, wanted: 3, backup: true, wave: ['colsec', 'colsec', 'sdrone'], text: 'Get Dez to the Flats alive' },
      { type: 'pick', who: 'Counselor Wolde', text: 'Decide what happens to Dez', prompt: 'Wolde on the radio: Dez is going to flip. Next arrest, he trades me for a lighter sentence. End it.',
        options: [
          { id: 'kill', label: 'Do what the lawyer says (+1500 cr)', credits: 1500, flag: 'sm2:dez_dead', line: 'Counselor Wolde: Billable. Beautifully billable.' },
          { id: 'warn', label: 'Tip Dez off and let him run', flag: 'sm2:dez_warned', give: 'bike', line: 'Dez: Keys to my bike. No plates. I owe you my teeth.' },
          { id: 'sell', label: 'Sell them both to ColSec', flag: 'sm2:wolde_sold', clearWanted: true, line: 'ColSec: Two scumbags for one phone call. Your sheet\u2019s clean. Today.' }] }] }),
  M({ id: 'thorne-01-repo', contact: 'Cassius Thorne', title: 'Daddy\u2019s Hoverbike', district: DIST.heights,
    intro: 'Cassius Thorne: Bro. BRO. Some Flats jackers boosted my hoverbike outside a vape lounge. My father thinks I\u2019m at tennis. Get it back before he checks the trackers.',
    success: 'Cassius Thorne: You\u2019re like a big brother, if my big brother wasn\u2019t a disappointment.', failLine: 'Cassius Thorne: Dad\u2019s going to cut my allowance. Again. To, like, eight thousand.',
    reward: { xp: 140, credits: 700 },
    steps: [
      { type: 'goto', at: FLATS(-6, -36), r: 10, text: 'Find the jackers\u2019 lot in Red Tape Flats' },
      { type: 'defeat', at: FLATS(-6, -36), r: 8, wave: ['jacker', 'jacker', 'jacker'], text: 'Teach the jackers some manners' },
      { type: 'take', text: 'Grab a ride off their lot' },
      { type: 'goto', at: HTS(10, 18), r: 6, vehicle: 'stolen', wanted: 1, text: 'Bring it back to Cassius in Helios Heights' }],
    onDone: app => giveRide(app, 'Cassius Thorne: Keep the bike. I\u2019ve got four. Dad thinks it\u2019s three.') }),
  M({ id: 'thorne-02-party', contact: 'Cassius Thorne', title: 'House Party', district: DIST.heights, requires: ['thorne-01-repo'],
    intro: 'Cassius Thorne: I\u2019m throwing a party and the guest list is everyone my father hates. I need Void Honey from a guy at the Meridian 1 dock, fast. Then I need you at the door looking scary.',
    success: 'Cassius Thorne: Best party in Heights history. Someone fell in the koi pond. It was me.', failLine: 'Cassius Thorne: The party\u2019s dead. Worse, it\u2019s boring.',
    reward: { xp: 200, credits: 1200 },
    steps: [
      { type: 'goto', at: ROW(30, -30), r: 3, item: 'contraband', text: 'Pick up the Void Honey at the Meridian 1 dock' },
      { type: 'goto', at: HTS(44, 8), r: 6, limit: 150, text: 'Get it to the Thorne villa before the guests sober up' },
      { type: 'raid', at: HTS(44, 8), r: 16, attackers: 'gang', waves: 2, wave: ['jacker', 'jacker', 'hitter'], seconds: 35, text: 'Bounce the gatecrashers' }],
    onDone: app => { if (addItem('voidhoney', 1)) toast(app, '\ud83c\udf6f Cassius slips you a vial of Void Honey. \u201cParty favour, bro.\u201d', 3600); } }),
  M({ id: 'thorne-03-ransom', contact: 'Cassius Thorne', title: 'Kidnap Myself', district: DIST.heights, requires: ['thorne-02-party'],
    intro: 'Cassius Thorne: Dad cut my allowance, so I\u2019ve been kidnapped. Tragic. The ransom drops on a bench in Olympus Row. Grab it, lose whoever he sends, we split it. This is basically a business degree.',
    success: 'Cassius Thorne: Best kidnapping ever. Five stars. Would get kidnapped again.', failLine: 'Cassius Thorne: Dad found out. I\u2019m grounded. I\u2019m twenty-six.',
    reward: { xp: 300, credits: 1800 },
    steps: [
      { type: 'goto', at: ROW(24, 30), r: 3, item: 'contraband', wanted: 2, text: 'Grab the ransom bag off the bench (it\u2019s watched)' },
      { type: 'race', pts: [ROW(60, 60), ROW(140, 180), HTS(-90, -190), HTS(-20, -60)], pursuers: ['sbuggy', 'sbuggy'], text: 'Shake the Thorne family\u2019s hired guns' },
      { type: 'pick', who: 'Cassius Thorne', text: 'Settle the ransom with Cassius', prompt: 'Cassius at the villa gate, grinning: \u201cFifty-fifty, partner?\u201d',
        options: [
          { id: 'split', label: 'Split it fifty-fifty (+1500 cr)', credits: 1500, flag: 'sm2:thorne_split', line: 'Cassius Thorne: Partners! I\u2019m getting us matching jackets.' },
          { id: 'all', label: 'Take the whole bag (+3000 cr, 3\u2605)', credits: 3000, wanted: 3, flag: 'sm2:thorne_burned', line: 'Cassius Thorne: You\u2019re robbing my kidnapping? That\u2019s so cool. I hate you.' },
          { id: 'return', label: 'Give the bag back to his father', credits: 500, flag: 'sm2:thorne_dad', give: 'engine', line: 'Mr. Thorne: My son\u2019s an idiot. You\u2019re not. My mechanic will see you.' }] },
      { type: 'clean', text: 'Lose the heat' }] })
];
const PICK_TEXT = s => (s.who ? `Make the call (${s.who})` : 'Make the call');
for (const q of MISSIONS2) for (const s of q.steps) if (!s.text) s.text = s.type === 'pick' ? PICK_TEXT(s) : 'Next step'; // the tracker prints step.text
for (const q of MISSIONS2) { GM.registerMission(q); const i = GM.STORY_DEFERRED.indexOf(q.id); if (i >= 0) GM.STORY_DEFERRED.splice(i, 1); }
delete DEFERRED[ROOK_ID];
BARTER_STORY['rook-product-unlock-withdrawal'] = ROOK_ID;

// ---------- hooks into other add-ons (all optional) ----------
function addItem(item, n) { const C = X().contraband; if (!C?.add) return false; try { const r = C.add(item, n); return r !== false && r?.ok !== false; } catch (e) { return false; } }
function giveRide(app, line, kind = 'hoverbike') {
  const G = X().garage; let r = null;
  if (G?.grantVehicle) { try { r = G.grantVehicle(kind, { noPlates: true }); } catch (e) { r = null; } }
  if (r && r.ok !== false) toast(app, `\ud83d\udd11 ${line} ${r.msg || ''}`.trim(), 4200);
  else { app.game?.reward?.(0, 400); toast(app, `\ud83d\udcb8 ${line.split(':')[0]}: No garage for it, so here\u2019s 400 cr instead.`, 3600); }
}
function giveUpgrade(app, slot = 'engine') {
  const G = X().garage; let r = null;
  if (G?.grantUpgrade) { try { r = G.grantUpgrade('current', slot, 1); } catch (e) { r = null; } }
  if (r && r.ok !== false) toast(app, `\ud83d\udd27 ${r.msg || slot + ' upgrade fitted.'}`, 3600);
  else { app.game?.reward?.(0, 600); toast(app, '\ud83d\udcb8 No garage in this build: +600 cr for parts instead.', 3200); }
}
// barter offers (Marsmania's SSX.contraband.registerOffer). Fictional product only.
export const OFFERS2 = [
  { id: 'grieve-death-certificate', npc: 'Doc Grieve', district: 'red_tape_flats', location: FLATS(-37, 1), wants: [{ item: 'glowdust', qty: 2 }],
    gives: { type: 'wanted_clear', stars: 1 }, cooldownSec: 600, rep: { missions_done: ['grieve-02-cold-chain'] },
    lines: { offer: 'Doc Grieve: Two baggies and I sign your death certificate. ColSec stops chasing dead people.', accept: 'Doc Grieve: Time of death: now. Congratulations.', decline: 'Doc Grieve: Pay the doctor.' } },
  { id: 'grieve-saltblood-favour', npc: 'Doc Grieve', district: 'red_tape_flats', location: FLATS(-37, 1), wants: [{ item: 'lowg', qty: 4 }],
    gives: { type: 'custom', label: 'Saltblood escort (3)' }, cooldownSec: 900, rep: { missions_done: ['grieve-04-malpractice'] },
    lines: { offer: 'Doc Grieve: Saltblood owe me stitches. Four caps and three of them walk with you.', accept: 'Doc Grieve: They\u2019re yours till the stitches itch.' },
    onTrade: () => { const D = X().danger; if (typeof D?.spawnBackup !== 'function') return { ok: false, msg: 'Doc Grieve: Saltblood aren\u2019t answering. Keep your caps.' }; try { const r = D.spawnBackup({ faction: 'saltblood', count: 3, durationSec: 150 }); return r && r.ok === false ? { ok: false, msg: 'Doc Grieve: Nobody free right now. Keep your caps.' } : { msg: 'Doc Grieve: Three Saltblood, two and a half minutes. Don\u2019t get them killed.' }; } catch (e) { return { ok: false, msg: 'Doc Grieve: No luck. Keep your caps.' }; } } },
  { id: 'wolde-judges-nephew', npc: 'Counselor Wolde', district: 'olympus_row', location: ROW(-5, 23), wants: [{ item: 'voidhoney', qty: 1 }],
    gives: { type: 'wanted_clear', stars: 2 }, cooldownSec: 900, rep: { missions_done: ['wolde-02-discovery'] },
    lines: { offer: 'Counselor Wolde: Void Honey for the judge\u2019s nephew and two stars fall off your sheet.', accept: 'Counselor Wolde: The nephew sends his regards. Slurred, but sincere.' } },
  { id: 'thorne-spare-bike', npc: 'Cassius Thorne', district: 'helios_heights', location: HTS(13, 17), wants: [{ item: 'voidhoney', qty: 2 }],
    gives: { type: 'custom', text: 'No-plates hoverbike' }, onTrade: () => { if (app0) giveRide(app0, 'Cassius Thorne: A ride, no plates.', 'hoverbike'); return { ok: true }; }, cooldownSec: 1800, rep: { missions_done: ['thorne-01-repo'] },
    lines: { offer: 'Cassius Thorne: Two Void Honey and I \u201close\u201d another bike. Dad won\u2019t notice.', accept: 'Cassius Thorne: Oops, I lost it. Sad face.' } },
  { id: 'thorne-dads-mechanic', npc: 'Cassius Thorne', district: 'helios_heights', location: HTS(13, 17), wants: [{ item: 'glowdust', qty: 3 }],
    gives: { type: 'custom', text: 'Illegal engine tune' }, onTrade: () => { if (app0) giveUpgrade(app0, 'engine'); return { ok: true }; }, cooldownSec: 1800, rep: { missions_done: ['thorne-02-party'] },
    lines: { offer: 'Cassius Thorne: Three baggies and Dad\u2019s mechanic bolts something illegal on your ride.', accept: 'Cassius Thorne: Vroom. That\u2019s the technical term.' } }
];
export const BARKS2 = {
  flats: ['Doc Grieve stitched my brother with fishing line. Held, too.', 'Somebody\u2019s cutting Low-G with coolant. Don\u2019t buy blue caps.', 'Doc don\u2019t take credits. Doc takes favours.'],
  downtown: ['Wolde got a Saltblood off on a technicality. The technicality was a witness.', 'First Junction triple-checks the vault now. Rumour says somebody\u2019s coming.', 'ColSec impound lost another evidence drive. Shocking.'],
  heights: ['The Thorne boy crashed another hoverbike into the koi pond.', 'Cassius says he\u2019s in a gang now. His gang has a tennis coach.', 'Old Thorne pays his security more than ColSec pays its captains.']
};
const H2 = { offers: new Set(), barks: false };
function hookCheck() {
  const C = X().contraband;
  if (C?.registerOffer) for (const o of OFFERS2) { if (H2.offers.has(o.id)) continue; try { if (!C.offer?.(o.id)) C.registerOffer({ ...o }); H2.offers.add(o.id); } catch (e) { console.warn('storymars2 offer', o.id, e); H2.offers.add(o.id); } }
  if (!H2.barks && typeof X().registerBarks === 'function') { H2.barks = true; for (const [cat, lines] of Object.entries(BARKS2)) { try { X().registerBarks(cat, lines); } catch (e) { /* optional */ } } }
}

// ---------- heists (Ben's SSX.heist): defs are built when the step starts, from the live door positions ----------
const relTo = (app, p) => { const c = app.surface.world.colonyAt([0, 0]); return { x: +(p.x - c.x).toFixed(2), z: +(p.z - c.z).toFixed(2) }; };
const nudge = (app, x, z, r = 1) => { const w = app.surface.world, c = w.colonyAt([0, 0]), f = w.freeSpot?.(c.x + x, c.z + z, r); return f ? relTo(app, f) : { x, z }; };
const camAt = (id, x, z, tx, tz, label, range = 12, phase = 0) => ({ id, x, z, yaw: Math.atan2(tx - x, tz - z), fov: 70, range, sweep: 30, phase, label });
const crew = (g, k) => { for (const v of ({ quality: ['pros', 'cheap'], driller: ['ozzie', 'drunk'], hacker: ['penny', 'halo'], wheel: ['kestrel', 'self'] })[k]) if (g.flag(`story:rook-04-crew:${k}=${v}`)) return v; return null; };
// The Trust's vault is inside the bank interior, and interiors float above the colony centre (Ares Junction), so the
// vault's x/z coincide with the AJ plaza. rookGate() (in tick) only arms the safe while you're inside the bank and keeps
// the escape centred on the bank door outside (centred on the room while you're inside), so neither fires on the plaza.
const ROOK_HEIST_ID = 'rook-05-first-junction', ROOK_ESCAPE_R = 60, VAULT_IN_ROOM = { x: 6.4, z: -5.25 }; // vault spot, metres from the bank room's centre
const RG = { w: null, out: null };
function rookGate(app) {
  let a = null; try { a = X().heist?.active; } catch (e) { return; }
  if (!a || a.id !== ROOK_HEIST_ID || !a.w?.safe || !a.w.site) { RG.w = null; return; }
  const W = a.w; if (RG.w !== W) { RG.w = W; RG.out = { sx: W.safe.x, sz: W.safe.z, cx: W.site.x, cz: W.site.z }; }
  const w = app.surface.world;
  if (typeof w.exitBuilding === 'function' && !w.exitBuilding.__sm2) { // re-gate the moment you step out, before the heist's next frame sees you at the door with the site still on the room
    const orig = w.exitBuilding, wrapped = function (...args) { const r = orig.apply(this, args); try { rookGate(app); } catch (e) { /* */ } return r; }; wrapped.__sm2 = true; w.exitBuilding = wrapped; }
  const ins = w.inside, d = w.doorFor?.(BANK), inBank = !!ins && !!d && ins.kind === d.kind && ins.name === d.name, O = RG.out;
  if (inBank) { W.safe.x = ins.ax + VAULT_IN_ROOM.x; W.safe.z = ins.az + VAULT_IN_ROOM.z; W.site.x = ins.ax; W.site.z = ins.az; }
  else { W.safe.x = O.sx; W.safe.z = O.sz; W.site.x = O.cx; W.site.z = O.cz; }
  return inBank;
}
export const HEISTS2 = {
  rook(app) {
    const g = app.game, w = app.surface.world, d = w.doorFor?.(BANK); if (!d) return null;
    const door = relTo(app, d);
    const pros = crew(g, 'quality') === 'pros', ozzie = crew(g, 'driller') === 'ozzie';
    return { id: ROOK_HEIST_ID, title: 'First Junction Trust vault', world: 'Mars', rel: 'colony', kind: 'rook-vault', name: BANK, payout: false,
      site: { x: door.x, z: door.z, r: 9 }, escapeR: ROOK_ESCAPE_R, door, safe: { x: door.x, z: door.z - 3.6, tier: 'vault', time: ozzie ? 60 : 42 },
      power: nudge(app, door.x - 9, door.z + 4), cameras: [
        camAt('fjt-cam0', door.x - 7, door.z + 6, door.x, door.z, 'the Trust camera'),
        camAt('fjt-cam1', door.x + 7, door.z + 6, door.x, door.z, 'the Trust camera', 12, 1.3),
        camAt('fjt-cam2', door.x, door.z + 11, door.x, door.z, 'the street camera', 11, 2.1)],
      alarm: { wanted: 2, responseS: pros ? 30 : 14, failAt: null }, loot: { credits: 5000, item: 'ledger' } };
  },
  impound(app) {
    const s = { x: -48, z: -440 }, n = p => nudge(app, s.x + p[0], s.z + p[1], 1.2);
    const door = n([0, 8]), safe = n([-3, -5]);
    return { id: 'wolde-02-impound', title: 'ColSec impound locker', world: 'Mars', rel: 'colony', kind: 'impound', name: 'COLSEC IMPOUND', payout: false,
      site: { x: s.x, z: s.z, r: 14 }, escapeR: 36, door, safe: { ...safe, tier: 'medium', time: 45 }, power: n([9, 7]),
      cameras: [camAt('imp-cam0', s.x - 9, s.z + 9, door.x, door.z, 'the impound camera'),
        camAt('imp-cam1', s.x + 9, s.z - 6, safe.x, safe.z, 'the locker camera', 12, 1.1),
        camAt('imp-cam2', s.x - 8, s.z - 8, safe.x, safe.z, 'the yard camera', 10, 2.2)],
      alarm: { wanted: 2, responseS: 16, failAt: 4 }, loot: { credits: 0, item: 'evidence drive' } };
  }
};

// ---------- UI: a bottom sheet for picks (transient; the screen centre stays clear) ----------
let sheet = null;
function ensureSheet() {
  if (sheet) return sheet;
  const css = document.createElement('style'); css.id = 'sm2Css';
  css.textContent = `#sm2Sheet{position:fixed;left:0;right:0;bottom:0;z-index:16;display:none;padding:10px calc(12px + var(--sar,0px)) calc(12px + var(--sab,0px)) calc(12px + var(--sal,0px));background:rgba(4,6,16,.95);color:#fff;border-top:1px solid rgba(255,255,255,.3);max-height:46vh;overflow-y:auto;box-sizing:border-box;font-size:.88rem;line-height:1.32}
#sm2Sheet .wrap{max-width:560px;margin:0 auto}#sm2Sheet .who{font-weight:800;color:#ffd25a;font-size:.76rem;letter-spacing:.04em;text-transform:uppercase}
#sm2Sheet .p{margin:3px 0 8px}#sm2Sheet .opts{display:flex;flex-direction:column;gap:7px}
#sm2Sheet button{min-height:44px;padding:8px 12px;border-radius:10px;font-weight:700;text-align:left;touch-action:manipulation;background:#111;color:#fff;border:1px solid rgba(255,255,255,.6);font-size:.88rem}
#sm2Sheet button:disabled{color:#b4b4b4;border-style:dashed;border-color:#6b6b6b}`;
  document.head.appendChild(css);
  sheet = document.createElement('div'); sheet.id = 'sm2Sheet'; sheet.innerHTML = '<div class="wrap"><div class="who"></div><div class="p"></div><div class="opts"></div></div>';
  document.body.appendChild(sheet); return sheet;
}
// On touch the sheet sits above the joystick / fire buttons, so a thumb going back to the stick can't land on a choice.
const PICK_ARM_MS = 320; // taps in the first ~300 ms after the sheet opens are ignored (a finger already moving lands on it)
const sheetOpen = () => !!sheet && sheet.style.display === 'block';
function controlsTop() {
  if (typeof document === 'undefined' || !document.body?.classList.contains('touch')) return null;
  let top = null;
  for (const id of ['joy', 'fireBtn', 'meleeBtn', 'jumpBtn', 'runBtn', 'driveBtn']) { const e = document.getElementById(id); if (!e) continue;
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < innerHeight * 0.55) continue; if (top === null || r.top < top) top = r.top; }
  return top;
}
function placeSheet(el) {
  const top = controlsTop(), lift = top === null ? 0 : Math.max(0, Math.round(innerHeight - top + 6));
  el.style.bottom = lift + 'px'; el.style.maxHeight = Math.max(150, Math.round(innerHeight * 0.6 - lift)) + 'px';
  el.style.borderBottom = lift ? '1px solid rgba(255,255,255,.3)' : '';
}
function openSheet(who, text, buttons, key) {
  const el = ensureSheet(); el.querySelector('.who').textContent = who; el.querySelector('.p').textContent = text;
  const box = el.querySelector('.opts'); box.innerHTML = '';
  const tok = ++S.pickTok; S.pickFired = false; S.pickAt = performance.now();
  for (const b of buttons) { const btn = document.createElement('button'); btn.textContent = b.label; btn.dataset.opt = b.id; btn.disabled = !!b.disabled;
    tapEl(btn, () => { // one choice per sheet: stale sheets, a closed sheet, a second finger and the arming window all do nothing
      if (btn.disabled || tok !== S.pickTok || S.pickFired || S.pickFor !== key || !sheetOpen() || performance.now() - S.pickAt < PICK_ARM_MS) return;
      S.pickFired = true; if (b.on() === false) S.pickFired = false; });
    box.appendChild(btn); }
  el.style.display = 'block'; placeSheet(el);
}
const closeSheet = () => { if (sheet) sheet.style.display = 'none'; };

// ---------- the step runner ----------
const S = { live: null, lastStep: -1, pickTok: 0, pickFired: false, pickAt: 0, key: null, qid: null, t: 0, spawnT: 0, k: 0, seen: 0, lost: 0, tail: null, esc: null, heist: null, raid: null, pickFor: null, vaultWas: null };
const mine = id => MISSIONS2.find(q => q.id === id);
const myHostiles = g => g.debug.agents().filter(a => a.src === 'quest' || a.src === 'sm2');
const groundY = app => (app.surface.info?.y ?? 1.7) - 1.7;
function setText(s, extra) { s._base ??= (s.text || (s.type === 'pick' ? PICK_TEXT(s) : 'Next step')); s.text = extra ? `${s._base} ${extra}` : s._base; }
let app0 = null;
function spawnNear(app, g, types, x, z, r = 16) { // never more than 3 (phone) / 5 (desktop) of ours alive; g.hostiles caps humans (8 phone / 24 desktop) and shrinks ambient walkers so phones stay under 12 people
  const live = myHostiles(g).length, room = Math.min((MOBILE ? 3 : 5) - live, (types || []).length);
  if (room <= 0 || !g.hostiles) return 0;
  return g.hostiles(types.slice(0, room), x, z, { r, src: 'quest', faction: 'storymars2' });
}
// endHeist: drop our listeners. A run still casing/cracking is aborted; one that's escaping or getting clean is left to
// Ben's heist (it finishes itself: escape -> clean -> done), and remembered in S.live so a failed/abandoned job can stop it.
const PRE_ESCAPE = ['case', 'breakin', 'crack'];
function endHeist(why) { const H = X().heist, h = S.heist; if (h?.off) h.off.forEach(f => { try { f(); } catch (e) { /* */ } }); S.heist = null;
  if (!h || h.fallback || !H) return;
  try { const a = H.active; if (a && a.id === h.id) { if (PRE_ESCAPE.includes(a.stage)) H.abortHeist?.(why); else S.live = h.id; } } catch (e) { /* */ } }
function dropLive(completed) { const id = S.live; S.live = null; if (!id || completed) return;
  try { const H = X().heist, a = H?.active; if (a && a.id === id && a.stage === 'escape') H.abortHeist?.('job dropped'); } catch (e) { /* */ } }
function cleanup(app) {
  if (sheet) sheet.style.display = 'none'; S.pickFor = null;
  if (S.tail) { S.tail.group.parent?.remove(S.tail.group); S.tail = null; }
  if (S.esc) { S.esc.group.parent?.remove(S.esc.group); S.esc = null; try { app.surface?.world?.npcReserve?.('storymars2', 0); } catch (e) { /* */ } }
}
function questEnded(app, g, qid) { // quest left (done/failed/abandoned): drop our heist and restore the vault flag
  const def0 = mine(qid), completed = !!def0 && S.lastStep >= def0.steps.length - 1 && !!g.progress.quests?.[qid]?.everDone; S.lastStep = -1;
  endHeist('job dropped'); dropLive(completed); S.raid = null;
  if (qid === ROOK_ID && S.vaultWas !== null) { const F = g.progress.flags, i = F.indexOf('cracked:bank-vault');
    if (S.vaultWas && i < 0) F.push('cracked:bank-vault'); if (!S.vaultWas && i >= 0) F.splice(i, 1); g.save?.(); S.vaultWas = null; }
  const def = mine(qid);
  if (def?.onDone && g.progress.quests?.[qid]?.everDone && !g.flag('sm2:done:' + qid)) { g.setFlag('sm2:done:' + qid); try { def.onDone(app); } catch (e) { console.warn('storymars2 onDone', e); } }
}
function questStarted(app, g, def) {
  if (def.id === ROOK_ID) { // the Trust re-keyed the vault after Kline's ledger job: it's shut again for this run
    const F = g.progress.flags, i = F.indexOf('cracked:bank-vault'); S.vaultWas = i >= 0; if (i >= 0) { F.splice(i, 1); g.save?.();
      toast(app, '\ud83d\udd12 First Junction Trust re-keyed the vault after the ledger job. It\u2019s locked again: you\u2019ll have to crack it.', 4600); }
    const d = app.surface.world.doorFor?.(BANK), s = def.steps.find(x => x.at === 'bankdoor' || x._bankdoor);
    if (s) { s._bankdoor = true; const dr = d ? relTo(app, d) : null; s.at = dr ? [dr.x, dr.z + 4] : ROW(-18, -14); }
    const names = { pros: 'pros', cheap: 'bargain muscle', ozzie: 'Ozzie on the drill', drunk: 'a drunk on the drill', penny: 'Penny on the cameras', halo: 'Halo on the cameras', kestrel: 'Kestrel at the wheel', self: 'you at the wheel' };
    const picks = ['quality', 'driller', 'hacker', 'wheel'].map(k => names[crew(g, k)]).filter(Boolean);
    toast(app, `\ud83e\uddd1\u200d\ud83e\udd1d Crew: ${picks.join(', ') || 'whoever Rook could find'}.`, 4200);
  }
  def.onStart?.(app);
}
function startStep(app, g, q, s, def) {
  cleanup(app); S.t = 0; S.spawnT = 2; S.k = 0; S.seen = 0; S.lost = 0;
  if (s._base) s.text = s._base;
  if (s.bark) bark(def.contact, s.bark.replace(/^[^:]{1,24}:\s*/, ''));
  if (s.type === 'tail') {
    const c = W.buildVehicle(s.vehicle || 'hauler'), p = s.path.map(pt => app.surface.world.colonyAt(pt));
    c.group.position.set(p[0].x, groundY(app), p[0].z); app.surface.scene.add(c.group); S.tail = { group: c.group, pts: p, i: 1 };
  }
  if (s.type === 'escort') {
    const h = buildHuman(s.look || 'accountant'), i = app.surface.info; h.group.position.set(i.x + 1.5, groundY(app), i.z + 1.5); app.surface.scene.add(h.group);
    S.esc = { ...h, hp: 100, x: i.x + 1.5, z: i.z + 1.5, spawned: false, phase: 0 };
    try { app.surface.world.npcReserve?.('storymars2', 1); } catch (e) { /* the escort counts against the 12-person phone budget */ }
    if (s.backup) { const D = X().danger; if (typeof D?.spawnBackup === 'function') { try { const r = D.spawnBackup({ faction: 'saltblood', count: 2, durationSec: 120 }); if (r?.ok !== false) toast(app, '\ud83e\ude78 Wolde paid Saltblood to walk with you.', 2600); } catch (e) { /* */ } } }
  }
  if (s.type === 'heist') startHeistStep(app, g, q, s);
  if (s.type === 'pick') { S.pickFor = null; }
}
function startHeistStep(app, g, q, s) {
  const H = X().heist; endHeist('replaced');
  if (!H?.registerHeist || !H.startHeist) { S.heist = { fallback: true, step: `${q.id}:${q.step}` }; return; }
  let def = null; try { def = HEISTS2[s.heist]?.(app); } catch (e) { console.warn('storymars2 heist def', e); }
  if (!def) { S.heist = { fallback: true, step: `${q.id}:${q.step}` }; return; }
  try { H.registerHeist(def); } catch (e) { console.warn('storymars2 registerHeist', e); S.heist = { fallback: true, step: `${q.id}:${q.step}` }; return; }
  const key = `${q.id}:${q.step}`, h = S.heist = { id: def.id, step: key, cracked: false, escaped: false, failed: false, off: [] };
  const sameId = e => e?.detail?.id === def.id;
  const onSafe = e => { if (sameId(e) && e.detail.success) { if (s.heist === 'rook') g.setFlag('cracked:bank-vault'); h.cracked = true; } };
  const onEsc = e => { if (sameId(e)) h.escaped = true; };
  const onFail = e => { if (sameId(e)) h.failed = true; };
  window.addEventListener('heist:safe:result', onSafe); window.addEventListener('heist:escape', onEsc); window.addEventListener('heist:fail', onFail);
  h.off.push(() => window.removeEventListener('heist:safe:result', onSafe), () => window.removeEventListener('heist:escape', onEsc), () => window.removeEventListener('heist:fail', onFail));
  if (s.heist === 'rook') { const hk = crew(g, 'hacker'), dr = crew(g, 'driller');
    if (hk === 'penny') { try { H.applyTip(def.id, { type: 'cameras' }); } catch (e) { /* */ } toast(app, '\ud83d\udce1 Penny marked every Trust camera. Stay out of the cones.', 3200); }
    else if (hk === 'halo') { try { for (const c of def.cameras) H.disableCamera?.(c.id, 90); } catch (e) { /* */ } toast(app, '\ud83d\udcf7 Halo looped the cameras for a bit.', 3000); }
    if (dr === 'ozzie') { try { H.applyTip(def.id, { type: 'safe', ease: 0.4 }); } catch (e) { /* */ } }
  }
  try { H.startHeist(def.id); } catch (e) { console.warn('storymars2 startHeist', e); h.fallback = true; }
  const tg = g.debug.target(); if (tg && def.door) { const c = app.surface.world.colonyAt([def.door.x, def.door.z]); tg.x = c.x; tg.z = c.z; }
}
function startRaid(app, g, q, s) {
  const R = X().raids; S.raid = { win: false, lose: false, mode: 'hold', t: 0 };
  if (R?.start) { try {
    R.start({ id: `sm2-${q.id}-${q.step}`, pos: s.at, radius: s.r || 16, attackers: s.attackers || 'gang', waves: s.waves || 2, integrity: 100, wanted: 2, label: s.text,
      onWin: () => { S.raid && (S.raid.win = true); }, onLose: () => { S.raid && (S.raid.lose = true); } });
    S.raid.mode = 'raids';
  } catch (e) { console.warn('storymars2 raid', e); S.raid.mode = 'hold'; } }
}
function pickSheet(app, g, q, s, def) {
  const credits = g.progress.credits;
  const key = S.key;
  openSheet(s.who || def.contact || 'Choice', s.prompt || s.text, s.options.map(o => ({ id: o.id, label: o.credits ? o.label.replace(/\+\d+ cr/, `+${boost(o.credits)} cr`) : o.label, disabled: !!(o.cost && credits < o.cost), on: () => {
    const q2 = g.debug.quest(); if (!q2 || `${q2.id}:${q2.step}` !== key) return false;
    if (o.cost && !g.spend(o.cost)) return false;
    for (const f of [].concat(o.flag || [])) g.setFlag(f.includes(':') ? f : `story:${q.id}:${f}`);
    if (o.credits) g.reward(0, jobPay(o.credits, 'pick:' + q.id, { streak: false })); // money boost (economy.js)
    if (o.wanted) app.surface.world.setWanted?.(Math.max(app.surface.world.wanted || 0, o.wanted), 'choice');
    if (o.clearWanted) app.surface.world.setWanted?.(0, 'choice');
    if (o.give === 'bike') giveRide(app, (o.line || '').split(':')[0] + ': A ride, no plates.');
    if (o.give === 'engine') giveUpgrade(app, 'engine');
    if (sheet) sheet.style.display = 'none'; if (o.line) toast(app, `\ud83d\udcac ${o.line}`, 3600); nextStep(g); S.pickFor = null;
  } })), key);
  S.pickFor = key;
  if (s.options.every(o => o.cost && credits < o.cost)) { if (sheet) sheet.style.display = 'none'; failJob(app, g, `Can\u2019t cover it (${Math.min(...s.options.map(o => o.cost))} cr).`); }
}
function holdLogic(app, g, s, dt, tg, info, inside, near) {
  if (inside) { setText(s, '(step outside)'); return false; }
  const r = s.r || 12, inZone = near < r + 2;
  if (inZone) S.t += dt;
  const left = Math.max(0, Math.ceil(s.seconds - S.t));
  setText(s, inZone ? `(${left} s)` : `(back to the spot \u00b7 ${left} s)`);
  if (inZone) { S.spawnT -= dt; if (S.spawnT <= 0 && myHostiles(g).length < (MOBILE ? 3 : 5)) { S.spawnT = 7; spawnNear(app, g, [s.wave[S.k++ % s.wave.length]], info.x, info.z, 20 + Math.random() * 6); } }
  if (S.t >= s.seconds) { g.debug.clear(); toast(app, '\ud83d\udee1\ufe0f Held. The rest scatter.', 2400); return true; }
  return false;
}
function tick(app, dt) {
  app0 = app; if (performance.now() - (S.hookT || 0) > 1000) { S.hookT = performance.now(); try { hookCheck(); } catch (e) { /* */ } }
  const g = app.game;
  if (!g?.debug || !app.state?.onSurface) { if (S.qid) { const p = S.qid; cleanup(app); questEnded(app, g, p); S.qid = null; S.key = null; } return; }
  try { rookGate(app); } catch (e) { /* optional */ }
  const q = g.debug.quest(), def = q && mine(q.id);
  if (S.qid && (!q || q.id !== S.qid)) { const p = S.qid; cleanup(app); questEnded(app, g, p); S.qid = null; S.key = null; }
  if (!q || !def) return;
  if (q.id !== S.qid) { S.qid = q.id; questStarted(app, g, def); }
  const s = def.steps[q.step]; if (!s) return; S.lastStep = q.step;
  const key = `${q.id}:${q.step}`;
  if (key !== S.key) { S.key = key; startStep(app, g, q, s, def); }
  if (!['hold', 'tail', 'escort', 'heist', 'raid', 'pick'].includes(s.type)) return; // core steps are game.js's job
  const info = app.surface.info, world = app.surface.world, tg = g.debug.target(), inside = !!world.inside;
  const near = tg ? Math.hypot(tg.x - info.x, tg.z - info.z) : 1e9;
  switch (s.type) {
    case 'hold': if (holdLogic(app, g, s, dt, tg, info, inside, near)) nextStep(g); return;
    case 'pick': { if (inside) { setText(s, '(step outside)'); return; } if (S.pickFor !== key) pickSheet(app, g, q, s, def); return; }
    case 'heist': {
      const h = S.heist, rookIn = s.heist === 'rook' && !!world.inside; const a = (() => { try { return X().heist?.active; } catch (e) { return null; } })();
      setText(s, a && a.stage ? `(${a.stage})` : h?.fallback ? '(the crew handles it)' : '');
      if (!h || h.fallback) { toast(app, '\ud83d\udd78\ufe0f The crew cracks it the old-fashioned way.', 2600); if (s.heist === 'rook') g.setFlag('cracked:bank-vault'); endHeist('fallback'); return nextStep(g); }
      if (h.failed) { endHeist('blown'); return failJob(app, g, 'The job went loud and fell apart.'); }
      if (h.escaped || (h.cracked && s.advanceOn === 'crack')) { endHeist('done'); return nextStep(g); }
      if (h.cracked) setText(s, '(get clear of the site)');
      else if (s.heist === 'rook' && a?.stage === 'crack' && !rookIn) setText(s, '(the vault is inside the bank)');
      return;
    }
    case 'raid': {
      if (!S.raid) startRaid(app, g, q, s);
      if (S.raid.mode === 'raids') { setText(s, '(hold the line)');
        if (S.raid.win) { S.raid = null; toast(app, '\ud83d\udee1\ufe0f Raid beaten off.', 2400); return nextStep(g); }
        if (S.raid.lose) { S.raid = null; return failJob(app, g, 'They overran the place.'); }
        return; }
      if (holdLogic(app, g, s, dt, tg, info, inside, near)) { S.raid = null; return nextStep(g); } return;
    }
    case 'tail': {
      if (inside) { setText(s, '(step outside)'); return; }
      const T = S.tail; if (!T) return; const goal = T.pts[T.i], gp = T.group.position, dx = goal.x - gp.x, dz = goal.z - gp.z, d = Math.hypot(dx, dz);
      const step = Math.min(d, (s.speed || 7) * dt); gp.x += dx / (d || 1) * step; gp.z += dz / (d || 1) * step; gp.y = groundY(app); T.group.rotation.y = Math.atan2(-dx, -dz);
      tg.x = gp.x; tg.z = gp.z;
      if (d < 0.6) { T.i++; if (T.i >= T.pts.length) { cleanup(app); return nextStep(g); } }
      const pd = Math.hypot(gp.x - info.x, gp.z - info.z), close = s.close || 7, lose = s.lose || 55;
      S.seen = pd < close ? S.seen + dt : Math.max(0, S.seen - dt); S.lost = pd > lose ? S.lost + dt : 0;
      setText(s, pd < close ? '(too close!)' : pd > lose - 10 ? '(losing them)' : `(${Math.round(pd)} m)`);
      if (S.seen > 3) return failJob(app, g, 'They made you. Trail\u2019s cold.');
      if (S.lost > 6) return failJob(app, g, 'You lost them. Trail\u2019s cold.');
      return;
    }
    case 'escort': {
      const E = S.esc; if (!E) return;
      if (inside) { E.group.visible = false; setText(s, '(head outside, they follow)'); return; } E.group.visible = true;
      const bx = info.x + 1.8, bz = info.z + 1.8, dx = bx - E.x, dz = bz - E.z, d = Math.hypot(dx, dz);
      if (d > 22) { E.x = bx; E.z = bz; } else if (d > 1.2) { const v = Math.min(d, (d > 6 ? 9 : 5) * dt); E.x += dx / d * v; E.z += dz / d * v; E.phase += dt; }
      E.group.position.set(E.x, groundY(app), E.z); E.group.rotation.y = Math.atan2(-dx, -dz);
      const w = Math.sin(E.phase * 9) * (d > 1.2 ? 0.5 : 0); E.legs?.forEach((l, i) => { l.rotation.x = i ? w : -w; });
      if (!E.spawned) { S.t += dt; if (S.t > 3) { E.spawned = true; spawnNear(app, g, s.wave, E.x + 10, E.z + 6, 4); toast(app, '\ud83d\udd2b They spotted the mark. Keep moving.', 2400); } }
      const threats = myHostiles(g).filter(a => Math.hypot(a.x - E.x, a.z - E.z) < 30).length;
      E.hp -= threats * 2.0 * dt; if (E.hp <= 0) return failJob(app, g, 'The mark took one in the head. Job\u2019s dead.');
      setText(s, `(${s.who || 'mark'} ${Math.max(0, Math.round(E.hp))}%)`);
      if (near < (tg.r || 7) && Math.hypot(tg.x - E.x, tg.z - E.z) < (tg.r || 7) + 3) { toast(app, '\ud83e\uddf3 Delivered, sweating but breathing.', 2400); nextStep(g); }
      return;
    }
  }
}
export function initStoryMars2(app) {
  if (!app || app.__storymars2) return; app.__storymars2 = true; app0 = app;
  let last = performance.now();
  setInterval(() => { const now = performance.now(), dt = Math.min(0.5, (now - last) / 1000); last = now; if (document.hidden) return; try { tick(app, dt); } catch (e) { console.warn('storymars2', e); } }, 100);
  window.__storymars2 = {
    missions: MISSIONS2.map(q => q.id), offers: OFFERS2.map(o => o.id), types: Object.keys(TYPES2),
    get registered() { return [...H2.offers]; },
    get state() { return { key: S.key, qid: S.qid, t: +S.t.toFixed(1), heist: S.heist && { id: S.heist.id, fallback: !!S.heist.fallback, cracked: S.heist.cracked, escaped: S.heist.escaped, failed: S.heist.failed }, raid: S.raid && { mode: S.raid.mode, win: S.raid.win, lose: S.raid.lose }, tail: S.tail ? { x: +S.tail.group.position.x.toFixed(1), z: +S.tail.group.position.z.toFixed(1), i: S.tail.i } : null, esc: S.esc ? { x: +S.esc.x.toFixed(1), z: +S.esc.z.toFixed(1), hp: Math.round(S.esc.hp) } : null, sheet: sheet?.style.display === 'block' }; },
    skip(sec = 60) { S.t += sec; }, pick(id) { const b = sheet?.querySelector(`button[data-opt="${id}"]`); if (b && !b.disabled && sheetOpen()) { const n = S.pickTok, f = S.pickFired; b.click(); return n === S.pickTok && !f && S.pickFired; } return false; },
    get pickArmMs() { return PICK_ARM_MS; },
    heistDone(ok = true) { if (!S.heist) return false; if (ok) { S.heist.cracked = true; S.heist.escaped = true; } else S.heist.failed = true; return true; },
    raidDone(ok = true) { if (!S.raid) return false; if (ok) S.raid.win = true; else S.raid.lose = true; return true; }
  };
}
// self-bootstrapping: a single side-effect import in index.html is enough. Wait for window.__app, then start the runner.
if (typeof window !== 'undefined') {
  if (window.__app?.game) initStoryMars2(window.__app);
  else { const bt = setInterval(() => { if (window.__app?.game) { clearInterval(bt); initStoryMars2(window.__app); } }, 120); }
}
