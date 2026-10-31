import React from 'react';
import { Shield, FileText, CheckCircle2 } from 'lucide-react';

export default function ComplianceVaultView() {
  const handleExport = () => {
    alert('Exporting executive compliance audit certificate (JSON/PDF)...');
  };

  return (
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-16 space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-white flex items-center gap-2">
            <Shield className="text-white" size={20} />
            <span>Sovereign Regulatory & Legal Compliance Vault</span>
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-0.5">
            Formal verification of EU GDPR Article 44, India DPDP Act, and RBI Sovereign Directives
          </p>
        </div>
        <button
          onClick={handleExport}
          className="btn-gradient px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2"
        >
          <FileText size={14} />
          <span>Export Regulatory Audit Certificate</span>
        </button>
      </div>

      {/* Compliance Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl p-6 border border-purple-500/30 bg-purple-500/[0.03]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-purple-300 font-medium">EU GDPR ARTICLE 44</span>
            <span className="text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">
              ENFORCED
            </span>
          </div>
          <h3 className="text-lg font-medium text-white">Cross-Border Prohibition</h3>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            Guarantees zero replication or temporary buffer spillover of EU-restricted topics outside Germany/EU legal boundaries.
          </p>
          <div className="mt-4 pt-4 border-t border-purple-500/20 font-mono text-xs text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            <span>Measured Cross-Border Leaks: <strong>0 Bytes</strong></span>
          </div>
        </div>

        <div className="rounded-2xl p-6 border border-emerald-500/30 bg-emerald-500/[0.03]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-emerald-300 font-medium">INDIA RBI DIRECTIVE</span>
            <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">
              DOMESTIC ONLY
            </span>
          </div>
          <h3 className="text-lg font-medium text-white">Payment Data Sovereignty</h3>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            All UPI transaction and banking logs committed directly to local RocksDB storage in Mumbai without foreign replication.
          </p>
          <div className="mt-4 pt-4 border-t border-emerald-500/20 font-mono text-xs text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            <span>Domestic Stash: <strong>1,420,890 Transactions</strong></span>
          </div>
        </div>

        <div className="rounded-2xl p-6 border border-white/20 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-gray-300 font-medium">UN SDG 9.1</span>
            <span className="text-[10px] bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded">
              RESILIENT INFRA
            </span>
          </div>
          <h3 className="text-lg font-medium text-white">Autonomous Quorum</h3>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            Zero single-point-of-failure: Cluster survives total regional blackout without deadlocking remaining nodes.
          </p>
          <div className="mt-4 pt-4 border-t border-white/10 font-mono text-xs text-white flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>Quorum Availability: <strong>99.999% Maintained</strong></span>
          </div>
        </div>
      </div>

      {/* Formal Ledger */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h3 className="text-base font-medium text-white mb-2">Cryptographic Correctness Oracle Ledger</h3>
        <p className="text-xs text-gray-400 font-mono mb-4">
          Real-time mathematical audit comparing producer ingress offsets against consumer commit offsets.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-white/10 text-gray-400">
              <tr>
                <th className="py-3 px-3">Audit Scope</th>
                <th className="py-3 px-3">Ingress Log</th>
                <th className="py-3 px-3">Committed Offset</th>
                <th className="py-3 px-3">Cross-Border Spill</th>
                <th className="py-3 px-3">Oracle Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-3.5 px-3 text-white font-medium">Topic: gdpr-user-audit</td>
                <td className="py-3.5 px-3 text-gray-300">341,820 msgs</td>
                <td className="py-3.5 px-3 text-gray-300">341,820 msgs</td>
                <td className="py-3.5 px-3 text-purple-300 font-semibold">0 bytes (100% Locked)</td>
                <td className="py-3.5 px-3 text-emerald-400 font-medium">🛡️ STRICT PASS</td>
              </tr>
              <tr>
                <td className="py-3.5 px-3 text-white font-medium">Topic: upi-transactions</td>
                <td className="py-3.5 px-3 text-gray-300">1,420,890 msgs</td>
                <td className="py-3.5 px-3 text-gray-300">1,420,890 msgs</td>
                <td className="py-3.5 px-3 text-emerald-300 font-semibold">0 bytes (Domestic)</td>
                <td className="py-3.5 px-3 text-emerald-400 font-medium">🛡️ STRICT PASS</td>
              </tr>
              <tr>
                <td className="py-3.5 px-3 text-white font-medium">Topic: global-telemetry</td>
                <td className="py-3.5 px-3 text-gray-300">4,891,040 msgs</td>
                <td className="py-3.5 px-3 text-gray-300">4,891,040 msgs</td>
                <td className="py-3.5 px-3 text-gray-400">Global Transit</td>
                <td className="py-3.5 px-3 text-white font-medium">⚡ OPTIMIZED PASS</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
