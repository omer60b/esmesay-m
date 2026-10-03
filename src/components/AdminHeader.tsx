import React from 'react';
import { User } from '../types';
import { EsmeLogo } from './EsmeLogo';
import { 
  ShieldAlert, 
  LogOut, 
  Store, 
  Tags, 
  Users, 
  Boxes, 
  History, 
  BarChart3, 
  Award, 
  Cloud,
  RotateCcw,
  Crown
} from 'lucide-react';

export type AdminTab = 'branches' | 'aisles' | 'users' | 'products' | 'history' | 'reports' | 'evaluations';

interface AdminHeaderProps {
  currentTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onLogout: () => void;
  username: string;
  currentUser?: User;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  currentTab,
  onTabChange,
  onLogout,
  username,
  currentUser
}) => {
  const isSuperAdmin = currentUser?.isSuperAdmin || username.toUpperCase() === 'O.BAS' || username.toUpperCase() === 'T.CESUR';

  const tabs = [
    { id: 'branches' as AdminTab, label: 'Mağazalar', icon: Store },
    { id: 'aisles' as AdminTab, label: 'Reyonlar', icon: Tags },
    { id: 'users' as AdminTab, label: 'Kullanıcılar', icon: Users },
    { id: 'products' as AdminTab, label: 'Ürün & Excel Yükle', icon: Boxes },
    { id: 'history' as AdminTab, label: 'Geçmiş Sayımlar', icon: History, highlight: true },
    { id: 'reports' as AdminTab, label: 'Raporlar & PDF', icon: BarChart3, highlight: true },
    { id: 'evaluations' as AdminTab, label: 'Performans', icon: Award }
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white shrink-0">
      {/* Top Bar */}
      <div className="px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="bg-white px-2 py-1 rounded-xl shadow-md border border-slate-700/50 flex items-center justify-center">
            <EsmeLogo size="sm" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                Esme Sayım Paneli
              </h1>
              {isSuperAdmin ? (
                <span className="text-[10px] bg-gradient-to-r from-amber-500/30 to-amber-600/30 text-amber-300 border border-amber-500/50 px-2.5 py-0.5 rounded-full font-black flex items-center gap-1 shadow-xs">
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>En Yetkili Yönetici (Süper Admin)</span>
                </span>
              ) : (
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full font-medium">
                  {currentUser?.fullName || 'Yetkili Yönetici'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {isSuperAdmin ? 'Genel Denetim, Silme, Kullanıcı Yetkilendirme ve PDF Yönetim Konsolu' : 'Excel Entegrasyonu, Geçmiş Sayım Denetimi ve PDF Raporlama Konsolu'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Logout */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-semibold transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="bg-slate-950/60 border-t border-slate-800/80 px-4 sm:px-6 flex gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap flex items-center gap-2 transition cursor-pointer ${
                isActive
                  ? 'border-indigo-500 text-white bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.highlight && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
