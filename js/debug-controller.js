/* ═══════════════════════════════════════════════
   debug-controller.js — DebugController + init/events
   ═══════════════════════════════════════════════ */
import { round3, deep, pktColor, FN_UI, CONFIGS } from './debug-utils.js';
import {
  highlightCodeLine, renderCodePanel, applyUIVisibility,
  populateFlowSelect, renderAnimGantt, renderPktTimeline, renderTopoViz,
  renderBoardConfig
} from './debug-renderers.js';
import {
  instrumentGenerateKPaths, instrumentExpandPackets,
  instrumentSolveGreedy, instrumentSolveILP, instrumentBuildResult
} from './instruments/index.js';
import { initTooltip, flowColor } from './ilp-core.js';

/* ═══════════════════════════════════════════════
   GLPK LOADER (lazy, only for solveILP)
   ═══════════════════════════════════════════════ */
let glpkInstance = null;
let glpkLoading = false;

async function ensureGLPK() {
  if (glpkInstance) return glpkInstance;
  if (glpkLoading) {
    while (glpkLoading) await new Promise(r => setTimeout(r, 100));
    return glpkInstance;
  }
  glpkLoading = true;
  try {
    const GLPK = (await import('../vendor/glpk.js')).default;
    glpkInstance = await GLPK();
  } catch (e) {
    console.error('GLPK load error:', e);
  }
  glpkLoading = false;
  return glpkInstance;
}

/* ═══════════════════════════════════════════════
   DEBUG CONTROLLER — Delta-based, single function
   ═══════════════════════════════════════════════ */
class DebugController {
  constructor() {
    this.steps = [];
    this.pkts = [];
    this.activeLinks = [];
    this.model = null;
    this.fnName = 'solveGreedy';
    this.cur = 0;
    this.playing = false;
    this.speed = 1;
    this.af = null;
    this.lastT = 0;
    this.tl = null;
    this.ganttElements = [];
    this.pktStatuses = {};
    this.visiblePkts = [];
    this.linkOcc = {};
    this.cumVars = {};
    this._pktsData = null;
    this._schedHopsData = null;
    this.topoViz = null;
    this.modelKey = 'standard';
  }

  async load(fnName, modelKey) {
    this.stop();
    this.cur = 0;
    this.modelKey = modelKey;
    this.steps = [];
    this.pkts = [];
    this.activeLinks = [];
    this.ganttElements = [];
    this.pktStatuses = {};
    this.visiblePkts = [];
    this.cumVars = {};
    this._pktsData = null;
    this._schedHopsData = null;
    this.pktsRevealed = false;
    this.fnName = fnName;

    const cfg = CONFIGS[modelKey];
    this.model = deep(cfg.data);
    this.linkOcc = Object.fromEntries(this.model.links.map(l => [l.id, []]));

    applyUIVisibility(fnName);
    renderCodePanel(fnName);
    const prevFlowIdx = document.getElementById('flowSelect').value;
    populateFlowSelect(this.model);
    const flowSel = document.getElementById('flowSelect');
    if (prevFlowIdx && flowSel.querySelector(`option[value="${prevFlowIdx}"]`)) {
      flowSel.value = prevFlowIdx;
    }

    // Clear all visual elements before (potentially async) instrumentation
    this.tl = null;
    this.topoViz = null;
    document.getElementById('ganttContainer').innerHTML = '';
    document.getElementById('ganttLegend').style.display = 'none';
    document.getElementById('ganttLegend').innerHTML = '';
    document.getElementById('topoVizContainer').innerHTML = '';
    document.getElementById('depInfo').style.display = 'none';
    document.getElementById('pktPanel').innerHTML = '';
    document.getElementById('varPanel').innerHTML = '';
    document.getElementById('occPanel').innerHTML = '';
    this._updateCounter();
    this._updateProgress();
    this._updateStepDesc(null);

    // Disable nav buttons while async solver is running
    const needsGLPK = fnName === 'solveILP' || (fnName === 'buildResult' && document.getElementById('solverSelect').value === 'ilp');
    if (needsGLPK) {
      ['btnPlay','btnPrev','btnNext'].forEach(id => {
        const b = document.getElementById(id);
        if (b) { b.disabled = true; b.style.opacity = '0.4'; }
      });
      document.getElementById('btnPlay').textContent = '⏳ Solving...';
    }

    let result;
    try {
      if (fnName === 'generateKPaths') {
        const fi = parseInt(flowSel.value) || 0;
        result = instrumentGenerateKPaths(this.model, fi);
      } else if (fnName === 'expandPackets') {
        result = instrumentExpandPackets(this.model);
      } else if (fnName === 'solveGreedy') {
        result = instrumentSolveGreedy(this.model);
        this._cachedSolverStats = result.solverStats;
      } else if (fnName === 'solveILP') {
        document.getElementById('stepDesc').textContent = 'Solving ILP (GLPK)… please wait';
        await new Promise(r => setTimeout(r, 0));
        const glpk = await ensureGLPK();
        result = await instrumentSolveILP(this.model, glpk, {tmlim: 15});
        this._cachedSolverStats = null;
      } else if (fnName === 'buildResult') {
        const solver = document.getElementById('solverSelect').value;
        if (solver === 'ilp') {
          document.getElementById('stepDesc').textContent = 'Solving ILP (GLPK)… please wait';
          await new Promise(r => setTimeout(r, 0));
          const glpk = await ensureGLPK();
          result = await instrumentBuildResult(this.model, 'ilp', glpk, this._cachedSolverStats);
        } else {
          result = await instrumentBuildResult(this.model, 'greedy', null, this._cachedSolverStats);
        }
      }
    } catch (e) {
      console.error('Instrumentation error:', e);
      // Re-enable buttons on error
      ['btnPlay','btnPrev','btnNext'].forEach(id => {
        const b = document.getElementById(id);
        if (b) { b.disabled = false; b.style.opacity = ''; }
      });
      document.getElementById('btnPlay').textContent = '▶ Play';
      document.getElementById('stepDesc').textContent = 'Error: ' + e.message;
      return;
    }

    // Re-enable buttons after solve
    if (needsGLPK) {
      ['btnPlay','btnPrev','btnNext'].forEach(id => {
        const b = document.getElementById(id);
        if (b) { b.disabled = false; b.style.opacity = ''; }
      });
      document.getElementById('btnPlay').textContent = '▶ Play';
    }

    this.steps = result.steps || [];
    this.pkts = result.pkts || [];
    this.activeLinks = result.activeLinks || [];
    this._boardConfigs = result.boardConfigs || null;

    const depEl = document.getElementById('depInfo');
    if (result.depInfo) {
      depEl.style.display = '';
      depEl.innerHTML = `<span class="dep-badge">Dependency</span> ${result.depInfo}`;
    } else {
      depEl.style.display = 'none';
    }

    if (fnName === 'expandPackets' && this.pkts.length > 0) {
      depEl.style.display = '';
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      btn.style.cssText = 'margin-left:12px;padding:4px 12px;font-size:0.72rem;vertical-align:middle;';
      btn.textContent = `View All pkts (${this.pkts.length})`;
      btn.onclick = () => {
        const w = window.open('', '_blank');
        w.document.write('<pre>' + JSON.stringify(this.pkts, null, 2) + '</pre>');
        w.document.title = 'pkts Data';
      };
      depEl.appendChild(btn);
    }

    const ui = FN_UI[fnName];
    const ganttContainer = document.getElementById('ganttContainer');
    document.querySelector('#ganttCard .card-title').textContent =
      fnName === 'expandPackets' ? 'Packet Expansion Timeline' : 'Schedule Timeline';
    if (ui.gantt) {
      if (fnName === 'expandPackets') {
        this.tl = renderPktTimeline(ganttContainer, this.model);
      } else if (this.activeLinks.length) {
        this.tl = renderAnimGantt(ganttContainer, this.model, this.activeLinks);
      } else {
        this.tl = null;
        ganttContainer.innerHTML = '';
      }
    } else {
      this.tl = null;
      ganttContainer.innerHTML = '';
    }

    const legendEl = document.getElementById('ganttLegend');
    if ((fnName === 'solveGreedy' || fnName === 'solveILP' || fnName === 'buildResult') && this.pkts && this.pkts.length) {
      legendEl.style.display = 'flex';
      const seenFlows = [];
      for (const pk of this.pkts) {
        if (!seenFlows.some(fid => fid === pk.fid)) seenFlows.push(pk.fid);
      }
      legendEl.innerHTML = seenFlows.map(fid =>
        `<div class="legend-item"><span class="legend-swatch" style="background:${flowColor(fid)}"></span>${fid}</div>`
      ).join('');
    } else {
      legendEl.style.display = 'none';
      legendEl.innerHTML = '';
    }

    if (ui.topo) {
      const topoContainer = document.getElementById('topoVizContainer');
      this.topoViz = renderTopoViz(topoContainer, this.model, modelKey);
    } else {
      this.topoViz = null;
      document.getElementById('topoVizContainer').innerHTML = '';
    }

    // Board Configuration (8-TC mode)
    const boardCard = document.getElementById('boardConfigCard');
    if (this._boardConfigs && Object.keys(this._boardConfigs).length > 0) {
      boardCard.style.display = '';
      renderBoardConfig(document.getElementById('boardConfigPanel'), this._boardConfigs, cfg.switches);
    } else {
      boardCard.style.display = 'none';
    }

    this._updatePktPanel(null);
    this._updateCounter();
    this._updateProgress();
    this._updateStepDesc(null);
    document.getElementById('varPanel').innerHTML = '<span style="color:var(--text3)">Press Play or Next to start</span>';
    document.getElementById('occPanel').innerHTML = '';
  }

  play() {
    if (this.cur >= this.steps.length) this.cur = 0;
    this.playing = true;
    document.getElementById('btnPlay').textContent = '\u25B6 Playing...';
    document.getElementById('btnPlay').classList.add('active');
    this.lastT = performance.now();
    this._tick();
  }

  pause() {
    this.playing = false;
    document.getElementById('btnPlay').textContent = '\u25B6 Play';
    document.getElementById('btnPlay').classList.remove('active');
    if (this.af) { cancelAnimationFrame(this.af); this.af = null; }
  }

  stop() { this.pause(); }
  toggle() { this.playing ? this.pause() : this.play(); }

  _tick() {
    if (!this.playing || this.cur >= this.steps.length) {
      if (this.cur >= this.steps.length) this.pause();
      return;
    }
    const now = performance.now();
    const delay = this._delay(this.steps[this.cur]) / this.speed;
    if (now - this.lastT >= delay) {
      this.stepFwd();
      this.lastT = now;
    }
    this.af = requestAnimationFrame(() => this._tick());
  }

  _delay(s) {
    if (s.gantt) return 250;
    if (s.pktStatus) return 150;
    if (s.desc && s.desc.includes('Select')) return 200;
    return 120;
  }

  stepFwd() {
    if (this.cur >= this.steps.length) return;
    const step = this.steps[this.cur];
    const prevStep = this.cur > 0 ? this.steps[this.cur - 1] : null;
    this._exec(step, prevStep);
    this.cur++;
    this._updateCounter();
    this._updateProgress();
  }

  stepBack() {
    if (this.cur <= 0) return;
    this.cur--;
    const elems = this.ganttElements[this.cur];
    if (elems) {
      elems.forEach(el => el.remove());
      this.ganttElements[this.cur] = null;
    }
    const undoneStep = this.steps[this.cur];
    if (undoneStep.delta) {
      this._undoDelta(undoneStep.delta);
    }
    if (undoneStep.pktTimeline) {
      this.visiblePkts.pop();
    }
    this.pktsRevealed = false;
    for (let i = 0; i < this.cur; i++) {
      if (this.steps[i].showPkts) { this.pktsRevealed = true; break; }
    }
    if (undoneStep.pktStatus) {
      delete this.pktStatuses[undoneStep.pktStatus.pid];
    }
    this.cumVars = {};
    this._pktsData = null;
    this._schedHopsData = null;
    for (let i = 0; i < this.cur; i++) {
      if (this.steps[i].vars) Object.assign(this.cumVars, this.steps[i].vars);
      if (this.steps[i].pktsData) this._pktsData = this.steps[i].pktsData;
      if (this.steps[i].schedHopsData) this._schedHopsData = this.steps[i].schedHopsData;
    }
    const step = this.cur > 0 ? this.steps[this.cur - 1] : null;
    if (step) {
      this._renderVarPanel(this.cumVars, {});
      this._appendDataButtons();
      if (FN_UI[this.fnName].occ) this._updateOccPanel();
      highlightCodeLine(step.lineIdx);
    } else {
      document.getElementById('varPanel').innerHTML = '<span style="color:var(--text3)">Start</span>';
      document.getElementById('occPanel').innerHTML = '';
      highlightCodeLine(-1);
    }
    this._updateStepDesc(step);
    this._updatePktPanel(step);
    this._updateCounter();
    this._updateProgress();
    this._updateGanttUtil();
    this._rebuildTopoQueueState();
  }

  async reset() {
    const fnName = document.getElementById('fnSelect').value;
    const modelKey = document.getElementById('modelSelect').value;
    await this.load(fnName, modelKey);
  }

  _applyDelta(delta) {
    if (!delta) return;
    const { lid, interval } = delta;
    if (!this.linkOcc[lid]) this.linkOcc[lid] = [];
    this.linkOcc[lid].push(interval);
    this.linkOcc[lid].sort((a, b) => a[0] - b[0]);
  }

  _undoDelta(delta) {
    if (!delta) return;
    const { lid, interval } = delta;
    const occ = this.linkOcc[lid];
    if (!occ) return;
    const idx = occ.findIndex(iv => Math.abs(iv[0] - interval[0]) < 0.001 && Math.abs(iv[1] - interval[1]) < 0.001);
    if (idx >= 0) occ.splice(idx, 1);
  }

  _updateGanttUtil() {
    if (!this.tl || !this.tl.utilG) return;
    const ct = this.model.cycle_time_us;
    const occ = this.linkOcc;
    this.tl.utilG.selectAll('text[data-lid]').each(function () {
      const lid = this.getAttribute('data-lid');
      const intervals = occ[lid];
      let used = 0;
      if (intervals) for (const [s, e] of intervals) used += (e - s);
      this.textContent = (used / ct * 100).toFixed(1) + '%';
    });
  }

  _exec(step, prevStep) {
    highlightCodeLine(step.lineIdx);
    this._updateStepDesc(step);

    const prevCum = { ...this.cumVars };
    if (step.vars) {
      Object.assign(this.cumVars, step.vars);
    }
    this._renderVarPanel(this.cumVars, prevCum);

    const varPanel = document.getElementById('varPanel');
    if (step.gcl) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      btn.style.cssText = 'margin-top:8px;padding:4px 12px;font-size:0.75rem;';
      btn.textContent = 'View GCL';
      btn.onclick = () => {
        const w = window.open('', '_blank');
        w.document.write('<pre>' + JSON.stringify(step.gcl, null, 2) + '</pre>');
        w.document.title = 'GCL Data';
      };
      varPanel.appendChild(btn);
    }
    if (step.packetRows) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      btn.style.cssText = 'margin-top:8px;margin-left:6px;padding:4px 12px;font-size:0.75rem;';
      btn.textContent = 'View packetRows';
      btn.onclick = () => {
        const w = window.open('', '_blank');
        w.document.write('<pre>' + JSON.stringify(step.packetRows, null, 2) + '</pre>');
        w.document.title = 'packetRows Data';
      };
      varPanel.appendChild(btn);
    }
    if (step.pktsData) this._pktsData = step.pktsData;
    if (step.schedHopsData) this._schedHopsData = step.schedHopsData;
    if (step.modelData) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      btn.style.cssText = 'margin-top:8px;margin-left:6px;padding:4px 12px;font-size:0.75rem;';
      btn.textContent = 'View model';
      btn.onclick = () => {
        const w = window.open('', '_blank');
        w.document.write('<pre>' + JSON.stringify(step.modelData, null, 2) + '</pre>');
        w.document.title = 'model Data';
      };
      varPanel.appendChild(btn);
    }
    if (this._pktsData) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      btn.style.cssText = 'margin-top:8px;margin-left:6px;padding:4px 12px;font-size:0.75rem;';
      btn.textContent = 'View pkts';
      btn.onclick = () => this._openDataWindow('pkts', this._pktsData);
      varPanel.appendChild(btn);
    }
    if (this._schedHopsData) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      btn.style.cssText = 'margin-top:8px;margin-left:6px;padding:4px 12px;font-size:0.75rem;';
      btn.textContent = 'View schedHops';
      btn.onclick = () => this._openDataWindow('schedHops', this._schedHopsData);
      varPanel.appendChild(btn);
    }

    if (FN_UI[this.fnName].occ) {
      this._updateOccPanel();
    }

    if (step.delta) {
      this._applyDelta(step.delta);
      this._updateGanttUtil();
    }

    if (step.gantt && this.tl) {
      const elems = this._animPlace(step.gantt);
      this.ganttElements[this.cur] = elems;
    }

    if (step.pktTimeline) {
      this.visiblePkts.push(step.pktTimeline);
      if (this.tl) {
        const elems = this._animPktTimeline(step.pktTimeline);
        this.ganttElements[this.cur] = elems;
      }
    }

    if (step.showPkts) {
      this.pktsRevealed = true;
    }

    if (step.pktStatus) {
      this.pktStatuses[step.pktStatus.pid] = step.pktStatus;
    }

    this._updatePktPanel(step);
    this._updateTopoForStep(step);
  }

  _renderVarPanel(cumVars, prevCum) {
    const panel = document.getElementById('varPanel');
    if (!cumVars || Object.keys(cumVars).length === 0) { panel.innerHTML = ''; return; }
    let html = '';
    for (const [k, v] of Object.entries(cumVars)) {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
      const display = val.length > 600 ? val.substring(0, 597) + '<span class="truncated">...</span>' : val;
      const prevVal = prevCum[k];
      const changed = prevVal === undefined || String(prevVal) !== String(v);
      html += `<div class="var-row ${changed ? 'changed' : ''}"><span class="var-name">${k}</span><span class="var-val">${display}</span></div>`;
    }
    panel.innerHTML = html;
  }

  _openDataWindow(title, data) {
    const json = JSON.stringify(data, null, 2);
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { margin:0; background:#1e1e2e; color:#cdd6f4; font-family:'Fira Code',monospace; font-size:13px; }
  .toolbar { position:sticky; top:0; background:#313244; padding:8px 16px; display:flex; align-items:center; gap:12px; border-bottom:1px solid #45475a; }
  .toolbar h2 { margin:0; font-size:15px; color:#89b4fa; }
  .toolbar span { color:#a6adc8; font-size:12px; }
  .toolbar button { background:#89b4fa; color:#1e1e2e; border:none; padding:4px 14px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:600; }
  .toolbar button:hover { background:#74c7ec; }
  pre { margin:0; padding:16px; white-space:pre-wrap; word-break:break-all; line-height:1.5; }
</style></head><body>
<div class="toolbar">
  <h2>${title}</h2>
  <span>${Array.isArray(data) ? data.length + ' items' : typeof data}</span>
  <button onclick="navigator.clipboard.writeText(document.querySelector('pre').textContent)">Copy</button>
</div>
<pre>${json.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre>
</body></html>`);
    w.document.close();
  }

  _appendDataButtons() {
    const varPanel = document.getElementById('varPanel');
    if (this._pktsData) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      btn.style.cssText = 'margin-top:8px;margin-left:6px;padding:4px 12px;font-size:0.75rem;';
      btn.textContent = 'View pkts';
      btn.onclick = () => this._openDataWindow('pkts', this._pktsData);
      varPanel.appendChild(btn);
    }
    if (this._schedHopsData) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      btn.style.cssText = 'margin-top:8px;margin-left:6px;padding:4px 12px;font-size:0.75rem;';
      btn.textContent = 'View schedHops';
      btn.onclick = () => this._openDataWindow('schedHops', this._schedHopsData);
      varPanel.appendChild(btn);
    }
  }

  _updateOccPanel() {
    const panel = document.getElementById('occPanel');
    const occ = this.linkOcc;
    const model = this.model;

    const activeOcc = Object.entries(occ).filter(([, v]) => v.length > 0);
    if (activeOcc.length === 0) {
      panel.innerHTML = '<span style="color:var(--text3);font-size:0.72rem;">No link occupancy yet</span>';
      return;
    }

    let html = '';
    for (const [lid, intervals] of activeOcc) {
      const lnk = model.links.find(l => l.id === lid);
      const label = lnk ? `${lnk.from}\u2192${lnk.to}` : lid;
      let used = 0;
      for (const [s, e] of intervals) used += (e - s);
      const pct = round3(used / model.cycle_time_us * 100);
      let segs = '';
      for (const [s, e] of intervals) {
        const left = (s / model.cycle_time_us * 100);
        const width = ((e - s) / model.cycle_time_us * 100);
        segs += `<div class="occ-seg" style="left:${left}%;width:${Math.max(width, 0.3)}%;background:var(--blue);opacity:0.7;"></div>`;
      }
      html += `<div class="occ-row"><span class="occ-label" title="${lid}">${label}</span><div class="occ-bar-bg">${segs}</div><span class="occ-pct">${pct}%</span></div>`;
    }
    panel.innerHTML = html;
  }

  _updatePktPanel(step) {
    const panel = document.getElementById('pktPanel');
    const pkts = this.fnName === 'expandPackets' ? this.visiblePkts : this.pkts;
    if (!FN_UI[this.fnName].pkt || !pkts.length) { panel.innerHTML = ''; return; }
    if ((this.fnName === 'solveGreedy' || this.fnName === 'solveILP') && !this.pktsRevealed) { panel.innerHTML = ''; return; }
    const currentPid = step?.pktTimeline?.pid || step?.vars?.pid || null;
    let html = '';
    for (const pk of pkts) {
      const st = this.pktStatuses[pk.pid];
      let cls = 'waiting';
      let label = pk.pid.replace('#', '.');
      if (st) {
        cls = st.status === 'OK' ? 'done-ok' : st.status === 'MISS' ? 'done-miss' : 'done-nonst';
      } else if (pk.pid === currentPid) {
        cls = 'current';
      }
      html += `<span class="pkt-chip ${cls}" title="${pk.pid}">${label}</span>`;
    }
    panel.innerHTML = html;
  }

  _updateStepDesc(step) {
    const el = document.getElementById('stepDesc');
    if (!step) {
      el.innerHTML = `Select a function and press &#9654; Play or Next to start &ensp;|&ensp; Space: play/pause &middot; &larr;&rarr;: step &middot; R: reset`;
      return;
    }
    const badgeCls = {
      generateKPaths: 'kpaths', expandPackets: 'expand',
      solveGreedy: 'greedy', solveILP: 'ilp', buildResult: 'build'
    };
    const badge = `<span class="phase-badge ${badgeCls[this.fnName] || ''}">${this.fnName}</span>`;
    el.innerHTML = `${badge} ${step.desc}`;
  }

  _updateCounter() {
    document.getElementById('stepCounter').textContent = `${this.cur} / ${this.steps.length}`;
  }

  _updateProgress() {
    const pct = this.steps.length > 0 ? (this.cur / this.steps.length * 100) : 0;
    document.getElementById('progressFill').style.width = pct + '%';
  }

  _animPlace(g) {
    const tl = this.tl; if (!tl) return [];
    const { x, y, cursor, pktG } = tl;
    const yPos = y(g.lid); if (yPos === undefined) return [];
    const bw = y.bandwidth();
    const spd = this.speed;
    const elems = [];
    const tooltip = document.getElementById('tooltip');

    // GCL entry: flow
    if (g.type === 'flow') {
      const r = pktG.append('rect')
        .attr('x', x(g.s)).attr('y', yPos).attr('width', 0).attr('height', bw)
        .attr('fill', g.color).attr('stroke', 'rgba(255,255,255,0.4)')
        .attr('stroke-width', 0.8).attr('rx', 3).attr('opacity', 0.9)
        .attr('filter', 'url(#pGlow)')
        .style('pointer-events', 'all').style('cursor', 'pointer')
        .on('mouseover', (evt) => {
          tooltip.innerHTML = `<div class="tt-title" style="color:${g.color}">${g.pid}</div>`
            + `<div class="tt-row"><span class="tt-k">Link</span><span class="tt-v">${g.lid}</span></div>`
            + `<div class="tt-row"><span class="tt-k">Start</span><span class="tt-v">${g.s} µs</span></div>`
            + `<div class="tt-row"><span class="tt-k">End</span><span class="tt-v">${g.e} µs</span></div>`
            + `<div class="tt-row"><span class="tt-k">Duration</span><span class="tt-v">${g.dur} µs</span></div>`;
          tooltip.classList.add('show');
        })
        .on('mousemove', (evt) => {
          tooltip.style.left = (evt.clientX + 12) + 'px';
          tooltip.style.top = (evt.clientY - 10) + 'px';
        })
        .on('mouseout', () => { tooltip.classList.remove('show'); });
      r.transition().duration(180 / spd).attr('width', Math.max(x(g.e) - x(g.s), 3));
      setTimeout(() => r.attr('filter', 'none'), 400 / spd);
      elems.push(r.node());

      const pw = x(g.e) - x(g.s);
      if (pw > 30) {
        const lbl = pktG.append('text').attr('class', 'gcl-label')
          .attr('x', x(g.s) + pw / 2).attr('y', yPos + bw / 2)
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
          .attr('opacity', 0).text(g.pid.replace('#', '.'))
          .transition().delay(180 / spd).duration(150 / spd).attr('opacity', 0.8);
        elems.push(pktG.select('text:last-child').node());
      }
      return elems;
    }

    // GCL entry: guard band
    if (g.type === 'guard') {
      const gr = pktG.append('rect')
        .attr('x', x(g.s)).attr('y', yPos).attr('width', 0).attr('height', bw)
        .attr('fill', 'url(#guardHatch)').attr('stroke', '#e8a317')
        .attr('stroke-width', 0.5).attr('rx', 2).attr('opacity', 0.7)
        .style('pointer-events', 'all').style('cursor', 'pointer')
        .on('mouseover', (evt) => {
          tooltip.innerHTML = `<div class="tt-title" style="color:#e8a317">Guard Band</div>`
            + `<div class="tt-row"><span class="tt-k">Link</span><span class="tt-v">${g.lid}</span></div>`
            + `<div class="tt-row"><span class="tt-k">Start</span><span class="tt-v">${g.s} µs</span></div>`
            + `<div class="tt-row"><span class="tt-k">End</span><span class="tt-v">${g.e} µs</span></div>`
            + `<div class="tt-row"><span class="tt-k">Duration</span><span class="tt-v">${g.dur} µs</span></div>`
            + `<div class="tt-row"><span class="tt-k">Before</span><span class="tt-v">${g.before}</span></div>`;
          tooltip.classList.add('show');
        })
        .on('mousemove', (evt) => {
          tooltip.style.left = (evt.clientX + 12) + 'px';
          tooltip.style.top = (evt.clientY - 10) + 'px';
        })
        .on('mouseout', () => { tooltip.classList.remove('show'); });
      gr.transition().duration(120 / spd)
        .attr('width', Math.max(x(g.e) - x(g.s), 1));
      elems.push(gr.node());
      return elems;
    }

    // Packet placement
    cursor.attr('x1', x(g.s)).attr('x2', x(g.s))
      .attr('y1', yPos).attr('y2', yPos + bw)
      .attr('class', 'scan-cursor active');
    setTimeout(() => cursor.attr('class', 'scan-cursor'), 300 / spd);

    const r = pktG.append('rect')
      .attr('x', x(g.s)).attr('y', yPos).attr('width', 0).attr('height', bw)
      .attr('fill', g.color).attr('stroke', 'rgba(255,255,255,0.4)')
      .attr('stroke-width', 0.8).attr('rx', 3).attr('opacity', 0.9)
      .attr('filter', 'url(#pGlow)')
      .style('pointer-events', 'all').style('cursor', 'pointer')
      .on('mouseover', (evt) => {
        const queueLine = g.queue != null && g.queue >= 0
          ? `<div class="tt-row"><span class="tt-k">Queue</span><span class="tt-v">Q${g.queue}</span></div>` : '';
        tooltip.innerHTML = `<div class="tt-title" style="color:${g.color}">${g.pid}</div>`
          + `<div class="tt-row"><span class="tt-k">Link</span><span class="tt-v">${g.lid}</span></div>`
          + `<div class="tt-row"><span class="tt-k">Start</span><span class="tt-v">${g.s} µs</span></div>`
          + `<div class="tt-row"><span class="tt-k">End</span><span class="tt-v">${g.e} µs</span></div>`
          + `<div class="tt-row"><span class="tt-k">Hop</span><span class="tt-v">${g.h + 1} / ${g.nh}</span></div>`
          + queueLine;
        tooltip.classList.add('show');
      })
      .on('mousemove', (evt) => {
        tooltip.style.left = (evt.clientX + 12) + 'px';
        tooltip.style.top = (evt.clientY - 10) + 'px';
      })
      .on('mouseout', () => { tooltip.classList.remove('show'); });
    r.transition().duration(180 / spd).attr('width', Math.max(x(g.e) - x(g.s), 3));
    setTimeout(() => r.attr('filter', 'none'), 400 / spd);
    elems.push(r.node());

    const pw = x(g.e) - x(g.s);
    if (pw > 30) {
      const qSuffix = g.queue != null && g.queue >= 0 ? ` Q${g.queue}` : '';
      const lbl = pktG.append('text').attr('class', 'gcl-label')
        .attr('x', x(g.s) + pw / 2).attr('y', yPos + bw / 2)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
        .attr('opacity', 0).text(g.pid.replace('#', '.') + qSuffix)
        .transition().delay(180 / spd).duration(150 / spd).attr('opacity', 0.8);
      elems.push(pktG.select('text:last-child').node());
    }

    return elems;
  }

  /* ── Packet Timeline Animation (expandPackets) ── */

  _animPktTimeline(data) {
    const tl = this.tl; if (!tl) return [];
    const { x, y, pktG } = tl;
    const yPos = y(data.fid); if (yPos === undefined) return [];
    const bw = y.bandwidth();
    const spd = this.speed;
    const elems = [];

    const xStart = x(data.rel);
    const xEnd = x(data.rel + (data.totalTx || data.period));
    const w = Math.max(xEnd - xStart, 3);

    const pktTooltip = document.getElementById('tooltip');
    const r = pktG.append('rect')
      .attr('x', xStart).attr('y', yPos).attr('width', 0).attr('height', bw)
      .attr('fill', data.color).attr('rx', 3).attr('opacity', 0.85)
      .attr('filter', 'url(#pktGlow)')
      .style('pointer-events', 'all').style('cursor', 'pointer')
      .on('mouseover', () => {
        pktTooltip.innerHTML = `<div class="tt-title" style="color:${data.color}">${data.pid}</div>`
          + `<div class="tt-row"><span class="tt-k">Flow</span><span class="tt-v">${data.fid}</span></div>`
          + `<div class="tt-row"><span class="tt-k">Type</span><span class="tt-v">${data.tsn ? 'TSN' : 'Best Effort'}</span></div>`
          + `<div class="tt-row"><span class="tt-k">Release</span><span class="tt-v">${data.rel} µs</span></div>`
          + `<div class="tt-row"><span class="tt-k">Deadline</span><span class="tt-v">${data.dl != null ? data.dl + ' µs' : 'none'}</span></div>`
          + `<div class="tt-row"><span class="tt-k">Period</span><span class="tt-v">${data.period} µs</span></div>`
          + `<div class="tt-row"><span class="tt-k">Total Tx</span><span class="tt-v">${round3(data.totalTx || 0)} µs</span></div>`;
        pktTooltip.classList.add('show');
      })
      .on('mousemove', (evt) => {
        pktTooltip.style.left = (evt.clientX + 12) + 'px';
        pktTooltip.style.top = (evt.clientY - 10) + 'px';
      })
      .on('mouseout', () => { pktTooltip.classList.remove('show'); });

    if (data.tsn) {
      r.attr('stroke', 'rgba(255,255,255,0.6)').attr('stroke-width', 1.5);
    } else {
      r.attr('stroke', 'rgba(255,255,255,0.35)').attr('stroke-width', 1)
       .attr('stroke-dasharray', '4,2');
    }

    r.transition().duration(200 / spd).attr('width', w);
    setTimeout(() => r.attr('filter', 'none'), 400 / spd);
    elems.push(r.node());

    if (data.dl !== null && data.dl > data.rel) {
      const dlX = x(data.dl);
      if (dlX > xStart) {
        const dlLine = pktG.append('line')
          .attr('x1', dlX).attr('x2', dlX)
          .attr('y1', yPos).attr('y2', yPos + bw)
          .attr('stroke', '#ff5252').attr('stroke-width', 1.2)
          .attr('stroke-dasharray', '3,2')
          .attr('opacity', 0);
        dlLine.transition().delay(200 / spd).duration(150 / spd).attr('opacity', 0.8);
        elems.push(dlLine.node());
      }
    }

    if (w > 22) {
      const numLabel = data.pid.includes('#') ? '#' + data.pid.split('#')[1] : data.pid;
      const lbl = pktG.append('text').attr('class', 'gcl-label')
        .attr('x', xStart + w / 2).attr('y', yPos + bw / 2)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
        .attr('opacity', 0).text(numLabel);
      lbl.transition().delay(200 / spd).duration(150 / spd).attr('opacity', 0.85);
      elems.push(lbl.node());
    }

    return elems;
  }

  /* ── Topology Methods ──────────────────────── */

  _updateTopoForStep(step) {
    if (!this.topoViz) return;
    const fn = this.fnName;

    if (fn === 'generateKPaths') {
      if (step.lineIdx === 4) {
        for (const lid of Object.keys(this.topoViz.linkLines)) {
          const el = this.topoViz.linkLines[lid];
          if (el) d3.select(el).classed('highlight', false);
        }
      }
      if (step.vars?.link) {
        const lineEl = this.topoViz.linkLines[step.vars.link];
        if (lineEl) {
          d3.select(lineEl).classed('highlight', true);
        }
      }
    }

    if ((fn === 'solveGreedy' || fn === 'solveILP' || fn === 'buildResult') && step.gantt) {
      this._animatePacketOnTopo(step.gantt, step.delta);
    }
  }

  _animatePacketOnTopo(gantt, delta) {
    if (!this.topoViz) return;
    const { linkLines, positions, particleG } = this.topoViz;

    const lineEl = linkLines[gantt.lid];
    if (lineEl) {
      d3.select(lineEl).classed('active', true);
      setTimeout(() => d3.select(lineEl).classed('active', false), 800);
    }

    const lnk = this.model.links.find(l => l.id === gantt.lid);
    if (!lnk) return;
    const fromPos = positions[lnk.from];
    const toPos = positions[lnk.to];
    if (!fromPos || !toPos) return;

    const pg = d3.select(particleG);
    const particle = pg.append('circle')
      .attr('class', 'pkt-particle')
      .attr('cx', fromPos.x).attr('cy', fromPos.y)
      .attr('r', 4)
      .attr('fill', gantt.color)
      .attr('opacity', 0.9)
      .attr('filter', 'url(#topoGlow)');
    particle.transition().duration(400).ease(d3.easeQuadInOut)
      .attr('cx', toPos.x).attr('cy', toPos.y)
      .transition().duration(200)
      .attr('opacity', 0)
      .remove();

    if (delta) {
      const fromNode = this.model.nodes.find(n => n.id === lnk.from);
      if (fromNode && fromNode.type === 'switch') {
        this._updateSwitchQueue(lnk.from, lnk.id, gantt.queue, gantt.color, true);
      }
    }
  }

  _updateSwitchQueue(swId, linkId, assignedQueue, color, isAdd) {
    if (!this.topoViz || !this.topoViz.queueData[swId]) return;
    const portQueues = this.topoViz.queueData[swId][linkId];
    if (!portQueues) return;

    // 동적 큐 할당: assignedQueue가 유효하면 사용, 아니면 무시
    const qIdx = assignedQueue != null && assignedQueue >= 0 ? assignedQueue : -1;

    if (qIdx >= 0 && qIdx < portQueues.length) {
      const cell = d3.select(portQueues[qIdx]);
      if (isAdd) {
        cell.attr('fill', color)
          .classed('open', false).classed('closed', false)
          .classed('pulse', true);
        setTimeout(() => cell.classed('pulse', false), 500);
      } else {
        cell.attr('fill', null)
          .classed('open', true).classed('closed', false);
      }
    }
  }

  _highlightTopoLink(linkId) {
    if (!this.topoViz) return;
    const lineEl = this.topoViz.linkLines[linkId];
    if (lineEl) {
      d3.select(lineEl).classed('highlight', true);
    }
  }

  _resetTopoHighlights() {
    if (!this.topoViz) return;
    for (const lid of Object.keys(this.topoViz.linkLines)) {
      const el = this.topoViz.linkLines[lid];
      if (el) d3.select(el).classed('highlight', false).classed('active', false);
    }
    for (const swId of Object.keys(this.topoViz.queueData)) {
      for (const linkId of Object.keys(this.topoViz.queueData[swId])) {
        const cells = this.topoViz.queueData[swId][linkId];
        for (const cell of cells) {
          d3.select(cell).attr('fill', null).classed('open', true).classed('closed', false);
        }
      }
    }
    d3.select(this.topoViz.particleG).selectAll('.pkt-particle').remove();
  }

  _rebuildTopoQueueState() {
    if (!this.topoViz) return;
    this._resetTopoHighlights();
    for (let i = 0; i < this.cur; i++) {
      const s = this.steps[i];
      if (s.gantt && s.delta) {
        const lnk = this.model.links.find(l => l.id === s.gantt.lid);
        if (lnk) {
          const fromNode = this.model.nodes.find(n => n.id === lnk.from);
          if (fromNode && fromNode.type === 'switch') {
            this._updateSwitchQueue(lnk.from, lnk.id, s.gantt.queue, s.gantt.color, true);
          }
        }
      }
      if (this.fnName === 'generateKPaths') {
        if (s.lineIdx === 4) {
          for (const lid of Object.keys(this.topoViz.linkLines)) {
            const el = this.topoViz.linkLines[lid];
            if (el) d3.select(el).classed('highlight', false);
          }
        }
        if (s.vars?.link) {
          const lineEl = this.topoViz.linkLines[s.vars.link];
          if (lineEl) d3.select(lineEl).classed('highlight', true);
        }
      }
    }
  }
}

/* ═══════════════════════════════════════════════
   INITIALIZATION
   ═══════════════════════════════════════════════ */
export function initDebugger() {
  initTooltip();

  const ctrl = new DebugController();
  const initFn = document.getElementById('fnSelect').value || 'solveGreedy';
  const initModel = document.getElementById('modelSelect').value || 'standard';
  ctrl.load(initFn, initModel);

  // Controls
  document.getElementById('btnPlay').addEventListener('click', () => ctrl.toggle());
  document.getElementById('btnPause').addEventListener('click', () => ctrl.pause());
  document.getElementById('btnPrev').addEventListener('click', () => ctrl.stepBack());
  document.getElementById('btnNext').addEventListener('click', () => ctrl.stepFwd());
  document.getElementById('btnReset').addEventListener('click', () => ctrl.reset());

  document.getElementById('speedSlider').addEventListener('input', e => {
    ctrl.speed = parseFloat(e.target.value);
    document.getElementById('speedLabel').innerHTML = ctrl.speed + '&times;';
  });

  document.getElementById('fnSelect').addEventListener('change', () => ctrl.reset());
  document.getElementById('modelSelect').addEventListener('change', () => ctrl.reset());
  document.getElementById('flowSelect').addEventListener('change', () => {
    if (document.getElementById('fnSelect').value === 'generateKPaths') ctrl.reset();
  });
  document.getElementById('solverSelect').addEventListener('change', () => {
    if (document.getElementById('fnSelect').value === 'buildResult') ctrl.reset();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === ' ') { e.preventDefault(); ctrl.toggle(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); ctrl.stepFwd(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); ctrl.stepBack(); }
    else if (e.key === 'r' || e.key === 'R') ctrl.reset();
  });
}
