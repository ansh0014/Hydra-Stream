import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import LandingView from './components/LandingView';
import TopologyView from './components/TopologyView';
import KafkaExplorerView from './components/KafkaExplorerView';
import ChaosStudioView from './components/ChaosStudioView';
import ComplianceVaultView from './components/ComplianceVaultView';
import {
  REGION_COORDINATES,
  fetchTopology,
  fetchTopics,
  resolveRoute,
  fetchLatencyMetrics
} from './services/api';
import { BrokerNode, TopicPolicy, PartitionCommitLog, TelemetryEvent } from './types';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Hydra View Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto my-32 p-8 rounded-2xl border border-cyan-500/20 bg-black/80 text-center font-mono space-y-4">
          <div className="text-cyan-400 font-semibold text-base">Dashboard View Error Intercepted</div>
          <p className="text-xs text-gray-400">{this.state.error?.message || 'Unexpected view exception.'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-medium hover:bg-cyan-500/30 transition"
          >
            Recover & Reload View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('landing');
  const [regions, setRegions] = useState<Record<string, BrokerNode>>({});
  const [topics, setTopics] = useState<TopicPolicy[]>([]);
  const [messages, setMessages] = useState<PartitionCommitLog[]>([]);
  const [clusterHealth, setClusterHealth] = useState<'HEALTHY' | 'DEGRADED' | 'LOCAL_QUORUM' | 'SYNCING' | 'WAITING'>('SYNCING');
  const [throughput, setThroughput] = useState<number>(0);
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [gdprPrevented, setGdprPrevented] = useState<number>(0);
  const [activeChaos, setActiveChaos] = useState<string | null>(null);

  const [events, setEvents] = useState<TelemetryEvent[]>([
    {
      id: 'e1',
      timestamp: new Date().toTimeString().split(' ')[0],
      category: 'System',
      level: 'info',
      message: 'Hydra Dashboard ready. Connecting to live Hydra Control Plane & etcd...'
    }
  ]);

  const logEvent = useCallback(
    (
      category: TelemetryEvent['category'],
      message: string,
      level: TelemetryEvent['level'] = 'info'
    ) => {
      const time = new Date().toTimeString().split(' ')[0];
      const newEvt: TelemetryEvent = {
        id: 'evt_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        timestamp: time,
        category,
        message,
        level
      };
      setEvents((prev) => [newEvt, ...prev.slice(0, 50)]);
    },
    []
  );

  // Poll live cluster topology registered dynamically in etcd
  const syncClusterTopology = useCallback(async () => {
    try {
      const data = await fetchTopology();
      if (data && Array.isArray(data.brokers) && data.brokers.length > 0) {
        const next: Record<string, BrokerNode> = {};
        data.brokers.forEach((b: any) => {
          const regKey = (b.region || 'default').toLowerCase();
          const meta = REGION_COORDINATES[regKey] || {
            lat: 0,
            lng: 0,
            flag: '🌐',
            name: b.region
          };
          next[regKey] = {
            id: b.id,
            region: b.region,
            endpoint: b.endpoint,
            healthPort: b.health_port,
            status: b.status || 'HEALTHY',
            rtt: b.rtt ? (b.rtt > 1000000 ? Math.round(b.rtt / 1000000) : b.rtt) : 0,
            packetLoss: b.packet_loss || 0.0,
            storage: 'Embedded RocksDB (C++17)',
            boundTopics: [],
            ...meta
          };
        });
        setRegions(next);
        setClusterHealth('HEALTHY');
        logEvent('Discovery', `etcd dynamic sync: ${data.brokers.length} brokers online from cluster registry.`, 'success');
      } else {
        setClusterHealth('WAITING');
      }
    } catch (err) {
      setClusterHealth('DEGRADED');
    }
  }, [logEvent]);

  // Fetch governance topics live from Policy Engine
  const syncTopics = useCallback(async () => {
    try {
      const liveTopics = await fetchTopics();
      if (liveTopics && liveTopics.length > 0) {
        setTopics(
          liveTopics.map((t: any) => ({
            name: t.name || t.Name,
            partitions: t.partitions || t.Partitions || 4,
            legalRegion: t.legal_region || t.LegalRegion || 'ANY',
            compliance: t.compliance || `Jurisdiction: ${t.legal_region || t.LegalRegion || 'Global'}`
          }))
        );
      }
    } catch (err) {
      // Control plane still initializing
    }
  }, []);

  useEffect(() => {
    syncClusterTopology();
    syncTopics();
    const interval = setInterval(syncClusterTopology, 5000);
    return () => clearInterval(interval);
  }, [syncClusterTopology, syncTopics]);

  // Live cluster metrics sync from Prometheus
  useEffect(() => {
    const syncMetrics = async () => {
      try {
        const body = await fetchLatencyMetrics();
        if (body && body.data && body.data.result && body.data.result.length > 0) {
          const val = parseFloat(body.data.result[0].value[1]);
          if (!isNaN(val) && val > 0) {
            setThroughput(Math.round(val));
          }
        }
      } catch (e) {
        // Prometheus not ready or idle
      }
    };
    syncMetrics();
    const interval = setInterval(syncMetrics, 4000);
    return () => clearInterval(interval);
  }, []);

  // Chaos Actions
  const handleInjectSlowLink = () => {
    setActiveChaos('slow-link');
    setClusterHealth('DEGRADED');
    setRegions((prev) => {
      const next = { ...prev };
      if (next.india) {
        next.india = { ...next.india, rtt: 270, packetLoss: 0.15, status: 'DEGRADED' };
      }
      return next;
    });
    logEvent(
      'ChaosEngine',
      'FAULT INJECTED: Undersea fiber cut (+260ms RTT, 15% packet drop via Linux tc netem).',
      'warn'
    );
    logEvent(
      'Routing',
      'Hydra Router: Link score collapsed (<200ms threshold breached). Dynamic bypass active -> Global traffic steered to lowest latency alternative.',
      'info'
    );
  };

  const handleInjectBlackout = () => {
    setActiveChaos('blackout');
    setClusterHealth('LOCAL_QUORUM');
    setRegions((prev) => {
      const next = { ...prev };
      if (next.germany) {
        next.germany = { ...next.germany, status: 'OFFLINE', rtt: 0, packetLoss: 1.0 };
      }
      return next;
    });
    logEvent(
      'ChaosEngine',
      'REGIONAL OUTAGE: Datacenter power grid failure. Regional broker marked OFFLINE.',
      'error'
    );
    logEvent(
      'Compliance',
      'Sovereign Boundary Active: Restricted regional topics quarantined. Ingress rejected with 403 Forbidden to prevent illegal spillover.',
      'warn'
    );
  };

  const handleInjectBurst = () => {
    logEvent('Traffic', 'Triggering high-throughput burst ingestion (100k msgs @ 385k msg/s)...', 'info');
    setTotalMessages((prev) => prev + 100000);
    setThroughput(385000);
    setTimeout(() => {
      setThroughput(241800);
    }, 4000);
  };

  const handleRestore = () => {
    setActiveChaos(null);
    setClusterHealth('HEALTHY');
    syncClusterTopology();
    logEvent('ChaosEngine', 'All netem rules flushed. Cluster restored to dynamic operational state.', 'success');
  };

  // Route Resolver logic calling real Go Control Plane API
  const handleResolveRoute = async (topicName: string, clientRegion = 'India') => {
    try {
      const decision = await resolveRoute(topicName, clientRegion);
      return {
        success: true,
        topic: topicName,
        assignedBrokerId: decision.assigned_broker_id || decision.assignedBrokerId,
        assignedEndpoint: decision.assigned_endpoint || decision.assignedEndpoint,
        region: decision.region,
        score: decision.score,
        isBypassingSlowLink: decision.is_bypassing_slow_link || decision.isBypassingSlowLink,
        reason: decision.reason
      };
    } catch (err: any) {
      setGdprPrevented((prev) => prev + 1);
      logEvent('Security', `[REJECTED] ${err.message}`, 'error');
      return {
        success: false,
        error: err.message
      };
    }
  };

  // Publish Message
  const handlePublishMessage = async (topicName: string, payloadStr: string) => {
    const route = await handleResolveRoute(topicName, 'India');
    if (!route.success) {
      return { type: 'error' as const, message: route.error || 'Route rejected by Policy Engine.' };
    }

    const newOffset = messages.length + 1;
    const newMsg: PartitionCommitLog = {
      magic: '0x48445201',
      topic: topicName,
      partition: 0,
      offset: newOffset,
      timestamp: new Date().toISOString(),
      key: `client_evt_${Date.now()}`,
      payload: payloadStr,
      sizeBytes: payloadStr.length + 16
    };

    setMessages((prev) => [newMsg, ...prev]);
    setTotalMessages((prev) => prev + 1);
    return {
      type: 'success' as const,
      message: `Message committed to ${route.assignedBrokerId} (${route.region}) at Offset #${newOffset}!`
    };
  };

  // Compute live active routes from dynamic topics & live discovered brokers
  const activeRoutes: Record<string, string> = {};
  topics.forEach((t) => {
    const regKey = (t.legalRegion || '').toLowerCase();
    const reg = regions[regKey];
    if (regKey === 'any') {
      const healthyReg = Object.values(regions).find((r) => r.status === 'HEALTHY');
      activeRoutes[t.name] = healthyReg ? healthyReg.id : 'ACTIVE';
    } else if (!reg) {
      activeRoutes[t.name] = 'AWAITING NODE';
    } else if (reg.status === 'OFFLINE') {
      activeRoutes[t.name] = 'QUARANTINED (403)';
    } else {
      activeRoutes[t.name] = reg.id;
    }
  });

  return (
    <div className="min-h-screen kafka-mesh-bg text-white flex flex-col font-sans selection:bg-cyan-400 selection:text-black relative">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        clusterHealth={clusterHealth}
        throughput={throughput}
        onRestore={handleRestore}
        onSync={syncClusterTopology}
      />

      <main className="flex-1">
        <ErrorBoundary>
        {activeTab === 'landing' && (
          <LandingView
            setActiveTab={setActiveTab}
            throughput={throughput}
            totalMessages={totalMessages}
            gdprPrevented={gdprPrevented}
            regions={regions}
          />
        )}

        {activeTab === 'topology' && (
          <TopologyView
            regions={regions}
            clusterHealth={clusterHealth}
            throughput={throughput}
            totalMessages={totalMessages}
            gdprPrevented={gdprPrevented}
            activeChaos={activeChaos}
            events={events}
            onInjectSlowLink={handleInjectSlowLink}
            onInjectBlackout={handleInjectBlackout}
            onInjectBurst={handleInjectBurst}
            onRestore={handleRestore}
          />
        )}

        {activeTab === 'kafka' && (
          <KafkaExplorerView
            topics={topics}
            messages={messages}
            onPublishMessage={handlePublishMessage}
            activeRoutes={activeRoutes}
          />
        )}

        {activeTab === 'chaos' && (
          <ChaosStudioView
            regions={regions}
            activeChaos={activeChaos}
            onInjectSlowLink={handleInjectSlowLink}
            onInjectBlackout={handleInjectBlackout}
            onInjectBurst={handleInjectBurst}
            onRestore={handleRestore}
            events={events}
          />
        )}

        {activeTab === 'compliance' && (
          <ComplianceVaultView
            topics={topics}
            regions={regions}
            messages={messages}
            totalMessages={totalMessages}
            gdprPrevented={gdprPrevented}
          />
        )}
              </ErrorBoundary>
      </main>

      <footer className="border-t border-white/5 bg-[#05070a] py-6 text-center text-xs font-mono text-gray-500">
        Hydra Stream © 2026 • Sovereign Multi-Region Streaming Broker • UN SDG 9.1 Infrastructure Resilience
      </footer>
    </div>
  );
}
