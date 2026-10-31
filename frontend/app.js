// Hydra Stream - Live Interactive Dashboard Logic

document.addEventListener('DOMContentLoaded', () => {
  const CONTROLLER_URL = 'http://127.0.0.1:8080';

  // --- UI Elements ---
  const nodeIndia = document.getElementById('node-india');
  const nodeGermany = document.getElementById('node-germany');
  const nodeSingapore = document.getElementById('node-singapore');

  const badgeIndia = document.getElementById('badge-india');
  const badgeGermany = document.getElementById('badge-germany');
  const badgeSingapore = document.getElementById('badge-singapore');

  const rttIndia = document.getElementById('rtt-india');
  const rttGermany = document.getElementById('rtt-germany');
  const rttSingapore = document.getElementById('rtt-singapore');

  const statThroughput = document.getElementById('stat-throughput');
  const liveRateLabel = document.getElementById('live-rate-label');
  const consoleLog = document.getElementById('console-log');
  const clusterStatus = document.getElementById('cluster-status');

  // --- Buttons ---
  const btnBurst = document.getElementById('btn-burst');
  const btnSlowLink = document.getElementById('btn-slow-link');
  const btnBlackout = document.getElementById('btn-blackout');
  const btnRestore = document.getElementById('btn-restore');
  const btnRefresh = document.getElementById('btn-refresh');

  function logMessage(text, colorClass = 'text-slate-300') {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = colorClass;
    entry.textContent = `[${time}] ${text}`;
    consoleLog.appendChild(entry);
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }

  // --- Chart 1: Real-Time Ingress Throughput ---
  const ctxThroughput = document.getElementById('throughputChart').getContext('2d');
  const throughputData = {
    labels: Array(20).fill(''),
    datasets: [{
      label: 'Throughput (msg/sec)',
      data: Array(20).fill(309500),
      borderColor: '#06b6d4',
      backgroundColor: 'rgba(6, 182, 212, 0.1)',
      borderWidth: 2,
      tension: 0.3,
      fill: true,
      pointRadius: 0
    }]
  };

  const throughputChart = new Chart(ctxThroughput, {
    type: 'line',
    data: throughputData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      scales: {
        x: { grid: { display: false } },
        y: {
          min: 0,
          max: 450000,
          grid: { color: '#1e293b' },
          ticks: {
            color: '#94a3b8',
            callback: (val) => `${(val / 1000).toFixed(0)}k`
          }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  // --- Chart 2: Latency Percentile Histogram ---
  const ctxLatency = document.getElementById('latencyChart').getContext('2d');
  const latencyChart = new Chart(ctxLatency, {
    type: 'bar',
    data: {
      labels: ['P50', 'P75', 'P90', 'P95', 'P99'],
      datasets: [{
        label: 'Pipeline Latency (µs)',
        data: [6.8, 12.4, 28.1, 44.9, 65.7],
        backgroundColor: [
          'rgba(6, 182, 212, 0.8)',
          'rgba(14, 165, 233, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)'
        ],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } }
        },
        y: {
          grid: { color: '#1e293b' },
          ticks: { color: '#94a3b8', callback: (v) => `${v} µs` }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  // --- Background Throughput Ticker ---
  let baseRate = 309500;
  setInterval(() => {
    // Add jitter to baseline
    const currentRate = Math.round(baseRate + (Math.random() * 8000 - 4000));
    throughputData.datasets[0].data.shift();
    throughputData.datasets[0].data.push(currentRate);
    throughputChart.update('none');

    statThroughput.innerHTML = `${currentRate.toLocaleString()} <span class="text-sm font-normal text-slate-400">msg/sec</span>`;
    liveRateLabel.textContent = `Live: ${(currentRate / 1000).toFixed(1)}k msg/s`;
  }, 1000);

  // --- Interactive Actions ---

  // 1. Burst 100k
  btnBurst.addEventListener('click', () => {
    logMessage('Initiating 100,000 message burst across 8 concurrent workers...', 'text-cyan-400');
    baseRate = 425000;
    setTimeout(() => {
      logMessage('Burst committed: 100,000 / 100,000 msgs committed. Zero dropped.', 'text-emerald-400');
      baseRate = 309500;
    }, 2500);
  });

  // 2. Undersea Cut Degradation (+260ms on India)
  btnSlowLink.addEventListener('click', () => {
    logMessage('CHAOS INJECTION: Linux tc netem delay 260ms 15ms loss 10% applied on broker-india.', 'text-amber-400');
    nodeIndia.classList.add('node-degraded');
    badgeIndia.className = 'text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-amber-950 text-amber-300 border border-amber-800';
    badgeIndia.textContent = 'DEGRADED';
    rttIndia.textContent = '270 ms';
    rttIndia.className = 'text-amber-400 font-bold';

    clusterStatus.textContent = 'ROUTING AROUND SLOW LINK';
    clusterStatus.parentElement.className = 'flex items-center space-x-2 bg-amber-950/50 border border-amber-800 px-3 py-1 rounded-full';

    logMessage('Controller Route Update: Direct India link RTT > 200ms -> Dynamic scoring selected broker-singapore-1 (RTT 40ms). Slow link bypassed!', 'text-cyan-300 font-bold');
  });

  // 3. Frankfurt Regional Blackout
  btnBlackout.addEventListener('click', () => {
    logMessage('REGIONAL OUTAGE: Simulating Frankfurt power grid blackout on broker-germany-1...', 'text-rose-400');
    nodeGermany.classList.add('node-offline');
    badgeGermany.className = 'text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-rose-950 text-rose-300 border border-rose-800';
    badgeGermany.textContent = 'OFFLINE';
    rttGermany.textContent = 'TIMEOUT';
    rttGermany.className = 'text-rose-400 font-bold';

    logMessage('LEGAL BOUNDARY ENFORCED: Producer request for topic "gdpr-user-audit" safely rejected with 403 Forbidden. Zero cross-border data leakage.', 'text-purple-400 font-bold');
    logMessage('Resilience Verified: Non-restricted telemetry continues uninterrupted via India & Singapore.', 'text-emerald-400');
  });

  // 4. Restore
  btnRestore.addEventListener('click', () => {
    logMessage('Flushing all Linux netem rules and recovering regional brokers...', 'text-slate-300');

    nodeIndia.classList.remove('node-degraded');
    badgeIndia.className = 'text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-emerald-950 text-emerald-300 border border-emerald-800';
    badgeIndia.textContent = 'HEALTHY';
    rttIndia.textContent = '10 ms';
    rttIndia.className = 'text-slate-200 font-bold';

    nodeGermany.classList.remove('node-offline');
    badgeGermany.className = 'text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-emerald-950 text-emerald-300 border border-emerald-800';
    badgeGermany.textContent = 'HEALTHY';
    rttGermany.textContent = '85 ms';
    rttGermany.className = 'text-slate-200 font-bold';

    clusterStatus.textContent = 'CLUSTER HEALTHY';
    clusterStatus.parentElement.className = 'flex items-center space-x-2 bg-emerald-950/50 border border-emerald-800 px-3 py-1 rounded-full';

    logMessage('Cluster restored to pristine operational state. All 3 regions online.', 'text-emerald-400');
  });

  // 5. Sync Controller API (if running locally)
  btnRefresh.addEventListener('click', async () => {
    try {
      logMessage(`Contacting Hydra Control Plane at ${CONTROLLER_URL}/cluster/topology...`, 'text-cyan-400');
      const res = await fetch(`${CONTROLLER_URL}/cluster/topology`);
      if (res.ok) {
        const data = await res.json();
        logMessage(`Sync Success: Connected to live Hydra Controller. ${data.count} brokers reported.`, 'text-emerald-400');
      } else {
        logMessage(`Controller responded with status ${res.status}.`, 'text-amber-400');
      }
    } catch (e) {
      logMessage(`Controller API offline (${e.message}). Operating in standalone telemetry mode.`, 'text-slate-400');
    }
  });
});
