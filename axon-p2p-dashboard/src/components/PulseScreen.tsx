import React, { useEffect, useState, useRef } from 'react';
import { Peer, LogEntry } from '../types';

interface PulseScreenProps {
  peers: Peer[];
  logs: LogEntry[];
  continuousSync: boolean;
  setContinuousSync: (val: boolean) => void;
  onOpenMetrics: (peer: Peer) => void;
  onTriggerSync: () => void;
  peersSyncedCount: number;
}

export default function PulseScreen({
  peers,
  logs,
  continuousSync,
  setContinuousSync,
  onOpenMetrics,
  onTriggerSync,
  peersSyncedCount
}: PulseScreenProps) {
  const [internalLogs, setInternalLogs] = useState<LogEntry[]>(logs);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const activePeers = peers.filter(p => p.status === 'active');

  // Sync internal logs with parent logs
  useEffect(() => {
    setInternalLogs(logs);
  }, [logs]);

  // Scroll terminal logs to bottom on update
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [internalLogs]);

  // Inbound log injection simulation helper
  const handleSimulateInbound = () => {
    const randomLogs = [
      'Received 12 Delta references from Node_01_Alpha.',
      'Checking vector clock hashes: OK',
      'Local DAG depth matched index [42].',
      'Continuous Sync beacon received.',
      'Static routing updated for mDNS peer group.'
    ];
    const pick = randomLogs[Math.floor(Math.random() * randomLogs.length)];
    const newLog: LogEntry = {
      id: `sim-log-${Date.now()}`,
      text: `> ${pick}`,
      type: 'info',
      timestamp: new Date().toUTCString().split(' ')[4]
    };
    setInternalLogs(prev => [...prev, newLog]);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full max-w-7xl mx-auto mb-20 md:mb-0">
      
      {/* Left Sidebar / Meta Data (3 cols on desktop) */}
      <aside className="col-span-1 md:col-span-3 flex flex-col gap-6 brutalist-border-r pr-0 md:pr-6 border-b md:border-b-0 pb-6 md:pb-0">
        <div>
          <h2 className="font-sans text-sm font-bold uppercase tracking-widest mb-4 border-b border-deep-charcoal pb-2">
            Mesh Network
          </h2>
          
          {/* Active Peers Quick Nodes visual block */}
          <div className="flex items-center gap-2 mb-6 w-full overflow-hidden flex-wrap">
            {peers.map((peer, i) => (
              <div key={peer.id} className="flex items-center shrink-0">
                <div 
                  className={`px-2 py-1 font-mono text-[10px] brutalist-border ${
                    peer.status === 'active' 
                      ? (i === 1 ? 'bg-brand-orange text-white' : 'bg-deep-charcoal text-white')
                      : 'bg-bone-white text-secondary opacity-50'
                  }`}
                >
                  N_0{i + 1}
                </div>
                {i < peers.length - 1 && <div className="h-[1px] w-3 bg-deep-charcoal shrink-0"></div>}
              </div>
            ))}
          </div>

          <div className="flex flex-col">
            <span className="font-sans text-7xl font-black tracking-tighter leading-none">
              {activePeers.length > 0 ? peersSyncedCount : 0}
            </span>
            <span className="font-sans text-[11px] font-bold text-secondary uppercase tracking-widest mt-2">
              Peers Synced
            </span>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="mt-4 flex flex-col gap-3">
          <button 
            onClick={() => setContinuousSync(!continuousSync)}
            className="w-full flex items-center justify-between brutalist-border p-4 bg-surface-container hover:bg-surface-container-high transition-colors text-left"
          >
            <span className="font-sans text-xs font-bold uppercase tracking-wider text-deep-charcoal">
              Continuous Sync
            </span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 ${continuousSync ? 'bg-brand-orange animate-pulse' : 'bg-secondary'}`}></div>
              <span className="font-mono text-[10px] uppercase font-bold">
                {continuousSync ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </button>

          <button
            onClick={onTriggerSync}
            disabled={activePeers.length === 0}
            className="w-full brutalist-button-primary font-sans text-xs font-bold py-3 uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed text-center"
          >
            Sync State Now
          </button>
        </div>
      </aside>

      {/* Right Column / Primary dashboard (9 cols on desktop) */}
      <div className="col-span-1 md:col-span-9 flex flex-col gap-12 md:pl-6">
        
        {/* Section 1: Pulse Active Peers Grid */}
        <section>
          <div className="flex justify-between items-end mb-6 border-b border-deep-charcoal pb-2">
            <h2 className="font-sans text-lg font-bold uppercase tracking-tight text-deep-charcoal">
              Active Pulse
            </h2>
            <span className="font-mono text-xs text-secondary tracking-widest">
              LIVE_FEED
            </span>
          </div>

          {activePeers.length === 0 ? (
            <div className="brutalist-border p-8 bg-surface-container-low text-center font-mono text-xs text-secondary pulse-border">
              NO ACTIVE PEERS SYNCING. CHECK VAULT / SETTINGS TAB TO RESCAN OR HANDSHAKE PEERS.
            </div>
          ) : (
            <div className="flex flex-col">
              {activePeers.map((peer, i) => (
                <div 
                  key={peer.id}
                  className="grid grid-cols-12 gap-4 py-4 brutalist-border-b items-center hover:bg-surface-container transition-colors duration-75"
                >
                  <div className="col-span-1 flex justify-center">
                    <div className={`w-2.5 h-2.5 ${i === 0 ? 'bg-brand-orange' : 'bg-deep-charcoal'}`}></div>
                  </div>
                  
                  <div className="col-span-5 md:col-span-4">
                    <span className="font-sans text-[15px] font-bold text-deep-charcoal">
                      {peer.name}
                    </span>
                    <span className="block font-mono text-[11px] text-secondary">
                      IP: {peer.ip}
                    </span>
                  </div>

                  <div className="col-span-4 md:col-span-5 hidden sm:flex items-center gap-4">
                    <span className="font-mono text-xs text-secondary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">arrow_upward</span>
                      {peer.upstream}
                    </span>
                    <span className="font-mono text-xs text-secondary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">arrow_downward</span>
                      {peer.downstream}
                    </span>
                    <span className="font-mono text-[11px] text-secondary opacity-70">
                      ({peer.latency}ms)
                    </span>
                  </div>

                  <div className="col-span-6 md:col-span-2 flex justify-end">
                    <button 
                      onClick={() => onOpenMetrics(peer)}
                      className="font-sans text-xs font-bold uppercase brutalist-border px-3 py-1.5 hover:bg-deep-charcoal hover:text-bone-white transition-colors"
                    >
                      Metrics
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Split Grid for Logs Terminal and Network Topology */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Operation Log Terminal Block */}
          <section className="brutalist-border flex flex-col h-[320px]">
            <div className="border-b border-deep-charcoal p-3 bg-surface-container-low flex justify-between items-center">
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-deep-charcoal">
                Operation Log
              </h3>
              <button 
                onClick={handleSimulateInbound}
                title="Inject Debug Handshake"
                className="flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 border border-deep-charcoal hover:bg-deep-charcoal hover:text-bone-white transition-colors"
              >
                <span className="material-symbols-outlined text-[12px]">add</span> Inject Log
              </button>
            </div>
            
            <div className="p-4 flex-grow overflow-y-auto bg-deep-charcoal text-bone-white font-mono text-xs leading-relaxed flex flex-col justify-end">
              <div className="space-y-1 overflow-y-auto max-h-full">
                {internalLogs.map((log) => (
                  <div key={log.id} className="text-bone-white text-opacity-80 break-words">
                    <span className="text-secondary select-none font-medium mr-2">[{log.timestamp}]</span>
                    <span className={
                      log.type === 'success' ? 'text-green-400' :
                      log.type === 'warn' ? 'text-yellow-400' :
                      log.type === 'error' ? 'text-brand-orange' : 'text-bone-white'
                    }>
                      {log.text}
                    </span>
                  </div>
                ))}
                
                {continuousSync && (
                  <div className="text-brand-orange animate-pulse flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 bg-brand-orange rounded-full"></span>
                    <span>&gt; SYNC_ROUTINE_ACTIVE :: Scanning subnet...</span>
                  </div>
                )}
                <div ref={terminalEndRef} />
              </div>
            </div>
          </section>

          {/* Network Topology Visualizer Block */}
          <section className="brutalist-border flex flex-col h-[320px]">
            <div className="border-b border-deep-charcoal p-3 bg-surface-container-low flex justify-between items-center">
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-deep-charcoal">
                Network Topology
              </h3>
              <span className="material-symbols-outlined text-secondary text-sm">hub</span>
            </div>

            <div className="p-4 flex-grow relative bg-bone-white overflow-hidden flex items-center justify-center">
              {/* Animated brutalist network rings */}
              <div className="absolute inset-0 border border-deep-charcoal border-opacity-10 pulse-border m-8 pointer-events-none"></div>
              <div className="absolute inset-0 border border-deep-charcoal border-opacity-10 pulse-border m-16 pointer-events-none" style={{ animationDelay: '0.5s' }}></div>
              <div className="absolute inset-0 border border-deep-charcoal border-opacity-10 pulse-border m-24 pointer-events-none" style={{ animationDelay: '1s' }}></div>
              
              <div className="text-center z-10 bg-bone-white p-4 brutalist-border relative">
                {/* Visual marker corner dots */}
                <div className="absolute top-0 left-0 w-1.5 h-1.5 bg-deep-charcoal transform -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-deep-charcoal transform translate-x-1/2 translate-y-1/2"></div>

                <span className="material-symbols-outlined text-3xl spin-loader text-deep-charcoal block mb-2">
                  radar
                </span>
                <div className="font-mono text-[11px] font-bold text-deep-charcoal">
                  {activePeers.length > 0 ? 'LISTENING_ACTIVE' : 'AWAITING_SIGNAL'}
                </div>
                <div className="font-mono text-[9px] text-secondary mt-0.5 uppercase">
                  Port: 4432
                </div>
              </div>
            </div>
          </section>

        </div>

      </div>

    </div>
  );
}
