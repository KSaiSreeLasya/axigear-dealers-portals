import React from 'react';
import { 
  LayoutDashboard, 
  Boxes, 
  TrendingUp, 
  Users, 
  CalendarCheck, 
  MessageSquare, 
  LogOut,
  ShieldCheck,
  MapPin,
  FileCheck,
  Globe
} from 'lucide-react';
import { Dealer } from '../types';

interface SidebarProps {
  currentDealer: Dealer;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  unreadTicketsCount: number;
}

export default function Sidebar({ 
  currentDealer, 
  activeTab, 
  setActiveTab, 
  onLogout,
  unreadTicketsCount
}: SidebarProps) {
  
  const isProfileIncomplete = !currentDealer.companyName || !currentDealer.incorporationNo || !currentDealer.legalStructure || !currentDealer.ownershipDetails || !currentDealer.registeredAddress || !currentDealer.documentPan;

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', name: 'Inventory Manager', icon: Boxes },
    { id: 'sales', name: 'Sales & Invoicing', icon: TrendingUp },
    { id: 'employees', name: 'Employee Directory', icon: Users },
    { id: 'attendance', name: 'Attendance Roll', icon: CalendarCheck },
    { 
      id: 'service', 
      name: 'Service Center Hub', 
      icon: MessageSquare, 
      badge: unreadTicketsCount > 0 ? unreadTicketsCount : undefined 
    },
    { 
      id: 'profile', 
      name: 'Dealer Profile & Docs', 
      icon: FileCheck,
      badge: isProfileIncomplete ? '!' : undefined,
      badgeColor: 'bg-amber-500 text-white'
    },
  ];

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-white border-r border-gray-200 text-gray-700 flex flex-col justify-between z-30 font-sans text-xs">
      
      {/* Upper Brand Section */}
      <div className="flex flex-col">
        
        {/* Logo and Brand Title */}
        <div className="h-16 flex items-center px-6 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-700 rounded-lg flex items-center justify-center font-bold text-white text-[15px]">
              AG
            </div>
            <span className="text-sm font-black tracking-widest text-emerald-800 uppercase">
              AXIGEAR
            </span>
          </div>
        </div>

        {/* Current Dealer Context Display Card */}
        <div className="p-4 bg-gray-50 border border-gray-200 m-3.5 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white font-extrabold flex items-center justify-center select-none shadow-sm">
              {currentDealer.code.split('-')[1] || 'DL'}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[11px] font-bold text-gray-900 truncate" title={currentDealer.name}>
                {currentDealer.name}
              </h4>
              <p className="text-[10px] font-mono text-emerald-700 font-extrabold uppercase mt-0.5">
                {currentDealer.code}
              </p>
              <div className="flex items-center gap-1 text-[9px] text-gray-400 mt-1 truncate">
                <MapPin className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{currentDealer.location}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation items list */}
        <nav className="px-3 py-1 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wider transition-all group cursor-pointer ${
                  isActive 
                    ? 'bg-emerald-700 text-white font-bold shadow-sm shadow-emerald-700/10'
                    : 'text-gray-550 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black font-mono animate-pulse ${
                    isActive 
                      ? 'bg-white text-emerald-800' 
                      : item.badgeColor ? item.badgeColor : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status & Log Out Action */}
      <div className="p-4 border-t border-gray-200 bg-gray-50/50">
        <div className="flex items-center gap-2 mb-3 text-[10px] text-emerald-750 font-bold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>Secured syndicate loop</span>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:text-white hover:bg-rose-600 rounded-lg transition-colors border border-rose-200 cursor-pointer shadow-sm bg-white"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span>Exit Portal</span>
        </button>
      </div>
    </aside>
  );
}
