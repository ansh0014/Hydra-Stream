import React, { useState } from 'react';
import { Box, Send, ShieldAlert, CheckCircle2, Search, ArrowRight } from 'lucide-react';

export default function KafkaExplorerView({ topics, messages, onPublishMessage, activeRoutes }) {
  const [selectedTopic, setSelectedTopic] = useState(topics[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [publishTopic, setPublishTopic] = useState(topics[0].name);
  const [publishPayload, setPublishPayload] = useState('{\n  "userId": "eu_usr_77201",\n  "auditEvent": "GDPR_DATA_CONSENT_CHECK",\n  "jurisdiction": "DE_EU"\n}');
  const [publishStatus, setPublishStatus] = useState(null);

  const filteredTopics = topics.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.legalRegion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const topicMessages = messages.filter((m) => m.topic === selectedTopic.name);

  const handlePublish = () => {
    try {
      JSON.parse(publishPayload);
    } catch (e) {
      setPublishStatus({
        type: 'error',
        message: 'Invalid JSON: ' + e.message,
      });
      return;
    }

    const result = onPublishMessage(publishTopic, publishPayload);
    setPublishStatus(result);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-16 space-y-8 animate-fade-in">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-white flex items-center gap-2">
            <Box size={20} className="text-white" />
            <span>Kafka-UI Topic & Partition Explorer</span>
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-0.5">
            Inspired by provectus/kafka-ui • Real-time offset commit inspect & schema framing
          </p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-3 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search topics or regions..."
            className="bg-white/5 border border-white/10 pl-9 pr-4 py-2 rounded-lg text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-white/30 w-72 transition"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Topics Table */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden lg:col-span-1">
          <div className="p-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <span className="text-xs font-medium font-mono text-gray-300 uppercase">Registered Topics ({topics.length})</span>
            <span className="text-[11px] font-mono text-gray-400">22 Partitions Total</span>
          </div>
          <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black/60 border-b border-white/5 font-mono text-[11px] text-gray-400">
                <tr>
                  <th className="py-3 px-3">Topic</th>
                  <th className="py-3 px-3">Parts</th>
                  <th className="py-3 px-3">Jurisdiction</th>
                  <th className="py-3 px-3">Messages</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {filteredTopics.map((t) => {
                  const isSelected = selectedTopic.name === t.name;
                  let badge = 'bg-white/5 text-gray-300 border-white/10';
                  if (t.legalRegion === 'Germany') badge = 'bg-purple-500/10 text-purple-300 border-purple-500/20';
                  if (t.legalRegion === 'India') badge = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';

                  return (
                    <tr
                      key={t.name}
                      onClick={() => setSelectedTopic(t)}
                      className={`hover:bg-white/[0.04] cursor-pointer transition ${
                        isSelected ? 'bg-white/[0.06] border-l-2 border-l-white' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-medium text-white flex items-center gap-1.5">
                        <span className="text-gray-500">#</span> {t.name}
                      </td>
                      <td className="py-3 px-3 text-gray-300">{t.partitions}</td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${badge}`}>
                          {t.legalRegion}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 font-medium">
                        {t.messagesTotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Topic Inspector & Messages */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono text-gray-400">Topic Inspector</div>
                <h3 className="text-lg font-medium font-mono text-white mt-0.5">{selectedTopic.name}</h3>
                <div className="text-xs font-mono text-purple-300 mt-1 flex items-center gap-1.5">
                  <span>🛡️</span> <span>{selectedTopic.compliance}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono bg-white/5 text-gray-300 px-3 py-1 rounded-full border border-white/10">
                  {selectedTopic.partitions} Partitions (RingBuffer FIFO)
                </span>
              </div>
            </div>
          </div>

          {/* Commit-Log Stream */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <span className="text-xs font-medium font-mono text-gray-300 uppercase flex items-center gap-1.5">
                <span>📄</span> Live Retained Partition Commit-Log
              </span>
              <span className="text-[11px] font-mono text-gray-400">C++ Wire Framing (Magic: 0x48445201)</span>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
              {topicMessages.length === 0 ? (
                <div className="p-8 text-center text-gray-500 font-mono text-xs">
                  No retained messages in partition for topic '{selectedTopic.name}'.
                </div>
              ) : (
                topicMessages.map((msg) => (
                  <div key={msg.offset} className="p-3.5 hover:bg-white/[0.02] transition text-xs font-mono">
                    <div className="flex items-center justify-between text-gray-400 mb-1.5">
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium">Offset #{msg.offset}</span>
                        <span className="bg-white/5 text-gray-300 px-1.5 py-0.5 rounded text-[10px]">
                          Partition: {msg.partition}
                        </span>
                        <span className="text-gray-500">Framing: {msg.magic}</span>
                      </div>
                      <span className="text-gray-500">{msg.timestamp}</span>
                    </div>
                    <div className="text-gray-300 font-medium text-[11px] mb-1">
                      Key: <span className="text-white">{msg.key}</span> ({msg.sizeBytes} bytes)
                    </div>
                    <pre className="bg-black/80 p-3 rounded-lg border border-white/5 text-gray-300 text-[11px] overflow-x-auto">
                      {msg.payload}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Producer Form */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <h4 className="text-xs font-medium font-mono text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Send size={14} className="text-white" />
              <span>Interactive Producer Test (Policy Engine Verification)</span>
            </h4>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-gray-400 mb-1">Target Topic</label>
                  <select
                    value={publishTopic}
                    onChange={(e) => setPublishTopic(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                  >
                    {topics.map((t) => (
                      <option key={t.name} value={t.name} className="bg-gray-900 text-white">
                        {t.name} ({t.legalRegion})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-gray-400 mb-1">Payload Type</label>
                  <input
                    type="text"
                    value="application/json"
                    disabled
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1">JSON Message Body</label>
                <textarea
                  rows={3}
                  value={publishPayload}
                  onChange={(e) => setPublishPayload(e.target.value)}
                  className="w-full bg-black/80 border border-white/10 rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-mono text-gray-500">
                  Enforces Legal Policy before broker commit
                </span>
                <button
                  onClick={handlePublish}
                  className="btn-gradient px-5 py-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
                >
                  <Send size={13} />
                  <span>Publish & Commit Message</span>
                </button>
              </div>

              {publishStatus && (
                <div
                  className={`mt-3 p-3.5 rounded-lg border text-xs font-mono ${
                    publishStatus.type === 'error'
                      ? 'border-purple-500/30 bg-purple-500/10 text-purple-200'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  }`}
                >
                  <div className="font-medium flex items-center gap-1.5">
                    {publishStatus.type === 'error' ? <ShieldAlert size={14} className="text-purple-300" /> : <CheckCircle2 size={14} />}
                    <span>{publishStatus.message}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
