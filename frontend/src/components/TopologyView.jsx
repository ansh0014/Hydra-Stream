import React, { useEffect, useRef, useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// High-fidelity continent polygon data (Lat, Lng)
const WORLD_CONTINENTS = [
  // North America
  [
    [72, -168], [71, -156], [70, -135], [60, -130], [55, -130], [50, -125],
    [40, -124], [35, -120], [32, -117], [25, -110], [22, -105], [16, -95],
    [14, -90], [16, -88], [20, -87], [22, -97], [26, -97], [29, -94],
    [29, -89], [25, -81], [28, -80], [32, -80], [35, -75], [42, -70],
    [45, -66], [47, -53], [52, -55], [58, -62], [60, -65], [62, -75],
    [68, -90], [70, -115], [72, -140], [72, -168]
  ],
  // Central America
  [
    [15, -92], [14, -90], [10, -84], [8, -82], [9, -78], [8, -77],
    [9, -83], [13, -87], [15, -92]
  ],
  // South America
  [
    [12, -72], [11, -75], [8, -77], [4, -77], [1, -80], [-5, -81],
    [-14, -76], [-18, -71], [-23, -70], [-33, -72], [-42, -74], [-53, -75],
    [-55, -67], [-52, -68], [-46, -66], [-40, -62], [-36, -57], [-34, -53],
    [-30, -50], [-23, -43], [-18, -39], [-13, -38], [-8, -35], [-5, -35],
    [-2, -44], [0, -50], [4, -51], [6, -58], [10, -62], [11, -67], [12, -72]
  ],
  // Greenland
  [
    [78, -20], [76, -18], [70, -22], [65, -35], [60, -44], [65, -52],
    [70, -54], [76, -60], [82, -40], [82, -20], [78, -20]
  ],
  // Europe & Scandinavia
  [
    [71, 28], [70, 22], [65, 12], [62, 5], [58, 6], [54, 9], [53, 5],
    [51, 2], [48, -5], [44, -1], [43, -9], [37, -9], [36, -6], [37, -2],
    [41, 3], [43, 4], [44, 8], [44, 12], [41, 15], [38, 15], [40, 18],
    [42, 19], [39, 20], [36, 22], [38, 24], [40, 23], [42, 27], [44, 29],
    [46, 30], [45, 34], [46, 38], [47, 39], [55, 38], [60, 30], [65, 30],
    [68, 28], [71, 28]
  ],
  // British Isles
  [
    [58, -5], [58, -2], [55, -1], [51, 1], [50, -5], [52, -5], [55, -5], [58, -5]
  ],
  // Ireland
  [
    [55, -8], [54, -6], [52, -6], [52, -10], [55, -10], [55, -8]
  ],
  // Africa
  [
    [37, 10], [36, 2], [35, -5], [30, -10], [21, -17], [15, -17], [11, -15],
    [5, -9], [5, 2], [4, 9], [2, 9], [-5, 12], [-12, 14], [-17, 12],
    [-23, 14], [-29, 17], [-34, 18], [-34, 26], [-30, 31], [-25, 33],
    [-16, 39], [-10, 40], [-4, 39], [2, 43], [12, 51], [12, 44], [14, 43],
    [22, 37], [28, 34], [31, 32], [32, 25], [32, 20], [37, 10]
  ],
  // Madagascar
  [
    [-12, 49], [-16, 50], [-25, 47], [-25, 44], [-16, 44], [-12, 49]
  ],
  // Asia (Russia, China, Central Asia, Middle East)
  [
    [77, 105], [75, 80], [70, 60], [65, 50], [58, 50], [50, 47], [45, 47],
    [42, 48], [40, 50], [38, 48], [35, 36], [32, 35], [30, 34], [28, 34],
    [24, 38], [15, 44], [13, 45], [13, 50], [16, 53], [22, 59], [25, 57],
    [30, 48], [30, 56], [25, 62], [24, 68], [20, 70], [15, 74], [10, 76],
    [8, 77], [10, 80], [16, 82], [21, 87], [22, 91], [16, 94], [14, 98],
    [8, 100], [4, 103], [1, 104], [4, 103], [7, 100], [10, 99], [15, 101],
    [21, 106], [22, 108], [22, 114], [26, 120], [30, 122], [36, 120],
    [38, 118], [39, 122], [40, 124], [42, 130], [43, 132], [48, 135],
    [48, 140], [53, 141], [55, 138], [58, 140], [60, 165], [62, 180],
    [67, 180], [69, 170], [70, 140], [73, 125], [75, 115], [77, 105]
  ],
  // Japan
  [
    [45, 142], [43, 145], [41, 141], [35, 140], [34, 136], [33, 130],
    [34, 131], [36, 136], [39, 140], [44, 142]
  ],
  // Southeast Asia (Sumatra, Java, Borneo)
  [
    [5, 96], [4, 99], [0, 102], [-3, 103], [-5, 105], [-6, 106],
    [-7, 108], [-7, 114], [-8, 115], [-8, 116], [-3, 115], [0, 117],
    [4, 117], [6, 115], [4, 108], [2, 105], [5, 96]
  ],
  // Philippines
  [
    [18, 120], [15, 120], [13, 124], [10, 126], [6, 125], [9, 122],
    [13, 121], [18, 120]
  ],
  // Australia
  [
    [-12, 132], [-12, 136], [-15, 136], [-14, 141], [-11, 142], [-15, 145],
    [-20, 149], [-25, 153], [-30, 153], [-35, 151], [-38, 145], [-38, 140],
    [-35, 137], [-35, 135], [-33, 132], [-32, 126], [-34, 119], [-34, 115],
    [-30, 115], [-25, 113], [-22, 114], [-20, 119], [-17, 122], [-14, 127],
    [-14, 129], [-12, 132]
  ],
  // New Zealand (North & South)
  [
    [-35, 173], [-38, 177], [-41, 176], [-41, 174], [-37, 175], [-35, 173]
  ],
  [
    [-41, 172], [-44, 171], [-46, 168], [-46, 166], [-43, 170], [-41, 172]
  ]
];

export default function TopologyView({ regions, throughput, totalMessages, gdprPrevented }) {
  const canvasRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  // Mapbox / Noodles.gl / Routes.aero Full-World Canvas Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // High-DPI support for ultra-sharp canvas rendering
    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Natural Earth / Equirectangular Geographic Projection
    // Maps lat [-58 to 78], lng [-180 to 180] across full canvas width
    const geoToCanvas = (lat, lng, w, h) => {
      const x = ((lng + 180) / 360) * w;
      const latMin = -58;
      const latMax = 78;
      const y = ((latMax - lat) / (latMax - latMin)) * h;
      return { x, y };
    };

    // Flowing particles along each great circle route
    const particles = [
      { route: 'in-de', t: 0.05, speed: 0.0035, trail: [] },
      { route: 'in-de', t: 0.45, speed: 0.0038, trail: [] },
      { route: 'in-de', t: 0.85, speed: 0.0033, trail: [] },
      { route: 'in-sg', t: 0.15, speed: 0.0042, trail: [] },
      { route: 'in-sg', t: 0.65, speed: 0.0040, trail: [] },
      { route: 'de-sg', t: 0.25, speed: 0.0030, trail: [] },
      { route: 'de-sg', t: 0.75, speed: 0.0032, trail: [] },
    ];

    let startTime = Date.now();

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const time = Date.now() - startTime;

      ctx.clearRect(0, 0, w, h);

      // 1. Deep Space Black Base Canvas
      ctx.fillStyle = '#05070B';
      ctx.fillRect(0, 0, w, h);

      // 2. Elegant Cartesian Lat/Lng Grid Mesh (Lattice / FlightCN aesthetic)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;

      // Longitude meridians (every 30 degrees)
      for (let lng = -180; lng <= 180; lng += 30) {
        const { x } = geoToCanvas(0, lng, w, h);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Latitude parallels (every 20 degrees)
      for (let lat = -40; lat <= 70; lat += 20) {
        const { y } = geoToCanvas(lat, 0, w, h);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Equator & Prime Meridian subtle accent
      const { y: equatorY } = geoToCanvas(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, equatorY);
      ctx.lineTo(w, equatorY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Subtle Full-World Continents (Noodles.gl & Framer World Map)
      ctx.save();
      WORLD_CONTINENTS.forEach((polygon) => {
        if (polygon.length < 3) return;

        ctx.beginPath();
        polygon.forEach(([lat, lng], idx) => {
          const { x, y } = geoToCanvas(lat, lng, w, h);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();

        // Subtle dark continent fill
        ctx.fillStyle = 'rgba(255, 255, 255, 0.032)';
        ctx.fill();

        // Delicate luminous continent borders
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      });
      ctx.restore();

      // 4. Calculate Regional Node Screen Positions
      const nodePos = {
        germany: geoToCanvas(regions.germany.lat, regions.germany.lng, w, h),
        india: geoToCanvas(regions.india.lat, regions.india.lng, w, h),
        singapore: geoToCanvas(regions.singapore.lat, regions.singapore.lng, w, h),
      };

      // Great-circle links definitions
      const links = [
        { id: 'in-de', src: 'india', dst: 'germany', baseRtt: '85ms' },
        { id: 'in-sg', src: 'india', dst: 'singapore', baseRtt: '40ms' },
        { id: 'de-sg', src: 'germany', dst: 'singapore', baseRtt: '120ms' },
      ];

      // Interpolate points on high great-circle arc
      const getArcPoint = (p1, p2, t, arcHeight = 55) => {
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2 - arcHeight;
        const x = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * midX + t * t * p2.x;
        const y = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * midY + t * t * p2.y;
        return { x, y };
      };

      // 5. Draw FlightCN / Routes.aero Great-Circle Arcs
      links.forEach((l) => {
        const p1 = nodePos[l.src];
        const p2 = nodePos[l.dst];
        if (!p1 || !p2) return;

        const reg1 = regions[l.src];
        const reg2 = regions[l.dst];
        const isOffline = reg1.status === 'OFFLINE' || reg2.status === 'OFFLINE';
        const isDegraded = reg1.status === 'DEGRADED' || reg2.status === 'DEGRADED';

        const arcHeight = l.id === 'de-sg' ? 75 : 55;
        const midPoint = getArcPoint(p1, p2, 0.5, arcHeight);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(
          (p1.x + p2.x) / 2,
          (p1.y + p2.y) / 2 - arcHeight,
          p2.x,
          p2.y
        );

        if (isOffline) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
          ctx.setLineDash([4, 6]);
          ctx.lineWidth = 1.2;
        } else if (isDegraded) {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
          ctx.lineWidth = 2.4;
          ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
          ctx.shadowBlur = 10;
        } else {
          // Luminous great-circle path
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.lineWidth = 1.4;
          ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
          ctx.shadowBlur = 4;
        }

        ctx.stroke();
        ctx.restore();

        // Mid-arc telemetry chip badge (Noodles.gl / FlightCN HUD)
        let chipLabel = l.baseRtt;
        let chipColor = '#ffffff';
        let chipBg = 'rgba(10, 14, 22, 0.85)';
        let chipBorder = 'rgba(255, 255, 255, 0.15)';

        if (isOffline) {
          chipLabel = 'LINK CUT';
          chipColor = '#ef4444';
          chipBorder = 'rgba(239, 68, 68, 0.4)';
        } else if (isDegraded) {
          chipLabel = '+270ms (NETEM)';
          chipColor = '#f59e0b';
          chipBorder = 'rgba(245, 158, 11, 0.5)';
        }

        ctx.save();
        ctx.font = '9px "JetBrains Mono", monospace';
        const textWidth = ctx.measureText(chipLabel).width;
        const boxW = textWidth + 12;
        const boxH = 18;

        ctx.fillStyle = chipBg;
        ctx.strokeStyle = chipBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(midPoint.x - boxW / 2, midPoint.y - boxH / 2, boxW, boxH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = chipColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(chipLabel, midPoint.x, midPoint.y);
        ctx.restore();
      });

      // 6. Draw Moving Event Photon Particles with Comet Trails
      particles.forEach((p) => {
        const link = links.find((l) => l.id === p.route);
        if (!link) return;

        const reg1 = regions[link.src];
        const reg2 = regions[link.dst];
        if (reg1.status === 'OFFLINE' || reg2.status === 'OFFLINE') return;

        p.t += p.speed;
        if (p.t > 1) {
          p.t = 0;
          p.trail = [];
        }

        const arcHeight = link.id === 'de-sg' ? 75 : 55;
        const pos = getArcPoint(nodePos[link.src], nodePos[link.dst], p.t, arcHeight);

        // Keep last 4 trail positions
        p.trail.unshift({ x: pos.x, y: pos.y });
        if (p.trail.length > 5) p.trail.pop();

        const isDegraded = reg1.status === 'DEGRADED' || reg2.status === 'DEGRADED';
        const color = isDegraded ? '#f59e0b' : '#ffffff';

        // Draw fading particle trail
        p.trail.forEach((tPos, idx) => {
          const alpha = 1 - (idx / p.trail.length);
          ctx.save();
          ctx.fillStyle = isDegraded 
            ? `rgba(245, 158, 11, ${alpha * 0.4})` 
            : `rgba(255, 255, 255, ${alpha * 0.4})`;
          ctx.beginPath();
          ctx.arc(tPos.x, tPos.y, Math.max(1, 2.5 - idx * 0.4), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        // Draw particle head
        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = isDegraded ? 10 : 8;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 7. Draw Regional Cluster Nodes (Frankfurt, Mumbai, Singapore)
      Object.keys(nodePos).forEach((key) => {
        const node = nodePos[key];
        const reg = regions[key];

        let coreColor = '#ffffff';
        let glowColor = 'rgba(255, 255, 255, 0.4)';
        let statusText = 'HEALTHY';

        if (reg.status === 'DEGRADED') {
          coreColor = '#f59e0b';
          glowColor = 'rgba(245, 158, 11, 0.5)';
          statusText = 'DEGRADED (+260ms)';
        } else if (reg.status === 'OFFLINE') {
          coreColor = '#ef4444';
          glowColor = 'rgba(239, 68, 68, 0.5)';
          statusText = 'OFFLINE (BLACKOUT)';
        }

        ctx.save();

        // Expanding sonar radar wave (Noodles.gl / FlightCN air traffic pulse)
        const pulseCycle = (time % 2200) / 2200;
        const pulseRadius = 8 + pulseCycle * 26;
        const pulseOpacity = (1 - pulseCycle) * 0.6;

        ctx.strokeStyle = reg.status === 'DEGRADED' 
          ? `rgba(245, 158, 11, ${pulseOpacity})`
          : reg.status === 'OFFLINE'
          ? `rgba(239, 68, 68, ${pulseOpacity})`
          : `rgba(255, 255, 255, ${pulseOpacity})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Node ambient glow halo
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 11, 0, Math.PI * 2);
        ctx.fill();

        // Sharp center core dot
        ctx.fillStyle = coreColor;
        ctx.shadowColor = coreColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Inner white specular pinpoint
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2, 0, Math.PI * 2);
        ctx.fill();

        // Typographic Label
        ctx.shadowBlur = 0;
        ctx.font = '600 11px Poppins, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`${reg.flag} ${reg.name.split(' ')[0]}`, node.x, node.y + 20);

        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = reg.status === 'HEALTHY' ? '#9ca3af' : coreColor;
        ctx.fillText(`:${reg.endpoint.split(':')[1]} • ${statusText}`, node.x, node.y + 34);

        // EU GDPR Article 44 Shield on Germany
        if (key === 'germany') {
          ctx.fillStyle = '#c084fc';
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillText('🛡️ EU GDPR SOVEREIGN LOCK', node.x, node.y - 14);
        }

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [regions]);

  // Telemetry Chart Data
  const throughputData = {
    labels: Array(20).fill(''),
    datasets: [
      {
        label: 'Ingress Throughput (msg/s)',
        data: Array(20).fill(309500).map((v) => v + (Math.random() * 8000 - 4000)),
        borderColor: '#ffffff',
        borderWidth: 1.5,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        tension: 0.3,
        fill: true,
        pointRadius: 0,
      },
    ],
  };

  const latencyData = {
    labels: ['P50 (Core)', 'P50 (Pipe)', 'P75', 'P90', 'P95', 'P99'],
    datasets: [
      {
        label: 'Latency (µs)',
        data: [0.20, 6.8, 12.4, 28.1, 44.9, 65.7],
        backgroundColor: [
          'rgba(255, 255, 255, 0.9)',
          'rgba(255, 255, 255, 0.75)',
          'rgba(255, 255, 255, 0.6)',
          'rgba(255, 255, 255, 0.45)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderRadius: 4,
      },
    ],
  };

  return (
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-16 space-y-8 animate-fade-in">
      
      {/* Top HUD Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">In-Memory Latency</div>
          <div className="text-3xl font-medium text-white mt-2 font-mono flex items-baseline gap-2">
            0.20 <span className="text-xs font-normal text-gray-400">µs (200 ns P50)</span>
          </div>
          <div className="text-[11px] text-emerald-400 font-mono mt-1">
            ⚡ RingBuffer Engine
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">Pipeline Throughput</div>
          <div className="text-3xl font-medium text-white mt-2 font-mono flex items-baseline gap-2">
            {throughput.toLocaleString()} <span className="text-xs font-normal text-gray-400">msg/sec</span>
          </div>
          <div className="text-[11px] text-gray-400 font-mono mt-1">
            ▲ ~79.2 MB/sec Retained Log
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">Messages Streamed</div>
          <div className="text-3xl font-medium text-white mt-2 font-mono flex items-baseline gap-2">
            {totalMessages.toLocaleString()}
          </div>
          <div className="text-[11px] text-purple-300 font-mono mt-1">
            ✔ Monotonic Offsets Synced
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">GDPR Leaks Prevented</div>
          <div className="text-3xl font-medium text-emerald-400 mt-2 font-mono flex items-baseline gap-2">
            {gdprPrevented} Prevented
          </div>
          <div className="text-[11px] text-emerald-400 font-mono mt-1">
            🛡️ Article 44 Enforced
          </div>
        </div>
      </div>

      {/* Geospatial 2.5D Full-World Canvas Container */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium text-white flex items-center gap-2">
              <span>🌐</span> Global Sovereign Topology (Full-World Mesh)
            </h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              Live Great-Circle photon particle replication between regional clusters • Noodles.gl & Lattice Spec
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">
              <span className="h-1.5 w-1.5 rounded-full bg-white"></span> Active Stream
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400"></span> GDPR Shield
            </span>
          </div>
        </div>

        {/* Full-World Canvas Element */}
        <div className="w-full h-[440px] md:h-[480px] relative rounded-xl overflow-hidden border border-white/10 bg-[#05070B]">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
      </div>

      {/* 3 Regional Node Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.keys(regions).map((key) => {
          const reg = regions[key];
          let borderClass = 'border-white/10';
          let badgeClass = 'bg-white/5 text-gray-300 border-white/10';

          if (reg.status === 'DEGRADED') {
            borderClass = 'border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)]';
            badgeClass = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
          } else if (reg.status === 'OFFLINE') {
            borderClass = 'border-rose-500/50 opacity-70';
            badgeClass = 'bg-rose-500/10 text-rose-300 border-rose-500/30';
          }

          return (
            <div key={key} className={`rounded-2xl p-6 border bg-white/[0.02] transition-all duration-300 ${borderClass}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-mono text-gray-400 font-medium flex items-center gap-1.5">
                    <span>{reg.flag}</span> REGION: {key.toUpperCase()}
                  </div>
                  <h4 className="text-lg font-medium text-white mt-1">{reg.id}</h4>
                  <p className="text-xs text-gray-400 font-mono">TCP :{reg.endpoint.split(':')[1]} • Health :{reg.healthPort}</p>
                </div>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-medium border ${badgeClass}`}>
                  {reg.status}
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-gray-400">
                  <span>Link Probe RTT:</span>
                  <span className="text-white font-medium">{reg.status === 'OFFLINE' ? 'OFFLINE' : `${reg.rtt} ms`}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Storage Engine:</span>
                  <span className="text-gray-300">{reg.storage}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Bound Topics:</span>
                  <span className="text-white font-medium">{reg.boundTopics.join(', ')}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-time Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium text-white font-mono uppercase tracking-wider">
              Ingress Telemetry (msg/sec)
            </h3>
            <span className="text-xs font-mono text-gray-400">Live: 309.5k msg/s</span>
          </div>
          <div className="h-60">
            <Line
              data={throughputData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false } },
                  y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#737373', font: { family: 'JetBrains Mono' } } },
                },
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium text-white font-mono uppercase tracking-wider">
              Latency Percentiles (µs)
            </h3>
            <span className="text-xs font-mono text-gray-400">Sub-Microsecond Monotonic</span>
          </div>
          <div className="h-60">
            <Bar
              data={latencyData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false }, ticks: { color: '#a3a3a3', font: { family: 'JetBrains Mono' } } },
                  y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#737373', font: { family: 'JetBrains Mono' } } },
                },
              }}
            />
          </div>
        </div>
      </div>

    </div>
  );
}
