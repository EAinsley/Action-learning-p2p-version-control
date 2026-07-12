import React from 'react';
import { Commit } from '../types';

interface TimelineScreenProps {
  commits: Commit[];
  onForceRefresh: () => void;
}

export default function TimelineScreen({ commits, onForceRefresh }: TimelineScreenProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full max-w-7xl mx-auto mb-20 md:mb-0">
      
      {/* Left Column / Status Pane (3 cols on desktop) */}
      <aside className="col-span-1 md:col-span-3 flex flex-col gap-6 brutalist-border-r pr-0 md:pr-6 border-b md:border-b-0 pb-6 md:pb-0">
        
        {/* Status Pane block */}
        <section className="flex flex-col gap-4">
          <h2 className="font-sans text-xs font-bold uppercase tracking-widest border-b border-deep-charcoal pb-2">
            Status Pane
          </h2>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center py-2 border-b border-surface-container-highest">
              <span className="font-mono text-xs text-secondary">Branch</span>
              <span className="font-sans text-sm font-bold text-deep-charcoal">main</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-surface-container-highest">
              <span className="font-mono text-xs text-secondary">Remote</span>
              <span className="font-sans text-sm font-bold text-deep-charcoal">origin/main</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="font-mono text-xs text-secondary">Last Fetch</span>
              <span className="font-mono text-xs font-bold text-deep-charcoal">2m ago</span>
            </div>
          </div>
        </section>

        {/* Local History listing pane */}
        <section className="flex flex-col gap-4 mt-2">
          <h2 className="font-sans text-xs font-bold uppercase tracking-widest border-b border-deep-charcoal pb-2">
            Local History
          </h2>
          <div className="flex flex-col divide-y divide-surface-container-highest">
            {commits.map((commit) => (
              <div 
                key={commit.id} 
                className="py-3 hover:bg-surface-container transition-colors px-2 -mx-2 flex gap-3 group cursor-pointer"
              >
                <span className="material-symbols-outlined text-secondary text-[16px] mt-0.5 group-hover:text-brand-orange transition-colors">
                  commit
                </span>
                <div className="min-w-0">
                  <p className="font-sans text-xs font-bold text-deep-charcoal truncate">
                    {commit.title}
                  </p>
                  <p className="font-mono text-[10px] text-secondary mt-0.5">
                    {commit.hash} • {commit.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </aside>

      {/* Right Column / Timeline view (9 cols on desktop) */}
      <div className="col-span-1 md:col-span-9 flex flex-col md:pl-6">
        
        <div className="flex justify-between items-end mb-6 border-b border-deep-charcoal pb-2">
          <h2 className="font-sans text-lg font-bold uppercase tracking-tight text-deep-charcoal">
            Version History
          </h2>
          <span className="font-mono text-xs text-secondary tracking-widest">
            VECTOR_LOG
          </span>
        </div>

        {/* Dynamic Timeline Component */}
        <div className="relative border-l border-deep-charcoal ml-2 pl-6 py-2 flex flex-col gap-10">
          {commits.map((commit) => (
            <div key={commit.id} className="relative group">
              {/* Visible brutalist horizontal offset lines mimicking a physical grid */}
              <div className="absolute w-4 h-[1px] bg-deep-charcoal -left-[24px] top-3.5 group-hover:bg-brand-orange transition-colors"></div>
              
              <div className="flex flex-col md:flex-row md:justify-between md:items-baseline mb-2 gap-1">
                <h3 className="font-sans text-base font-bold text-deep-charcoal group-hover:text-brand-orange transition-colors">
                  {commit.title}
                </h3>
                <span className="font-mono text-[11px] text-secondary">
                  {commit.timestamp} // {commit.hash}
                </span>
              </div>
              
              <p className="font-sans text-xs md:text-sm text-secondary leading-relaxed max-w-2xl">
                {commit.description}
              </p>

              {/* Code/Diff block renderer */}
              {commit.diff && (
                <div className="mt-4 p-4 brutalist-border bg-surface-container font-mono text-xs text-sm leading-relaxed overflow-x-auto relative">
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-deep-charcoal"></div>
                  <div className="text-secondary line-through select-none truncate">
                    - {commit.diff.removed}
                  </div>
                  <div className="text-deep-charcoal font-bold truncate">
                    + {commit.diff.added}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Trigger manually simulated refresh action at bottom */}
        <div className="mt-12 flex justify-start">
          <button 
            onClick={onForceRefresh}
            className="brutalist-button font-sans text-xs font-bold uppercase px-6 py-3 tracking-wider"
          >
            Force Refresh Logs
          </button>
        </div>

      </div>

    </div>
  );
}
