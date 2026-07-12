export interface Peer {
  id: string;
  name: string;
  ip: string;
  status: 'active' | 'inactive';
  discoveryMethod: 'mDNS' | 'Direct IP';
  upstream: string; // e.g. "1.2M/s"
  downstream: string; // e.g. "0.5M/s"
  fingerprint: string;
  latency: number;
}

export interface Commit {
  id: string;
  title: string;
  timestamp: string;
  description: string;
  hash: string;
  diff?: {
    removed: string;
    added: string;
  };
}

export interface Conflict {
  id: string;
  filepath: string;
  lineStart: number;
  lineEnd: number;
  localVersion: string;
  remoteVersion: string;
  localTime: string;
  remoteTime: string;
  lamportClock: string;
  localContent: string;
  remoteContent: string;
  oldReference: string;
  newReference: string;
  resolved: boolean;
  resolvedWith?: 'local' | 'remote' | 'manual';
}

export interface TransferStream {
  id: string;
  filename: string;
  size: string;
  progress: number;
  speed: string;
  type: 'PULL' | 'PUSH';
  status: 'active' | 'verifying' | 'completed' | 'cancelled';
}

export interface LogEntry {
  id: string;
  text: string;
  type: 'info' | 'success' | 'warn' | 'error';
  timestamp: string;
}
