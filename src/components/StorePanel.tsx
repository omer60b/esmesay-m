import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { AppDatabase, Product, User, CountRecord } from '../types';
import { calculateBranchAutoEvaluation } from '../utils/evaluationCalculator';
import { completeBranchCountServer, reopenBranchCountServer, saveCountServer } from '../services/storage';
import { EsmeLogo } from './EsmeLogo';
import { 
  Camera, 
  CameraOff, 
  Barcode, 
  Search, 
  Check, 
  CheckCircle2, 
  CheckCheck,
  Plus, 
  Minus, 
  Award, 
  LogOut, 
  Store, 
  Layers, 
  Sparkles,
  AlertCircle,
  Send,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  FileCheck,
  RotateCcw,
  ClipboardPen,
  History,
  TrendingUp,
  BarChart3,
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText
} from 'lucide-react';

interface StorePanelProps {
  user: User;
  db: AppDatabase;
  onUpdateDb: (updater: (prev: AppDatabase) => AppDatabase) => void;
  onLogout: () => void;
}

export const StorePanel: React.FC<StorePanelProps> = ({ user, db, onUpdateDb, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'count' | 'performance'>('count');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [recentSavedId, setRecentSavedId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filterAisleId, setFilterAisleId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Manual Barcode & Quantity Entry Form State
  const [manualBarcode, setManualBarcode] = useState('');
  const [manualQuantity, setManualQuantity] = useState<number | ''>('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualFeedback, setManualFeedback] = useState('');
  const [showAllBranchesSummary, setShowAllBranchesSummary] = useState(false);

  // Staging / Submission State (Draft vs Submitted to Management)
  const statusKey = `store_submission_status_${user.branchId || 'default'}`;
  const [submissionStatus, setSubmissionStatus] = useState<'draft' | 'submitted'>(() => {
    try {
      return (localStorage.getItem(statusKey) as 'draft' | 'submitted') || 'draft';
    } catch {
      return 'draft';
    }
  });

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const branch = db.branches.find(b => b.id === user.branchId);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const showManualFeedback = (msg: string) => {
    setManualFeedback(msg);
    setTimeout(() => setManualFeedback(''), 3500);
  };

  const branchIdNum = Number(user.branchId);

  // Check branch count completion status
  const branchStatus = (db.branchStatuses || []).find(s => Number(s.branchId) === branchIdNum);
  const isCountCompleted = Boolean(branchStatus?.isCompleted);
  const [showCompletedModal, setShowCompletedModal] = useState(false);

  // Assigned Products for this branch:
  // Shows products assigned to this branch, assigned to all branches ('all' / 0), or all products if no assignments registered
  const assignedProducts = (db.products || []).filter(p => {
    if (!db.assignments || db.assignments.length === 0) {
      return true;
    }
    return db.assignments.some(a => {
      const aBranchStr = String(a.branchId).toLowerCase();
      const isBranchMatch = 
        aBranchStr === 'all' || 
        aBranchStr === '0' || 
        Number(a.branchId) === branchIdNum || 
        Number(a.branchId) === 0;
      const isProductMatch = Number(a.productId) === Number(p.id);
      return isBranchMatch && isProductMatch;
    });
  });

  // Fallback: If assignedProducts is 0 BUT products exist in central db, show all central products so store users are never left empty
  const finalAssignedProducts = (assignedProducts.length > 0 || !db.products || db.products.length === 0)
    ? assignedProducts
    : db.products;

  // Counts for this branch
  const getProductCount = (prodId: number): number => {
    const rec = db.counts.find(c => Number(c.branchId) === branchIdNum && Number(c.productId) === Number(prodId));
    return rec ? rec.quantity : 0;
  };

  // Active store count summary calculations
  const activeStoreCounts = db.counts.filter(c => Number(c.branchId) === branchIdNum && c.quantity > 0);
  const activeStoreTotalQty = activeStoreCounts.reduce((sum, c) => sum + (c.quantity || 0), 0);
  const activeStoreDistinctItems = activeStoreCounts.length;
  const activeStoreAssignedTotal = finalAssignedProducts.length || db.products.length;
  const activeStoreProgressPct = activeStoreAssignedTotal > 0 
    ? Math.min(100, Math.round((activeStoreDistinctItems / activeStoreAssignedTotal) * 100))
    : 0;

  // Last 5 operations for this store (sorted by latest record id desc)
  const last5Operations = [...activeStoreCounts]
    .sort((a, b) => b.id - a.id)
    .slice(0, 5)
    .map(record => {
      const product = db.products.find(p => p.id === record.productId);
      return { record, product };
    });

  // All 35 branches summary calculation
  const allBranchesSummary = db.branches.map(b => {
    const bIdNum = Number(b.id);
    const bCounts = db.counts.filter(c => Number(c.branchId) === bIdNum && c.quantity > 0);
    const totalQty = bCounts.reduce((sum, c) => sum + (c.quantity || 0), 0);
    const distinctCount = bCounts.length;
    const latestCount = [...bCounts].sort((a, b) => b.id - a.id)[0];
    return {
      branch: b,
      totalQty,
      distinctCount,
      latestTime: latestCount?.countedAt || 'Henüz Yok',
      isCurrent: bIdNum === branchIdNum
    };
  }).sort((a, b) => b.totalQty - a.totalQty);

  // Throttling ref for camera barcode scanning to allow natural 1-2-3 sequential increments
  const lastScanThrottleRef = useRef<{ time: number; barcode: string }>({ time: 0, barcode: '' });
  const [lastScannedFeedback, setLastScannedFeedback] = useState<{ name: string; qty: number; barcode: string } | null>(null);

  // Submit or update count (supports direct quantity or atomic increment by 1)
  const handleSaveCount = (productId: number, newQty: number, notes?: string, isIncrement?: boolean): number => {
    if (!user.branchId) return 0;
    const bId = branchIdNum;
    const pId = Number(productId);

    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    let calculatedQty = newQty;

    onUpdateDb(prev => {
      const existingIdx = prev.counts.findIndex(
        c => Number(c.branchId) === bId && Number(c.productId) === pId
      );

      let updatedCounts = [...prev.counts];
      if (existingIdx >= 0) {
        calculatedQty = isIncrement ? updatedCounts[existingIdx].quantity + 1 : Math.max(0, newQty);
        updatedCounts[existingIdx] = {
          ...updatedCounts[existingIdx],
          quantity: calculatedQty,
          countedAt: dateStr,
          counterName: user.fullName || user.username || 'Şube Personeli',
          notes: notes !== undefined ? notes : updatedCounts[existingIdx].notes
        };
      } else {
        calculatedQty = isIncrement ? 1 : Math.max(0, newQty);
        const newId = prev.counts.length ? Math.max(...prev.counts.map(c => c.id)) + 1 : 1;
        const newRecord: CountRecord = {
          id: newId,
          branchId: bId,
          productId: pId,
          quantity: calculatedQty,
          countedAt: dateStr,
          counterName: user.fullName || user.username || 'Şube Personeli',
          notes: notes || ''
        };
        updatedCounts.push(newRecord);
      }

      return {
        ...prev,
        counts: updatedCounts
      };
    });

    // Real-time server sync
    saveCountServer(bId, pId, calculatedQty, user.fullName || user.username, notes).catch(() => {});

    setRecentSavedId(productId);
    setTimeout(() => setRecentSavedId(null), 1200);
    return calculatedQty;
  };

  // Remove count for an item (zero out / delete)
  const handleRemoveCount = (productId: number) => {
    if (!user.branchId) return;
    const bId = branchIdNum;
    const pId = Number(productId);

    onUpdateDb(prev => ({
      ...prev,
      counts: prev.counts.filter(c => !(Number(c.branchId) === bId && Number(c.productId) === pId))
    }));

    saveCountServer(bId, pId, 0, user.fullName || user.username).catch(() => {});
    showToast('Ürün sayım kaydı temizlendi.');
  };

  // Handle Manual Barcode + Quantity Submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualBarcode.trim();
    if (!cleaned) {
      alert('Lütfen bir barkod veya ürün kodu giriniz.');
      return;
    }

    const qty = manualQuantity === '' ? 1 : Number(manualQuantity);
    if (isNaN(qty) || qty < 0) {
      alert('Lütfen geçerli bir ürün adeti giriniz.');
      return;
    }

    const prod = db.products.find(
      p => p.barcode === cleaned || p.stockCode.toLowerCase() === cleaned.toLowerCase()
    );

    if (!prod) {
      alert(`Tanımsız Barkod: "${cleaned}". Bu ürün merkez veritabanında kayıtlı değildir.`);
      return;
    }

    const isAssigned = db.assignments.some(a => a.branchId === user.branchId && a.productId === prod.id);
    if (!isAssigned) {
      alert(`"${prod.description}" ürünü bu mağazaya atanmamıştır!`);
      return;
    }

    handleSaveCount(prod.id, qty, manualNotes.trim());
    showManualFeedback(`"${prod.description}" için ${qty} adet sayım başarıyla kaydedildi.`);
    setManualBarcode('');
    setManualQuantity('');
    setManualNotes('');
  };

  // Quick Barcode Process from Camera Scanner (Sequential 1-2-3 counting)
  const handleBarcodeProcess = (barcodeText: string) => {
    const cleaned = barcodeText.trim();
    if (!cleaned) return;

    const now = Date.now();
    // 1000ms cooldown for same barcode to prevent frame-by-frame duplicate firing, allowing clean 1-2-3 sequential counting
    if (cleaned === lastScanThrottleRef.current.barcode && now - lastScanThrottleRef.current.time < 1000) {
      return;
    }
    lastScanThrottleRef.current = { time: now, barcode: cleaned };

    const prod = db.products.find(p => p.barcode === cleaned || p.stockCode.toLowerCase() === cleaned.toLowerCase());
    if (!prod) {
      showToast(`⚠️ Tanımsız barkod: "${cleaned}". Merkez listesinde bulunamadı.`);
      return;
    }

    // Auto-assign product to this branch if not already assigned so counting continues seamlessly
    const isAssigned = db.assignments.some(a => a.branchId === user.branchId && a.productId === prod.id);
    if (!isAssigned && user.branchId) {
      onUpdateDb(prev => ({
        ...prev,
        assignments: [...prev.assignments, { branchId: user.branchId!, productId: prod.id }]
      }));
    }

    // Short audio feedback ding on scan
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {}

    // Atomic increment (+1) so 1 -> 2 -> 3...
    const updatedCount = handleSaveCount(prod.id, 0, undefined, true);

    setLastScannedFeedback({
      name: prod.description,
      qty: updatedCount,
      barcode: prod.barcode
    });

    showToast(`🎯 "${prod.description}" okundu (+1) ➔ Toplam: ${updatedCount} Adet`);
  };

  // Final Submission to Management
  const handleSubmitToManagement = () => {
    const countedRecords = db.counts.filter(c => Number(c.branchId) === branchIdNum && c.quantity > 0);
    const countedItemsCount = countedRecords.length;
    const totalQty = countedRecords.reduce((sum, c) => sum + (c.quantity || 0), 0);

    if (countedItemsCount === 0) {
      alert('Yönetime göndermek için en az 1 ürünün sayımını yapmış olmalısınız.');
      return;
    }

    const conf = window.confirm(
      `Sayım listenizde ${countedItemsCount} kalem (${totalQty} adet) ürün bulunmaktadır.\n\nBu sayımı merkez yönetimine resmi olarak teslim etmek istediğinize emin misiniz?\n\nSayımı tamamladığınızda sayım listeniz otomatik olarak temizlenecektir.`
    );
    if (!conf) return;

    setSubmissionStatus('submitted');
    try {
      localStorage.setItem(statusKey, 'submitted');
    } catch (e) {
      console.error(e);
    }

    // Update local database with branch completion status
    onUpdateDb(prev => {
      let statuses = [...(prev.branchStatuses || [])];
      const idx = statuses.findIndex(s => Number(s.branchId) === branchIdNum);
      const rec = {
        branchId: branchIdNum,
        isCompleted: true,
        completedAt: new Date().toLocaleString('tr-TR'),
        completedBy: user.fullName || user.username,
        totalQty,
        distinctItems: countedItemsCount,
        batchId: prev.currentBatchId || 'batch_initial'
      };
      if (idx >= 0) statuses[idx] = rec;
      else statuses.push(rec);

      return {
        ...prev,
        branchStatuses: statuses
      };
    });

    // Also sync to central server
    completeBranchCountServer(branchIdNum, user.fullName || user.username, totalQty, countedItemsCount).catch(() => {});

    showToast('🎉 Sayım başarıyla tamamlandı, merkeze teslim edildi ve listeniz temizlendi!');
  };

  // Re-open for Editing
  const handleReopenForEditing = () => {
    const conf = window.confirm(
      'Sayım listesini yeniden düzenlemek için açmak istediğinize emin misiniz? Düzenlemeler tamamlandıktan sonra tekrar gönderebilirsiniz.'
    );
    if (!conf) return;

    setSubmissionStatus('draft');
    try {
      localStorage.setItem(statusKey, 'draft');
    } catch (e) {
      console.error(e);
    }

    onUpdateDb(prev => {
      let statuses = [...(prev.branchStatuses || [])];
      const idx = statuses.findIndex(s => Number(s.branchId) === branchIdNum);
      if (idx >= 0) {
        statuses[idx] = { ...statuses[idx], isCompleted: false };
      }
      return {
        ...prev,
        branchStatuses: statuses
      };
    });

    reopenBranchCountServer(branchIdNum).catch(() => {});
    showToast('Sayım düzenleme moduna geri alındı.');
  };

  // Camera scanner start/stop
  const startScanner = async () => {
    try {
      setScannerError(null);
      setIsScannerOpen(true);

      setTimeout(async () => {
        const qrCodeInstance = new Html5Qrcode('barcode-camera-reader');
        html5QrCodeRef.current = qrCodeInstance;

        await qrCodeInstance.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 120 }
          },
          (decodedText) => {
            handleBarcodeProcess(decodedText);
          },
          () => {}
        );
      }, 200);
    } catch (err: any) {
      console.error(err);
      setScannerError('Kameraya erişilemedi veya izin verilmedi.');
      setIsScannerOpen(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.error(e);
      }
      html5QrCodeRef.current = null;
    }
    setIsScannerOpen(false);
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Filter products for display in store panel
  const displayProducts = isCountCompleted ? [] : finalAssignedProducts.filter(p => {
    if (filterAisleId !== 'all' && Number(p.aisleId) !== Number(filterAisleId)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return p.description.toLowerCase().includes(q) || p.barcode.includes(q) || p.stockCode.toLowerCase().includes(q);
    }
    return true;
  });

  const branchEvaluations = db.evaluations.filter(e => Number(e.branchId) === branchIdNum);
  const branchCounts = db.counts.filter(c => Number(c.branchId) === branchIdNum && c.quantity > 0);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Store Header */}
      <header className="bg-indigo-700 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-xl shadow-xs flex items-center justify-center">
              <EsmeLogo size="sm" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base leading-tight">
                  Esme Sayım Paneli
                </h1>
                <span className="text-[10px] bg-white/20 text-white font-mono px-2 py-0.5 rounded-full font-bold">
                  {branch ? branch.name : 'Şube'} ({branch?.code})
                </span>
              </div>
              <p className="text-[11px] text-indigo-200 font-medium">
                Kör Sayım Modu (Merkez Stok Değerleri Gizlidir)
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopScanner();
              onLogout();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-800 hover:bg-indigo-900 text-white rounded-xl text-xs font-semibold transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Çıkış</span>
          </button>
        </div>

        {/* Tab switcher */}
        <div className="bg-indigo-800/60 border-t border-indigo-600/60 max-w-3xl mx-auto px-4 flex">
          <button
            onClick={() => setActiveTab('count')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center justify-center gap-1.5 transition ${
              activeTab === 'count'
                ? 'border-white text-white bg-white/10'
                : 'border-transparent text-indigo-200 hover:text-white'
            }`}
          >
            <Barcode className="w-4 h-4" />
            <span>Kör Sayım & Düzenleme ({branchCounts.length})</span>
          </button>

          <button
            onClick={() => {
              stopScanner();
              setActiveTab('performance');
            }}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center justify-center gap-1.5 transition ${
              activeTab === 'performance'
                ? 'border-white text-white bg-white/10'
                : 'border-transparent text-indigo-200 hover:text-white'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Performansım ({branchEvaluations.length})</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-3xl mx-auto w-full flex-1 p-4 pb-16 space-y-4">
        {activeTab === 'count' ? (
          <>
            {/* ========================================================================= */}
            {/* SUBMISSION & STAGING STATUS BANNER                                       */}
            {/* ========================================================================= */}
            <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
              isCountCompleted
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                : 'bg-amber-50/80 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-start sm:items-center gap-3">
                <div className={`p-2 rounded-xl shrink-0 ${
                  isCountCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {isCountCompleted ? <CheckCheck className="w-5 h-5 text-emerald-600" /> : <ClipboardPen className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs uppercase tracking-wider">
                      {isCountCompleted ? 'Sayım Tamamlandı & Merkeze Teslim Edildi' : 'Aktif Sayım Modu (Yönetimden Gelen)'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isCountCompleted
                        ? 'bg-emerald-200/80 text-emerald-900'
                        : 'bg-amber-200/80 text-amber-900'
                    }`}>
                      {isCountCompleted ? '✓ Liste Temizlendi' : 'Sayım Açık'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {isCountCompleted
                      ? 'Sayımınız merkez yönetime resmi olarak iletildi ve listeniz temizlendi. Yönetim yeni bir sayım gönderdiğinde listeniz otomatik açılacaktır.'
                      : 'Yönetim tarafından gönderilen ürünleri okutarak sayımı tamamlayınız. Tamamladığınızda listeniz otomatik temizlenecektir.'}
                  </p>
                </div>
              </div>

              {/* Action: Send to Management or Reopen */}
              <div className="self-end sm:self-center shrink-0">
                {!isCountCompleted ? (
                  <button
                    onClick={handleSubmitToManagement}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Sayımı Tamamla & Yönetime Gönder</span>
                  </button>
                ) : (
                  <button
                    onClick={handleReopenForEditing}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
                  >
                    <Unlock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Sayımı Yeniden Aç & Düzenle</span>
                  </button>
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* MAĞAZA SAYIM ÖZETİ & SON 5 İŞLEM KARTI (TALEP EDİLEN YENİ ÖZELLİK)       */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Card Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-extrabold text-sm sm:text-base tracking-wide">
                        {branch ? branch.name : 'Mağaza'} Sayım Özeti
                      </h2>
                      <span className="text-[10px] bg-indigo-500/30 text-indigo-200 font-mono px-2 py-0.5 rounded-full font-bold">
                        {branch?.code || 'ŞUBE'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      O ana kadar yapılmış toplam sayım hacmi ve canlı işlem geçmişi
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAllBranchesSummary(!showAllBranchesSummary)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition border border-white/10 cursor-pointer self-start sm:self-auto"
                >
                  <Building2 className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Tüm Mağazaların Durumu ({db.branches.length})</span>
                  {showAllBranchesSummary ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Statistics Metrics Grid */}
              <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/60 border-b border-slate-200">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Toplam Sayılan Adet
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl sm:text-2xl font-black text-indigo-600 font-mono">
                      {activeStoreTotalQty.toLocaleString('tr-TR')}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">Adet</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">O ana kadar okutulan</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Sayılan Kalem Sayısı
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
                      {activeStoreDistinctItems}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">/ {activeStoreAssignedTotal} Kalem</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Farklı ürün çeşidi</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Sayım İlerlemesi
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
                      %{activeStoreProgressPct}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${activeStoreProgressPct}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Kayıtlı Sayman
                  </span>
                  <div className="flex items-center gap-1.5 mt-1 text-slate-800 font-bold text-sm truncate">
                    <Store className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="truncate">{user.fullName || user.username}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block font-mono truncate">
                    {branch?.city || 'Merkez'}
                  </span>
                </div>
              </div>

              {/* Son 5 İşlem Listesi */}
              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Son 5 Sayım İşlemi (Canlı Akış)
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Bu mağazada yapılan en son kayıtlar
                  </span>
                </div>

                {last5Operations.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                    Henüz bir sayım işlemi yapılmadı. Kamera ile barkod okutarak veya aşağıdaki formdan miktar girerek sayıma başlayabilirsiniz.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
                    {last5Operations.map(({ record, product }, idx) => (
                      <div
                        key={record.id}
                        className="p-3 bg-white hover:bg-slate-50/80 transition flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 border border-indigo-100">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate">
                              {product?.description || `Ürün #${record.productId}`}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-slate-600 font-medium">
                                {product?.barcode || '-'}
                              </span>
                              <span>•</span>
                              <span>{record.countedAt}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="inline-block px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono font-extrabold rounded-lg text-xs">
                            {record.quantity} Adet
                          </span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            {record.counterName || 'Personel'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tüm 35 Mağaza Özeti (Genişletilebilir Tablo) */}
              {showAllBranchesSummary && (
                <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Tüm Mağazaların Toplam Sayım Hacmi ({db.branches.length} Mağaza)
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      En çok sayım yapan mağazadan sıralı
                    </span>
                  </div>

                  <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold tracking-wider sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Mağaza Adı</th>
                          <th className="py-2.5 px-3">Toplam Adet</th>
                          <th className="py-2.5 px-3">Sayılan Kalem</th>
                          <th className="py-2.5 px-3 text-right">Son İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allBranchesSummary.map(item => (
                          <tr
                            key={item.branch.id}
                            className={`${item.isCurrent ? 'bg-indigo-50/80 font-semibold' : 'hover:bg-slate-50/60'}`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-slate-400">[{item.branch.code}]</span>
                                <span className={item.isCurrent ? 'text-indigo-900 font-bold' : 'text-slate-800'}>
                                  {item.branch.name}
                                </span>
                                {item.isCurrent && (
                                  <span className="text-[9px] bg-indigo-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                                    Siz
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">
                              {item.totalQty.toLocaleString('tr-TR')} Adet
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {item.distinctCount} Kalem
                            </td>
                            <td className="py-2.5 px-3 text-right text-[11px] text-slate-400 font-mono">
                              {item.latestTime}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            {/* ========================================================================= */}
            {/* SAYIM DURUMU: TAMAMLANDI VE LİSTE TEMİZLENDİ / AKTİF SAYIM MODU           */}
            {/* ========================================================================= */}
            {isCountCompleted ? (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-emerald-200 shadow-sm text-center space-y-6 animate-fadeIn">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-9 h-9" />
                </div>

                <div className="space-y-2 max-w-lg mx-auto">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Sayım Resmi Olarak Teslim Edildi</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                    Tebrikler! Sayımınız Tamamlandı
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Bu döneme ait sayımınız merkez yönetimine başarıyla teslim edilmiştir.
                  </p>
                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl text-[11px] text-emerald-800 font-semibold max-w-md mx-auto">
                    ✓ Sayım listeniz otomatik olarak temizlendi (Eski sayım kalmadı).
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Teslim Zamanı</span>
                    <span className="text-xs font-bold text-slate-800 font-mono mt-0.5 block truncate">
                      {branchStatus?.completedAt || 'Kayıtlı'}
                    </span>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Teslim Eden</span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate">
                      {branchStatus?.completedBy || user.fullName || user.username}
                    </span>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Sayılan Adet</span>
                    <span className="text-sm sm:text-base font-black text-emerald-600 font-mono mt-0.5 block">
                      {(branchStatus?.totalQty || activeStoreTotalQty).toLocaleString('tr-TR')} Adet
                    </span>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Sayılan Kalem</span>
                    <span className="text-sm sm:text-base font-black text-indigo-600 font-mono mt-0.5 block">
                      {branchStatus?.distinctItems || activeStoreDistinctItems} Kalem
                    </span>
                  </div>
                </div>

                {/* Waiting Next Count Notice */}
                <div className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl max-w-xl mx-auto text-left flex items-start gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl shrink-0 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-indigo-900">
                      Yeni Sayım Bekleniyor
                    </h4>
                    <p className="text-[11px] text-indigo-700 mt-0.5 leading-relaxed">
                      Yönetim tarafından yeni bir sayım / Excel listesi gönderildiğinde, listeniz otomatik olarak burada açılacaktır. O zamana kadar sayım listeniz temiz kalır.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCompletedModal(!showCompletedModal)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>{showCompletedModal ? 'Teslim Edilen Özeti Gizle' : 'Teslim Edilen Sayımı Görüntüle'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReopenForEditing}
                    className="w-full sm:w-auto px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-xl transition border border-amber-200/80 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Sayımı Yeniden Aç & Düzenle</span>
                  </button>
                </div>

                {/* Collapsible View of Completed Items */}
                {showCompletedModal && (
                  <div className="pt-4 border-t border-slate-200 text-left max-w-xl mx-auto space-y-2">
                    <h4 className="font-bold text-xs text-slate-800">
                      Teslim Edilen Ürünler ({branchCounts.length})
                    </h4>
                    <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                      {branchCounts.map(c => {
                        const prod = db.products.find(p => p.id === c.productId);
                        return (
                          <div key={c.id} className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50">
                            <div>
                              <span className="font-semibold text-slate-800 block text-xs">
                                {prod?.description || `Ürün #${c.productId}`}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Barkod: {prod?.barcode}
                              </span>
                            </div>
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 text-xs font-mono">
                              {c.quantity} {prod?.unit || 'Adet'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Barcode className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                      Manuel Barkod ve Ürün Adeti Girişi
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Barkod okuyucu olmadan doğrudan barkod numarası ve sayılan ürün miktarını girin
                    </p>
                  </div>
                </div>

                <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded">
                  Hızlı Veri Girişi
                </span>
              </div>

              {manualFeedback && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{manualFeedback}</span>
                </div>
              )}

              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Barcode input or select */}
                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Barkod veya Ürün Kodu
                    </label>
                    <div className="relative">
                      <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Örn: 8690001 veya PRD-01"
                        value={manualBarcode}
                        onChange={e => setManualBarcode(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 font-bold"
                        required
                      />
                    </div>
                  </div>

                  {/* Quantity Input */}
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Sayılan Adet
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Örn: 15"
                      value={manualQuantity}
                      onChange={e => setManualQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 text-center text-sm"
                      required
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="sm:col-span-3 flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer h-[38px]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Listeye Ekle</span>
                    </button>
                  </div>
                </div>

                {/* Optional Note */}
                <div>
                  <input
                    type="text"
                    placeholder="Sayım notu ekle (Opsiyonel: Örn: Kutusu açılmış, defolu, rafta bulundu...)"
                    value={manualNotes}
                    onChange={e => setManualNotes(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 text-slate-600"
                  />
                </div>
              </form>
            </div>

            {/* Camera Barcode Scanner View */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Kamera ile Barkod Okuma
                  </span>
                </div>

                <button
                  onClick={isScannerOpen ? stopScanner : startScanner}
                  className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                    isScannerOpen
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  {isScannerOpen ? (
                    <>
                      <CameraOff className="w-3.5 h-3.5" />
                      <span>Kamerayı Kapat</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5" />
                      <span>Kamerayı Aç</span>
                    </>
                  )}
                </button>
              </div>

              {isScannerOpen && (
                <div className="relative rounded-2xl overflow-hidden bg-black p-2 space-y-2">
                  <div id="barcode-camera-reader" className="w-full rounded-xl overflow-hidden" />
                  
                  {lastScannedFeedback && (
                    <div className="p-3 bg-emerald-950/95 border-2 border-emerald-400 rounded-xl text-center text-white shadow-lg animate-fadeIn">
                      <div className="flex items-center justify-between gap-2 px-1">
                        <span className="text-xs text-emerald-200 font-semibold truncate text-left">
                          {lastScannedFeedback.name}
                        </span>
                        <span className="text-base font-black bg-emerald-400 text-slate-950 px-3 py-0.5 rounded-lg shadow-sm whitespace-nowrap">
                          {lastScannedFeedback.qty} Adet
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-300/90 mt-1 font-medium">
                        Barkodu okuttukça adet sayısı 1 ➔ 2 ➔ 3 şeklinde artarak sayılır
                      </p>
                    </div>
                  )}

                  <p className="text-[11px] text-center text-slate-300 py-1">
                    Barkodu kamera çerçevesine gösterin (Aynı ürün okundukça adet sayısı 1-2-3 diye artar)
                  </p>
                </div>
              )}

              {scannerError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{scannerError}</span>
                </div>
              )}
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ürün adı veya barkod ile filtrele..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={filterAisleId}
                onChange={e => setFilterAisleId(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none font-medium text-slate-700"
              >
                <option value="all">Tüm Reyonlar</option>
                {db.aisles.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Product List with Staging & In-place Editing */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>Atanan Ürün: <strong className="text-slate-800">{assignedProducts.length}</strong></span>
                <span>Sayılan Kalem: <strong className="text-indigo-600 font-bold">{branchCounts.length}</strong></span>
              </div>

              {displayProducts.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                  Aramanıza uygun ürün bulunamadı.
                </div>
              ) : (
                displayProducts.map(p => {
                  const aisle = db.aisles.find(a => a.id === p.aisleId);
                  const countRecord = db.counts.find(c => c.branchId === user.branchId && c.productId === p.id);
                  const currentQty = countRecord ? countRecord.quantity : 0;
                  const isJustSaved = recentSavedId === p.id;

                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-2xl border transition-all duration-300 bg-white ${
                        isJustSaved
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                          : currentQty > 0
                          ? 'border-indigo-100 bg-slate-50/30'
                          : 'border-slate-200 shadow-xs hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                              {aisle?.name || 'Genel Reyon'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Barkod: <strong className="text-slate-700">{p.barcode}</strong>
                            </span>
                          </div>

                          <h3 className="font-bold text-slate-900 text-sm mt-1">
                            {p.description}
                          </h3>

                          {countRecord?.notes && (
                            <p className="text-[11px] text-slate-500 italic mt-0.5">
                              Not: "{countRecord.notes}"
                            </p>
                          )}
                        </div>

                        {currentQty > 0 ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{currentQty} {p.unit || 'Adet'}</span>
                            </span>
                            <button
                              onClick={() => handleRemoveCount(p.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Sayımı Sıfırla"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            Henüz Sayılmadı
                          </span>
                        )}
                      </div>

                      {/* Quantity input & quick step buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        {/* Minus 1 */}
                        <button
                          type="button"
                          onClick={() => handleSaveCount(p.id, Math.max(0, currentQty - 1))}
                          className="p-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl transition"
                          title="1 Azalt"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        {/* Direct input */}
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={currentQty}
                            onChange={e => handleSaveCount(p.id, Number(e.target.value))}
                            className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-center text-sm font-black text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 uppercase font-semibold">
                            {p.unit || 'Adet'}
                          </span>
                        </div>

                        {/* Plus 1 */}
                        <button
                          type="button"
                          onClick={() => handleSaveCount(p.id, currentQty + 1)}
                          className="p-2 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 rounded-xl font-bold transition flex items-center gap-1 text-xs"
                          title="1 Arttır"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>1</span>
                        </button>

                        {/* Plus 5 */}
                        <button
                          type="button"
                          onClick={() => handleSaveCount(p.id, currentQty + 5)}
                          className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 rounded-xl font-bold transition text-xs"
                          title="5 Arttır"
                        >
                          +5
                        </button>

                        {/* Direct Save Confirmation Button */}
                        <button
                          type="button"
                          onClick={() => handleSaveCount(p.id, currentQty)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Kaydet</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Floating Submit Bar */}
            {submissionStatus === 'draft' && branchCounts.length > 0 && (
              <div className="sticky bottom-4 z-20 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-slate-700 animate-slideUp">
                <div>
                  <div className="font-bold text-xs">
                    {branchCounts.length} Kalem Ürün Sayımı Hazır
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Tüm adetleri kontrol ettiyseniz yönetime iletebilirsiniz.
                  </p>
                </div>

                <button
                  onClick={handleSubmitToManagement}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Yönetime Gönder</span>
                </button>
              </div>
            )}
              </>
            )}
          </>
        ) : (
          /* Performance Tab */
          <div className="space-y-4">
            {/* Live Automated Evaluation Card */}
            {(() => {
              const liveAutoEval = branch ? calculateBranchAutoEvaluation(branch, db) : null;
              if (!liveAutoEval) return null;

              let gradeColor = 'bg-rose-600 text-white';
              let badgeBorder = 'border-rose-200 bg-rose-50/70 text-rose-900';
              if (liveAutoEval.statusColor === 'emerald') {
                gradeColor = 'bg-emerald-600 text-white';
                badgeBorder = 'border-emerald-200 bg-emerald-50/70 text-emerald-950';
              } else if (liveAutoEval.statusColor === 'indigo') {
                gradeColor = 'bg-indigo-600 text-white';
                badgeBorder = 'border-indigo-200 bg-indigo-50/70 text-indigo-950';
              } else if (liveAutoEval.statusColor === 'amber') {
                gradeColor = 'bg-amber-600 text-white';
                badgeBorder = 'border-amber-200 bg-amber-50/70 text-amber-950';
              }

              return (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                          Canlı Sistem Performans Değerlendirmesi
                        </h3>
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-100">
                          Otomatik
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Sayım doğruluğunuza göre sistem tarafından anlık ve nesnel olarak hesaplanan başarı skoru.
                      </p>
                    </div>

                    {/* Grade & Score */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Başarı Puanı
                        </span>
                        <span className="text-2xl font-black text-slate-900 font-mono">
                          {liveAutoEval.performanceScore}
                          <span className="text-xs text-slate-400 font-normal"> / 100</span>
                        </span>
                      </div>

                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base shadow-sm ${gradeColor}`}>
                        {liveAutoEval.grade}
                      </div>
                    </div>
                  </div>

                  {/* Accuracy Statistics Row */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[11px] text-slate-500 font-medium block">Tam Eşleşme Oranı</span>
                      <strong className="text-sm font-black text-emerald-700 font-mono block mt-0.5">
                        %{liveAutoEval.exactMatchRate}
                      </strong>
                      <span className="text-[10px] text-slate-400 font-mono">({liveAutoEval.exactMatches} / {liveAutoEval.totalCountedItems} ürün)</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[11px] text-slate-500 font-medium block">Stok Doğruluğu</span>
                      <strong className="text-sm font-black text-indigo-700 font-mono block mt-0.5">
                        %{liveAutoEval.stockAccuracyRate}
                      </strong>
                      <span className="text-[10px] text-slate-400 font-mono">Mutlak mutabakat</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[11px] text-slate-500 font-medium block">Sayım İlerlemesi</span>
                      <strong className="text-sm font-black text-slate-800 font-mono block mt-0.5">
                        %{liveAutoEval.completenessRate}
                      </strong>
                      <span className="text-[10px] text-slate-400 font-mono">({liveAutoEval.totalCountedItems} / {liveAutoEval.totalAssigned})</span>
                    </div>
                  </div>

                  {/* System Auto Feedback Box */}
                  <div className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-1 ${badgeBorder}`}>
                    <div className="flex items-center gap-1.5 font-bold">
                      <Sparkles className="w-4 h-4" />
                      <span>Otomatik Sistem Analizi & Notu</span>
                    </div>
                    <p className="text-xs">
                      {liveAutoEval.systemFeedback}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Historical Archive */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-600" />
                <span>Geçmiş Yönetim Değerlendirmeleri ve Arşiv ({branchEvaluations.length})</span>
              </h3>
              <p className="text-xs text-slate-500">
                Merkez yönetimi ve denetim kayıtları arşivi.
              </p>
            </div>

            {branchEvaluations.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                Şubeniz için henüz arşivlenmiş bir geçmiş denetim kaydı bulunmuyor.
              </div>
            ) : (
              <div className="space-y-3">
                {branchEvaluations.map(ev => (
                  <div
                    key={ev.id}
                    className="p-5 rounded-2xl border border-indigo-100 bg-white shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-xl font-black text-sm bg-indigo-100 text-indigo-800 font-mono">
                          {ev.score} / 100 Puan
                        </span>
                        {ev.grade && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white">
                            {ev.grade}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 font-mono">{ev.date}</span>
                    </div>

                    <p className="text-xs text-slate-700 italic bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                      "{ev.feedback}"
                    </p>

                    {ev.evaluator && (
                      <p className="text-[10px] text-slate-400">
                        Değerlendiren: <strong className="text-slate-600">{ev.evaluator}</strong>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
