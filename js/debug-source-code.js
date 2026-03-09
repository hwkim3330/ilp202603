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
      '  const gateSchedule = computeGateSchedule(model, pkts);',                                   // 6
      '  const linkGateWindows = {};  // TC-based gate windows',                                     // 7
      '  for (const lnk of model.links) { ... }',                                                   // 8
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
      '  if (!model.guard_band_us) model.guard_band_us = 12.304;',
      '  const tmlim = opts.tmlim || 15;',
      '',
      '  const pkts = expandPackets(model);',
      '  if (pkts.length > 70) throw new Error(`Too many packets (${pkts.length}). Reduce flows or increase period.`);',
      '',
      '  // Check if all packets have exactly 1 route → use tight formulation',
      '  const allSingleRoute = pkts.every(pk => pk.routes.length === 1);',
      '',
      '  const vars = new Set(), sub = [], bins = [], obj = [];',
      '  let ci = 0;',
      '  const sv = (p, h) => `s_${p}_${h}`;',
      '  const yv = (l, a, b) => `y_${l.replace(/[^a-zA-Z0-9]/g, \'_\')}_${a}_${b}`;',
      '  const av = n => { vars.add(n); return n; };',
      '  const ac = (pre, terms, bnd) => { sub.push({ name: `${pre}_${ci++}`, vars: terms, bnds: bnd }); };',
      '  const ops = [];',
      '',
      '  if (allSingleRoute) {',
      '    /* ── Fixed-route formulation: NO z-variables, per-pair tight M ── */',
      '    for (let p = 0; p < pkts.length; p++) {',
      '      const pk = pkts[p], rt = pk.routes[0];',
      '      let earliestArr = pk.rel;',
      '      for (let h = 0; h < rt.hops.length; h++) {',
      '        const hp = rt.hops[h], s = av(sv(p, h));',
      '        // Tight lower bound',
      '        ac(\'lb\', [{ name: s, coef: 1 }], { type: glpk.GLP_LO, lb: earliestArr, ub: 0 });',
      '        // Tight upper bound',
      '        let latestStart = model.cycle_time_us - hp.tx;',
      '        if (pk.dl != null) {',
      '          let tailTime = 0;',
      '          for (let h2 = rt.hops.length - 1; h2 > h; h2--)',
      '            tailTime += rt.hops[h2].tx + rt.hops[h2].pd + model.processing_delay_us;',
      '          latestStart = Math.min(latestStart, pk.dl - hp.tx - hp.pd - tailTime);',
      '        }',
      '        ac(\'ub\', [{ name: s, coef: 1 }], { type: glpk.GLP_UP, lb: 0, ub: latestStart });',
      '        // Chain',
      '        if (h < rt.hops.length - 1) {',
      '          const sn = av(sv(p, h + 1));',
      '          ac(\'ch\', [{ name: sn, coef: 1 }, { name: s, coef: -1 }], { type: glpk.GLP_LO, lb: hp.tx + hp.pd + model.processing_delay_us, ub: 0 });',
      '        }',
      '        const blk = hp.tx;',
      '        ops.push({ oi: ops.length, p, r: 0, h, lid: hp.lid, sn: s, tx: hp.tx, blk, earliest: earliestArr, latest: latestStart });',
      '        earliestArr += hp.tx + hp.pd + model.processing_delay_us;',
      '      }',
      '      // Deadline',
      '      const last = rt.hops.length - 1, sL = sv(p, last), lH = rt.hops[last];',
      '      if (pk.dl != null) ac(\'dl\', [{ name: sL, coef: 1 }], { type: glpk.GLP_UP, lb: 0, ub: pk.dl - lH.tx - lH.pd });',
      '      // Objective: minimize sum of last-hop start times for TSN packets',
      '      if (pk.tsn) obj.push({ name: sL, coef: 1 });',
      '    }',
      '',
      '    // Pairwise ordering with per-pair tight M and window pruning',
      '    for (const lnk of model.links) {',
      '      const lo = ops.filter(o => o.lid === lnk.id);',
      '      for (let a = 0; a < lo.length; a++) for (let b = a + 1; b < lo.length; b++) {',
      '        const oa = lo[a], ob = lo[b];',
      '        // Tight window pruning: skip if execution windows can\'t overlap',
      '        if (oa.latest + oa.blk <= ob.earliest || ob.latest + ob.blk <= oa.earliest) continue;',
      '        const y = av(yv(lnk.id, oa.oi, ob.oi)); bins.push(y);',
      '        // Per-pair tight M: just enough to make constraint trivial when inactive',
      '        const Mab = Math.max(oa.latest - ob.earliest + oa.blk, ob.latest - oa.earliest + ob.blk);',
      '        // y=0: a before b → s_b >= s_a + blk_a  (with -Mab*y relaxation)',
      '        // y=1: b before a → s_a >= s_b + blk_b  (with +Mab*y relaxation)',
      '        ac(\'na\', [{ name: ob.sn, coef: 1 }, { name: oa.sn, coef: -1 }, { name: y, coef: -Mab }], { type: glpk.GLP_LO, lb: oa.blk - Mab, ub: 0 });',
      '        ac(\'nb\', [{ name: oa.sn, coef: 1 }, { name: ob.sn, coef: -1 }, { name: y, coef: Mab }], { type: glpk.GLP_LO, lb: ob.blk, ub: 0 });',
      '      }',
      '    }',
      '  } else {',
      '    /* ── Multi-route formulation: big-M with z-variables ── */',
      '    const M = model.cycle_time_us + model.processing_delay_us + 100;',
      '    const zv2 = (p, r) => `z_${p}_${r}`;',
      '    for (let p = 0; p < pkts.length; p++) {',
      '      const pk = pkts[p], zt = [];',
      '      for (let r = 0; r < pk.routes.length; r++) {',
      '        const rt = pk.routes[r], z = av(zv2(p, r));',
      '        bins.push(z); zt.push({ name: z, coef: 1 });',
      '        for (let h = 0; h < rt.hops.length; h++) {',
      '          const hp = rt.hops[h], s = av(`s_${p}_${r}_${h}`);',
      '          ac(\'lb\', [{ name: s, coef: 1 }, { name: z, coef: -M }], { type: glpk.GLP_LO, lb: pk.rel - M, ub: 0 });',
      '          ac(\'ub\', [{ name: s, coef: 1 }, { name: z, coef: M }], { type: glpk.GLP_UP, lb: 0, ub: model.cycle_time_us - hp.tx + M });',
      '          if (h < rt.hops.length - 1) {',
      '            const sn = av(`s_${p}_${r}_${h + 1}`);',
      '            ac(\'ch\', [{ name: sn, coef: 1 }, { name: s, coef: -1 }, { name: z, coef: -M }], { type: glpk.GLP_LO, lb: hp.tx + hp.pd + model.processing_delay_us - M, ub: 0 });',
      '          }',
      '          ops.push({ oi: ops.length, p, r, h, lid: hp.lid, sn: s, zn: z, tx: hp.tx, blk: hp.tx });',
      '        }',
      '        const last = rt.hops.length - 1, sL = av(`s_${p}_${r}_${last}`), lH = rt.hops[last];',
      '        if (pk.dl != null) ac(\'dl\', [{ name: sL, coef: 1 }, { name: z, coef: M }], { type: glpk.GLP_UP, lb: 0, ub: pk.dl - lH.tx - lH.pd + M });',
      '        if (pk.tsn) { obj.push({ name: sL, coef: 1 }); obj.push({ name: z, coef: lH.tx + lH.pd }); }',
      '      }',
      '      ac(\'sel\', zt, { type: glpk.GLP_FX, lb: 1, ub: 1 });',
      '    }',
      '    for (const lnk of model.links) {',
      '      const lo = ops.filter(o => o.lid === lnk.id);',
      '      for (let a = 0; a < lo.length; a++) for (let b = a + 1; b < lo.length; b++) {',
      '        const oa = lo[a], ob = lo[b];',
      '        if (oa.p === ob.p && oa.r === ob.r) continue;',
      '        const pa = pkts[oa.p], pb = pkts[ob.p];',
      '        const aEnd = pa.dl ?? model.cycle_time_us;',
      '        const bEnd = pb.dl ?? model.cycle_time_us;',
      '        if (aEnd <= pb.rel || bEnd <= pa.rel) continue;',
      '        const y = av(yv(lnk.id, oa.oi, ob.oi)); bins.push(y);',
      '        ac(\'na\', [{ name: ob.sn, coef: 1 }, { name: oa.sn, coef: -1 }, { name: y, coef: -M }, { name: oa.zn, coef: -M }, { name: ob.zn, coef: -M }], { type: glpk.GLP_LO, lb: oa.blk - 3 * M, ub: 0 });',
      '        ac(\'nb\', [{ name: oa.sn, coef: 1 }, { name: ob.sn, coef: -1 }, { name: y, coef: M }, { name: oa.zn, coef: -M }, { name: ob.zn, coef: -M }], { type: glpk.GLP_LO, lb: ob.blk - 2 * M, ub: 0 });',
      '      }',
      '    }',
      '  }',
      '',
      '  const lp = {',
      '    name: \'tsn_ilp\',',
      '    objective: { direction: glpk.GLP_MIN, name: \'obj\', vars: obj.length ? obj : [{ name: av(\'dum\'), coef: 0 }] },',
      '    subjectTo: sub, binaries: bins,',
      '    bounds: Array.from(vars).map(n => ({ name: n, type: glpk.GLP_LO, lb: 0, ub: 0 }))',
      '  };',
      '',
      '  const solved = await glpk.solve(lp, { msglev: glpk.GLP_MSG_OFF, presol: true, tmlim });',
      '  if (!solved?.result || ![glpk.GLP_OPT, glpk.GLP_FEAS].includes(solved.result.status))',
      '    throw new Error(\'ILP infeasible (status=\' + (solved?.result?.status ?? \'?\') + \')\');',
      '',
      '  const rv = solved.result.vars;',
      '',
      '  // Build scheduled hops from ILP solution',
      '  const schedHops = [];',
      '  if (allSingleRoute) {',
      '    for (let p = 0; p < pkts.length; p++) {',
      '      const starts = [];',
      '      for (let h = 0; h < pkts[p].routes[0].hops.length; h++) starts.push(Number(rv[sv(p, h)] || 0));',
      '      schedHops.push({ route: 0, starts });',
      '    }',
      '  } else {',
      '    const zv2 = (p, r) => `z_${p}_${r}`;',
      '    for (let p = 0; p < pkts.length; p++) {',
      '      const pk = pkts[p]; let selR = 0, bz = -1;',
      '      for (let r = 0; r < pk.routes.length; r++) { const v = Number(rv[zv2(p, r)] || 0); if (v > bz) { bz = v; selR = r; } }',
      '      const starts = [];',
      '      for (let h = 0; h < pk.routes[selR].hops.length; h++) starts.push(Number(rv[`s_${p}_${selR}_${h}`] || 0));',
      '      schedHops.push({ route: selR, starts });',
      '    }',
      '  }',
      '',
      '  const statusLabel = solved.result.status === glpk.GLP_OPT ? \'optimal\' : \'feasible (time limit)\';',
      '  return buildResult(model, pkts, schedHops,',
      '    \'ILP (GLPK v\' + (typeof glpk.version === \'function\' ? glpk.version() : (glpk.version || \'?\')) + \', \' + statusLabel + \')\',',
      '    { constraints: sub.length, variables: vars.size, binaries: bins.length, status: solved.result.status, runtime_ms: Math.round(solved.time * 1000) }',
      '  );',
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
      '  const gateSchedule = computeGateSchedule(model, pkts);',
      '  for (const lnk of model.links) {',
      '    const linkGate = (gateSchedule[lnk.from] || {})[lnk.id];',
      '    if (linkGate) {',
      '      // IEEE 802.1Qbv: TC windows + guard bands + packet bars',
      '      const rows = linkRows[lnk.id].sort((a,b) => a.start_us - b.start_us);',
      '      const entries = []; let idx = 0;',
      '      for (const gs of linkGate) {',
      '        if (gs.type === \'guard\') entries.push({ gate_mask: \'00000000\', ...gs, note: \'guard\' });',
      '        else if (gs.type === \'be\') entries.push({ gate_mask: \'11111111\', ...gs, note: \'non-ST\' });',
      '        else { /* TC window — place actual pkt bars inside */ }',
      '      }',
      '      gcl.links[lnk.id] = { from: lnk.from, to: lnk.to, entries };',
      '    } else {',
      '      // No gate schedule — packet bars + fill',
      '      gcl.links[lnk.id] = { from, to, entries: [...pktBars, fillEntry] };',
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
