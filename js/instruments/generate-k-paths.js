/* generate-k-paths.js — instrumentGenerateKPaths */
import { round3 } from '../debug-utils.js';
import { generateKPaths } from '../ilp-core.js';

export function instrumentGenerateKPaths(model, flowIndex = 0) {
  const steps = [];
  const lm = new Map(model.links.map(l => [l.id, l]));
  const adj = new Map();
  for (const l of model.links) {
    if (!adj.has(l.from)) adj.set(l.from, []);
    adj.get(l.from).push({ to: l.to, lid: l.id });
  }

  const f = model.flows[flowIndex] || model.flows[0];
  const src = f.src, dst = f.dst;
  const k = Math.max(1, f.k_paths || 2);
  const maxD = model.nodes.length + 2;

  steps.push({
    lineIdx: 0, desc: `generateKPaths(adj, "${src}", "${dst}", k=${k}, maxD=${maxD})`,
    vars: { src, dst, k, maxD, adj: `Map(${adj.size} nodes)`, flows: model.flows.length }
  });

  const found = [];
  steps.push({
    lineIdx: 1, desc: 'Initialize found = []',
    vars: { found: '[]', src, dst, k, maxD }
  });

  let stepCount = 0;
  const MAX_STEPS = 60;

  (function dfs(n, d, vis, path) {
    if (found.length >= 2000 || d > maxD) return;
    if (n === dst) {
      found.push(path.slice());
      if (stepCount < MAX_STEPS) {
        steps.push({
          lineIdx: 4, desc: `Found path #${found.length}: [${path.join(' → ')}]`,
          vars: { n, d, 'found.length': found.length, found: found.map(p => p.slice()), path: path.slice(), vis: [...vis] }
        });
        stepCount++;
      }
      return;
    }
    for (const e of (adj.get(n) || [])) {
      if (vis.has(e.to)) continue;
      vis.add(e.to); path.push(e.lid);
      if (stepCount < MAX_STEPS) {
        steps.push({
          lineIdx: 7, desc: `DFS: visit ${e.to} via ${e.lid} (depth=${d+1})`,
          vars: { n: e.to, d: d + 1, link: e.lid, path: path.slice(), vis: [...vis], 'found.length': found.length, found: found.map(p => p.slice()) }
        });
        stepCount++;
      }
      dfs(e.to, d + 1, vis, path);
      path.pop(); vis.delete(e.to);
    }
  })(src, 0, new Set([src]), []);

  found.sort((a, b) => a.length - b.length || a.join('|').localeCompare(b.join('|')));
  steps.push({
    lineIdx: 12, desc: `Sorted ${found.length} candidates by length`,
    vars: { 'found.length': found.length, found: found.map(p => p.slice()) }
  });

  const u = [], s = new Set();
  for (const p of found) {
    const k2 = p.join('>');
    if (!s.has(k2)) { s.add(k2); u.push(p); }
    if (u.length >= k) break;
  }

  steps.push({
    lineIdx: 14, desc: `Deduplicated: ${u.length} unique paths (from ${found.length})`,
    vars: { u: u.map(p => p.slice()), s: '[' + [...s].join(', ') + ']', unique: u.length }
  });

  steps.push({
    lineIdx: 15, desc: `Return ${u.length} paths`,
    vars: { result: u.map(p => p.slice()), bestLen: u[0]?.length || 0 }
  });

  const allFlowPaths = {};
  for (const fl of model.flows) {
    const cp = fl.candidate_paths || (fl.path ? [fl.path] : null);
    if (cp) { allFlowPaths[fl.id] = cp; continue; }
    allFlowPaths[fl.id] = generateKPaths(adj, fl.src, fl.dst, Math.max(1, fl.k_paths || 2), model.nodes.length + 2);
  }

  return { steps, depInfo: null, extra: { adj, lm, allFlowPaths } };
}
