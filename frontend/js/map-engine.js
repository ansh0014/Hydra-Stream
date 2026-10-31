/**
 * Hydra Stream Map Engine
 * Mapbox-style high-performance Canvas 2D/3D Geospatial Topology Visualizer.
 * Renders regional nodes, animated bezier particle arcs, and real-time link health.
 */

class HydraMapEngine {
  constructor(canvasId, apiAdapter) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.api = apiAdapter;

    // Viewport / Projection
    this.width = this.canvas.width = this.canvas.parentElement.clientWidth;
    this.height = this.canvas.height = this.canvas.parentElement.clientHeight || 420;

    this.particles = [];
    this.hoveredNode = null;
    this.selectedNode = null;

    // Node screen positions calculated by Mercator projection
    this.nodePositions = {};

    this.init();
  }

  init() {
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
    this.setupInteractivity();
    this.initParticles();
    this.animate();

    this.api.on('stateChange', () => {
      // Re-render when regional health updates
    });
  }

  handleResize() {
    if (!this.canvas || !this.canvas.parentElement) return;
    this.width = this.canvas.width = this.canvas.parentElement.clientWidth;
    this.height = this.canvas.height = this.canvas.parentElement.clientHeight || 420;
    this.calculateNodePositions();
  }

  // Geographic coordinates to canvas (X, Y)
  geoToCanvas(lat, lng) {
    // Equirectangular / Mercator projection mapping to bounding box
    // Lat: [-60 to 75], Lng: [-180 to 180]
    const x = ((lng + 180) / 360) * this.width;
    const latRad = (lat * Math.PI) / 180;
    const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    const y = this.height / 2 - (this.width * mercN) / (2 * Math.PI) * 0.7 + 30;
    return { x, y: Math.max(40, Math.min(this.height - 40, y)) };
  }

  calculateNodePositions() {
    const regions = this.api.config.regions;
    this.nodePositions = {
      india: {
        ...this.geoToCanvas(regions.india.lat, regions.india.lng),
        data: regions.india,
        key: 'india'
      },
      germany: {
        ...this.geoToCanvas(regions.germany.lat, regions.germany.lng),
        data: regions.germany,
        key: 'germany'
      },
      singapore: {
        ...this.geoToCanvas(regions.singapore.lat, regions.singapore.lng),
        data: regions.singapore,
        key: 'singapore'
      }
    };
  }

  initParticles() {
    this.particles = [];
    const routes = [
      ['india', 'germany'],
      ['india', 'singapore'],
      ['singapore', 'germany']
    ];

    routes.forEach(([src, dst]) => {
      for (let i = 0; i < 7; i++) {
        this.particles.push({
          src,
          dst,
          t: Math.random(),
          speed: 0.004 + Math.random() * 0.003
        });
      }
    });
  }

  setupInteractivity() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let found = null;
      for (const key of Object.keys(this.nodePositions)) {
        const node = this.nodePositions[key];
        const dist = Math.hypot(node.x - mouseX, node.y - mouseY);
        if (dist < 22) {
          found = node;
          break;
        }
      }

      this.hoveredNode = found;
      this.canvas.style.cursor = found ? 'pointer' : 'default';
    });

    this.canvas.addEventListener('click', () => {
      if (this.hoveredNode) {
        this.selectedNode = this.hoveredNode;
        this.api.emit('nodeSelected', this.hoveredNode);
      }
    });
  }

  drawWorldGrid() {
    const ctx = this.ctx;
    ctx.save();

    // Background gradient
    const bgGradient = ctx.createRadialGradient(
      this.width / 2, this.height / 2, 50,
      this.width / 2, this.height / 2, this.width * 0.7
    );
    bgGradient.addColorStop(0, '#0a101f');
    bgGradient.addColorStop(1, '#020617');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle longitude & latitude mesh lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 1;

    for (let x = 0; x < this.width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // Stylized World Continents Silhouette Outline (Polygonal aesthetic)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1.2;

    this.drawContinents(ctx);
    ctx.restore();
  }

  drawContinents(ctx) {
    // Stylized continent clusters mapped to canvas
    const drawPolygon = (points) => {
      ctx.beginPath();
      points.forEach((pt, idx) => {
        const { x, y } = this.geoToCanvas(pt[0], pt[1]);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    // Eurasia cluster
    drawPolygon([
      [70, 30], [60, 60], [65, 120], [55, 140], [35, 125],
      [22, 110], [10, 100], [25, 75], [20, 60], [30, 45],
      [40, 30], [55, 10], [60, 20]
    ]);

    // Europe
    drawPolygon([
      [58, 5], [52, 15], [45, 20], [36, -5], [44, -10],
      [50, 0], [60, 10]
    ]);

    // Africa
    drawPolygon([
      [35, 10], [30, 32], [12, 44], [-5, 40], [-25, 30],
      [-34, 20], [-10, 12], [5, 0], [15, -15], [30, -5]
    ]);

    // Americas (simplified)
    drawPolygon([
      [65, -140], [50, -125], [30, -115], [20, -100], [15, -85],
      [30, -80], [45, -70], [55, -60], [70, -100]
    ]);
    drawPolygon([
      [10, -75], [5, -55], [-15, -40], [-35, -55], [-50, -70],
      [-20, -70], [0, -80]
    ]);

    // Australasia
    drawPolygon([
      [-12, 130], [-20, 145], [-35, 150], [-38, 140], [-32, 115],
      [-20, 115]
    ]);
  }

  drawLinks() {
    const ctx = this.ctx;
    const links = [
      { src: 'india', dst: 'germany' },
      { src: 'india', dst: 'singapore' },
      { src: 'singapore', dst: 'germany' }
    ];

    links.forEach(link => {
      const p1 = this.nodePositions[link.src];
      const p2 = this.nodePositions[link.dst];
      if (!p1 || !p2) return;

      const reg1 = this.api.state.regions[link.src];
      const reg2 = this.api.state.regions[link.dst];

      const isOffline = reg1.status === 'OFFLINE' || reg2.status === 'OFFLINE';
      const isDegraded = reg1.status === 'DEGRADED' || reg2.status === 'DEGRADED';

      // Great-circle curve control point
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2 - 40;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(midX, midY, p2.x, p2.y);

      if (isOffline) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 1.5;
      } else if (isDegraded) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
        ctx.shadowBlur = 8;
      } else {
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = 'rgba(6, 182, 212, 0.4)';
        ctx.shadowBlur = 6;
      }

      ctx.stroke();
      ctx.restore();

      // Draw RTT badge at curve peak
      this.drawLinkBadge(midX, midY, link, isOffline, isDegraded);
    });
  }

  drawLinkBadge(x, y, link, isOffline, isDegraded) {
    const ctx = this.ctx;
    ctx.save();

    let label = '';
    let bgColor = 'rgba(15, 23, 42, 0.85)';
    let textColor = '#38bdf8';
    let borderColor = 'rgba(56, 189, 248, 0.3)';

    if (isOffline) {
      label = 'LINK DOWN';
      textColor = '#ef4444';
      borderColor = 'rgba(239, 68, 68, 0.4)';
    } else if (isDegraded) {
      label = '+270ms (NETEM)';
      textColor = '#f59e0b';
      borderColor = 'rgba(245, 158, 11, 0.6)';
    } else {
      const rtt = link.src === 'india' && link.dst === 'germany' ? '85ms'
                : link.src === 'india' && link.dst === 'singapore' ? '40ms' : '120ms';
      label = rtt;
    }

    ctx.font = '10px "JetBrains Mono", monospace';
    const textWidth = ctx.measureText(label).width;
    const padding = 6;
    const boxW = textWidth + padding * 2;
    const boxH = 18;

    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);

    ctx.restore();
  }

  drawParticles() {
    const ctx = this.ctx;
    ctx.save();

    this.particles.forEach(p => {
      const p1 = this.nodePositions[p.src];
      const p2 = this.nodePositions[p.dst];
      if (!p1 || !p2) return;

      const reg1 = this.api.state.regions[p.src];
      const reg2 = this.api.state.regions[p.dst];
      if (reg1.status === 'OFFLINE' || reg2.status === 'OFFLINE') return;

      p.t += p.speed;
      if (p.t > 1) p.t = 0;

      // Quadratic bezier calculation
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2 - 40;

      const x = (1 - p.t) * (1 - p.t) * p1.x + 2 * (1 - p.t) * p.t * midX + p.t * p.t * p2.x;
      const y = (1 - p.t) * (1 - p.t) * p1.y + 2 * (1 - p.t) * p.t * midY + p.t * p.t * p2.y;

      const isDegraded = reg1.status === 'DEGRADED' || reg2.status === 'DEGRADED';

      ctx.fillStyle = isDegraded ? '#f59e0b' : '#38bdf8';
      ctx.shadowColor = isDegraded ? 'rgba(245, 158, 11, 0.8)' : 'rgba(56, 189, 248, 0.8)';
      ctx.shadowBlur = 6;

      ctx.beginPath();
      ctx.arc(x, y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  drawNodes() {
    const ctx = this.ctx;

    for (const key of Object.keys(this.nodePositions)) {
      const node = this.nodePositions[key];
      const liveState = this.api.state.regions[key];
      const isHovered = this.hoveredNode && this.hoveredNode.key === key;

      ctx.save();

      // Outer ripple glow
      const time = Date.now() * 0.002;
      const pulseSize = 14 + Math.sin(time + (key === 'india' ? 0 : key === 'germany' ? 2 : 4)) * 3;

      let color = '#10b981'; // green
      let glowColor = 'rgba(16, 185, 129, 0.4)';
      let statusText = 'HEALTHY';

      if (liveState.status === 'DEGRADED') {
        color = '#f59e0b';
        glowColor = 'rgba(245, 158, 11, 0.5)';
        statusText = 'DEGRADED (+260ms)';
      } else if (liveState.status === 'OFFLINE') {
        color = '#ef4444';
        glowColor = 'rgba(239, 68, 68, 0.5)';
        statusText = 'OFFLINE (BLACKOUT)';
      }

      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.arc(node.x, node.y, pulseSize + (isHovered ? 4 : 0), 0, Math.PI * 2);
      ctx.fill();

      // Center Node
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
      ctx.fill();

      // Inner dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Node Label (e.g. 🇮🇳 INDIA - broker-india-1)
      ctx.shadowBlur = 0;
      ctx.font = 'bold 11px "Inter", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(`${node.data.flag} ${node.data.name.split(' ')[0]}`, node.x, node.y + 24);

      // Port & Status
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = color;
      ctx.fillText(`:${node.data.endpoint.split(':')[1]} • ${statusText}`, node.x, node.y + 38);

      // GDPR Sovereign badge on Germany
      if (key === 'germany') {
        ctx.fillStyle = '#a855f7';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText('🛡️ EU GDPR BOUNDARY', node.x, node.y - 16);
      }

      ctx.restore();
    }
  }

  animate() {
    this.drawWorldGrid();
    this.drawLinks();
    this.drawParticles();
    this.drawNodes();
    requestAnimationFrame(() => this.animate());
  }
}

window.HydraMapEngine = HydraMapEngine;

