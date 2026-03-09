/* ═══════════════════════════════════════════════
   debug-renderers.js — Render/UI functions
   ═══════════════════════════════════════════════ */
import { round3, isTsn, CONFIGS, FN_UI } from './debug-utils.js';
import { SOURCE_CODE } from './debug-source-code.js';

/* ═══════════════════════════════════════════════
   SYNTAX HIGHLIGHTING
   ═══════════════════════════════════════════════ */
export function highlightSyntax(code) {
  let s = code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/(\/\/.*)/g, '<span class="syn-cmt">$1</span>');
  s = s.replace(/(\/\*.*?\*\/)/g, '<span class="syn-cmt">$1</span>');
  s = s.replace(/(`[^`]*`|"[^"]*"|'[^']*')/g, '<span class="syn-str">$1</span>');
  s = s.replace(/\b(\d+\.?\d*)\b/g, '<span class="syn-num">$1</span>');
  s = s.replace(/\b(const|let|var|function|async|await|export|return|for|while|if|else|break|continue|new|of|in|true|false|null|typeof|throw)\b/g,
    '<span class="syn-kw">$1</span>');
  s = s.replace(/\b([a-zA-Z_]\w*)\s*\(/g, '<span class="syn-fn">$1</span>(');
  return s;
}

/* ═══════════════════════════════════════════════
   RENDER CODE PANEL — Real line numbers from ilp-core.js
   ═══════════════════════════════════════════════ */
export function renderCodePanel(fnName) {
  const src = SOURCE_CODE[fnName];
  if (!src) return;
  const fnLabel = document.getElementById('codeFnLabel');
  const container = document.getElementById('codeLines');
  fnLabel.textContent = `${fnName} — ilp-core.js:${src.startLine}`;
  container.innerHTML = src.lines.map((line, i) =>
    `<div class="code-line" data-idx="${i}"><span class="line-no">${src.startLine + i}</span><span class="line-code">${highlightSyntax(line)}</span></div>`
  ).join('');
}

export function highlightCodeLine(lineIdx) {
  document.querySelectorAll('.code-line.highlight').forEach(el => el.classList.remove('highlight'));
  if (lineIdx == null || lineIdx < 0) return;
  const el = document.querySelector(`.code-line[data-idx="${lineIdx}"]`);
  if (el) {
    el.classList.add('highlight');
    const panel = document.getElementById('codePanel');
    const elTop = el.offsetTop - panel.offsetTop;
    const panelH = panel.clientHeight;
    panel.scrollTo({ top: elTop - panelH / 2, behavior: 'smooth' });
  }
}

/* ═══════════════════════════════════════════════
   CONDITIONAL UI VISIBILITY
   ═══════════════════════════════════════════════ */
export function applyUIVisibility(fnName) {
  const ui = FN_UI[fnName];
  document.getElementById('occSection').classList.toggle('hidden', !ui.occ);
  document.getElementById('pktSection').classList.toggle('hidden', !ui.pkt);
  document.getElementById('ganttCard').style.display = ui.gantt ? '' : 'none';
  document.getElementById('topoCard').style.display = ui.topo ? '' : 'none';
  document.getElementById('flowSelect').style.display = fnName === 'generateKPaths' ? '' : 'none';
  document.getElementById('solverSelect').style.display = fnName === 'buildResult' ? '' : 'none';
  const ganttCard = document.getElementById('ganttCard');
  const topoCard = document.getElementById('topoCard');
  if (fnName === 'expandPackets') {
    topoCard.parentNode.insertBefore(ganttCard, topoCard);
  } else {
    ganttCard.parentNode.appendChild(ganttCard);
  }
}

export function populateFlowSelect(model) {
  const sel = document.getElementById('flowSelect');
  sel.innerHTML = '';
  const seen = new Set();
  model.flows.forEach((f, i) => {
    const key = `${f.src}→${f.dst}`;
    if (seen.has(key)) return;
    seen.add(key);
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `src: ${f.src} → dst: ${f.dst}`;
    sel.appendChild(opt);
  });
}

/* ═══════════════════════════════════════════════
   ANIMATED GANTT RENDERER
   ═══════════════════════════════════════════════ */
export function renderAnimGantt(container, model, activeLinks) {
  container.innerHTML = '';
  if (!activeLinks.length) return null;
  const margin = { top: 28, right: 60, bottom: 40, left: 130 };
  const rowH = 40;
  const W = container.clientWidth || 800;
  const H = margin.top + activeLinks.length * rowH + margin.bottom;

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const defs = svg.append('defs');
  const gp = defs.append('pattern').attr('id','guardHatch')
    .attr('patternUnits','userSpaceOnUse').attr('width',6).attr('height',6)
    .attr('patternTransform','rotate(45)');
  gp.append('rect').attr('width',6).attr('height',6).attr('fill','#f9a825');
  gp.append('line').attr('x1',0).attr('y1',0).attr('x2',0).attr('y2',6)
    .attr('stroke','rgba(0,0,0,0.2)').attr('stroke-width',2);

  const glow = defs.append('filter').attr('id','pGlow')
    .attr('x','-15%').attr('y','-15%').attr('width','130%').attr('height','130%');
  glow.append('feGaussianBlur').attr('in','SourceGraphic').attr('stdDeviation','2').attr('result','b');
  const fm = glow.append('feMerge');
  fm.append('feMergeNode').attr('in','b');
  fm.append('feMergeNode').attr('in','SourceGraphic');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const innerW = W - margin.left - margin.right;
  const innerH = activeLinks.length * rowH;

  const x = d3.scaleLinear().domain([0, model.cycle_time_us]).range([0, innerW]);
  const y = d3.scaleBand().domain(activeLinks.map(l => l.id)).range([0, innerH]).padding(0.15);

  g.append('g').attr('class','gcl-grid')
    .selectAll('line').data(x.ticks(10)).enter().append('line')
    .attr('x1',d=>x(d)).attr('x2',d=>x(d)).attr('y1',0).attr('y2',innerH);

  g.append('g').attr('class','gcl-axis').attr('transform',`translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d => d + ' \u00b5s'));

  g.append('g').attr('class','gcl-axis')
    .call(d3.axisLeft(y).tickSize(0).tickPadding(6))
    .selectAll('text').text(d => {
      const lnk = model.links.find(l => l.id === d);
      return lnk ? `${lnk.from} \u2192 ${lnk.to}` : d;
    }).attr('font-size','9px');

  g.selectAll('.rbg').data(activeLinks).enter().append('rect')
    .attr('x',0).attr('y',d=>y(d.id))
    .attr('width',innerW).attr('height',y.bandwidth())
    .attr('fill',(_,i) => i%2===0 ? 'rgba(59,130,246,0.03)' : 'transparent').attr('rx',3);

  const utilG = g.append('g');
  activeLinks.forEach(lnk => {
    utilG.append('text')
      .attr('x', innerW + 8)
      .attr('y', y(lnk.id) + y.bandwidth() / 2)
      .attr('data-lid', lnk.id)
      .attr('fill', 'var(--text2)')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('dominant-baseline', 'central')
      .text('0.0%');
  });

  const cursor = g.append('line').attr('class','scan-cursor');
  const pktG = g.append('g');

  svg.append('text').attr('x', margin.left).attr('y', margin.top - 10)
    .attr('fill','var(--text3)').attr('font-size','9px')
    .text(`Cycle: ${model.cycle_time_us} \u00b5s | Guard: ${model.guard_band_us} \u00b5s | Active: ${activeLinks.length}/${model.links.length} links`);

  return { svg, g, x, y, cursor, pktG, utilG };
}

/* ═══════════════════════════════════════════════
   PACKET EXPANSION TIMELINE (Gantt-style)
   ═══════════════════════════════════════════════ */
export function renderPktTimeline(container, model) {
  container.innerHTML = '';
  const flows = model.flows;
  if (!flows.length) return null;

  const margin = { top: 32, right: 20, bottom: 45, left: 140 };
  const rowH = 52;
  const W = container.clientWidth || 800;
  const H = margin.top + flows.length * rowH + margin.bottom;

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const defs = svg.append('defs');
  const glow = defs.append('filter').attr('id', 'pktGlow')
    .attr('x', '-15%').attr('y', '-15%').attr('width', '130%').attr('height', '130%');
  glow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '2').attr('result', 'b');
  const fm = glow.append('feMerge');
  fm.append('feMergeNode').attr('in', 'b');
  fm.append('feMergeNode').attr('in', 'SourceGraphic');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const innerW = W - margin.left - margin.right;
  const innerH = flows.length * rowH;

  const x = d3.scaleLinear().domain([0, model.cycle_time_us]).range([0, innerW]);
  const y = d3.scaleBand().domain(flows.map(f => f.id)).range([0, innerH]).padding(0.15);

  const periodTicks = new Set();
  flows.forEach(f => {
    if (f.period_us > 0) {
      for (let t = f.period_us; t < model.cycle_time_us; t += f.period_us) {
        periodTicks.add(Math.round(t * 100) / 100);
      }
    }
  });

  g.append('g').attr('class', 'gcl-grid')
    .selectAll('line').data(x.ticks(10)).enter().append('line')
    .attr('x1', d => x(d)).attr('x2', d => x(d)).attr('y1', 0).attr('y2', innerH);

  g.append('g').attr('class', 'gcl-axis').attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d => d + ' \u00b5s'))
    .selectAll('text').attr('font-size', '11px');

  g.append('g').attr('class', 'gcl-axis')
    .call(d3.axisLeft(y).tickSize(0).tickPadding(8))
    .selectAll('text').attr('font-size', '12px').attr('font-weight', '600');

  g.selectAll('.rbg').data(flows).enter().append('rect')
    .attr('x', 0).attr('y', d => y(d.id))
    .attr('width', innerW).attr('height', y.bandwidth())
    .attr('fill', (_, i) => i % 2 === 0 ? 'rgba(59,130,246,0.03)' : 'transparent').attr('rx', 3);

  const pktG = g.append('g');

  svg.append('text').attr('x', margin.left).attr('y', margin.top - 10)
    .attr('fill', 'var(--text3)').attr('font-size', '9px')
    .text(`Cycle: ${model.cycle_time_us} µs | Flows: ${flows.length} | TSN: ${flows.length}`);

  return { svg, g, x, y, pktG };
}

/* ═══════════════════════════════════════════════
   NETWORK TOPOLOGY RENDERER — Queue State Viz
   ═══════════════════════════════════════════════ */
export function renderTopoViz(container, model, modelKey) {
  container.innerHTML = '';
  const cfg = CONFIGS[modelKey];
  const W = container.clientWidth || 800;
  const H = 600;
  const positions = cfg.getPositions(W, H);
  const nodeColors = cfg.nodeColors;
  const switches = cfg.switches;
  const switchIds = new Set(switches.map(s => s.id));

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%').style('min-height', H + 'px');

  const defs = svg.append('defs');
  const glow = defs.append('filter').attr('id', 'topoGlow')
    .attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
  glow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '3');

  const linkG = svg.append('g').attr('class', 'topo-links');
  const linkLines = {};
  const drawnPairs = new Set();

  for (const lnk of model.links) {
    const pairKey = [lnk.from, lnk.to].sort().join('|');
    const fromPos = positions[lnk.from];
    const toPos = positions[lnk.to];
    if (!fromPos || !toPos) continue;

    if (drawnPairs.has(pairKey)) {
      const existing = linkG.select(`line[data-pair="${pairKey}"]`);
      if (!existing.empty()) {
        const ids = existing.attr('data-ids');
        existing.attr('data-ids', ids + ',' + lnk.id);
        linkLines[lnk.id] = existing.node();
      }
      continue;
    }
    drawnPairs.add(pairKey);

    const line = linkG.append('line')
      .attr('class', 'topo-viz-link')
      .attr('x1', fromPos.x).attr('y1', fromPos.y)
      .attr('x2', toPos.x).attr('y2', toPos.y)
      .attr('data-pair', pairKey)
      .attr('data-ids', lnk.id);
    linkLines[lnk.id] = line.node();
  }

  const nodeG = svg.append('g').attr('class', 'topo-nodes');
  const nodeData = {};

  for (const nd of model.nodes) {
    const pos = positions[nd.id];
    if (!pos) continue;
    const nc = nodeColors[nd.id] || { fill: '#f1f5f9', stroke: '#94a3b8', label: nd.id, shortLabel: nd.id };
    const isSw = switchIds.has(nd.id);
    const r = isSw ? 26 : 17;

    const g = nodeG.append('g')
      .attr('class', 'topo-viz-node')
      .attr('transform', `translate(${pos.x},${pos.y})`);

    g.append('circle')
      .attr('r', r)
      .attr('fill', nc.fill)
      .attr('stroke', nc.stroke)
      .attr('stroke-width', isSw ? 2.5 : 1.5);

    g.append('text')
      .attr('y', -r - 5)
      .attr('text-anchor', 'middle')
      .text(nd.id);

    g.append('text')
      .attr('class', 'node-label')
      .attr('y', 3)
      .attr('text-anchor', 'middle')
      .attr('font-size', isSw ? '9px' : '7px')
      .text(nc.shortLabel);

    nodeData[nd.id] = { g: g.node(), pos, isSw, r };
  }

  const queueData = {};
  const queueG = svg.append('g').attr('class', 'topo-queue-insets');

  for (const sw of switches) {
    const pos = positions[sw.id];
    if (!pos) continue;
    const egressLinks = model.links.filter(l => l.from === sw.id);
    if (!egressLinks.length) continue;

    const cellW = 12, cellH = 12, gap = 2;
    const numQ = 8;
    const totalW = egressLinks.length * (numQ * (cellW + gap) + 8);
    const startX = pos.x - totalW / 2;
    const startY = pos.y + 36;

    queueData[sw.id] = {};

    egressLinks.forEach((el, ei) => {
      const baseX = startX + ei * (numQ * (cellW + gap) + 8);
      queueData[sw.id][el.id] = [];

      queueG.append('text')
        .attr('class', 'queue-legend')
        .attr('x', baseX + numQ * (cellW + gap) / 2)
        .attr('y', startY - 3)
        .attr('text-anchor', 'middle')
        .text(el.to.length > 6 ? el.to.substring(0, 6) : el.to);

      for (let q = 0; q < numQ; q++) {
        const qTooltip = document.getElementById('tooltip');
        const rect = queueG.append('rect')
          .attr('class', 'queue-cell open')
          .attr('x', baseX + q * (cellW + gap))
          .attr('y', startY)
          .attr('width', cellW)
          .attr('height', cellH)
          .attr('data-sw', sw.id)
          .attr('data-link', el.id)
          .attr('data-q', q)
          .style('cursor', 'pointer')
          .on('mouseover', function() {
            const swId = this.getAttribute('data-sw');
            const linkId = this.getAttribute('data-link');
            const qIdx = this.getAttribute('data-q');
            const state = this.classList.contains('closed') ? 'Closed (in use)' : 'Open';
            qTooltip.innerHTML = `<div class="tt-title">Queue ${qIdx}</div>`
              + `<div class="tt-row"><span class="tt-k">Switch</span><span class="tt-v">${swId}</span></div>`
              + `<div class="tt-row"><span class="tt-k">Egress to</span><span class="tt-v">${el.to}</span></div>`
              + `<div class="tt-row"><span class="tt-k">Link</span><span class="tt-v">${linkId}</span></div>`
              + `<div class="tt-row"><span class="tt-k">State</span><span class="tt-v">${state}</span></div>`;
            qTooltip.classList.add('show');
          })
          .on('mousemove', function(evt) {
            qTooltip.style.left = (evt.clientX + 12) + 'px';
            qTooltip.style.top = (evt.clientY - 10) + 'px';
          })
          .on('mouseout', function() { qTooltip.classList.remove('show'); });
        queueData[sw.id][el.id].push(rect.node());
      }
    });
  }

  const particleG = svg.append('g').attr('class', 'topo-particles');

  svg.append('text')
    .attr('class', 'queue-legend')
    .attr('x', 10).attr('y', H - 8)
    .text('Queue cells: 8 queues per egress port (RR dynamic assignment)');

  return { svg: svg.node(), positions, linkLines, nodeData, queueData, queueG: queueG.node(), particleG: particleG.node() };
}
