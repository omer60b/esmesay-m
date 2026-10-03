import React, { useState, useEffect } from 'react';
import { User, Branch } from '../types';
import { EsmeLogo } from './EsmeLogo';
import { 
  Lock, 
  User as UserIcon, 
  ArrowRight, 
  ShieldCheck,
  Eye,
  EyeOff,
  Store,
  Smartphone,
  CheckCircle2,
  ChevronDown,
  Building2,
  Sparkles,
  MapPin,
  KeyRound
} from 'lucide-react';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  users: User[];
  branches: Branch[];
}

const REMEMBERED_BRANCH_KEY = 'kor_sayim_remembered_branch_id';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, users, branches }) => {
  // Login Mode: 'store' (Default: password-free branch selection for mobile/branch PCs) or 'admin'
  const [loginMode, setLoginMode] = useState<'store' | 'admin'>('store');

  // Store Login State
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>(() => {
    try {
      const saved = localStorage.getItem(REMEMBERED_BRANCH_KEY);
      if (saved) {
        const id = Number(saved);
        if (branches.some(b => b.id === id)) return id;
      }
    } catch {}
    return branches.length > 0 ? branches[0].id : '';
  });

  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [storeErrorMessage, setStoreErrorMessage] = useState('');

  // Admin Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminErrorMessage, setAdminErrorMessage] = useState('');

  // Find currently selected branch
  const currentBranch = branches.find(b => b.id === Number(selectedBranchId));

  // Find all store users for the selected branch
  const branchUsers = currentBranch 
    ? users.filter(u => u.branchId === currentBranch.id && u.role === 'store')
    : [];

  // Update selectedUserId when branch changes
  useEffect(() => {
    if (branchUsers.length > 0) {
      // Pick first user if not already set or not in list
      if (!selectedUserId || !branchUsers.some(u => u.id === selectedUserId)) {
        setSelectedUserId(branchUsers[0].id);
      }
    } else {
      setSelectedUserId('');
    }
  }, [selectedBranchId, branchUsers.length]);

  // Handle password-free Store Login by Branch selection
  const handleStoreLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setStoreErrorMessage('');

    if (!currentBranch) {
      setStoreErrorMessage('Lütfen giriş yapmak istediğiniz şubeyi seçiniz.');
      return;
    }

    // Save remembered branch on this device/browser
    try {
      localStorage.setItem(REMEMBERED_BRANCH_KEY, String(currentBranch.id));
    } catch {}

    // 1. If an opened user exists for this branch, use that user
    let userToLogin: User | undefined;
    if (selectedUserId) {
      userToLogin = branchUsers.find(u => u.id === Number(selectedUserId));
    }

    if (!userToLogin && branchUsers.length > 0) {
      userToLogin = branchUsers[0];
    }

    // 2. If no explicit user exists yet in users array, generate an automatic store session for this branch
    if (!userToLogin) {
      userToLogin = {
        id: 9000 + currentBranch.id,
        username: currentBranch.code ? currentBranch.code.toLowerCase() : `sube_${currentBranch.id}`,
        password: '',
        role: 'store',
        branchId: currentBranch.id,
        fullName: `${currentBranch.name} Sayım Sorumlusu`,
        isSuperAdmin: false
      };
    }

    onLogin(userToLogin);
  };

  // Handle Admin Login with Username and Password
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminErrorMessage('');

    const rawUser = username.trim();
    const rawPass = password.trim();

    if (!rawUser || !rawPass) {
      setAdminErrorMessage('Lütfen yönetici kullanıcı adı ve şifrenizi giriniz.');
      return;
    }

    // Comprehensive normalizer supporting Turkish characters and case-insensitivity
    const normalize = (s: string) =>
      (s || '')
        .trim()
        .replace(/İ/g, 'I')
        .replace(/ı/g, 'i')
        .replace(/I/g, 'i')
        .toLowerCase();

    const normalizedInput = normalize(rawUser);

    // 1. Search in users database (flexible comparison)
    let matchedUser = users.find(u => {
      const normU = normalize(u.username);
      if (normU !== normalizedInput) return false;
      // Password match: compare trimmed passwords
      return (u.password || '').trim() === rawPass;
    });

    // 2. Guaranteed fallback for official super admins (O.BAS: 1864, T.CESUR: 9084)
    if (!matchedUser) {
      if ((normalizedInput === normalize('O.BAS') || normalizedInput === 'obas' || normalizedInput === 'o.bas') && rawPass === '1864') {
        matchedUser = {
          id: 1,
          username: 'O.BAS',
          password: '1864',
          role: 'admin',
          isSuperAdmin: true,
          branchId: null,
          fullName: 'O.BAS (Genel Yönetici / En Yetkili Admin)',
          permissions: {
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
          }
        };
      } else if ((normalizedInput === normalize('T.CESUR') || normalizedInput === 'tcesur' || normalizedInput === 't.cesur') && rawPass === '9084') {
        matchedUser = {
          id: 2,
          username: 'T.CESUR',
          password: '9084',
          role: 'admin',
          isSuperAdmin: true,
          branchId: null,
          fullName: 'T.CESUR (Genel Yönetici / Admin)',
          permissions: {
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
          }
        };
      }
    }

    if (!matchedUser) {
      setAdminErrorMessage('Geçersiz kullanıcı adı veya şifre! (Yetkili Yöneticiler: O.BAS / T.CESUR)');
      return;
    }

    if (matchedUser.role !== 'admin' && !matchedUser.isSuperAdmin) {
      setAdminErrorMessage(
        'Bu hesap bir şube kullanıcısıdır. Lütfen "Şube Hızlı Girişi" sekmesinden şubenizi seçerek şifresiz giriş yapınız.'
      );
      return;
    }

    onLogin(matchedUser);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Corporate Login Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative z-10 animate-fadeIn">
        {/* Header Branding with Official Logo */}
        <div className="p-6 pb-5 text-center bg-slate-50 border-b border-slate-100 flex flex-col items-center">
          <div className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-xs mb-3 flex items-center justify-center max-w-[260px]">
            <EsmeLogo size="lg" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Esme Sayım Paneli
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kurumsal Stok & Kör Sayım Yönetim Sistemi
          </p>
        </div>

        {/* Tab Selector: Store vs Admin */}
        <div className="p-3 bg-slate-100/90 border-b border-slate-200">
          <div className="grid grid-cols-2 gap-2 bg-slate-200/80 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setLoginMode('store')}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                loginMode === 'store'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Store className="w-4 h-4 text-emerald-600" />
              <span>Şube Girişi</span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 rounded-md font-semibold">
                Şifresiz
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLoginMode('admin')}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                loginMode === 'admin'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <KeyRound className="w-4 h-4 text-indigo-600" />
              <span>Yönetici Girişi</span>
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 sm:p-7 space-y-5">
          {/* TAB 1: STORE / BRANCH QUICK LOGIN (NO USERNAME / NO PASSWORD) */}
          {loginMode === 'store' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Device / Mobile Convenience Notice */}
              <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900">
                <Smartphone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-800">Şifresiz Hızlı Giriş Aktif</p>
                  <p className="text-emerald-700 text-[11px] mt-0.5">
                    Telefon veya mağaza bilgisayarınızdan kullanıcı adı ve şifre girmeden, sadece şubenizi seçerek sayıma başlayabilirsiniz.
                  </p>
                </div>
              </div>

              {storeErrorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl font-medium animate-fadeIn">
                  {storeErrorMessage}
                </div>
              )}

              <form onSubmit={handleStoreLogin} className="space-y-4">
                {/* Branch Selection Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Çalıştığınız Şubeyi Seçiniz</span>
                    </span>
                    <span className="text-[11px] font-normal text-slate-400">
                      {branches.length} Şube Aktif
                    </span>
                  </label>

                  <div className="relative">
                    <select
                      value={selectedBranchId}
                      onChange={e => setSelectedBranchId(Number(e.target.value))}
                      className="w-full pl-4 pr-10 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 rounded-2xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100 transition appearance-none cursor-pointer"
                    >
                      {branches.length === 0 ? (
                        <option value="">Kayıtlı şube bulunamadı</option>
                      ) : (
                        branches.map(branch => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name} {branch.code ? `(${branch.code})` : ''} {branch.city ? `• ${branch.city}` : ''}
                          </option>
                        ))
                      )}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Branch Staff / User Info or Selection if multiple users */}
                {currentBranch && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Seçili Şube:</span>
                      </span>
                      <span className="font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                        {currentBranch.name}
                      </span>
                    </div>

                    {/* If multiple users exist for this branch, let them pick their account */}
                    {branchUsers.length > 1 ? (
                      <div className="pt-2 border-t border-slate-200/70">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                          <UserIcon className="w-3 h-3 text-slate-400" />
                          <span>Görevli Personel Seçimi</span>
                        </label>
                        <select
                          value={selectedUserId}
                          onChange={e => setSelectedUserId(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                          {branchUsers.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.fullName || u.username} ({u.username})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : branchUsers.length === 1 ? (
                      <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs">
                        <span className="text-slate-500 flex items-center gap-1">
                          <UserIcon className="w-3 h-3 text-slate-400" />
                          <span>Yetkili Personel:</span>
                        </span>
                        <span className="font-semibold text-indigo-700">
                          {branchUsers[0].fullName || branchUsers[0].username}
                        </span>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-200/70 text-[11px] text-slate-500">
                        Bu şube için genel mağaza sayım oturumu açılacaktır.
                      </div>
                    )}
                  </div>
                )}

                {/* Instant Action Submit Button */}
                <button
                  type="submit"
                  disabled={!currentBranch}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm sm:text-base rounded-2xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Store className="w-5 h-5" />
                  <span>
                    {currentBranch ? `${currentBranch.name} Olarak Giriş Yap` : 'Şube Seçiniz'}
                  </span>
                  <ArrowRight className="w-5 h-5 ml-1" />
                </button>
              </form>

              <div className="pt-2 text-center">
                <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Kullanıcı adı ve şifreye gerek olmadan anında sayıma geçilir</span>
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: ADMIN MANAGEMENT LOGIN (WITH CREDENTIALS) */}
          {loginMode === 'admin' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 bg-indigo-50 border border-indigo-200/80 rounded-2xl text-xs text-indigo-900">
                <p className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Merkez & Yönetici Konsolu</span>
                </p>
                <p className="text-indigo-700 text-[11px] mt-0.5">
                  Şube ayarları, ürün yükleme, yetkilendirme ve raporlama ekranlarına erişmek için yönetici şifrenizle giriş yapınız.
                </p>
              </div>

              {adminErrorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl font-medium animate-fadeIn">
                  {adminErrorMessage}
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Yönetici Kullanıcı Adı</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Yönetici kullanıcı adınızı giriniz"
                    autoComplete="username"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Yönetici Şifresi</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••"
                      autoComplete="current-password"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition font-medium pr-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
                      title={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  <span>Yönetici Girişi Yap</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* Footer Security Badge */}
          <div className="pt-3 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Esme Kurumsal Kör Sayım Altyapısı</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
