import React, { useState, useEffect } from 'react';
import { Peer, Commit, Conflict, LogEntry } from './types';
import { 
  INITIAL_PEERS, 
  INITIAL_COMMITS, 
  INITIAL_CONFLICTS, 
  INITIAL_LOGS 
} from './data';

import BootScreen from './components/BootScreen';
import PulseScreen from './components/PulseScreen';
import TimelineScreen from './components/TimelineScreen';
import ConflictScreen from './components/ConflictScreen';
import VaultScreen from './components/VaultScreen';
import MetricsScreen from './components/MetricsScreen';

export default function App() {
  const [booted, setBooted] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'PULSE' | 'TIMELINE' | 'CONFLICTS' | 'SETTINGS'>('PULSE');
  
  // App state
  const [peers, setPeers] = useState<Peer[]>(INITIAL_PEERS);
  const [commits, setCommits] = useState<Commit[]>(INITIAL_COMMITS);
  const [conflicts, setConflicts] = useState<Conflict[]>(INITIAL_CONFLICTS);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);

  // Expose state setters to Java
  useEffect(() => {
    (window as any).updatePeers = (peersJson: string) => {
      try {
        setPeers(JSON.parse(peersJson));
      } catch (e) { console.error(e); }
    };
    (window as any).updateCommits = (commitsJson: string) => {
      try {
        setCommits(JSON.parse(commitsJson));
      } catch (e) { console.error(e); }
    };
    (window as any).updateConflicts = (conflictsJson: string) => {
      try {
        setConflicts(JSON.parse(conflictsJson));
      } catch (e) { console.error(e); }
    };
    (window as any).addLog = (text: string, type: 'info' | 'success' | 'warn' | 'error') => {
      const newLog: LogEntry = {
        id: `java-log-${Date.now()}-${Math.random()}`,
        text,
        type,
        timestamp: new Date().toUTCString().split(' ')[4]
      };
      setLogs((prev) => {
        if (prev.length > 25) return [...prev.slice(1), newLog];
        return [...prev, newLog];
      });
    };
    (window as any).setPeersSyncedCount = (count: number) => {
      setPeersSyncedCount(count);
    };
  }, []);
  
  // Interactive variables
  const [continuousSync, setContinuousSync] = useState<boolean>(true);
  const [localDiscovery, setLocalDiscovery] = useState<boolean>(true);
  const [peersSyncedCount, setPeersSyncedCount] = useState<number>(42);
  const [selectedMetricsPeer, setSelectedMetricsPeer] = useState<Peer | null>(null);

  // Background simulation tick
  useEffect(() => {
    if (!booted) return;

    // Periodically fluctuate values slightly to mimic decentralized mesh network sync
    const interval = setInterval(() => {
      const activePeersList = peers.filter(p => p.status === 'active');
      if (activePeersList.length === 0) {
        setPeersSyncedCount(0);
        return;
      }

      // Slightly fluctuate the synced count around a logical baseline
      setPeersSyncedCount((prev) => {
        const baseline = activePeersList.length * 14; // e.g., 3 peers active -> baseline 42
        const drift = Math.random() > 0.5 ? 1 : -1;
        const next = prev + drift;
        return next < baseline - 3 ? baseline - 2 : next > baseline + 3 ? baseline + 2 : next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [booted, peers]);

  // Continuous sync logging simulation
  useEffect(() => {
    if (!booted || !continuousSync) return;

    const interval = setInterval(() => {
      const activePeersList = peers.filter(p => p.status === 'active');
      if (activePeersList.length === 0) return;

      const randomLogs = [
        'Periodic mesh topology verified: OK',
        'Continuous sync: broadcasted local DAG height references.',
        'Incoming vector clock matches checksum [42, 17, 8].',
        'State sync running. Verified zero vector drift with peers.',
        ' mDNS multicast broadcast sent on port 4432.'
      ];
      
      const text = randomLogs[Math.floor(Math.random() * randomLogs.length)];
      const newLog: LogEntry = {
        id: `sync-log-${Date.now()}`,
        text: `> ${text}`,
        type: 'success',
        timestamp: new Date().toUTCString().split(' ')[4]
      };

      setLogs((prev) => {
        if (prev.length > 25) return [...prev.slice(1), newLog];
        return [...prev, newLog];
      });
    }, 6000);

    return () => clearInterval(interval);
  }, [booted, continuousSync, peers]);

  // Handle peer handshake connection
  const handleConnectPeer = (ip: string) => {
    if ((window as any).javaApp) {
      try {
        (window as any).javaApp.connectPeer(ip);
      } catch (e) { console.error(e); }
    }
    // Check if we already have it
    const existingIndex = peers.findIndex((p) => p.ip === ip);
    let updatedPeers = [...peers];

    const timestamp = new Date().toUTCString().split(' ')[4];
    let peerName = '';

    if (existingIndex !== -1) {
      updatedPeers[existingIndex].status = 'active';
      peerName = updatedPeers[existingIndex].name;
    } else {
      // Generate a dynamic peer
      const num = peers.length + 1;
      peerName = `Node_0${num}_Delta`;
      const newPeer: Peer = {
        id: `node-gen-${Date.now()}`,
        name: peerName,
        ip: ip,
        status: 'active',
        discoveryMethod: 'Direct IP',
        upstream: '0.4M/s',
        downstream: '1.5M/s',
        fingerprint: `0x${Math.random().toString(16).substring(2, 10).toUpperCase()}A9B2C4D1E3F5A6B7C8D9E0F1`,
        latency: Math.floor(Math.random() * 30) + 10
      };
      updatedPeers.push(newPeer);
    }

    setPeers(updatedPeers);

    // Add log
    const connectLog: LogEntry = {
      id: `conn-log-${Date.now()}`,
      text: `HANDSHAKE COMPLETED. Connected to ${peerName} at ${ip}.`,
      type: 'success',
      timestamp
    };
    setLogs((prev) => [...prev, connectLog]);
  };

  // Handle peer disconnection
  const handleDisconnectPeer = (id: string) => {
    const peer = peers.find(p => p.id === id);
    if (!peer) return;

    if ((window as any).javaApp) {
      try {
        (window as any).javaApp.disconnectPeer(id);
      } catch (e) { console.error(e); }
    }

    setPeers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'inactive' } : p))
    );

    const timestamp = new Date().toUTCString().split(' ')[4];
    const disconnectLog: LogEntry = {
      id: `disc-log-${Date.now()}`,
      text: `PEER TERMINATED: ${peer.name} has been disconnected.`,
      type: 'warn',
      timestamp
    };
    setLogs((prev) => [...prev, disconnectLog]);
  };

  // Restores standard active peer list (rescan empty network fallback)
  const handleRescanNetwork = () => {
    setPeers(INITIAL_PEERS);
    setPeersSyncedCount(42);
    
    const timestamp = new Date().toUTCString().split(' ')[4];
    const rescanLog: LogEntry = {
      id: `rescan-log-${Date.now()}`,
      text: 'Discovery scanner executed. Found 3 active peers.',
      type: 'success',
      timestamp
    };
    setLogs((prev) => [...prev, rescanLog]);
  };

  // Perform a manual vector clock sync action
  const handleTriggerSync = () => {
    if ((window as any).javaApp) {
      try {
        (window as any).javaApp.triggerSync();
      } catch (e) { console.error(e); }
    }
    const timestamp = new Date().toUTCString().split(' ')[4];
    const newLog: LogEntry = {
      id: `sync-trigger-${Date.now()}`,
      text: 'Initiated full mesh synchronization: convergence complete.',
      type: 'success',
      timestamp
    };
    
    setLogs((prev) => [...prev, newLog]);
    setPeersSyncedCount((prev) => prev + 1);
  };

  // Resolve conflict logic
  const handleResolveConflict = (id: string, method: 'local' | 'remote' | 'manual') => {
    const conflict = conflicts.find((c) => c.id === id);
    if (!conflict) return;

    if ((window as any).javaApp) {
      try {
        (window as any).javaApp.resolveConflict(conflict.filepath, method);
      } catch (e) { console.error(e); }
    }

    // Resolve conflict
    setConflicts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, resolved: true, resolvedWith: method } : c))
    );

    const timestamp = new Date().toUTCString().split(' ')[4];
    const hash = Math.random().toString(16).substring(2, 9);
    
    let resolutionTitle = '';
    let resolutionDesc = '';
    let solvedCodeLine = '';

    if (method === 'local') {
      resolutionTitle = `Vector Resolved [Local Winner]`;
      resolutionDesc = `Conflict in ${conflict.filepath} resolved by keeping local block. Vector clock incremented.`;
      solvedCodeLine = conflict.localContent;
    } else if (method === 'remote') {
      resolutionTitle = `Vector Resolved [Remote Winner]`;
      resolutionDesc = `Conflict in ${conflict.filepath} resolved by keeping remote block. Applied remote delta.`;
      solvedCodeLine = conflict.remoteContent;
    } else {
      resolutionTitle = `Manual Merge Completed`;
      resolutionDesc = `Conflict in ${conflict.filepath} merged manually with unified references.`;
      // Combined mock merge output line
      solvedCodeLine = 'const connection = await this.transport.dial(peerId, { timeout: 5000, retryCount: 3 });';
    }

    // Add commit to version history
    const newCommit: Commit = {
      id: `commit-resolved-${Date.now()}`,
      title: resolutionTitle,
      timestamp,
      description: resolutionDesc,
      hash,
      diff: {
        removed: conflict.oldReference,
        added: solvedCodeLine
      }
    };

    setCommits((prev) => [newCommit, ...prev]);

    // Add log
    const successLog: LogEntry = {
      id: `resolve-log-${Date.now()}`,
      text: `CONFLICT RESOLVED: ${conflict.filepath} merged successfully via ${method.toUpperCase()}.`,
      type: 'success',
      timestamp
    };
    setLogs((prev) => [...prev, successLog]);
  };

  // Reset conflict simulation to allow replay
  const handleResetConflicts = () => {
    setConflicts(INITIAL_CONFLICTS);
    setCommits(INITIAL_COMMITS);
    
    const timestamp = new Date().toUTCString().split(' ')[4];
    const resetLog: LogEntry = {
      id: `reset-conf-${Date.now()}`,
      text: 'Conflict matrices reinitialized. 3 unresolved vectors injected.',
      type: 'warn',
      timestamp
    };
    setLogs((prev) => [...prev, resetLog]);
  };

  // Conditional splash boot screen
  if (!booted) {
    return <BootScreen onComplete={() => setBooted(true)} />;
  }

  return (
    <div className="min-h-screen bg-bone-white text-deep-charcoal flex flex-col font-sans antialiased pb-24 md:pb-0 select-none">
      
      {/* Dynamic Top Header Navigation */}
      <header className="w-full top-0 sticky bg-bone-white text-deep-charcoal border-b border-deep-charcoal z-40">
        <div className="flex justify-between items-center px-6 md:px-16 py-4 w-full">
          
          {/* Logo Brand Anchor */}
          <div 
            onClick={() => {
              setActiveTab('PULSE');
              setSelectedMetricsPeer(null);
            }}
            className="flex items-center gap-3 cursor-pointer scale-100 hover:opacity-85 active:translate-x-[1px] active:translate-y-[1px]"
          >
            <span className="material-symbols-outlined text-deep-charcoal" style={{ fontVariationSettings: "'FILL' 1" }}>
              folder
            </span>
            <span className="font-sans text-base font-black tracking-tighter text-deep-charcoal uppercase select-none">
              REPOSITORY_ALPHA
            </span>
          </div>

          {/* Web Navigation Layout (Hidden on Mobile) */}
          <nav className="hidden md:flex items-center gap-2 font-sans text-xs font-bold uppercase tracking-widest">
            <button 
              onClick={() => {
                setActiveTab('PULSE');
                setSelectedMetricsPeer(null);
              }}
              className={`px-4 py-2 transition-colors ${
                activeTab === 'PULSE' && !selectedMetricsPeer
                  ? 'bg-deep-charcoal text-bone-white brutalist-border' 
                  : 'text-secondary hover:bg-surface-container'
              }`}
            >
              PULSE
            </button>
            <button 
              onClick={() => {
                setActiveTab('TIMELINE');
                setSelectedMetricsPeer(null);
              }}
              className={`px-4 py-2 transition-colors ${
                activeTab === 'TIMELINE' 
                  ? 'bg-deep-charcoal text-bone-white brutalist-border' 
                  : 'text-secondary hover:bg-surface-container'
              }`}
            >
              TIMELINE
            </button>
            <button 
              onClick={() => {
                setActiveTab('CONFLICTS');
                setSelectedMetricsPeer(null);
              }}
              className={`px-4 py-2 transition-colors relative ${
                activeTab === 'CONFLICTS' 
                  ? 'bg-deep-charcoal text-bone-white brutalist-border' 
                  : 'text-secondary hover:bg-surface-container'
              }`}
            >
              CONFLICT LOG
              {conflicts.filter(c => !c.resolved).length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-brand-orange text-[9px] font-mono text-white flex items-center justify-center font-bold">
                  {conflicts.filter(c => !c.resolved).length}
                </span>
              )}
            </button>
            <button 
              onClick={() => {
                setActiveTab('SETTINGS');
                setSelectedMetricsPeer(null);
              }}
              className={`px-4 py-2 transition-colors ${
                activeTab === 'SETTINGS' 
                  ? 'bg-deep-charcoal text-bone-white brutalist-border' 
                  : 'text-secondary hover:bg-surface-container'
              }`}
            >
              VAULT
            </button>
          </nav>

          {/* Synced status indicator block */}
          <div className="flex items-center gap-3">
            {selectedMetricsPeer ? (
              <button 
                onClick={() => setSelectedMetricsPeer(null)}
                className="font-sans text-[11px] font-bold uppercase tracking-wider border border-deep-charcoal px-3 py-1.5 hover:bg-deep-charcoal hover:text-bone-white transition-all"
              >
                CLOSE
              </button>
            ) : null}
            
            <div className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-wider text-deep-charcoal bg-bone-white border border-deep-charcoal px-3 py-1.5">
              <span className={`w-2 h-2 ${continuousSync ? 'bg-brand-orange animate-pulse' : 'bg-deep-charcoal'}`}></span>
              <span>{continuousSync ? 'SYNCING...' : 'SYNCED'}</span>
            </div>
          </div>

        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-grow w-full px-6 md:px-16 py-8 md:py-12">
        {selectedMetricsPeer ? (
          
          /* Screen 6/8 Detail metrics sub-renderer */
          <MetricsScreen 
            peer={selectedMetricsPeer} 
            onClose={() => setSelectedMetricsPeer(null)} 
          />

        ) : (
          
          /* Tab router */
          <>
            {activeTab === 'PULSE' && (
              <PulseScreen
                peers={peers}
                logs={logs}
                continuousSync={continuousSync}
                setContinuousSync={setContinuousSync}
                onOpenMetrics={(p) => setSelectedMetricsPeer(p)}
                onTriggerSync={handleTriggerSync}
                peersSyncedCount={peersSyncedCount}
              />
            )}

            {activeTab === 'TIMELINE' && (
              <TimelineScreen
                commits={commits}
                onForceRefresh={handleResetConflicts}
              />
            )}

            {activeTab === 'CONFLICTS' && (
              <ConflictScreen
                conflicts={conflicts}
                onResolve={handleResolveConflict}
                onReset={handleResetConflicts}
                onGoToTab={(tab) => {
                  if (tab === 'PULSE') setActiveTab('PULSE');
                }}
              />
            )}

            {activeTab === 'SETTINGS' && (
              <VaultScreen
                peers={peers}
                localDiscovery={localDiscovery}
                setLocalDiscovery={setLocalDiscovery}
                onConnectPeer={handleConnectPeer}
                onDisconnectPeer={handleDisconnectPeer}
                onRescanNetwork={handleRescanNetwork}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Visible only on mobile) */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 bg-bone-white border-t border-deep-charcoal h-16 flex justify-around items-stretch">
        
        {/* Pulse tab button */}
        <button 
          onClick={() => {
            setActiveTab('PULSE');
            setSelectedMetricsPeer(null);
          }}
          className={`flex flex-col items-center justify-center h-full flex-1 transition-colors ${
            activeTab === 'PULSE' && !selectedMetricsPeer 
              ? 'bg-deep-charcoal text-bone-white' 
              : 'text-deep-charcoal hover:bg-surface-container'
          }`}
        >
          <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: activeTab === 'PULSE' && !selectedMetricsPeer ? "'FILL' 1" : "'FILL' 0" }}>
            analytics
          </span>
          <span className="font-sans font-bold text-[10px] uppercase tracking-widest">PULSE</span>
        </button>

        {/* Timeline tab button */}
        <button 
          onClick={() => {
            setActiveTab('TIMELINE');
            setSelectedMetricsPeer(null);
          }}
          className={`flex flex-col items-center justify-center h-full flex-1 transition-colors ${
            activeTab === 'TIMELINE' 
              ? 'bg-deep-charcoal text-bone-white' 
              : 'text-deep-charcoal hover:bg-surface-container'
          }`}
        >
          <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: activeTab === 'TIMELINE' ? "'FILL' 1" : "'FILL' 0" }}>
            history
          </span>
          <span className="font-sans font-bold text-[10px] uppercase tracking-widest">TIMELINE</span>
        </button>

        {/* Conflicts/Vault hybrid logic mapped to responsive pivot buttons */}
        <button 
          onClick={() => {
            setActiveTab('CONFLICTS');
            setSelectedMetricsPeer(null);
          }}
          className={`flex flex-col items-center justify-center h-full flex-1 transition-colors relative ${
            activeTab === 'CONFLICTS' 
              ? 'bg-deep-charcoal text-bone-white' 
              : 'text-deep-charcoal hover:bg-surface-container'
          }`}
        >
          <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: activeTab === 'CONFLICTS' ? "'FILL' 1" : "'FILL' 0" }}>
            warning
          </span>
          <span className="font-sans font-bold text-[10px] uppercase tracking-widest">CONFLICTS</span>
          {conflicts.filter(c => !c.resolved).length > 0 && (
            <span className="absolute top-2 right-4 w-3.5 h-3.5 bg-brand-orange text-[8px] font-mono text-white flex items-center justify-center font-bold">
              {conflicts.filter(c => !c.resolved).length}
            </span>
          )}
        </button>

        {/* Vault tab button */}
        <button 
          onClick={() => {
            setActiveTab('SETTINGS');
            setSelectedMetricsPeer(null);
          }}
          className={`flex flex-col items-center justify-center h-full flex-1 transition-colors ${
            activeTab === 'SETTINGS' 
              ? 'bg-deep-charcoal text-bone-white' 
              : 'text-deep-charcoal hover:bg-surface-container'
          }`}
        >
          <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: activeTab === 'SETTINGS' ? "'FILL' 1" : "'FILL' 0" }}>
            inventory_2
          </span>
          <span className="font-sans font-bold text-[10px] uppercase tracking-widest">VAULT</span>
        </button>

      </nav>

    </div>
  );
}
