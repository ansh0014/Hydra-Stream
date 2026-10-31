import React, { useState } from 'react';
import { AlertTriangle, PowerOff, Zap, RefreshCw, Compass } from 'lucide-react';

export default function ChaosStudioView({
  onInjectSlowLink,
  onInjectBlackout,
  onEmitBurst,
  onRestore,
  onResolveRoute,
  events,
}) {
  const [testTopic, setTestTopic] = useState('global-telemetry');
  const [testClient, setTestClient] = useState('India');
  const [routeResult, setRouteResult] = useState(null);

  const handleTestRoute = () => {
    const res = onResolveRoute(testTopic, testClient);
    setRouteResult(res);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-16 space-y-8 animate-fade-in">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-white flex items-center gap-2">
            <Zap className="text-amber-400" size={20} />
            <span>Automated Chaos Studio & Fault Injection</span>
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-0.5">
            Test Linux tc netem link degradation, regional blackouts, and split-brain quorum bypass
          </p>
        </div>
        <span className="text-xs bg-white/5 border border-white/10 text-white px-3 py-1.5 rounded-full font-mono">
          Target: UN SDG 9.1 Resilient Infrastructure
        </span>
      </div>

      {/* The 4 Chaos Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={onInjectSlowLink}
          className="text-left p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-amber-500/50 hover:bg-amber-500/[0.03] transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <AlertTriangle className="text-amber-400" size={22} />
            <span className="text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded">
              tc netem
            </span>
          </div>
          <div className="text-sm font-medium text-white group-hover:text-amber-300 transition">Inject Undersea Cut</div>
          <p className="text-[11px] text-gray-400 font-mono mt-1.5 leading-relaxed">
            Inject +260ms latency & 15% drop on India link. Envoy steers traffic around slow link in &lt;250ms.
          </p>
        </button>

        <button
          onClick={onInjectBlackout}
          className="text-left p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-rose-500/50 hover:bg-rose-500/[0.03] transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <PowerOff className="text-rose-400" size={22} />
            <span className="text-[10px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded">
              Blackout
            </span>
          </div>
          <div className="text-sm font-medium text-white group-hover:text-rose-300 transition">Frankfurt Outage</div>
          <p className="text-[11px] text-gray-400 font-mono mt-1.5 leading-relaxed">
            Kill Frankfurt node. India & Singapore switch to Autonomous Local Quorum without cluster freeze.
          </p>
        </button>

        <button
          onClick={onEmitBurst}
          className="text-left p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-white/40 hover:bg-white/[0.05] transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <Zap className="text-white" size={22} />
            <span className="text-[10px] font-mono bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded">
              Workload
            </span>
          </div>
          <div className="text-sm font-medium text-white group-hover:text-white transition">Emit 100k Burst</div>
          <p className="text-[11px] text-gray-400 font-mono mt-1.5 leading-relaxed">
            Inject 100,000 synthetic messages at 385,000 msg/sec to test bounded queue backpressure.
          </p>
        </button>

        <button
          onClick={onRestore}
          className="text-left p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-emerald-500/50 hover:bg-emerald-500/[0.03] transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <RefreshCw className="text-emerald-400" size={22} />
            <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded">
              Self-Heal
            </span>
          </div>
          <div className="text-sm font-medium text-white group-hover:text-emerald-300 transition">Restore Healthy State</div>
          <p className="text-[11px] text-gray-400 font-mono mt-1.5 leading-relaxed">
            Flush Linux netem rules, restore etcd leases, and return all brokers to optimal green health.
          </p>
        </button>
      </div>

      {/* Interactive Route Tester */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-medium text-white flex items-center gap-2">
              <Compass className="text-white" size={18} />
              <span>Interactive Route Resolution Tester</span>
            </h3>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              Tests the Go Control Plane Policy Engine & Latency Optimization formula in real time
            </p>
          </div>
          <div className="text-xs font-mono text-gray-400">
            Score = 1000 / (RTT * (1 + Loss) + 1.0)
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-mono text-gray-400 mb-1.5">Target Topic</label>
            <select
              value={testTopic}
              onChange={(e) => setTestTopic(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
            >
              <option value="global-telemetry" className="bg-gray-900 text-white">global-telemetry (Latency Optimized)</option>
              <option value="gdpr-user-audit" className="bg-gray-900 text-white">gdpr-user-audit (EU Germany Only)</option>
              <option value="eu-payments" className="bg-gray-900 text-white">eu-payments (EU Germany Only)</option>
              <option value="upi-transactions" className="bg-gray-900 text-white">upi-transactions (India Domestic Only)</option>
              <option value="apac-fx" className="bg-gray-900 text-white">apac-fx (Singapore Only)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-gray-400 mb-1.5">Client Ingress Origin</label>
            <select
              value={testClient}
              onChange={(e) => setTestClient(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
            >
              <option value="India" className="bg-gray-900 text-white">Client Region: India (Mumbai)</option>
              <option value="Germany" className="bg-gray-900 text-white">Client Region: Germany (Frankfurt)</option>
              <option value="Singapore" className="bg-gray-900 text-white">Client Region: Singapore (APAC)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleTestRoute}
              className="btn-gradient w-full py-2.5 rounded-lg text-xs font-medium"
            >
              Resolve Optimal Route
            </button>
          </div>
        </div>

        {routeResult && (
          <div className="mt-4">
            {!routeResult.success ? (
              <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10 text-xs font-mono text-purple-200">
                <div className="font-semibold text-rose-300 flex items-center gap-2">
                  <span>🛡️</span> {routeResult.error}
                </div>
                <div className="mt-1 text-[11px] text-purple-300">
                  <strong>Policy Reason:</strong> Legal residency requires '{routeResult.requiredRegion}'. No cross-border spillover permitted under UN SDG 9.1 compliance rules.
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-white/15 bg-white/[0.04] text-xs font-mono text-white">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Route Resolved by Hydra Controller</span>
                  {routeResult.isBypassingSlowLink ? (
                    <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[10px]">
                      ⚡ BYPASS ACTIVE
                    </span>
                  ) : (
                    <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px]">
                      DIRECT OPTIMAL
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-1 text-[11px] text-gray-300">
                  <div>Target Broker: <strong className="text-white">{routeResult.assignedBrokerId}</strong> ({routeResult.region})</div>
                  <div>Endpoint: <span className="text-gray-400">{routeResult.assignedEndpoint}</span></div>
                  <div>Routing Score: <span className="text-emerald-400 font-bold">{routeResult.score.toFixed(2)}</span></div>
                  <div className="text-gray-400 mt-1">Logic: {routeResult.reason}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Stream Console Log */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="text-xs font-mono text-gray-400 mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
            Controller Routing Decision Stream (events.jsonl trace)
          </span>
          <span className="text-white">Zero Message Loss: Verified 100%</span>
        </div>
        <div className="bg-black/80 border border-white/5 rounded-xl p-4 font-mono text-xs text-gray-300 h-48 overflow-y-auto space-y-2">
          {events.map((evt) => {
            let color = 'text-gray-300';
            if (evt.level === 'warn') color = 'text-amber-400';
            if (evt.level === 'error') color = 'text-rose-400';
            if (evt.level === 'success') color = 'text-emerald-400';

            return (
              <div key={evt.id} className={`${color} text-[11px] leading-relaxed`}>
                <span className="text-gray-500">[{evt.timestamp}]</span>{' '}
                <span className="font-bold text-gray-400">[{evt.category}]</span> {evt.message}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
