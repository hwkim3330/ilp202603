/* ═══════════════════════════════════════════════
   debug-utils.js — Helpers, formatters, constants
   ═══════════════════════════════════════════════ */
import {
  ROII_REAL_STANDARD, ROII_REAL_RECONF, ROII_OPTIMAL,
  getRealPositions, getReconfPositions, getOptimalPositions,
  ROII_REAL_NODE_COLORS, ROII_RECONF_NODE_COLORS, ROII_OPTIMAL_NODE_COLORS,
  ROII_REAL_SWITCHES
} from './roii-real-data.js';

export const round3 = v => Math.round(v * 1000) / 1000;
export const deep = o => JSON.parse(JSON.stringify(o));
export const txTimeUs = (bytes, mbps) => ((bytes + 38) * 8) / mbps;
export const isTsn = (dl) => dl != null;

/* ── Format helpers for Map display ────────────── */
export function fmtLm(lm) {
  const es = [...lm.entries()];
  return `Map(${lm.size}){${es.map(([k,v]) => `"${k}" => {id: "${v.id}", from: "${v.from}", to: "${v.to}", rate_mbps: ${v.rate_mbps}, prop_delay_us: ${v.prop_delay_us}}`).join(', ')}}`;
}

export function fmtAdj(adj) {
  const es = [...adj.entries()];
  return `Map(${adj.size}){${es.map(([k,v]) => `"${k}" => [${v.map(e => `{to: "${e.to}", lid: "${e.lid}"}`).join(', ')}]`).join(', ')}}`;
}

export function fmtPkts(pkts) {
  if (!pkts.length) return '[]';
  return `[${pkts.map(p => `{pid: "${p.pid}", fid: "${p.fid}", pri: ${p.pri}, rel: ${p.rel}, dl: ${p.dl}, tsn: ${p.tsn}, routes: ${fmtRoutes(p.routes)}}`).join(', ')}]`;
}

export function fmtCp(cp) {
  if (!cp) return 'null';
  return `[${cp.map(p => `[${p.join(', ')}]`).join(', ')}]`;
}

export function fmtRoutes(routes) {
  return `[${routes.map(r => `{"ri": ${r.ri}, "hops": [${r.hops.map(h => `{"lid": "${h.lid}", "tx": ${round3(h.tx)}, "pd": ${h.pd}}`).join(', ')}]}`).join(', ')}]`;
}

export function fmtSchedHops(sh, pkts) {
  const entries = [];
  for (let i = 0; i < sh.length; i++) {
    if (sh[i]) entries.push(`${i}(${pkts[i].pid}): {route: ${sh[i].route}, starts: [${sh[i].starts.map(v => round3(v)).join(', ')}]}`);
  }
  return `{${entries.join(', ')}}`;
}

export function fmtLinkOcc(linkOcc) {
  const es = Object.entries(linkOcc);
  return `{${es.map(([k, v]) => `"${k}": [${v.map(iv => `[${round3(iv[0])}, ${round3(iv[1])}]`).join(', ')}]`).join(', ')}}`;
}

/* ── Packet Colors ─────────────────────────────── */
export const PKT_COLORS = [
  '#10B981','#3B82F6','#952aff','#d97706','#dc2626',
  '#0D9488','#7c3aed','#db2777','#059669','#2563EB',
  '#E11D48','#CA8A04','#0891B2','#6D28D9','#EA580C',
  '#4F46E5','#16A34A','#9333EA','#0284C7','#C026D3'
];
export function pktColor(pi) { return PKT_COLORS[pi % PKT_COLORS.length]; }

/* ── Model Configs ─────────────────────────────── */
export const CONFIGS = {
  standard: { data: ROII_REAL_STANDARD, getPositions: getRealPositions,   nodeColors: ROII_REAL_NODE_COLORS,    switches: ROII_REAL_SWITCHES },
  reconf:   { data: ROII_REAL_RECONF,   getPositions: getReconfPositions, nodeColors: ROII_RECONF_NODE_COLORS,  switches: ROII_REAL_SWITCHES },
  optimal:  { data: ROII_OPTIMAL,       getPositions: getOptimalPositions, nodeColors: ROII_OPTIMAL_NODE_COLORS, switches: ROII_REAL_SWITCHES },
};

/* ── Function UI Visibility ────────────────────── */
export const FN_UI = {
  generateKPaths: { occ: false, pkt: false, gantt: false, glpk: false, topo: true },
  expandPackets:  { occ: false, pkt: true,  gantt: true,  glpk: false, topo: true },
  solveGreedy:    { occ: false, pkt: true,  gantt: true,  glpk: false, topo: true },
  solveILP:       { occ: true,  pkt: true,  gantt: true,  glpk: true,  topo: true },
  buildResult:    { occ: false, pkt: true,  gantt: true,  glpk: false, topo: true },
};
