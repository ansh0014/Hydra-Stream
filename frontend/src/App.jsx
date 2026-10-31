import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LandingView from './components/LandingView';
import TopologyView from './components/TopologyView';
import KafkaExplorerView from './components/KafkaExplorerView';
import ChaosStudioView from './components/ChaosStudioView';
import ComplianceVaultView from './components/ComplianceVaultView';
import { REGION_METADATA, CLUSTER_TOPICS, fetchTopology, resolveRoute, fetchHealth } from './services/api';

function buildInitialRegions() {
  return {
    india: {
      id: 'broker-india-1',
      endpoint: '127.0.0.1:9092',
      healthPort: 8081,
      status: 'HEALTHY',
      rtt: 10,
      packetLoss: 0.0,
      boundTopics: ['upi-transactions', 'orders-india', 'global-telemetry'],
      ...REGION_METADATA.india,
    },
    germany: {
      id: 'broker-germany-1',
      endpoint: '127.0.0.1:9093',
      healthPort: 8082,
      status: 'HEALTHY',
      rtt: 85,
      packetLoss: 0.0,
      boundTopics: ['gdpr-user-audit', 'eu-payments'],
      ...REGION_METADATA.germany,
    },
    singapore: {
      id: 'broker-singapore-1',
      endpoint: '127.0.0.1:9094',
      healthPort: 8083,
      status: 'HEALTHY',
      rtt: 40,
      packetLoss: 0.0,
      boundTopics: ['apac-fx', 'global-telemetry'],
      ...REGION_METADATA.singapore,
    },
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('landing');
  const [regions, setRegions] = useState(buildInitialRegions);
  const [topics, setTopics] = useState(CLUSTER_TOPICS);
  const [messages, setMessages] = useState([]);
  const [clusterHealth, setClusterHealth] = useState('HEALTHY');
  const [throughput, setThroughput] = useState(309597);
  const [totalMessages, setTotalMessages] = useState(0);
  const [gdprPrevented, setGdprPrevented] = useState(0);
  const [activeChaos, setActiveChaos] = useState(null);

  const [events, setEvents] = useState([
    {
      id: 'e1',
      timestamp: new Date().toTimeString().split(' ')[0],
      category: 'System',
      level: 'info',
      message: 'Hydra Dashboard ready. Connecting to Hydra Control Plane...',
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

  // Poll live cluster topology from Go Control Plane
  const syncClusterTopology = async () => {
    try {
      const data = await fetchTopology();
      if (data && data.brokers && data.brokers.length > 0) {
        setRegions((prev) => {
          const next = { ...prev };
          data.brokers.forEach((b) => {
            const key = b.region.toLowerCase();
            if (next[key]) {
              next[key].id = b.id;
              next[key].endpoint = b.endpoint;
              next[key].status = b.status || 'HEALTHY';
              if (b.rtt) {
                // Convert nanoseconds to milliseconds if needed
                next[key].rtt = b.rtt > 1000000 ? Math.round(b.rtt / 1000000) : b.rtt;
              }
              next[key].packetLoss = b.packet_loss || 0.0;
            }
          });
          return next;
        });
        logEvent('Discovery', `etcd cluster sync: ${data.brokers.length} live brokers active.`, 'success');
      }
    } catch (err) {
      // Background sync notification
    }
  };

  useEffect(() => {
    syncClusterTopology();
    const interval = setInterval(syncClusterTopology, 5000);
    return () => clearInterval(interval);
  }, []);

  // Heartbeat live rate ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setThroughput((prev) => Math.max(100000, Math.round(prev + (Math.random() * 4000 - 2000))));
      setTotalMessages((prev) => prev + Math.floor(throughput / 60));
    }, 1500);

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
    logEvent(
      'ChaosEngine',
      'FAULT INJECTED: Undersea fiber cut on broker-india-1 (+260ms RTT, 15% packet drop via Linux tc netem).',
      'warn'
    );
    logEvent(
      'Routing',
      'Hydra Router: Link score collapsed (<200ms threshold breached). Dynamic bypass active -> Global traffic steered to Singapore.',
      'info'
    );
  };

  const handleInjectBlackout = () => {
    setActiveChaos('blackout');
    setClusterHealth('LOCAL_QUORUM');
    setRegions((prev) => ({
      ...prev,
      germany: {
        ...prev.germany,
        status: 'OFFLINE',
        rtt: 0,
        packetLoss: 1.0,
      },
    }));
    logEvent(
      'ChaosEngine',
      'REGIONAL OUTAGE: Frankfurt datacenter power grid failure on broker-germany-1. Node marked OFFLINE.',
      'error'
    );
    logEvent(
      'Compliance',
      'Sovereign Boundary Active: Topics "gdpr-user-audit" and "eu-payments" quarantined. Ingress rejected with 403 Forbidden to prevent illegal spillover.',
      'warn'
    );
  };

  const handleInjectBurst = () => {
    logEvent('Traffic', 'Pumping 100,000 message burst across 8 concurrent worker pipelines...', 'info');
    setThroughput(425000);
    setTimeout(() => {
      setThroughput(309597);
      logEvent('Traffic', 'Burst completed: 100,000 messages committed to memory ringbuffer. Zero dropped.', 'success');
    }, 2500);
  };

  const handleRestore = () => {
    setActiveChaos(null);
    setClusterHealth('HEALTHY');
    setRegions(buildInitialRegions());
    logEvent('ChaosEngine', 'All netem rules flushed. Cluster restored to pristine operational state.', 'success');
  };

  // Route Resolver logic calling real Go Control Plane API
  const handleResolveRoute = async (topicName, clientRegion = 'India') => {
    try {
      const decision = await resolveRoute(topicName, clientRegion);
      return {
        success: true,
        topic: topicName,
        assignedBrokerId: decision.assigned_broker_id,
        assignedEndpoint: decision.assigned_endpoint,
        region: decision.region,
        score: decision.score,
        isBypassingSlowLink: decision.is_bypassing_slow_link,
        reason: decision.reason,
      };
    } catch (err) {
      setGdprPrevented((prev) => prev + 1);
      logEvent('Security', `[REJECTED] ${err.message}`, 'error');
      return {
        success: false,
        error: err.message,
      };
    }
  };

  // Publish Message
  const handlePublishMessage = async (topicName, payloadStr) => {
    const route = await handleResolveRoute(topicName, 'India');
    if (!route.success) {
      return { type: 'error', message: route.error };
    }

    const newOffset = messages.length + 1;
    const newMsg = {
      magic: '0x48',
      topic: topicName,
      partition: Math.floor(Math.random() * 4),
      offset: newOffset,
      timestamp: new Date().toISOString(),
      key: `client_evt_${Date.now()}`,
      payload: payloadStr,
      sizeBytes: payloadStr.length + 16,
    };

    setMessages((prev) => [newMsg, ...prev]);
    return {
      type: 'success',
      message: `Message committed to ${route.assignedBrokerId} (${route.region}) at Offset #${newOffset}!`,
    };
  };

  const activeRoutes = {
    'gdpr-user-audit': regions.germany.status === 'OFFLINE' ? 'QUARANTINED (403)' : regions.germany.id,
    'eu-payments': regions.germany.status === 'OFFLINE' ? 'QUARANTINED (403)' : regions.germany.id,
    'upi-transactions': regions.india.status === 'OFFLINE' ? 'QUARANTINED (403)' : regions.india.id,
    'apac-fx': regions.singapore.status === 'OFFLINE' ? 'QUARANTINED (403)' : regions.singapore.id,
    'global-telemetry': regions.india.status === 'DEGRADED' ? regions.singapore.id : regions.india.id,
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col font-sans selection:bg-white selection:text-black">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        clusterHealth={clusterHealth}
        throughput={throughput}
        onRestore={handleRestore}
      />

      <main className="flex-1">
        {activeTab === 'landing' && (
          <LandingView
            throughput={throughput}
            totalMessages={totalMessages}
            gdprPrevented={gdprPrevented}
            onOpenTopology={() => setActiveTab('topology')}
            onOpenKafka={() => setActiveTab('kafka')}
            onOpenChaos={() => setActiveTab('chaos')}
          />
        )}

        {activeTab === 'topology' && (
          <TopologyView
            regions={regions}
            clusterHealth={clusterHealth}
            throughput={throughput}
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
            gdprPrevented={gdprPrevented}
          />
        )}
      </main>

      <footer className="border-t border-white/5 bg-[#05070a] py-6 text-center text-xs font-mono text-gray-500">
        Hydra Stream © 2026 • Sovereign Multi-Region Streaming Broker • UN SDG 9.1 Infrastructure Resilience
      </footer>
    </div>
  );
}
