/* expand-packets.js — instrumentExpandPackets */
import {
  round3, isTsn, txTimeUs,
  fmtLm, fmtAdj, fmtPkts, fmtCp, fmtRoutes
} from '../debug-utils.js';
import { generateKPaths } from '../ilp-core.js';
import { realFlowColor } from '../roii-real-data.js';

export function instrumentExpandPackets(model) {
  const steps = [];

  steps.push({
    lineIdx: 0, desc: 'expandPackets(model) — begin',
    vars: { 'model.flows': model.flows.length, 'model.links': model.links.length, 'model.cycle_time_us': model.cycle_time_us, 'model.guard_band_us': model.guard_band_us, 'model.processing_delay_us': model.processing_delay_us }
  });

  const lm = new Map(model.links.map(l => [l.id, l]));
  steps.push({
    lineIdx: 1, desc: `Build link map: ${lm.size} links`,
    vars: { 'lm.size': lm.size, lm: fmtLm(lm) }
  });

  const adj = new Map();
  steps.push({
    lineIdx: 2, desc: 'Initialize adjacency map (empty)',
    vars: { 'adj.size': 0, adj: 'Map(0){}' }
  });

  for (let li = 0; li < model.links.length; li++) {
    const l = model.links[li];
    if (!adj.has(l.from)) adj.set(l.from, []);
    adj.get(l.from).push({ to: l.to, lid: l.id });
    steps.push({
      lineIdx: 3,
      desc: `adj loop [${li + 1}/${model.links.length}]: ${l.from} → {to: "${l.to}", lid: "${l.id}"}`,
      vars: { 'l.id': l.id, 'l.from': l.from, 'l.to': l.to, 'adj.size': adj.size, adj: fmtAdj(adj) }
    });
  }

  const pkts = [];
  steps.push({
    lineIdx: 4, desc: 'Initialize pkts = []',
    vars: { pkts: '[]' }
  });

  for (const f of model.flows) {
    steps.push({
      lineIdx: 5, desc: `Enter flow loop: ${f.id}`,
      vars: { 'f.id': f.id, 'f.PCP': f.PCP, 'f.payload_bytes': f.payload_bytes, 'f.period_us': f.period_us, 'f.deadline_us': f.deadline_us, 'f.traffic_type': f.traffic_type, 'f.src': f.src, 'f.dst': f.dst }
    });

    steps.push({
      lineIdx: 6, desc: `period_us = ${f.period_us} > 0 → pass`,
      vars: { 'f.period_us': f.period_us }
    });

    let cp = f.candidate_paths || (f.path ? [f.path] : null);
    steps.push({
      lineIdx: 7, desc: `let cp = f.candidate_paths || (f.path ? [f.path] : null)`,
      vars: { cp: 'null' }
    });

    const needGenerate = !cp && f.src && f.dst;
    if (cp) {
      steps.push({
        lineIdx: 8, desc: `f.path is set → cp = [f.path], skip generateKPaths`,
        vars: { cp: fmtCp(cp), 'f.src': f.src, 'f.dst': f.dst }
      });
    } else {
      steps.push({
        lineIdx: 8, desc: `cp is null → need generateKPaths(${f.src}, ${f.dst})`,
        vars: { cp: 'null', 'f.src': f.src, 'f.dst': f.dst }
      });
    }

    if (needGenerate) {
      cp = generateKPaths(adj, f.src, f.dst, Math.max(1, f.k_paths || 2), model.nodes.length + 2);
      steps.push({
        lineIdx: 9, desc: `cp = generateKPaths(${f.src}, ${f.dst}) → ${cp.length} path(s)`,
        vars: { cp: fmtCp(cp) }
      });

      steps.push({
        lineIdx: 10, desc: `cp.length = ${cp.length} → pass`,
        vars: { cp: fmtCp(cp) }
      });
    }

    if (!cp || !Array.isArray(cp) || cp.length === 0) {
      steps.push({
        lineIdx: 12, desc: `Flow ${f.id}: no valid paths → error`,
        vars: {}
      });
      continue;
    }
    steps.push({
      lineIdx: 12, desc: `cp: ${cp.length} path(s) → proceed`,
      vars: { cp: fmtCp(cp) }
    });

    for (let pi = 0; pi < cp.length; pi++) {
      const p = cp[pi];
      steps.push({
        lineIdx: 13,
        desc: `Validate path[${pi}]: [${p.join(' → ')}]`,
        vars: {}
      });
      for (const lid of p) if (!lm.has(lid)) throw new Error(`flow ${f.id}: unknown link ${lid}`);
    }

    const repsRaw = model.cycle_time_us / f.period_us;
    steps.push({
      lineIdx: 17, desc: `repsRaw = ${model.cycle_time_us} / ${f.period_us} = ${round3(repsRaw)}`,
      vars: { repsRaw: round3(repsRaw) }
    });

    const reps = Math.round(repsRaw);
    steps.push({
      lineIdx: 18, desc: `reps = Math.round(${round3(repsRaw)}) = ${reps}`,
      vars: { reps }
    });

    for (let kk = 0; kk < reps; kk++) {
      steps.push({
        lineIdx: 20, desc: `Packet rep loop: k=${kk} (< ${reps})`,
        vars: { k: kk, reps }
      });

      const rel = kk * f.period_us;
      steps.push({
        lineIdx: 21, desc: `rel = ${kk} * ${f.period_us} = ${rel}µs`,
        vars: { k: kk, rel }
      });

      const pkt = {
        pid: `${f.id}#${kk}`, fid: f.id, pri: f.PCP, tt: f.traffic_type,
        rel, dl: f.deadline_us == null ? null : rel + f.deadline_us,
        tsn: isTsn(f.deadline_us),
        routes: cp.map((pl, ri) => ({
          ri, hops: pl.map(lid => ({
            lid, tx: txTimeUs(f.payload_bytes, lm.get(lid).rate_mbps),
            pd: lm.get(lid).prop_delay_us
          }))
        }))
      };

      steps.push({
        lineIdx: 22, desc: `pkts.push({`,
        vars: { pid: pkt.pid }
      });

      steps.push({
        lineIdx: 23, desc: `pid: ${pkt.pid}, fid: ${pkt.fid}, pri: ${pkt.pri}, tt: ${pkt.tt}`,
        vars: { pid: pkt.pid, fid: pkt.fid, pri: pkt.pri, tt: pkt.tt }
      });

      steps.push({
        lineIdx: 24, desc: `rel: ${pkt.rel}µs, dl: ${pkt.dl === null ? 'null' : pkt.dl + 'µs'}`,
        vars: { rel: pkt.rel, dl: pkt.dl }
      });

      steps.push({
        lineIdx: 25, desc: `tsn: ${pkt.tsn}`,
        vars: { tsn: pkt.tsn }
      });

      steps.push({
        lineIdx: 26, desc: `routes: ${pkt.routes.length} route(s)`,
        vars: { routes: fmtRoutes(pkt.routes), 'pkts.length': pkts.length }
      });

      pkts.push(pkt);
      steps.push({
        lineIdx: 27, desc: `}); — pushed ${pkt.pid}`,
        vars: { pkts: fmtPkts(pkts) },
        pktTimeline: {
          pid: pkt.pid, fid: pkt.fid, rel: pkt.rel, dl: pkt.dl,
          period: f.period_us, tsn: pkt.tsn,
          color: realFlowColor(f.id),
          totalTx: pkt.routes[0].hops.reduce((s, h) => s + h.tx + h.pd, 0)
        }
      });

      steps.push({
        lineIdx: 28, desc: `End rep k=${kk}`,
        vars: { k: kk, pkts: fmtPkts(pkts) }
      });
    }

    steps.push({
      lineIdx: 29, desc: `End flow ${f.id} — ${reps} packets created`,
      vars: { 'f.id': f.id, reps, pkts: fmtPkts(pkts) }
    });
  }

  steps.push({
    lineIdx: 30, desc: `Return ${pkts.length} packets from ${model.flows.length} flows`,
    vars: { pkts: fmtPkts(pkts) },
    pktsData: pkts
  });

  steps.push({
    lineIdx: 31, desc: 'End expandPackets',
    vars: { pkts: fmtPkts(pkts) },
    pktsData: pkts
  });

  return { steps, pkts, depInfo: `expandPackets internally calls generateKPaths for ${model.flows.length} flows` };
}
