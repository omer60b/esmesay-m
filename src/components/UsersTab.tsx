import React, { useState } from 'react';
import { AppDatabase, User, UserPermissions } from '../types';
import { 
  Users, 
  UserPlus, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  Shield, 
  Store, 
  Crown,
  ShieldCheck,
  CheckSquare,
  Square,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  FileSpreadsheet,
  Building2,
  Tags,
  FileCheck,
  Award,
  Layers,
  Sparkles
} from 'lucide-react';

interface UsersTabProps {
  db: AppDatabase;
  onUpdateDb: (updater: (prev: AppDatabase) => AppDatabase) => void;
  currentUser?: User;
}

export const UsersTab: React.FC<UsersTabProps> = ({ db, onUpdateDb, currentUser }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [username, setUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'store'>('store');
  const [branchId, setBranchId] = useState<string>('');
  
  // Privacy mask toggle (Default: masked / credentials hidden)
  const [maskCredentials, setMaskCredentials] = useState<boolean>(true);
  const [unmaskedUserIds, setUnmaskedUserIds] = useState<Record<number, boolean>>({});

  // Expanded Granular Permissions (Assigned by En Yetkili Yöneticiler O.BAS / T.CESUR)
  const [permissions, setPermissions] = useState<UserPermissions>({
    canDeleteCounts: false,
    canEditCounts: true,
    canEditProducts: true,
    canDeleteProducts: false,
    canImportExcel: true,
    canManageBranches: false,
    canDeleteBranches: false,
    canManageAisles: false,
    canManageUsers: false,
    canExportReports: true,
    canViewReports: true,
    canEvaluateBranches: false,
    canApproveCounts: false
  });

  const [feedback, setFeedback] = useState('');

  const isSuperAdmin = currentUser?.isSuperAdmin || currentUser?.username.toUpperCase() === 'O.BAS' || currentUser?.username.toUpperCase() === 'T.CESUR';

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleTogglePermission = (permKey: keyof UserPermissions) => {
    setPermissions(prev => ({
      ...prev,
      [permKey]: !prev[permKey]
    }));
  };

  const handleSelectAllPermissions = () => {
    setPermissions({
      canDeleteCounts: true,
      canEditCounts: true,
      canEditProducts: true,
      canDeleteProducts: true,
      canImportExcel: true,
      canManageBranches: true,
      canDeleteBranches: true,
      canManageAisles: true,
      canManageUsers: true,
      canExportReports: true,
      canViewReports: true,
      canEvaluateBranches: true,
      canApproveCounts: true
    });
  };

  const handleDeselectAllPermissions = () => {
    setPermissions({
      canDeleteCounts: false,
      canEditCounts: false,
      canEditProducts: false,
      canDeleteProducts: false,
      canImportExcel: false,
      canManageBranches: false,
      canDeleteBranches: false,
      canManageAisles: false,
      canManageUsers: false,
      canExportReports: false,
      canViewReports: false,
      canEvaluateBranches: false,
      canApproveCounts: false
    });
  };

  const toggleUnmaskUser = (id: number) => {
    setUnmaskedUserIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const maskString = (str: string) => {
    if (!str) return '••••••';
    if (str.length <= 2) return '••';
    return str[0] + '•'.repeat(Math.max(str.length - 2, 3)) + str[str.length - 1];
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      alert('Kullanıcı adı zorunludur.');
      return;
    }

    if (role === 'admin' && !editingId && !adminPassword.trim()) {
      alert('Yönetici kullanıcısı için şifre belirlemeniz gerekmektedir.');
      return;
    }

    if (role === 'store' && !branchId) {
      alert('Mağaza personeli için bir şube seçmelisiniz.');
      return;
    }

    const assignedBranchId = role === 'store' ? Number(branchId) : null;
    const isTargetSuperAdmin = username.trim().toUpperCase() === 'O.BAS' || username.trim().toUpperCase() === 'T.CESUR';

    const finalPermissions: UserPermissions = isTargetSuperAdmin ? {
      canDeleteCounts: true,
      canEditCounts: true,
      canEditProducts: true,
      canDeleteProducts: true,
      canImportExcel: true,
      canManageBranches: true,
      canDeleteBranches: true,
      canManageAisles: true,
      canManageUsers: true,
      canExportReports: true,
      canViewReports: true,
      canEvaluateBranches: true,
      canApproveCounts: true
    } : { ...permissions };

    if (editingId) {
      onUpdateDb(prev => ({
        ...prev,
        users: prev.users.map(u => {
          if (u.id !== editingId) return u;
          return {
            ...u,
            username: username.trim(),
            password: role === 'admin' ? (adminPassword.trim() || u.password) : '',
            fullName: fullName.trim() || undefined,
            role,
            branchId: assignedBranchId,
            isSuperAdmin: isTargetSuperAdmin ? true : u.isSuperAdmin,
            permissions: role === 'admin' ? finalPermissions : undefined
          };
        })
      }));
      showFeedback('Kullanıcı ve yetki tanımları başarıyla güncellendi.');
    } else {
      // Check unique username
      if (db.users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
        alert('Bu kullanıcı adı sistemde zaten kayıtlıdır.');
        return;
      }

      const newId = db.users.length ? Math.max(...db.users.map(u => u.id)) + 1 : 1;
      const newUser: User = {
        id: newId,
        username: username.trim(),
        password: role === 'admin' ? adminPassword.trim() : '',
        fullName: fullName.trim() || (role === 'admin' ? 'Yönetici' : 'Mağaza Personeli'),
        role,
        branchId: assignedBranchId,
        isSuperAdmin: isTargetSuperAdmin,
        permissions: role === 'admin' ? finalPermissions : undefined
      };

      onUpdateDb(prev => ({
        ...prev,
        users: [...prev.users, newUser]
      }));

      showFeedback(
        role === 'admin' 
          ? `Yönetici "${newUser.username}" şifresi ve izinleriyle başarıyla oluşturuldu.`
          : `Mağaza personeli "${newUser.username}" şifresiz olarak tanımlandı.`
      );
    }

    resetForm();
  };

  const handleEdit = (user: User) => {
    setEditingId(user.id);
    setUsername(user.username);
    setAdminPassword(user.role === 'admin' ? user.password : '');
    setFullName(user.fullName || '');
    setRole(user.role);
    setBranchId(user.branchId ? String(user.branchId) : '');
    setPermissions(user.permissions || {
      canDeleteCounts: false,
      canEditCounts: false,
      canEditProducts: false,
      canDeleteProducts: false,
      canImportExcel: false,
      canManageBranches: false,
      canDeleteBranches: false,
      canManageAisles: false,
      canManageUsers: false,
      canExportReports: true,
      canViewReports: true,
      canEvaluateBranches: false,
      canApproveCounts: false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: number) => {
    const targetUser = db.users.find(u => u.id === id);
    if (!targetUser) return;

    if (targetUser.username.toUpperCase() === 'O.BAS' || targetUser.username.toUpperCase() === 'T.CESUR' || targetUser.isSuperAdmin) {
      alert('En yetkili yönetici (O.BAS / T.CESUR) hesabı silinemez!');
      return;
    }

    if (!confirm(`"${targetUser.fullName || targetUser.username}" kullanıcısını silmek istediğinize emin misiniz?`)) return;

    onUpdateDb(prev => ({
      ...prev,
      users: prev.users.filter(u => u.id !== id)
    }));
    showFeedback('Kullanıcı başarıyla silindi.');
  };

  const resetForm = () => {
    setEditingId(null);
    setUsername('');
    setAdminPassword('');
    setShowAdminPassword(false);
    setFullName('');
    setRole('store');
    setBranchId('');
    setPermissions({
      canDeleteCounts: false,
      canEditCounts: true,
      canEditProducts: true,
      canDeleteProducts: false,
      canImportExcel: true,
      canManageBranches: false,
      canDeleteBranches: false,
      canManageAisles: false,
      canManageUsers: false,
      canExportReports: true,
      canViewReports: true,
      canEvaluateBranches: false,
      canApproveCounts: false
    });
  };

  const permissionList = [
    { key: 'canDeleteCounts' as keyof UserPermissions, label: 'Geçmiş Sayımları Silme Yetkisi', desc: 'Şube sayım kayıtlarını sistemden tamamen kaldırabilir', icon: Trash2, color: 'rose' },
    { key: 'canEditCounts' as keyof UserPermissions, label: 'Sayım Miktarlarını Düzeltme & Güncelleme', desc: 'Yapılan sayım rakamlarını sonradan revize edebilir', icon: Edit2, color: 'amber' },
    { key: 'canEditProducts' as keyof UserPermissions, label: 'Yeni Ürün Ekleme & Düzenleme', desc: 'Ürün açıklaması, stok kodu ve reyon ataması yapabilir', icon: Layers, color: 'indigo' },
    { key: 'canDeleteProducts' as keyof UserPermissions, label: 'Ürün Silme Yetkisi', desc: 'Merkez ürün havuzundan ürün kaydı silebilir', icon: Trash2, color: 'rose' },
    { key: 'canImportExcel' as keyof UserPermissions, label: 'Excel ile Toplu Ürün Yükleme & Atama', desc: 'Excel dosyası ile toplu ürün ve envanter yükleyebilir', icon: FileSpreadsheet, color: 'emerald' },
    { key: 'canManageBranches' as keyof UserPermissions, label: 'Mağaza / Şube Ekleme & Düzenleme', desc: 'Yeni mağaza ve depo tanımlayabilir', icon: Building2, color: 'blue' },
    { key: 'canDeleteBranches' as keyof UserPermissions, label: 'Mağaza / Şube Silme Yetkisi', desc: 'Kayıtlı mağazaları ve tüm ilişkili verilerini silebilir', icon: Trash2, color: 'rose' },
    { key: 'canManageAisles' as keyof UserPermissions, label: 'Reyon Yönetimi (Ekle / Düzenle / Sil)', desc: 'Yeni reyon ve kategori başlıkları açabilir', icon: Tags, color: 'purple' },
    { key: 'canManageUsers' as keyof UserPermissions, label: 'Kullanıcı Açma & Yetki Tanımlama', desc: 'Sisteme yeni yönetici veya mağaza personeli tanımlayabilir', icon: Users, color: 'amber' },
    { key: 'canViewReports' as keyof UserPermissions, label: 'Raporları Görüntüleme & Filtreleme', desc: 'Merkez stok ve mağaza sayım mutabakat raporlarını inceler', icon: Shield, color: 'blue' },
    { key: 'canExportReports' as keyof UserPermissions, label: 'PDF & Excel Rapor İndirme', desc: 'Resmi sayım sonuçlarını PDF ve Excel olarak dışa aktarır', icon: FileCheck, color: 'emerald' },
    { key: 'canEvaluateBranches' as keyof UserPermissions, label: 'Şube Performans & Puanlama Yönetimi', desc: 'Mağazaların kör sayım doğruluk oranlarını puanlar', icon: Award, color: 'amber' },
    { key: 'canApproveCounts' as keyof UserPermissions, label: 'Kör Sayım Mutabakatını Onaylama / Kilitleme', desc: 'Mağazanın gönderdiği sayımı resmi olarak onaylar', icon: ShieldCheck, color: 'teal' }
  ];

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-fadeIn shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Super Admin Authorization Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-3xl border border-amber-500/30 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-2xl">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Kullanıcı & Yetkilendirme Matrisi
              </h2>
              <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-400/30">
                En Yetkili Yönetici Kontrolü
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Mağaza personelleri şifresiz olarak doğrudan şube seçerek giriş yapar. Yöneticiler için şifre ve ayrıntılı işlem yetkileri belirlenir.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMaskCredentials(!maskCredentials)}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-xs text-slate-200 font-medium flex items-center gap-2 transition cursor-pointer"
          >
            {maskCredentials ? <Eye className="w-4 h-4 text-amber-400" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
            <span>{maskCredentials ? 'Kullanıcı Adlarını Göster' : 'Kullanıcı Adlarını Maskele'}</span>
          </button>
        </div>
      </div>

      {/* User Create & Edit Form */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
          {editingId ? (
            <>
              <Edit2 className="w-4 h-4 text-amber-600" />
              <span>Kullanıcıyı ve Yetkileri Düzenle</span>
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 text-indigo-600" />
              <span>Yeni Kullanıcı Ekle ve Yetki Tanımla</span>
            </>
          )}
        </h3>

        <form onSubmit={handleSave} className="space-y-4">
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${role === 'admin' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Kullanıcı Adı *
              </label>
              <input
                type="text"
                placeholder="Örn: denetmen1 veya 013"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="off"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Kullanıcı Rolü</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
              >
                <option value="store">Mağaza Personeli (Şifresiz Şube Girişi)</option>
                <option value="admin">Yönetici / Denetmen (Şifreli Merkez Girişi)</option>
              </select>
            </div>

            {/* ONLY ADMIN ROLE REQUIRES PASSWORD */}
            {role === 'admin' && (
              <div>
                <label className="block text-[11px] font-bold text-indigo-700 uppercase mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-indigo-600" />
                    <span>Yönetici Şifresi *</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="text-[10px] text-indigo-600 hover:underline font-semibold cursor-pointer"
                  >
                    {showAdminPassword ? 'Gizle' : 'Göster'}
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    placeholder={editingId ? 'Mevcut şifreyi koru veya yeni gir' : '••••••'}
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full px-3.5 py-2.5 bg-indigo-50/50 border border-indigo-200 focus:border-indigo-500 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 font-mono pr-8"
                    required={!editingId}
                  />
                  <Lock className="w-3.5 h-3.5 text-indigo-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Ad Soyad / Unvan</label>
              <input
                type="text"
                placeholder="Örn: Ahmet Yılmaz"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                {role === 'store' ? 'Bağlı Olduğu Şube *' : 'Şube (İsteğe Bağlı)'}
              </label>
              <select
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
                disabled={role === 'admin'}
                className={`w-full px-3.5 py-2.5 border rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 ${
                  role === 'admin'
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-slate-50 border-slate-200 text-slate-800 font-medium'
                }`}
              >
                <option value="">{role === 'admin' ? 'Tüm Şubeler (Merkez Yönetim)' : 'Şube Seçiniz...'}</option>
                {db.branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Notice for Store Users: Passwordless branch login */}
          {role === 'store' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800">
              <Store className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Şifresiz Mağaza Girişi:</strong> Mağaza kullanıcılarına şifre oluşturulmaz. Personel telefon veya bilgisayardan çalıştığı şubeyi seçerek doğrudan sayım paneline bağlanır.
              </span>
            </div>
          )}

          {/* EXPANDED GRANULAR PERMISSIONS SECTION (ONLY FOR ADMIN ROLES) */}
          {role === 'admin' && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-indigo-600" />
                    <span>En Yetkili Yönetici Tarafından Verilecek İzinler ve Kısıtlamalar:</span>
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Yöneticinin yapabileceği işlemleri kutucukları işaretleyerek belirleyin. İşaretlenmeyen işlemler kısıtlanır.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllPermissions}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                  >
                    Tümünü Seç
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllPermissions}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-bold transition cursor-pointer"
                  >
                    Tümünü Kaldır
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                {permissionList.map(item => {
                  const Icon = item.icon;
                  const isChecked = !!permissions[item.key];
                  const isSuperAdminAccount = username.trim().toUpperCase() === 'O.BAS' || username.trim().toUpperCase() === 'T.CESUR';

                  return (
                    <label 
                      key={item.key}
                      onClick={() => !isSuperAdminAccount && handleTogglePermission(item.key)}
                      className={`p-3 rounded-2xl border flex items-start gap-2.5 transition cursor-pointer select-none ${
                        isChecked
                          ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950 font-semibold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <Icon className={`w-3.5 h-3.5 ${isChecked ? 'text-indigo-600' : 'text-slate-400'}`} />
                          <span className={`text-xs ${isChecked ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                            {item.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-normal mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Vazgeç
              </button>
            )}

            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4" />
              <span>{editingId ? 'Güncelle ve Yetkileri Kaydet' : 'Kullanıcıyı Tanımla'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Registered Users Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Tanımlı Kullanıcılar & Giriş Bilgileri ({db.users.length})</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider border-b border-slate-100 font-bold">
              <tr>
                <th className="p-3.5">Kullanıcı Adı</th>
                <th className="p-3.5">Giriş Şekli / Şifre</th>
                <th className="p-3.5">Ad Soyad</th>
                <th className="p-3.5">Rol</th>
                <th className="p-3.5">Şube / Mağaza</th>
                <th className="p-3.5">Tanımlı Yetkiler</th>
                <th className="p-3.5 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.users.map(u => {
                const branch = db.branches.find(b => b.id === u.branchId);
                const isOBas = u.username.toUpperCase() === 'O.BAS' || u.isSuperAdmin;
                const isExplicitlyUnmasked = unmaskedUserIds[u.id];
                const shouldMask = maskCredentials && !isExplicitlyUnmasked;

                // Active permission count
                const activePermsCount = u.permissions 
                  ? Object.values(u.permissions).filter(Boolean).length
                  : 0;

                return (
                  <tr key={u.id} className={`hover:bg-slate-50/80 transition ${isOBas ? 'bg-amber-50/30' : ''}`}>
                    {/* Username */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        {isOBas ? (
                          <div className="p-1 bg-amber-500 text-white rounded-lg shadow-xs" title="Süper Admin">
                            <Crown className="w-3.5 h-3.5" />
                          </div>
                        ) : u.role === 'admin' ? (
                          <div className="p-1 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Shield className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="p-1 bg-emerald-50 text-emerald-600 rounded-lg">
                            <Store className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <strong className="font-mono text-slate-900 font-bold text-xs">
                              {shouldMask ? maskString(u.username) : u.username}
                            </strong>
                            <button
                              type="button"
                              onClick={() => toggleUnmaskUser(u.id)}
                              className="text-slate-400 hover:text-indigo-600 p-0.5 rounded cursor-pointer"
                              title={shouldMask ? 'Kullanıcı adını göster' : 'Kullanıcı adını gizle'}
                            >
                              {shouldMask ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            </button>
                          </div>
                          {isOBas && (
                            <span className="block text-[9px] font-black text-amber-700 tracking-wider">
                              EN YETKİLİ ADMİN
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Login Method / Password status */}
                    <td className="p-3.5">
                      {u.role === 'store' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Store className="w-3 h-3 text-emerald-600" />
                          <span>Şifresiz (Şube Seçimi)</span>
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono">
                            <Lock className="w-3 h-3 text-indigo-600" />
                            <span>{shouldMask ? '••••••' : u.password}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleUnmaskUser(u.id)}
                            className="text-slate-400 hover:text-indigo-600 p-0.5 rounded cursor-pointer"
                            title={shouldMask ? 'Şifreyi göster' : 'Şifreyi gizle'}
                          >
                            {shouldMask ? <Lock className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="p-3.5 font-medium text-slate-700">
                      {u.fullName || '-'}
                    </td>

                    <td className="p-3.5">
                      {isOBas ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                          👑 Süper Admin
                        </span>
                      ) : u.role === 'admin' ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          Yönetici / Denetçi
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Mağaza Personeli
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-slate-600">
                      {branch ? (
                        <span className="font-semibold text-slate-800">
                          {branch.name} <span className="font-mono text-[10px] text-slate-400 font-normal">({branch.code})</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Merkez / Tüm Mağazalar</span>
                      )}
                    </td>

                    <td className="p-3.5">
                      {isOBas ? (
                        <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          Tüm İzinler Açık (13/13)
                        </span>
                      ) : u.role === 'admin' ? (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                          {activePermsCount} Yetki Aktif
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          Şube Kör Sayım Yetkisi
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-right space-x-1">
                      <button
                        onClick={() => handleEdit(u)}
                        className="p-1.5 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg transition cursor-pointer"
                        title="Yetkileri Düzenle"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!isOBas && (
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
