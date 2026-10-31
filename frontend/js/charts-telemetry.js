/**
 * Hydra Stream - Charts & Real-Time Observability
 * Handles live Prometheus-style metrics, rolling throughput sparklines,
 * and microsecond latency percentile histograms.
 */

class HydraChartsTelemetry {
  constructor(apiAdapter) {
    this.api = apiAdapter;
    this.throughputChart = null;
    this.latencyChart = null;
    this.init();
  }

  init() {
    this.initThroughputChart();
    this.initLatencyChart();
    this.startLiveTick();
  }

  initThroughputChart() {
    const canvas = document.getElementById('throughputChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

    this.throughputData = {
      labels: Array(25).fill(''),
      datasets: [{
        label: 'Ingress Throughput (msg/sec)',
        data: Array(25).fill(309500),
        borderColor: '#06b6d4',
        borderWidth: 2,
        backgroundColor: gradient,
        tension: 0.3,
        fill: true,
        pointRadius: 0
      }]
    };

    this.throughputChart = new Chart(ctx, {
      type: 'line',
      data: this.throughputData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        scales: {
          x: { grid: { display: false } },
          y: {
            min: 0,
            max: 420000,
            grid: { color: 'rgba(30, 41, 59, 0.6)' },
            ticks: {
              color: '#94a3b8',
              font: { family: "'JetBrains Mono', monospace", size: 10 },
              callback: (val) => `${(val / 1000).toFixed(0)}k`
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y.toLocaleString()} msg/sec`
            }
          }
        }
      }
    });
  }

  initLatencyChart() {
    const canvas = document.getElementById('latencyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    this.latencyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['P50 (RingBuffer)', 'P50 (Pipe)', 'P75', 'P90', 'P95', 'P99'],
        datasets: [{
          label: 'Latency (µs)',
          data: [0.20, 6.8, 12.4, 28.1, 44.9, 65.7],
          backgroundColor: [
            'rgba(16, 185, 129, 0.85)',
            'rgba(6, 182, 212, 0.85)',
            'rgba(14, 165, 233, 0.85)',
            'rgba(59, 130, 246, 0.85)',
            'rgba(245, 158, 11, 0.85)',
            'rgba(239, 68, 68, 0.85)'
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
            ticks: {
              color: '#cbd5e1',
              font: { family: "'JetBrains Mono', monospace", size: 10 }
            }
          },
          y: {
            grid: { color: 'rgba(30, 41, 59, 0.6)' },
            ticks: {
              color: '#94a3b8',
              font: { family: "'JetBrains Mono', monospace", size: 10 },
              callback: (val) => `${val} µs`
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y} microseconds`
            }
          }
        }
      }
    });
  }

  startLiveTick() {
    setInterval(() => {
      if (!this.throughputChart) return;

      const baseRate = this.api.state.throughput;
      const jitter = (Math.random() * 8000 - 4000);
      const currentRate = Math.max(50000, Math.round(baseRate + jitter));

      this.throughputData.datasets[0].data.shift();
      this.throughputData.datasets[0].data.push(currentRate);
      this.throughputChart.update('none');

      const liveRateLabel = document.getElementById('live-rate-label');
      if (liveRateLabel) {
        liveRateLabel.textContent = `Live: ${(currentRate / 1000).toFixed(1)}k msg/s`;
      }

      const statThroughput = document.getElementById('stat-throughput');
      if (statThroughput) {
        statThroughput.innerHTML = `${currentRate.toLocaleString()} <span class="text-sm font-normal text-slate-400">msg/sec</span>`;
      }
    }, 1000);
  }
}

window.HydraChartsTelemetry = HydraChartsTelemetry;

