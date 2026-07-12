import React, { useState } from 'react';
import { Peer } from '../types';

interface VaultScreenProps {
  peers: Peer[];
  localDiscovery: boolean;
  setLocalDiscovery: (val: boolean) => void;
  onConnectPeer: (ip: string) => void;
  onDisconnectPeer: (id: string) => void;
  onRescanNetwork: () => void;
}

export default function VaultScreen({
  peers,
  localDiscovery,
  setLocalDiscovery,
  onConnectPeer,
  onDisconnectPeer,
  onRescanNetwork
}: VaultScreenProps) {
  const [ipAddress, setIpAddress] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [activeSideLink, setActiveSideLink] = useState<'mesh' | 'keys' | 'limits'>('mesh');

  const handleHandshakeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipAddress.trim()) return;

    setConnecting(true);
    // Simulate handshake handshake
    setTimeout(() => {
      onConnectPeer(ipAddress);
      setIpAddress('');
      setConnecting(false);
    }, 1200);
  };

  // If all peers are disconnected or inactive, trigger empty state
  const activePeersCount = peers.filter(p => p.status === 'active').length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full max-w-7xl mx-auto mb-20 md:mb-0">
      
      {/* Left Sidebar / Metadata Column (3 cols) */}
      <aside className="col-span-1 md:col-span-3 flex flex-col gap-6 brutalist-border-r pr-0 md:pr-6 border-b md:border-b-0 pb-6 md:pb-0">
        <div>
          <h2 className="font-sans text-sm font-bold uppercase tracking-widest mb-4 border-b border-deep-charcoal pb-2">
            Network Node
          </h2>
          <div className="brutalist-border p-4 bg-deep-charcoal text-bone-white">
            <p className="font-sans text-[10px] text-secondary uppercase tracking-widest mb-1">
              Local Identity
            </p>
            <p className="font-mono text-xs font-bold break-all">
              NODE-7A9B-X1
            </p>
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          <button 
            onClick={() => setActiveSideLink('keys')}
            className={`font-sans text-xs font-bold py-2.5 brutalist-border-b flex justify-between items-center px-2 text-left transition-colors ${
              activeSideLink === 'keys' ? 'bg-deep-charcoal text-bone-white' : 'hover:bg-surface-container text-deep-charcoal'
            }`}
          >
            <span>Identity Keys</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
          
          <button 
            onClick={() => setActiveSideLink('mesh')}
            className={`font-sans text-xs font-bold py-2.5 brutalist-border-b flex justify-between items-center px-2 text-left transition-colors ${
              activeSideLink === 'mesh' ? 'bg-deep-charcoal text-bone-white' : 'hover:bg-surface-container text-deep-charcoal'
            }`}
          >
            <span>Mesh Network</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
          
          <button 
            onClick={() => setActiveSideLink('limits')}
            className={`font-sans text-xs font-bold py-2.5 brutalist-border-b flex justify-between items-center px-2 text-left transition-colors ${
              activeSideLink === 'limits' ? 'bg-deep-charcoal text-bone-white' : 'hover:bg-surface-container text-deep-charcoal'
            }`}
          >
            <span>Bandwidth Limits</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </nav>
      </aside>

      {/* Right Content Column (9 cols) */}
      <div className="col-span-1 md:col-span-9 flex flex-col gap-8">
        
        {/* Page Header */}
        <section className="brutalist-border-b pb-6">
          <h2 className="font-sans text-2xl md:text-3xl font-black tracking-tighter uppercase leading-none mb-3">
            Mesh Network
          </h2>
          <p className="font-sans text-xs md:text-sm text-secondary max-w-2xl leading-relaxed">
            Manage your local presence and direct peer connections within the decentralized student mesh.
          </p>
        </section>

        {activePeersCount === 0 ? (
          
          /* Screen 5 Empty State Area */
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] border border-deep-charcoal border-dashed bg-surface-container-low relative group p-8">
            <div className="absolute inset-0 opacity-10 mesh-grid pointer-events-none"></div>
            
            <div className="flex flex-col items-center justify-center text-center max-w-md z-10">
              <div className="w-24 h-24 border-2 border-deep-charcoal rounded-full flex items-center justify-center mb-6 relative">
                <div className="absolute inset-0 border border-deep-charcoal rounded-full animate-ping opacity-20" style={{ animationDuration: '3s' }}></div>
                <span className="material-symbols-outlined text-4xl text-deep-charcoal" style={{ fontVariationSettings: "'wght' 100" }}>
                  radar
                </span>
              </div>
              
              <h3 className="font-sans text-base md:text-lg font-bold text-deep-charcoal uppercase tracking-wider mb-3">
                NO PEERS DISCOVERED
              </h3>
              
              <p className="font-mono text-xs text-secondary leading-relaxed">
                Ensure you are on the same local network as your peers or add a static IP above.
              </p>
              
              <div className="mt-8">
                <button 
                  onClick={onRescanNetwork}
                  className="font-sans text-xs font-bold border-2 border-deep-charcoal bg-deep-charcoal text-bone-white hover:bg-bone-white hover:text-deep-charcoal px-6 py-3 transition-colors uppercase tracking-widest flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  RESCAN NETWORK
                </button>
              </div>
            </div>

            {/* Brutalist design corner accents */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-deep-charcoal"></div>
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-deep-charcoal"></div>
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-deep-charcoal"></div>
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-deep-charcoal"></div>
          </div>

        ) : (
          
          /* Active Mesh UI Layout Grid */
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Discoverability Toggle Card */}
              <section className="brutalist-border p-6 flex flex-col justify-between h-full bg-bone-white relative">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="font-sans text-sm font-bold uppercase tracking-wider text-deep-charcoal">
                      Local Discovery
                    </h3>
                    
                    {/* Toggle switch visual */}
                    <button 
                      onClick={() => setLocalDiscovery(!localDiscovery)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer border border-deep-charcoal transition-colors duration-200 ease-in-out focus:outline-none ${
                        localDiscovery ? 'bg-brand-orange' : 'bg-bone-white'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 border border-deep-charcoal bg-deep-charcoal transition duration-200 ease-in-out ${
                          localDiscovery ? 'translate-x-[19px] bg-white' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  
                  <p className="font-sans text-xs text-secondary leading-relaxed mb-4">
                    Broadcast presence via mDNS on the local subnet. Allows nearby peers to sync automatically.
                  </p>
                </div>
                
                <div className={`font-mono text-[11px] uppercase tracking-wider mt-4 border-t border-deep-charcoal pt-2.5 flex items-center gap-2 ${
                  localDiscovery ? 'text-brand-orange' : 'text-secondary'
                }`}>
                  <span className={`w-2 h-2 rounded-full inline-block ${
                    localDiscovery ? 'bg-brand-orange animate-pulse' : 'bg-secondary'
                  }`}></span>
                  Status: {localDiscovery ? 'Broadcasting' : 'Silent'}
                </div>
              </section>

              {/* Add Peer Manually Form */}
              <section className="brutalist-border p-6 bg-deep-charcoal text-bone-white">
                <h3 className="font-sans text-sm font-bold uppercase tracking-wider mb-2">
                  Direct Connection
                </h3>
                <p className="font-sans text-xs text-secondary mb-6 leading-relaxed">
                  Establish a strict connection via static IP.
                </p>
                
                <form onSubmit={handleHandshakeSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="font-sans text-[10px] text-secondary uppercase tracking-widest mb-1.5 block" htmlFor="ip-address">
                      IPv4 / IPv6 Address
                    </label>
                    <input 
                      id="ip-address"
                      type="text"
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      placeholder="192.168.1.xxx"
                      disabled={connecting}
                      className="w-full bg-transparent border-b border-secondary text-bone-white font-mono text-xs p-2 focus:outline-none focus:border-bone-white transition-all rounded-none placeholder-secondary placeholder-opacity-50"
                    />
                  </div>
                  
                  <button 
                    type="submit"
                    disabled={connecting || !ipAddress}
                    className="mt-4 brutalist-button font-sans text-xs font-bold py-3 px-6 uppercase tracking-widest text-center border border-transparent self-start disabled:opacity-50"
                  >
                    {connecting ? 'Initiating Handshake...' : 'Initiate Handshake'}
                  </button>
                </form>
              </section>

            </div>

            {/* Known Peers List (Active/Inactive) */}
            <section className="flex flex-col mt-4">
              <div className="flex justify-between items-end mb-4 brutalist-border-b pb-2">
                <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-deep-charcoal">
                  Known Peers
                </h3>
                <span className="font-mono text-[10px] bg-deep-charcoal text-bone-white px-2 py-0.5 font-bold">
                  {peers.length} CONFIGURATIONS
                </span>
              </div>

              <div className="flex flex-col border-l border-r border-t border-deep-charcoal">
                {peers.map((peer) => {
                  const isActive = peer.status === 'active';
                  return (
                    <div 
                      key={peer.id}
                      className={`grid grid-cols-1 md:grid-cols-12 brutalist-border-b p-4 items-center gap-4 md:gap-0 transition-colors ${
                        isActive ? 'hover:bg-surface-container bg-bone-white' : 'bg-surface-container-low opacity-70'
                      }`}
                    >
                      <div className="md:col-span-1 flex items-center justify-center">
                        <span className={`material-symbols-outlined ${
                          isActive ? 'text-brand-orange' : 'text-secondary'
                        }`}>
                          {isActive ? 'wifi_tethering' : 'wifi_off'}
                        </span>
                      </div>

                      <div className="md:col-span-3 flex flex-col">
                        <span className={`font-sans text-xs font-bold uppercase ${
                          isActive ? 'text-deep-charcoal' : 'text-secondary'
                        }`}>
                          {peer.name}
                        </span>
                        <span className="font-mono text-[10px] text-secondary">
                          {isActive ? peer.discoveryMethod : 'Last seen 2h ago'}
                        </span>
                      </div>

                      <div className="md:col-span-6 font-mono text-xs break-all text-secondary">
                        {peer.fingerprint}
                      </div>

                      <div className="md:col-span-2 flex justify-end">
                        {isActive ? (
                          <button 
                            onClick={() => onDisconnectPeer(peer.id)}
                            className="brutalist-button border border-deep-charcoal px-3 py-1 text-[10px] uppercase font-sans font-bold"
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button 
                            onClick={() => onConnectPeer(peer.ip)}
                            className="border border-secondary text-secondary px-3 py-1 text-[10px] uppercase font-sans font-bold hover:bg-deep-charcoal hover:text-white transition-all"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

      </div>

    </div>
  );
}
