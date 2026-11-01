import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  AlertTriangle,
  PowerOff,
  RefreshCw,
  Compass,
  Activity,
  ShieldAlert,
  CheckCircle2,
  Filter,
  Flame,
  ArrowRight,
  TrendingDown,
  Cpu
} from 'lucide-react';
import { BrokerNode, TelemetryEvent, RouteDecision } from '../types';
import { resolveRoute } from '../services/api';

interface ChaosStudioViewProps {
  regions: Record<string, BrokerNode>;
  activeChaos: string | null;
  onInjectSlowLink: () => void;
  onInjectBlackout: () => void;
  onInjectBurst: () => void;
  onRestore: () => void;
  events: TelemetryEvent[];
}

export default function ChaosStudioView({
  regions = {},
  activeChaos,
  onInjectSlowLink,
  onInjectBlackout,
  onInjectBurst,
  onRestore,
  events = []
}: ChaosStudioViewProps) {
  const [testTopic, setTestTopic] = useState('global-telemetry');
  const [testClient, setTestClient] = useState('India');
  const [routeResult, setRouteResult] = useState<RouteDecision | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [eventFilter, setEventFilter] = useState<'all' | 'ChaosEngine' | 'Routing' | 'Security'>('all');

  const handleTestRoute = async () => {
    setIsResolving(true);
    try {
      const decision = await resolveRoute(testTopic, testClient);
      setRouteResult({
        topic: testTopic,
        assignedBrokerId: decision.assigned_broker_id || decision.assignedBrokerId,
        assignedEndpoint: decision.assigned_endpoint || decision.assignedEndpoint,
        region: decision.region,
        score: decision.score,
        isBypassingSlowLink: decision.is_bypassing_slow_link || decision.isBypassingSlowLink,
        reason: decision.reason
      });
    } catch (err: any) {
      setRouteResult({
        topic: testTopic,
        region: 'REJECTED',
        score: 0,
        reason: err.message,
        error: err.message
      });
    } finally {
      setIsResolving(false);
    }
  };

  const filteredEvents = events.filter((e) => {
    if (eventFilter === 'all') return true;
    return e.category === eventFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-16 space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Zap className="text-amber-400" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
                <span>Automated Chaos Studio & Fault Injection</span>
                {activeChaos && (
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 animate-pulse">
                    CHAOS ACTIVE: {activeChaos.toUpperCase()}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                Simulate Linux <code>tc netem</code> link degradation, power loss, and verify sub-250ms Envoy rerouting
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRestore}
            className="px-4 py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono transition flex items-center gap-2"
          >
            <RefreshCw size={13} className={activeChaos ? 'animate-spin' : ''} />
            <span>Flush Netem & Heal</span>
          </button>
        </div>
      </div>

      {/* The 4 Chaos Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Action 1: Undersea Fiber Cut */}
        <button
          onClick={onInjectSlowLink}
          className={`text-left p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group ${
            activeChaos === 'slow-link'
              ? 'border-amber-500/60 bg-amber-500/10 shadow-lg shadow-amber-500/10'
              : 'border-white/10 bg-white/[0.02] hover:border-amber-500/40 hover:bg-amber-500/[0.03]'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <AlertTriangle className="text-amber-400" size={16} />
            </div>
            <span className="text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded">
              tc netem
            </span>
          </div>
          <div className="text-sm font-semibold text-white group-hover:text-amber-300 transition">
            Inject Undersea Cut
          </div>
          <p className="text-[11px] text-gray-400 font-mono mt-2 leading-relaxed">
            Adds +260ms RTT & 15% packet drop on India broker. Envoy steering algorithm reroutes around slow link in &lt;250ms.
          </p>
          {activeChaos === 'slow-link' && (
            <div className="mt-3 pt-3 border-t border-amber-500/20 text-[10px] font-mono text-amber-300 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>Simulating degradation active</span>
            </div>
          )}
        </button>

        {/* Action 2: Regional Power Outage */}
        <button
          onClick={onInjectBlackout}
          className={`text-left p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group ${
            activeChaos === 'blackout'
              ? 'border-rose-500/60 bg-rose-500/10 shadow-lg shadow-rose-500/10'
              : 'border-white/10 bg-white/[0.02] hover:border-rose-500/40 hover:bg-rose-500/[0.03]'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-8 w-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
              <PowerOff className="text-rose-400" size={16} />
            </div>
            <span className="text-[10px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded">
              Datacenter Loss
            </span>
          </div>
          <div className="text-sm font-semibold text-white group-hover:text-rose-300 transition">
            Frankfurt Blackout
          </div>
          <p className="text-[11px] text-gray-400 font-mono mt-2 leading-relaxed">
            Instantly terminates Frankfurt broker. Cluster transitions into Autonomous Quorum mode, isolating EU sovereign topics.
          </p>
          {activeChaos === 'blackout' && (
            <div className="mt-3 pt-3 border-t border-rose-500/20 text-[10px] font-mono text-rose-300 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping" />
              <span>Broker offline • Quorum active</span>
            </div>
          )}
        </button>

        {/* Action 3: Ingest 100k Burst */}
        <button
          onClick={onInjectBurst}
          className="text-left p-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-cyan-500/40 hover:bg-cyan-500/[0.03] transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
              <Flame className="text-cyan-400" size={16} />
            </div>
            <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-0.5 rounded">
              Stress Ingestion
            </span>
          </div>
          <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition">
            Emit 100k Burst
          </div>
          <p className="text-[11px] text-gray-400 font-mono mt-2 leading-relaxed">
            Fires 100,000 synthetic JSON payloads at 385,000 msg/sec to test RocksDB bounded ringbuffer backpressure limits.
          </p>
        </button>

        {/* Action 4: Restore State */}
        <button
          onClick={onRestore}
          className="text-left p-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-cyan-500/40 hover:bg-emerald-500/[0.03] transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
              <RefreshCw className="text-cyan-400" size={16} />
            </div>
            <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-0.5 rounded">
              Self-Heal
            </span>
          </div>
          <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition">
            Restore Cluster Health
          </div>
          <p className="text-[11px] text-gray-400 font-mono mt-2 leading-relaxed">
            Flushes all simulated network delay rules, restores etcd heartbeats, and re-establishes cross-regional replication.
          </p>
        </button>
      </div>

      {/* Interactive Route Scoring Engine & Candidate Breakdown */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Compass className="text-cyan-400" size={18} />
              <span>Hydra Route Resolution Scoring Engine</span>
            </h3>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              Go Control Plane Policy Engine evaluates RTT, Loss, and Data Sovereignty constraints
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-cyan-300">
            <code>Score = 1000 / (RTT * (1 + Loss) + 1.0)</code>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-mono text-gray-300 mb-1.5">Target Topic</label>
            <select
              value={testTopic}
              onChange={(e) => setTestTopic(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="global-telemetry" className="bg-gray-900 text-white">
                global-telemetry (Latency Optimized / Any Broker)
              </option>
              <option value="gdpr-user-audit" className="bg-gray-900 text-white">
                gdpr-user-audit (EU Germany Only • Sovereign Lock)
              </option>
              <option value="eu-payments" className="bg-gray-900 text-white">
                eu-payments (EU Germany Only • Sovereign Lock)
              </option>
              <option value="upi-transactions" className="bg-gray-900 text-white">
                upi-transactions (India Domestic Only • RBI Directive)
              </option>
              <option value="apac-fx" className="bg-gray-900 text-white">
                apac-fx (Singapore APAC Only • MAS Sovereign)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-gray-300 mb-1.5">Client Ingress Origin</label>
            <select
              value={testClient}
              onChange={(e) => setTestClient(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="India" className="bg-gray-900 text-white">Client Origin: Mumbai, India (IN)</option>
              <option value="Germany" className="bg-gray-900 text-white">Client Origin: Frankfurt, Germany (EU)</option>
              <option value="Singapore" className="bg-gray-900 text-white">Client Origin: Jurong, Singapore (SG)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleTestRoute}
              disabled={isResolving}
              className="btn-gradient w-full py-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-2"
            >
              <Compass size={14} className={isResolving ? 'animate-spin' : ''} />
              <span>{isResolving ? 'Calculating...' : 'Resolve Optimal Route'}</span>
            </button>
          </div>
        </div>

        {/* Live Calculation Result */}
        {routeResult && (
          <div className="pt-2">
            {routeResult.error || routeResult.region === 'REJECTED' ? (
              <div className="p-4 rounded-xl border border-purple-500/40 bg-purple-500/10 text-xs font-mono text-purple-200">
                <div className="font-semibold text-rose-300 flex items-center gap-2">
                  <ShieldAlert size={16} />
                  <span>Sovereign Boundary Enforced: 403 Forbidden</span>
                </div>
                <div className="mt-1 text-[11px] text-purple-300 leading-relaxed">
                  <strong>Policy Rejection:</strong> {routeResult.reason}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-white/15 bg-black/60 text-xs font-mono text-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-cyan-400" />
                    <span className="font-semibold text-white">Route Assigned by Go Control Plane</span>
                  </div>
                  {routeResult.isBypassingSlowLink ? (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded text-[10px] font-bold animate-pulse">
                      DYNAMIC BYPASS ACTIVE
                    </span>
                  ) : (
                    <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-0.5 rounded text-[10px] font-bold">
                      OPTIMAL DIRECT ROUTE
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-[11px]">
                  <div>
                    <span className="text-gray-400 block">Target Broker:</span>
                    <strong className="text-white text-xs">{routeResult.assignedBrokerId}</strong>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Region:</span>
                    <span className="text-cyan-300">{routeResult.region}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Algorithmic Score:</span>
                    <span className="text-cyan-400 font-bold text-xs">{routeResult.score.toFixed(2)} pts</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Endpoint:</span>
                    <span className="text-gray-300 font-mono">{routeResult.assignedEndpoint}</span>
                  </div>
                </div>

                <div className="text-[11px] text-gray-400 pt-1">
                  <strong>Control Plane Rationale:</strong> {routeResult.reason}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controller Decision Stream (events.jsonl trace) */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-sm font-semibold font-mono text-white">
              Controller Routing Decision Stream (events.jsonl trace)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <Filter size={12} className="text-gray-500" />
            <div className="flex rounded-lg bg-black/60 border border-white/10 p-0.5 text-[10px] font-mono">
              {(['all', 'ChaosEngine', 'Routing', 'Security'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setEventFilter(cat)}
                  className={`px-2.5 py-1 rounded ${
                    eventFilter === cat ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {cat === 'all' ? 'All Events' : cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-black/90 border border-white/5 rounded-xl p-4 font-mono text-xs text-gray-300 h-64 overflow-y-auto space-y-2">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-xs">No events in this category yet.</div>
          ) : (
            filteredEvents.map((evt) => {
              let color = 'text-gray-300';
              let badge = 'bg-white/5 text-gray-400 border-white/10';
              if (evt.level === 'warn') {
                color = 'text-amber-300';
                badge = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
              }
              if (evt.level === 'error') {
                color = 'text-rose-300';
                badge = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
              }
              if (evt.level === 'success') {
                color = 'text-cyan-300';
                badge = 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20';
              }

              return (
                <div key={evt.id} className="flex items-start gap-2.5 text-[11px] leading-relaxed hover:bg-white/[0.02] p-1 rounded transition">
                  <span className="text-gray-500 shrink-0">[{evt.timestamp}]</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded border shrink-0 ${badge}`}>
                    {evt.category}
                  </span>
                  <span className={`${color} break-words`}>{evt.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

