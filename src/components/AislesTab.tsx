import React, { useState } from 'react';
import { AppDatabase, Aisle } from '../types';
import { defaultAisles } from '../mockData';
import { Tags, Plus, Edit2, Trash2, CheckCircle2, RotateCcw } from 'lucide-react';

interface AislesTabProps {
  db: AppDatabase;
  onUpdateDb: (updater: (prev: AppDatabase) => AppDatabase) => void;
}

export const AislesTab: React.FC<AislesTabProps> = ({ db, onUpdateDb }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [feedback, setFeedback] = useState('');

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleRestoreOfficialAisles = () => {
    if (!window.confirm('Tüm reyonları resmi 15 reyon listesiyle (Aksesuar Grubu dahil) güncellemek istediğinize emin misiniz?')) return;
    onUpdateDb(prev => ({
      ...prev,
      aisles: defaultAisles
    }));
    showFeedback('Resmi 15 reyon listesi başarıyla yüklendi.');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Lütfen reyon adını doldurunuz.');
      return;
    }

    if (editingId) {
      onUpdateDb(prev => ({
        ...prev,
        aisles: prev.aisles.map(a => 
          a.id === editingId ? { ...a, name: name.trim(), description: description.trim() } : a
        )
      }));
      showFeedback('Reyon bilgisi güncellendi.');
    } else {
      const newId = db.aisles.length ? Math.max(...db.aisles.map(a => a.id)) + 1 : 1;
      const newAisle: Aisle = {
        id: newId,
        name: name.trim(),
        description: description.trim()
      };
      onUpdateDb(prev => ({
        ...prev,
        aisles: [...prev.aisles, newAisle]
      }));
      showFeedback('Yeni reyon başarıyla eklendi.');
    }

    resetForm();
  };

  const handleEdit = (aisle: Aisle) => {
    setEditingId(aisle.id);
    setName(aisle.name);
    setDescription(aisle.description || '');
  };

  const handleDelete = (id: number) => {
    const aisle = db.aisles.find(a => a.id === id);
    if (!aisle) return;

    const conf = window.confirm(`"${aisle.name}" reyonunu silmek istediğinize emin misiniz?`);
    if (!conf) return;

    onUpdateDb(prev => ({
      ...prev,
      aisles: prev.aisles.filter(a => a.id !== id)
    }));
    showFeedback('Reyon silindi.');
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
          {editingId ? (
            <>
              <Edit2 className="w-4 h-4 text-amber-600" />
              <span>Reyonu Düzenle</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>Yeni Reyon Ekle</span>
            </>
          )}
        </h3>

        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Reyon Adı</label>
            <input
              type="text"
              placeholder="Örn: Elektronik, Kozmetik, Gıda"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Açıklama / Kapsam (Opsiyonel)</label>
            <input
              type="text"
              placeholder="Örn: Telefonlar, bilgisayarlar ve sarf malzemeleri"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="md:col-span-3 flex items-center justify-end gap-2 pt-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition"
              >
                İptal
              </button>
            )}
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
            >
              {editingId ? 'Güncellemeyi Kaydet' : 'Reyonu Ekle'}
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Tags className="w-4 h-4 text-indigo-600" />
            <span>Kayıtlı Reyonlar ({db.aisles.length})</span>
          </h3>
          <button
            type="button"
            onClick={handleRestoreOfficialAisles}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition border border-indigo-200/80 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Resmi 15 Reyonu Geri Yükle</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-100">
              <tr>
                <th className="p-3.5">Reyon Adı</th>
                <th className="p-3.5">Açıklama</th>
                <th className="p-3.5 text-center">Ürün Sayısı</th>
                <th className="p-3.5 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.aisles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400">Henüz reyon eklenmemiş.</td>
                </tr>
              ) : (
                db.aisles.map(a => {
                  const prodCount = db.products.filter(p => p.aisleId === a.id).length;

                  return (
                    <tr key={a.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3.5 font-bold text-slate-900">
                        {a.name}
                      </td>
                      <td className="p-3.5 text-slate-500">
                        {a.description || '-'}
                      </td>
                      <td className="p-3.5 text-center font-bold text-indigo-600">
                        {prodCount}
                      </td>
                      <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleEdit(a)}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-semibold transition"
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-semibold transition"
                        >
                          Sil
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
