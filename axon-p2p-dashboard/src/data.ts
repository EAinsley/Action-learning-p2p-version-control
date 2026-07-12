import { Peer, Commit, Conflict, TransferStream, LogEntry } from './types';

export const INITIAL_PEERS: Peer[] = [
  {
    id: 'node-01',
    name: 'Node_01_Alpha',
    ip: '192.168.1.15',
    status: 'active',
    discoveryMethod: 'mDNS',
    upstream: '1.2M/s',
    downstream: '0.5M/s',
    fingerprint: '0x7F8A9B2C4D1E3F5A6B7C8D9E0F1A2B3C',
    latency: 14
  },
  {
    id: 'node-02',
    name: 'Node_02_Beta',
    ip: '192.168.1.28',
    status: 'active',
    discoveryMethod: 'Direct IP',
    upstream: '0.8M/s',
    downstream: '2.1M/s',
    fingerprint: '0x8F9A3B21CD4E5F6A7B8C9D0E1F2A3B4C',
    latency: 24
  },
  {
    id: 'node-03',
    name: 'Node_03_Gamma',
    ip: '192.168.1.42',
    status: 'active',
    discoveryMethod: 'mDNS',
    upstream: '0.1M/s',
    downstream: '0.0M/s',
    fingerprint: '0x9A8B7C6D5E4F3D2C1B0A9F8E7D6C5B4A',
    latency: 38
  },
  {
    id: 'node-04',
    name: 'Cafe_Node',
    ip: '192.168.8.102',
    status: 'inactive',
    discoveryMethod: 'Direct IP',
    upstream: '0.0M/s',
    downstream: '0.0M/s',
    fingerprint: '0x3D4E1A2B9C8D7F6E5B4A3D2C1B0A9F8E',
    latency: 0
  }
];

export const INITIAL_COMMITS: Commit[] = [
  {
    id: 'commit-3',
    title: 'Vector Clock Synced',
    timestamp: '14:32:05 UTC',
    description: 'State converged across all active peers. Vector clock: [42, 17, 8].',
    hash: 'c9f8a7d'
  },
  {
    id: 'commit-2',
    title: 'Delta Payload Received',
    timestamp: '11:15:22 UTC',
    description: 'Incoming delta from Node_02_Beta applied to local state.',
    hash: 'b3e21c4',
    diff: {
      removed: 'old_reference = [12, 45, 88]',
      added: 'new_reference = [12, 45, 88, 102]'
    }
  },
  {
    id: 'commit-1',
    title: 'Genesis State',
    timestamp: '09:00:00 UTC',
    description: 'Local node initialized and genesis block verified.',
    hash: 'a1d9f8e'
  }
];

export const INITIAL_CONFLICTS: Conflict[] = [
  {
    id: 'conflict-1',
    filepath: '/src/core/network_node.ts',
    lineStart: 106,
    lineEnd: 107,
    localVersion: 'v42',
    remoteVersion: 'v45',
    localTime: '10:14',
    remoteTime: '10:15',
    lamportClock: '[L: 42, R: 45]',
    localContent: 'const connection = await this.transport.dial(peerId, { timeout: 5000 });',
    remoteContent: 'const connection = await this.transport.dialWithRetry(peerId, 3);',
    oldReference: 'const connection = await this.transport.dial(peerId);',
    newReference: 'const connection = await this.transport.dial(peerId, { timeout: 5000 });',
    resolved: false
  },
  {
    id: 'conflict-2',
    filepath: '/config/peer_registry.json',
    lineStart: 12,
    lineEnd: 14,
    localVersion: 'v12',
    remoteVersion: 'v14',
    localTime: '09:02',
    remoteTime: '09:45',
    lamportClock: '[L: 12, R: 14]',
    localContent: '  "peers": ["node_1_alpha", "node_2_beta"]',
    remoteContent: '  "peers": ["node_1_alpha", "node_2_beta", "node_3_gamma"]',
    oldReference: '  "peers": ["node_1_alpha"]',
    newReference: '  "peers": ["node_1_alpha", "node_2_beta"]',
    resolved: false
  },
  {
    id: 'conflict-3',
    filepath: '/docs/architecture_v2.md',
    lineStart: 1,
    lineEnd: 2,
    localVersion: 'v88',
    remoteVersion: 'v89',
    localTime: 'Yesterday',
    remoteTime: '08:30',
    lamportClock: '[L: 88, R: 89]',
    localContent: '# Architecture v2 - Single Core Router (Local)',
    remoteContent: '# Architecture v2 - Dual Distributed Core (Remote)',
    oldReference: '# Architecture v2 - Initial Draft',
    newReference: '# Architecture v2 - Single Core Router',
    resolved: false
  }
];

export const INITIAL_STREAMS: TransferStream[] = [
  {
    id: 'stream-1',
    filename: 'obj_a1b2c3d4.pack',
    size: '450 MB',
    progress: 78,
    speed: '35.8 MB/s',
    type: 'PULL',
    status: 'active'
  },
  {
    id: 'stream-2',
    filename: 'idx_e5f6g7h8.bin',
    size: '12 MB',
    progress: 100,
    speed: '0.0 MB/s',
    type: 'PUSH',
    status: 'verifying'
  },
  {
    id: 'stream-3',
    filename: 'tree_9i0j1k2l.pack',
    size: '1.2 GB',
    progress: 12,
    speed: '10.0 MB/s',
    type: 'PULL',
    status: 'active'
  }
];

export const INITIAL_LOGS: LogEntry[] = [
  {
    id: 'log-1',
    text: 'Init handshake protocol... OK',
    type: 'info',
    timestamp: '14:30:00'
  },
  {
    id: 'log-2',
    text: 'Verifying local manifest hashes... OK',
    type: 'success',
    timestamp: '14:30:02'
  },
  {
    id: 'log-3',
    text: 'Broadcasting discovery beacon [PORT 4432]...',
    type: 'info',
    timestamp: '14:30:05'
  },
  {
    id: 'log-4',
    text: 'Awaiting peer response timeout=30s...',
    type: 'warn',
    timestamp: '14:30:10'
  }
];
