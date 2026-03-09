/* solve-greedy.js — instrumentSolveGreedy */
import {
  round3, txTimeUs,
  fmtPkts, fmtLinkOcc, fmtSchedHops
} from '../debug-utils.js';
import { solveGreedy as solveGreedyCore } from '../ilp-core.js';
import { generateKPaths, computeGateSchedule, flowColor } from '../ilp-core.js';

export function instrumentSolveGreedy(model) {
  if (!model.processing_delay_us) model.processing_delay_us = 3;

  const steps = [];

  steps.push({
    lineIdx: 0, desc: 'solveGreedy(model) — begin',
    vars: { 'model.flows': model.flows.length, 'model.links': model.links.length, 'model.cycle_time_us': model.cycle_time_us, 'model.processing_delay_us': model.processing_delay_us }
  });

  steps.push({
    lineIdx: 1, desc: `processing_delay_us = ${model.processing_delay_us}`,
    vars: { 'model.processing_delay_us': model.processing_delay_us }
  });

  const t0 = performance.now();
  steps.push({
    lineIdx: 3, desc: `const t0 = performance.now() → ${round3(t0)}ms`,
    vars: { t0: round3(t0) }
  });

  const lm = new Map(model.links.map(l => [l.id, l]));
  const nodeType = Object.fromEntries(model.nodes.map(n => [n.id, n.type]));
  const adj = new Map();
  for (const l of model.links) {
    if (!adj.has(l.from)) adj.set(l.from, []);
    adj.get(l.from).push({ to: l.to, lid: l.id });
  }
  const pkts = [];
  for (const f of model.flows) {
    let cp = f.candidate_paths || (f.path ? [f.path] : null);
    if (!cp && f.src && f.dst) cp = generateKPaths(adj, f.src, f.dst, Math.max(1, f.k_paths || 2), model.nodes.length + 2);
    if (!cp || !Array.isArray(cp) || cp.length === 0) continue;
    const reps = Math.round(model.cycle_time_us / f.period_us);
    for (let kk = 0; kk < reps; kk++) {
      const rel = kk * f.period_us;
      pkts.push({
        pid: `${f.id}#${kk}`, fid: f.id, pri: f.PCP ?? f.priority, tt: f.traffic_type,
        rel, dl: f.deadline_us == null ? null : rel + f.deadline_us,
        tsn: true,
        routes: cp.map((pl, ri) => ({
          ri, hops: pl.map(lid => ({
            lid, tx: txTimeUs(f.payload_bytes, lm.get(lid).rate_mbps),
            pd: lm.get(lid).prop_delay_us
          }))
        }))
      });
    }
  }

  steps.push({
    lineIdx: 4, desc: `const pkts = expandPackets(model) → ${pkts.length} packets`,
    vars: { 'pkts.length': pkts.length, pkts: fmtPkts(pkts) },
    showPkts: true
  });

  let fallbackCount = 0;
  steps.push({
    lineIdx: 5, desc: 'let fallbackCount = 0',
    vars: { fallbackCount: 0 }
  });

  // ── IEEE 802.1Qbv gate schedule ──
  const gateSchedule = computeGateSchedule(model, pkts);
  const linkGateWindows = {};
  let totalGateWindows = 0;
  for (const lnk of model.links) {
    const nodeGates = gateSchedule[lnk.from];
    const entries = nodeGates && nodeGates[lnk.id];
    if (entries) {
      linkGateWindows[lnk.id] = entries.filter(e => e.type === 'tc' || e.type === 'be').sort((a, b) => a.open - b.open);
      totalGateWindows += linkGateWindows[lnk.id].length;
    }
  }

  const gateLinksCount = Object.keys(linkGateWindows).length;
  steps.push({
    lineIdx: 6, desc: `const gateSchedule = computeGateSchedule(model, pkts) → ${gateLinksCount} links with gate, ${totalGateWindows} TC windows`,
    vars: { 'gateLinks': gateLinksCount, 'totalGateWindows': totalGateWindows }
  });

  // Gate window details per link
  for (const [lid, windows] of Object.entries(linkGateWindows)) {
    const windowSummary = windows.map(w => `TC${w.queue}[${round3(w.open)}-${round3(w.close)}]`).join(', ');
    steps.push({
      lineIdx: 7, desc: `linkGateWindows["${lid}"] — ${windows.length} TC windows`,
      vars: { lid, windows: windowSummary }
    });
  }

  const linkOcc = Object.fromEntries(model.links.map(l => [l.id, []]));
  steps.push({
    lineIdx: 9, desc: `const linkOcc — ${model.links.length} links, all empty`,
    vars: { 'linkOcc.size': model.links.length, linkOcc: fmtLinkOcc(linkOcc) }
  });

  function findEarliest(lid, earliest, duration, pktTC) {
    const occ = linkOcc[lid];
    const gw = linkGateWindows[lid];
    let t = earliest;
    let assignedQueue = -1;
    const MAX_ITER = 10000;

    for (let iter = 0; iter < MAX_ITER; iter++) {
      if (gw) {
        let inGate = false;
        for (const w of gw) {
          if (w.queue !== pktTC) continue;
          if (w.open > t + 1e-9) {
            if (duration <= w.close - w.open + 1e-9) { t = w.open; assignedQueue = w.queue; inGate = true; break; }
          } else if (t >= w.open - 1e-9 && t + duration <= w.close + 1e-9) {
            assignedQueue = w.queue; inGate = true; break;
          }
        }
        if (!inGate) return { t: Infinity, queue: -1 };
      }

      let moved = false;
      for (const [s, e] of occ) {
        if (t < e && t + duration > s) {
          t = e; moved = true; break;
        }
      }
      if (!moved) return { t, queue: assignedQueue };
    }
    return { t: Infinity, queue: -1 };
  }

  steps.push({
    lineIdx: 10, desc: 'Define findEarliest(lid, earliest, duration) — gate-aware + collision-free slot finder',
    vars: {}
  });

  const order = pkts.map((_, i) => i);
  steps.push({
    lineIdx: 28, desc: `const order = pkts.map((pk, i) => i)`,
    vars: { 'order.length': order.length, order: `[${order.join(', ')}]` }
  });

  steps.push({
    lineIdx: 29, desc: `order.sort((a, b) => { ... }) — begin sorting`,
    vars: { 'order.length': order.length, order: `[${order.join(', ')}]` }
  });

  const trackOrder = order.slice();
  const sortComparisons = [];

  for (let i = 1; i < trackOrder.length; i++) {
    const key = trackOrder[i];
    const pkKey = pkts[key];
    let j = i - 1;

    while (j >= 0) {
      const cur = trackOrder[j];
      const pkCur = pkts[cur];

      let cmpResult, field;
      if (pkCur.pri !== pkKey.pri) {
        cmpResult = pkKey.pri - pkCur.pri;
        field = 'pri';
      } else if (pkCur.rel !== pkKey.rel) {
        cmpResult = pkCur.rel - pkKey.rel;
        field = 'rel';
      } else {
        cmpResult = (pkCur.dl ?? Infinity) - (pkKey.dl ?? Infinity);
        field = 'dl';
      }

      const shifted = cmpResult > 0;
      if (shifted) {
        trackOrder[j + 1] = trackOrder[j];
        j--;
      }

      const snapshot = trackOrder.slice();
      snapshot[j + 1] = key;

      sortComparisons.push({
        cur, key, pkCur, pkKey, field, cmpResult, shifted,
        orderAfter: snapshot
      });

      if (!shifted) break;
    }

    trackOrder[j + 1] = key;
  }

  for (let si = 0; si < sortComparisons.length; si++) {
    const sc = sortComparisons[si];
    const pa = sc.pkCur, pb = sc.pkKey;

    steps.push({
      lineIdx: 30, desc: `compare [${si+1}/${sortComparisons.length}]: ${pa.pid} vs ${pb.pid}`,
      vars: {
        'a': `${sc.cur} (${pa.pid})`,
        'b': `${sc.key} (${pb.pid})`,
        'a.pri': pa.pri, 'a.rel': pa.rel, 'a.dl': (pa.dl ?? Infinity) === Infinity ? '∞' : pa.dl,
        'b.pri': pb.pri, 'b.rel': pb.rel, 'b.dl': (pb.dl ?? Infinity) === Infinity ? '∞' : pb.dl
      }
    });

    const cmpLineIdx = sc.field === 'pri' ? 31 : sc.field === 'rel' ? 32 : 33;
    const fieldLabel = sc.field === 'pri' ? 'higher pri' : sc.field === 'rel' ? 'earlier rel' : 'tighter dl';
    const winner = sc.shifted ? pb.pid : pa.pid;

    steps.push({
      lineIdx: cmpLineIdx,
      desc: `${sc.field}: ${winner} wins (${fieldLabel})${sc.shifted ? ' → shift' : ' → keep'}`,
      vars: {
        'return': `${sc.cmpResult} → ${sc.shifted ? 'b before a' : 'a stays'}`,
        order: `[${sc.orderAfter.map(v => `${v}(${pkts[v].pid})`).join(', ')}]`
      }
    });
  }

  order.length = 0;
  trackOrder.forEach(v => order.push(v));

  steps.push({
    lineIdx: 35, desc: `sort complete — sorted by pri DESC → rel ASC → dl ASC`,
    vars: {
      'order.length': order.length,
      order: `[${order.map(v => `${v}(${pkts[v].pid})`).join(', ')}]`
    }
  });

  const schedHops = new Array(pkts.length);
  steps.push({
    lineIdx: 36, desc: `const schedHops = new Array(${pkts.length})`,
    vars: { 'schedHops.length': schedHops.length }
  });

  let pktsDone = 0;

  for (const pi of order) {
    const pk = pkts[pi];

    steps.push({
      lineIdx: 37, desc: `for loop — packet ${pktsDone + 1}/${pkts.length}`,
      vars: { pi, pid: pk.pid }
    });

    steps.push({
      lineIdx: 38, desc: `const pk = pkts[${pi}] → ${pk.pid}`,
      vars: { pid: pk.pid, fid: pk.fid, pri: pk.pri, tt: pk.tt, rel: pk.rel, dl: pk.dl, tsn: pk.tsn }
    });

    let bestRoute = 0, bestEnd = Infinity, bestStarts = null, bestQueues = null;
    steps.push({
      lineIdx: 39, desc: 'let bestRoute = 0, bestEnd = Infinity, bestStarts = null, bestQueues = null',
      vars: { bestRoute, bestEnd: 'Infinity', bestStarts: 'null', bestQueues: 'null' }
    });

    for (let ri = 0; ri < pk.routes.length; ri++) {
      const rt = pk.routes[ri];
      const starts = [], queues = [];
      let t = pk.rel, valid = true;

      steps.push({
        lineIdx: 40, desc: `Try route[${ri}] — ${rt.hops.length} hops: [${rt.hops.map(h => h.lid).join(' → ')}]`,
        vars: { ri, rt: `{"ri": ${rt.ri}, "hops": [${rt.hops.map(h => `{"lid": "${h.lid}", "tx": ${round3(h.tx)}, "pd": ${h.pd}}`).join(', ')}]}`, t: pk.rel, valid: true }
      });

      steps.push({
        lineIdx: 41, desc: `const starts = [], t = ${pk.rel}, valid = true`,
        vars: { starts: '[]', t: pk.rel, valid: true }
      });

      for (let h = 0; h < rt.hops.length; h++) {
        const hp = rt.hops[h];

        steps.push({
          lineIdx: 43, desc: `hop[${h}]: ${hp.lid} (tx=${round3(hp.tx)}µs, pd=${hp.pd}µs)`,
          vars: { h, hp: `{"lid": "${hp.lid}", "tx": ${round3(hp.tx)}, "pd": ${hp.pd}}` }
        });

        const hasGate = !!linkGateWindows[hp.lid];
        steps.push({
          lineIdx: 45, desc: `→ findEarliest("${hp.lid}", ${round3(t)}, ${round3(hp.tx)}, TC${pk.pri})${hasGate ? ' [gate-constrained]' : ' [no gate]'}`,
          vars: { 'hp.lid': hp.lid, t: round3(t), 'hp.tx': round3(hp.tx), 'pktTC': pk.pri, 'hasGate': hasGate }
        });

        const res = findEarliest(hp.lid, t, hp.tx, pk.pri);

        if (res.t === Infinity) {
          valid = false;
          steps.push({
            lineIdx: 46, desc: `s = Infinity → no gate window fits → valid = false, break`,
            vars: { s: '∞', valid: false }
          });
          break;
        }

        const s = res.t;
        const qLabel = res.queue >= 0 ? ` → Q${res.queue}` : '';
        steps.push({
          lineIdx: 46, desc: `s = findEarliest() → ${round3(s)}${qLabel}${hasGate && round3(s) !== round3(t) ? ` (pushed from ${round3(t)} by gate/occ)` : ''}`,
          vars: { s: round3(s), assignedQueue: res.queue }
        });

        if (s + hp.tx > model.cycle_time_us) {
          valid = false;
          steps.push({
            lineIdx: 47, desc: `${round3(s)} + ${round3(hp.tx)} = ${round3(s + hp.tx)} > ${model.cycle_time_us} → valid = false, break`,
            vars: { valid: false }
          });
          break;
        }
        steps.push({
          lineIdx: 47, desc: `${round3(s)} + ${round3(hp.tx)} = ${round3(s + hp.tx)} ≤ ${model.cycle_time_us} → OK`,
          vars: { valid: true }
        });

        starts.push(s);
        queues.push(res.queue);
        steps.push({
          lineIdx: 48, desc: `starts.push(${round3(s)}), queues.push(Q${res.queue})`,
          vars: { starts: starts.map(v => round3(v)), queues: queues.map(q => `Q${q}`) }
        });

        t = s + hp.tx + hp.pd + model.processing_delay_us;
        steps.push({
          lineIdx: 49, desc: `t = ${round3(s)} + ${round3(hp.tx)} + ${hp.pd} + ${model.processing_delay_us} = ${round3(t)}µs`,
          vars: { t: round3(t) }
        });
      }

      if (valid) {
        const lastH = rt.hops.at(-1);
        const fin = starts.at(-1) + lastH.tx + lastH.pd;

        steps.push({
          lineIdx: 51, desc: `valid = true → evaluate finish time`,
          vars: { valid: true }
        });

        steps.push({
          lineIdx: 52, desc: `lastH = rt.hops[${rt.hops.length - 1}]`,
          vars: { lastH: `{"lid": "${lastH.lid}", "tx": ${round3(lastH.tx)}, "pd": ${lastH.pd}}` }
        });

        steps.push({
          lineIdx: 53, desc: `fin = ${round3(starts.at(-1))} + ${round3(lastH.tx)} + ${lastH.pd} = ${round3(fin)}µs`,
          vars: { fin: round3(fin), bestEnd: bestEnd === Infinity ? 'Infinity' : round3(bestEnd) }
        });

        if (fin < bestEnd) {
          bestEnd = fin; bestRoute = ri; bestStarts = starts.slice(); bestQueues = queues.slice();
          steps.push({
            lineIdx: 54, desc: `${round3(fin)} < ${bestEnd === fin ? 'Infinity' : round3(bestEnd)} → update best: route=${ri}, end=${round3(bestEnd)}`,
            vars: { bestRoute: ri, bestEnd: round3(bestEnd), bestStarts: bestStarts.map(v => round3(v)), bestQueues: bestQueues.map(q => `Q${q}`) }
          });
        } else {
          steps.push({
            lineIdx: 54, desc: `${round3(fin)} ≥ ${round3(bestEnd)} → keep current best`,
            vars: { bestRoute, bestEnd: round3(bestEnd) }
          });
        }
      } else {
        steps.push({
          lineIdx: 51, desc: `valid = false → skip route[${ri}]`,
          vars: { valid: false }
        });
      }
    }

    if (!bestStarts) {
      steps.push({
        lineIdx: 56, desc: `!bestStarts → fallback placement`,
        vars: { bestStarts: 'null' }
      });

      const fbRt = pk.routes[0];
      steps.push({
        lineIdx: 57, desc: `const rt = pk.routes[0]`,
        vars: { rt: `{"ri": ${fbRt.ri}, "hops": [${fbRt.hops.map(h => `{"lid": "${h.lid}", "tx": ${round3(h.tx)}, "pd": ${h.pd}}`).join(', ')}]}` }
      });

      bestStarts = []; bestQueues = []; let fbT = pk.rel;
      steps.push({
        lineIdx: 58, desc: `bestStarts = [], bestQueues = [], t = ${round3(pk.rel)}`,
        vars: { bestStarts: '[]', bestQueues: '[]', t: round3(fbT) }
      });

      for (const hp of fbRt.hops) {
        bestStarts.push(fbT);
        bestQueues.push(-1);
        steps.push({
          lineIdx: 59, desc: `bestStarts.push(${round3(fbT)}), t = ${round3(fbT)} + ${round3(hp.tx)} + ${hp.pd} + ${model.processing_delay_us}`,
          vars: { hp: `{"lid": "${hp.lid}", "tx": ${round3(hp.tx)}, "pd": ${hp.pd}}`, bestStarts: `[${bestStarts.map(v => round3(v)).join(', ')}]`, t: round3(fbT) }
        });
        fbT += hp.tx + hp.pd + model.processing_delay_us;
      }

      bestRoute = 0; fallbackCount++;
      steps.push({
        lineIdx: 60, desc: `bestRoute = 0, fallbackCount = ${fallbackCount}`,
        vars: { bestRoute: 0, fallbackCount }
      });
    } else {
      steps.push({
        lineIdx: 56, desc: `bestStarts found → skip fallback → use route[${bestRoute}]`,
        vars: { bestRoute, bestEnd: round3(bestEnd), bestStarts: `[${bestStarts.map(v => round3(v)).join(', ')}]` }
      });
    }

    const selRt = pk.routes[bestRoute];
    steps.push({
      lineIdx: 62, desc: `const rt = pk.routes[${bestRoute}]`,
      vars: { rt: `{"ri": ${selRt.ri}, "hops": [${selRt.hops.map(h => `{"lid": "${h.lid}", "tx": ${round3(h.tx)}, "pd": ${h.pd}}`).join(', ')}]}` }
    });

    for (let h = 0; h < selRt.hops.length; h++) {
      const hp = selRt.hops[h];
      const s = bestStarts[h], e = round3(s + hp.tx);

      steps.push({
        lineIdx: 63, desc: `commit hop[${h}/${selRt.hops.length}]`,
        vars: { h, 'rt.hops.length': selRt.hops.length }
      });

      steps.push({
        lineIdx: 64, desc: `hp = rt.hops[${h}]`,
        vars: { hp: `{"lid": "${hp.lid}", "tx": ${round3(hp.tx)}, "pd": ${hp.pd}}` }
      });

      linkOcc[hp.lid].push([round3(s), e]);

      steps.push({
        lineIdx: 65, desc: `linkOcc["${hp.lid}"].push([${round3(s)}, ${e}])`,
        vars: {
          'bestStarts[h]': round3(s), 'hp.tx': round3(hp.tx),
          'linkOcc.size': Object.keys(linkOcc).length, linkOcc: fmtLinkOcc(linkOcc)
        },
        delta: { lid: hp.lid, interval: [round3(s), e] },
        gantt: { pid: pk.pid, fid: pk.fid, lid: hp.lid, s: round3(s), e, gs: null, color: flowColor(pk.fid), h, nh: selRt.hops.length, queue: bestQueues[h] }
      });
    }

    for (let h = 0; h < selRt.hops.length; h++) {
      const lid = selRt.hops[h].lid;
      linkOcc[lid].sort((a, b) => a[0] - b[0]);
      steps.push({
        lineIdx: 68, desc: `linkOcc["${lid}"].sort() — ${linkOcc[lid].length} intervals`,
        vars: { h, lid, linkOcc: fmtLinkOcc(linkOcc) }
      });
    }

    schedHops[pi] = { route: bestRoute, starts: bestStarts, queues: bestQueues };

    const lastH = selRt.hops.at(-1);
    const fin = bestStarts.at(-1) + lastH.tx + lastH.pd;
    const e2e = round3(fin - pk.rel);
    const ok = pk.dl == null || fin <= pk.dl + 1e-6;
    pktsDone++;

    steps.push({
      lineIdx: 70, desc: `schedHops[${pi}] = { route: ${bestRoute}, starts: [${bestStarts.map(v => round3(v)).join(', ')}] }`,
      vars: { schedHops: fmtSchedHops(schedHops, pkts) },
      pktStatus: { pid: pk.pid, status: pk.dl == null ? 'NON-ST' : ok ? 'OK' : 'MISS', e2e }
    });
  }

  const elapsed = Math.round(performance.now() - t0);

  steps.push({
    lineIdx: 72, desc: `Scheduling complete: ${pktsDone} packets, ${fallbackCount} fallbacks, elapsed=${elapsed}ms`,
    vars: { elapsed: elapsed + 'ms', fallbackCount }
  });

  steps.push({
    lineIdx: 73, desc: `return buildResult(model, pkts, schedHops, "Greedy (802.1Qbv TAS scheduler)", { runtime_ms: ${elapsed}, fallback_packets: ${fallbackCount} })`,
    vars: { elapsed: elapsed + 'ms', fallbackCount }
  });

  const activeLinks = model.links.filter(l => linkOcc[l.id] && linkOcc[l.id].length > 0);

  // Generate boardConfigs via the real solver
  const fullResult = solveGreedyCore(JSON.parse(JSON.stringify(model)));
  const boardConfigs = fullResult.boardConfigs || null;

  return {
    steps, pkts, activeLinks, schedHops, boardConfigs,
    solverStats: { runtime_ms: elapsed, fallback_packets: fallbackCount },
    depInfo: `expandPackets silently produced ${pkts.length} packets from ${model.flows.length} flows`
  };
}
