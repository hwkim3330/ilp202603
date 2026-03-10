/* solve-ilp.js — instrumentSolveILP (line-by-line LP formulation trace) */
import { round3, deep } from '../debug-utils.js';
import { expandPackets, solveILP, flowColor, computeGateSchedule } from '../ilp-core.js';

export async function instrumentSolveILP(model, glpk, opts = {}) {
  if (!glpk) throw new Error('GLPK failed to load');

    const origPD = model.processing_delay_us;
    const origGB = model.guard_band_us;
    if (!model.processing_delay_us) model.processing_delay_us = 3;
    if (model.guard_band_us == null) model.guard_band_us = 12.304;

    const steps = [];

    // ── Step: line 0 — function entry ──────────────────────────────────────
    steps.push({
      lineIdx: 0, desc: 'solveILP(model, glpk, opts) — begin',
      vars: {
        'model.nodes': model.nodes.length,
        'model.flows': model.flows.length, 'model.links': model.links.length,
        'model.cycle_time_us': model.cycle_time_us,
        'model.processing_delay_us': origPD || '(unset)',
        'model.guard_band_us': origGB != null ? origGB : '(unset)',
        'opts.tmlim': opts.tmlim || undefined
      }
    });

    // ── Step: line 1 — GLPK guard ──────────────────────────────────────────
    steps.push({
      lineIdx: 1, desc: '!glpk check → GLPK is ready, no throw',
      /*vars: {
        'glpk.GLP_MIN': glpk.GLP_MIN, 'glpk.GLP_LO': glpk.GLP_LO,
        'glpk.GLP_UP': glpk.GLP_UP, 'glpk.GLP_FX': glpk.GLP_FX,
        'glpk.GLP_OPT': glpk.GLP_OPT, 'glpk.GLP_FEAS': glpk.GLP_FEAS,
        'glpk.GLP_MSG_OFF': glpk.GLP_MSG_OFF
      }*/
    });

    // ── Step: line 2 — processing_delay_us default ─────────────────────────
    steps.push({
      lineIdx: 2, desc: `processing_delay_us → ${model.processing_delay_us}${!origPD ? ' (default applied)' : ' (already set)'}`,
      vars: {
        'model.processing_delay_us': model.processing_delay_us
      }
    });

    // ── Step: line 3 — guard_band_us default ───────────────────────────────
    steps.push({
      lineIdx: 3, desc: `guard_band_us → ${model.guard_band_us}${!origGB ? ' (default applied)' : ' (already set)'}`,
      vars: {
        'model.guard_band_us': model.guard_band_us
      }
    });

    // ── Step: line 4 — tmlim ───────────────────────────────────────────────
    const tmlim = opts.tmlim || 30;
    steps.push({
      lineIdx: 4, desc: `const tmlim = opts.tmlim || 15 → ${tmlim}`,
      vars: { tmlim, 'opts.tmlim': opts.tmlim || 30 }
    });

    // lineIdx 5: empty line
    steps.push({ lineIdx: 5, desc: ``, vars: {} });

    // ── Step 6: expandPackets ──────────────────────────────────────────────
    const pkts = expandPackets(model);
    steps.push({
      lineIdx: 6, desc: `expandPackets → ${pkts.length} packets (${pkts.filter(p=>p.tsn).length} TSN, ${pkts.filter(p=>!p.tsn).length} BE)`,
      showPkts: true
    });

    // ── Step 7: packet count guard ─────────────────────────────────────────
    steps.push({
      lineIdx: 7, desc: `pkts.length=${pkts.length} ≤ 70 → OK`,
      vars: { 'pkts.length': pkts.length }
    });

    // lineIdx 8: empty line
    steps.push({ lineIdx: 8, desc: ``, vars: {} });
    // lineIdx 9: // Check if all packets have exactly 1 route → use tight formulation
    steps.push({ lineIdx: 9, desc: `// Check if all packets have exactly 1 route → use tight formulation`, vars: {} });

    // ── Step 10: allSingleRoute — pkts.every() iteration ───────────────────
    const allSingleRoute = pkts.every(pk => pk.routes.length === 1);

    // Step: allSingleRoute result only
    steps.push({
      lineIdx: 10, desc: `allSingleRoute = ${allSingleRoute} → ${allSingleRoute ? 'Fixed-route tight LP (no z-vars)' : 'Multi-route big-M (z_p_r selectors)'}`,
      vars: {
        allSingleRoute
      }
    });

    // lineIdx 11: empty line
    steps.push({ lineIdx: 11, desc: ``, vars: {} });

    // ── Step: line 12 — init LP collections ──────────────────────────────────
    steps.push({
      lineIdx: 12, desc: 'Init LP collections: vars=Set(), sub=[], bins=[], obj=[]',
      vars: { vars: '∅', 'vars.size': 0, sub: '[]', 'sub.length': 0, bins: '[]', 'bins.length': 0, obj: '[]', 'obj.length': 0 }
    });

    // ── Step: line 13 — ci counter ─────────────────────────────────────────
    steps.push({
      lineIdx: 13, desc: 'let ci = 0 — constraint index counter',
      vars: { ci: 0 }
    });

    // ── Step: line 14 — sv helper ──────────────────────────────────────────
    steps.push({
      lineIdx: 14, desc: 'sv = (p, h) → "s_{p}_{h}" — start-time variable namer',
      vars: {}
    });

    // ── Step: line 15 — yv helper ──────────────────────────────────────────
    steps.push({
      lineIdx: 15, desc: 'yv = (l, a, b) → "y_{l}_{a}_{b}" — ordering binary namer',
      vars: {}
    });

    // ── Step: line 16 — av helper ──────────────────────────────────────────
    steps.push({
      lineIdx: 16, desc: 'const av = n => { vars.add(n); return n }',
      vars: {}
    });

    // ── Step: line 17 — ac helper ──────────────────────────────────────────
    steps.push({
      lineIdx: 17, desc: 'const ac = (pre, terms, bnd) => { sub.push({name, vars, bnds}) }',
      vars: {}
    });

    // ── Step: line 18 — ops array ──────────────────────────────────────────
    steps.push({
      lineIdx: 18, desc: 'const ops = [] — operations for pairwise ordering',
      vars: { ops: '[]', 'ops.length': 0 }
    });

    // ── Reconstruct LP formulation step-by-step ────────────────────────────
    const vars = new Set(), sub = [], bins = [], obj = [], ops = [];
    let ci = 0;
    const sv  = (p, h) => `s_${p}_${h}`;
    const yv  = (l, a, b) => `y_${l.replace(/[^a-zA-Z0-9]/g, '_')}_${a}_${b}`;
    const av  = n => { vars.add(n); return n; };
    const ac  = (pre, terms, bnd) => { sub.push({ name: `${pre}_${ci++}`, vars: terms, bnds: bnd }); };

    // ── IEEE 802.1Qbv gate schedule for ILP constraints ──
    // Skip gate constraints for no-BE mode (8 dedicated TCs)
    const gateSchedule = model.no_be ? {} : computeGateSchedule(model, pkts);
    const linkGateWindows = {};
    if (!model.no_be) {
      for (const lnk of model.links) {
        const nodeGates = gateSchedule[lnk.from];
        const entries = nodeGates && nodeGates[lnk.id];
        if (entries) {
          linkGateWindows[lnk.id] = entries.filter(e => e.type === 'tc' || e.type === 'be').sort((a, b) => a.open - b.open);
        }
      }
    }
    const gateLinksCount = Object.keys(linkGateWindows).length;
    let totalGateWindows = 0;
    for (const ws of Object.values(linkGateWindows)) totalGateWindows += ws.length;

    steps.push({
      lineIdx: 19, desc: `IEEE 802.1Qbv gate schedule: ${gateLinksCount} links with gate windows, ${totalGateWindows} TC windows total`,
      vars: { 'gateLinks': gateLinksCount, 'totalGateWindows': totalGateWindows }
    });

    if (allSingleRoute) {
      /* ── allSingleRoute === true 분기: 현재 미사용 (allSingleRoute는 항상 false)
      // ── Branch: Fixed-route ─────────────────────────────────────────────
      steps.push({
        lineIdx: 20, desc: `if (allSingleRoute) → true → Fixed-route formulation`,
        vars: {
          'allSingleRoute': true
        }
      });
      
      // lineIdx 21: /* ── Fixed-route formulation: NO z-variables, per-pair tight M ── */
      //steps.push({ lineIdx: 21, desc: `/* ── Fixed-route formulation: NO z-variables, per-pair tight M ── */`, vars: {} });
      /*
      // ── Step: line 22 — packet loop header ── 
      steps.push({
        lineIdx: 22, desc: `for (let p = 0; p < pkts.length; p++) — ${pkts.length} packets`,
        vars: { 'p': 0, 'pkts.length': pkts.length }
      });
      
      for (let p = 0; p < pkts.length; p++) {
        const pk = pkts[p], rt = pk.routes[0];
        let earliestArr = pk.rel;
        const varsBefore = vars.size, subBefore = sub.length;

        // ── Step: line 23 — per-packet header ──
        steps.push({
          lineIdx: 23,
          desc: `Pkt p=${p} → ${pk.pid} [fid=${pk.fid}, pri=${pk.pri}], ${rt.hops.length} hops`,
          vars: {
            p, 'pk.pid': pk.pid, 'pk.fid': pk.fid, 'pk.pri': pk.pri,
            'pk.rel': pk.rel, 'pk.dl': pk.dl, 'pk.tsn': pk.tsn,
            'rt.hops.length': rt.hops.length
          }
        });

        // ── Step: line 24 — earliestArr init ──
        steps.push({
          lineIdx: 24, desc: `let earliestArr = pk.rel = ${pk.rel}`,
          vars: {
            p,
            'pk.rel': pk.rel,
            earliestArr: earliestArr
          }
        });

        // ── Step: line 25 — hop loop header ──
        steps.push({
          lineIdx: 25, desc: `for (let h = 0; h < rt.hops.length; h++) — ${rt.hops.length} hops`,
          vars: {
            p,
            'h': 0,
            'rt.hops.length': rt.hops.length
          }
        });

        for (let h = 0; h < rt.hops.length; h++) {
          const hp = rt.hops[h], s = av(sv(p, h));
          // ── Step: line 26 — hop variable init ──
          steps.push({
            lineIdx: 26, desc: `  hop h=${h}: hp=rt.hops[${h}] (${hp.lid}), s="${s}"`,
            vars: { p, h, s, 'hp.lid': hp.lid, 'hp.tx': hp.tx, 'hp.pd': hp.pd, 'vars.size': vars.size }
          });

          // lineIdx 27: // Tight lower bound
          steps.push({ lineIdx: 27, desc: `// Tight lower bound`, vars: {} });

          // Lower bound
          ac('lb', [{ name: s, coef: 1 }], { type: glpk.GLP_LO, lb: earliestArr, ub: 0 });
          // ── Step: line 28 — ac('lb') lower bound constraint ──
          steps.push({
            lineIdx: 28, desc: `  ac('lb'): ${s} ≥ ${earliestArr}`,
            vars: { p, h, s, earliestArr, ci, 'sub.length': sub.length }
          });

          // lineIdx 29: // Tight upper bound
          steps.push({ lineIdx: 29, desc: `// Tight upper bound`, vars: {} });

          let latestStart = model.cycle_time_us - hp.tx;
          // ── Step: line 30 — latestStart init ──
          steps.push({
            lineIdx: 30, desc: `  latestStart = cycle_time(${model.cycle_time_us}) - hp.tx(${hp.tx}) = ${latestStart}`,
            vars: { p, h, latestStart, 'model.cycle_time_us': model.cycle_time_us, 'hp.tx': hp.tx }
          });

          let tailTime = 0;
          if (pk.dl != null) {
            // ── Step: line 31 — deadline branch (true) ──
            steps.push({
              lineIdx: 31, desc: `  pk.dl=${pk.dl} != null → enter tailTime computation`,
              vars: { p, h, 'pk.dl': pk.dl }
            });

            // ── Step: line 32 — tailTime init ──
            steps.push({
              lineIdx: 32, desc: `  let tailTime = 0`,
              vars: { p, h, tailTime: 0 }
            });

            for (let h2 = rt.hops.length - 1; h2 > h; h2--)
              tailTime += rt.hops[h2].tx + rt.hops[h2].pd + model.processing_delay_us;
            // ── Step: line 33 — tailTime loop ──
            steps.push({
              lineIdx: 33, desc: `  for (let h2 = ${rt.hops.length-1}; h2 > ${h}; h2--)`,
              vars: { p, h, 'h2': rt.hops.length - 1, 'rt.hops.length': rt.hops.length }
            });
            // lineIdx 34: tailTime += ...
            steps.push({
              lineIdx: 34, desc: `  tailTime += rt.hops[h2].tx + rt.hops[h2].pd + processing_delay → ${tailTime}`,
              vars: { p, h, tailTime, 'model.processing_delay_us': model.processing_delay_us }
            });

            const prevLatest = latestStart;
            latestStart = Math.min(latestStart, pk.dl - hp.tx - hp.pd - tailTime);
            // ── Step: line 35 — latestStart = Math.min(...) ──
            steps.push({
              lineIdx: 35, desc: `  latestStart = min(${prevLatest}, ${pk.dl}-${hp.tx}-${hp.pd}-${tailTime}) = ${latestStart}`,
              vars: { p, h, latestStart, 'pk.dl': pk.dl, 'hp.tx': hp.tx, 'hp.pd': hp.pd, tailTime }
            });
            // lineIdx 36: }
            steps.push({ lineIdx: 36, desc: `}`, vars: {} });
          } else {
            // ── Step: line 31 — deadline branch (false/BE) ──
            steps.push({
              lineIdx: 31, desc: `  pk.dl=null → skip tailTime (BE packet)`,
              vars: { p, h, 'pk.dl': pk.dl, latestStart }
            });
          }

          ac('ub', [{ name: s, coef: 1 }], { type: glpk.GLP_UP, lb: 0, ub: latestStart });
          // ── Step: line 37 — ac('ub') upper bound constraint ──
          steps.push({
            lineIdx: 37, desc: `  ac('ub'): ${s} ≤ ${latestStart}`,
            vars: { p, h, s, latestStart, ci, 'sub.length': sub.length }
          });

          // lineIdx 38: // Chain
          steps.push({ lineIdx: 38, desc: `// Chain`, vars: {} });

          if (h < rt.hops.length - 1) {
            // ── Step: line 39 — chain condition (true) ──
            steps.push({
              lineIdx: 39, desc: `  Chain check: h=${h} < ${rt.hops.length - 1} → true`,
              vars: { p, h, 'rt.hops.length': rt.hops.length }
            });

            const sn = av(sv(p, h + 1));
            // ── Step: line 40 — sn variable ──
            steps.push({
              lineIdx: 40, desc: `  const sn = av(sv(${p},${h+1})) = "${sn}"`,
              vars: { p, h, sn, 'vars.size': vars.size }
            });

            const chainLb = hp.tx + hp.pd + model.processing_delay_us;
            ac('ch', [{ name: sn, coef: 1 }, { name: s, coef: -1 }],
               { type: glpk.GLP_LO, lb: chainLb, ub: 0 });
            // ── Step: line 41 — ac('ch') chain constraint ──
            steps.push({
              lineIdx: 41, desc: `  ac('ch'): ${sn} - ${s} ≥ ${chainLb} (tx=${hp.tx}+pd=${hp.pd}+proc=${model.processing_delay_us})`,
              vars: { p, h, sn, s, 'hp.tx': hp.tx, 'hp.pd': hp.pd, 'model.processing_delay_us': model.processing_delay_us, ci, 'sub.length': sub.length }
            });
            // lineIdx 42: }
            steps.push({ lineIdx: 42, desc: `}`, vars: {} });
          } else {
            // ── Step: line 39 — chain condition (false, last hop) ──
            steps.push({
              lineIdx: 39, desc: `  Chain check: h=${h} = last hop → no chain`,
              vars: { p, h, 'rt.hops.length': rt.hops.length }
            });
          }

          const blk = hp.tx;
          // ── Step: line 43 — blk calculation (no guard — guard bands added during GCL construction) ──
          steps.push({
            lineIdx: 43, desc: `  blk = hp.tx = ${blk}`,
            vars: { p, h, blk, 'hp.tx': hp.tx }
          });

          ops.push({ oi: ops.length, p, r: 0, h, lid: hp.lid, sn: s, tx: hp.tx, blk, earliest: earliestArr, latest: latestStart });
          // ── Step: line 44 — ops.push ──
          steps.push({
            lineIdx: 44, desc: `  ops[${ops.length-1}]: p=${p}, h=${h}, lid=${hp.lid}, sn=${s}, [${earliestArr},${latestStart}]`,
            vars: { p, r: 0, h, 'ops.length': ops.length, blk }
          });

          earliestArr += hp.tx + hp.pd + model.processing_delay_us;
          // ── Step: line 45 — earliestArr update ──
          steps.push({
            lineIdx: 45, desc: `  earliestArr += ${hp.tx}+${hp.pd}+${model.processing_delay_us} → ${earliestArr}`,
            vars: { p, h, earliestArr, 'hp.tx': hp.tx, 'hp.pd': hp.pd, 'model.processing_delay_us': model.processing_delay_us }
          });
          // lineIdx 46: } (end hop loop)
          if (h === rt.hops.length - 1) steps.push({ lineIdx: 46, desc: `}`, vars: {} });
        }
        steps.push({ lineIdx: 47, desc: `// Deadline`, vars: {} });
        const last = rt.hops.length - 1, sL = sv(p, last), lH = rt.hops[last];
        // ── Step: line 48 — deadline variable declarations ──
        steps.push({
          lineIdx: 48, desc: `  last=${last}, sL="${sL}", lH=rt.hops[${last}] (${lH.lid})`,
          vars: { p, last, sL, 'lH.lid': lH.lid, 'lH.tx': lH.tx, 'lH.pd': lH.pd, 'rt.hops.length': rt.hops.length }
        });

        if (pk.dl != null) {
          ac('dl', [{ name: sL, coef: 1 }], { type: glpk.GLP_UP, lb: 0, ub: pk.dl - lH.tx - lH.pd });
          // ── Step: line 49 — ac('dl') deadline constraint ──
          steps.push({
            lineIdx: 49, desc: `  ac('dl'): ${sL} ≤ ${pk.dl - lH.tx - lH.pd} (dl=${pk.dl}, tx=${lH.tx}, pd=${lH.pd})`,
            vars: { p, sL, 'pk.dl': pk.dl, 'lH.tx': lH.tx, 'lH.pd': lH.pd, ci, 'sub.length': sub.length }
          });
        } else {
          // ── Step: line 49 — no deadline (BE) ──
          steps.push({
            lineIdx: 49, desc: `  pk.dl=null → no deadline constraint (BE)`,
            vars: { p, 'pk.dl': pk.dl, sL }
          });
        }

        // lineIdx 50: // Objective comment
        steps.push({ lineIdx: 50, desc: `// Objective: minimize sum of last-hop start times for TSN packets`, vars: {} });
        if (pk.tsn) {
          obj.push({ name: sL, coef: 1 });
          // ── Step: line 51 — obj.push (TSN) ──
          steps.push({
            lineIdx: 51, desc: `  obj.push({ name: "${sL}", coef: 1 }) — TSN packet`,
            vars: { p, sL, 'pk.tsn': pk.tsn, 'obj.length': obj.length }
          });
        } else {
          // ── Step: line 51 — skip objective (BE) ──
          steps.push({
            lineIdx: 51, desc: `  pk.tsn=false → no obj term (BE)`,
            vars: { p, 'pk.tsn': pk.tsn, 'obj.length': obj.length }
          });
        }
        // lineIdx 52: } (end packet loop)
        if (p === pkts.length - 1) steps.push({ lineIdx: 52, desc: `}`, vars: {} });
      }

      // lineIdx 53: empty line
      steps.push({ lineIdx: 53, desc: ``, vars: {} });

      // ── Pairwise ordering (lineIdx 54-69) — every line ─────────────────
      let yVarsAdded = 0, pairsSkipped = 0, pairCstrs = 0;

      // Compute all pairwise constraints first
      const pairResults = []; // per-link results for step generation
      for (const lnk of model.links) {
        const lo = ops.filter(o => o.lid === lnk.id);
        const linkPairs = [];
        for (let a = 0; a < lo.length; a++) for (let b = a + 1; b < lo.length; b++) {
          const oa = lo[a], ob = lo[b];
          if (oa.latest + oa.blk <= ob.earliest || ob.latest + ob.blk <= oa.earliest) { pairsSkipped++; linkPairs.push({ oa, ob, pruned: true }); continue; }
          const y = av(yv(lnk.id, oa.oi, ob.oi)); bins.push(y);
          const Mab = Math.max(oa.latest - ob.earliest + oa.blk, ob.latest - oa.earliest + ob.blk);
          ac('na', [{ name: ob.sn, coef: 1 }, { name: oa.sn, coef: -1 }, { name: y, coef: -Mab }], { type: glpk.GLP_LO, lb: oa.blk - Mab, ub: 0 });
          ac('nb', [{ name: oa.sn, coef: 1 }, { name: ob.sn, coef: -1 }, { name: y, coef: Mab }], { type: glpk.GLP_LO, lb: ob.blk, ub: 0 });
          linkPairs.push({ oa, ob, y, Mab, pruned: false });
          yVarsAdded++; pairCstrs += 2;
        }
        pairResults.push({ lnk, lo, linkPairs });
      }

      // lineIdx 54: comment
      steps.push({ lineIdx: 54, desc: `// Pairwise ordering with per-pair tight M and window pruning`,
        vars: {} });
      // lineIdx 55: for (const lnk of model.links) {
      steps.push({ lineIdx: 55, desc: `for (const lnk of model.links) — ${model.links.length} links`,
        vars: { 'model.links.length': model.links.length, 'ops.length': ops.length } });

      for (const { lnk, lo, linkPairs } of pairResults) {
        if (lo.length < 2) continue;
        const totalPairs = lo.length * (lo.length - 1) / 2;
        const firstValid = linkPairs.find(p => !p.pruned);
        const linkY = linkPairs.filter(p => !p.pruned).length;
        const linkPruned = linkPairs.filter(p => p.pruned).length;

        // lineIdx 56: const lo = ops.filter(o => o.lid === lnk.id);
        steps.push({ lineIdx: 56, desc: `const lo = ops.filter(o => o.lid === "${lnk.id}") → ${lo.length} ops`,
          vars: { 'lnk.id': lnk.id, 'lo': lo.map(o => o.sn).join(', '), 'lo.length': lo.length } });
        // lineIdx 57: for (let a = 0; ...) for (let b = a + 1; ...) {
        steps.push({ lineIdx: 57, desc: `for a, b in lo — ${lo.length * (lo.length - 1) / 2} pairs`,
          vars: { 'lo.length': lo.length } });

        if (firstValid) {
          const { oa, ob, y, Mab } = firstValid;
          // lineIdx 58: const oa = lo[a], ob = lo[b];
          steps.push({ lineIdx: 58, desc: `const oa = lo[a], ob = lo[b]`,
            vars: { 'oa.sn': oa.sn, 'oa.oi': oa.oi, 'oa.blk': oa.blk, 'oa.earliest': oa.earliest, 'oa.latest': oa.latest, 'ob.sn': ob.sn, 'ob.oi': ob.oi, 'ob.blk': ob.blk, 'ob.earliest': ob.earliest, 'ob.latest': ob.latest } });
          // lineIdx 59: // Tight window pruning comment
          steps.push({ lineIdx: 59, desc: `// Tight window pruning: skip if execution windows can't overlap`,
            vars: {} });
          // lineIdx 60: if (...) continue;
          const wouldPrune = oa.latest + oa.blk <= ob.earliest || ob.latest + ob.blk <= oa.earliest;
          steps.push({ lineIdx: 60, desc: `if (oa.latest+oa.blk <= ob.earliest || ob.latest+ob.blk <= oa.earliest) → ${wouldPrune}`,
            vars: { 'ob.earliest': ob.earliest, 'oa.earliest': oa.earliest } });
          // lineIdx 61: const y = av(yv(...)); bins.push(y);
          steps.push({ lineIdx: 61, desc: `const y = av(yv("${lnk.id}", ${oa.oi}, ${ob.oi})) = "${y}"; bins.push(y)`,
            vars: { y, 'bins.length': bins.length } });
          // lineIdx 62: // Per-pair tight M comment
          steps.push({ lineIdx: 62, desc: `// Per-pair tight M: just enough to make constraint trivial when inactive`,
            vars: {} });
          // lineIdx 63: const Mab = Math.max(...)
          steps.push({ lineIdx: 63, desc: `const Mab = Math.max(${oa.latest}-${ob.earliest}+${oa.blk}, ${ob.latest}-${oa.earliest}+${ob.blk}) = ${Mab}`,
            vars: { Mab, 'oa.latest': oa.latest, 'ob.earliest': ob.earliest, 'oa.blk': oa.blk, 'ob.latest': ob.latest, 'oa.earliest': oa.earliest, 'ob.blk': ob.blk } });
          // lineIdx 64: // y=0 comment
          steps.push({ lineIdx: 64, desc: `// y=0: a before b → s_b >= s_a + blk_a  (with -Mab*y relaxation)`,
            vars: {} });
          // lineIdx 65: // y=1 comment
          steps.push({ lineIdx: 65, desc: `// y=1: b before a → s_a >= s_b + blk_b  (with +Mab*y relaxation)`,
            vars: {} });
          // lineIdx 66: ac('na', ...)
          steps.push({ lineIdx: 66, desc: `ac('na'): ${ob.sn} - ${oa.sn} - ${Mab}*${y} ≥ ${oa.blk - Mab}`,
            vars: { 'ob.sn': ob.sn, 'oa.sn': oa.sn, y, Mab, 'oa.blk': oa.blk, ci, 'sub.length': sub.length } });
          // lineIdx 67: ac('nb', ...)
          steps.push({ lineIdx: 67, desc: `ac('nb'): ${oa.sn} - ${ob.sn} + ${Mab}*${y} ≥ ${ob.blk}`,
            vars: { 'oa.sn': oa.sn, 'ob.sn': ob.sn, y, Mab, 'ob.blk': ob.blk, ci, 'sub.length': sub.length } });
        }
        // lineIdx 68: } (end inner loop) — summary for this link
        steps.push({ lineIdx: 68, desc: `} — ${lnk.id}: ${linkY} y-vars, ${linkPruned} pruned`,
          vars: { 'lnk.id': lnk.id, 'bins.length': bins.length, 'sub.length': sub.length } });
      }
      // lineIdx 69: } (end outer loop)
      steps.push({ lineIdx: 69, desc: `} — pairwise done: ${yVarsAdded} y-vars, ${pairsSkipped} pruned, ${pairCstrs} constraints`,
        vars: { 'bins.length': bins.length, 'vars.size': vars.size, 'sub.length': sub.length } });
      */
      // ── Walkthrough: Multi-route branch (lines 70-108, 미실행) ──
      //const wt = '[미실행]';
      //steps.push({ lineIdx: 70, desc: `${wt} } else {`,
      //  vars: { 'allSingleRoute': true } });
      //steps.push({ lineIdx: 71, desc: `${wt} /* ── Multi-route formulation: big-M with z-variables ── */`,
      //  vars: {} });
    /*  steps.push({ lineIdx: 72, desc: `${wt} const M = model.cycle_time_us + model.guard_band_us + model.processing_delay_us + 100`,
        vars: { 'M': 'number' } });
      steps.push({ lineIdx: 73, desc: `${wt} const zv2 = (p, r) => \`z_\${p}_\${r}\``,
        vars: {} });
      steps.push({ lineIdx: 74, desc: `${wt} for (let p = 0; p < pkts.length; p++)`,
        vars: { 'p': 'number', 'pkts.length': 'number' } });
      steps.push({ lineIdx: 75, desc: `${wt} const pk = pkts[p], zt = []`,
        vars: { 'pk': 'Object', 'zt': 'Array' } });
      steps.push({ lineIdx: 76, desc: `${wt} for (let r = 0; r < pk.routes.length; r++)`,
        vars: { 'r': 'number', 'pk.routes.length': 'number' } });
      steps.push({ lineIdx: 77, desc: `${wt} const rt = pk.routes[r], z = av(zv2(p, r))`,
        vars: { 'rt': 'Object', 'z': 'string' } });
      steps.push({ lineIdx: 78, desc: `${wt} bins.push(z); zt.push({name: z, coef: 1})`,
        vars: { 'z': 'string' } });
      steps.push({ lineIdx: 79, desc: `${wt} for (let h = 0; h < rt.hops.length; h++)`,
        vars: { 'h': 'number', 'rt.hops.length': 'number' } });
      steps.push({ lineIdx: 80, desc: `${wt} const hp = rt.hops[h], s = av(\`s_\${p}_\${r}_\${h}\`)`,
        vars: { 'hp': 'Object', 's': 'string' } });
      steps.push({ lineIdx: 81, desc: `${wt} ac('lb', [{name:s, coef:1}, {name:z, coef:-M}], {type:GLP_LO, lb:pk.rel-M, ub:0})`,
        vars: { 's': 'string', 'z': 'string', 'M': 'number', 'pk.rel': 'number' } });
      steps.push({ lineIdx: 82, desc: `${wt} ac('ub', [{name:s, coef:1}, {name:z, coef:M}], {type:GLP_UP, lb:0, ub:cycle_time-tx+M})`,
        vars: { 's': 'string', 'z': 'string', 'M': 'number', 'model.cycle_time_us': 'number', 'hp.tx': 'number' } });
      steps.push({ lineIdx: 83, desc: `${wt} if (h < rt.hops.length - 1)`,
        vars: { 'h': 'number', 'rt.hops.length': 'number' } });
      steps.push({ lineIdx: 84, desc: `${wt} const sn = av(\`s_\${p}_\${r}_\${h+1}\`)`,
        vars: { 'sn': 'string' } });
      steps.push({ lineIdx: 85, desc: `${wt} ac('ch', [{name:sn,coef:1},{name:s,coef:-1},{name:z,coef:-M}], {type:GLP_LO, lb:tx+pd+proc-M, ub:0})`,
        vars: { 'sn': 'string', 's': 'string', 'z': 'string', 'M': 'number', 'hp.tx': 'number', 'hp.pd': 'number', 'model.processing_delay_us': 'number' } });
      steps.push({ lineIdx: 86, desc: `${wt} }`,
        vars: {} });
      steps.push({ lineIdx: 87, desc: `${wt} ops.push({oi, p, r, h, lid, sn:s, zn:z, tx, blk})`,
        vars: { 'oi': 'number', 'p': 'number', 'r': 'number', 'h': 'number', 'sn': 'string', 'zn': 'string' } });
      steps.push({ lineIdx: 88, desc: `${wt} }`,
        vars: {} });
      steps.push({ lineIdx: 89, desc: `${wt} const last = rt.hops.length-1, sL = av(\`s_\${p}_\${r}_\${last}\`), lH = rt.hops[last]`,
        vars: { 'last': 'number', 'sL': 'string', 'lH': 'Object' } });
      steps.push({ lineIdx: 90, desc: `${wt} if (pk.dl != null) ac('dl', [{name:sL,coef:1},{name:z,coef:M}], {type:GLP_UP, lb:0, ub:dl-tx-pd+M})`,
        vars: { 'pk.dl': 'number|null', 'sL': 'string', 'z': 'string', 'M': 'number' } });
      steps.push({ lineIdx: 91, desc: `${wt} if (pk.tsn) { obj.push({name:sL,coef:1}); obj.push({name:z,coef:lH.tx+lH.pd}) }`,
        vars: { 'pk.tsn': 'boolean', 'sL': 'string', 'z': 'string' } });
      steps.push({ lineIdx: 92, desc: `${wt} }`,
        vars: {} });
      steps.push({ lineIdx: 93, desc: `${wt} ac('sel', zt, {type: GLP_FX, lb:1, ub:1})`,
        vars: { 'zt': 'Array' } });
      steps.push({ lineIdx: 94, desc: `${wt} }`,
        vars: {} });
      steps.push({ lineIdx: 95, desc: `${wt} for (const lnk of model.links)`,
        vars: { 'lnk': 'Object', 'model.links.length': 'number' } });
      steps.push({ lineIdx: 96, desc: `${wt} const lo = ops.filter(o => o.lid === lnk.id)`,
        vars: { 'lo': 'Array', 'lnk.id': 'string' } });
      steps.push({ lineIdx: 97, desc: `${wt} for (let a = 0; ...) for (let b = a + 1; ...) {`,
        vars: { 'a': 'number', 'b': 'number', 'lo.length': 'number' } });
      steps.push({ lineIdx: 98, desc: `${wt} const oa = lo[a], ob = lo[b]`,
        vars: { 'oa': 'Object', 'ob': 'Object' } });
      steps.push({ lineIdx: 99, desc: `${wt} if (oa.p === ob.p && oa.r === ob.r) continue`,
        vars: { 'oa.p': 'number', 'ob.p': 'number', 'oa.r': 'number', 'ob.r': 'number' } });
      steps.push({ lineIdx: 100, desc: `${wt} const pa = pkts[oa.p], pb = pkts[ob.p]`,
        vars: { 'pa': 'Object', 'pb': 'Object' } });
      steps.push({ lineIdx: 101, desc: `${wt} const aEnd = pa.dl ?? model.cycle_time_us`,
        vars: { 'aEnd': 'number', 'pa.dl': 'number|null', 'model.cycle_time_us': 'number' } });
      steps.push({ lineIdx: 102, desc: `${wt} const bEnd = pb.dl ?? model.cycle_time_us`,
        vars: { 'bEnd': 'number', 'pb.dl': 'number|null', 'model.cycle_time_us': 'number' } });
      steps.push({ lineIdx: 103, desc: `${wt} if (aEnd <= pb.rel || bEnd <= pa.rel) continue`,
        vars: { 'aEnd': 'number', 'pb.rel': 'number', 'bEnd': 'number', 'pa.rel': 'number' } });
      steps.push({ lineIdx: 104, desc: `${wt} const y = av(yv(lnk.id, oa.oi, ob.oi)); bins.push(y)`,
        vars: { 'y': 'string' } });
      steps.push({ lineIdx: 105, desc: `${wt} ac('na', [{name:ob.sn,1},{name:oa.sn,-1},{name:y,-M},{name:oa.zn,-M},{name:ob.zn,-M}], ...)`,
        vars: { 'ob.sn': 'string', 'oa.sn': 'string', 'y': 'string', 'M': 'number', 'oa.zn': 'string', 'ob.zn': 'string' } });
      steps.push({ lineIdx: 106, desc: `${wt} ac('nb', [{name:oa.sn,1},{name:ob.sn,-1},{name:y,M},{name:oa.zn,-M},{name:ob.zn,-M}], ...)`,
        vars: { 'oa.sn': 'string', 'ob.sn': 'string', 'y': 'string', 'M': 'number', 'oa.zn': 'string', 'ob.zn': 'string' } });
      steps.push({ lineIdx: 107, desc: `${wt} }`,
        vars: {} });
      steps.push({ lineIdx: 108, desc: `${wt} }`,
        vars: {} });
      // ── allSingleRoute === true 분기 끝 */

    } else {
      /* ── Walkthrough: Fixed-route branch (lines 20-69, 미실행) ── 주석 처리
      const wt = '[미실행]';
      steps.push({ lineIdx: 20, desc: `${wt} if (allSingleRoute) {`,
        vars: { 'allSingleRoute': false } });
      steps.push({ lineIdx: 22, desc: `${wt} for (let p = 0; p < pkts.length; p++)`,
        vars: { 'p': 'number', 'pkts.length': 'number' } });
      steps.push({ lineIdx: 23, desc: `${wt} const pk = pkts[p], rt = pk.routes[0]`,
        vars: { 'pk': 'Object', 'rt': 'Object' } });
      steps.push({ lineIdx: 24, desc: `${wt} let earliestArr = pk.rel`,
        vars: { 'pk.rel': 'number', 'earliestArr': 'number' } });
      steps.push({ lineIdx: 25, desc: `${wt} for (let h = 0; h < rt.hops.length; h++)`,
        vars: { 'h': 'number', 'rt.hops.length': 'number' } });
      steps.push({ lineIdx: 26, desc: `${wt} const hp = rt.hops[h], s = av(sv(p, h))`,
        vars: { 'hp': 'Object', 's': 'string' } });
      steps.push({ lineIdx: 28, desc: `${wt} ac('lb', [{name:s, coef:1}], {type:GLP_LO, lb:earliestArr, ub:0})`,
        vars: { 's': 'string', 'earliestArr': 'number' } });
      steps.push({ lineIdx: 30, desc: `${wt} let latestStart = model.cycle_time_us - hp.tx`,
        vars: { 'model.cycle_time_us': 'number', 'hp.tx': 'number', 'latestStart': 'number' } });
      steps.push({ lineIdx: 31, desc: `${wt} if (pk.dl != null)`,
        vars: { 'pk.dl': 'number|null' } });
      steps.push({ lineIdx: 32, desc: `${wt} let tailTime = 0`,
        vars: { 'tailTime': 'number' } });
      steps.push({ lineIdx: 35, desc: `${wt} latestStart = Math.min(latestStart, pk.dl - hp.tx - hp.pd - tailTime)`,
        vars: { 'latestStart': 'number', 'pk.dl': 'number', 'hp.tx': 'number', 'hp.pd': 'number', 'tailTime': 'number' } });
      steps.push({ lineIdx: 37, desc: `${wt} ac('ub', [{name:s, coef:1}], {type:GLP_UP, lb:0, ub:latestStart})`,
        vars: { 's': 'string', 'latestStart': 'number' } });
      steps.push({ lineIdx: 39, desc: `${wt} if (h < rt.hops.length - 1)`,
        vars: { 'h': 'number', 'rt.hops.length': 'number' } });
      steps.push({ lineIdx: 40, desc: `${wt} const sn = av(sv(p, h + 1))`,
        vars: { 'sn': 'string' } });
      steps.push({ lineIdx: 41, desc: `${wt} ac('ch', [{name:sn,coef:1},{name:s,coef:-1}], {type:GLP_LO, lb:tx+pd+proc, ub:0})`,
        vars: { 'sn': 'string', 's': 'string', 'hp.tx': 'number', 'hp.pd': 'number', 'model.processing_delay_us': 'number' } });
      steps.push({ lineIdx: 43, desc: `${wt} const blk = hp.tx`,
        vars: { 'hp.tx': 'number', 'blk': 'number' } });
      steps.push({ lineIdx: 44, desc: `${wt} ops.push({oi, p, r:0, h, lid, sn:s, tx, blk, earliest, latest})`,
        vars: { 'oi': 'number', 'p': 'number', 'r': 'number', 'h': 'number', 'lid': 'string', 'sn': 'string' } });
      steps.push({ lineIdx: 45, desc: `${wt} earliestArr += hp.tx + hp.pd + model.processing_delay_us`,
        vars: { 'earliestArr': 'number', 'hp.tx': 'number', 'hp.pd': 'number', 'model.processing_delay_us': 'number' } });
      steps.push({ lineIdx: 48, desc: `${wt} const last = rt.hops.length-1, sL = sv(p, last), lH = rt.hops[last]`,
        vars: { 'last': 'number', 'sL': 'string', 'lH': 'Object' } });
      steps.push({ lineIdx: 49, desc: `${wt} if (pk.dl != null) ac('dl', [{name:sL,coef:1}], {type:GLP_UP, lb:0, ub:dl-tx-pd})`,
        vars: { 'pk.dl': 'number|null', 'sL': 'string', 'lH.tx': 'number', 'lH.pd': 'number' } });
      steps.push({ lineIdx: 51, desc: `${wt} if (pk.tsn) obj.push({name: sL, coef: 1})`,
        vars: { 'pk.tsn': 'boolean', 'sL': 'string' } });
      steps.push({ lineIdx: 53, desc: `${wt}`,
        vars: {} });
      steps.push({ lineIdx: 54, desc: `${wt} // Pairwise ordering with per-pair tight M and window pruning`,
        vars: {} });
      steps.push({ lineIdx: 55, desc: `${wt} for (const lnk of model.links)`,
        vars: { 'lnk': 'Object', 'model.links.length': 'number' } });
      steps.push({ lineIdx: 56, desc: `${wt} const lo = ops.filter(o => o.lid === lnk.id)`,
        vars: { 'lo': 'Array', 'lnk.id': 'string' } });
      steps.push({ lineIdx: 57, desc: `${wt} for (let a = 0; ...) for (let b = a + 1; ...) {`,
        vars: { 'a': 'number', 'b': 'number', 'lo.length': 'number' } });
      steps.push({ lineIdx: 58, desc: `${wt} const oa = lo[a], ob = lo[b]`,
        vars: { 'oa': 'Object', 'ob': 'Object' } });
      steps.push({ lineIdx: 59, desc: `${wt} // Tight window pruning: skip if execution windows can't overlap`,
        vars: {} });
      steps.push({ lineIdx: 60, desc: `${wt} if (oa.latest + oa.blk <= ob.earliest || ob.latest + ob.blk <= oa.earliest) continue`,
        vars: { 'oa.latest': 'number', 'oa.blk': 'number', 'ob.earliest': 'number', 'ob.latest': 'number', 'ob.blk': 'number', 'oa.earliest': 'number' } });
      steps.push({ lineIdx: 61, desc: `${wt} const y = av(yv(lnk.id, oa.oi, ob.oi)); bins.push(y)`,
        vars: { 'y': 'string' } });
      steps.push({ lineIdx: 62, desc: `${wt} // Per-pair tight M: just enough to make constraint trivial when inactive`,
        vars: {} });
      steps.push({ lineIdx: 63, desc: `${wt} const Mab = Math.max(oa.latest - ob.earliest + oa.blk, ob.latest - oa.earliest + ob.blk)`,
        vars: { 'Mab': 'number', 'oa.latest': 'number', 'ob.earliest': 'number', 'oa.blk': 'number', 'ob.latest': 'number', 'oa.earliest': 'number', 'ob.blk': 'number' } });
      steps.push({ lineIdx: 64, desc: `${wt} // y=0: a before b → s_b >= s_a + blk_a  (with -Mab*y relaxation)`,
        vars: {} });
      steps.push({ lineIdx: 65, desc: `${wt} // y=1: b before a → s_a >= s_b + blk_b  (with +Mab*y relaxation)`,
        vars: {} });
      steps.push({ lineIdx: 66, desc: `${wt} ac('na', [{name:ob.sn,1},{name:oa.sn,-1},{name:y,-Mab}], {type:GLP_LO, lb:oa.blk-Mab, ub:0})`,
        vars: { 'ob.sn': 'string', 'oa.sn': 'string', 'y': 'string', 'Mab': 'number', 'oa.blk': 'number' } });
      steps.push({ lineIdx: 67, desc: `${wt} ac('nb', [{name:oa.sn,1},{name:ob.sn,-1},{name:y,Mab}], {type:GLP_LO, lb:ob.blk, ub:0})`,
        vars: { 'oa.sn': 'string', 'ob.sn': 'string', 'y': 'string', 'Mab': 'number', 'ob.blk': 'number' } });
      steps.push({ lineIdx: 68, desc: `${wt} }`,
        vars: {} });
      steps.push({ lineIdx: 69, desc: `${wt} }`,
        vars: {} });
      Walkthrough: Fixed-route 주석 끝 */

      // ── Branch: Multi-route ─────────────────────────────────────────────
      const M = model.cycle_time_us + model.processing_delay_us + 100;

      // ── Branch step (line 70) ──
      steps.push({
        lineIdx: 70, desc: `} else { — allSingleRoute=false → Multi-route`,
        vars: { allSingleRoute: false }
      });

      // lineIdx 71: /* ── Multi-route formulation: big-M with z-variables ── */
      steps.push({ lineIdx: 71, desc: `/* ── Multi-route formulation: big-M with z-variables ── */`, vars: {} });

      // ── Step: line 72 — big-M calculation ──
      steps.push({
        lineIdx: 72, desc: `const M = ${model.cycle_time_us} + ${model.processing_delay_us} + 100 = ${M}`,
        vars: {
          M,
          'model.cycle_time_us': model.cycle_time_us,
          'model.processing_delay_us': model.processing_delay_us
        }
      });

      // ── Step: line 73 — zv2 helper ──
      steps.push({
        lineIdx: 73, desc: 'zv2 = (p, r) → "z_{p}_{r}" — route selector binary namer',
        vars: {}
      });

      const zv2 = (p, r) => `z_${p}_${r}`;

      // ── Step: line 74 — packet loop header ──
      steps.push({
        lineIdx: 74, desc: `for (let p = 0; p < pkts.length; p++) — ${pkts.length} packets`,
        vars: { 'p': 0, 'pkts.length': pkts.length }
      });

      for (let p = 0; p < pkts.length; p++) {
        const pk = pkts[p], zt = [];
        const varsBefore = vars.size, subBefore = sub.length, binsBefore = bins.length;

        // ── Step: line 75 — per-packet header ──
        steps.push({
          lineIdx: 75,
          desc: `Pkt p=${p} → ${pk.pid} [fid=${pk.fid}, pri=${pk.pri}], ${pk.routes.length} routes`,
          vars: {
            p, 'pk.pid': pk.pid, 'pk.fid': pk.fid, 'pk.pri': pk.pri,
            'pk.rel': pk.rel, 'pk.dl': pk.dl, 'pk.tsn': pk.tsn,
            'pk.routes': pk.routes.map(rt => rt.hops.map(h => h.lid))
          }
        });

        // ── Step: line 76 — route loop header ──
        steps.push({
          lineIdx: 76, desc: `  Route loop: ${pk.routes.length} routes for ${pk.pid}`,
          vars: { p, 'r': 0 }
        });

        for (let r = 0; r < pk.routes.length; r++) {
          const rt = pk.routes[r], z = av(zv2(p, r));
          // ── Step: line 77 — route var init ──
          steps.push({
            lineIdx: 77,
            desc: `  Route r=${r}: rt=pk.routes[${r}], z=av(zv2(${p},${r}))="${z}"`,
            vars: {
              p, r, z, rt: rt.hops.map(h => h.lid),
              vars: Array.from(vars), 'vars.size': vars.size
            }
          });

          bins.push(z); zt.push({ name: z, coef: 1 });
          // ── Step: line 78 — bins.push(z), zt.push ──
          steps.push({
            lineIdx: 78,
            desc: `  bins.push("${z}"), zt.push({name:"${z}",coef:1})`,
            vars: { z, bins: [...bins], 'bins.length': bins.length, zt: zt.map(t => `${t.name}*${t.coef}`) }
          });

          // ── Step: line 79 — hop loop header ──
          steps.push({
            lineIdx: 79, desc: `    Hop loop: ${rt.hops.length} hops for route r=${r}`,
            vars: { p, r, 'h': 0, rt: rt.hops.map(h => h.lid) }
          });

          for (let h = 0; h < rt.hops.length; h++) {
            const hp = rt.hops[h], s = av(`s_${p}_${r}_${h}`);
            // ── Step: line 80 — hop variable init ──
            steps.push({
              lineIdx: 80, desc: `    hop h=${h}: hp=rt.hops[${h}] (${hp.lid}), s="${s}"`,
              vars: { p, r, h, s, z, hp: { lid: hp.lid, tx: hp.tx, pd: hp.pd }, vars: Array.from(vars), 'vars.size': vars.size }
            });

            ac('lb', [{ name: s, coef: 1 }, { name: z, coef: -M }], { type: glpk.GLP_LO, lb: pk.rel - M, ub: 0 });
            // ── Step: line 81 — ac('lb') lower bound ──
            steps.push({
              lineIdx: 81, desc: `    ac('lb'): ${s} - ${z}*M ≥ ${pk.rel} - M (=${pk.rel - M})`,
              vars: { p, r, h, s, z, M, 'pk.rel': pk.rel, ci, sub: sub.map(c => ({ name: c.name, vars: c.vars.map(v => `${v.name}*${v.coef}`), bnds: c.bnds })), 'sub.length': sub.length }
            });

            ac('ub', [{ name: s, coef: 1 }, { name: z, coef: M }], { type: glpk.GLP_UP, lb: 0, ub: model.cycle_time_us - hp.tx + M });
            // ── Step: line 82 — ac('ub') upper bound ──
            steps.push({
              lineIdx: 82, desc: `    ac('ub'): ${s} + ${z}*M ≤ ${model.cycle_time_us - hp.tx} + M (=${model.cycle_time_us - hp.tx + M})`,
              vars: { p, r, h, s, z, M, ci, sub: sub.map(c => ({ name: c.name, vars: c.vars.map(v => `${v.name}*${v.coef}`), bnds: c.bnds })), 'sub.length': sub.length }
            });

            // ── IEEE 802.1Qbv gate window constraints ──
            const gw = linkGateWindows[hp.lid];
            if (gw) {
              const tc = pk.pri;
              const dlBound = pk.dl ?? model.cycle_time_us;
              const tcWindows = gw.filter(w => w.queue === tc && w.close - w.open >= hp.tx - 1e-9
                && w.close >= pk.rel + hp.tx - 1e-9 && w.open <= dlBound - hp.tx + 1e-9);
              if (tcWindows.length === 1) {
                const fw = tcWindows[0];
                ac('gw_lo', [{ name: s, coef: 1 }, { name: z, coef: -M }], { type: glpk.GLP_LO, lb: fw.open - M, ub: 0 });
                ac('gw_up', [{ name: s, coef: 1 }, { name: z, coef: M }], { type: glpk.GLP_UP, lb: 0, ub: fw.close - hp.tx + M });
                steps.push({
                  lineIdx: 82, desc: `    gate TC${tc}: ${s} ∈ [${round3(fw.open)}, ${round3(fw.close - hp.tx)}] (1 window, z-relaxed)`,
                  vars: { tc, 'fw.open': round3(fw.open), 'fw.close': round3(fw.close), gwConstr: 2, 'sub.length': sub.length }
                });
              } else if (tcWindows.length > 1) {
                const gwTerms = [];
                for (let j = 0; j < tcWindows.length; j++) {
                  const fw = tcWindows[j];
                  const g = av(`gw_${p}_${r}_${h}_${j}`); bins.push(g); gwTerms.push({ name: g, coef: 1 });
                  ac('gw_lo', [{ name: s, coef: 1 }, { name: g, coef: -M }, { name: z, coef: -M }], { type: glpk.GLP_LO, lb: fw.open - 2*M, ub: 0 });
                  ac('gw_up', [{ name: s, coef: 1 }, { name: g, coef: M }, { name: z, coef: M }], { type: glpk.GLP_UP, lb: 0, ub: fw.close - hp.tx + 2*M });
                }
                gwTerms.push({ name: z, coef: -1 });
                ac('gw_sel', gwTerms, { type: glpk.GLP_FX, lb: 0, ub: 0 });
                steps.push({
                  lineIdx: 82, desc: `    gate TC${tc}: ${tcWindows.length} windows, ${tcWindows.length} binary gw vars + selection (Σgw=z)`,
                  vars: { tc, windows: tcWindows.map(w => `[${round3(w.open)},${round3(w.close)}]`).join(', '), gwBins: tcWindows.length, 'bins.length': bins.length, 'sub.length': sub.length }
                });
              }
            }

            if (h < rt.hops.length - 1) {
              // ── Step: line 83 — chain condition (true) ──
              steps.push({
                lineIdx: 83, desc: `    Chain check: h=${h} < ${rt.hops.length - 1} → true`,
                vars: { p, r, h, rt: rt.hops.map(hp => hp.lid) }
              });

              const sn = av(`s_${p}_${r}_${h + 1}`);
              // ── Step: line 84 — sn variable ──
              steps.push({
                lineIdx: 84, desc: `    const sn = "s_${p}_${r}_${h+1}" = "${sn}"`,
                vars: { p, r, h, sn, vars: Array.from(vars), 'vars.size': vars.size }
              });

              const chainLb = hp.tx + hp.pd + model.processing_delay_us;
              ac('ch', [{ name: sn, coef: 1 }, { name: s, coef: -1 }, { name: z, coef: -M }],
                 { type: glpk.GLP_LO, lb: chainLb - M, ub: 0 });
              // ── Step: line 85 — ac('ch') chain constraint ──
              steps.push({
                lineIdx: 85, desc: `    ac('ch'): ${sn} - ${s} - ${z}*M ≥ ${chainLb} - M (=${chainLb - M})`,
                vars: { p, r, h, sn, s, z, M, hp: { lid: hp.lid, tx: hp.tx, pd: hp.pd }, 'model.processing_delay_us': model.processing_delay_us, ci, sub: sub.map(c => ({ name: c.name, vars: c.vars.map(v => `${v.name}*${v.coef}`), bnds: c.bnds })), 'sub.length': sub.length }
              });
              // lineIdx 86: }
              steps.push({ lineIdx: 86, desc: `}`, vars: {} });
            } else {
              // ── Step: line 83 — chain condition (false, last hop) ──
              steps.push({
                lineIdx: 83, desc: `    Chain check: h=${h} = last hop → no chain`,
                vars: { p, r, h, rt: rt.hops.map(hp => hp.lid) }
              });
            }

            const blk = hp.tx;
            ops.push({ oi: ops.length, p, r, h, lid: hp.lid, sn: s, zn: z, tx: hp.tx, blk });
            // ── Step: line 87 — ops.push ──
            steps.push({
              lineIdx: 87, desc: `    ops[${ops.length-1}]: p=${p}, r=${r}, h=${h}, lid=${hp.lid}, sn=${s}, zn=${z}, blk=${blk}`,
              vars: { p, r, h, ops: ops.map(o => ({ oi: o.oi, p: o.p, r: o.r, h: o.h, lid: o.lid, sn: o.sn, zn: o.zn, tx: o.tx, blk: o.blk })), 'ops.length': ops.length, blk }
            });
            // lineIdx 88: } (end hop loop)
            if (h === rt.hops.length - 1) steps.push({ lineIdx: 88, desc: `}`, vars: {} });
          }
          const last = rt.hops.length - 1, sL = av(`s_${p}_${r}_${last}`), lH = rt.hops[last];
          // ── Step: line 89 — deadline variable declarations ──
          steps.push({
            lineIdx: 89, desc: `  Route r=${r} end: last=${last}, sL="${sL}", lH=rt.hops[${last}] (${lH.lid})`,
            vars: { p, r, last, sL, lH: { lid: lH.lid, tx: lH.tx, pd: lH.pd } }
          });

          if (pk.dl != null) {
            ac('dl', [{ name: sL, coef: 1 }, { name: z, coef: M }], { type: glpk.GLP_UP, lb: 0, ub: pk.dl - lH.tx - lH.pd + M });
            // ── Step: line 90 — ac('dl') deadline constraint ──
            steps.push({
              lineIdx: 90, desc: `  ac('dl'): ${sL} + ${z}*M ≤ ${pk.dl - lH.tx - lH.pd} + M (=${pk.dl - lH.tx - lH.pd + M})`,
              vars: { p, r, sL, z, M, 'pk.dl': pk.dl, lH: { lid: lH.lid, tx: lH.tx, pd: lH.pd }, ci, sub: sub.map(c => ({ name: c.name, vars: c.vars.map(v => `${v.name}*${v.coef}`), bnds: c.bnds })), 'sub.length': sub.length }
            });
          } else {
            // ── Step: line 90 — no deadline (BE) ──
            steps.push({
              lineIdx: 90, desc: `  pk.dl=null → no deadline constraint (BE)`,
              vars: { p, r, 'pk.dl': pk.dl, sL }
            });
          }

          if (pk.tsn) {
            obj.push({ name: sL, coef: 1 }); obj.push({ name: z, coef: lH.tx + lH.pd });
            // ── Step: line 91 — obj.push (TSN) ──
            steps.push({
              lineIdx: 91, desc: `  obj.push: ${sL} coef=1, ${z} coef=${lH.tx + lH.pd}`,
              vars: { p, r, sL, z, 'pk.tsn': pk.tsn, lH: { lid: lH.lid, tx: lH.tx, pd: lH.pd }, obj: obj.map(o => `${o.name}*${o.coef}`), 'obj.length': obj.length }
            });
          } else {
            // ── Step: line 91 — skip objective (BE) ──
            steps.push({
              lineIdx: 91, desc: `  pk.tsn=false → no obj terms (BE)`,
              vars: { p, r, 'pk.tsn': pk.tsn, obj: obj.map(o => `${o.name}*${o.coef}`), 'obj.length': obj.length }
            });
          }
          // lineIdx 92: } (end route loop)
          if (r === pk.routes.length - 1) steps.push({ lineIdx: 92, desc: `}`, vars: {} });
        }
        ac('sel', zt, { type: glpk.GLP_FX, lb: 1, ub: 1 });

        // ── Route selection constraint step (line 93) ──
        steps.push({
          lineIdx: 93,
          desc: `  ${pk.pid}: sel constraint — sum(${zt.map(t=>t.name).join(', ')}) = 1`,
          vars: {
            'pk.pid': pk.pid, zt: zt.map(t => t.name).join(' + ') + ' = 1',
            vars: Array.from(vars), 'vars.size': vars.size, bins: [...bins], sub: sub.map(c => ({ name: c.name, vars: c.vars.map(v => `${v.name}*${v.coef}`), bnds: c.bnds })), 'sub.length': sub.length, obj: obj.map(o => `${o.name}*${o.coef}`), 'obj.length': obj.length
          }
        });
      }

      // ── Multi-route pairwise ordering (lineIdx 94-108) — every line ────
      let yVarsAdded = 0, pairsSkippedSame = 0, pairsSkippedWindow = 0;

      // Compute all pairwise constraints first
      const pairResultsM = [];
      for (const lnk of model.links) {
        const lo = ops.filter(o => o.lid === lnk.id);
        const linkPairs = [];
        for (let a = 0; a < lo.length; a++) for (let b = a + 1; b < lo.length; b++) {
          const oa = lo[a], ob = lo[b];
          if (oa.p === ob.p && oa.r === ob.r) { pairsSkippedSame++; linkPairs.push({ oa, ob, a, b, skip: 'same-route' }); continue; }
          const pa2 = pkts[oa.p], pb2 = pkts[ob.p];
          const aEnd = pa2.dl ?? model.cycle_time_us;
          const bEnd = pb2.dl ?? model.cycle_time_us;
          if (aEnd <= pb2.rel || bEnd <= pa2.rel) { pairsSkippedWindow++; linkPairs.push({ oa, ob, a, b, skip: 'window' }); continue; }
          const y = av(yv(lnk.id, oa.oi, ob.oi)); bins.push(y);
          const ciBeforeNa = ci, subLenBeforeNa = sub.length;
          ac('na', [{ name: ob.sn, coef: 1 }, { name: oa.sn, coef: -1 }, { name: y, coef: -M }, { name: oa.zn, coef: -M }, { name: ob.zn, coef: -M }], { type: glpk.GLP_LO, lb: oa.blk - 3 * M, ub: 0 });
          const ciAfterNa = ci, subLenAfterNa = sub.length;
          ac('nb', [{ name: oa.sn, coef: 1 }, { name: ob.sn, coef: -1 }, { name: y, coef: M }, { name: oa.zn, coef: -M }, { name: ob.zn, coef: -M }], { type: glpk.GLP_LO, lb: ob.blk - 2 * M, ub: 0 });
          const ciAfterNb = ci, subLenAfterNb = sub.length, binsLenAtPair = bins.length;
          linkPairs.push({ oa, ob, a, b, y, skip: null, ciBeforeNa, subLenBeforeNa, ciAfterNa, subLenAfterNa, ciAfterNb, subLenAfterNb, binsLenAtPair });
          yVarsAdded++;
        }
        pairResultsM.push({ lnk, lo, linkPairs });
      }

      // lineIdx 94: empty line
      steps.push({ lineIdx: 94, desc: ``, vars: {} });
      // lineIdx 95: for (const lnk of model.links) {
      steps.push({ lineIdx: 95, desc: `for (const lnk of model.links) — ${model.links.length} links`,
        vars: { 'model.links': model.links.map(l => l.id), ops: ops.map(o => ({ oi: o.oi, p: o.p, r: o.r, h: o.h, lid: o.lid, sn: o.sn, zn: o.zn, tx: o.tx, blk: o.blk })), 'ops.length': ops.length, M } });
      // lineIdx 96: const lo = ops.filter(o => o.lid === lnk.id);
      for (const { lnk, lo, linkPairs } of pairResultsM) {
        if (lo.length < 2) continue;
        const totalPairs = lo.length * (lo.length - 1) / 2;
        const firstValid = linkPairs.find(p => !p.skip);
        const linkY = linkPairs.filter(p => !p.skip).length;
        const linkSame = linkPairs.filter(p => p.skip === 'same-route').length;
        const linkWin = linkPairs.filter(p => p.skip === 'window').length;

        steps.push({ lineIdx: 96, desc: `const lo = ops.filter(o => o.lid === "${lnk.id}") → ${lo.length} ops`,
          vars: { lnk: { id: lnk.id, from: lnk.from, to: lnk.to }, 'lo.length': lo.length, lo: lo.map(o => ({ oi: o.oi, p: o.p, r: o.r, h: o.h, lid: o.lid, sn: o.sn, zn: o.zn, tx: o.tx, blk: o.blk })) } });
        // lineIdx 97: for (let a...) for (let b...) {
        steps.push({ lineIdx: 97, desc: `for a, b in lo — ${lo.length * (lo.length - 1) / 2} pairs`,
          vars: { 'lo.length': lo.length, lo: lo.map(o => ({ oi: o.oi, p: o.p, r: o.r, h: o.h, lid: o.lid, sn: o.sn, zn: o.zn, tx: o.tx, blk: o.blk })) } });

        if (firstValid) {
          const { oa, ob, a: pairA, b: pairB, y, ciBeforeNa, subLenBeforeNa, ciAfterNa, subLenAfterNa, ciAfterNb, subLenAfterNb, binsLenAtPair } = firstValid;
          // lineIdx 98: const oa = lo[a], ob = lo[b];
          steps.push({ lineIdx: 98, desc: `const oa = lo[${pairA}], ob = lo[${pairB}]`,
            vars: { a: pairA, b: pairB, 'oa.sn': oa.sn, 'oa.oi': oa.oi, 'oa.p': oa.p, 'oa.r': oa.r, 'oa.zn': oa.zn, 'oa.blk': oa.blk, 'ob.sn': ob.sn, 'ob.oi': ob.oi, 'ob.p': ob.p, 'ob.r': ob.r, 'ob.zn': ob.zn, 'ob.blk': ob.blk } });
          // lineIdx 99: if (oa.p === ob.p && oa.r === ob.r) continue;
          steps.push({ lineIdx: 99, desc: `if (oa.p === ob.p && oa.r === ob.r) → ${oa.p === ob.p && oa.r === ob.r}`,
            vars: { a: pairA, b: pairB, 'oa.p': oa.p, 'ob.p': ob.p, 'oa.r': oa.r, 'ob.r': ob.r } });
          // lineIdx 100: const pa = pkts[oa.p], pb = pkts[ob.p];
          const pa2 = pkts[oa.p], pb2 = pkts[ob.p];
          steps.push({ lineIdx: 100, desc: `const pa = pkts[${oa.p}], pb = pkts[${ob.p}]`,
            vars: { a: pairA, b: pairB, 'pa.pid': pa2.pid, 'pa.dl': pa2.dl, 'pa.rel': pa2.rel, 'pb.pid': pb2.pid, 'pb.dl': pb2.dl, 'pb.rel': pb2.rel } });
          // lineIdx 101: const aEnd = pa.dl ?? model.cycle_time_us;
          const aEnd = pa2.dl ?? model.cycle_time_us;
          steps.push({ lineIdx: 101, desc: `const aEnd = pa.dl ?? model.cycle_time_us = ${aEnd}`,
            vars: { a: pairA, b: pairB, 'pa.dl': pa2.dl, 'model.cycle_time_us': model.cycle_time_us, aEnd } });
          // lineIdx 102: const bEnd = pb.dl ?? model.cycle_time_us;
          const bEnd = pb2.dl ?? model.cycle_time_us;
          steps.push({ lineIdx: 102, desc: `const bEnd = pb.dl ?? model.cycle_time_us = ${bEnd}`,
            vars: { a: pairA, b: pairB, 'pb.dl': pb2.dl, 'model.cycle_time_us': model.cycle_time_us, bEnd } });
          // lineIdx 103: if (aEnd <= pb.rel || bEnd <= pa.rel) continue;
          const winPrune = aEnd <= pb2.rel || bEnd <= pa2.rel;
          steps.push({ lineIdx: 103, desc: `if (aEnd <= pb.rel || bEnd <= pa.rel) → ${winPrune}`,
            vars: { a: pairA, b: pairB, aEnd, 'pb.rel': pb2.rel, bEnd, 'pa.rel': pa2.rel } });
          // lineIdx 104: const y = av(yv(...)); bins.push(y);
          steps.push({ lineIdx: 104, desc: `const y = av(yv("${lnk.id}", ${oa.oi}, ${ob.oi})) = "${y}"; bins.push(y)`,
            vars: { a: pairA, b: pairB, y, 'bins.length': binsLenAtPair } });
          // lineIdx 105: ac('na', ...)
          steps.push({ lineIdx: 105, desc: `ac('na'): ${ob.sn}-${oa.sn}-M*${y}-M*${oa.zn}-M*${ob.zn} ≥ ${oa.blk}-3M`,
            vars: { a: pairA, b: pairB, 'ob.sn': ob.sn, 'oa.sn': oa.sn, y, M, 'oa.zn': oa.zn, 'ob.zn': ob.zn, 'oa.blk': oa.blk, ci: ciBeforeNa, 'sub.length': subLenAfterNa } });
          // lineIdx 106: ac('nb', ...)
          steps.push({ lineIdx: 106, desc: `ac('nb'): ${oa.sn}-${ob.sn}+M*${y}-M*${oa.zn}-M*${ob.zn} ≥ ${ob.blk}-2M`,
            vars: { a: pairA, b: pairB, 'oa.sn': oa.sn, 'ob.sn': ob.sn, y, M, 'oa.zn': oa.zn, 'ob.zn': ob.zn, 'ob.blk': ob.blk, ci: ciAfterNa, 'sub.length': subLenAfterNb } });
        }
        // lineIdx 107: } (end inner loop)
        steps.push({ lineIdx: 107, desc: `} — ${lnk.id}: ${linkY} y-vars, ${linkSame} same-route, ${linkWin} window-pruned`,
          vars: { lnk: { id: lnk.id, from: lnk.from, to: lnk.to }, bins: [...bins], sub: sub.map(c => ({ name: c.name, vars: c.vars.map(v => `${v.name}*${v.coef}`), bnds: c.bnds })), 'sub.length': sub.length } });
      }
      // lineIdx 108: } (end outer loop)
      steps.push({ lineIdx: 108, desc: `} — pairwise done: ${yVarsAdded} y-vars (${pairsSkippedSame} same-route, ${pairsSkippedWindow} window)`,
        vars: { bins: [...bins], vars: Array.from(vars), 'vars.size': vars.size, sub: sub.map(c => ({ name: c.name, vars: c.vars.map(v => `${v.name}*${v.coef}`), bnds: c.bnds })), 'sub.length': sub.length } });
    }

    // lineIdx 109: } (end of if/else)
    steps.push({ lineIdx: 109, desc: `}`, vars: {} });
    // lineIdx 110: empty
    steps.push({ lineIdx: 110, desc: ``, vars: {} });

    // Build actual lp object for display
    const lpObjective = { direction: glpk.GLP_MIN, name: 'obj', vars: obj.length ? obj : [{ name: 'dum', coef: 0 }] };
    const lpBounds = Array.from(vars).map(n => ({ name: n, type: glpk.GLP_LO, lb: 0, ub: 0 }));

    // lineIdx 111: const lp = {
    steps.push({ lineIdx: 111, desc: `const lp = {`,
      vars: { 'lp.name': 'tsn_ilp', 'lp.objective.vars': lpObjective.vars.length, 'lp.subjectTo': sub.length, 'lp.binaries': bins.length, 'lp.bounds': lpBounds.length } });
    // lineIdx 112: name: 'tsn_ilp',
    steps.push({ lineIdx: 112, desc: `  name: 'tsn_ilp'`,
      vars: { 'lp.name': 'tsn_ilp' } });
    // lineIdx 113: objective: { direction: glpk.GLP_MIN, name: 'obj', vars: obj }
    steps.push({ lineIdx: 113, desc: `  objective: { direction: GLP_MIN(${glpk.GLP_MIN}), name: 'obj', vars: ${lpObjective.vars.length} terms }`,
      vars: { 'lp.objective': { direction: `GLP_MIN(${glpk.GLP_MIN})`, name: 'obj', vars: lpObjective.vars.map(o => `${o.name}*${o.coef}`) }, 'obj.length': lpObjective.vars.length } });
    // lineIdx 114: subjectTo: sub, binaries: bins,
    steps.push({ lineIdx: 114, desc: `  subjectTo: sub(${sub.length}), binaries: bins(${bins.length})`,
      vars: { 'lp.subjectTo': sub.map(c => ({ name: c.name, vars: c.vars.map(v => `${v.name}*${v.coef}`), bnds: c.bnds })), 'lp.subjectTo.length': sub.length, 'lp.binaries': [...bins], 'lp.binaries.length': bins.length, ci } });
    // lineIdx 115: bounds: Array.from(vars).map(...)
    steps.push({ lineIdx: 115, desc: `  bounds: ${lpBounds.length} vars — all GLP_LO, lb=0`,
      vars: { 'lp.bounds': lpBounds, 'lp.bounds.length': lpBounds.length } });
    // lineIdx 116: };
    steps.push({ lineIdx: 116, desc: `};`, vars: {} });
    // lineIdx 117: empty
    steps.push({ lineIdx: 117, desc: ``, vars: {} });

    // lineIdx 118: const solved = await glpk.solve(lp, {...})
    steps.push({ lineIdx: 118, desc: `const solved = await glpk.solve(lp, {msglev:GLP_MSG_OFF, presol:true, tmlim:${tmlim}})`,
      vars: { tmlim } });

    // Actually run the ILP
    let result;
    try {
      result = await solveILP(deep(model), glpk, opts);
    } catch (e) {
      steps.push({
        lineIdx: 119, desc: `ILP infeasible/failed: ${e.message}`,
        vars: { error: e.message }
      });
      return { steps, pkts, activeLinks: [], schedHops: [], depInfo: 'ILP failed: ' + e.message };
    }

    // ── Step: line 119 — status check ─────────────────────────────────────────
    const statusCode = result.stats.status;
    const glpkStatusMap = {
      [glpk.GLP_OPT]: 'GLP_OPT', [glpk.GLP_FEAS]: 'GLP_FEAS',
      [glpk.GLP_INFEAS]: 'GLP_INFEAS', [glpk.GLP_NOFEAS]: 'GLP_NOFEAS',
      [glpk.GLP_UNBND]: 'GLP_UNBND', [glpk.GLP_UNDEF]: 'GLP_UNDEF'
    };
    const statusName = glpkStatusMap[statusCode] || `unknown(${statusCode})`;
    const isValid = [glpk.GLP_OPT, glpk.GLP_FEAS].includes(statusCode);
    steps.push({
      lineIdx: 119,
      desc: `if (!solved?.result || ![GLP_OPT,GLP_FEAS].includes(status)) → status=${statusName}, ${isValid ? 'OK' : 'FAIL'}`,
      vars: {
        'solved.result.status': `${statusCode} (${statusName})`
      }
    });

    // ── Step: line 120 — throw skipped (status OK) ──────────────────────────────
    steps.push({
      lineIdx: 120, desc: `No throw — status ${statusName} is valid (runtime ${result.stats.runtime_ms}ms)`,
      vars: { 'solved.result.status': `${statusCode} (${statusName})` }
    });

    // ── Step: line 122 — rv extraction ────────────────────────────────────────
    // Collect actual ILP variable values from result
    const rvSamples = {};
    for (let p2 = 0; p2 < Math.min(pkts.length, 4); p2++) {
      const pr2 = result.packetRows.find(r => r.packet_id === pkts[p2].pid);
      if (!pr2) continue;
      const sh2 = { route: pr2.selected_route, starts: pr2.hops.map(h => h.start_us) };
      for (let h2 = 0; h2 < pr2.hops.length; h2++) {
        const varName = allSingleRoute ? `s_${p2}_${h2}` : `s_${p2}_${sh2.route}_${h2}`;
        rvSamples[`rv['${varName}']`] = round3(pr2.hops[h2].start_us);
      }
      if (!allSingleRoute) {
        for (let r2 = 0; r2 < pkts[p2].routes.length; r2++) {
          rvSamples[`rv['z_${p2}_${r2}']`] = r2 === sh2.route ? '≈1 (selected)' : '≈0';
        }
      }
    }
    // lineIdx 121: empty
    steps.push({ lineIdx: 121, desc: ``, vars: {} });
    // lineIdx 122: const rv = solved.result.vars;
    steps.push({ lineIdx: 122, desc: `const rv = solved.result.vars`,
      vars: { ...rvSamples } });
    // lineIdx 123: empty
    steps.push({ lineIdx: 123, desc: ``, vars: {} });
    // lineIdx 124: // Build scheduled hops from ILP solution
    steps.push({ lineIdx: 124, desc: `// Build scheduled hops from ILP solution`, vars: {} });

    // Reconstruct schedHops from result.packetRows
    const linkOcc = Object.fromEntries(model.links.map(l => [l.id, []]));
    const lm = new Map(model.links.map(l => [l.id, l]));
    const nodeType = Object.fromEntries(model.nodes.map(n => [n.id, n.type]));
    const schedHops = new Array(pkts.length);
    const pktMap = new Map(pkts.map((pk, i) => [pk.pid, i]));
    for (const pr of result.packetRows) {
      const pi = pktMap.get(pr.packet_id);
      if (pi === undefined) continue;
      schedHops[pi] = { route: pr.selected_route, starts: pr.hops.map(h => h.start_us) };
    }

    // ── Step: line 125 — schedHops init ───────────────────────────────────────
    steps.push({
      lineIdx: 125, desc: `const schedHops = [] — will extract start times for ${pkts.length} packets`,
      vars: { 'pkts.length': pkts.length, schedHops: '[]', 'schedHops.length': 0 }
    });

    // ── Step: line 126 — branch for extraction ────────────────────────────────
    steps.push({
      lineIdx: 126, desc: `if (allSingleRoute=${allSingleRoute}) → ${allSingleRoute ? 'rv[s_p_h] direct' : 'argmax z_p_r then rv[s_p_r_h]'}`,
      vars: {
        allSingleRoute
      }
    });

    // ── Per-packet extraction steps (lineIdx 127-131 or 134-139) ──────────────
    const schedHopsSoFar = [];
    for (let p = 0; p < pkts.length; p++) {
      const pk = pkts[p];
      const sh = schedHops[p];
      if (!sh) continue;
      const rt = pk.routes[sh.route];
      const varNames = allSingleRoute
        ? rt.hops.map((_, h) => sv(p, h))
        : rt.hops.map((_, h) => `s_${p}_${sh.route}_${h}`);

      // Collect rv lookups for display
      const rvLookups = {};
      for (let h2 = 0; h2 < rt.hops.length; h2++) {
        const vn = varNames[h2];
        rvLookups[`rv['${vn}']`] = round3(sh.starts[h2]);
      }
      if (!allSingleRoute) {
        for (let r2 = 0; r2 < pk.routes.length; r2++) {
          rvLookups[`rv['z_${p}_${r2}']`] = r2 === sh.route ? 1 : 0;
        }
      }

      if (allSingleRoute) {
        // lineIdx 127: for (let p = 0; p < pkts.length; p++) {
        steps.push({
          lineIdx: 127,
          desc: `for p=${p}: ${pk.pid} (route=${sh.route})`,
          vars: { p, 'pkts.length': pkts.length }
        });
        // lineIdx 128: const starts = [];
        steps.push({
          lineIdx: 128,
          desc: `const starts = []`,
          vars: { starts: '[]' }
        });
        // lineIdx 129: for (let h ...) starts.push(Number(rv[sv(p, h)] || 0));
        {
          const startsSoFar = [];
          for (let h = 0; h < rt.hops.length; h++) {
            const vn = varNames[h];
            const val = round3(sh.starts[h]);
            startsSoFar.push(val);
            steps.push({
              lineIdx: 129,
              desc: `h=${h}: starts.push(Number(rv['${vn}'])) → ${val}`,
              vars: { h, starts: `[${startsSoFar.join(', ')}]` }
            });
          }
        }
        // lineIdx 130: schedHops.push({ route: 0, starts });
        schedHopsSoFar.push({ route: 0, starts: sh.starts.map(v => round3(v)) });
        steps.push({
          lineIdx: 130,
          desc: `schedHops.push({ route: 0, starts: [${sh.starts.map(v => round3(v)).join(', ')}] })`,
          vars: { p, route: 0, schedHops: JSON.stringify(schedHopsSoFar), 'schedHops.length': schedHopsSoFar.length }
        });
      } else {
        // lineIdx 134: for (let p = 0; p < pkts.length; p++) {
        if (p === 0) steps.push({ lineIdx: 134, desc: `for (let p = 0; p < pkts.length; p++) — ${pkts.length} packets`, vars: { 'p': 0, 'pkts.length': pkts.length } });
        // lineIdx 135: const pk = pkts[p]; let selR = 0, bz = -1;
        steps.push({
          lineIdx: 135,
          desc: `p=${p}: pk=${pk.pid}, let selR=0, bz=-1`,
          vars: { p, 'pk.pid': pk.pid, selR: 0, bz: -1 }
        });
        // lineIdx 136: for (let r ...) argmax z_p_r — per-iteration
        {
          let curSelR = 0, curBz = -1;
          for (let r2 = 0; r2 < pk.routes.length; r2++) {
            const v = rvLookups[`rv['z_${p}_${r2}']`] || 0;
            const prevSelR = curSelR, prevBz = curBz;
            if (v > curBz) { curBz = v; curSelR = r2; }
            const updated = (curSelR !== prevSelR || curBz !== prevBz);
            steps.push({
              lineIdx: 136,
              desc: `r=${r2}: v=Number(rv['z_${p}_${r2}']) → ${v}${updated ? ` > bz(${prevBz}) → selR=${curSelR}, bz=${curBz}` : ` ≤ bz(${curBz}) → no change`}`,
              vars: { r: r2, v, selR: curSelR, bz: curBz }
            });
          }
        }
        // lineIdx 137: const starts = [];
        steps.push({
          lineIdx: 137,
          desc: `const starts = []`,
          vars: { starts: '[]' }
        });
        // lineIdx 138: for (let h ...) starts.push(Number(rv[`s_${p}_${selR}_${h}`] || 0));
        {
          const startsSoFar = [];
          for (let h = 0; h < rt.hops.length; h++) {
            const vn = varNames[h];
            const val = round3(sh.starts[h]);
            startsSoFar.push(val);
            steps.push({
              lineIdx: 138,
              desc: `h=${h}: starts.push(Number(rv['${vn}'])) → ${val}`,
              vars: { h, starts: `[${startsSoFar.join(', ')}]` }
            });
          }
        }
        // lineIdx 139: schedHops.push({ route: selR, starts });
        schedHopsSoFar.push({ route: sh.route, starts: sh.starts.map(v => round3(v)) });
        steps.push({
          lineIdx: 139,
          desc: `schedHops.push({ route: ${sh.route}, starts: [${sh.starts.map(v => round3(v)).join(', ')}] })`,
          vars: { p, route: sh.route, schedHops: JSON.stringify(schedHopsSoFar), 'schedHops.length': schedHopsSoFar.length }
        });
      }
    }

    // lineIdx 131/140: } (end inner extraction loop)
    steps.push({ lineIdx: allSingleRoute ? 131 : 140, desc: `}`, vars: {} });
    // lineIdx 141 (multi-route only) or just continue
    if (!allSingleRoute) {
      steps.push({ lineIdx: 141, desc: `}`, vars: {} });
    }

    /* ── Walkthrough: skipped extraction branch (주석 처리) ──
    const wte = '[미실행]';
    if (allSingleRoute) {
      steps.push({ lineIdx: 132, desc: `${wte} } else {`, vars: {} });
      steps.push({ lineIdx: 133, desc: `${wte} const zv2 = (p, r) => \`z_\${p}_\${r}\``, vars: {} });
      steps.push({ lineIdx: 134, desc: `${wte} for (let p = 0; p < pkts.length; p++)`, vars: {} });
      steps.push({ lineIdx: 135, desc: `${wte} const pk = pkts[p]; let selR = 0, bz = -1`, vars: {} });
      steps.push({ lineIdx: 136, desc: `${wte} for (let r ...) { const v = Number(rv[zv2(p,r)] || 0); if (v > bz) { bz=v; selR=r } }`, vars: {} });
      steps.push({ lineIdx: 137, desc: `${wte} const starts = []`, vars: {} });
      steps.push({ lineIdx: 138, desc: `${wte} for (let h ...) starts.push(Number(rv[\`s_\${p}_\${selR}_\${h}\`] || 0))`, vars: {} });
      steps.push({ lineIdx: 139, desc: `${wte} schedHops.push({ route: selR, starts })`, vars: {} });
      steps.push({ lineIdx: 140, desc: `${wte} }`, vars: {} });
      steps.push({ lineIdx: 141, desc: `${wte} }`, vars: {} });
    } else {
      steps.push({ lineIdx: 127, desc: `${wte} for (let p = 0; p < pkts.length; p++) {`, vars: {} });
      steps.push({ lineIdx: 128, desc: `${wte} const starts = []`, vars: {} });
      steps.push({ lineIdx: 129, desc: `${wte} for (let h ...) starts.push(Number(rv[sv(p, h)] || 0))`, vars: {} });
      steps.push({ lineIdx: 130, desc: `${wte} schedHops.push({ route: 0, starts })`, vars: {} });
      steps.push({ lineIdx: 131, desc: `${wte} }`, vars: {} });
    }
    */

    // ── Step-by-step placement for Gantt/Topology animation ───────────────
    const order = pkts.map((_, i) => i);
    order.sort((a, b) => {
      const pa = pkts[a], pb = pkts[b];
      if (pa.pri !== pb.pri) return pb.pri - pa.pri;
      if (pa.rel !== pb.rel) return pa.rel - pb.rel;
      return (pa.dl ?? Infinity) - (pb.dl ?? Infinity);
    });

    let pktsDone = 0;
    for (const pi of order) {
      const pk = pkts[pi];
      const sh = schedHops[pi];
      if (!sh) continue;
      const rt = pk.routes[sh.route];

      for (let h = 0; h < rt.hops.length; h++) {
        const hp = rt.hops[h];
        const s = sh.starts[h], e = round3(s + hp.tx);
        const pColor = flowColor(pk.fid);
        const delta = { lid: hp.lid, interval: [round3(s), e], route: sh.route, pid: pk.pid, color: pColor };

        linkOcc[hp.lid].push([round3(s), e]);

          /* guard band start: only for TSN packets on trunk links preceded by a gap */
        const lnkInfo = lm.get(hp.lid);
        const isTrunk = nodeType[lnkInfo.from] === 'switch';
        let gs = null;
        if (pk.tsn && isTrunk) {
          const occ = linkOcc[hp.lid];
          let prevEnd = 0;
          for (const [os, oe] of occ) {
            if (oe <= round3(s) && oe > prevEnd) prevEnd = oe;
          }
          if (round3(s) - prevEnd > 0) {
            gs = round3(Math.max(prevEnd, round3(s) - model.guard_band_us));
          }
        }

        steps.push({
          lineIdx: 139,
          desc: `Animate ${pk.pid} hop ${h+1}/${rt.hops.length}: ${hp.lid} [${round3(s)}, ${e}]µs (R${sh.route})`,
          vars: {
            'pk.pid': pk.pid, 'hp.lid': hp.lid,
            start: round3(s), end: e,
            'hp.tx': round3(hp.tx),
            'sh.route': sh.route
          },
          delta,
          gantt: { pid: pk.pid, fid: pk.fid, lid: hp.lid, s: round3(s), e, gs, color: pColor, h, nh: rt.hops.length, route: sh.route, queue: sh.queues ? sh.queues[h] : -1 }
        });
      }

      const lastH = rt.hops.at(-1);
      const fin = sh.starts.at(-1) + lastH.tx + lastH.pd;
      const e2e = round3(fin - pk.rel);
      const ok = pk.dl == null || fin <= pk.dl + 1e-6;
      pktsDone++;

      steps.push({
        lineIdx: 144,
        desc: `${pk.pid}: e2e=${e2e}µs, status=${pk.dl == null ? 'NON-ST' : ok ? 'OK' : 'MISS'}`,
        vars: {
          'pk.pid': pk.pid, 'sh.route': sh.route,
          starts: sh.starts.map(v => round3(v)).join(', ')
        },
        pktStatus: { pid: pk.pid, status: pk.dl == null ? 'NON-ST' : ok ? 'OK' : 'MISS', e2e }
      });
    }

    // lineIdx 142: empty line
    steps.push({ lineIdx: 142, desc: ``, vars: {} });

    // ── Step: line 143 — statusLabel ──────────────────────────────────────────
    const statusLabel = statusCode === glpk.GLP_OPT ? 'optimal' : 'feasible (time limit)';
    steps.push({
      lineIdx: 143,
      desc: `const statusLabel = "${statusLabel}"`,
      vars: {
        'solved.result.status': statusCode,
        'glpk.GLP_OPT': glpk.GLP_OPT,
        statusLabel
      }
    });

    // ── Step: line 144 — return buildResult ───────────────────────────────────
    steps.push({
      lineIdx: 144,
      desc: `return buildResult(model, pkts, schedHops, '...', stats)`,
      vars: {}
    });

    // lineIdx 145: arg1 — model
    steps.push({ lineIdx: 145,
      desc: `arg1: model — ${model.nodes.length} nodes, ${model.links.length} links, ${model.flows.length} flows`,
      vars: { 'model.nodes.length': model.nodes.length, 'model.links.length': model.links.length, 'model.flows.length': model.flows.length, 'model.cycle_time_us': model.cycle_time_us },
      modelData: model
    });

    // lineIdx 145: arg2 — pkts
    steps.push({ lineIdx: 145,
      desc: `arg2: pkts — ${pkts.length} packets`,
      vars: { 'pkts.length': pkts.length },
      pktsData: pkts
    });

    // lineIdx 145: arg3 — schedHops
    steps.push({ lineIdx: 145,
      desc: `arg3: schedHops — ${schedHops.filter(Boolean).length} entries`,
      vars: { 'schedHops.length': schedHops.filter(Boolean).length, schedHops: JSON.stringify(schedHops.filter(Boolean)) },
      schedHopsData: schedHops.filter(Boolean)
    });

    // lineIdx 146: arg4 — method string
    const methodStr = 'ILP (GLPK v' + (typeof glpk.version === 'function' ? glpk.version() : (glpk.version || '?')) + ', ' + statusLabel + ')';
    steps.push({ lineIdx: 146,
      desc: `arg4: method = "${methodStr}"`,
      vars: { method: methodStr }
    });

    // lineIdx 146: arg5 — stats object
    const statsObj = {
      constraints: result.stats.constraints,
      variables: result.stats.variables,
      binaries: result.stats.binaries,
      status: `${statusCode} (${statusName})`,
      runtime_ms: result.stats.runtime_ms
    };
    steps.push({ lineIdx: 146,
      desc: `arg5: stats`,
      vars: { 'stats.constraints': statsObj.constraints, 'stats.variables': statsObj.variables, 'stats.binaries': statsObj.binaries, 'stats.status': statsObj.status, 'stats.runtime_ms': statsObj.runtime_ms }
    });

    // lineIdx 147: );
    steps.push({ lineIdx: 147, desc: `);`, vars: {} });
    // lineIdx 148: }
    steps.push({ lineIdx: 148, desc: `}`, vars: {} });

    const activeLinks = model.links.filter(l => linkOcc[l.id] && linkOcc[l.id].length > 0);

    return {
      steps, pkts, activeLinks, schedHops,
      depInfo: `ILP: ${result.stats.variables} vars, ${result.stats.binaries} bins, ${result.stats.constraints} cstrs — ${result.method}`
    };
  }