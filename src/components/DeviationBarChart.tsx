import React, { useState } from 'react';
import { AppDatabase } from '../types';
import { 
  BarChart3, 
  TrendingDown, 
  TrendingUp, 
  CheckCircle2, 
  Info, 
  Filter, 
  Layers, 
  AlertTriangle,
  Scale
} from 'lucide-react';

interface DeviationBarChartProps {
  db: AppDatabase;
  selectedBranchId: string;
  selectedAisleId?: string;
  selectedCategoryId?: string;
  searchQuery?: string;
}

export const DeviationBarChart: React.FC<DeviationBarChartProps> = ({ 
  db, 
  selectedBranchId,
  selectedAisleId = 'all',
  selectedCategoryId = 'all',
  searchQuery = ''
}) => {
  const [chartMode, setChartMode] = useState<'diverging' | 'grouped'>('diverging');
  const [limitCount, setLimitCount] = useState<number>(10);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Compute items
  let counts = db.counts;
  if (selectedBranchId !== 'all') {
    counts = counts.filter(c => c.branchId === Number(selectedBranchId));
  }

  const items: any[] = [];

  counts.forEach(c => {
    const branch = db.branches.find(b => b.id === c.branchId) || { name: 'Bilinmeyen', code: '-' };
    const prod = db.products.find(p => p.id === c.productId);
    if (!prod) return;

    // Filter by aisle
    if (selectedAisleId !== 'all' && prod.aisleId !== Number(selectedAisleId)) {
      return;
    }

    // Filter by product category
    if (selectedCategoryId !== 'all' && prod.category !== selectedCategoryId) {
      return;
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match = prod.description.toLowerCase().includes(q) ||
        prod.barcode.includes(q) ||
        prod.stockCode.toLowerCase().includes(q) ||
        branch.name.toLowerCase().includes(q);
      if (!match) return;
    }

    const aisle = db.aisles.find(a => a.id === prod.aisleId) || { name: 'Genel' };
    const diff = c.quantity - prod.centralStock;
    const absDiff = Math.abs(diff);
    const deviationPercent = prod.centralStock > 0 
      ? Math.round((diff / prod.centralStock) * 100) 
      : (c.quantity > 0 ? 100 : 0);

    items.push({
      countId: c.id,
      productName: prod.description,
      barcode: prod.barcode,
      stockCode: prod.stockCode,
      branchName: branch.name,
      branchCode: branch.code,
      aisleName: aisle.name,
      expected: prod.centralStock,
      counted: c.quantity,
      diff,
      absDiff,
      deviationPercent
    });
  });

  // Sort by highest absolute deviation first
  const sortedItems = [...items].sort((a, b) => b.absDiff - a.absDiff);
  const displayItems = limitCount > 0 ? sortedItems.slice(0, limitCount) : sortedItems;

  // Max value for scaling
  const maxAbsDiff = Math.max(...displayItems.map(d => Math.max(Math.abs(d.diff), 1)), 5);
  const maxStockVal = Math.max(...displayItems.map(d => Math.max(d.expected, d.counted, 1)), 10);

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                İnteraktif Stok Sapma Grafiği (Deviation Chart)
              </h3>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100">
                Merkez vs Sayılan
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Fiziksel sayım ile beklenen merkez stok arasındaki net sapma ve tutarsızlık analizi
            </p>
          </div>
        </div>

        {/* Chart View Modes and Limit Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Mode */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setChartMode('diverging')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                chartMode === 'diverging'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sapma (+ / -)
            </button>
            <button
              type="button"
              onClick={() => setChartMode('grouped')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                chartMode === 'grouped'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Çift Çubuk (Karşılaştırma)
            </button>
          </div>

          {/* Limit Filter */}
          <select
            value={limitCount}
            onChange={e => setLimitCount(Number(e.target.value))}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none font-medium focus:ring-2 focus:ring-indigo-500"
          >
            <option value={5}>En Çok Sapan 5 Ürün</option>
            <option value={10}>En Çok Sapan 10 Ürün</option>
            <option value={20}>En Çok Sapan 20 Ürün</option>
            <option value={0}>Tüm Sayılan Ürünler ({items.length})</option>
          </select>
        </div>
      </div>

      {displayItems.length === 0 ? (
        <div className="p-10 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
          Grafikte gösterilecek sayım verisi bulunmuyor.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Legend and Summary Stats */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold">
              {chartMode === 'diverging' ? (
                <>
                  <span className="flex items-center gap-1.5 text-rose-700">
                    <span className="w-3 h-3 rounded-md bg-rose-500" />
                    <span>Eksik Sapma (Kayıp/Fire: Sayılan &lt; Beklenen)</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-700">
                    <span className="w-3 h-3 rounded-md bg-amber-500" />
                    <span>Fazla Sapma (Sayılan &gt; Beklenen)</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <span className="w-3 h-3 rounded-md bg-emerald-500" />
                    <span>Tam Eşleşme (Sıfır Sapma)</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <span className="w-3 h-3 rounded-md bg-slate-600" />
                    <span>Beklenen Merkez Stok</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-indigo-700">
                    <span className="w-3 h-3 rounded-md bg-indigo-600" />
                    <span>Fiziksel Sayılan Miktar</span>
                  </span>
                </>
              )}
            </div>

            <div className="text-[11px] text-slate-500 font-mono">
              İncelemek için çubukların üzerine gelebilir veya tıklayabilirsiniz
            </div>
          </div>

          {/* Interactive Chart Canvas */}
          {chartMode === 'diverging' ? (
            /* DIVERGING BAR CHART AROUND ZERO CENTER AXIS */
            <div className="space-y-3 pt-2">
              {displayItems.map((item, idx) => {
                const isHovered = hoveredIndex === idx;
                const isSelected = selectedItem?.countId === item.countId;
                const barWidthPct = Math.max(4, Math.round((Math.abs(item.diff) / maxAbsDiff) * 45));

                return (
                  <div
                    key={item.countId}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => setSelectedItem(isSelected ? null : item)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/20'
                        : isHovered
                        ? 'border-slate-300 bg-slate-50/80 shadow-xs'
                        : 'border-slate-100 bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          #{idx + 1}
                        </span>
                        <h4 className="font-bold text-xs text-slate-900 truncate max-w-xs sm:max-w-md">
                          {item.productName}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">({item.barcode})</span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-500">{item.branchName}</span>
                        <span className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                          item.diff === 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.diff < 0
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {item.diff > 0 ? `+${item.diff}` : item.diff} Adet Sapma ({item.deviationPercent > 0 ? `+${item.deviationPercent}` : item.deviationPercent}%)
                        </span>
                      </div>
                    </div>

                    {/* Zero-Centered Comparative Diverging Bar */}
                    <div className="relative h-6 bg-slate-100 rounded-xl overflow-hidden flex items-center border border-slate-200/80">
                      {/* Center Baseline Indicator (Zero Axis) */}
                      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-400 z-10" />

                      {/* Negative Deviation Bar (Left of center) */}
                      {item.diff < 0 && (
                        <div
                          className="absolute right-1/2 h-full bg-gradient-to-l from-rose-500 to-rose-600 rounded-l-lg transition-all duration-500 flex items-center justify-end pr-2 text-white font-bold text-[10px]"
                          style={{ width: `${barWidthPct}%` }}
                        >
                          {item.diff}
                        </div>
                      )}

                      {/* Positive Deviation Bar (Right of center) */}
                      {item.diff > 0 && (
                        <div
                          className="absolute left-1/2 h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-r-lg transition-all duration-500 flex items-center pl-2 text-white font-bold text-[10px]"
                          style={{ width: `${barWidthPct}%` }}
                        >
                          +{item.diff}
                        </div>
                      )}

                      {/* Zero Deviation Center Marker */}
                      {item.diff === 0 && (
                        <div className="absolute left-1/2 -translate-x-1/2 px-2 py-0.5 bg-emerald-500 text-white rounded text-[10px] font-bold z-20">
                          Tam Eşleşti (0)
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                      <span>Merkez Beklenen: <strong className="text-slate-700">{item.expected}</strong></span>
                      <span>Sayılan: <strong className="text-slate-900">{item.counted}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* GROUPED COMPARATIVE BARS: EXPECTED vs COUNTED */
            <div className="space-y-4 pt-2">
              {displayItems.map((item, idx) => {
                const isSelected = selectedItem?.countId === item.countId;
                const expectedBarPct = Math.max(3, Math.round((item.expected / maxStockVal) * 100));
                const countedBarPct = Math.max(3, Math.round((item.counted / maxStockVal) * 100));

                return (
                  <div
                    key={item.countId}
                    onClick={() => setSelectedItem(isSelected ? null : item)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-500/20'
                        : 'border-slate-100 bg-white hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          #{idx + 1}
                        </span>
                        <h4 className="font-bold text-xs text-slate-900 truncate max-w-sm sm:max-w-md">
                          {item.productName}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">({item.barcode})</span>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        item.diff === 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : item.diff < 0
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        Fark: {item.diff > 0 ? `+${item.diff}` : item.diff}
                      </span>
                    </div>

                    {/* Dual comparative horizontal bars */}
                    <div className="space-y-1.5">
                      {/* Expected */}
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="w-16 text-slate-500 text-[10px] font-medium shrink-0">Beklenen:</span>
                        <div className="flex-1 bg-slate-100 h-3 rounded-full overflow-hidden">
                          <div
                            className="bg-slate-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${expectedBarPct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-bold text-slate-700 font-mono">{item.expected}</span>
                      </div>

                      {/* Counted */}
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="w-16 text-slate-500 text-[10px] font-medium shrink-0">Sayılan:</span>
                        <div className="flex-1 bg-slate-100 h-3 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              item.diff === 0 ? 'bg-emerald-500' : item.diff < 0 ? 'bg-rose-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${countedBarPct}%` }}
                          />
                        </div>
                        <span className={`w-10 text-right font-black font-mono ${
                          item.diff === 0 ? 'text-emerald-700' : item.diff < 0 ? 'text-rose-700' : 'text-amber-700'
                        }`}>
                          {item.counted}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Interactive Drill-down Card when a product is clicked */}
          {selectedItem && (
            <div className="p-4 rounded-2xl bg-indigo-900 text-white shadow-xl animate-fadeIn flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-indigo-300 bg-white/10 px-2 py-0.5 rounded">
                  Seçili Ürün Sapma Detayı
                </span>
                <h4 className="font-extrabold text-sm text-white">
                  {selectedItem.productName}
                </h4>
                <div className="flex items-center gap-3 text-xs text-indigo-200 font-mono">
                  <span>Barkod: {selectedItem.barcode}</span>
                  <span>Şube: {selectedItem.branchName}</span>
                  <span>Reyon: {selectedItem.aisleName}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/10 p-3 rounded-xl">
                <div className="text-center">
                  <span className="text-[10px] text-indigo-300 block">Beklenen</span>
                  <strong className="text-base font-bold text-white">{selectedItem.expected}</strong>
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-indigo-300 block">Sayılan</span>
                  <strong className="text-base font-bold text-white">{selectedItem.counted}</strong>
                </div>
                <div className="text-center border-l border-white/20 pl-3">
                  <span className="text-[10px] text-indigo-300 block">Net Sapma</span>
                  <strong className={`text-base font-black ${
                    selectedItem.diff === 0 ? 'text-emerald-300' : selectedItem.diff < 0 ? 'text-rose-300' : 'text-amber-300'
                  }`}>
                    {selectedItem.diff > 0 ? `+${selectedItem.diff}` : selectedItem.diff}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
