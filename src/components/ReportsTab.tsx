import React, { useState, useEffect } from 'react';
import { AppDatabase, Branch } from '../types';
import { exportComparisonReportPdf, exportBranchDetailPdf } from '../utils/pdfExport';
import { exportComparisonReportExcel } from '../utils/excelExport';
import { calculateBranchAutoEvaluation } from '../utils/evaluationCalculator';
import { fetchRemoteDatabase } from '../services/storage';
import { DeviationBarChart } from './DeviationBarChart';
import { ReportDynamicFilterBar } from './ReportDynamicFilterBar';
import { EsmeLogo } from './EsmeLogo';
import { 
  FileText, 
  FileSpreadsheet, 
  Trophy, 
  Search, 
  CheckCircle, 
  AlertOctagon, 
  Boxes, 
  ClipboardList, 
  ExternalLink, 
  X, 
  Medal, 
  Percent, 
  Download, 
  Printer,
  Activity,
  Radio,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Store,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  AlertTriangle,
  Scale,
  Sparkles,
  ArrowRight,
  Zap,
  Crown,
  RotateCcw
} from 'lucide-react';

interface ReportsTabProps {
  db: AppDatabase;
  onUpdateDb?: (updater: (prev: AppDatabase) => AppDatabase) => void;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ db, onUpdateDb }) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedAisleId, setSelectedAisleId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [diffViewMode, setDiffViewMode] = useState<'visual' | 'table'>('visual');
  const [diffSortBy, setDiffSortBy] = useState<'abs_diff' | 'shortage_first' | 'surplus_first' | 'name'>('abs_diff');
  const [inspectBranch, setInspectBranch] = useState<Branch | null>(null);
  const [widgetFilter, setWidgetFilter] = useState<'all' | 'active' | 'completed' | 'not_started'>('all');
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => new Date().toLocaleTimeString('tr-TR'));

  // Live real-time tick to update timestamp or show sync activity
  useEffect(() => {
    const handleUpdate = () => {
      setLastSyncTime(new Date().toLocaleTimeString('tr-TR'));
    };

    window.addEventListener('app_db_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('app_db_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleResetFilters = () => {
    setSelectedBranchId('all');
    setSelectedAisleId('all');
    setSelectedCategoryId('all');
    setSelectedStatus('all');
    setSearchQuery('');
  };

  // Compute filtered counts with strict Number parsing
  let counts = db.counts || [];
  if (selectedBranchId !== 'all') {
    const selBId = Number(selectedBranchId);
    counts = counts.filter(c => Number(c.branchId) === selBId);
  }

  let totalCounted = 0;
  let exactCount = 0;
  let shortageCount = 0;
  let surplusCount = 0;
  let netDiffSum = 0;
  let totalCentralStockSum = 0;
  let totalCountedQuantitySum = 0;

  const comparisonRows: any[] = [];

  counts.forEach(c => {
    const cBId = Number(c.branchId);
    const cPId = Number(c.productId);
    const branch = db.branches.find(b => Number(b.id) === cBId) || { id: cBId, name: 'Bilinmiyor', code: '-' };
    const prod = db.products.find(p => Number(p.id) === cPId) || {
      id: cPId,
      description: 'Bilinmeyen Ürün',
      barcode: '-',
      stockCode: '-',
      centralStock: 0,
      aisleId: 0,
      category: 'Genel Kategori'
    };

    // Filter by Aisle
    if (selectedAisleId !== 'all' && prod.aisleId !== Number(selectedAisleId)) {
      return;
    }

    // Filter by Category
    if (selectedCategoryId !== 'all' && prod.category !== selectedCategoryId) {
      return;
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match = prod.description.toLowerCase().includes(q) ||
        prod.barcode.includes(q) ||
        prod.stockCode.toLowerCase().includes(q) ||
        branch.name.toLowerCase().includes(q) ||
        (prod.category && prod.category.toLowerCase().includes(q));
      if (!match) return;
    }

    const aisle = db.aisles.find(a => a.id === prod.aisleId) || { name: 'Genel' };
    const diff = c.quantity - prod.centralStock;

    totalCentralStockSum += prod.centralStock;
    totalCountedQuantitySum += c.quantity;

    let st = 'exact';
    if (diff < 0) st = 'shortage';
    else if (diff > 0) st = 'surplus';

    if (st === 'exact') exactCount++;
    else if (st === 'shortage') shortageCount++;
    else if (st === 'surplus') surplusCount++;

    if (selectedStatus === 'exact' && st !== 'exact') return;
    if (selectedStatus === 'diff' && st === 'exact') return;
    if (selectedStatus === 'shortage' && st !== 'shortage') return;
    if (selectedStatus === 'surplus' && st !== 'surplus') return;

    totalCounted++;
    netDiffSum += diff;

    // Accuracy percentage for this product
    const accuracyPercent = prod.centralStock > 0 
      ? Math.round((c.quantity / prod.centralStock) * 100)
      : (c.quantity === 0 ? 100 : 0);

    comparisonRows.push({
      branchName: branch.name,
      branchCode: branch.code,
      branchId: branch.id,
      aisleName: aisle.name,
      prod,
      qty: c.quantity,
      diff,
      absDiff: Math.abs(diff),
      st,
      accuracyPercent,
      countedAt: c.countedAt
    });
  });

  // Sort comparison rows based on diffSortBy
  const sortedComparisonRows = [...comparisonRows].sort((a, b) => {
    if (diffSortBy === 'abs_diff') return b.absDiff - a.absDiff;
    if (diffSortBy === 'shortage_first') return a.diff - b.diff; // most negative first
    if (diffSortBy === 'surplus_first') return b.diff - a.diff; // most positive first
    if (diffSortBy === 'name') return a.prod.description.localeCompare(b.prod.description);
    return 0;
  });

  // Calculate Leaderboard scores
  const branchLeaderboard = db.branches.map(b => {
    const evals = db.evaluations.filter(e => e.branchId === b.id);
    const avgScore = evals.length ? evals.reduce((sum, e) => sum + e.score, 0) / evals.length : 0;
    
    // Also compute stock accuracy percent
    const assignedIds = db.assignments.filter(a => a.branchId === b.id).map(a => a.productId);
    const branchCounts = db.counts.filter(c => c.branchId === b.id);
    let matched = 0;
    branchCounts.forEach(c => {
      const prod = db.products.find(p => p.id === c.productId);
      if (prod && prod.centralStock === c.quantity) matched++;
    });
    const accuracy = branchCounts.length ? Math.round((matched / branchCounts.length) * 100) : 0;

    return {
      branch: b,
      score: avgScore,
      evalCount: evals.length,
      accuracy,
      countedTotal: branchCounts.length,
      assignedTotal: assignedIds.length
    };
  });

  branchLeaderboard.sort((a, b) => (b.score || b.accuracy) - (a.score || a.accuracy));

  // --- Real-time Active Counts & Progress Calculations ---
  const branchProgressData = db.branches.map(b => {
    const branchIdNum = Number(b.id);
    const assignedIds = (db.assignments || [])
      .filter(a => Number(a.branchId) === branchIdNum || Number(a.branchId) === 0)
      .map(a => Number(a.productId));
    const assignedTotal = assignedIds.length > 0 ? assignedIds.length : (db.products || []).length;
    const branchCounts = (db.counts || []).filter(c => Number(c.branchId) === branchIdNum && Number(c.quantity) > 0);
    const countedTotal = branchCounts.length;
    const totalQtyCounted = branchCounts.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);

    const progressPct = assignedTotal > 0 
      ? Math.min(100, Math.round((countedTotal / assignedTotal) * 100))
      : (countedTotal > 0 ? 100 : 0);

    // Latest count activity
    const latestCount = [...(db.counts || [])]
      .filter(c => Number(c.branchId) === branchIdNum && c.countedAt)
      .sort((a, b) => (b.countedAt || '').localeCompare(a.countedAt || ''))[0];

    // Discrepancy stats for this branch
    let exact = 0;
    let withDiff = 0;
    branchCounts.forEach(c => {
      const p = db.products.find(item => Number(item.id) === Number(c.productId));
      if (p) {
        if (Number(p.centralStock) === Number(c.quantity)) exact++;
        else withDiff++;
      }
    });

    const branchStatusRec = (db.branchStatuses || []).find(s => Number(s.branchId) === branchIdNum);
    let status: 'completed' | 'active' | 'not_started' = 'not_started';
    if (branchStatusRec?.isCompleted) {
      status = 'completed';
    } else if (progressPct === 100 && assignedTotal > 0) {
      status = 'completed';
    } else if (countedTotal > 0) {
      status = 'active';
    }

    return {
      branch: b,
      assignedTotal,
      countedTotal,
      totalQtyCounted,
      remainingTotal: Math.max(0, assignedTotal - countedTotal),
      progressPct,
      latestCountTime: latestCount ? latestCount.countedAt : null,
      exactCount: exact,
      withDiffCount: withDiff,
      status
    };
  });

  // Overall totals across all branches
  const totalAssignedAcrossSystem = branchProgressData.reduce((sum, b) => sum + b.assignedTotal, 0);
  const totalCountedAcrossSystem = branchProgressData.reduce((sum, b) => sum + b.countedTotal, 0);
  const totalRemainingAcrossSystem = Math.max(0, totalAssignedAcrossSystem - totalCountedAcrossSystem);
  const overallSystemProgressPct = totalAssignedAcrossSystem > 0
    ? Math.min(100, Math.round((totalCountedAcrossSystem / totalAssignedAcrossSystem) * 100))
    : 0;

  const totalBranchesCount = db.branches.length;
  const activeBranchesCount = branchProgressData.filter(b => b.status === 'active' || b.status === 'completed').length;
  const completedBranchesCount = branchProgressData.filter(b => b.status === 'completed').length;

  const filteredBranchProgress = branchProgressData.filter(b => {
    if (widgetFilter === 'active') return b.status === 'active';
    if (widgetFilter === 'completed') return b.status === 'completed';
    if (widgetFilter === 'not_started') return b.status === 'not_started';
    return true;
  });

  const handleDownloadPdf = () => {
    exportComparisonReportPdf(db, selectedBranchId, selectedStatus);
  };

  const handleDownloadExcel = () => {
    exportComparisonReportExcel(db, selectedBranchId, selectedStatus);
  };

  // Percentage breakdown of exact vs shortage vs surplus
  const totalDiscrepancyItems = exactCount + shortageCount + surplusCount;
  const exactPercentage = totalDiscrepancyItems > 0 ? Math.round((exactCount / totalDiscrepancyItems) * 100) : 0;
  const shortagePercentage = totalDiscrepancyItems > 0 ? Math.round((shortageCount / totalDiscrepancyItems) * 100) : 0;
  const surplusPercentage = totalDiscrepancyItems > 0 ? Math.round((surplusCount / totalDiscrepancyItems) * 100) : 0;

  // System Absolute Difference & Deviation Rate
  const systemAbsDiff = counts.reduce((sum, c) => {
    const prod = db.products.find(p => p.id === c.productId);
    return sum + Math.abs(c.quantity - (prod ? prod.centralStock : 0));
  }, 0);

  const systemDeviationRate = totalCentralStockSum > 0
    ? ((systemAbsDiff / totalCentralStockSum) * 100).toFixed(1)
    : '0.0';

  // Automated Evaluations across all branches for Performance Highlights
  const allBranchEvals = db.branches.map(b => calculateBranchAutoEvaluation(b, db));

  // Fastest Completing Store
  const completedList = [...branchProgressData]
    .filter(b => b.progressPct === 100 && b.countedTotal > 0)
    .sort((a, b) => (a.latestCountTime || '9999').localeCompare(b.latestCountTime || '9999'));

  const fastestBranch = completedList[0] ||
    [...branchProgressData]
      .filter(b => b.countedTotal > 0)
      .sort((a, b) => b.progressPct - a.progressPct || (a.latestCountTime || '9999').localeCompare(b.latestCountTime || '9999'))[0];

  // Highest Accuracy Store
  const topAccuracyBranch = [...allBranchEvals]
    .filter(ae => ae.totalCountedItems > 0)
    .sort((a, b) => b.performanceScore - a.performanceScore || b.exactMatchRate - a.exactMatchRate)[0];

  return (
    <div className="space-y-6">
      {/* Top Banner with Action Buttons and Esme Logo */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-2 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-xs flex items-center justify-center">
            <EsmeLogo size="md" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <span>Esme Sayım Paneli — Raporlar & Performans Denetimi</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Canlı mağaza performansını inceleyin, stok fark analizlerini denetleyin ve resmi mutabakat raporlarını indirin.
            </p>
          </div>
        </div>

        {/* Download Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer"
            title="Detaylı Karşılaştırma Raporunu PDF olarak indir"
          >
            <FileText className="w-4 h-4" />
            <span>PDF Olarak İndir</span>
          </button>

          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
            title="Raporu Excel (.xlsx) formatında indir"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel Olarak İndir</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ANLIK MAĞAZA PERFORMANS KARTLARI (TOPLAM SAYILAN, SAPMA, HIZ, DOĞRULUK)   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Kart 1: Toplam Sayılan Ürün */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3 hover:border-indigo-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Toplam Sayılan Ürün
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-black text-slate-900 font-mono">
                {totalCountedQuantitySum.toLocaleString('tr-TR')}
              </h3>
              <span className="text-xs font-bold text-slate-500">Adet</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Fiziki Kalem: <strong>{totalCounted}</strong></span>
              <span>Merkez: <strong>{totalCentralStockSum} Adet</strong></span>
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-emerald-700 font-semibold bg-emerald-50/70 p-2 rounded-xl">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{totalCountedAcrossSystem} kalem sayım sisteme kaydedildi</span>
          </div>
        </div>

        {/* Kart 2: Genel Sapma Oranı */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3 hover:border-amber-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Genel Sapma Oranı
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className={`text-2xl font-black font-mono ${parseFloat(systemDeviationRate) > 10 ? 'text-rose-600' : 'text-amber-600'}`}>
                %{systemDeviationRate}
              </h3>
              <span className="text-xs font-bold text-slate-500">Sapma</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Net Fark: <strong>{netDiffSum > 0 ? `+${netDiffSum}` : netDiffSum} Adet</strong></span>
              <span>Mutlak Fark: <strong>{systemAbsDiff}</strong></span>
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-600 font-semibold">
            <span className="text-rose-600">{shortageCount} Eksik</span>
            <span className="text-amber-600">{surplusCount} Fazla</span>
            <span className="text-emerald-600">{exactCount} Tam</span>
          </div>
        </div>

        {/* Kart 3: En Hızlı Tamamlayan Mağaza */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3 hover:border-emerald-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              En Hızlı Tamamlayan
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 truncate" title={fastestBranch?.branch.name}>
              {fastestBranch ? fastestBranch.branch.name : 'Veri Bekleniyor'}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                fastestBranch?.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-indigo-100 text-indigo-800'
              }`}>
                {fastestBranch?.status === 'completed' ? 'Tamamlandı (%100)' : `%${fastestBranch?.progressPct || 0} İlerleme`}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {fastestBranch?.branch.code}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>{fastestBranch?.latestCountTime ? `Son: ${fastestBranch.latestCountTime}` : 'Henüz işlem yok'}</span>
            <span className="text-emerald-700 font-bold flex items-center gap-0.5">
              <Zap className="w-3 h-3" /> Hız Lideri
            </span>
          </div>
        </div>

        {/* Kart 4: Doğruluk & Başarı Şampiyonu */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3 hover:border-indigo-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Doğruluk Şampiyonu
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Crown className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 truncate" title={topAccuracyBranch?.branchName}>
              {topAccuracyBranch ? topAccuracyBranch.branchName : 'Veri Bekleniyor'}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-black text-indigo-700 font-mono">
                {topAccuracyBranch?.performanceScore || 0} / 100 Puan
              </span>
              <span className="text-[10px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-md">
                {topAccuracyBranch?.grade || 'A+'}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Tam Eşleşme: %{topAccuracyBranch?.exactMatchRate || 0}</span>
            <span className="text-amber-700 font-bold flex items-center gap-0.5">
              <Crown className="w-3 h-3" /> Kalite Lideri
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REAL-TIME DASHBOARD WIDGET: ACTIVE COUNTS ACROSS ALL BRANCHES & PROGRESS */}
      {/* ========================================================================= */}
      <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 rounded-3xl shadow-xl border border-indigo-500/20 relative overflow-hidden space-y-6">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Widget Header with Live Beacon */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-indigo-600/80 text-white rounded-2xl shadow-lg shadow-indigo-600/30">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                  Canlı Şube Sayım Takip Panosu
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Gerçek Zamanlı</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Tüm mağazaların aktif kör sayım ilerleme yüzdeleri ve canlı mutabakat durumu
              </p>
            </div>
          </div>

          {/* Quick Real-Time Sync Indicator & Live Refresh Action */}
          <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
            <div className="flex items-center gap-2 text-xs text-slate-300 bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl font-mono">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Canlı Akış: <strong className="text-white">{lastSyncTime}</strong></span>
            </div>

            <button
              type="button"
              onClick={async () => {
                const remote = await fetchRemoteDatabase();
                if (remote && onUpdateDb) {
                  onUpdateDb(() => remote);
                }
                setLastSyncTime(new Date().toLocaleTimeString('tr-TR'));
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold border border-indigo-400/40 transition cursor-pointer shadow-md shadow-indigo-600/30"
              title="Sunucudaki en güncel şube sayımlarını anında çek"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Anlık Yenile</span>
            </button>
          </div>
        </div>

        {/* Overall System Progress Bar & Metric Strip */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Left: Big Progress Dial & Progress Bar */}
          <div className="lg:col-span-7 bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <span>Genel Sistem Sayım İlerlemesi</span>
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                %{overallSystemProgressPct}
              </span>
            </div>

            {/* Main Gradient Progress Bar */}
            <div className="w-full bg-slate-800/80 rounded-full h-4 p-0.5 border border-white/10 overflow-hidden shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-700 shadow-md shadow-emerald-500/30"
                style={{ width: `${overallSystemProgressPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>Toplam Sayılan: <strong className="text-white font-bold">{totalCountedAcrossSystem}</strong> / {totalAssignedAcrossSystem} Kalem</span>
              <span>Kalan: <strong className="text-amber-300 font-bold">{totalRemainingAcrossSystem}</strong> Kalem</span>
            </div>
          </div>

          {/* Right: Quick KPI Mini Metrics */}
          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
              <p className="text-[11px] text-slate-400 font-medium">Aktif Şubeler</p>
              <h4 className="text-xl font-black text-indigo-300 mt-1">
                {activeBranchesCount} <span className="text-xs font-normal text-slate-400">/ {totalBranchesCount}</span>
              </h4>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
              <p className="text-[11px] text-slate-400 font-medium">Tamamlanan</p>
              <h4 className="text-xl font-black text-emerald-400 mt-1">
                {completedBranchesCount} <span className="text-xs font-normal text-slate-400">Şube</span>
              </h4>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
              <p className="text-[11px] text-slate-400 font-medium">Toplam Atama</p>
              <h4 className="text-xl font-black text-slate-200 mt-1">
                {totalAssignedAcrossSystem} <span className="text-xs font-normal text-slate-400">Ürün</span>
              </h4>
            </div>
          </div>
        </div>

        {/* Branch Progress Cards Section */}
        <div className="relative z-10 space-y-3">
          {/* Subheader with Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-indigo-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Mağaza Bazında Canlı İlerleme Yüzdeleri ({filteredBranchProgress.length})
              </h4>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setWidgetFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  widgetFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tümü ({branchProgressData.length})
              </button>
              <button
                onClick={() => setWidgetFilter('active')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  widgetFilter === 'active'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Devam Eden ({branchProgressData.filter(b => b.status === 'active').length})
              </button>
              <button
                onClick={() => setWidgetFilter('completed')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  widgetFilter === 'completed'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tamamlanan ({completedBranchesCount})
              </button>
            </div>
          </div>

          {/* Grid of Branch Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredBranchProgress.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-400 text-xs bg-white/5 rounded-2xl border border-white/10">
                Bu filtreye uygun şube bulunamadı.
              </div>
            ) : (
              filteredBranchProgress.map(bp => {
                let badgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
                let badgeLabel = 'Başlamadı';
                let badgeIcon = <Clock className="w-3 h-3" />;
                let barColor = 'from-slate-600 to-slate-500';

                if (bp.status === 'completed') {
                  badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                  badgeLabel = 'Tamamlandı';
                  badgeIcon = <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
                  barColor = 'from-emerald-500 to-teal-400';
                } else if (bp.status === 'active') {
                  badgeClass = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
                  badgeLabel = 'Sayım Sürüyor';
                  badgeIcon = <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />;
                  barColor = 'from-indigo-500 to-indigo-400';
                }

                return (
                  <div
                    key={bp.branch.id}
                    className="bg-white/5 hover:bg-white/[0.08] transition-all border border-white/10 rounded-2xl p-4 flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      {/* Top row: Name & Status badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h5 className="font-bold text-sm text-white group-hover:text-indigo-300 transition">
                            {bp.branch.name}
                          </h5>
                          <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                            {bp.branch.code}
                          </span>
                        </div>

                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                          {badgeIcon}
                          <span>{badgeLabel}</span>
                        </span>
                      </div>

                      {/* Percentage & Progress Bar */}
                      <div className="space-y-1.5 mt-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-medium">İlerleme:</span>
                          <span className="font-black text-sm text-white font-mono">
                            %{bp.progressPct}
                          </span>
                        </div>

                        <div className="w-full bg-slate-800 rounded-full h-2.5 p-0.5 overflow-hidden border border-white/10">
                          <div 
                            className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
                            style={{ width: `${bp.progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Breakdown Stats */}
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/10 text-[11px]">
                        <div>
                          <span className="text-slate-400 block">Sayılan / Atanan:</span>
                          <strong className="text-slate-200">
                            {bp.countedTotal} / {bp.assignedTotal} Kalem
                            <span className="text-indigo-300 font-mono text-[10px] block mt-0.5">
                              (Toplam: {bp.totalQtyCounted} Adet)
                            </span>
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Tam Eşleşen:</span>
                          <strong className="text-emerald-400">{bp.exactCount} Ürün</strong>
                          {bp.withDiffCount > 0 && (
                            <span className="text-rose-400 text-[10px] ml-1">({bp.withDiffCount} fark)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action: Inspect Branch button */}
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 truncate font-mono">
                        {bp.latestCountTime ? `Son: ${bp.latestCountTime}` : 'Henüz sayım yok'}
                      </span>

                      <button
                        onClick={() => setInspectBranch(bp.branch)}
                        className="px-2.5 py-1 bg-white/10 hover:bg-indigo-600 text-white rounded-lg text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <span>İncele</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Dynamic Filter Bar: Şube, Reyon, Ürün Kategorisi, Durum & Arama */}
      <ReportDynamicFilterBar
        db={db}
        selectedBranchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        selectedAisleId={selectedAisleId}
        onAisleChange={setSelectedAisleId}
        selectedCategoryId={selectedCategoryId}
        onCategoryChange={setSelectedCategoryId}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalFilteredCount={comparisonRows.length}
        totalCount={db.counts.length}
        onResetFilters={handleResetFilters}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Toplam Sayılan Kalem</p>
            <h4 className="text-2xl font-black text-slate-900 mt-1">{totalCounted}</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Kör sayım kaydı</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <ClipboardList className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Tam Eşleşen Ürün</p>
            <h4 className="text-2xl font-black text-emerald-600 mt-1">{exactCount}</h4>
            <p className="text-[10px] text-emerald-600/80 mt-0.5">Sıfır fark ile mutabık</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Eksik Stok (Kayıp/Fire)</p>
            <h4 className="text-2xl font-black text-rose-600 mt-1">{shortageCount}</h4>
            <p className="text-[10px] text-rose-600/80 mt-0.5">Merkezden az sayılan</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <AlertOctagon className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Fazla Stok / Net Fark</p>
            <h4 className="text-2xl font-black text-amber-600 mt-1">
              {surplusCount} <span className="text-xs font-semibold text-slate-500">({netDiffSum > 0 ? `+${netDiffSum}` : netDiffSum})</span>
            </h4>
            <p className="text-[10px] text-amber-600/80 mt-0.5">Fazla veya kayıp dengesi</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <Boxes className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Interactive Deviation Bar Chart (Çubuk Grafik) */}
      <DeviationBarChart 
        db={db} 
        selectedBranchId={selectedBranchId}
        selectedAisleId={selectedAisleId}
        selectedCategoryId={selectedCategoryId}
        searchQuery={searchQuery}
      />

      {/* ========================================================================= */}
      {/* VISUAL DIFFERENCE REPORT (BEKLENEN STOK vs FİZİKSEL SAYIM FARK ANALİZİ)    */}
      {/* ========================================================================= */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
        {/* Header & View Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                  Görsel Stok Fark Raporu (Difference Report)
                </h3>
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  Beklenen vs Sayılan
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Her ürün için beklenen merkez stok ile mağazada sayılan fiziksel miktarın görsel karşılaştırması
              </p>
            </div>
          </div>

          {/* Toggle between Visual Cards & Data Table */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDiffViewMode('visual')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  diffViewMode === 'visual'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Görsel Analiz</span>
              </button>

              <button
                type="button"
                onClick={() => setDiffViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  diffViewMode === 'table'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Tablo Görünümü</span>
              </button>
            </div>
          </div>
        </div>

        {/* Visual Difference Distribution Strip */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Stok Mutabakat Oran Dağılımı</span>
            </span>
            <div className="flex items-center gap-4 text-[11px] font-medium">
              <span className="flex items-center gap-1 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Tam Eşleşen: %{exactPercentage} ({exactCount})</span>
              </span>
              <span className="flex items-center gap-1 text-rose-700">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Eksik: %{shortagePercentage} ({shortageCount})</span>
              </span>
              <span className="flex items-center gap-1 text-amber-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Fazla: %{surplusPercentage} ({surplusCount})</span>
              </span>
            </div>
          </div>

          {/* Stacked multi-color progress bar */}
          <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden flex shadow-inner">
            <div 
              style={{ width: `${exactPercentage}%` }} 
              className="bg-emerald-500 transition-all duration-500 h-full"
              title={`Tam Eşleşen: %${exactPercentage}`}
            />
            <div 
              style={{ width: `${shortagePercentage}%` }} 
              className="bg-rose-500 transition-all duration-500 h-full"
              title={`Eksik Stok: %${shortagePercentage}`}
            />
            <div 
              style={{ width: `${surplusPercentage}%` }} 
              className="bg-amber-500 transition-all duration-500 h-full"
              title={`Fazla Stok: %${surplusPercentage}`}
            />
          </div>
        </div>

        {/* Filter & Sorting Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-semibold text-slate-500">Filtrele:</span>

            {/* Branch Filter */}
            <select
              value={selectedBranchId}
              onChange={e => setSelectedBranchId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="all">Tüm Mağazalar</option>
              {db.branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="all">Tüm Durumlar ({comparisonRows.length})</option>
              <option value="diff">Fark Olanlar ({shortageCount + surplusCount})</option>
              <option value="shortage">Sadece Eksikler ({shortageCount})</option>
              <option value="surplus">Sadece Fazlalar ({surplusCount})</option>
              <option value="exact">Tam Eşleşenler ({exactCount})</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Sırala:</span>
            <select
              value={diffSortBy}
              onChange={e => setDiffSortBy(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="abs_diff">En Büyük Fark (Mutlak)</option>
              <option value="shortage_first">En Çok Eksik Çıkanlar (Kayıp)</option>
              <option value="surplus_first">En Çok Fazla Çıkanlar</option>
              <option value="name">Ürün Adına Göre</option>
            </select>
          </div>
        </div>

        {/* Content: Visual Cards or Data Table */}
        {sortedComparisonRows.length === 0 ? (
          <div className="p-10 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
            Seçili filtrelere uygun sayım farkı bulunamadı.
          </div>
        ) : diffViewMode === 'visual' ? (
          /* ========================================================================= */
          /* 1. VISUAL COMPARISON CARDS WITH DUAL COMPARATIVE BARS & DISCREPANCY GAUGES */
          /* ========================================================================= */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedComparisonRows.map((r, i) => {
              const maxVal = Math.max(r.prod.centralStock, r.qty, 1);
              const expectedPct = Math.round((r.prod.centralStock / maxVal) * 100);
              const countedPct = Math.round((r.qty / maxVal) * 100);

              let cardBorderClass = 'border-slate-200 bg-white hover:border-slate-300';
              let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
              let badgeText = 'Tam Eşleşme';
              let deltaBadge = (
                <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Fark: 0
                </span>
              );

              if (r.diff < 0) {
                cardBorderClass = 'border-rose-200 bg-rose-50/20 hover:border-rose-300';
                badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                badgeText = `Eksik Stok (${r.diff})`;
                deltaBadge = (
                  <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>{r.diff} Adet</span>
                  </span>
                );
              } else if (r.diff > 0) {
                cardBorderClass = 'border-amber-200 bg-amber-50/20 hover:border-amber-300';
                badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                badgeText = `Fazla Stok (+${r.diff})`;
                deltaBadge = (
                  <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>+{r.diff} Adet</span>
                  </span>
                );
              }

              return (
                <div
                  key={i}
                  className={`p-4 rounded-2xl border shadow-xs transition-all flex flex-col justify-between gap-3 ${cardBorderClass}`}
                >
                  {/* Top: Product Name, Branch & Status Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                        {r.aisleName}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                        {badgeText}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm line-clamp-1" title={r.prod.description}>
                      {r.prod.description}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-0.5">
                      <span>Barkod: <strong className="text-slate-600">{r.prod.barcode}</strong></span>
                      <span className="text-slate-500 font-sans font-semibold">{r.branchName}</span>
                    </div>
                  </div>

                  {/* Middle: Comparative Visual Stock Bars */}
                  <div className="space-y-2.5 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                    {/* Expected (Merkez) Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Merkez Stok (Beklenen):</span>
                        <strong className="text-slate-700 font-bold">{r.prod.centralStock} Adet</strong>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-slate-600 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${expectedPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Counted (Fiziksel) Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Fiziksel Sayılan:</span>
                        <strong className={`font-black ${
                          r.diff === 0 ? 'text-emerald-700' : r.diff < 0 ? 'text-rose-700' : 'text-amber-700'
                        }`}>
                          {r.qty} Adet
                        </strong>
                      </div>
                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            r.diff === 0 ? 'bg-emerald-500' : r.diff < 0 ? 'bg-rose-500' : 'bg-amber-500'
                          }`} 
                          style={{ width: `${countedPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Delta Summary Chip */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">Mutabakat:</span>
                      {deltaBadge}
                    </div>

                    <span className="text-[11px] font-mono font-bold text-slate-500">
                      Doğruluk: %{r.accuracyPercent}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ========================================================================= */
          /* 2. CLASSIC DETAILED DATA TABLE                                            */
          /* ========================================================================= */
          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider border-b border-slate-100 font-bold">
                <tr>
                  <th className="p-3.5">Mağaza</th>
                  <th className="p-3.5">Reyon</th>
                  <th className="p-3.5">Ürün Açıklaması</th>
                  <th className="p-3.5">Barkod</th>
                  <th className="p-3.5 text-center">Merkez Stok</th>
                  <th className="p-3.5 text-center">Sayılan</th>
                  <th className="p-3.5 text-center">Net Fark</th>
                  <th className="p-3.5 text-center">Doğruluk</th>
                  <th className="p-3.5">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedComparisonRows.map((r, i) => {
                  let badge = (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Tam Eşleşme
                    </span>
                  );
                  let diffEl = <span className="font-bold text-emerald-600">0</span>;

                  if (r.diff < 0) {
                    badge = (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        Eksik Stok ({r.diff})
                      </span>
                    );
                    diffEl = <span className="font-bold text-rose-600">{r.diff}</span>;
                  } else if (r.diff > 0) {
                    badge = (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Fazla Stok (+{r.diff})
                      </span>
                    );
                    diffEl = <span className="font-bold text-amber-600">+{r.diff}</span>;
                  }

                  return (
                    <tr key={i} className="hover:bg-slate-50/60 transition">
                      <td className="p-3.5 font-semibold text-slate-900 whitespace-nowrap">
                        {r.branchName}
                      </td>
                      <td className="p-3.5 text-indigo-600 font-medium whitespace-nowrap">
                        {r.aisleName}
                      </td>
                      <td className="p-3.5 font-semibold text-slate-800">
                        {r.prod.description}
                      </td>
                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {r.prod.barcode}
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-600">
                        {r.prod.centralStock}
                      </td>
                      <td className="p-3.5 text-center font-black text-slate-900">
                        {r.qty}
                      </td>
                      <td className="p-3.5 text-center">
                        {diffEl}
                      </td>
                      <td className="p-3.5 text-center font-mono font-semibold text-slate-600">
                        %{r.accuracyPercent}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        {badge}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leaderboard and Branch Review Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Başarılı Mağazalar Sıralaması (Leaderboard)</span>
            </h3>
            <span className="text-[11px] text-slate-400">Puan & Doğruluk</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 uppercase tracking-wider font-bold">
                <tr>
                  <th className="p-3">Sıra</th>
                  <th className="p-3">Mağaza</th>
                  <th className="p-3 text-center">Doğruluk</th>
                  <th className="p-3 text-center">Yönetim Puanı</th>
                  <th className="p-3 text-right">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branchLeaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400">Kayıtlı mağaza yok.</td>
                  </tr>
                ) : (
                  branchLeaderboard.map((item, index) => {
                    let medal = null;
                    if (index === 0) medal = <Medal className="w-4 h-4 text-amber-500 inline mr-1" />;
                    else if (index === 1) medal = <Medal className="w-4 h-4 text-slate-400 inline mr-1" />;
                    else if (index === 2) medal = <Medal className="w-4 h-4 text-amber-700 inline mr-1" />;

                    return (
                      <tr key={item.branch.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3 font-bold text-slate-700 whitespace-nowrap">
                          {medal} #{index + 1}
                        </td>
                        <td className="p-3 font-semibold text-slate-900 whitespace-nowrap">
                          {item.branch.name}
                          <span className="text-[10px] text-slate-400 block font-mono">({item.branch.code})</span>
                        </td>
                        <td className="p-3 text-center font-semibold text-slate-700">
                          %{item.accuracy}
                        </td>
                        <td className="p-3 text-center font-bold text-indigo-600">
                          {item.score > 0 ? `${item.score.toFixed(1)} / 100` : '-'}
                        </td>
                        <td className="p-3 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                            {item.evalCount} Değerlendirme
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Branch Inspection List */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-600" />
              <span>Mağaza Sayım İnceleme & Özel PDF</span>
            </h3>
            <span className="text-[11px] text-slate-400">Şube Bazlı Denetim</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 uppercase tracking-wider font-bold">
                <tr>
                  <th className="p-3">Mağaza</th>
                  <th className="p-3 text-center">Atanan</th>
                  <th className="p-3 text-center">Sayılan</th>
                  <th className="p-3 text-right">İncele / PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.branches.map(b => {
                  const assignedCount = db.assignments.filter(a => a.branchId === b.id).length;
                  const countedCount = db.counts.filter(c => c.branchId === b.id).length;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3 font-semibold text-slate-900 whitespace-nowrap">
                        {b.name}
                        <span className="text-[10px] text-slate-400 block font-mono">({b.code})</span>
                      </td>
                      <td className="p-3 text-center font-medium text-slate-600">{assignedCount}</td>
                      <td className="p-3 text-center font-bold text-indigo-600">{countedCount}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setInspectBranch(b)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-semibold transition text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Detay İncele</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Branch Inspection Modal */}
      {inspectBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <span>{inspectBranch.name}</span>
                  <span className="text-xs font-mono bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded">
                    {inspectBranch.code}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">Şube Özel Sayım İncelemesi ve Mutabakat Kartı</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportBranchDetailPdf(db, inspectBranch.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  title="Bu şubenin sayım raporunu PDF olarak indir"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Şube PDF İndir</span>
                </button>

                <button
                  onClick={() => setInspectBranch(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Summary Stats */}
              {(() => {
                const assignedIds = db.assignments.filter(a => a.branchId === inspectBranch.id).map(a => a.productId);
                const assignedProducts = db.products.filter(p => assignedIds.includes(p.id));
                const evals = db.evaluations.filter(e => e.branchId === inspectBranch.id);
                const lastEval = evals.length ? evals[evals.length - 1] : null;
                const branchCounts = db.counts.filter(c => c.branchId === inspectBranch.id);

                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                      <p className="font-semibold text-indigo-700">Atanan / Sayılan Ürün</p>
                      <p className="text-xl font-bold text-indigo-950 mt-1">
                        {branchCounts.length} / {assignedProducts.length} Kalem
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100">
                      <p className="font-semibold text-amber-700">Yönetim Puanı</p>
                      <p className="text-xl font-bold text-amber-950 mt-1">
                        {lastEval ? `${lastEval.score} / 100` : 'Henüz Değerlendirilmedi'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      <p className="font-semibold text-slate-600">Son Yönetim Geri Bildirimi</p>
                      <p className="text-slate-800 mt-1 italic">
                        {lastEval && lastEval.feedback ? `"${lastEval.feedback}"` : 'Not girilmemiş.'}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Items Table */}
              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-3">Şubeye Atanan Ürünlerin Sayım Durumu</h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3">Reyon</th>
                        <th className="p-3">Ürün Açıklaması</th>
                        <th className="p-3">Barkod</th>
                        <th className="p-3 text-center">Merkez Stok</th>
                        <th className="p-3 text-center">Sayılan</th>
                        <th className="p-3 text-center">Fark</th>
                        <th className="p-3">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const assignedIds = db.assignments.filter(a => a.branchId === inspectBranch.id).map(a => a.productId);
                        const assignedProducts = db.products.filter(p => assignedIds.includes(p.id));

                        if (assignedProducts.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="p-6 text-center text-slate-400">
                                Bu şubeye atanmış ürün bulunmuyor.
                              </td>
                            </tr>
                          );
                        }

                        return assignedProducts.map(p => {
                          const countRec = db.counts.find(c => c.branchId === inspectBranch.id && c.productId === p.id);
                          const qty = countRec ? countRec.quantity : 0;
                          const diff = qty - p.centralStock;
                          const aisle = db.aisles.find(a => a.id === p.aisleId) || { name: 'Genel' };

                          let statusBadge = (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                              Tam Eşleşme
                            </span>
                          );
                          let diffEl = <span className="font-bold text-emerald-600">0</span>;

                          if (diff < 0) {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700">
                                Eksik ({diff})
                              </span>
                            );
                            diffEl = <span className="font-bold text-rose-600">{diff}</span>;
                          } else if (diff > 0) {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700">
                                Fazla (+{diff})
                              </span>
                            );
                            diffEl = <span className="font-bold text-amber-600">+{diff}</span>;
                          }

                          return (
                            <tr key={p.id} className="hover:bg-slate-50/50">
                              <td className="p-3 text-indigo-600 font-medium">{aisle.name}</td>
                              <td className="p-3 font-semibold text-slate-900">{p.description}</td>
                              <td className="p-3 font-mono text-[11px] text-slate-400">{p.barcode}</td>
                              <td className="p-3 text-center font-bold text-slate-600">{p.centralStock}</td>
                              <td className="p-3 text-center font-black text-slate-900">{qty}</td>
                              <td className="p-3 text-center">{diffEl}</td>
                              <td className="p-3">{statusBadge}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
