import React, { useState, useEffect } from 'react';
import { User, AppDatabase } from './types';
import { getDatabase, saveDatabase, resetDatabaseToDefault, fetchRemoteDatabase, subscribeToFirestore } from './services/storage';
import { LoginScreen } from './components/LoginScreen';
import { AdminHeader, AdminTab } from './components/AdminHeader';
import { BranchesTab } from './components/BranchesTab';
import { AislesTab } from './components/AislesTab';
import { UsersTab } from './components/UsersTab';
import { ProductsTab } from './components/ProductsTab';
import { CountHistoryTab } from './components/CountHistoryTab';
import { ReportsTab } from './components/ReportsTab';
import { EvaluationsTab } from './components/EvaluationsTab';
import { StorePanel } from './components/StorePanel';

const USER_SESSION_KEY = 'kor_sayim_active_user_session';

export default function App() {
  const [db, setDb] = useState<AppDatabase>(() => getDatabase());
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(USER_SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [currentAdminTab, setCurrentAdminTab] = useState<AdminTab>('reports');

  // Real-time Firestore synchronization for cross-device, mobile & multi-browser instant updates
  useEffect(() => {
    let isMounted = true;

    // Initial sync
    fetchRemoteDatabase().then(remote => {
      if (remote && isMounted) {
        setDb(remote);
      }
    }).catch(() => {});

    // Real-time Firestore listener (< 50ms sync across devices)
    const unsubscribe = subscribeToFirestore((remoteData) => {
      if (isMounted && remoteData) {
        setDb(remoteData);
        try {
          localStorage.setItem('kor_sayim_excel_db_v2', JSON.stringify(remoteData));
        } catch {}
      }
    });

    const handleLocalDbUpdated = () => {
      setDb(getDatabase());
    };
    window.addEventListener('app_db_updated', handleLocalDbUpdated);

    return () => {
      isMounted = false;
      unsubscribe();
      window.removeEventListener('app_db_updated', handleLocalDbUpdated);
    };
  }, []);

  // Sync DB changes to localStorage and server
  const handleUpdateDb = (updater: (prev: AppDatabase) => AppDatabase) => {
    setDb(prev => {
      const updated = updater(prev);
      saveDatabase(updated);
      return updated;
    });
  };

  // Login handler
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(USER_SESSION_KEY);
    } catch (e) {
      console.error(e);
    }
  };

  // Reset Demo Data
  const handleResetData = () => {
    const conf = window.confirm(
      'Tüm veritabanını fabrika varsayılan örnek verilerine sıfırlamak istediğinize emin misiniz?'
    );
    if (!conf) return;

    const fresh = resetDatabaseToDefault();
    setDb(fresh);
    alert('Veritabanı örnek verilerle başarıyla sıfırlandı.');
  };

  // If not logged in, show Login Screen
  if (!currentUser) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        users={db.users}
        branches={db.branches}
      />
    );
  }

  // If Store User, show Store Panel
  if (currentUser.role === 'store') {
    return (
      <StorePanel
        user={currentUser}
        db={db}
        onUpdateDb={handleUpdateDb}
        onLogout={handleLogout}
      />
    );
  }

  // If Admin User, show Admin Management Console
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased">
      {/* Admin Header with Navigation */}
      <AdminHeader
        currentTab={currentAdminTab}
        onTabChange={setCurrentAdminTab}
        onLogout={handleLogout}
        username={currentUser.username}
        currentUser={currentUser}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {currentAdminTab === 'branches' && (
          <BranchesTab db={db} onUpdateDb={handleUpdateDb} />
        )}

        {currentAdminTab === 'aisles' && (
          <AislesTab db={db} onUpdateDb={handleUpdateDb} />
        )}

        {currentAdminTab === 'users' && (
          <UsersTab db={db} onUpdateDb={handleUpdateDb} currentUser={currentUser} />
        )}

        {currentAdminTab === 'products' && (
          <ProductsTab db={db} onUpdateDb={handleUpdateDb} />
        )}

        {currentAdminTab === 'history' && (
          <CountHistoryTab db={db} onUpdateDb={handleUpdateDb} currentUser={currentUser} />
        )}

        {currentAdminTab === 'reports' && (
          <ReportsTab db={db} onUpdateDb={handleUpdateDb} />
        )}

        {currentAdminTab === 'evaluations' && (
          <EvaluationsTab
            db={db}
            onUpdateDb={handleUpdateDb}
            adminUsername={currentUser.fullName || currentUser.username}
            currentUser={currentUser}
          />
        )}
      </main>
    </div>
  );
}
