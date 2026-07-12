import React, { useState } from 'react';
import { Conflict } from '../types';

interface ConflictScreenProps {
  conflicts: Conflict[];
  onResolve: (id: string, method: 'local' | 'remote' | 'manual') => void;
  onReset: () => void;
  onGoToTab: (tab: string) => void;
}

export default function ConflictScreen({
  conflicts,
  onResolve,
  onReset,
  onGoToTab
}: ConflictScreenProps) {
  const unresolved = conflicts.filter((c) => !c.resolved);
  const [selectedId, setSelectedId] = useState<string>(
    unresolved.length > 0 ? unresolved[0].id : ''
  );

  // Auto-focus first unresolved conflict if selected one gets resolved
  const activeConflict = unresolved.find((c) => c.id === selectedId) || unresolved[0];

  // Update selected if needed
  if (activeConflict && activeConflict.id !== selectedId) {
    setSelectedId(activeConflict.id);
  }

  // Handle victory state (all conflicts solved!)
  if (unresolved.length === 0) {
    return (
      <article className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[500px] text-center px-4 py-8 select-none">
        <div className="flex flex-col items-center max-w-2xl">
          {/* Giant Brutalist Checkmark */}
          <div className="mb-8 w-32 h-32 md:w-40 md:h-40 border-2 border-deep-charcoal rounded-full flex items-center justify-center bg-bone-white pulse-border">
            <span className="material-symbols-outlined text-[70px] md:text-[90px] text-deep-charcoal select-none">
              check
            </span>
          </div>
          
          <h2 className="font-sans text-5xl md:text-[76px] font-black tracking-tighter uppercase mb-6 leading-none break-words w-full text-deep-charcoal">
            ALL VECTORS SYNCED
          </h2>
          
          <p className="font-sans text-sm md:text-base text-secondary max-w-md mx-auto leading-relaxed">
            Your local state matches the mesh. No unresolved conflicts detected.
          </p>
          
          <div className="mt-12 flex gap-4 flex-wrap justify-center">
            <button 
              onClick={() => onGoToTab('PULSE')}
              className="bg-deep-charcoal text-bone-white font-sans text-xs font-bold px-8 py-4 border border-deep-charcoal hover:bg-bone-white hover:text-deep-charcoal hover:shadow-[4px_4px_0px_0px_rgba(238,73,0,1)] transition-all uppercase tracking-widest"
            >
              Return to Pulse
            </button>
            <button 
              onClick={onReset}
              className="bg-bone-white text-deep-charcoal font-sans text-xs font-bold px-8 py-4 border border-deep-charcoal hover:bg-surface-container transition-colors uppercase tracking-widest"
            >
              Force Reset Conflicts
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="flex flex-col md:flex-row w-full max-w-7xl mx-auto brutalist-border overflow-hidden h-auto md:h-[650px] bg-bone-white">
      
      {/* Sidebar: Conflict List Selector */}
      <aside className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-deep-charcoal flex flex-col bg-surface-container-lowest overflow-y-auto">
        <div className="p-6 border-b border-deep-charcoal bg-surface-container-lowest flex justify-between items-end">
          <div>
            <h2 className="font-sans text-lg md:text-xl font-bold tracking-tight text-deep-charcoal">
              Conflict Log
            </h2>
            <p className="font-mono text-xs text-secondary mt-1">
              {unresolved.length} Unresolved Vectors
            </p>
          </div>
          <span className="material-symbols-outlined text-brand-orange animate-pulse text-[24px]">
            warning
          </span>
        </div>

        <ul className="flex flex-col divide-y divide-deep-charcoal">
          {unresolved.map((conflict) => {
            const isActive = conflict.id === activeConflict.id;
            return (
              <li 
                key={conflict.id}
                onClick={() => setSelectedId(conflict.id)}
                className={`cursor-pointer transition-colors ${
                  isActive 
                    ? 'bg-deep-charcoal text-bone-white' 
                    : 'hover:bg-surface-container text-deep-charcoal'
                }`}
              >
                <div className="p-5 flex flex-col gap-2">
                  <div className="flex justify-between items-center w-full gap-2">
                    <span className="font-mono text-xs truncate font-medium">
                      {conflict.filepath}
                    </span>
                    <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 font-sans font-bold brutalist-border border-opacity-30 ${
                      isActive ? 'bg-brand-orange text-white border-white' : 'border-deep-charcoal text-brand-orange'
                    }`}>
                      Conflicted
                    </span>
                  </div>
                  <div className={`flex gap-4 font-mono text-[10px] ${isActive ? 'text-bone-white opacity-75' : 'text-secondary'}`}>
                    <span>L: {conflict.localVersion} ({conflict.localTime})</span>
                    <span>R: {conflict.remoteVersion} ({conflict.remoteTime})</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Main View: Active Diff & Resolve Actions */}
      <section className="flex-1 flex flex-col overflow-hidden bg-bone-white">
        
        {/* Context Header */}
        <div className="p-6 border-b border-deep-charcoal flex flex-col gap-4 bg-bone-white shrink-0">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
            <div>
              <span className="font-mono text-xs text-secondary block uppercase tracking-wider mb-0.5">FILE PATH</span>
              <h3 className="font-sans text-sm md:text-base font-bold text-deep-charcoal truncate">
                {activeConflict.filepath}
              </h3>
            </div>
            <div>
              <span className="font-mono text-[11px] border border-deep-charcoal px-2 py-1 bg-surface-container select-none">
                Lamport Clock: {activeConflict.lamportClock}
              </span>
            </div>
          </div>

          {/* Action Resolution Buttons */}
          <div className="flex flex-wrap gap-3 mt-1">
            <button 
              onClick={() => onResolve(activeConflict.id, 'local')}
              className="font-sans text-xs font-bold px-4 py-2.5 border border-deep-charcoal bg-bone-white hover:bg-surface-container active:bg-surface-container-high transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">keyboard_arrow_left</span>
              KEEP LOCAL
            </button>
            <button 
              onClick={() => onResolve(activeConflict.id, 'remote')}
              className="font-sans text-xs font-bold px-4 py-2.5 border border-deep-charcoal bg-bone-white hover:bg-surface-container active:bg-surface-container-high transition-colors flex items-center gap-1.5"
            >
              KEEP REMOTE
              <span className="material-symbols-outlined text-[16px]">keyboard_arrow_right</span>
            </button>
            <button 
              onClick={() => onResolve(activeConflict.id, 'manual')}
              className="font-sans text-xs font-bold px-5 py-2.5 bg-deep-charcoal text-bone-white hover:bg-brand-orange hover:shadow-[3px_3px_0_0_#1a1a1a] transition-all ml-auto border border-deep-charcoal flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">call_merge</span>
              MERGE MANUALLY
            </button>
          </div>
        </div>

        {/* Diff Viewer Code Blocks */}
        <div className="flex-1 overflow-y-auto p-0 flex flex-col font-mono text-xs md:text-sm leading-relaxed text-deep-charcoal">
          
          {/* Static Pre-conflict helper context block */}
          <div className="flex w-full opacity-60">
            <div className="w-12 border-r border-deep-charcoal border-opacity-20 text-secondary text-right pr-2 py-1 select-none">
              {activeConflict.lineStart - 2}
            </div>
            <div className="flex-1 px-4 py-1 whitespace-pre truncate">
              {'    public async connect(peerId: string): Promise<boolean> {'}
            </div>
          </div>
          <div className="flex w-full opacity-60">
            <div className="w-12 border-r border-deep-charcoal border-opacity-20 text-secondary text-right pr-2 py-1 select-none">
              {activeConflict.lineStart - 1}
            </div>
            <div className="flex-1 px-4 py-1 whitespace-pre truncate">
              {'        if (this.connectedPeers.has(peerId)) return true;'}
            </div>
          </div>

          {/* Local Section */}
          <div className="flex w-full bg-surface-container-high border-t border-b border-deep-charcoal relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-orange"></div>
            <div className="w-12 border-r border-deep-charcoal text-deep-charcoal font-bold text-right pr-2 py-1 select-none">
              {activeConflict.lineStart}
            </div>
            <div className="flex-1 px-4 py-1 whitespace-pre-wrap font-medium">
              <span className="line-through text-secondary mr-2">
                - {activeConflict.oldReference}
              </span>
            </div>
          </div>
          <div className="flex w-full bg-surface-container-high border-b border-deep-charcoal relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-orange"></div>
            <div className="w-12 border-r border-deep-charcoal text-deep-charcoal font-bold text-right pr-2 py-1 select-none">
              {activeConflict.lineStart + 1}
            </div>
            <div className="flex-1 px-4 py-1 whitespace-pre-wrap font-bold">
              <span className="bg-deep-charcoal text-bone-white px-1 py-0.5">
                + {activeConflict.localContent}
              </span>
              <span className="text-secondary text-[10px] ml-2 font-mono">// LOCAL VERSION ({activeConflict.localVersion})</span>
            </div>
          </div>

          {/* Conflict Divider */}
          <div className="flex w-full h-5 bg-surface-container-highest border-b border-deep-charcoal items-center justify-center relative">
            <span className="text-[9px] uppercase tracking-widest text-secondary font-bold select-none">
              --- CONFLICT BOUNDARY ---
            </span>
          </div>

          {/* Remote Section */}
          <div className="flex w-full bg-surface-container relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary"></div>
            <div className="w-12 border-r border-deep-charcoal text-secondary text-right pr-2 py-1 select-none">
              {activeConflict.lineStart}
            </div>
            <div className="flex-1 px-4 py-1 whitespace-pre-wrap font-medium text-secondary">
              <span className="bg-surface-container-highest text-secondary px-1 py-0.5">
                + {activeConflict.remoteContent}
              </span>
              <span className="text-secondary text-[10px] ml-2 font-mono">// REMOTE VERSION ({activeConflict.remoteVersion})</span>
            </div>
          </div>

          {/* Static Post-conflict helper context block */}
          <div className="flex w-full opacity-60 mt-2">
            <div className="w-12 border-r border-deep-charcoal border-opacity-20 text-secondary text-right pr-2 py-1 select-none">
              {activeConflict.lineEnd + 1}
            </div>
            <div className="flex-1 px-4 py-1 whitespace-pre truncate">
              {'        if (connection) {'}
            </div>
          </div>
          <div className="flex w-full opacity-60">
            <div className="w-12 border-r border-deep-charcoal border-opacity-20 text-secondary text-right pr-2 py-1 select-none">
              {activeConflict.lineEnd + 2}
            </div>
            <div className="flex-1 px-4 py-1 whitespace-pre truncate">
              {'            this.connectedPeers.add(peerId);'}
            </div>
          </div>

        </div>

      </section>

    </div>
  );
}
