// ridestars.js (v7.5.46, Collin): the better the ride, the more ⭐ you earn while driving it. Rules in starmixcore.js.
// Watches game.progress.xp once per surface frame (window.SSX_TICKS): whatever grants stars while you're in a ride (races,
// stunts, deliveries, jobs, turret kills ...) or within GRACE seconds of stepping out gets +bonus% on top, from the ride's price.
// Stars granted through starmixcore.grantStars (heists, fronts, flex) are skipped. Toasts are batched: "⭐ +30 · ride bonus +12 (+40% Ghost Sled)".
// Debug/tests: window.SSX.rideStars.
import { VEHICLES } from './world.js';
import * as SM from './starmixcore.js';

const GRACE = 3, TOAST_GAP = 2.2;
const app = () => globalThis.__app;
const toast = (m, ms) => { try { app()?.toast?.(m, ms); } catch (e) { /* */ } };
const S = { P: null, xp: 0, ride: null, lastIn: -1e9, acc: { r: 0 }, pend: { base: 0, extra: 0, t: 0 }, flexT: 0, flexN: 0, flexHour: { t0: 0, n: 0 }, shown: new Set(), total: 0, log: [] };
const now = () => performance.now() / 1000;

const priceCache = new Map(); // kind -> [price, at]; the lot is re-read at most every 5 s
function listingPrice(kind) { const c = priceCache.get(kind), t = now(); if (c && t - c[1] < 5) return c[0];
  let p; try { const s = globalThis.__dealer?.stock?.find(x => x.kind === kind); p = s ? s.price : undefined; } catch (e) { p = undefined; } priceCache.set(kind, [p, t]); return p; }
export function rideOf(tc) {
  const car = tc?.car; if (!car) return null;
  const own = car === tc.rover, kind = own ? (car.__dlrKind || 'rover') : (car.kind || 'rover'), spec = VEHICLES[kind] || car.spec || {};
  const price = SM.ridePrice(kind, spec, kind === 'rover' ? undefined : listingPrice(kind)), pct = SM.bonusPct(price);
  return { kind, name: own && kind === 'rover' ? 'Your rover' : (spec.name || car.spec?.name || kind), price, pct, own, speed: Math.abs(+car.speed || 0) };
}

function flush(force) {
  const p = S.pend; if (!p.extra || (!force && now() - p.t < TOAST_GAP)) return;
  toast(`⭐ +${p.base} · ride bonus +${p.extra} (+${p.ride.pct}% ${p.ride.name})`, 2600); p.base = 0; p.extra = 0;
}

function tick(dt, tc) {
  const g = tc?.game, P = g?.progress; if (!P) return;
  const t = now(), ride = rideOf(tc);
  if (ride) { S.ride = ride; S.lastIn = t;
    if (ride.pct > 0 && !S.shown.has(ride.kind)) { S.shown.add(ride.kind); toast(`🏎 ${ride.name}: +${ride.pct}% ⭐ on everything you earn while you drive it`, 3000); } }
  if (P !== S.P) { S.P = P; S.xp = +P.xp || 0; globalThis.__ssxStarSkip = 0; return; } // new/reloaded save: resync
  let d = (+P.xp || 0) - S.xp; const skip = Math.max(0, +globalThis.__ssxStarSkip || 0);
  if (skip) { const u = Math.min(skip, Math.max(0, d)); d -= u; globalThis.__ssxStarSkip = skip - u; if (d <= 0) globalThis.__ssxStarSkip = 0; }
  const live = S.ride && t - S.lastIn <= GRACE ? S.ride : null;
  if (d > 0 && d <= SM.MAX_DELTA && live?.pct > 0) {
    const extra = SM.rideExtra(d, live.pct, S.acc);
    if (extra > 0) { P.xp += extra; S.total += extra; try { g.save?.(); } catch (e) { /* */ }
      S.log.push({ base: d, extra, pct: live.pct, kind: live.kind }); if (S.log.length > 20) S.log.shift();
      const p = S.pend; if (!p.extra) p.t = t; p.base += d; p.extra += extra; p.ride = live; }
  }
  S.xp = +P.xp || 0;
  // flex: cruising a top ride
  const every = ride ? SM.flexEvery(ride.pct) : 0;
  if (every && ride.speed >= SM.FLEX.minSpeed) {
    if (t - S.flexHour.t0 > 3600) S.flexHour = { t0: t, n: 0 };
    S.flexT += dt;
    if (S.flexT >= every && S.flexHour.n < SM.FLEX.capPerHour) { S.flexT = 0; S.flexHour.n++; S.flexN++; SM.grantStars(g, 1); S.xp = +P.xp || 0;
      if (S.flexN === 1 || S.flexN % 10 === 0) toast(`😎 Flexing the ${ride.name}: ${S.flexN === 1 ? '+1 ⭐ (keeps coming while you cruise)' : `+10 ⭐`}`, 2400); }
  }
  flush(false);
}
(globalThis.SSX_TICKS ||= []).push(tick);

const API = { rideOf, tick, get ride() { return S.ride ? { ...S.ride } : null; }, get total() { return S.total; }, get flex() { return { n: S.flexN, hour: S.flexHour.n, t: S.flexT }; }, get log() { return S.log.slice(); }, flush: () => flush(true), rules: SM };
function attach() { const X = globalThis.SSX || (globalThis.SSX = {}); if (X.rideStars !== API) X.rideStars = API; }
attach(); if (typeof window !== 'undefined') { setTimeout(attach, 0); setTimeout(attach, 300); setInterval(attach, 2000); }
