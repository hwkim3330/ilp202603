/* build-result.js — instrumentBuildResult */
import { round3, deep } from '../debug-utils.js';
import { expandPackets, computeGateSchedule, solveGreedy, solveILP, flowColor } from '../ilp-core.js';


export async function instrumentBuildResult(model, solver = 'greedy', glpk = null, cachedSolverStats = null) {
  if (!model.processing_delay_us) model.processing_delay_us = 3;

  const solverResult = solver === 'ilp'
    ? await solveILP(deep(model), glpk)
    : solveGreedy(deep(model));
  if (cachedSolverStats) Object.assign(solverResult.stats, cachedSolverStats);
  const lm = new Map(model.links.map(l => [l.id, l]));
  const adj = new Map();
  for (const l of model.links) {
    if (!adj.has(l.from)) adj.set(l.from, []);
    adj.get(l.from).push({ to: l.to, lid: l.id });
  }
  const nodeType = Object.fromEntries(model.nodes.map(n => [n.id, n.type]));
  const pkts = expandPackets(model);

  const schedHops = new Array(pkts.length);
  const pktMap = new Map(pkts.map((pk, i) => [pk.pid, i]));
  for (const pr of solverResult.packetRows) {
    const pi = pktMap.get(pr.packet_id);
    if (pi === undefined) continue;
    schedHops[pi] = { route: pr.selected_route, starts: pr.hops.map(h => h.start_us) };
  }

  const steps = [];
  const linkOcc = Object.fromEntries(model.links.map(l => [l.id, []]));

  /* ── Line 0: function signature ── */
  steps.push({
    lineIdx: 0, desc: 'buildResult(model, pkts, schedHops, method, stats) — begin',
    vars: { pkts: pkts.length, 'model.links': model.links.length, 'model.cycle_time_us': model.cycle_time_us, method: solverResult.method, schedHops: schedHops.filter(Boolean).length + ' entries' }
  });

  const linkRows = Object.fromEntries(model.links.map(l => [l.id, []]));
  const pktRows = [];

  /* ── Line 1: linkRows init ── */
  steps.push({
    lineIdx: 1, desc: 'Initialize linkRows for each link',
    vars: { linkRows: deep(linkRows), 'linkRows.size': Object.keys(linkRows).length }
  });

  /* ── Line 2: pktRows init ── */
  steps.push({
    lineIdx: 2, desc: 'Initialize pktRows = []',
    vars: { pktRows: [], 'pktRows.size': 0 }
  });

  for (let p = 0; p < pkts.length; p++) {
    const pk = pkts[p], sh = schedHops[p];
    if (!sh) continue;
    const selR = sh.route, rt = pk.routes[selR], hops = [];

    /* ── Line 4: pk, sh assignment ── */
    steps.push({
      lineIdx: 4, desc: `Packet p=${p}: ${pk.pid} (flow=${pk.fid}, pri=${pk.pri})`,
      vars: { p, pid: pk.pid, fid: pk.fid, pri: pk.pri, tsn: pk.tsn, rel: pk.rel, dl: pk.dl, routes: deep(pk.routes), sh: deep(sh) }
    });

    /* ── Line 5: route selection ── */
    steps.push({
      lineIdx: 5, desc: `Route ${selR}: ${rt.hops.map(h => h.lid).join(' → ')}`,
      vars: { selR, rt: deep(rt), hops: deep(hops) }
    });

    for (let h = 0; h < rt.hops.length; h++) {
      const hp = rt.hops[h], s = sh.starts[h], e = round3(s + hp.tx);

      /* ── Line 7: extract hop data ── */
      steps.push({
        lineIdx: 7, desc: `Hop ${h+1}/${rt.hops.length}: hp=${hp.lid}, s=${round3(s)}, e=${e}`,
        vars: { h, hp: deep(hp), s: round3(s), e }
      });

      hops.push({ link_id: hp.lid, start_us: round3(s), end_us: e, duration_us: round3(hp.tx) });

      /* ── Line 8: hops.push ── */
      steps.push({
        lineIdx: 8, desc: `hops.push({ link_id: ${hp.lid}, start: ${round3(s)}, end: ${e} })`,
        vars: { hops: deep(hops) }
      });

      linkRows[hp.lid].push({ type: 'flow', note: pk.pid, priority: pk.pri, tsn: pk.tsn, start_us: round3(s), end_us: e, duration_us: round3(hp.tx) });

      const delta = { lid: hp.lid, interval: [round3(s), e] };
      linkOcc[hp.lid].push([round3(s), e]);

      /* ── Line 9: linkRows push (+ delta) ── */
      steps.push({
        lineIdx: 9, desc: `linkRows[${hp.lid}].push flow [${round3(s)}, ${e}]`,
        vars: { linkRows: deep(linkRows), 'linkRows.size': Object.keys(linkRows).length },
        delta
      });
    }

    const lH = rt.hops.at(-1), fin = hops.at(-1).end_us + lH.pd, e2e = round3(fin - pk.rel);
    const ok = pk.dl == null || fin <= pk.dl + 1e-6;

    /* ── Line 12: compute e2e ── */
    steps.push({
      lineIdx: 12, desc: `${pk.pid}: fin=${round3(fin)}, e2e=${e2e}µs`,
      vars: { pid: pk.pid, fin: round3(fin), rel: round3(pk.rel), e2e, lH: deep(lH) }
    });

    /* ── Line 13: deadline check ── */
    steps.push({
      lineIdx: 13, desc: `${pk.pid}: ok=${ok} (dl=${pk.dl == null ? 'none' : pk.dl})`,
      vars: { pid: pk.pid, ok, dl: pk.dl, fin: round3(fin) }
    });

    pktRows.push({
      packet_id: pk.pid, flow_id: pk.fid, priority: pk.pri,
      selected_route: selR, release_us: round3(pk.rel), end_us: round3(fin),
      e2e_delay_us: e2e, status: pk.dl == null ? 'NON-ST' : ok ? 'OK' : 'MISS', hops
    });

    /* ── Line 14: pktRows.push ── */
    steps.push({
      lineIdx: 14, desc: `${pk.pid}: e2e=${e2e}µs, status=${pk.dl == null ? 'NON-ST' : ok ? 'OK' : 'MISS'}`,
      vars: { pid: pk.pid, fid: pk.fid, selR, e2e, hops: deep(hops), pktRows: deep(pktRows), 'pktRows.size': pktRows.length },
      pktStatus: { pid: pk.pid, status: pk.dl == null ? 'NON-ST' : ok ? 'OK' : 'MISS', e2e }
    });
  }

  /* ── Line 16: pktRows.sort ── */
  pktRows.sort((a, b) => a.end_us - b.end_us);
  steps.push({
    lineIdx: 16, desc: `pktRows.sort by end_us (${pktRows.length} packets)`,
    vars: { pktRows: deep(pktRows), 'pktRows.size': pktRows.length }
  });

  /* ── Line 18: init gcl ── */
  const gcl = { cycle_time_us: model.cycle_time_us, base_time_us: 0, links: {} };
  steps.push({
    lineIdx: 18, desc: 'Initialize GCL structure',
    vars: { 'gcl.cycle_time_us': model.cycle_time_us, 'gcl.base_time_us': 0, 'gcl.links': deep(gcl.links), 'gcl.links.size': Object.keys(gcl.links).length }
  });

  /* ── Lines 19-29: GCL building per link ── */
  if (model.no_be) {
    // No-BE mode: build GCL from actual packet placements
    steps.push({ lineIdx: 19, desc: 'no_be mode: skip gate schedule, build GCL from packet placements', vars: { 'model.no_be': true } });

    for (const lnk of model.links) {
      const rows = linkRows[lnk.id].slice().sort((a, b) => a.start_us - b.start_us);
      const entries = [];
      let idx = 0, cursor = 0;

      for (const r of rows) {
        if (r.start_us > cursor + 0.001) {
          entries.push({ index: idx++, gate_mask: '00000000', start_us: round3(cursor), end_us: r.start_us, duration_us: round3(r.start_us - cursor), note: 'all-gates-closed' });
        }
        const tc = r.queue >= 0 ? r.queue : r.priority;
        const mask = Array(8).fill('0'); mask[7 - tc] = '1';
        entries.push({ index: idx++, gate_mask: mask.join(''), start_us: r.start_us, end_us: r.end_us, duration_us: r.duration_us, note: r.note });
        steps.push({
          lineIdx: 24, desc: `GCL TC${tc} pkt ${r.note} [${r.start_us}, ${r.end_us}]`,
          vars: { type: 'tc', tc, pkt: r.note },
          gantt: { type: 'flow', lid: lnk.id, s: r.start_us, e: r.end_us, dur: r.duration_us, pid: r.note, color: flowColor(r.note.split('#')[0]) || '#89b4fa' }
        });
        cursor = r.end_us;
      }
      if (cursor < model.cycle_time_us - 0.001) {
        entries.push({ index: idx++, gate_mask: '00000000', start_us: round3(cursor), end_us: model.cycle_time_us, duration_us: round3(model.cycle_time_us - cursor), note: 'all-gates-closed' });
      }
      if (entries.length === 0) {
        entries.push({ index: 0, gate_mask: '00000000', start_us: 0, end_us: model.cycle_time_us, duration_us: model.cycle_time_us, note: 'all-gates-closed' });
      }
      gcl.links[lnk.id] = { from: lnk.from, to: lnk.to, entries };

      steps.push({
        lineIdx: 28, desc: `gcl.links[${lnk.id}] = { ${entries.length} entries }`,
        vars: { 'gcl.links': deep(gcl.links), 'gcl.links.size': Object.keys(gcl.links).length }
      });
    }
  } else {
    // Standard mode: pre-computed gate schedule
    const gateSchedule = computeGateSchedule(model, pkts);

    steps.push({
      lineIdx: 19, desc: `computeGateSchedule → ${Object.keys(gateSchedule).length} node(s) with gate schedule`,
      vars: { gateSchedule: deep(gateSchedule) }
    });

    for (const lnk of model.links) {
      const linkGate = (gateSchedule[lnk.from] || {})[lnk.id];

      steps.push({
        lineIdx: 20, desc: `Link ${lnk.id}: ${linkGate ? linkGate.length + ' gate entries (802.1Qbv)' : 'no gate schedule (all open)'}`,
        vars: { 'lnk.id': lnk.id, 'lnk.from': lnk.from, hasGate: !!linkGate }
      });

      if (linkGate) {
        const rows = linkRows[lnk.id].slice().sort((a, b) => a.start_us - b.start_us);
        const entries = [];
        let idx = 0;

        for (const gs of linkGate) {
          if (gs.type === 'guard') {
            entries.push({ index: idx++, gate_mask: '00000000', start_us: gs.open, end_us: gs.close, duration_us: round3(gs.close - gs.open), note: 'guard' });
            steps.push({
              lineIdx: 24, desc: `GCL guard band [${gs.open}, ${gs.close}]`,
              vars: { type: 'guard', open: gs.open, close: gs.close },
              gantt: { type: 'guard', lid: lnk.id, s: gs.open, e: gs.close, dur: round3(gs.close - gs.open), before: 'TC transition' }
            });
          } else if (gs.type === 'closed') {
            entries.push({ index: idx++, gate_mask: '00000000', start_us: gs.open, end_us: gs.close, duration_us: round3(gs.close - gs.open), note: 'all-gates-closed' });
            steps.push({
              lineIdx: 24, desc: `GCL all-gates-closed [${gs.open}, ${gs.close}]`,
              vars: { type: 'closed', open: gs.open, close: gs.close },
              gantt: { type: 'guard', lid: lnk.id, s: gs.open, e: gs.close, dur: round3(gs.close - gs.open), before: 'No BE' }
            });
          } else if (gs.type === 'be') {
            entries.push({ index: idx++, gate_mask: '11111111', start_us: gs.open, end_us: gs.close, duration_us: round3(gs.close - gs.open), note: 'non-ST' });
            steps.push({
              lineIdx: 24, desc: `GCL BE window [${gs.open}, ${gs.close}]`,
              vars: { type: 'be', open: gs.open, close: gs.close },
              gantt: { type: 'flow', lid: lnk.id, s: gs.open, e: gs.close, dur: round3(gs.close - gs.open), pid: 'BE', color: '#555' }
            });
          } else {
            const tc = gs.queue;
            const mask = Array(8).fill('0'); mask[7 - tc] = '1';
            const gateMask = mask.join('');
            const windowPkts = rows.filter(r => r.start_us >= gs.open - 1e-9 && r.end_us <= gs.close + 1e-9);

            if (windowPkts.length > 0) {
              for (const wp of windowPkts) {
                entries.push({ index: idx++, gate_mask: gateMask, start_us: wp.start_us, end_us: wp.end_us, duration_us: wp.duration_us, note: wp.note });
                steps.push({
                  lineIdx: 24, desc: `GCL TC${tc} pkt ${wp.note} [${wp.start_us}, ${wp.end_us}]`,
                  vars: { type: 'tc', tc, mask: gateMask, pkt: wp.note, start: wp.start_us, end: wp.end_us },
                  gantt: { type: 'flow', lid: lnk.id, s: wp.start_us, e: wp.end_us, dur: wp.duration_us, pid: wp.note, color: flowColor(wp.note.split('#')[0]) || '#89b4fa' }
                });
              }
            } else {
              entries.push({ index: idx++, gate_mask: gateMask, start_us: gs.open, end_us: gs.close, duration_us: round3(gs.close - gs.open), note: 'non-ST' });
              steps.push({
                lineIdx: 24, desc: `GCL TC${tc} empty window [${gs.open}, ${gs.close}]`,
                vars: { type: 'tc', tc, mask: gateMask, open: gs.open, close: gs.close },
                gantt: { type: 'flow', lid: lnk.id, s: gs.open, e: gs.close, dur: round3(gs.close - gs.open), pid: `TC${tc}`, color: '#444' }
              });
            }
          }
        }
        gcl.links[lnk.id] = { from: lnk.from, to: lnk.to, entries };
      } else {
        const rows = linkRows[lnk.id].slice().sort((a, b) => a.start_us - b.start_us);
        const entries = [];
        let idx = 0;
        if (rows.length > 0) {
          for (const r of rows) {
            entries.push({ index: idx++, gate_mask: '11111111', start_us: r.start_us, end_us: r.end_us, duration_us: r.duration_us, note: r.note });
          }
          const lastEnd = rows.at(-1).end_us;
          if (lastEnd < model.cycle_time_us - 1) {
            entries.push({ index: idx++, gate_mask: '11111111', start_us: round3(lastEnd), end_us: model.cycle_time_us, duration_us: round3(model.cycle_time_us - lastEnd), note: 'non-ST' });
          }
        } else {
          entries.push({ index: 0, gate_mask: '11111111', start_us: 0, end_us: model.cycle_time_us, duration_us: model.cycle_time_us, note: 'non-ST' });
        }
        gcl.links[lnk.id] = { from: lnk.from, to: lnk.to, entries };
        steps.push({
          lineIdx: 24, desc: `${lnk.id}: no gate schedule, ${rows.length} packet bars + fill`,
          vars: { 'lnk.id': lnk.id, entries: deep(entries) }
        });
      }

      steps.push({
        lineIdx: 28, desc: `gcl.links[${lnk.id}] = { ${gcl.links[lnk.id].entries.length} entries }`,
        vars: { 'gcl.links': deep(gcl.links), 'gcl.links.size': Object.keys(gcl.links).length }
      });
    }
  }

    /* ── Line 28: gcl.links[lnk.id] assigned ── */
    steps.push({
      lineIdx: 28, desc: `gcl.links[${lnk.id}] = { ${gcl.links[lnk.id].entries.length} entries }`,
      vars: { 'gcl.links': deep(gcl.links), 'gcl.links.size': Object.keys(gcl.links).length }
    });
  }

  /* ── Line 31: worstUtil init ── */
  let worstUtil = 0;
  steps.push({
    lineIdx: 31, desc: 'let worstUtil = 0',
    vars: { worstUtil: 0 }
  });

  /* ── Lines 32-35: worstUtil per link ── */
  for (const lnk of model.links) {
    let act = 0;
    steps.push({
      lineIdx: 32, desc: `${lnk.id}: let act = 0`,
      vars: { lnk: deep(lnk), 'lnk.id': lnk.id, act: 0 }
    });
    for (const e of gcl.links[lnk.id].entries) {
      if (!e.note.includes('non-ST') && !e.note.includes('guard') && !e.note.includes('all-gates-closed')) {
        act += e.duration_us;
        steps.push({
          lineIdx: 33, desc: `${lnk.id}: act += ${round3(e.duration_us)} → ${round3(act)}`,
          vars: { lnk: deep(lnk), 'lnk.id': lnk.id, 'e.note': e.note, 'e.duration_us': e.duration_us, act: round3(act) }
        });
      } else {
        steps.push({
          lineIdx: 33, desc: `${lnk.id}: skip "${e.note}" entry`,
          vars: { lnk: deep(lnk), 'lnk.id': lnk.id, 'e.note': e.note, 'e.duration_us': e.duration_us, act: round3(act) }
        });
      }
    }

    /* ── Line 34: worstUtil update ── */
    worstUtil = Math.max(worstUtil, act / model.cycle_time_us * 100);
    steps.push({
      lineIdx: 34, desc: `${lnk.id}: worstUtil = max(${round3(worstUtil)}%, ${round3(act / model.cycle_time_us * 100)}%)`,
      vars: { lnk: deep(lnk), 'lnk.id': lnk.id, act: round3(act), worstUtil: round3(worstUtil) }
    });
  }

  /* ── Line 37: overlapConflicts init ── */
  let overlapConflicts = 0;
  steps.push({
    lineIdx: 37, desc: 'let overlapConflicts = 0',
    vars: { overlapConflicts: 0 }
  });

  /* ── Lines 38-43: overlap per link ── */
  for (const lnk of model.links) {
    const rows = linkRows[lnk.id].slice().sort((a, b) => a.start_us - b.start_us);
    let linkConflicts = 0;

    steps.push({
      lineIdx: 38, desc: `${lnk.id}: const rows = linkRows[${lnk.id}].sort()`,
      vars: { lnk: deep(lnk), 'lnk.id': lnk.id, rows: deep(rows) }
    });

    for (let i = 1; i < rows.length; i++) {
      const overlap = rows[i].start_us < rows[i - 1].end_us - 1e-9;
      if (overlap) { overlapConflicts++; linkConflicts++; }
      steps.push({
        lineIdx: 40, desc: `${lnk.id}: compare [${i-1}] vs [${i}] → ${overlap ? 'OVERLAP' : 'OK'}`,
        vars: { lnk: deep(lnk), 'lnk.id': lnk.id, rows: deep(rows), i, overlapConflicts }
      });
    }

    steps.push({
      lineIdx: 41, desc: `${lnk.id}: ${linkConflicts} overlap(s)`,
      vars: { lnk: deep(lnk), 'lnk.id': lnk.id, overlapConflicts }
    });
  }

  /* ── Line 44: outStats ── */
  let obj = 0;
  for (const r of pktRows) if (r.status !== 'NON-ST') obj += r.e2e_delay_us;
  obj = round3(obj);
  const stats = solverResult.stats || {};
  const outStats = { ...stats, overlap_conflicts: overlapConflicts };
  steps.push({
    lineIdx: 44, desc: `outStats = { ...stats, overlap_conflicts: ${overlapConflicts} }`,
    vars: { outStats: deep(outStats) }
  });

  /* ── Line 46: return ── */
  steps.push({
    lineIdx: 46, desc: `Return: method=${solverResult.method}, objective=${obj}µs, worst_util=${round3(worstUtil)}%`,
    vars: { 'method': solverResult.method, objective: obj, worst_util_percent: round3(worstUtil), pktRows: deep(pktRows), 'pktRows.size': pktRows.length, overlapConflicts },
    gcl: deep(gcl),
    packetRows: deep(pktRows)
  });

  // ── Board Configurations (per-switch, per-egress-port GCL) ──
  const boardConfigs = {};
  for (const lnk of model.links) {
    if (nodeType[lnk.from] !== 'switch') continue;
    if (!boardConfigs[lnk.from]) boardConfigs[lnk.from] = { ports: {} };
    const gclEntries = gcl.links[lnk.id]?.entries || [];
    const pcpSet = new Set();
    for (const e of gclEntries) {
      if (e.gate_mask && e.gate_mask !== '00000000' && e.gate_mask !== '11111111') {
        const q = e.gate_mask.split('').reverse().indexOf('1');
        if (q >= 0) pcpSet.add(q);
      }
    }
    boardConfigs[lnk.from].ports[lnk.id] = {
      to: lnk.to,
      cycle_time_us: model.cycle_time_us,
      guard_band_us: model.guard_band_us,
      num_entries: gclEntries.length,
      pcp_queue_map: [...pcpSet].sort((a, b) => b - a).map(q => ({ pcp: q, queue: q })),
      entries: gclEntries
    };
  }

  const activeLinks = model.links.filter(l => linkOcc[l.id] && linkOcc[l.id].length > 0);

  return {
    steps, pkts, activeLinks, schedHops, boardConfigs,
    depInfo: `${solver === 'ilp' ? 'solveILP' : 'solveGreedy'} silently ran first → ${pkts.length} packets scheduled, then buildResult constructs GCL`
  };
}
