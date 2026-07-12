import React, { useEffect, useState } from 'react';
import { Peer, TransferStream } from '../types';
import { INITIAL_STREAMS } from '../data';

interface MetricsScreenProps {
  peer: Peer;
  onClose: () => void;
}

export default function MetricsScreen({ peer, onClose }: MetricsScreenProps) {
  const [streams, setStreams] = useState<TransferStream[]>(INITIAL_STREAMS);
  const [upstreamRate, setUpstreamRate] = useState<number>(parseFloat(peer.upstream));
  const [downstreamRate, setDownstreamRate] = useState<number>(parseFloat(peer.downstream));

  // Live progress tracking tick loop
  useEffect(() => {
    const interval = setInterval(() => {
      setStreams((prevStreams) =>
        prevStreams.map((stream) => {
          if (stream.status === 'active') {
            const nextProgress = stream.progress + Math.floor(Math.random() * 3) + 1;
            if (nextProgress >= 100) {
              return {
                ...stream,
                progress: 100,
                status: 'completed',
                speed: 'VERIFYING...'
              };
            }
            return {
              ...stream,
              progress: nextProgress
            };
          } else if (stream.status === 'verifying') {
            // Once in a while reset completed or keep verifying
            return Math.random() > 0.7 
              ? { ...stream, status: 'completed', progress: 100 }
              : stream;
          }
          return stream;
        })
      );

      // Randomly oscillate transfer speeds to make screen feel alive
      if (peer.status === 'active') {
        setUpstreamRate((prev) => Math.max(0.1, +(prev + (Math.random() * 0.4 - 0.2)).toFixed(1)));
        setDownstreamRate((prev) => Math.max(0.1, +(prev + (Math.random() * 0.6 - 0.3)).toFixed(1)));
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [peer]);

  const handleCancelStream = (id: string) => {
    setStreams((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'cancelled', progress: 0 } : s))
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 md:gap-12 animate-fade-in select-none">
      
      {/* Top Details Header */}
      <section className="flex flex-col gap-4 border-b border-deep-charcoal pb-6 relative">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="font-sans text-3xl md:text-5xl font-black tracking-tighter uppercase">
            PEER_METRICS
          </h1>
          <div className="flex items-center gap-2">
            <button 
              onClick={onClose}
              className="font-sans text-xs font-bold uppercase tracking-widest border border-deep-charcoal px-4 py-2 hover:bg-deep-charcoal hover:text-bone-white transition-colors"
            >
              CLOSE METRICS
            </button>
            <div className="border border-deep-charcoal px-3 py-1 flex items-center gap-1.5 bg-deep-charcoal text-bone-white font-bold text-xs">
              <span className="material-symbols-outlined text-[14px] spin-loader">sensors</span>
              <span className="font-sans tracking-wider text-[10px]">ACTIVE</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:items-end justify-between mt-2">
          <div className="flex flex-col gap-1">
            <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-secondary">
              Fingerprint ID
            </span>
            <span className="font-mono text-xs bg-surface-container px-2 py-1 border border-deep-charcoal w-fit font-bold break-all">
              {peer.fingerprint}
            </span>
          </div>
          <div className="flex flex-col gap-1 md:text-right">
            <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-secondary">
              LATENCY MATRIX
            </span>
            <span className="font-mono text-xs font-bold text-deep-charcoal">
              {peer.latency || 14}ms // TCP Protocol
            </span>
          </div>
        </div>
      </section>

      {/* Real-time Transfer Stats Bento Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-deep-charcoal border border-deep-charcoal shadow-sm">
        
        {/* Upstream Card */}
        <div className="bg-bone-white p-6 flex flex-col gap-6 hover:bg-surface-container-high transition-colors">
          <div className="flex justify-between items-start">
            <span className="font-sans text-xs font-bold uppercase tracking-wider text-secondary">UPSTREAM</span>
            <span className="material-symbols-outlined text-deep-charcoal">arrow_upward</span>
          </div>
          <div className="flex flex-col">
            <span className="font-sans text-4xl font-black tracking-tighter">
              {upstreamRate}
            </span>
            <span className="font-mono text-xs text-secondary mt-0.5">MB/s Speed</span>
          </div>
        </div>

        {/* Downstream Card */}
        <div className="bg-bone-white p-6 flex flex-col gap-6 hover:bg-surface-container-high transition-colors">
          <div className="flex justify-between items-start">
            <span className="font-sans text-xs font-bold uppercase tracking-wider text-secondary">DOWNSTREAM</span>
            <span className="material-symbols-outlined text-deep-charcoal">arrow_downward</span>
          </div>
          <div className="flex flex-col">
            <span className="font-sans text-4xl font-black tracking-tighter">
              {downstreamRate}
            </span>
            <span className="font-mono text-xs text-secondary mt-0.5">MB/s Speed</span>
          </div>
        </div>

        {/* Total Transmitted (Session TX) */}
        <div className="bg-bone-white p-6 flex flex-col gap-6 hover:bg-surface-container-high transition-colors">
          <div className="flex justify-between items-start">
            <span className="font-sans text-xs font-bold uppercase tracking-wider text-secondary">SESSION_TX</span>
            <span className="material-symbols-outlined text-deep-charcoal">upload_file</span>
          </div>
          <div className="flex flex-col">
            <span className="font-sans text-4xl font-black tracking-tighter">1.2</span>
            <span className="font-mono text-xs text-secondary mt-0.5">GB Total Transmitted</span>
          </div>
        </div>

        {/* Total Received (Session RX) */}
        <div className="bg-bone-white p-6 flex flex-col gap-6 hover:bg-surface-container-high transition-colors">
          <div className="flex justify-between items-start">
            <span className="font-sans text-xs font-bold uppercase tracking-wider text-secondary">SESSION_RX</span>
            <span className="material-symbols-outlined text-deep-charcoal">download_done</span>
          </div>
          <div className="flex flex-col">
            <span className="font-sans text-4xl font-black tracking-tighter">8.4</span>
            <span className="font-mono text-xs text-secondary mt-0.5">GB Total Received</span>
          </div>
        </div>

      </section>

      {/* Active Transfer Streams List */}
      <section className="flex flex-col border border-deep-charcoal bg-bone-white">
        <div className="bg-deep-charcoal text-bone-white px-4 py-3 flex justify-between items-center">
          <span className="font-sans text-xs font-bold uppercase tracking-widest">
            TRANSFER_STREAMS
          </span>
          <span className="font-mono text-xs">
            {streams.filter(s => s.status === 'active' || s.status === 'verifying').length} ACTIVE
          </span>
        </div>

        <div className="flex flex-col bg-bone-white divide-y divide-deep-charcoal">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-surface-container-high font-sans text-[10px] font-bold text-secondary uppercase tracking-wider">
            <div className="col-span-5 md:col-span-6">TARGET_HASH</div>
            <div className="col-span-4 md:col-span-4">PROGRESS</div>
            <div className="col-span-3 md:col-span-2 text-right">TYPE</div>
          </div>

          {/* Render Stream Rows */}
          {streams.map((stream) => (
            <div 
              key={stream.id}
              className={`grid grid-cols-12 gap-4 px-4 py-4 items-center transition-colors hover:bg-surface-container-low ${
                stream.status === 'cancelled' ? 'opacity-40' : ''
              }`}
            >
              <div className="col-span-5 md:col-span-6 flex flex-col min-w-0">
                <span className="font-mono text-xs font-bold truncate text-deep-charcoal">
                  {stream.filename}
                </span>
                <span className="font-sans text-[11px] text-secondary">
                  {stream.size}
                </span>
              </div>

              {/* Progress visual column */}
              <div className="col-span-4 md:col-span-4 flex flex-col gap-1 justify-center">
                {stream.status === 'cancelled' ? (
                  <span className="font-mono text-[10px] text-brand-orange uppercase font-bold">CANCELLED</span>
                ) : stream.status === 'completed' ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-full h-2 border border-deep-charcoal bg-bone-white">
                      <div className="h-full bg-deep-charcoal" style={{ width: '100%' }}></div>
                    </div>
                    <span className="font-mono text-[10px] text-green-600 font-bold uppercase">100%</span>
                  </div>
                ) : (
                  <>
                    <div className="w-full h-2 border border-deep-charcoal bg-bone-white relative overflow-hidden">
                      <div 
                        className="h-full bg-deep-charcoal transition-all duration-300" 
                        style={{ width: `${stream.progress}%` }}
                      ></div>
                    </div>
                    <span className="font-mono text-[10px] font-bold">
                      {stream.progress}% / {stream.status === 'verifying' ? 'VERIFYING...' : stream.speed}
                    </span>
                  </>
                )}
              </div>

              {/* Status Action Arrow Trigger */}
              <div className="col-span-3 md:col-span-2 flex justify-end items-center gap-3">
                <span className="font-sans text-[11px] font-bold uppercase text-secondary hidden sm:inline">
                  {stream.type}
                </span>
                
                {stream.status === 'active' ? (
                  <button 
                    onClick={() => handleCancelStream(stream.id)}
                    className="p-1 brutalist-border text-secondary hover:text-brand-orange hover:bg-surface-container transition-colors"
                    title="Cancel Stream"
                  >
                    <span className="material-symbols-outlined text-[14px] font-bold block">close</span>
                  </button>
                ) : (
                  <span className="material-symbols-outlined text-secondary text-[18px]">
                    {stream.status === 'completed' ? 'check' : stream.type === 'PULL' ? 'south_east' : 'north_east'}
                  </span>
                )}
              </div>

            </div>
          ))}
        </div>

      </section>

    </div>
  );
}
