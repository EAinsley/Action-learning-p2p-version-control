import React, { useEffect, useState } from 'react';

interface BootScreenProps {
  onComplete: () => void;
}

export default function BootScreen({ onComplete }: BootScreenProps) {
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const bootSequence = [
      { delay: 400, log: 'INITIALIZING SECURE SOCKETS LAYER...' },
      { delay: 800, log: 'GENERATING TEMPORARY VECTOR CLOCK...' },
      { delay: 1200, log: 'LOADING REPOSITORY ALPHA LOCAL INDEX...' },
      { delay: 1600, log: 'NODE IDENTITY GENERATED: NODE-7A9B-X1' },
      { delay: 2000, log: 'MESH DISCOVERY BROADCASTER ENGAGED.' }
    ];

    bootSequence.forEach((step) => {
      setTimeout(() => {
        setLogs((prev) => [...prev, step.log]);
      }, step.delay);
    });

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            onComplete();
          }, 300);
          return 100;
        }
        return prev + 5;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="min-h-screen flex flex-col justify-between p-6 md:p-16 relative bg-bone-white text-deep-charcoal overflow-hidden select-none">
      {/* Subtle Mesh Background */}
      <div className="absolute inset-0 w-full h-full mesh-grid pointer-events-none"></div>

      {/* Top Header Grid Marker */}
      <div className="h-16 w-full relative z-10 flex items-center border-b border-deep-charcoal border-opacity-10 justify-between">
        <div className="w-2 h-2 bg-deep-charcoal"></div>
        <div className="font-mono text-xs uppercase tracking-wider text-secondary">
          SYS_STATUS // BOOTING ({progress}%)
        </div>
      </div>

      {/* Main Branding Core */}
      <main className="flex-grow flex flex-col items-center justify-center relative z-10 w-full max-w-4xl mx-auto">
        <div className="text-center flex flex-col items-center border border-deep-charcoal p-12 relative bg-bone-white">
          {/* Brutalist structural corner square accents */}
          <div className="absolute top-0 left-0 w-2 h-2 bg-deep-charcoal transform -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute top-0 right-0 w-2 h-2 bg-deep-charcoal transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-2 h-2 bg-deep-charcoal transform -translate-x-1/2 translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-2 h-2 bg-deep-charcoal transform translate-x-1/2 translate-y-1/2"></div>
          
          <h1 className="font-sans text-6xl md:text-8xl font-black tracking-tighter uppercase mb-4 text-deep-charcoal">
            AXON
          </h1>
          <div className="w-16 h-px bg-deep-charcoal mb-4"></div>
          <h2 className="font-sans text-xs md:text-sm font-bold text-secondary uppercase tracking-[0.2em]">
            PEER-TO-PEER VERSION CONTROL
          </h2>
        </div>

        {/* Live Diagnostic Outputs during boot */}
        <div className="mt-8 font-mono text-xs text-secondary max-w-md w-full h-12 flex flex-col items-center overflow-hidden justify-center text-center opacity-85 px-4">
          {logs.slice(-1).map((log, index) => (
            <div key={index} className="animate-pulse tracking-wide truncate">
              {log}
            </div>
          ))}
        </div>
      </main>

      {/* Bottom Status Bar */}
      <footer className="w-full relative z-10 flex justify-between items-end border-t border-deep-charcoal pt-4">
        <div className="flex flex-col">
          <span className="font-mono text-brand-orange tracking-wider animate-pulse flex items-center gap-2 font-semibold">
            <span className="material-symbols-outlined text-[16px] spin-loader">sync</span>
            INITIALIZING MESH...
          </span>
          <span className="font-sans text-xs text-secondary uppercase tracking-widest mt-1">
            SYSTEM BOOT SEQUENCE v.1.0.4
          </span>
        </div>

        {/* Right Side structural decorative bar elements */}
        <div className="flex gap-1 items-end h-6">
          <div className="w-1 h-6 bg-deep-charcoal"></div>
          <div className="w-1 h-4 bg-deep-charcoal opacity-50"></div>
          <div className="w-1 h-2 bg-deep-charcoal opacity-25"></div>
        </div>
      </footer>
    </div>
  );
}
