/**
 * Hydra Stream - Kafka-UI Style Topic & Message Explorer
 * Inspired by provectus/kafka-ui.
 * Provides topic governance, partition inspection, live message stream,
 * and interactive producer testing.
 */

class KafkaExplorer {
  constructor(apiAdapter) {
    this.api = apiAdapter;
    this.selectedTopic = this.api.config.topics[0];
    this.selectedPartition = 0;
    this.messages = [];
    this.searchTerm = '';

    this.initMockMessages();
    this.init();
  }

  init() {
    this.renderTopicList();
    this.renderMessageStream();
    this.setupEventListeners();

    this.api.on('stateChange', () => {
      this.renderTopicList();
    });
  }

  initMockMessages() {
    const samplePayloads = {
      'gdpr-user-audit': [
        { userId: 'eu_usr_99812', action: 'EXPORT_REQUEST', consentTimestamp: '2026-11-01T01:20:00Z', legalJurisdiction: 'DE_EU' },
        { userId: 'eu_usr_84102', action: 'RIGHT_TO_FORGET', consentTimestamp: '2026-11-01T01:21:40Z', legalJurisdiction: 'DE_EU' },
        { userId: 'eu_usr_33190', action: 'DATA_MODIFICATION', consentTimestamp: '2026-11-01T01:22:15Z', legalJurisdiction: 'DE_EU' }
      ],
      'eu-payments': [
        { txnId: 'sepa_8892183', amount: 480.50, currency: 'EUR', ibanMasked: 'DE89...4401', authState: 'SETTLED' },
        { txnId: 'sepa_9918234', amount: 12500.00, currency: 'EUR', ibanMasked: 'FR76...9012', authState: 'SETTLED' }
      ],
      'upi-transactions': [
        { upiRef: 'upi_in_8849201', vpa: 'user@okhdfcbank', amount: 1500.00, currency: 'INR', status: 'SUCCESS' },
        { upiRef: 'upi_in_3391028', vpa: 'merchant@paytm', amount: 420.00, currency: 'INR', status: 'SUCCESS' }
      ],
      'apac-fx': [
        { pair: 'USD/SGD', rate: 1.3412, notional: 500000, tradeId: 'fx_sg_9921', venue: 'SGX' },
        { pair: 'EUR/SGD', rate: 1.4501, notional: 250000, tradeId: 'fx_sg_9922', venue: 'SGX' }
      ],
      'global-telemetry': [
        { sensorId: 'edge_node_04', packetLoss: 0.001, cpuUtil: 34.2, tempC: 48.1, routeBypass: 'NONE' },
        { sensorId: 'edge_node_19', packetLoss: 0.004, cpuUtil: 58.9, tempC: 52.3, routeBypass: 'BYPASS_INDIA' }
      ]
    };

    let offsetCounter = 1849100;
    this.messages = [];

    for (const topic of this.api.config.topics) {
      const payloads = samplePayloads[topic.name] || [];
      payloads.forEach((payload, idx) => {
        offsetCounter++;
        this.messages.push({
          magic: '0x48445201', // 'HDR\x01' in hex
          topic: topic.name,
          partition: idx % topic.partitions,
          offset: offsetCounter,
          timestamp: new Date(Date.now() - (idx * 15000)).toISOString(),
          key: `key_${topic.name}_${idx}`,
          payload: JSON.stringify(payload, null, 2),
          sizeBytes: 128 + Math.floor(Math.random() * 64)
        });
      });
    }
  }

  setupEventListeners() {
    // Topic filter search
    const searchInput = document.getElementById('topic-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase();
        this.renderTopicList();
      });
    }

    // Producer send button
    const btnPublish = document.getElementById('btn-publish-test');
    if (btnPublish) {
      btnPublish.addEventListener('click', () => {
        this.handlePublishTest();
      });
    }
  }

  renderTopicList() {
    const listEl = document.getElementById('topic-list-table');
    if (!listEl) return;

    const filtered = this.api.config.topics.filter(t => 
      t.name.toLowerCase().includes(this.searchTerm) ||
      t.legalRegion.toLowerCase().includes(this.searchTerm)
    );

    let html = '';
    filtered.forEach(topic => {
      const isSelected = this.selectedTopic.name === topic.name;
      const assignedBroker = this.api.state.activeRoutes[topic.name] || 'N/A';
      
      let badgeClass = 'bg-cyan-950 text-cyan-400 border-cyan-800';
      if (topic.legalRegion === 'Germany') badgeClass = 'bg-purple-950 text-purple-300 border-purple-800';
      else if (topic.legalRegion === 'India') badgeClass = 'bg-emerald-950 text-emerald-300 border-emerald-800';
      else if (topic.legalRegion === 'Singapore') badgeClass = 'bg-sky-950 text-sky-300 border-sky-800';

      html += `
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition ${isSelected ? 'bg-cyan-950/20 border-l-2 border-l-cyan-400' : ''}" 
            onclick="window.kafkaExplorer.selectTopic('${topic.name}')">
          <td class="py-3 px-4 font-mono font-bold text-white flex items-center gap-2">
            <span class="text-xs text-slate-500">#</span> ${topic.name}
          </td>
          <td class="py-3 px-4 font-mono text-xs text-slate-300">${topic.partitions}</td>
          <td class="py-3 px-4">
            <span class="text-[11px] font-mono px-2 py-0.5 rounded border ${badgeClass}">
              ${topic.legalRegion}
            </span>
          </td>
          <td class="py-3 px-4 font-mono text-xs text-slate-400">
            ${assignedBroker}
          </td>
          <td class="py-3 px-4 font-mono text-xs text-emerald-400 font-semibold">
            ${topic.messagesTotal.toLocaleString()}
          </td>
        </tr>
      `;
    });

    listEl.innerHTML = html;
  }

  selectTopic(topicName) {
    this.selectedTopic = this.api.config.topics.find(t => t.name === topicName);
    this.renderTopicList();
    this.renderTopicDetails();
    this.renderMessageStream();
  }

  renderTopicDetails() {
    const titleEl = document.getElementById('selected-topic-title');
    const badgeEl = document.getElementById('selected-topic-policy');
    const partitionsEl = document.getElementById('selected-topic-partitions');

    if (titleEl) titleEl.textContent = this.selectedTopic.name;
    if (badgeEl) badgeEl.textContent = this.selectedTopic.complianceRule;
    if (partitionsEl) partitionsEl.textContent = `${this.selectedTopic.partitions} Partitions (RingBuffer FIFO)`;
  }

  renderMessageStream() {
    const container = document.getElementById('message-stream-body');
    if (!container) return;

    const topicMsgs = this.messages.filter(m => m.topic === this.selectedTopic.name);

    if (topicMsgs.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500 font-mono text-xs">
          No retained messages in partition for topic '${this.selectedTopic.name}'.
        </div>
      `;
      return;
    }

    let html = '';
    topicMsgs.forEach(msg => {
      html += `
        <div class="border-b border-slate-800/80 p-3 hover:bg-slate-800/30 transition text-xs font-mono">
          <div class="flex items-center justify-between text-slate-400 mb-1.5">
            <div class="flex items-center gap-3">
              <span class="text-cyan-400 font-bold">Offset #${msg.offset}</span>
              <span class="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">Partition: ${msg.partition}</span>
              <span class="text-slate-500">Framing: ${msg.magic}</span>
            </div>
            <span class="text-slate-500">${msg.timestamp}</span>
          </div>
          <div class="text-slate-300 font-semibold text-[11px] mb-1">Key: <span class="text-white">${msg.key}</span> (${msg.sizeBytes} bytes)</div>
          <pre class="bg-slate-950 p-2.5 rounded border border-slate-800/70 text-slate-300 text-[11px] overflow-x-auto">${msg.payload}</pre>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  handlePublishTest() {
    const topicSelect = document.getElementById('publish-topic');
    const payloadInput = document.getElementById('publish-payload');
    const resultBox = document.getElementById('publish-result');

    const topicName = topicSelect ? topicSelect.value : this.selectedTopic.name;
    let payloadStr = payloadInput ? payloadInput.value : '{}';

    try {
      JSON.parse(payloadStr);
    } catch (e) {
      if (resultBox) {
        resultBox.className = 'mt-3 p-3 rounded-lg border border-rose-800 bg-rose-950/60 text-xs font-mono text-rose-300';
        resultBox.textContent = 'Invalid JSON: ' + e.message;
        resultBox.classList.remove('hidden');
      }
      return;
    }

    // Resolve Route via API adapter (checks GDPR / legal policy)
    const decision = this.api.resolveRoute(topicName, 'India');

    if (!decision.success) {
      if (resultBox) {
        resultBox.className = 'mt-3 p-3 rounded-lg border border-purple-800 bg-purple-950/80 text-xs font-mono text-purple-200';
        resultBox.innerHTML = `
          <div class="font-bold flex items-center gap-1.5 text-purple-300">
            <span>🛡️</span> ${decision.error}
          </div>
          <div class="text-[11px] text-purple-400 mt-1">Policy Engine Audit: EU GDPR Art. 44 Non-Spillover Rule strictly prevented cross-border leak.</div>
        `;
        resultBox.classList.remove('hidden');
      }
      return;
    }

    // Successfully routed
    const newOffset = 1849100 + this.messages.length + 1;
    const newMsg = {
      magic: '0x48445201',
      topic: topicName,
      partition: Math.floor(Math.random() * 4),
      offset: newOffset,
      timestamp: new Date().toISOString(),
      key: `client_evt_${Date.now()}`,
      payload: payloadStr,
      sizeBytes: payloadStr.length + 48
    };

    this.messages.unshift(newMsg);
    this.selectTopic(topicName);

    if (resultBox) {
      resultBox.className = 'mt-3 p-3 rounded-lg border border-emerald-800 bg-emerald-950/70 text-xs font-mono text-emerald-300';
      resultBox.innerHTML = `
        <div class="font-bold">✔ Message Acknowledged & Committed!</div>
        <div class="text-[11px] text-slate-300 mt-0.5">
          Broker: <span class="text-cyan-300">${decision.assignedBrokerId}</span> (${decision.region}) • 
          Offset: #${newOffset} • Latency: <span class="text-emerald-400">&lt; 0.2µs RingBuffer</span>
        </div>
      `;
      resultBox.classList.remove('hidden');
    }
  }
}

window.KafkaExplorer = KafkaExplorer;

