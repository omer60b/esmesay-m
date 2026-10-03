import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { AppDatabase, Branch } from '../types';
import { 
  Store, 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  FileSpreadsheet, 
  UploadCloud, 
  Download,
  AlertCircle,
  Building2
} from 'lucide-react';

interface BranchesTabProps {
  db: AppDatabase;
  onUpdateDb: (updater: (prev: AppDatabase) => AppDatabase) => void;
}

export const BranchesTab: React.FC<BranchesTabProps> = ({ db, onUpdateDb }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [excelFeedback, setExcelFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3500);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      alert('Lütfen mağaza adı ve mağaza kodunu doldurunuz.');
      return;
    }

    if (editingId) {
      onUpdateDb(prev => ({
        ...prev,
        branches: prev.branches.map(b => 
          b.id === editingId ? { ...b, name: name.trim(), code: code.trim().toUpperCase(), city: city.trim() || 'İstanbul' } : b
        )
      }));
      showFeedback('Mağaza bilgileri güncellendi.');
    } else {
      const newId = db.branches.length ? Math.max(...db.branches.map(b => b.id)) + 1 : 1;
      const cleanName = name.trim();
      const cleanCode = code.trim().toUpperCase();

      const newBranch: Branch = {
        id: newId,
        name: cleanName,
        code: cleanCode,
        city: city.trim() || 'İstanbul',
        createdAt: new Date().toISOString().split('T')[0]
      };

      // Automatically create store user for this branch
      const newUserId = db.users.length ? Math.max(...db.users.map(u => u.id)) + 1 : 100;
      const newStoreUser = {
        id: newUserId,
        username: cleanCode.toLowerCase(),
        password: '',
        role: 'store' as const,
        branchId: newId,
        fullName: `${cleanName} Sorumlusu`,
        isSuperAdmin: false
      };

      onUpdateDb(prev => ({
        ...prev,
        branches: [...prev.branches, newBranch],
        users: [...prev.users, newStoreUser]
      }));
      showFeedback(`"${cleanName}" mağazası ve şifresiz sayım kullanıcısı (${cleanCode.toLowerCase()}) otomatik olarak oluşturuldu.`);
    }

    resetForm();
  };

  const handleEdit = (branch: Branch) => {
    setEditingId(branch.id);
    setName(branch.name);
    setCode(branch.code);
    setCity(branch.city || '');
  };

  const handleDelete = (id: number) => {
    const branch = db.branches.find(b => b.id === id);
    if (!branch) return;

    const conf = window.confirm(`"${branch.name}" mağazasını silmek istediğinize emin misiniz?`);
    if (!conf) return;

    onUpdateDb(prev => ({
      ...prev,
      branches: prev.branches.filter(b => b.id !== id),
      users: prev.users.filter(u => u.branchId !== id),
      assignments: prev.assignments.filter(a => a.branchId !== id),
      counts: prev.counts.filter(c => c.branchId !== id),
      evaluations: prev.evaluations.filter(e => e.branchId !== id)
    }));
    showFeedback('Mağaza ve ilişkili kayıtlar silindi.');
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCode('');
    setCity('');
  };

  // Excel File Upload & Parser for Branches
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingExcel(true);
    setExcelFeedback(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);

        if (!rows || rows.length === 0) {
          alert('Excel dosyasında veri bulunamadı.');
          setIsProcessingExcel(false);
          return;
        }

        let addedCount = 0;
        let updatedCount = 0;

        onUpdateDb(prev => {
          let updatedBranches = [...prev.branches];
          let updatedUsers = [...prev.users];
          let currentMaxId = updatedBranches.length ? Math.max(...updatedBranches.map(b => b.id)) : 0;
          let currentMaxUserId = updatedUsers.length ? Math.max(...updatedUsers.map(u => u.id)) : 100;

          rows.forEach((row, idx) => {
            // Flexible column resolution (supports various Turkish/English header names)
            const branchName = 
              row['Şube Adı'] || row['Sube Adi'] || row['Mağaza Adı'] || row['Magaza Adi'] || 
              row['Şube'] || row['Sube'] || row['Mağaza'] || row['Magaza'] || 
              row['Branch Name'] || row['Name'] || row['Ad'] || row['İsim'] || '';

            if (!branchName || typeof branchName !== 'string' || !branchName.trim()) {
              return;
            }

            const cleanName = branchName.trim();
            const branchCode = (
              row['Şube Kodu'] || row['Sube Kodu'] || row['Mağaza Kodu'] || row['Magaza Kodu'] || 
              row['Kod'] || row['Code'] || row['Branch Code'] || 
              `SB${String(idx + 1).padStart(2, '0')}`
            ).toString().trim().toUpperCase();

            const branchCity = (
              row['Şehir'] || row['Sehir'] || row['İl'] || row['Il'] || row['City'] || 
              (cleanName.toLowerCase().includes('tokat') || cleanName.toLowerCase().includes('turhal') || cleanName.toLowerCase().includes('erbaa') ? 'Tokat' : 
               cleanName.toLowerCase().includes('samsun') || cleanName.toLowerCase().includes('bafra') ? 'Samsun' :
               cleanName.toLowerCase().includes('amasya') || cleanName.toLowerCase().includes('merzifon') ? 'Amasya' :
               cleanName.toLowerCase().includes('ordu') || cleanName.toLowerCase().includes('fatsa') || cleanName.toLowerCase().includes('ünye') ? 'Ordu' :
               cleanName.toLowerCase().includes('antalya') ? 'Antalya' : 'İstanbul')
            ).toString().trim();

            const existingIdx = updatedBranches.findIndex(
              b => b.code.toUpperCase() === branchCode || b.name.toLowerCase() === cleanName.toLowerCase()
            );

            let branchIdToUse: number;

            if (existingIdx >= 0) {
              branchIdToUse = updatedBranches[existingIdx].id;
              updatedBranches[existingIdx] = {
                ...updatedBranches[existingIdx],
                name: cleanName,
                code: branchCode,
                city: branchCity || updatedBranches[existingIdx].city || 'İstanbul'
              };
              updatedCount++;
            } else {
              currentMaxId++;
              branchIdToUse = currentMaxId;
              updatedBranches.push({
                id: currentMaxId,
                name: cleanName,
                code: branchCode,
                city: branchCity || 'İstanbul',
                createdAt: new Date().toISOString().split('T')[0]
              });
              addedCount++;
            }

            // Automatically ensure a store user exists for this branch
            const userExists = updatedUsers.some(u => u.branchId === branchIdToUse && u.role === 'store');
            if (!userExists) {
              currentMaxUserId++;
              updatedUsers.push({
                id: currentMaxUserId,
                username: branchCode.toLowerCase(),
                password: '',
                role: 'store',
                branchId: branchIdToUse,
                fullName: `${cleanName} Sorumlusu`,
                isSuperAdmin: false
              });
            }
          });

          return {
            ...prev,
            branches: updatedBranches,
            users: updatedUsers
          };
        });

        setExcelFeedback(`Excel başarıyla işlendi: ${addedCount} yeni şube eklendi, ${updatedCount} şube güncellendi. Tüm şubeler için sayım kullanıcıları oluşturuldu.`);
        showFeedback(`Excel ile ${addedCount + updatedCount} şube ve kullanıcıları başarıyla aktarıldı.`);
      } catch (err: any) {
        console.error(err);
        alert('Excel dosyası okunurken hata oluştu: ' + (err.message || 'Geçersiz format'));
      } finally {
        setIsProcessingExcel(false);
        // Reset file input
        e.target.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  // Download Sample Excel Template
  const handleDownloadTemplate = () => {
    const sampleData = [
      { "Şube Adı": "Güneşli Merkez Mağaza", "Şube Kodu": "GNS01", "Şehir": "İstanbul" },
      { "Şube Adı": "Okmeydanı Mağazası", "Şube Kodu": "OKM01", "Şehir": "İstanbul" },
      { "Şube Adı": "Çağlayan Mağazası", "Şube Kodu": "CGL01", "Şehir": "İstanbul" },
      { "Şube Adı": "Tokat Merkez Mağazası", "Şube Kodu": "TKT01", "Şehir": "Tokat" }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Şubeler");
    XLSX.writeFile(wb, "Esme_Sube_Yukleme_Sablonu.xlsx");
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-fadeIn shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Top Banner: Excel Integration & Branch Management */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-3xl border border-indigo-500/30 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 rounded-2xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white tracking-tight">
              Mağaza & Şube Yönetimi
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Excel dosyanızı yükleyerek tüm şubelerinizi tek seferde içeri aktarabilir veya manuel ekleyebilirsiniz.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-xs text-slate-200 font-medium flex items-center gap-2 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-indigo-300" />
            <span>Şube Excel Şablonu</span>
          </button>
        </div>
      </div>

      {/* Excel Upload Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel Dosyası ile Toplu Şube Yükle</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            Desteklenen formatlar: .xlsx, .xls, .csv
          </span>
        </div>

        <div className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 rounded-2xl p-6 text-center transition cursor-pointer relative group">
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleExcelUpload}
            disabled={isProcessingExcel}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
          />
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl group-hover:scale-105 transition">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                {isProcessingExcel ? 'Excel Dosyası İşleniyor...' : 'Şube Excel Dosyasını Buraya Bırakın veya Seçin'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                "Şube Adı", "Şube Kodu", "Şehir" sütunlarını otomatik algılar ve anında sisteme ekler.
              </p>
            </div>
          </div>
        </div>

        {excelFeedback && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{excelFeedback}</span>
          </div>
        )}
      </div>

      {/* Single Branch Form Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="font-extrabold text-slate-900 text-sm mb-4 flex items-center gap-2">
          {editingId ? (
            <>
              <Edit2 className="w-4 h-4 text-amber-600" />
              <span>Mağazayı Düzenle</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>Yeni Mağaza Ekle (Tekli)</span>
            </>
          )}
        </h3>

        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mağaza Adı</label>
            <input
              type="text"
              placeholder="Örn: Güneşli Merkez Mağaza"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mağaza Kodu</label>
            <input
              type="text"
              placeholder="Örn: GNS01"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 uppercase"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Şehir</label>
            <input
              type="text"
              placeholder="Örn: İstanbul"
              value={city}
              onChange={e => setCity(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="md:col-span-4 flex items-center justify-end gap-2 pt-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                İptal
              </button>
            )}
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
            >
              {editingId ? 'Güncellemeyi Kaydet' : 'Mağazayı Ekle'}
            </button>
          </div>
        </form>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <Store className="w-4 h-4 text-indigo-600" />
            <span>Kayıtlı Mağazalar ({db.branches.length})</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-100">
              <tr>
                <th className="p-3.5">Mağaza Adı</th>
                <th className="p-3.5">Kod</th>
                <th className="p-3.5">Şehir</th>
                <th className="p-3.5 text-center">Atanan Ürün</th>
                <th className="p-3.5 text-center">Yapılan Sayım</th>
                <th className="p-3.5 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.branches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">Henüz mağaza eklenmemiş.</td>
                </tr>
              ) : (
                db.branches.map(b => {
                  const assigned = db.assignments.filter(a => a.branchId === b.id).length;
                  const counted = db.counts.filter(c => c.branchId === b.id).length;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-bold text-slate-800">{b.name}</td>
                      <td className="p-3.5 font-mono text-indigo-600 font-semibold">{b.code}</td>
                      <td className="p-3.5 text-slate-600">{b.city || 'İstanbul'}</td>
                      <td className="p-3.5 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                          {assigned}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${counted > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                          {counted}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1">
                        <button
                          onClick={() => handleEdit(b)}
                          className="p-1.5 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg transition cursor-pointer"
                          title="Düzenle"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
