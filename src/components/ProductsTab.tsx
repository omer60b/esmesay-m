import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { AppDatabase, Product } from '../types';
import { batchAssignProductsServer, deleteProductServer, clearAllProductsServer } from '../services/storage';
import { downloadSampleExcelTemplate } from '../utils/excelExport';
import { 
  Boxes, 
  Plus, 
  FileSpreadsheet, 
  Download, 
  UploadCloud, 
  CheckCircle2, 
  Search, 
  Barcode, 
  Trash2,
  Store,
  Layers,
  Palette,
  Package,
  ChevronDown,
  Building2,
  Filter,
  Sparkles,
  ArrowUpDown,
  Edit2
} from 'lucide-react';

interface ProductsTabProps {
  db: AppDatabase;
  onUpdateDb: (updater: (prev: AppDatabase) => AppDatabase) => void;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({ db, onUpdateDb }) => {
  // Single Product Form State
  const [barcode, setBarcode] = useState('');
  const [stockCode, setStockCode] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [centralStock, setCentralStock] = useState<number | ''>('');
  const [aisleId, setAisleId] = useState<string>(() => db.aisles[0]?.id ? String(db.aisles[0].id) : '21');
  const [assignBranchId, setAssignBranchId] = useState<string>('all');

  // Excel Upload State (Image 2 format with manual Store & Reyon selection)
  const [excelTargetBranchId, setExcelTargetBranchId] = useState<string>('all');
  const [excelTargetAisleId, setExcelTargetAisleId] = useState<string>(() => db.aisles[0]?.id ? String(db.aisles[0].id) : '21');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [excelSuccessMsg, setExcelSuccessMsg] = useState<string | null>(null);

  // Search & Filter State for Product List
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAisleFilter, setSelectedAisleFilter] = useState('all');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');
  const [groupByAisle, setGroupByAisle] = useState<boolean>(true);

  const [feedback, setFeedback] = useState('');

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 4500);
  };

  // Add single product & assign
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim() || !stockCode.trim() || !description.trim() || !aisleId) {
      alert('Lütfen barkod, ürün kodu, ürün adı ve reyon alanlarını doldurunuz.');
      return;
    }

    const aisleNum = Number(aisleId);
    const stockNum = centralStock === '' ? 1 : Number(centralStock);
    const chosenAisle = db.aisles.find(a => a.id === aisleNum);
    const chosenCategory = chosenAisle?.name || 'Genel';

    const newProdItem = {
      barcode: barcode.trim(),
      stockCode: stockCode.trim(),
      description: description.trim(),
      color: color.trim() || '',
      centralStock: stockNum,
      aisleId: aisleNum,
      unit: 'Adet',
      category: chosenCategory
    };

    onUpdateDb(prev => {
      let existing = prev.products.find(p => p.barcode === barcode.trim());
      let updatedProducts = [...prev.products];
      let updatedAssignments = [...prev.assignments];
      let prodId: number;

      if (!existing) {
        prodId = prev.products.length ? Math.max(...prev.products.map(p => p.id)) + 1 : 1;
        const newProd: Product = {
          id: prodId,
          ...newProdItem
        };
        updatedProducts.push(newProd);
      } else {
        prodId = existing.id;
        updatedProducts = updatedProducts.map(p => 
          p.id === prodId ? { 
            ...p, 
            ...newProdItem,
            color: color.trim() || p.color || ''
          } : p
        );
      }

      // Assign to branches
      if (assignBranchId === 'all') {
        prev.branches.forEach(b => {
          if (!updatedAssignments.some(a => Number(a.branchId) === Number(b.id) && Number(a.productId) === prodId)) {
            updatedAssignments.push({ branchId: b.id, productId: prodId });
          }
        });
      } else {
        const bId = Number(assignBranchId);
        if (!updatedAssignments.some(a => Number(a.branchId) === bId && Number(a.productId) === prodId)) {
          updatedAssignments.push({ branchId: bId, productId: prodId });
        }
      }

      // Reset branch completion status for target branches so active count opens on their devices!
      const targetBranches = assignBranchId === 'all'
        ? prev.branches.map(b => b.id)
        : [Number(assignBranchId)];

      let updatedStatuses = [...(prev.branchStatuses || [])];
      targetBranches.forEach(bId => {
        const idx = updatedStatuses.findIndex(s => Number(s.branchId) === Number(bId));
        if (idx >= 0) {
          updatedStatuses[idx] = { ...updatedStatuses[idx], isCompleted: false };
        } else {
          updatedStatuses.push({ branchId: bId, isCompleted: false });
        }
      });

      return {
        ...prev,
        products: updatedProducts,
        assignments: updatedAssignments,
        branchStatuses: updatedStatuses,
        lastSentAt: new Date().toISOString()
      };
    });

    showFeedback('Ürün başarıyla kaydedildi, mağazaya aktif sayım olarak atandı ve tüm cihazlara iletildi.');
    setBarcode('');
    setStockCode('');
    setDescription('');
    setColor('');
    setCentralStock('');
  };

  // Process Excel File with Image 2 format (Barkod, Ürün Kodu, Ürün Adı, Renk Adı, Envanter Miktarı)
  const handleProcessExcel = () => {
    if (!excelFile) {
      alert('Lütfen bir Excel (.xlsx, .xls) veya CSV dosyası seçin.');
      return;
    }

    setIsProcessing(true);
    setExcelSuccessMsg(null);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        if (!rows || rows.length === 0) {
          alert('Seçilen Excel dosyasında ürün satırı bulunamadı.');
          setIsProcessing(false);
          return;
        }

        const targetAisleIdNum = Number(excelTargetAisleId);
        const targetAisle = db.aisles.find(a => a.id === targetAisleIdNum) || db.aisles[0];
        let importedCount = 0;
        let updatedCount = 0;
        const parsedItemsForServer: any[] = [];

        onUpdateDb(prev => {
          let updatedProducts = [...prev.products];
          let updatedAssignments = [...prev.assignments];
          let currentMaxProdId = updatedProducts.length ? Math.max(...updatedProducts.map(p => p.id)) : 0;

          rows.forEach((row) => {
            // Flexible resolution matching Image 2 headers:
            // Barkod | Ürün Kodu | Ürün Adı | Renk Adı | Envanter Miktarı
            const rawBarcode = row['Barkod'] ?? row['Barkodu'] ?? row['Barcode'] ?? row['BARKOD'] ?? '';
            const rawStockCode = row['Ürün Kodu'] ?? row['Urun Kodu'] ?? row['Stok Kodu'] ?? row['Stock Code'] ?? '';
            const rawDesc = row['Ürün Adı'] ?? row['Urun Adi'] ?? row['Ürün Tanımı'] ?? row['Açıklama'] ?? row['Description'] ?? '';
            const rawColor = row['Renk Adı'] ?? row['Renk Adi'] ?? row['Renk'] ?? row['Color'] ?? '';
            const rawQty = row['Envanter Miktarı'] ?? row['Envanter Miktari'] ?? row['Envanter'] ?? row['Miktar'] ?? row['Merkez Stok'] ?? row['Adet'] ?? 1;

            const bCode = String(rawBarcode).trim();
            const desc = String(rawDesc).trim();
            const sCode = String(rawStockCode).trim() || (bCode ? `PRD-${bCode}` : '');
            const colorName = String(rawColor).trim();
            const stockQty = Number(rawQty) || 0;

            if (!bCode || !desc) return;

            // Check if row specifies a reyon/kategori
            const rowAisleRaw = String(row['Reyon'] ?? row['Kategori'] ?? row['Departman'] ?? row['Grup'] ?? '').trim();
            let rowSpecificAisle = targetAisle;
            if (rowAisleRaw) {
              const foundAisle = db.aisles.find(a => 
                a.name.toLowerCase() === rowAisleRaw.toLowerCase() ||
                a.name.toLowerCase().includes(rowAisleRaw.toLowerCase()) ||
                rowAisleRaw.toLowerCase().includes(a.name.toLowerCase().replace(/^\d+\s*/, ''))
              );
              if (foundAisle) {
                rowSpecificAisle = foundAisle;
              }
            }

            const finalAisleId = rowSpecificAisle?.id || targetAisleIdNum;
            const finalCategory = rowSpecificAisle?.name || targetAisle?.name || '32 Baza ve Yatak Grubu';

            parsedItemsForServer.push({
              barcode: bCode,
              stockCode: sCode,
              description: desc,
              color: colorName || '',
              centralStock: stockQty,
              aisleId: finalAisleId,
              unit: 'Adet',
              category: finalCategory
            });

            let existingProd = updatedProducts.find(p => p.barcode === bCode);
            let prodId: number;

            if (existingProd) {
              prodId = existingProd.id;
              existingProd.stockCode = sCode || existingProd.stockCode;
              existingProd.description = desc;
              existingProd.color = colorName || existingProd.color || '';
              existingProd.centralStock = stockQty;
              existingProd.aisleId = finalAisleId;
              existingProd.category = finalCategory;
              updatedCount++;
            } else {
              currentMaxProdId++;
              prodId = currentMaxProdId;
              updatedProducts.push({
                id: prodId,
                barcode: bCode,
                stockCode: sCode,
                description: desc,
                color: colorName || '',
                centralStock: stockQty,
                aisleId: finalAisleId,
                unit: 'Adet',
                category: finalCategory
              });
              importedCount++;
            }

            // Assign to target branches
            if (excelTargetBranchId === 'all') {
              prev.branches.forEach(b => {
                if (!updatedAssignments.some(a => Number(a.branchId) === Number(b.id) && Number(a.productId) === prodId)) {
                  updatedAssignments.push({ branchId: b.id, productId: prodId });
                }
              });
            } else {
              const bId = Number(excelTargetBranchId);
              if (!updatedAssignments.some(a => Number(a.branchId) === bId && Number(a.productId) === prodId)) {
                updatedAssignments.push({ branchId: bId, productId: prodId });
              }
            }
          });

          // Reset branch completion status for target branches so active count opens on their devices!
          const targetBranches = excelTargetBranchId === 'all'
            ? prev.branches.map(b => b.id)
            : [Number(excelTargetBranchId)];

          let updatedStatuses = [...(prev.branchStatuses || [])];
          targetBranches.forEach(bId => {
            const idx = updatedStatuses.findIndex(s => Number(s.branchId) === Number(bId));
            if (idx >= 0) {
              updatedStatuses[idx] = { ...updatedStatuses[idx], isCompleted: false };
            } else {
              updatedStatuses.push({ branchId: bId, isCompleted: false });
            }
          });

          return {
            ...prev,
            products: updatedProducts,
            assignments: updatedAssignments,
            branchStatuses: updatedStatuses,
            lastSentAt: new Date().toISOString()
          };
        });

        const targetStoreLabel = excelTargetBranchId === 'all' 
          ? 'Tüm Mağazalara (35 Mağaza)' 
          : (db.branches.find(b => b.id === Number(excelTargetBranchId))?.name || 'Seçili Mağazaya');

        const successText = `Excel başarıyla aktarıldı: ${importedCount} yeni ürün eklendi, ${updatedCount} ürün güncellendi. Hedef Reyon: "${targetAisle?.name}", Hedef Mağaza: "${targetStoreLabel}".`;
        setExcelSuccessMsg(successText);
        showFeedback(successText);
        setExcelFile(null);
      } catch (err: any) {
        console.error(err);
        alert('Excel dosyası işlenirken hata oluştu: ' + (err.message || 'Geçersiz format'));
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsBinaryString(excelFile);
  };

  // Delete product
  const handleDeleteProduct = (id: number) => {
    const prod = db.products.find(p => p.id === id);
    if (!prod) return;

    if (!confirm(`"${prod.description}" ürününü ve tüm mağaza atamalarını silmek istediğinize emin misiniz?`)) return;

    onUpdateDb(prev => ({
      ...prev,
      products: prev.products.filter(p => Number(p.id) !== Number(id)),
      assignments: prev.assignments.filter(a => Number(a.productId) !== Number(id)),
      counts: prev.counts.filter(c => Number(c.productId) !== Number(id))
    }));

    deleteProductServer(id).catch(() => {});
    showFeedback('Ürün sistemden ve merkezi sunucudan kalıcı olarak silindi.');
  };

  // Clear all products completely to start with a fresh slate
  const handleClearAllProducts = async () => {
    if (!confirm('DİKKAT: Sistemdeki tüm ürün listesi ve mağaza atamaları tamamen temizlenecektir. Mağazaların ekranları da temizlenecek ve sadece yöneticinin yeni atayacağı ürünler görünecektir. Onaylıyor musunuz?')) {
      return;
    }

    onUpdateDb(prev => ({
      ...prev,
      products: [],
      assignments: [],
      counts: [],
      branchStatuses: []
    }));

    try {
      await clearAllProductsServer();
    } catch {}

    showFeedback('Tüm ürün listesi temizlendi. Artık sadece yöneticinin yeni atadığı ürünler mağazaların kullanıcılarına düşecektir.');
  };

  // Filtered & Grouped Products
  const filteredProducts = useMemo(() => {
    return db.products.filter(p => {
      // Reyon filter
      if (selectedAisleFilter !== 'all' && p.aisleId !== Number(selectedAisleFilter)) {
        return false;
      }

      // Branch assignment filter
      if (selectedBranchFilter !== 'all') {
        const bId = Number(selectedBranchFilter);
        const isAssigned = db.assignments.some(a => a.branchId === bId && a.productId === p.id);
        if (!isAssigned) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const descMatch = p.description.toLowerCase().includes(q);
        const codeMatch = p.stockCode.toLowerCase().includes(q);
        const barMatch = p.barcode.includes(q);
        const colorMatch = p.color ? p.color.toLowerCase().includes(q) : false;
        return descMatch || codeMatch || barMatch || colorMatch;
      }

      return true;
    });
  }, [db.products, db.assignments, selectedAisleFilter, selectedBranchFilter, searchQuery]);

  // Group products by Aisle
  const groupedProducts = useMemo(() => {
    const groups: { aisle: typeof db.aisles[0]; products: Product[] }[] = [];

    db.aisles.forEach(aisle => {
      const prods = filteredProducts.filter(p => p.aisleId === aisle.id);
      if (prods.length > 0) {
        groups.push({
          aisle,
          products: prods
        });
      }
    });

    // Check products with unassigned or deleted aisles
    const orphans = filteredProducts.filter(p => !db.aisles.some(a => a.id === p.aisleId));
    if (orphans.length > 0) {
      groups.push({
        aisle: { id: 0, name: 'Diğer / Genel Ürünler', description: 'Reyon atanmamış ürünler' },
        products: orphans
      });
    }

    return groups;
  }, [filteredProducts, db.aisles]);

  // Stats calculation
  const totalStockCount = useMemo(() => {
    return db.products.reduce((acc, p) => acc + (p.centralStock || 0), 0);
  }, [db.products]);

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-fadeIn shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-3xl border border-indigo-500/30 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 rounded-2xl">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white tracking-tight">
              Ürün & Excel Entegrasyon Merkezi
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Excel dosyanızdaki 'Barkod', 'Ürün Kodu', 'Ürün Adı', 'Renk Adı', 'Envanter Miktarı' sütunlarını otomatik okur ve istediğiniz reyon ile mağazalara atar.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={downloadSampleExcelTemplate}
            className="px-3.5 py-2 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 font-bold flex items-center gap-2 transition cursor-pointer"
            title="Örnek Esme Excel Formatını İndir"
          >
            <Download className="w-4 h-4 text-emerald-300" />
            <span>Örnek Excel Şablonu İndir</span>
          </button>

          {db.products.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllProducts}
              className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-xl text-xs text-rose-200 font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Tüm ürün ve atama listesini temizler"
            >
              <Trash2 className="w-4 h-4 text-rose-300" />
              <span>Listeyi Temizle (Sıfırla)</span>
            </button>
          )}
        </div>
      </div>

      {/* TOP SECTION: EXCEL UPLOAD MODULE WITH MANUAL REYON & MAĞAZA SELECTION */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel ile Toplu Ürün Yükleme & Mağazalara Atama</span>
          </h3>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            Esme Excel Formatı Desteklenir
          </span>
        </div>

        {/* Manual Target Controls: Reyon & Mağaza Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-indigo-600" />
              <span>Yüklenecek Hedef Mağaza / Şube *</span>
            </label>
            <select
              value={excelTargetBranchId}
              onChange={e => setExcelTargetBranchId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">🌟 Tüm Mağazalara Ata (Tüm Şubeler)</option>
              {db.branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code}) - {b.city || 'Merkez'}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              {excelTargetBranchId === 'all' 
                ? 'Ürünler tüm 35 mağazanın sayım listesine otomatik atanacaktır.' 
                : 'Ürünler sadece seçili mağazaya atanacaktır.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Yüklenecek Hedef Reyon *</span>
            </label>
            <select
              value={excelTargetAisleId}
              onChange={e => setExcelTargetAisleId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {db.aisles.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Excel'deki tüm ürünler bu reyon altında sınıflandırılacaktır.
            </p>
          </div>
        </div>

        {/* Drag & Drop File Input */}
        <div className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/30 rounded-2xl p-6 text-center transition cursor-pointer relative group">
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={e => {
              if (e.target.files?.[0]) setExcelFile(e.target.files[0]);
            }}
            disabled={isProcessing}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
          />
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl group-hover:scale-105 transition">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                {excelFile ? `Seçilen Dosya: ${excelFile.name}` : 'Excel veya CSV Dosyasını Buraya Bırakın veya Seçin'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Sütunlar: <strong>Barkod</strong> | <strong>Ürün Kodu</strong> | <strong>Ürün Adı</strong> | <strong>Renk Adı</strong> | <strong>Envanter Miktarı</strong>
              </p>
            </div>
          </div>
        </div>

        {excelFile && (
          <div className="flex items-center justify-between p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl">
            <span className="text-xs font-semibold text-indigo-900">
              Dosya hazır: <strong>{excelFile.name}</strong> ({(excelFile.size / 1024).toFixed(1)} KB)
            </span>
            <button
              type="button"
              onClick={handleProcessExcel}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isProcessing ? 'İşleniyor...' : 'Excel Verilerini Sisteme Yükle'}</span>
            </button>
          </div>
        )}

        {excelSuccessMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{excelSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* MANUAL SINGLE PRODUCT FORM (Accordion or Card) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
          <Plus className="w-4 h-4 text-indigo-600" />
          <span>Tekli Ürün Ekle ve Mağazaya Ata</span>
        </h3>

        <form onSubmit={handleAddProduct} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          <div className="lg:col-span-1">
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Barkod *</label>
            <input
              type="text"
              placeholder="Örn: 2714808711829"
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="lg:col-span-1">
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Ürün Kodu *</label>
            <input
              type="text"
              placeholder="Örn: 126-001-088"
              value={stockCode}
              onChange={e => setStockCode(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Ürün Adı *</label>
            <input
              type="text"
              placeholder="Örn: Esme Sleep Serenity Tavşan Tüyü Yatak"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="lg:col-span-1">
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Renk Adı</label>
            <input
              type="text"
              placeholder="Örn: Gri / Krem"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="lg:col-span-1">
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Envanter</label>
            <input
              type="number"
              min="0"
              placeholder="1"
              value={centralStock}
              onChange={e => setCentralStock(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 font-bold"
            />
          </div>

          <div className="lg:col-span-1 flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
            >
              Kaydet
            </button>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Reyon Seçimi *</label>
            <select
              value={aisleId}
              onChange={e => setAisleId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {db.aisles.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Atanacak Mağaza *</label>
            <select
              value={assignBranchId}
              onChange={e => setAssignBranchId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">🌟 Tüm Mağazalara Ata</option>
              {db.branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* SİSTEMDEKİ ÜRÜNLER (REYON VE MAĞAZALARA GÖRE DÜZENLİ SIRALANMIŞ ALAN)      */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5 sm:p-6">
        {/* Header and Quick Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <Boxes className="w-5 h-5 text-indigo-600" />
              <span>Sistemdeki Ürünler ve Envanter Havuzu</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Reyon ve mağazalara göre kategorize edilmiş merkez ürün kayıtları
            </p>
          </div>

          {/* Stats Badges & Clear List Action */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-xl text-xs font-bold">
              {filteredProducts.length} Ürün Kalemi
            </span>
            <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold">
              {totalStockCount} Toplam Envanter
            </span>
            <span className="px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold">
              {db.aisles.length} Aktif Reyon
            </span>
            {db.products.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllProducts}
                className="px-3 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ml-1"
                title="Sistemdeki tüm ürün listesini temizler"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Listeyi Temizle</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter and Grouping Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Ürün adı, barkod, kod veya renk ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filter by Reyon */}
          <div>
            <select
              value={selectedAisleFilter}
              onChange={e => setSelectedAisleFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">📁 Tüm Reyonlar ({db.products.length} Ürün)</option>
              {db.aisles.map(a => {
                const count = db.products.filter(p => p.aisleId === a.id).length;
                return (
                  <option key={a.id} value={a.id}>
                    {a.name} ({count} Ürün)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Filter by Branch */}
          <div>
            <select
              value={selectedBranchFilter}
              onChange={e => setSelectedBranchFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">🏢 Tüm Mağazalar</option>
              {db.branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setGroupByAisle(!groupByAisle)}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                groupByAisle 
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{groupByAisle ? 'Reyonlara Göre Gruplu' : 'Düz Liste Görünümü'}</span>
            </button>
          </div>
        </div>

        {/* PRODUCTS DISPLAY: GROUPED BY REYON */}
        {filteredProducts.length === 0 ? (
          <div className="p-10 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
            Arama ve filtreleme kriterlerinize uygun ürün bulunamadı.
          </div>
        ) : groupByAisle ? (
          <div className="space-y-6 pt-2">
            {groupedProducts.map(group => (
              <div key={group.aisle.id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                {/* Reyon Header */}
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                      <Layers className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 tracking-tight">
                        {group.aisle.name}
                      </h4>
                      {group.aisle.description && (
                        <p className="text-[11px] text-slate-500">{group.aisle.description}</p>
                      )}
                    </div>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-indigo-700 border border-slate-200 shadow-2xs">
                    {group.products.length} Ürün Kalemi
                  </span>
                </div>

                {/* Table for this Reyon */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/70 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Barkod</th>
                        <th className="p-3">Ürün Kodu</th>
                        <th className="p-3">Ürün Adı</th>
                        <th className="p-3">Renk</th>
                        <th className="p-3 text-center">Envanter Miktarı</th>
                        <th className="p-3 text-center">Atanan Mağaza</th>
                        <th className="p-3 text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {group.products.map(p => {
                        const assignedBranchesCount = db.assignments.filter(a => a.productId === p.id).length;
                        const isAllAssigned = assignedBranchesCount >= db.branches.length;

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 font-mono font-bold text-slate-900 flex items-center gap-1.5">
                              <Barcode className="w-3.5 h-3.5 text-slate-400" />
                              <span>{p.barcode}</span>
                            </td>
                            <td className="p-3 font-mono text-indigo-600 font-semibold">
                              <span className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                {p.stockCode}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-slate-800">
                              {p.description}
                            </td>
                            <td className="p-3">
                              {p.color ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  <Palette className="w-3 h-3 text-slate-500" />
                                  <span>{p.color}</span>
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <span className="inline-block px-2.5 py-1 rounded-lg font-black text-xs bg-slate-100 text-slate-900 border border-slate-200">
                                {p.centralStock} {p.unit || 'Adet'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isAllAssigned 
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                  : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              }`}>
                                {isAllAssigned ? `Tüm Mağazalar (${db.branches.length})` : `${assignedBranchesCount} Mağaza`}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleDeleteProduct(p.id)}
                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                                title="Ürünü Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Flat Table View */
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Barkod</th>
                  <th className="p-3.5">Ürün Kodu</th>
                  <th className="p-3.5">Ürün Adı</th>
                  <th className="p-3.5">Renk</th>
                  <th className="p-3.5">Reyon</th>
                  <th className="p-3.5 text-center">Envanter Miktarı</th>
                  <th className="p-3.5 text-center">Atanan Mağaza</th>
                  <th className="p-3.5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(p => {
                  const aisle = db.aisles.find(a => a.id === p.aisleId);
                  const assignedCount = db.assignments.filter(a => a.productId === p.id).length;
                  const isAll = assignedCount >= db.branches.length;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-mono font-bold text-slate-900 flex items-center gap-1.5">
                        <Barcode className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.barcode}</span>
                      </td>
                      <td className="p-3.5 font-mono text-indigo-600 font-semibold">
                        <span className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {p.stockCode}
                        </span>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-800">
                        {p.description}
                      </td>
                      <td className="p-3.5">
                        {p.color ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            <Palette className="w-3 h-3 text-slate-400" />
                            <span>{p.color}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="p-3.5 font-medium text-slate-600">
                        {aisle?.name || p.category || 'Genel'}
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-900">
                        {p.centralStock} {p.unit || 'Adet'}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isAll ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {isAll ? `Tüm Şubeler (${db.branches.length})` : `${assignedCount} Şube`}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
