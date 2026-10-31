import React, { useState } from 'react';
import { Globe, RefreshCw, Shield, Zap, Box, Layers, Menu, X, ArrowUpRight } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, clusterHealth, onSync }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  let statusBadge = (
    <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
      <span className="text-xs font-mono text-emerald-400 font-medium">CLUSTER HEALTHY</span>
    </div>
  );

  if (clusterHealth === 'DEGRADED') {
    statusBadge = (
      <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping"></span>
        <span className="text-xs font-mono text-amber-400 font-medium">LINK DEGRADED</span>
      </div>
    );
  } else if (clusterHealth === 'LOCAL_QUORUM') {
    statusBadge = (
      <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/30 px-3 py-1 rounded-full">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping"></span>
        <span className="text-xs font-mono text-rose-400 font-medium">LOCAL QUORUM</span>
      </div>
    );
  }

  const navItems = [
    { id: 'landing', label: 'Story & Pitch', icon: Globe },
    { id: 'topology', label: 'Topology & Map', icon: Layers },
    { id: 'kafka', label: 'Kafka-UI', icon: Box },
    { id: 'chaos', label: 'Chaos Studio', icon: Zap },
    { id: 'compliance', label: 'GDPR Vault', icon: Shield },
  ];

  return (
    <header className="fixed top-0 w-full z-50 border-b border-gray-800/50 bg-black/80 backdrop-blur-md">
      <nav className="max-w-7xl mx-auto px-6 py-3.5">
        <div className="flex items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <div 
            className="flex items-center space-x-3 cursor-pointer shrink-0"
            onClick={() => setActiveTab('landing')}
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-white/20 to-white/5 border border-white/20 flex items-center justify-center font-bold text-white text-sm shadow-[0_0_15px_rgba(255,255,255,0.15)]">
              H
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-white tracking-tight">Hydra Stream</span>
              <span className="text-[10px] font-mono uppercase bg-white/5 text-gray-400 border border-white/10 px-1.5 py-0.5 rounded font-medium">
                Sovereign v1.2
              </span>
            </div>
          </div>

          {/* Centered Navigation */}
          <div className="hidden lg:flex items-center justify-center gap-5 xl:gap-7">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`text-sm transition-all relative py-1 whitespace-nowrap ${
                    isActive 
                      ? 'text-white font-medium after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-white after:rounded-full' 
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            {statusBadge}

            <button
              onClick={onSync}
              className="text-xs bg-white/5 hover:bg-white/10 text-white/80 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 transition-all flex items-center gap-1.5"
              title="Sync Controller"
            >
              <RefreshCw size={12} className="text-white/70" />
              <span className="font-mono text-[11px]">Sync</span>
            </button>

            <button
              onClick={() => setActiveTab('topology')}
              className="btn-gradient text-xs px-4 py-2 rounded-lg font-medium flex items-center gap-1.5 shrink-0"
            >
              <span>Launch Console</span>
              <ArrowUpRight size={13} />
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="lg:hidden text-white/80 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-black/95 backdrop-blur-xl border-t border-gray-800/50 px-6 py-4 flex flex-col gap-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`text-left text-sm py-2 px-3 rounded-lg transition-colors ${
                activeTab === item.id ? 'bg-white/10 text-white font-medium' : 'text-white/60 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="pt-3 border-t border-gray-800/60 flex items-center justify-between">
            {statusBadge}
            <button
              onClick={() => {
                setActiveTab('topology');
                setMobileMenuOpen(false);
              }}
              className="btn-gradient text-xs px-4 py-2 rounded-lg"
            >
              Launch Console
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
