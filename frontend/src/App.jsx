import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LandingView from './components/LandingView';
import TopologyView from './components/TopologyView';
import KafkaExplorerView from './components/KafkaExplorerView';
import ChaosStudioView from './components/ChaosStudioView';
import ComplianceVaultView from './components/ComplianceVaultView';
import { INITIAL_REGIONS, INITIAL_TOPICS, INITIAL_MESSAGES } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('landing');
  const [regions, setRegions] = useState(INITIAL_REGIONS);
  const [topics, setTopics] = useState(INITIAL_TOPICS);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [clusterHealth, setClusterHealth] = useState('HEALTHY');
  const [throughput, setThroughput] = useState(309597);
  const [totalMessages, setTotalMessages] = useState(8199052);
  const [gdprPrevented, setGdprPrevented] = useState(0);
  const [activeChaos, setActiveChaos] = useState(null);

  const [events, setEvents] = useState([
    {
      id: 'e1',
      timestamp: '02:00:15',
      category: 'Discovery',
      level: 'success',
      message: 'etcd v3 watcher registered 3 active brokers: India (9092), Germany (9093), Singapore (9094).',
    },
    {
      id: 'e2',
      timestamp: '02:00:10',
      category: 'Telemetry',
      level: 'info',
      message: 'Prometheus latency scraper polling interval: 2s. All inter-region links operational.',
    },
    {
      id: 'e3',
      timestamp: '02:00:01',
      category: 'System',
      level: 'info',
      message: 'Hydra Control Plane Coordinator initialized. C++ bounded ringbuffer queues active.',
    },
  ]);

  const logEvent = (category, message, level = 'info') => {
    const time = new Date().toTimeString().split(' ')[0];
    const newEvt = {
      id: 'evt_' + Math.random().toString(36).substring(2, 9),
      timestamp: time,
      category,
      message,
      level,
    };
    setEvents((prev) => [newEvt, ...prev.slice(0, 50)]);
  };

  // Heartbeat tick
  useEffect(() => {
    const timer = setInterval(() => {
      setThroughput((prev) => Math.max(100000, Math.round(prev + (Math.random() * 6000 - 3000))));
      setTotalMessages((prev) => prev + Math.floor(throughput / 60));

      setRegions((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (next[k].status === 'HEALTHY') {
            const base = INITIAL_REGIONS[k].baseRTT;
            next[k].rtt = Math.max(2, Math.round(base + (Math.random() * 4 - 2)));
          }
        });
        return next;
      });
    }, 1200);

    return () => clearInterval(timer);
  }, [throughput]);

  // Chaos Actions
  const handleInjectSlowLink = () => {
    setActiveChaos('slow-link');
    setClusterHealth('DEGRADED');
    setRegions((prev) => ({
      ...prev,
      india: {
        ...prev.india,
        rtt: 270,
        packetLoss: 0.15,
        status: 'DEGRADED',
      },
    }));
    logEvent('Chaos', 'Simulating Undersea Fiber Cut: Injected +260ms RTT & 15% packet drop via Linux tc netem.', 'warn');
    logEvent('Router', 'Envoy Dynamic Traffic Steer: Bypassed India link; redirected global telemetry through Singapore (40ms).', 'info');
  };

  const handleInjectBlackout = () => {
    setActiveChaos('blackout');
    setClusterHealth('LOCAL_QUORUM');
    setRegions((prev) => ({
      ...prev,
      germany: {
        ...prev.germany,
        rtt: 0,
        packetLoss: 1.0,
        status: 'OFFLINE',
      },
    }));
    logEvent('Chaos', 'Regional Disaster: Germany (Frankfurt) broker blacked out! Power loss simulated.', 'error');
    logEvent('Quorum', 'Autonomous Regional Quorum Engaged: India & Singapore continue serving without cluster freeze!', 'warn');
    logEvent('Residency', 'GDPR Quarantine Active: All EU topics quarantined at edge; 0 bytes leaked cross-border.', 'success');
  };

  const handleEmitBurst = () => {
    const original = throughput;
    setThroughput(385000);
    logEvent('Workload', 'Workload Engine Burst: Generating 100,000 synthetic messages at 385k msg/sec.', 'info');
    setTimeout(() => {
      setThroughput(original);
      logEvent('Workload', 'Burst complete: 100,000 messages committed to RocksDB with 0 dropped packets.', 'success');
    }, 3500);
  };

  const handleRestore = () => {
    setActiveChaos(null);
    setClusterHealth('HEALTHY');
    setRegions(INITIAL_REGIONS);
    setThroughput(309597);
    logEvent('Healer', 'Cluster state self-healed. Flushed netem rules. All 3 regional nodes reporting 100% HEALTHY.', 'success');
  };

  // Route Resolver logic
  const handleResolveRoute = (topicName, clientRegion) => {
    const topic = topics.find((t) => t.name === topicName);
    if (!topic) return { success: false, error: 'Topic not found' };

    if (topic.legalRegion !== 'ANY') {
      const targetKey = topic.legalRegion.toLowerCase();
      const targetBroker = regions[targetKey];
      if (!targetBroker || targetBroker.status === 'OFFLINE') {
        setGdprPrevented((prev) => prev + 1);
        logEvent(
          'Security',
          `[403 FORBIDDEN] Sovereign Lock Violation Prevented! Topic '${topicName}' requires '${topic.legalRegion}', but node is OFFLINE. Ingress rejected to prevent illegal spillover.`,
          'error'
        );
        return {
          success: false,
          requiredRegion: topic.legalRegion,
          error: `403 Forbidden: Regional node for ${topic.legalRegion} is offline and residency strictly prohibits routing elsewhere.`,
        };
      }
      return {
        success: true,
        topic: topicName,
        assignedBrokerId: targetBroker.id,
        assignedEndpoint: targetBroker.endpoint,
        region: targetBroker.name,
        score: 1000 / (targetBroker.rtt * (1.0 + targetBroker.packetLoss) + 1.0),
        isBypassingSlowLink: false,
        reason: `Enforced by Legal Residency Policy (${topic.compliance})`,
      };
    }

    // Adaptive Optimization
    let bestScore = -1;
    let chosen = null;
    let bypassed = false;

    Object.keys(regions).forEach((k) => {
      const b = regions[k];
      if (b.status === 'OFFLINE') return;
      const s = 1000 / (b.rtt * (1.0 + b.packetLoss) + 1.0);
      if (s > bestScore) {
        bestScore = s;
        chosen = b;
      }
    });

    if (activeChaos === 'slow-link' && chosen && chosen.id === 'broker-singapore-1') {
      bypassed = true;
    }

    return {
      success: true,
      topic: topicName,
      assignedBrokerId: chosen ? chosen.id : 'none',
      assignedEndpoint: chosen ? chosen.endpoint : 'none',
      region: chosen ? chosen.name : 'none',
      score: bestScore,
      isBypassingSlowLink: bypassed,
      reason: bypassed
        ? 'Adaptive Route Optimization: Bypassed degraded India-Germany undersea fiber link'
        : 'Optimal lowest latency path selected by Envoy L4 Router',
    };
  };

  // Publish Message
  const handlePublishMessage = (topicName, payloadStr) => {
    const route = handleResolveRoute(topicName, 'India');
    if (!route.success) {
      return { type: 'error', message: route.error };
    }

    const newOffset = 1849100 + messages.length + 1;
    const newMsg = {
      magic: '0x48445201',
      topic: topicName,
      partition: Math.floor(Math.random() * 4),
      offset: newOffset,
      timestamp: new Date().toISOString(),
      key: `client_evt_${Date.now()}`,
      payload: payloadStr,
      sizeBytes: payloadStr.length + 48,
    };

    setMessages((prev) => [newMsg, ...prev]);
    return {
      type: 'success',
      message: `Message committed to ${route.assignedBrokerId} (${route.region}) at Offset #${newOffset}!`,
    };
  };

  const handleSync = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8080/health');
      if (res.ok) {
        logEvent('Sync', 'Connected & synced with live Hydra Go Control Plane (:8080)', 'success');
      } else {
        logEvent('Sync', 'Live controller returned non-200. Operating in standalone demo mode.', 'info');
      }
    } catch (e) {
      logEvent('Sync', 'Backend offline. Operating smoothly in standalone demo mode.', 'info');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-white selection:text-black">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        clusterHealth={clusterHealth}
        onSync={handleSync}
      />

      <main className="flex-1 w-full bg-black">
        {activeTab === 'landing' && <LandingView setActiveTab={setActiveTab} />}
        {activeTab === 'topology' && (
          <TopologyView
            regions={regions}
            throughput={throughput}
            totalMessages={totalMessages}
            gdprPrevented={gdprPrevented}
          />
        )}
        {activeTab === 'kafka-ui' && (
          <KafkaExplorerView
            topics={topics}
            messages={messages}
            onPublishMessage={handlePublishMessage}
            activeRoutes={{}}
          />
        )}
        {activeTab === 'chaos' && (
          <ChaosStudioView
            onInjectSlowLink={handleInjectSlowLink}
            onInjectBlackout={handleInjectBlackout}
            onEmitBurst={handleEmitBurst}
            onRestore={handleRestore}
            onResolveRoute={handleResolveRoute}
            events={events}
          />
        )}
        {activeTab === 'compliance' && <ComplianceVaultView />}
      </main>

      <footer className="border-t border-gray-800/50 bg-black py-8 text-center text-xs text-gray-500 font-mono">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>Hydra Stream © 2026 • High-Reliability Geo-Resilient Streaming Broker • Apache-2.0</div>
          <div className="flex items-center gap-4 text-gray-400">
            <span>React + Vite + Tailwind + Express</span>
            <span className="text-white font-medium">UN SDG 9.1 Verified</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

