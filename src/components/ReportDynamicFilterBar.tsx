import React from 'react';
import { AppDatabase } from '../types';
import { 
  Filter, 
  Search, 
  Store, 
  Tags, 
  FolderTree,
  X, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Boxes, 
  Layers,
  Sparkles
} from 'lucide-react';

interface ReportDynamicFilterBarProps {
  db: AppDatabase;
  selectedBranchId: string;
  onBranchChange: (branchId: string) => void;
  selectedAisleId: string;
  onAisleChange: (aisleId: string) => void;
  selectedCategoryId: string;
  onCategoryChange: (categoryId: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalFilteredCount: number;
  totalCount: number;
  onResetFilters: () => void;
}

export const ReportDynamicFilterBar: React.FC<ReportDynamicFilterBarProps> = ({
  db,
  selectedBranchId,
  onBranchChange,
  selectedAisleId,
  onAisleChange,
  selectedCategoryId,
  onCategoryChange,
  selectedStatus,
  onStatusChange,
  searchQuery,
  onSearchChange,
  totalFilteredCount,
  totalCount,
  onResetFilters
}) => {
  const isFiltered = 
    selectedBranchId !== 'all' || 
    selectedAisleId !== 'all' || 
    selectedCategoryId !== 'all' ||
    selectedStatus !== 'all' || 
    searchQuery.trim() !== '';

  const activeBranch = db.branches.find(b => b.id === Number(selectedBranchId));
  const activeAisle = db.aisles.find(a => a.id === Number(selectedAisleId));

  // Extract distinct categories from products
  const availableCategories = Array.from(
    new Set(
      db.products
        .map(p => p.category?.trim() || '')
        .filter(c => c.length > 0)
    )
  ).sort();

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
      {/* Title & Quick Status Chips */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 tracking-tight flex items-center gap-2">
              <span>Dinamik Rapor Filtreleme Paneli</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-100 font-mono">
                {totalFilteredCount} / {totalCount} Kalem Listeleniyor
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Şube, reyon, ürün kategorisi ve mutabakat durumuna göre tüm rapor ve grafikleri filtreleyin
            </p>
          </div>
        </div>

        {/* Quick Preset Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => onStatusChange('all')}
            className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer text-[11px] ${
              selectedStatus === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tüm Sonuçlar
          </button>

          <button
            type="button"
            onClick={() => onStatusChange('diff')}
            className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer text-[11px] ${
              selectedStatus === 'diff'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            Fark Olanlar
          </button>

          <button
            type="button"
            onClick={() => onStatusChange('shortage')}
            className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer text-[11px] ${
              selectedStatus === 'shortage'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            🚨 Eksik (Kayıp)
          </button>

          <button
            type="button"
            onClick={() => onStatusChange('surplus')}
            className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer text-[11px] ${
              selectedStatus === 'surplus'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            📦 Fazla Stok
          </button>

          <button
            type="button"
            onClick={() => onStatusChange('exact')}
            className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer text-[11px] ${
              selectedStatus === 'exact'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            ✅ Tam Eşleşen
          </button>
        </div>
      </div>

      {/* Main Filter Inputs Grid - Şube, Reyon, Kategori, Arama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
        {/* 1. Şube Seçimi */}
        <div className="lg:col-span-3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Store className="w-3 h-3 text-indigo-600" />
            <span>Şube / Mağaza</span>
          </label>
          <select
            value={selectedBranchId}
            onChange={e => onBranchChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
          >
            <option value="all">Tüm Mağazalar ({db.branches.length})</option>
            {db.branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>

        {/* 2. Reyon Seçimi */}
        <div className="lg:col-span-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Tags className="w-3 h-3 text-indigo-600" />
            <span>Reyon</span>
          </label>
          <select
            value={selectedAisleId}
            onChange={e => onAisleChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
          >
            <option value="all">Tüm Reyonlar ({db.aisles.length})</option>
            {db.aisles.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Ürün Kategorisi Seçimi */}
        <div className="lg:col-span-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <FolderTree className="w-3 h-3 text-indigo-600" />
            <span>Ürün Kategorisi</span>
          </label>
          <select
            value={selectedCategoryId}
            onChange={e => onCategoryChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
          >
            <option value="all">Tüm Kategoriler ({availableCategories.length})</option>
            {availableCategories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Canlı Arama Input */}
        <div className="lg:col-span-3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Search className="w-3 h-3 text-indigo-600" />
            <span>Ürün Adı, Barkod, Stok Kodu</span>
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Örn: Mouse, 8690001, PRD-01..."
              className="w-full pl-8.5 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="p-1 text-slate-400 hover:text-slate-600 absolute right-2 top-1/2 -translate-y-1/2"
                title="Aramayı Temizle"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 5. Reset Filters Action */}
        <div className="lg:col-span-2 flex items-end">
          <button
            type="button"
            onClick={onResetFilters}
            disabled={!isFiltered}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 h-[38px] ${
              isFiltered
                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 cursor-pointer shadow-xs'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
            title="Tüm filtreleri sıfırla"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Filtreleri Sıfırla</span>
          </button>
        </div>
      </div>

      {/* Active Filter Pills (Shows current active search terms) */}
      {isFiltered && (
        <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] text-slate-400 font-medium">Aktif Filtreler:</span>

          {selectedBranchId !== 'all' && activeBranch && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-semibold">
              <Store className="w-3 h-3" />
              <span>Şube: {activeBranch.name}</span>
              <button onClick={() => onBranchChange('all')} className="hover:text-indigo-950 ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {selectedAisleId !== 'all' && activeAisle && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-semibold">
              <Tags className="w-3 h-3" />
              <span>Reyon: {activeAisle.name}</span>
              <button onClick={() => onAisleChange('all')} className="hover:text-indigo-950 ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {selectedCategoryId !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-semibold">
              <FolderTree className="w-3 h-3" />
              <span>Kategori: {selectedCategoryId}</span>
              <button onClick={() => onCategoryChange('all')} className="hover:text-indigo-950 ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {selectedStatus !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-semibold">
              <span>Durum: {
                selectedStatus === 'diff' ? 'Fark Olanlar' :
                selectedStatus === 'shortage' ? 'Eksik Stok' :
                selectedStatus === 'surplus' ? 'Fazla Stok' : 'Tam Eşleşen'
              }</span>
              <button onClick={() => onStatusChange('all')} className="hover:text-indigo-950 ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {searchQuery.trim() && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-semibold">
              <span>Arama: "{searchQuery}"</span>
              <button onClick={() => onSearchChange('')} className="hover:text-indigo-950 ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
