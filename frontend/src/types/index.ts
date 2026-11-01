export interface BrokerNode {
  id: string;
  region: string;
  endpoint: string;
  health_port?: number;
  healthPort?: number;
  status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | string;
  rtt: number; // ms
  packet_loss?: number;
  packetLoss?: number;
  storage?: string;
  boundTopics?: string[];
  lat?: number;
  lng?: number;
  flag?: string;
  name?: string;
}

export interface TopicPolicy {
  name: string;
  partitions: number;
  legalRegion: string;
  compliance?: string;
  replicationFactor?: number;
  messagesTotal?: number;
  consumerLag?: number;
}

export interface RouteDecision {
  topic: string;
  assigned_broker_id?: string;
  assignedBrokerId?: string;
  assigned_endpoint?: string;
  assignedEndpoint?: string;
  region: string;
  score: number;
  is_bypassing_slow_link?: boolean;
  isBypassingSlowLink?: boolean;
  reason: string;
  error?: string;
}

export interface ConsumerGroup {
  groupId: string;
  topic: string;
  state: 'Stable' | 'Rebalancing' | 'Dead' | 'Empty';
  membersCount: number;
  totalLag: number;
  assignedBroker: string;
  coordinatorRegion: string;
}

export interface TelemetryEvent {
  id: string;
  timestamp: string;
  category: 'Discovery' | 'Routing' | 'ChaosEngine' | 'Compliance' | 'System' | 'Traffic' | 'Security';
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

export interface PartitionCommitLog {
  magic: string;
  topic: string;
  partition: number;
  offset: number;
  timestamp: string;
  key: string;
  payload: string;
  sizeBytes: number;
}

export interface ClusterStatusSummary {
  status: 'HEALTHY' | 'DEGRADED' | 'LOCAL_QUORUM' | 'SYNCING' | 'WAITING';
  activeBrokers: number;
  healthyBrokers: number;
  degradedBrokers: number;
  etcdConnected: boolean;
  promConnected: boolean;
}

