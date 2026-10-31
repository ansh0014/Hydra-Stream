/**
 * Hydra Stream - Chaos Engine & Simulation Control
 * Orchestrates live fault-injections, netem slow-link simulations,
 * and quorum split recovery for hackathon demonstrations.
 */

class ChaosEngine {
  constructor(apiAdapter) {
    this.api = apiAdapter;
    this.init();
  }

  init() {
    this.bindButtons();
    this.setupRouteTester();
    this.setupConsoleLogger();
  }

  bindButtons() {
    const btnSlowLink = document.getElementById('btn-slow-link');
    const btnBlackout = document.getElementById('btn-blackout');
    const btnBurst = document.getElementById('btn-burst');
    const btnRestore = document.getElementById('btn-restore');

    if (btnSlowLink) {
      btnSlowLink.addEventListener('click', () => {
        this.api.injectSlowLink();
        this.updateButtonsState('slow-link');
      });
    }

    if (btnBlackout) {
      btnBlackout.addEventListener('click', () => {
        this.api.injectBlackout();
        this.updateButtonsState('blackout');
      });
    }

    if (btnBurst) {
      btnBurst.addEventListener('click', () => {
        this.api.emitBurst();
      });
    }

    if (btnRestore) {
      btnRestore.addEventListener('click', () => {
        this.api.restoreNormal();
        this.updateButtonsState('normal');
      });
    }
  }

  updateButtonsState(activeScenario) {
    const btnSlowLink = document.getElementById('btn-slow-link');
    const btnBlackout = document.getElementById('btn-blackout');

    if (btnSlowLink) {
      if (activeScenario === 'slow-link') {
        btnSlowLink.classList.add('ring-2', 'ring-amber-400', 'shadow-[0_0_15px_rgba(245,158,11,0.5)]');
      } else {
        btnSlowLink.classList.remove('ring-2', 'ring-amber-400', 'shadow-[0_0_15px_rgba(245,158,11,0.5)]');
      }
    }

    if (btnBlackout) {
      if (activeScenario === 'blackout') {
        btnBlackout.classList.add('ring-2', 'ring-rose-500', 'shadow-[0_0_15px_rgba(239,68,68,0.5)]');
      } else {
        btnBlackout.classList.remove('ring-2', 'ring-rose-500', 'shadow-[0_0_15px_rgba(239,68,68,0.5)]');
      }
    }
  }

  setupRouteTester() {
    const btnTestRoute = document.getElementById('btn-test-route');
    const selTopic = document.getElementById('test-route-topic');
    const selClientRegion = document.getElementById('test-route-client');
    const resBox = document.getElementById('test-route-result');

    if (!btnTestRoute || !selTopic || !resBox) return;

    btnTestRoute.addEventListener('click', () => {
      const topic = selTopic.value;
      const clientRegion = selClientRegion ? selClientRegion.value : 'India';

      const decision = this.api.resolveRoute(topic, clientRegion);

      if (!decision.success) {
        resBox.className = 'mt-3 p-3.5 rounded-lg border border-purple-800 bg-purple-950/70 text-xs font-mono text-purple-200';
        resBox.innerHTML = `
          <div class="flex items-center gap-2 text-rose-300 font-bold">
            <span>🛡️</span> ${decision.error}
          </div>
          <div class="mt-1 text-[11px] text-purple-300">
            <strong>Policy Reason:</strong> Legal residency requires '${decision.requiredRegion}'. No cross-border spillover permitted under UN SDG 9.1 compliance rules.
          </div>
        `;
        resBox.classList.remove('hidden');
        return;
      }

      let badgeBypass = decision.isBypassingSlowLink 
        ? `<span class="bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded text-[10px]">⚡ BYPASS ACTIVE</span>`
        : `<span class="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded text-[10px]">DIRECT OPTIMAL</span>`;

      resBox.className = 'mt-3 p-3.5 rounded-lg border border-cyan-800 bg-cyan-950/50 text-xs font-mono text-cyan-200';
      resBox.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="font-bold text-white">Route Resolved by Hydra Controller</span>
          ${badgeBypass}
        </div>
        <div class="mt-2 space-y-1 text-[11px]">
          <div>Target Broker: <strong class="text-cyan-300">${decision.assignedBrokerId}</strong> (${decision.region})</div>
          <div>Endpoint: <span class="text-slate-300">${decision.assignedEndpoint}</span></div>
          <div>Routing Score: <span class="text-emerald-400 font-bold">${decision.score.toFixed(2)}</span></div>
          <div class="text-slate-400 mt-1">Logic: ${decision.reason}</div>
        </div>
      `;
      resBox.classList.remove('hidden');
    });
  }

  setupConsoleLogger() {
    const consoleEl = document.getElementById('console-log');
    if (!consoleEl) return;

    this.api.on('event', (evt) => {
      let colorClass = 'text-slate-300';
      if (evt.level === 'warn') colorClass = 'text-amber-400';
      else if (evt.level === 'error') colorClass = 'text-rose-400';
      else if (evt.level === 'success') colorClass = 'text-emerald-400';

      const row = document.createElement('div');
      row.className = `${colorClass} text-[11px] font-mono leading-relaxed`;
      row.innerHTML = `<span class="text-slate-500">[${evt.timestamp}]</span> <span class="font-bold text-slate-400">[${evt.category}]</span> ${evt.message}`;

      consoleEl.prepend(row);
      if (consoleEl.children.length > 80) {
        consoleEl.removeChild(consoleEl.lastChild);
      }
    });
  }
}

window.ChaosEngine = ChaosEngine;

