import { AppDatabase } from '../types';
import { defaultInitialData } from '../mockData';
import { syncToFirestore, fetchFirestoreData, subscribeToFirestore } from './firebaseService';

const DB_KEY = 'kor_sayim_excel_db_v2';

export function getDatabase(): AppDatabase {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      localStorage.setItem(DB_KEY, JSON.stringify(defaultInitialData));
      syncToFirestore(defaultInitialData).catch(() => {});
      return defaultInitialData;
    }
    const db: AppDatabase = JSON.parse(raw);

    // Purge the 11 legacy sample products if they exist in localStorage
    const sampleBarcodes = new Set([
      "2714808711829", "2714808724089", "2714808724126", "2714808724584", 
      "2714808724799", "2714808724805", "2714808724836", "2714808724843", 
      "2714808725048", "2714808725147", "2714808742212"
    ]);
    if (db.products && Array.isArray(db.products) && db.products.some(p => sampleBarcodes.has(p.barcode))) {
      const sampleIds = new Set(db.products.filter(p => sampleBarcodes.has(p.barcode)).map(p => p.id));
      db.products = db.products.filter(p => !sampleBarcodes.has(p.barcode));
      db.assignments = (db.assignments || []).filter(a => !sampleIds.has(a.productId));
      db.counts = (db.counts || []).filter(c => !sampleIds.has(c.productId));
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    }

    // Ensure O.BAS and T.CESUR super admins exist with passwords and full permissions
    if (db.users && Array.isArray(db.users)) {
      // 1. O.BAS
      const oBasIndex = db.users.findIndex(u => u.username.toLowerCase() === 'o.bas');
      const oBasUser = {
        id: oBasIndex >= 0 ? db.users[oBasIndex].id : 1,
        username: 'O.BAS',
        password: '1864',
        role: 'admin' as const,
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

      if (oBasIndex >= 0) {
        db.users[oBasIndex] = { ...db.users[oBasIndex], ...oBasUser };
      } else {
        db.users.unshift(oBasUser);
      }

      // 2. T.CESUR (Şifre: 9084)
      const tCesurIndex = db.users.findIndex(u => u.username.toLowerCase() === 't.cesur');
      const tCesurUser = {
        id: tCesurIndex >= 0 ? db.users[tCesurIndex].id : 2,
        username: 'T.CESUR',
        password: '9084',
        role: 'admin' as const,
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

      if (tCesurIndex >= 0) {
        db.users[tCesurIndex] = { ...db.users[tCesurIndex], ...tCesurUser };
      } else {
        db.users.splice(1, 0, tCesurUser);
      }
    }

    // Ensure all branches have at least one store user auto-created
    if (db.branches && Array.isArray(db.branches)) {
      if (db.branches.length < 15) {
        db.branches = defaultInitialData.branches;
      }

      db.branches.forEach(b => {
        const hasUser = db.users.some(u => u.branchId === b.id && u.role === 'store');
        if (!hasUser) {
          const maxId = db.users.length ? Math.max(...db.users.map(u => u.id)) + 1 : 10;
          db.users.push({
            id: maxId,
            username: b.code.toLowerCase(),
            password: '',
            role: 'store',
            branchId: b.id,
            fullName: `${b.name} Sorumlusu`,
            isSuperAdmin: false
          });
        }
      });
    }

    // Ensure all official Esme aisles are up to date
    if (!db.aisles || db.aisles.length < 10 || !db.aisles.some(a => a.name.includes('Beyaz Eşya Grubu'))) {
      db.aisles = defaultInitialData.aisles;
    } else {
      const hasAksesuar = db.aisles.some(a => a.name.toLowerCase().includes('aksesuar'));
      if (!hasAksesuar) {
        db.aisles.push({
          id: 35,
          name: "Aksesuar Grubu",
          description: "Kişisel ve mağaza aksesuarları, hediyelik ürünler"
        });
      }
    }

    if (!db.products || !Array.isArray(db.products)) {
      db.products = [];
    }
    if (!db.assignments || !Array.isArray(db.assignments)) {
      db.assignments = [];
    }

    if (db.products && Array.isArray(db.products)) {
      db.products = db.products.map(p => {
        if (p.aisleId === 1 || p.category === 'Yatak & Uyku Grubu') {
          return { ...p, aisleId: 32, category: '32 Baza ve Yatak Grubu' };
        }
        if (!p.category) {
          const aisle = db.aisles?.find(a => a.id === p.aisleId);
          return { ...p, category: aisle ? aisle.name : 'Genel Kategori' };
        }
        return p;
      });
    }
    return db;
  } catch (err) {
    console.error('Failed to read from localStorage', err);
    return defaultInitialData;
  }
}

export function saveDatabase(data: AppDatabase): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event('app_db_updated'));
  } catch (err) {
    console.error('Failed to save to localStorage', err);
  }

  // Real-time sync to Firebase Firestore
  syncToFirestore(data).catch(err => {
    console.error('Firestore sync error:', err);
  });
}

export async function fetchRemoteDatabase(): Promise<AppDatabase | null> {
  try {
    const remoteData = await fetchFirestoreData();
    if (remoteData && Array.isArray(remoteData.branches) && Array.isArray(remoteData.users)) {
      localStorage.setItem(DB_KEY, JSON.stringify(remoteData));
      window.dispatchEvent(new Event('app_db_updated'));
      return remoteData;
    }
    return null;
  } catch {
    return null;
  }
}

export async function batchAssignProductsServer(
  newProducts: any[],
  targetBranchId: string | number,
  isNewCount: boolean = true
): Promise<AppDatabase | null> {
  try {
    const db = getDatabase();
    let updatedProducts = [...db.products];
    let updatedAssignments = [...db.assignments];
    let currentMaxProdId = updatedProducts.length ? Math.max(...updatedProducts.map(p => p.id)) : 0;

    newProducts.forEach((item) => {
      let existing = updatedProducts.find(p => p.barcode === item.barcode);
      let prodId: number;

      if (existing) {
        prodId = existing.id;
        existing.stockCode = item.stockCode || existing.stockCode;
        existing.description = item.description || existing.description;
        existing.color = item.color || existing.color;
        existing.centralStock = item.centralStock ?? existing.centralStock;
        existing.aisleId = item.aisleId || existing.aisleId;
        existing.category = item.category || existing.category;
      } else {
        currentMaxProdId++;
        prodId = currentMaxProdId;
        updatedProducts.push({
          id: prodId,
          barcode: item.barcode,
          stockCode: item.stockCode || `PRD-${item.barcode}`,
          description: item.description,
          color: item.color,
          centralStock: item.centralStock ?? 1,
          aisleId: item.aisleId || 21,
          unit: 'Adet',
          category: item.category || '32 Baza ve Yatak Grubu'
        });
      }

      // Assign to target branches
      if (String(targetBranchId) === 'all') {
        db.branches.forEach(b => {
          if (!updatedAssignments.some(a => Number(a.branchId) === Number(b.id) && Number(a.productId) === prodId)) {
            updatedAssignments.push({ branchId: b.id, productId: prodId });
          }
        });
      } else {
        const bId = Number(targetBranchId);
        if (!updatedAssignments.some(a => Number(a.branchId) === bId && Number(a.productId) === prodId)) {
          updatedAssignments.push({ branchId: bId, productId: prodId });
        }
      }
    });

    const targetBranches = String(targetBranchId) === 'all'
      ? db.branches.map(b => b.id)
      : [Number(targetBranchId)];

    let updatedStatuses = [...(db.branchStatuses || [])];
    targetBranches.forEach(bId => {
      const idx = updatedStatuses.findIndex(s => Number(s.branchId) === Number(bId));
      if (idx >= 0) {
        updatedStatuses[idx] = { ...updatedStatuses[idx], isCompleted: false };
      } else {
        updatedStatuses.push({ branchId: bId, isCompleted: false });
      }
    });

    const newDb: AppDatabase = {
      ...db,
      products: updatedProducts,
      assignments: updatedAssignments,
      branchStatuses: updatedStatuses,
      lastSentAt: new Date().toISOString()
    };

    saveDatabase(newDb);
    return newDb;
  } catch (err) {
    console.error('Failed to batch assign:', err);
    return null;
  }
}

export async function completeBranchCountServer(
  branchId: number,
  counterName: string,
  totalQty: number,
  distinctItems: number
): Promise<AppDatabase | null> {
  try {
    const db = getDatabase();
    let statuses = [...(db.branchStatuses || [])];
    const idx = statuses.findIndex(s => Number(s.branchId) === Number(branchId));
    const rec = {
      branchId: Number(branchId),
      isCompleted: true,
      completedAt: new Date().toLocaleString('tr-TR'),
      completedBy: counterName,
      totalQty,
      distinctItems,
      batchId: db.currentBatchId || 'batch_initial'
    };

    if (idx >= 0) statuses[idx] = rec;
    else statuses.push(rec);

    const newDb: AppDatabase = {
      ...db,
      branchStatuses: statuses
    };

    saveDatabase(newDb);
    return newDb;
  } catch (err) {
    console.error('Failed to complete count:', err);
    return null;
  }
}

export async function reopenBranchCountServer(branchId: number): Promise<AppDatabase | null> {
  try {
    const db = getDatabase();
    let statuses = [...(db.branchStatuses || [])];
    const idx = statuses.findIndex(s => Number(s.branchId) === Number(branchId));
    if (idx >= 0) {
      statuses[idx] = { ...statuses[idx], isCompleted: false };
    }

    const newDb: AppDatabase = {
      ...db,
      branchStatuses: statuses
    };

    saveDatabase(newDb);
    return newDb;
  } catch (err) {
    console.error('Failed to reopen count:', err);
    return null;
  }
}

export async function saveCountServer(
  branchId: number,
  productId: number,
  quantity: number,
  counterName?: string,
  notes?: string
): Promise<AppDatabase | null> {
  try {
    const db = getDatabase();
    const bId = Number(branchId);
    const pId = Number(productId);
    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    let updatedCounts = [...db.counts];
    const existingIdx = updatedCounts.findIndex(c => Number(c.branchId) === bId && Number(c.productId) === pId);

    if (existingIdx >= 0) {
      if (quantity <= 0) {
        updatedCounts = updatedCounts.filter((_, i) => i !== existingIdx);
      } else {
        updatedCounts[existingIdx] = {
          ...updatedCounts[existingIdx],
          quantity,
          countedAt: dateStr,
          counterName: counterName || updatedCounts[existingIdx].counterName || 'Şube Personeli',
          notes: notes !== undefined ? notes : updatedCounts[existingIdx].notes
        };
      }
    } else if (quantity > 0) {
      const newId = updatedCounts.length ? Math.max(...updatedCounts.map(c => c.id)) + 1 : 1;
      updatedCounts.push({
        id: newId,
        branchId: bId,
        productId: pId,
        quantity,
        countedAt: dateStr,
        counterName: counterName || 'Şube Personeli',
        notes: notes || ''
      });
    }

    const newDb: AppDatabase = {
      ...db,
      counts: updatedCounts
    };

    saveDatabase(newDb);
    return newDb;
  } catch (err) {
    return null;
  }
}

export async function deleteProductServer(productId: number): Promise<AppDatabase | null> {
  try {
    const db = getDatabase();
    const pId = Number(productId);
    const newDb: AppDatabase = {
      ...db,
      products: db.products.filter(p => Number(p.id) !== pId),
      assignments: db.assignments.filter(a => Number(a.productId) !== pId),
      counts: db.counts.filter(c => Number(c.productId) !== pId)
    };

    saveDatabase(newDb);
    return newDb;
  } catch (err) {
    return null;
  }
}

export async function clearAllProductsServer(): Promise<AppDatabase | null> {
  try {
    const db = getDatabase();
    const newDb: AppDatabase = {
      ...db,
      products: [],
      assignments: [],
      counts: [],
      branchStatuses: []
    };

    saveDatabase(newDb);
    return newDb;
  } catch (err) {
    return null;
  }
}

export function resetDatabaseToDefault(): AppDatabase {
  saveDatabase(defaultInitialData);
  return defaultInitialData;
}

export { subscribeToFirestore };
