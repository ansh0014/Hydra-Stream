/**
 * Hydra Stream - Main Application Controller
 * Orchestrates navigation, views, simulation lifecycle,
 * and high-level enterprise UI interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
  const api = window.hydraApi;

  // Initialize Sub-Engines
  const mapEngine = new window.HydraMapEngine('worldTopologyCanvas', api);
  const kafkaExplorer = new window.KafkaExplorer(api);
  const chaosEngine = new window.ChaosEngine(api);
  const chartsTelemetry = new window.HydraChartsTelemetry(api);

  window.kafkaExplorer = kafkaExplorer;
  window.mapEngine = mapEngine;

  // --- Navigation Tabs ---
  const navTabs = document.querySelectorAll('.nav-tab');
  const viewSections = document.querySelectorAll('.view-section');

  function switchTab(targetViewId) {
    navTabs.forEach(tab => {
      if (tab.dataset.target === targetViewId) {
        tab.classList.add('bg-cyan-500/10', 'text-cyan-400', 'border-cyan-500/50');
        tab.classList.remove('text-slate-400', 'border-transparent');
      } else {
        tab.classList.remove('bg-cyan-500/10', 'text-cyan-400', 'border-cyan-500/50');
        tab.classList.add('text-slate-400', 'border-transparent');
      }
    });

    viewSections.forEach(sec => {
      if (sec.id === targetViewId) {
        sec.classList.remove('hidden');
        if (targetViewId === 'view-mission-control') {
          setTimeout(() => mapEngine.handleResize(), 50);
        }
      } else {
        sec.classList.add('hidden');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.target));
  });

  // Top action buttons from landing page to launch console
  document.querySelectorAll('.btn-launch-console').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('view-mission-control');
    });
  });

  // --- UI Reactive State Binding ---
  api.on('stateChange', (state) => {
    updateClusterHUD(state);
    updateRegionalCards(state);
  });

  function updateClusterHUD(state) {
    const clusterStatus = document.getElementById('cluster-status');
    const clusterStatusDot = document.getElementById('cluster-status-dot');
    const totalMsgsCounter = document.getElementById('hud-total-messages');
    const gdprCounter = document.getElementById('hud-gdpr-prevented');

    if (totalMsgsCounter) {
      totalMsgsCounter.textContent = state.totalMessages.toLocaleString();
    }
    if (gdprCounter) {
      gdprCounter.textContent = `${state.gdprViolationsPrevented} Prevented`;
    }

    if (clusterStatus) {
      if (state.clusterHealth === 'HEALTHY') {
        clusterStatus.textContent = 'CLUSTER HEALTHY';
        clusterStatus.className = 'text-xs font-mono text-emerald-300 font-medium';
        if (clusterStatusDot) clusterStatusDot.className = 'h-2 w-2 rounded-full bg-emerald-400 animate-pulse';
      } else if (state.clusterHealth === 'DEGRADED') {
        clusterStatus.textContent = 'LINK DEGRADED (BYPASS ACTIVE)';
        clusterStatus.className = 'text-xs font-mono text-amber-300 font-medium';
        if (clusterStatusDot) clusterStatusDot.className = 'h-2 w-2 rounded-full bg-amber-400 animate-ping';
      } else if (state.clusterHealth === 'LOCAL_QUORUM') {
        clusterStatus.textContent = 'AUTONOMOUS LOCAL QUORUM';
        clusterStatus.className = 'text-xs font-mono text-rose-300 font-medium';
        if (clusterStatusDot) clusterStatusDot.className = 'h-2 w-2 rounded-full bg-rose-500 animate-ping';
      }
    }
  }

  function updateRegionalCards(state) {
    const updateCard = (regionKey, badgeId, rttId, nodeId) => {
      const reg = state.regions[regionKey];
      const badge = document.getElementById(badgeId);
      const rtt = document.getElementById(rttId);
      const node = document.getElementById(nodeId);

      if (rtt) rtt.textContent = reg.status === 'OFFLINE' ? 'OFFLINE' : `${reg.rtt} ms`;

      if (badge && node) {
        if (reg.status === 'HEALTHY') {
          badge.textContent = 'HEALTHY';
          badge.className = 'text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-emerald-950 text-emerald-300 border border-emerald-800';
          node.classList.remove('node-degraded', 'node-offline');
        } else if (reg.status === 'DEGRADED') {
          badge.textContent = 'DEGRADED';
          badge.className = 'text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-amber-950 text-amber-300 border border-amber-800';
          node.classList.add('node-degraded');
          node.classList.remove('node-offline');
        } else if (reg.status === 'OFFLINE') {
          badge.textContent = 'OFFLINE';
          badge.className = 'text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-rose-950 text-rose-300 border border-rose-800';
          node.classList.add('node-offline');
          node.classList.remove('node-degraded');
        }
      }
    };

    updateCard('india', 'badge-india', 'rtt-india', 'node-india');
    updateCard('germany', 'badge-germany', 'rtt-germany', 'node-germany');
    updateCard('singapore', 'badge-singapore', 'rtt-singapore', 'node-singapore');
  }

  // Sync Controller Button
  const btnRefresh = document.getElementById('btn-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.innerHTML = '<span>Checking Controller...</span>';
      const isOnline = await api.checkBackendConnectivity();
      setTimeout(() => {
        if (isOnline) {
          btnRefresh.innerHTML = '<span class="text-emerald-400">● Live Backend Sync</span>';
          api.logEvent('Sync', 'Synchronized live cluster topology with Go Control Plane.', 'success');
        } else {
          btnRefresh.innerHTML = '<span class="text-cyan-400">● Standalone Engine</span>';
          api.logEvent('Sync', 'Backend offline. Operating in high-fidelity standalone demo mode.', 'info');
        }
      }, 500);
    });
  }

  // Initial tab set to Landing Page for high-impact first impression
  switchTab('view-landing');
});

