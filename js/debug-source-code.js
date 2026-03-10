/* ═══════════════════════════════════════════════
   debug-source-code.js — Real ilp-core.js source lines
   ═══════════════════════════════════════════════ */
export const SOURCE_CODE = {
  generateKPaths: {
    startLine: 64,
    lines: [
      'export function generateKPaths(adj, src, dst, k, maxD) {',
      '  const found = [];',
      '  (function dfs(n, d, vis, path) {',
      '    if (found.length >= 2000 || d > maxD) return;',
      '    if (n === dst) { found.push(path.slice()); return; }',
      '    for (const e of (adj.get(n) || [])) {',
      '      if (vis.has(e.to)) continue;',
      '      vis.add(e.to); path.push(e.lid);',
      '      dfs(e.to, d + 1, vis, path);',
      '      path.pop(); vis.delete(e.to);',
      '    }',
      '  })(src, 0, new Set([src]), []);',
      '  found.sort((a, b) => a.length - b.length || a.join("|").localeCompare(b.join("|")));',
      '  const u = [], s = new Set();',
      '  for (const p of found) { const k2 = p.join(">"); if (!s.has(k2)) { s.add(k2); u.push(p); } if (u.length >= k) break; }',
      '  return u;',
      '}',
    ]
  },
  expandPackets: {
    startLine: 82,
    lines: [
      'export function expandPackets(model) {',
      '  const lm = new Map(model.links.map(l => [l.id, l]));',
      '  const adj = new Map();',
      '  for (const l of model.links) { if (!adj.has(l.from)) adj.set(l.from, []); adj.get(l.from).push({ to: l.to, lid: l.id }); }',
      '  const pkts = [];',
      '  for (const f of model.flows) {',
      '    if (!f.period_us || f.period_us <= 0) throw new Error(`flow ${f.id}: period_us must be > 0`);',
      '    let cp = f.candidate_paths || (f.path ? [f.path] : null);',
      '    if (!cp && f.src && f.dst) {',
      '      cp = generateKPaths(adj, f.src, f.dst, Math.max(1, f.k_paths || 2), model.nodes.length + 2);',
      '      if (!cp.length) throw new Error(`No route: ${f.src}->${f.dst}`);',
      '    }',
      '    if (!cp || !Array.isArray(cp) || cp.length === 0) throw new Error(`flow ${f.id}: set candidate_paths/path OR src+dst`);',
      '    for (const p of cp) {',
      '      if (!Array.isArray(p) || p.length === 0) throw new Error(`flow ${f.id}: empty path`);',
      '      for (const lid of p) if (!lm.has(lid)) throw new Error(`flow ${f.id}: unknown link ${lid}`);',
      '    }',
      '    const repsRaw = model.cycle_time_us / f.period_us;',
      '    const reps = Math.round(repsRaw);',
      '    if (Math.abs(repsRaw - reps) > 1e-9) throw new Error(`flow ${f.id}: cycle_time_us must be divisible by period_us`);',
      '    for (let k = 0; k < reps; k++) {',
      '      const rel = k * f.period_us;',
      '      pkts.push({',
      '        pid: `${f.id}#${k}`, fid: f.id, pri: f.PCP, tt: f.traffic_type,',
      '        rel, dl: f.deadline_us == null ? null : rel + f.deadline_us,',
      '        tsn: true,',
      '        routes: cp.map((pl, ri) => ({ ri, hops: pl.map(lid => ({ lid, tx: txTimeUs(f.payload_bytes, lm.get(lid).rate_mbps), pd: lm.get(lid).prop_delay_us })) }))',
      '      });',
      '    }',
      '  }',
      '  return pkts;',
      '}',
    ]
  },
  solveGreedy: {
    startLine: 238,
    lines: [
      'export function solveGreedy(model) {',                                                        // 0
      '  if (!model.processing_delay_us) model.processing_delay_us = 3;',                           // 1
      '  const t0 = performance.now();',                                                             // 2
      '  const pkts = expandPackets(model);',                                                        // 3
      '  let fallbackCount = 0;',                                                                    // 4
      '',                                                                                            // 5
      '  const gateSchedule = model.no_be ? {} : computeGateSchedule(model, pkts);',                 // 6
      '  const linkGateWindows = {};  // TC-based gate windows (skip for no_be)',                    // 7
      '  if (!model.no_be) { for (const lnk of model.links) { ... } }',                             // 8
      '  const linkOcc = Object.fromEntries(model.links.map(l => [l.id, []]));',                    // 9
      '',                                                                                            // 10
      '  function findEarliest(lid, earliest, duration, pktTC) {',                                   // 11
      '    const occ = linkOcc[lid];',                                                               // 12
      '    const gw = linkGateWindows[lid];',                                                        // 13
      '    let t = earliest;',                                                                       // 14
      '    for (let iter = 0; iter < MAX_ITER; iter++) {',                                           // 15
      '      // 1) Gate constraint: find window for this packet\'s TC',                              // 16
      '      if (gw) {',                                                                             // 17
      '        let inGate = false;',                                                                 // 18
      '        for (const w of gw) {',                                                               // 19
      '          if (w.queue !== pktTC) continue;  // TC-specific gate',                             // 20
      '          if (w.open > t + 1e-9) {',                                                          // 21
      '            if (duration <= w.close - w.open + 1e-9) { t = w.open; inGate = true; break; }',  // 22
      '          } else if (t >= w.open - 1e-9 && t + duration <= w.close + 1e-9) {',                // 23
      '            inGate = true; break;',                                                           // 24
      '          }',                                                                                 // 25
      '        }',                                                                                   // 26
      '        if (!inGate) return { t: Infinity, queue: -1 };',                                    // 27
      '  const order = pkts.map((pk, i) => i);',                                                     // 28
      '  order.sort((a, b) => {',                                                                    // 29
      '    const pa = pkts[a], pb = pkts[b];',                                                       // 30
      '    if (pa.pri !== pb.pri) return pb.pri - pa.pri;',                                          // 31
      '    if (pa.rel !== pb.rel) return pa.rel - pb.rel;',                                          // 32
      '    const da = pa.dl ?? Infinity, db = pb.dl ?? Infinity;',                                   // 33
      '    return da - db;',                                                                         // 34
      '  });',                                                                                       // 35
      '  const schedHops = new Array(pkts.length);',                                                 // 36
      '  for (const pi of order) {',                                                                 // 37
      '    const pk = pkts[pi];',                                                                    // 38
      '    let bestRoute = 0, bestEnd = Infinity, bestStarts = null, bestQueues = null;',            // 39
      '    for (let ri = 0; ri < pk.routes.length; ri++) {',                                         // 40
      '      const rt = pk.routes[ri]; const starts = [], queues = []; let t = pk.rel; let valid = true;', // 41
      '      for (let h = 0; h < rt.hops.length; h++) {',                                           // 42
      '        const hp = rt.hops[h];',                                                              // 43
      '        // TC-aware: gate window + link occupancy check',                                     // 44
      '        const res = findEarliest(hp.lid, t, hp.tx, pk.pri);',                                 // 45
      '        if (res.t === Infinity || res.t + hp.tx > model.cycle_time_us) { valid = false; break; }', // 46
      '        starts.push(res.t);',                                                                 // 47
      '        t = res.t + hp.tx + hp.pd + model.processing_delay_us;',                              // 48
      '      }',                                                                                     // 49
      '      if (valid) {',                                                                          // 50
      '        const lastH = rt.hops.at(-1);',                                                       // 51
      '        const fin = starts.at(-1) + lastH.tx + lastH.pd;',                                   // 52
      '        if (fin < bestEnd) { bestEnd = fin; bestRoute = ri; bestStarts = starts; bestQueues = queues; }', // 53
      '      }',                                                                                     // 54
      '    }',                                                                                       // 55
      '    if (!bestStarts) {',                                                                      // 56
      '      const rt = pk.routes[0];',                                                              // 57
      '      bestStarts = []; bestQueues = []; let t = pk.rel;',                                     // 58
      '      for (const hp of rt.hops) { bestStarts.push(t); bestQueues.push(-1); t += hp.tx + hp.pd + model.processing_delay_us; }', // 59
      '      bestRoute = 0; fallbackCount++;',                                                       // 60
      '    }',                                                                                       // 61
      '    const rt = pk.routes[bestRoute];',                                                        // 62
      '    for (let h = 0; h < rt.hops.length; h++) {',                                             // 63
      '      const hp = rt.hops[h];',                                                               // 64
      '      linkOcc[hp.lid].push([bestStarts[h], bestStarts[h] + hp.tx]);',                         // 65
      '    }',                                                                                       // 66
      '    for (let h = 0; h < rt.hops.length; h++) {',                                             // 67
      '      linkOcc[rt.hops[h].lid].sort((a, b) => a[0] - b[0]);',                                 // 68
      '    }',                                                                                       // 69
      '    schedHops[pi] = { route: bestRoute, starts: bestStarts, queues: bestQueues };',           // 70
      '  }',                                                                                         // 71
      '  const elapsed = round3(performance.now() - t0);',                                           // 72
      '  return buildResult(model, pkts, schedHops, "Greedy (802.1Qbv TAS scheduler)", {',           // 73
      '    constraints: 0, variables: 0, binaries: 0, status: "heuristic", runtime_ms: elapsed, fallback_packets: fallbackCount', // 74
      '  });',                                                                                       // 75
      '}',                                                                                           // 76
    ]
  },
  solveILP: {
    startLine: 361,
    lines: [
      'export async function solveILP(model, glpk, opts = {}) {',
      '  if (!glpk) throw new Error(\'GLPK not ready\');',
      '  if (!model.processing_delay_us) model.processing_delay_us = 3;',
      '  if (model.guard_band_us == null) model.guard_band_us = 12.304;',
      '  const tmlim = opts.tmlim || 30;',
      '',
      '  const pkts = expandPackets(model);',
      '  if (pkts.length > 70) throw new Error(`Too many packets`);',
      '',
      '  const allSingleRoute = pkts.every(pk => pk.routes.length === 1);',
      '',
      '  // IEEE 802.1Qbv gate schedule — skip for no_be mode',
      '  const gateSchedule = model.no_be ? {} : computeGateSchedule(model, pkts);',
      '  const linkGateWindows = {};',
      '  if (!model.no_be) { for (const lnk of model.links) {',
      '    const entries = (gateSchedule[lnk.from] || {})[lnk.id];',
      '    if (entries) linkGateWindows[lnk.id] = entries.filter(e => e.type === \'tc\' || e.type === \'be\');',
      '  } }',
      '',
      '  const vars = new Set(), sub = [], bins = [], obj = [];',
      '  /* ... sv, yv, av, ac helpers ... */',
      '',
      '  if (allSingleRoute) {',
      '    /* ── Fixed-route: per-hop lb/ub + gate window + chain + deadline ── */',
      '    for (let p = 0; p < pkts.length; p++) {',
      '      /* ... ac(lb), ac(ub) ... */',
      '      // IEEE 802.1Qbv gate window constraint per hop',
      '      const gw = linkGateWindows[hp.lid];',
      '      if (gw) {',
      '        const feasibleWindows = gw.filter(w => w.queue === pk.pri && ...);',
      '        if (feasibleWindows.length === 1) {',
      '          ac(\'gw_lb\', [{s, coef:1}], {lb: max(earliest, fw.open)});',
      '          ac(\'gw_ub\', [{s, coef:1}], {ub: min(latest, fw.close - tx)});',
      '        } else if (feasibleWindows.length > 1) {',
      '          // Binary window selection: gw_p_h_j ∈ {0,1}, Σ gw = 1',
      '          for (j of feasibleWindows) { ac(gw_lo, gw_up with M*(1-g)); }',
      '          ac(\'gw_sel\', gwTerms, {type: GLP_FX, lb: 1, ub: 1});',
      '        }',
      '      }',
      '      /* ... chain, ops, deadline, objective ... */',
      '    }',
      '    /* ... pairwise ordering (gate-tightened earliest/latest) ... */',
      '  } else {',
      '    /* ── Multi-route: gate window + z-variable interaction ── */',
      '    for (let p ...) { for (let r ...) {',
      '      /* ... ac(lb), ac(ub) with z-relaxation ... */',
      '      // IEEE 802.1Qbv gate + route selection',
      '      const gw = linkGateWindows[hp.lid];',
      '      if (gw) {',
      '        if (tcWindows.length === 1) {',
      '          ac(\'gw_lo\', [{s,1},{z,-M}], {lb: fw.open - M});  // z=1→s≥open',
      '          ac(\'gw_up\', [{s,1},{z,M}], {ub: fw.close-tx+M}); // z=1→s≤close-tx',
      '        } else if (tcWindows.length > 1) {',
      '          // Binary gw_p_r_h_j, Σ gw_j = z (route selected → one window)',
      '          for (j of tcWindows) { ac(gw_lo/gw_up with M*g + M*z); }',
      '          ac(\'gw_sel\', [...gwTerms, {z, -1}], {type: GLP_FX, lb:0, ub:0});',
      '        }',
      '      }',
      '      /* ... chain, ops, deadline, route selection, pairwise ... */',
      '    } }',
      '  }',
      '',
      '  const lp = { name: \'tsn_ilp\', objective, subjectTo: sub, binaries: bins, bounds };',
      '  const solved = await glpk.solve(lp, { presol: true, tmlim });',
      '  /* ... extract schedHops from solved.result.vars ... */',
      '  return buildResult(model, pkts, schedHops, \'ILP (...)\', stats);',
      '}',
    ]
  },
  buildResult: {
    startLine: 167,
    lines: [
      'function buildResult(model, pkts, schedHops, method, stats) {',
      '  const linkRows = Object.fromEntries(model.links.map(l => [l.id, []]));',
      '  const pktRows = [];',
      '  for (let p = 0; p < pkts.length; p++) {',
      '    const pk = pkts[p], sh = schedHops[p];',
      '    const selR = sh.route, rt = pk.routes[selR], hops = [];',
      '    for (let h = 0; h < rt.hops.length; h++) {',
      '      const hp = rt.hops[h], s = sh.starts[h], e = round3(s + hp.tx);',
      '      hops.push({ link_id: hp.lid, start_us: round3(s), end_us: e, duration_us: round3(hp.tx) });',
      '      linkRows[hp.lid].push({ type: \'flow\', note: pk.pid, priority: pk.pri, tsn: pk.tsn, start_us: round3(s), end_us: e, duration_us: round3(hp.tx) });',
      '    }',
      '    const lH = rt.hops.at(-1), fin = hops.at(-1).end_us + lH.pd, e2e = round3(fin - pk.rel);',
      '    const ok = pk.dl == null || fin <= pk.dl + 1e-6;',
      '    pktRows.push({ ... });',
      '  }',
      '  pktRows.sort((a, b) => a.end_us - b.end_us);',
      '',
      '  const gcl = { cycle_time_us: model.cycle_time_us, base_time_us: 0, links: {} };',
      '  if (model.no_be) {',
      '    // No-BE: build GCL from actual packet placements (TC-specific masks)',
      '    for (const lnk of model.links) {',
      '      const rows = linkRows[lnk.id].sort((a,b) => a.start_us - b.start_us);',
      '      // gaps → all-gates-closed, packets → single-TC-open',
      '      gcl.links[lnk.id] = { from: lnk.from, to: lnk.to, entries };',
      '    }',
      '  } else {',
      '    const gateSchedule = computeGateSchedule(model, pkts);',
      '    for (const lnk of model.links) {',
      '      const linkGate = (gateSchedule[lnk.from] || {})[lnk.id];',
      '      if (linkGate) {',
      '        // IEEE 802.1Qbv: TC windows + guard bands + packet bars',
      '        for (const gs of linkGate) { /* guard/be/tc entries */ }',
      '        gcl.links[lnk.id] = { from: lnk.from, to: lnk.to, entries };',
      '      } else {',
      '        gcl.links[lnk.id] = { from, to, entries: [...pktBars, fillEntry] };',
      '      }',
      '    }',
      '  }',
      '',
      '  let worstUtil = 0;',
      '  for (const lnk of model.links) {',
      '    let act = 0; for (const e of gcl.links[lnk.id].entries) if (!e.note.includes(\'non-ST\') && !e.note.includes(\'guard\')) act += e.duration_us;',
      '    worstUtil = Math.max(worstUtil, act / model.cycle_time_us * 100);',
      '  }',
      '',
      '  let overlapConflicts = 0;',
      '  for (const lnk of model.links) {',
      '    const rows = linkRows[lnk.id].slice().sort((a, b) => a.start_us - b.start_us);',
      '    for (let i = 1; i < rows.length; i++) {',
      '      if (rows[i].start_us < rows[i - 1].end_us - 1e-9) overlapConflicts++;',
      '    }',
      '  }',
      '  const outStats = { ...(stats || {}), overlap_conflicts: overlapConflicts };',
      '',
      '  return {',
      '    method,',
      '    objective: round3(pktRows.filter(p => p.status !== \'NON-ST\').reduce((a, p) => a + p.e2e_delay_us, 0)),',
      '    worst_util_percent: round3(worstUtil), packetRows: pktRows, gcl, stats: outStats',
      '  };',
      '}',
    ]
  }
};
