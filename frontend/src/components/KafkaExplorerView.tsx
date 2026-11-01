import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Box,
  Send,
  ShieldAlert,
  CheckCircle2,
  Search,
  Layers,
  Users,
  Terminal,
  Activity,
  FileCode,
  Copy,
  ChevronRight,
  Database,
  ArrowUpRight
} from 'lucide-react';
import { TopicPolicy, PartitionCommitLog, ConsumerGroup } from '../types';

interface KafkaExplorerViewProps {
  topics: TopicPolicy[];
  messages: PartitionCommitLog[];
  onPublishMessage: (topicName: string, payloadStr: string) => Promise<{ type: 'success' | 'error'; message: string }>;
  activeRoutes?: Record<string, string>;
}

// Sample enterprise consumer groups simulating real Kafka consumer group offsets and lag
const DEFAULT_CONSUMER_GROUPS: ConsumerGroup[] = [
  {
    groupId: 'eu-payment-settler-v2',
    topic: 'eu-payments',
    state: 'Stable',
    membersCount: 4,
    totalLag: 0,
    assignedBroker: 'broker-germany-1',
    coordinatorRegion: 'Frankfurt (DE)'
  },
  {
    groupId: 'upi-clearing-engine-prod',
    topic: 'upi-transactions',
    state: 'Stable',
    membersCount: 8,
    totalLag: 2,
    assignedBroker: 'broker-india-1',
    coordinatorRegion: 'Mumbai (IN)'
  },
  {
    groupId: 'apac-hft-risk-monitor',
    topic: 'apac-fx',
    state: 'Stable',
    membersCount: 3,
    totalLag: 0,
    assignedBroker: 'broker-singapore-1',
    coordinatorRegion: 'Singapore (SG)'
  },
  {
    groupId: 'gdpr-compliance-auditor',
    topic: 'gdpr-user-audit',
    state: 'Stable',
    membersCount: 2,
    totalLag: 0,
    assignedBroker: 'broker-germany-1',
    coordinatorRegion: 'Frankfurt (DE)'
  },
  {
    groupId: 'global-timeseries-indexer',
    topic: 'global-telemetry',
    state: 'Rebalancing',
    membersCount: 6,
    totalLag: 14,
    assignedBroker: 'broker-singapore-1',
    coordinatorRegion: 'Global Mesh'
  }
];

export default function KafkaExplorerView({
  topics = [],
  messages = [],
  onPublishMessage,
  activeRoutes = {}
}: KafkaExplorerViewProps) {
  const [activeTab, setActiveTab] = useState<'topics' | 'consumer-groups' | 'commit-log' | 'producer'>('topics');
  const [selectedTopic, setSelectedTopic] = useState<TopicPolicy | null>(topics[0] || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [publishTopic, setPublishTopic] = useState<string>(topics[0]?.name || 'global-telemetry');
  const [publishPayload, setPublishPayload] = useState(
    JSON.stringify(
      {
        userId: 'eu_usr_77201',
        auditEvent: 'GDPR_DATA_CONSENT_CHECK',
        jurisdiction: 'DE_EU',
        retentionPolicy: 'SOVEREIGN_IMMUTABLE',
        timestamp: new Date().toISOString()
      },
      null,
      2
    )
  );
  const [publishStatus, setPublishStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedOffset, setCopiedOffset] = useState<number | null>(null);

  // Sync selected topic if initial topic array was empty
  React.useEffect(() => {
    if (!selectedTopic && topics.length > 0) {
      setSelectedTopic(topics[0]);
      setPublishTopic(topics[0].name);
    }
  }, [topics, selectedTopic]);

  const filteredTopics = useMemo(() => {
    return topics.filter(
      (t) =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.legalRegion.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [topics, searchTerm]);

  const topicMessages = useMemo(() => {
    if (!selectedTopic) return messages;
    return messages.filter((m) => m.topic === selectedTopic.name);
  }, [messages, selectedTopic]);

  const handlePublish = async () => {
    try {
      JSON.parse(publishPayload);
    } catch (e: any) {
      setPublishStatus({
        type: 'error',
        message: 'Invalid JSON payload: ' + e.message
      });
      return;
    }

    if (!publishTopic) {
      setPublishStatus({
        type: 'error',
        message: 'No topic selected for publishing.'
      });
      return;
    }

    const result = await onPublishMessage(publishTopic, publishPayload);
    setPublishStatus(result);
  };

  const copyToClipboard = (text: string, offset: number) => {
    navigator.clipboard.writeText(text);
    setCopiedOffset(offset);
    setTimeout(() => setCopiedOffset(null), 2000);
  };

  const loadPresetPayload = (type: 'gdpr' | 'upi' | 'telemetry') => {
    if (type === 'gdpr') {
      setPublishTopic('gdpr-user-audit');
      setPublishPayload(
        JSON.stringify(
          {
            userId: 'eu_usr_88304',
            auditEvent: 'GDPR_ARTICLE_17_ERASURE_REQUEST',
            jurisdiction: 'DE_EU',
            timestamp: new Date().toISOString()
          },
          null,
          2
        )
      );
    } else if (type === 'upi') {
      setPublishTopic('upi-transactions');
      setPublishPayload(
        JSON.stringify(
          {
            txnId: 'UPI-IN-99201-AXIS',
            payerVpa: 'rahul@oksbi',
            amountInr: 4500.0,
            settlementType: 'DOMESTIC_STASH_ROCKSDB',
            timestamp: new Date().toISOString()
          },
          null,
          2
        )
      );
    } else {
      setPublishTopic('global-telemetry');
      setPublishPayload(
        JSON.stringify(
          {
            sourceNode: 'gateway-singapore',
            packetsPerSec: 42100,
            rttAvgMs: 14.2,
            lossRate: 0.0001,
            timestamp: new Date().toISOString()
          },
          null,
          2
        )
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-16 space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Box className="text-cyan-400" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
                <span>Distributed Streaming Explorer</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-cyan-300">
                  Kafbat / Kafka-UI v3
                </span>
              </h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                Cluster Topics, RingBuffer Partitions, Consumer Lag, and C++ Wire Framing Inspection
              </p>
            </div>
          </div>
        </div>

        {/* Global Tab Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-white/[0.03] border border-white/10">
          <button
            onClick={() => setActiveTab('topics')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'topics' ? 'bg-white text-black font-semibold shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Layers size={13} />
            <span>Topics ({topics.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('consumer-groups')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'consumer-groups' ? 'bg-white text-black font-semibold shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users size={13} />
            <span>Consumer Groups</span>
          </button>
          <button
            onClick={() => setActiveTab('commit-log')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'commit-log' ? 'bg-white text-black font-semibold shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Terminal size={13} />
            <span>Commit-Log ({messages.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('producer')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'producer' ? 'bg-white text-black font-semibold shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Send size={13} />
            <span>Produce Message</span>
          </button>
        </div>
      </div>

      {/* TAB 1: TOPICS & PARTITIONS */}
      {activeTab === 'topics' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Topics Sidebar */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden lg:col-span-1 flex flex-col h-[650px]">
            <div className="p-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <span className="text-xs font-semibold font-mono text-gray-300 uppercase tracking-wider">
                Topics Registry
              </span>
              <div className="relative w-44">
                <Search size={12} className="absolute left-2.5 top-2.5 text-gray-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter topics..."
                  className="w-full bg-white/5 border border-white/10 pl-7 pr-2 py-1 rounded-md text-[11px] font-mono text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {filteredTopics.length === 0 ? (
                <div className="p-8 text-center text-gray-500 font-mono text-xs">
                  {topics.length === 0 ? 'Connecting to live policy engine...' : 'No matching topics.'}
                </div>
              ) : (
                filteredTopics.map((t) => {
                  const isSelected = selectedTopic?.name === t.name;
                  let badge = 'bg-white/5 text-gray-300 border-white/10';
                  if (t.legalRegion.toLowerCase().includes('germany') || t.legalRegion.toLowerCase().includes('eu'))
                    badge = 'bg-purple-500/10 text-purple-300 border-purple-500/20';
                  if (t.legalRegion.toLowerCase().includes('india'))
                    badge = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
                  if (t.legalRegion.toLowerCase().includes('singapore'))
                    badge = 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20';

                  const count = messages.filter((m) => m.topic === t.name).length;

                  return (
                    <div
                      key={t.name}
                      onClick={() => setSelectedTopic(t)}
                      className={`p-3.5 cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-white/[0.08] border-l-2 border-l-cyan-400'
                          : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs font-mono">#</span>
                          <span className="text-xs font-mono font-medium text-white">{t.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badge}`}>
                            {t.legalRegion}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400">
                            {t.partitions} Parts
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono text-gray-300 font-medium">
                          {count} msgs
                        </span>
                        <div className="text-[10px] font-mono text-emerald-400">
                          {activeRoutes[t.name] || 'ACTIVE'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Selected Topic Deep Inspector */}
          <div className="lg:col-span-2 space-y-6">
            {selectedTopic ? (
              <>
                {/* Topic Metadata Card */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                        <span>Topic Inspector</span>
                        <span>•</span>
                        <span className="text-cyan-400">Policy Enforced</span>
                      </div>
                      <h3 className="text-xl font-bold font-mono text-white mt-1">
                        {selectedTopic.name}
                      </h3>
                      <div className="text-xs font-mono text-purple-300 mt-1 flex items-center gap-1.5">
                        <span>🛡️</span>
                        <span>{selectedTopic.compliance || `Jurisdiction: ${selectedTopic.legalRegion}`}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-right">
                        <div className="text-[10px] font-mono text-gray-400 uppercase">Partitions</div>
                        <div className="text-sm font-mono font-bold text-white">{selectedTopic.partitions} FIFO</div>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-right">
                        <div className="text-[10px] font-mono text-gray-400 uppercase">Replication</div>
                        <div className="text-sm font-mono font-bold text-emerald-400">3x Synced</div>
                      </div>
                    </div>
                  </div>

                  {/* Partitions RingBuffer Status Matrix */}
                  <div className="mt-6">
                    <h4 className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider mb-3">
                      Partition RingBuffer Topology (Leader / ISR / High Watermark)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Array.from({ length: selectedTopic.partitions }).map((_, pIdx) => {
                        const partMsgs = topicMessages.filter((m) => m.partition === pIdx);
                        const hwOffset = partMsgs.length > 0 ? Math.max(...partMsgs.map((m) => m.offset)) : 0;
                        const leaderBroker =
                          selectedTopic.legalRegion === 'Germany'
                            ? 'broker-germany-1'
                            : selectedTopic.legalRegion === 'India'
                            ? 'broker-india-1'
                            : selectedTopic.legalRegion === 'Singapore'
                            ? 'broker-singapore-1'
                            : `broker-${['germany', 'india', 'singapore'][pIdx % 3]}-1`;

                        return (
                          <div
                            key={pIdx}
                            className="p-3.5 rounded-xl border border-white/10 bg-black/40 font-mono text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white flex items-center gap-1.5">
                                <Database size={13} className="text-cyan-400" />
                                <span>Partition #{pIdx}</span>
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                In-Sync (ISR: 3)
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400 pt-1 border-t border-white/5">
                              <div>Leader: <span className="text-white">{leaderBroker}</span></div>
                              <div>HW Offset: <span className="text-cyan-300 font-bold">#{hwOffset}</span></div>
                              <div>Storage: <span className="text-gray-300">RocksDB FIFO</span></div>
                              <div>Lag: <span className="text-emerald-400">0 msgs</span></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Retained Partition Commit-Log for this Topic */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                  <div className="p-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
                    <span className="text-xs font-semibold font-mono text-gray-300 uppercase flex items-center gap-2">
                      <Terminal size={14} className="text-cyan-400" />
                      <span>Retained Messages for #{selectedTopic.name}</span>
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">
                      Framing: <code className="text-cyan-300">0x48445201</code>
                    </span>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                    {topicMessages.length === 0 ? (
                      <div className="p-12 text-center text-gray-500 font-mono text-xs space-y-2">
                        <p>No messages recorded yet for '{selectedTopic.name}'.</p>
                        <button
                          onClick={() => setActiveTab('producer')}
                          className="text-cyan-400 hover:underline text-[11px] inline-flex items-center gap-1"
                        >
                          Produce test message <ChevronRight size={12} />
                        </button>
                      </div>
                    ) : (
                      topicMessages.map((msg) => (
                        <div key={msg.offset} className="p-4 hover:bg-white/[0.02] transition font-mono text-xs">
                          <div className="flex items-center justify-between text-gray-400 mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-white font-bold">Offset #{msg.offset}</span>
                              <span className="bg-white/10 text-cyan-300 px-2 py-0.5 rounded text-[10px]">
                                Part: {msg.partition}
                              </span>
                              <span className="text-gray-500 text-[10px]">Size: {msg.sizeBytes} B</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-[11px]">{msg.timestamp}</span>
                              <button
                                onClick={() => copyToClipboard(msg.payload, msg.offset)}
                                className="text-gray-400 hover:text-white transition p-1"
                                title="Copy JSON payload"
                              >
                                {copiedOffset === msg.offset ? (
                                  <span className="text-emerald-400 text-[10px]">Copied!</span>
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="text-[11px] text-gray-400 mb-1">
                            Key: <span className="text-white font-mono">{msg.key}</span>
                          </div>
                          <pre className="bg-black/90 p-3 rounded-lg border border-white/5 text-cyan-100 text-[11px] overflow-x-auto font-mono">
                            {msg.payload}
                          </pre>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-16 text-center text-gray-400 font-mono text-xs border border-white/10 rounded-2xl bg-white/[0.02]">
                Select a topic from the registry to inspect its ringbuffer partitions and commit log.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CONSUMER GROUPS */}
      {activeTab === 'consumer-groups' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold font-mono text-white flex items-center gap-2">
                  <Users size={16} className="text-cyan-400" />
                  <span>Consumer Groups & Lag Telemetry</span>
                </h3>
                <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                  Real-time consumer offset commits, member heartbeats, and partition rebalancing
                </p>
              </div>
              <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full">
                5 Active Groups
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-black/60 border-b border-white/10 text-gray-400 text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Group ID</th>
                    <th className="py-3 px-4">Target Topic</th>
                    <th className="py-3 px-4">State</th>
                    <th className="py-3 px-4">Active Members</th>
                    <th className="py-3 px-4">Consumer Lag</th>
                    <th className="py-3 px-4">Coordinator Broker</th>
                    <th className="py-3 px-4">Region</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {DEFAULT_CONSUMER_GROUPS.map((cg) => (
                    <tr key={cg.groupId} className="hover:bg-white/[0.03] transition">
                      <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                        <span className="text-gray-500">grp:</span>
                        <span>{cg.groupId}</span>
                      </td>
                      <td className="py-3.5 px-4 text-cyan-300">#{cg.topic}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border ${
                            cg.state === 'Stable'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          }`}
                        >
                          {cg.state}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-300">{cg.membersCount} instances</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-bold ${
                            cg.totalLag === 0 ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {cg.totalLag} msgs
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-300">{cg.assignedBroker}</td>
                      <td className="py-3.5 px-4 text-gray-400">{cg.coordinatorRegion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GLOBAL COMMIT-LOG STREAM */}
      {activeTab === 'commit-log' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold font-mono text-white flex items-center gap-2">
                  <Terminal size={16} className="text-cyan-400" />
                  <span>Real-Time Partition Commit-Log</span>
                </h3>
                <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                  Unified multi-region stream inspection with binary header deserialization
                </p>
              </div>
              <span className="text-xs font-mono text-gray-400">
                Total Committed: <strong className="text-white">{messages.length}</strong>
              </span>
            </div>

            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {messages.length === 0 ? (
                <div className="p-16 text-center text-gray-500 font-mono text-xs space-y-3">
                  <p>No messages published across any cluster partition yet.</p>
                  <button
                    onClick={() => setActiveTab('producer')}
                    className="btn-gradient px-4 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-2"
                  >
                    <Send size={13} />
                    <span>Send First Test Message</span>
                  </button>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.offset} className="p-4 hover:bg-white/[0.02] transition font-mono text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-gray-400 mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-white font-bold">Offset #{msg.offset}</span>
                        <span className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-0.5 rounded text-[10px]">
                          Topic: #{msg.topic}
                        </span>
                        <span className="bg-white/5 text-gray-300 px-2 py-0.5 rounded text-[10px]">
                          Part: {msg.partition}
                        </span>
                        <span className="text-gray-500 text-[10px]">Magic: {msg.magic}</span>
                      </div>
                      <span className="text-gray-500 text-[11px]">{msg.timestamp}</span>
                    </div>

                    <div className="text-[11px] text-gray-300 mb-1.5">
                      Key: <span className="text-white font-mono">{msg.key}</span> • Size: {msg.sizeBytes} B
                    </div>

                    <pre className="bg-black/90 p-3.5 rounded-lg border border-white/5 text-cyan-100 text-[11px] overflow-x-auto font-mono">
                      {msg.payload}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: INTERACTIVE PRODUCER */}
      {activeTab === 'producer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-semibold font-mono text-white flex items-center gap-2">
                  <Send size={16} className="text-cyan-400" />
                  <span>Interactive Producer Client (Policy Engine Guarded)</span>
                </h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  Publishes directly through Hydra-Stream Envoy Ingress and evaluates sovereignty bounds
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-gray-300 mb-1.5">
                    Target Kafka Topic
                  </label>
                  <select
                    value={publishTopic}
                    onChange={(e) => setPublishTopic(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    {topics.map((t) => (
                      <option key={t.name} value={t.name} className="bg-gray-900 text-white">
                        {t.name} ({t.legalRegion})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-300 mb-1.5">
                    Serialization Framing
                  </label>
                  <input
                    type="text"
                    value="C++ Wire Protocol (0x48445201 JSON)"
                    disabled
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-gray-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono text-gray-300">
                    JSON Payload Body
                  </label>
                  <span className="text-[10px] font-mono text-gray-500">
                    UTF-8 JSON Encoded
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={publishPayload}
                  onChange={(e) => setPublishPayload(e.target.value)}
                  className="w-full bg-black/90 border border-white/10 rounded-lg p-3.5 text-xs font-mono text-cyan-200 focus:outline-none focus:border-cyan-500/50 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-mono text-gray-400 flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-purple-400" />
                  <span>Enforces Sovereign Legal Policy prior to broker commit</span>
                </span>
                <button
                  onClick={handlePublish}
                  className="btn-gradient px-6 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2"
                >
                  <Send size={14} />
                  <span>Commit to Broker</span>
                </button>
              </div>

              {publishStatus && (
                <div
                  className={`mt-4 p-4 rounded-xl border text-xs font-mono ${
                    publishStatus.type === 'error'
                      ? 'border-purple-500/30 bg-purple-500/10 text-purple-200'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  }`}
                >
                  <div className="font-semibold flex items-center gap-2">
                    {publishStatus.type === 'error' ? (
                      <ShieldAlert size={16} className="text-purple-300" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    <span>{publishStatus.message}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Payload Presets & Policy Explainer */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
              <h4 className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <FileCode size={14} className="text-cyan-400" />
                <span>Quick Payload Presets</span>
              </h4>

              <div className="space-y-2.5">
                <button
                  onClick={() => loadPresetPayload('gdpr')}
                  className="w-full text-left p-3 rounded-xl border border-purple-500/20 bg-purple-500/[0.04] hover:bg-purple-500/[0.08] transition font-mono text-xs"
                >
                  <div className="font-semibold text-purple-300 flex items-center justify-between">
                    <span>GDPR Article 17 Erasure</span>
                    <ArrowUpRight size={13} />
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    Route: Germany Broker (Cross-border replication locked)
                  </div>
                </button>

                <button
                  onClick={() => loadPresetPayload('upi')}
                  className="w-full text-left p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08] transition font-mono text-xs"
                >
                  <div className="font-semibold text-emerald-300 flex items-center justify-between">
                    <span>RBI UPI Banking Settlement</span>
                    <ArrowUpRight size={13} />
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    Route: India Mumbai Broker (Domestic RocksDB only)
                  </div>
                </button>

                <button
                  onClick={() => loadPresetPayload('telemetry')}
                  className="w-full text-left p-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] hover:bg-cyan-500/[0.08] transition font-mono text-xs"
                >
                  <div className="font-semibold text-cyan-300 flex items-center justify-between">
                    <span>High-Frequency Telemetry</span>
                    <ArrowUpRight size={13} />
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    Route: Global Lowest-Latency Mesh
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

