import React, { useState } from 'react';
import { AppDatabase, CountRecord, User } from '../types';
import { exportCountHistoryPdf } from '../utils/pdfExport';
import { 
  Trash2, 
  AlertTriangle, 
  Search, 
  Filter, 
  RotateCcw, 
  CheckSquare, 
  Square, 
  CheckCircle2, 
  Edit3,
  Calendar,
  Store,
  Layers,
  FileText,
  Download,
  ShieldAlert,
  Lock
} from 'lucide-react';

interface CountHistoryTabProps {
  db: AppDatabase;
  onUpdateDb: (updater: (prev: AppDatabase) => AppDatabase) => void;
  currentUser?: User;
}

export const CountHistoryTab: React.FC<CountHistoryTabProps> = ({ db, onUpdateDb, currentUser }) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editingRecord, setEditingRecord] = useState<CountRecord | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [successMessage, setSuccessMessage] = useState<string>('');

  const isSuperAdmin = currentUser?.isSuperAdmin || currentUser?.username.toUpperCase() === 'O.BAS' || currentUser?.username.toUpperCase() === 'T.CESUR';
  const canDelete = isSuperAdmin || currentUser?.permissions?.canDeleteCounts;

  // Security Authorization Modal state for deletion
  const [authModalConfig, setAuthModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmAction: () => void;
    requireAutoPdf?: boolean;
    recordCount: number;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmAction: () => {},
    requireAutoPdf: true,
    recordCount: 0
  });

  const [adminPinInput, setAdminPinInput] = useState('');
  const [autoDownloadPdfOnDelete, setAutoDownloadPdfOnDelete] = useState(true);
  const [pinError, setPinError] = useState('');

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3500);
  };

  // Filter count items
  const filteredCounts = db.counts.filter(c => {
    if (selectedBranchId !== 'all' && c.branchId !== Number(selectedBranchId)) return false;

    const prod = db.products.find(p => p.id === c.productId);
    const diff = c.quantity - (prod?.centralStock ?? 0);

    if (selectedStatus === 'exact' && diff !== 0) return false;
    if (selectedStatus === 'shortage' && diff >= 0) return false;
    if (selectedStatus === 'surplus' && diff <= 0) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const branch = db.branches.find(b => b.id === c.branchId);
      const matchesBranch = branch?.name.toLowerCase().includes(q) || branch?.code.toLowerCase().includes(q);
      const matchesProd = prod?.description.toLowerCase().includes(q) || prod?.barcode.includes(q);
      if (!matchesBranch && !matchesProd) return false;
    }

    return true;
  });

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCounts.map(c => c.id).length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCounts.map(c => c.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Download PDF of filtered counts
  const handleDownloadPdfFiltered = () => {
    if (filteredCounts.length === 0) {
      alert('İndirilecek sayım kaydı bulunmuyor.');
      return;
    }
    const branchName = selectedBranchId !== 'all' 
      ? db.branches.find(b => b.id === Number(selectedBranchId))?.name || 'Seçili Şube'
      : 'Tüm Şubeler';

    exportCountHistoryPdf(db, filteredCounts, `Filtrelenmiş Geçmiş Sayımlar (${branchName})`);
    showSuccess('Geçmiş sayım raporu PDF olarak indirildi.');
  };

  // Download PDF of selected counts
  const handleDownloadPdfSelected = () => {
    const selectedRecords = db.counts.filter(c => selectedIds.includes(c.id));
    if (selectedRecords.length === 0) return;
    exportCountHistoryPdf(db, selectedRecords, `Seçilen ${selectedRecords.length} Adet Sayım Kaydı`);
    showSuccess('Seçili kayıtlar PDF olarak indirildi.');
  };

  // Trigger Auth Verification before Deletion
  const triggerAuthorizedAction = (
    title: string,
    description: string,
    recordCount: number,
    action: () => void,
    recordsToArchive?: any[]
  ) => {
    if (!canDelete) {
      alert('Yetki Kısıtlaması: Geçmiş sayımları silme yetkiniz bulunmamaktadır. Lütfen yöneticiler (O.BAS / T.CESUR) ile iletişime geçiniz.');
      return;
    }

    setAdminPinInput('');
    setPinError('');
    setAuthModalConfig({
      isOpen: true,
      title,
      description,
      recordCount,
      confirmAction: () => {
        if (autoDownloadPdfOnDelete && recordsToArchive && recordsToArchive.length > 0) {
          exportCountHistoryPdf(db, recordsToArchive, `Silme Öncesi Arşiv - ${title}`);
        }
        action();
      }
    });
  };

  // Confirm authorization PIN
  const handleConfirmPin = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = adminPinInput.trim();
    if (pin !== '1864' && pin !== '9084' && pin !== '1234') {
      setPinError('Geçersiz Güvenlik Doğrulaması! (O.BAS: 1864, T.CESUR: 9084 veya Yönetici PIN: 1234)');
      return;
    }

    authModalConfig.confirmAction();
    setAuthModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  // Delete single count record
  const handleDeleteSingle = (recordId: number) => {
    const record = db.counts.find(c => c.id === recordId);
    if (!record) return;
    const prod = db.products.find(p => p.id === record.productId);
    const branch = db.branches.find(b => b.id === record.branchId);

    triggerAuthorizedAction(
      'Tekil Sayım Kaydı Silme',
      `"${branch?.name || 'Şube'}" için girilen "${prod?.description || 'Ürün'}" sayım kaydını kalıcı olarak silmek üzeresiniz.`,
      1,
      () => {
        onUpdateDb(prev => ({
          ...prev,
          counts: prev.counts.filter(c => c.id !== recordId)
        }));
        setSelectedIds(prev => prev.filter(id => id !== recordId));
        showSuccess('Sayım kaydı başarıyla silindi.');
      },
      [record]
    );
  };

  // Delete selected count records
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    const recordsToDelete = db.counts.filter(c => selectedIds.includes(c.id));

    triggerAuthorizedAction(
      'Toplu Sayım Kaydı Silme',
      `Seçilen ${selectedIds.length} adet geçmiş sayım kaydı sistemden kalıcı olarak silinecektir.`,
      selectedIds.length,
      () => {
        onUpdateDb(prev => ({
          ...prev,
          counts: prev.counts.filter(c => !selectedIds.includes(c.id))
        }));
        showSuccess(`${selectedIds.length} adet sayım kaydı başarıyla silindi.`);
        setSelectedIds([]);
      },
      recordsToDelete
    );
  };

  // Clear all counts for a selected branch
  const handleClearBranchCounts = (branchId: number) => {
    const branch = db.branches.find(b => b.id === branchId);
    const recordsForBranch = db.counts.filter(c => c.branchId === branchId);
    if (recordsForBranch.length === 0) {
      alert(`"${branch?.name}" için kayıtlı sayım bulunmuyor.`);
      return;
    }

    triggerAuthorizedAction(
      `${branch?.name} Sayımlarını Sıfırlama`,
      `"${branch?.name}" şubesine ait TÜM (${recordsForBranch.length} adet) sayım verisi silinecektir. Şube sıfırdan yeniden sayım yapabilir.`,
      recordsForBranch.length,
      () => {
        onUpdateDb(prev => ({
          ...prev,
          counts: prev.counts.filter(c => c.branchId !== branchId)
        }));
        setSelectedIds(prev => prev.filter(id => {
          const rec = db.counts.find(c => c.id === id);
          return rec?.branchId !== branchId;
        }));
        showSuccess(`"${branch?.name}" şubesinin tüm sayımları silindi.`);
      },
      recordsForBranch
    );
  };

  // Clear all counts globally
  const handleClearAllCounts = () => {
    if (db.counts.length === 0) {
      alert('Sistemde silinecek sayım verisi bulunmuyor.');
      return;
    }

    const allCounts = [...db.counts];

    triggerAuthorizedAction(
      'Tüm Geçmiş Sayımları Sıfırlama (Tam Temizlik)',
      `DİKKAT: Sistemdeki TÜM (${db.counts.length} adet) geçmiş sayım kaydı silinecektir. Bu işlem yeni bir genel sayım dönemi başlatmak için kullanılır.`,
      db.counts.length,
      () => {
        onUpdateDb(prev => ({
          ...prev,
          counts: []
        }));
        setSelectedIds([]);
        showSuccess('Tüm geçmiş sayımlar başarıyla temizlendi.');
      },
      allCounts
    );
  };

  // Save inline edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    onUpdateDb(prev => ({
      ...prev,
      counts: prev.counts.map(c => 
        c.id === editingRecord.id ? { ...c, quantity: Number(editQty) } : c
      )
    }));
    setEditingRecord(null);
    showSuccess('Sayım miktarı güncellendi.');
  };

  return (
    <div className="space-y-6">
      {/* Alert toast */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Top Banner / Explanation with PDF Download & Deletion Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Geçmiş Sayımlar & Sayı Silme Paneli</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
              <span>Admin Yetkisi</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Geçmiş sayım kayıtlarını inceleyin, PDF olarak arşivleyin, hatalı veya mükerrer sayımları silin.
          </p>
        </div>

        {/* Action Buttons: PDF Export & Danger Deletions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* PDF Download Button */}
          <button
            onClick={handleDownloadPdfFiltered}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
            title="Mevcut filtrelenmiş geçmiş sayımları PDF olarak indir"
          >
            <Download className="w-4 h-4" />
            <span>PDF Olarak İndir</span>
          </button>

          {/* Delete Selected Button */}
          {selectedIds.length > 0 && (
            <>
              <button
                onClick={handleDownloadPdfSelected}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                title="Yalnızca seçilen kayıtları PDF olarak indir"
              >
                <FileText className="w-4 h-4" />
                <span>Seçilenleri PDF İndir ({selectedIds.length})</span>
              </button>

              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Seçilenleri Sil ({selectedIds.length})</span>
              </button>
            </>
          )}

          {/* Reset All Global */}
          <button
            onClick={handleClearAllCounts}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition cursor-pointer"
            title="Tüm mağazaların sayım verilerini sıfırlar"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Tüm Sayımları Sıfırla</span>
          </button>
        </div>
      </div>

      {/* Branch Specific Clear Quick Action */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <Store className="w-4 h-4 text-indigo-600" />
          <span>Şubeye Göre Toplu Sayım Temizleme:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {db.branches.map(b => {
            const countForThis = db.counts.filter(c => c.branchId === b.id).length;
            return (
              <button
                key={b.id}
                onClick={() => handleClearBranchCounts(b.id)}
                className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-700 hover:text-rose-700 rounded-xl font-medium transition flex items-center gap-1.5 text-xs shadow-xs cursor-pointer"
                title={`${b.name} şubesinin ${countForThis} adet sayımını sil`}
              >
                <span>{b.name}</span>
                <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                  {countForThis}
                </span>
                <Trash2 className="w-3 h-3 text-slate-400 group-hover:text-rose-600" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Ürün adı, barkod veya mağaza ara..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtreler:</span>
          </div>

          <select
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium"
          >
            <option value="all">Tüm Mağazalar ({db.counts.length})</option>
            {db.branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} ({db.counts.filter(c => c.branchId === b.id).length})
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="exact">Tam Eşleşenler</option>
            <option value="shortage">Eksik Stok (Kayıp)</option>
            <option value="surplus">Fazla Stok</option>
          </select>
        </div>
      </div>

      {/* Counts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1.5 transition cursor-pointer"
            >
              {selectedIds.length > 0 && selectedIds.length === filteredCounts.length ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Tümünü Seç ({filteredCounts.length})</span>
            </button>
            {selectedIds.length > 0 && (
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg">
                {selectedIds.length} seçili
              </span>
            )}
          </div>

          <div className="text-xs text-slate-500">
            Toplam <span className="font-bold text-slate-800">{filteredCounts.length}</span> sayım kaydı listeleniyor
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider border-b border-slate-100 font-bold">
              <tr>
                <th className="p-3.5 w-10 text-center">#</th>
                <th className="p-3.5">Tarih</th>
                <th className="p-3.5">Mağaza</th>
                <th className="p-3.5">Reyon</th>
                <th className="p-3.5">Ürün Tanımı & Barkod</th>
                <th className="p-3.5 text-center">Merkez Stok</th>
                <th className="p-3.5 text-center">Sayılan</th>
                <th className="p-3.5 text-center">Fark</th>
                <th className="p-3.5">Durum</th>
                <th className="p-3.5 text-right">İşlemler (Sil / Düzenle)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCounts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Layers className="w-8 h-8 text-slate-300" />
                      <span>Filtrelere uygun sayım kaydı bulunamadı.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCounts.map((c, index) => {
                  const branch = db.branches.find(b => b.id === c.branchId);
                  const prod = db.products.find(p => p.id === c.productId);
                  const aisle = db.aisles.find(a => a.id === prod?.aisleId);
                  const centralStock = prod?.centralStock ?? 0;
                  const diff = c.quantity - centralStock;
                  const isSelected = selectedIds.includes(c.id);

                  let statusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Tam Eşleşme
                    </span>
                  );
                  let diffDisplay = <span className="font-bold text-emerald-600">0</span>;

                  if (diff < 0) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        Eksik ({diff})
                      </span>
                    );
                    diffDisplay = <span className="font-bold text-rose-600">{diff}</span>;
                  } else if (diff > 0) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Fazla (+{diff})
                      </span>
                    );
                    diffDisplay = <span className="font-bold text-amber-600">+{diff}</span>;
                  }

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/70 transition ${isSelected ? 'bg-indigo-50/40' : ''}`}
                    >
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(c.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      <td className="p-3.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {c.countedAt || '-'}
                      </td>

                      <td className="p-3.5 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{branch?.name || 'Bilinmeyen'}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({branch?.code})</span>
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-600 whitespace-nowrap">
                        {aisle?.name || '-'}
                      </td>

                      <td className="p-3.5 max-w-xs">
                        <div className="font-semibold text-slate-900 truncate">
                          {prod?.description || 'Silinmiş Ürün'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {prod?.barcode || '-'}
                        </div>
                      </td>

                      <td className="p-3.5 text-center font-semibold text-slate-600">
                        {centralStock}
                      </td>

                      <td className="p-3.5 text-center">
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {c.quantity}
                        </span>
                      </td>

                      <td className="p-3.5 text-center">
                        {diffDisplay}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        {statusBadge}
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit button */}
                          <button
                            onClick={() => {
                              setEditingRecord(c);
                              setEditQty(c.quantity);
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title="Sayım Miktarını Düzelt"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => handleDeleteSingle(c.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Bu Sayımı Kalıcı Olarak Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Authorization Security PIN Modal for Deletions */}
      {authModalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-rose-100 text-rose-700 rounded-2xl">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {authModalConfig.title}
                </h3>
                <p className="text-xs text-slate-500">Yönetici Yetkilendirme Doğrulaması</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {authModalConfig.description}
            </p>

            <form onSubmit={handleConfirmPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Yetkili Güvenlik Doğrulaması (PIN veya Şifre)
                </label>
                <input
                  type="password"
                  placeholder="Güvenlik PIN / Şifrenizi Giriniz"
                  value={adminPinInput}
                  onChange={e => setAdminPinInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-center text-base font-mono tracking-widest outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                  autoFocus
                  required
                />
              </div>

              {/* Automatic PDF Archive Checkbox */}
              <label className="flex items-center gap-2 p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoDownloadPdfOnDelete}
                  onChange={e => setAutoDownloadPdfOnDelete(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                <span className="font-medium">Silmeden önce sayım kayıtlarını otomatik PDF olarak arşivle</span>
              </label>

              {pinError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                  {pinError}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setAuthModalConfig(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/30 transition cursor-pointer"
                >
                  Onayla ve Sil ({authModalConfig.recordCount})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Edit Quantity Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-indigo-600" />
              <span>Sayım Miktarını Düzelt</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {db.products.find(p => p.id === editingRecord.productId)?.description}
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Yeni Sayılan Miktar
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editQty}
                  onChange={e => setEditQty(Number(e.target.value))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
