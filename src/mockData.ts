import { AppDatabase, Branch, User, Product, Aisle } from './types';

export const officialEsmeBranches: Branch[] = [
  { id: 1, code: "002", name: "Sarıyer 2 Mağaza", city: "İstanbul" },
  { id: 2, code: "004", name: "Okmeydanı Mağaza", city: "İstanbul" },
  { id: 3, code: "006", name: "Çağlayan Mağaza", city: "İstanbul" },
  { id: 4, code: "007", name: "Samsun Mağaza", city: "Samsun" },
  { id: 5, code: "008", name: "Çorum Mağaza", city: "Çorum" },
  { id: 6, code: "009", name: "Tokat Mağaza", city: "Tokat" },
  { id: 7, code: "010", name: "Turhal Mağaza", city: "Tokat" },
  { id: 8, code: "011", name: "Kastamonu Mağaza", city: "Kastamonu" },
  { id: 9, code: "012", name: "Amasya Mağaza", city: "Amasya" },
  { id: 10, code: "013", name: "Güneşli Mağaza", city: "İstanbul" },
  { id: 11, code: "014", name: "Bafra 1 Mağaza", city: "Samsun" },
  { id: 12, code: "015", name: "Merzifon Mağaza", city: "Amasya" },
  { id: 13, code: "016", name: "Erbaa Mağaza", city: "Tokat" },
  { id: 14, code: "017", name: "Çekmeköy Mağaza", city: "İstanbul" },
  { id: 15, code: "018", name: "Kurtköy Mağaza", city: "İstanbul" },
  { id: 16, code: "019", name: "Fatsa Mağaza", city: "Ordu" },
  { id: 17, code: "020", name: "Beşyüzevler Mağaza", city: "İstanbul" },
  { id: 18, code: "021", name: "Sivas Mağaza", city: "Sivas" },
  { id: 19, code: "022", name: "Bafra 2 Mağaza", city: "Samsun" },
  { id: 20, code: "023", name: "Ordu Mağaza", city: "Ordu" },
  { id: 21, code: "024", name: "Ünye Mağaza", city: "Ordu" },
  { id: 22, code: "025", name: "Antalya Mağaza", city: "Antalya" },
  { id: 23, code: "026", name: "Antalya Serik Mağaza", city: "Antalya" },
  { id: 24, code: "027", name: "Antalya Doğu Garajı Mağaza", city: "Antalya" },
  { id: 25, code: "028", name: "Edirne Mağaza", city: "Edirne" },
  { id: 26, code: "029", name: "Kırklareli Mağaza", city: "Kırklareli" },
  { id: 27, code: "031", name: "Sorgun Mağaza", city: "Yozgat" },
  { id: 28, code: "032", name: "Düzce Mağaza", city: "Düzce" },
  { id: 29, code: "033", name: "Kastamonu 2 Mağaza", city: "Kastamonu" },
  { id: 30, code: "034", name: "Kayseri Mağaza", city: "Kayseri" },
  { id: 31, code: "035", name: "Antalya Kepez", city: "Antalya" },
  { id: 32, code: "036", name: "Babaeski Mağaza", city: "Kırklareli" },
  { id: 33, code: "F00", name: "Fatura Mağaza", city: "Merkez" },
  { id: 34, code: "M00", name: "Merzifon Merkez Depo", city: "Amasya" },
  { id: 35, code: "S00", name: "Samsun Merkez Depo", city: "Samsun" }
];

export const defaultAisles: Aisle[] = [
  { id: 21, name: "21 Beyaz Eşya Grubu", description: "Buzdolabı, çamaşır, bulaşık makineleri ve dondurucular" },
  { id: 22, name: "22 Elektronik Grubu", description: "Televizyon, ses ve ev elektroniği sistemleri" },
  { id: 23, name: "23 Bilgisayar-Tablet Grubu", description: "Dizüstü, masaüstü bilgisayarlar, tablet ve çevre birimleri" },
  { id: 24, name: "24 Cep Telefonu Grubu", description: "Akıllı telefonlar, aksesuarlar ve iletişim cihazları" },
  { id: 25, name: "25 Küçük Ev Aletleri Grubu", description: "Süpürge, ütü, mutfak robotu ve elektrikli ev aletleri" },
  { id: 26, name: "26 Altın ve Kol Saati Grubu", description: "Altın takı, ziynet eşyaları ve erkek / kadın kol saatleri" },
  { id: 27, name: "27 Ev Tekstili Grubu", description: "Nevresim takımları, yorgan, yastık, perde ve havlu çeşitleri" },
  { id: 28, name: "28 Züccaciye ve Mutfak Grubu", description: "Tencere setleri, yemek takımları, cam ve porselen mutfak gereçleri" },
  { id: 29, name: "29 Isıtıcı-Soğutucu Grubu", description: "Klimalar, vantilatörler ve elektrikli ısıtıcılar" },
  { id: 30, name: "30 Mobilya Ahşap Grubu (Panel)", description: "Yatak odası, yemek odası, gardırop ve panel ahşap mobilyalar" },
  { id: 31, name: "31 Mobilya Koltuk Grubu", description: "Oturma grupları, koltuk takımları ve salon mobilyaları" },
  { id: 32, name: "32 Baza ve Yatak Grubu", description: "Baza, ortopedik yatak, başlık ve uyku sistemleri" },
  { id: 33, name: "33 Halı Grubu", description: "Salon halıları, yolluk ve kilim çeşitleri" },
  { id: 34, name: "34 Çocuk Eğlence / Spor / Bisiklet / Motosiklet Grubu", description: "Çocuk oyuncakları, bisikletler, motosikletler ve spor aletleri" },
  { id: 35, name: "Aksesuar Grubu", description: "Kişisel ve mağaza aksesuarları, hediyelik ürünler" }
];

// Generate store staff users for all branches automatically
const initialStoreUsers: User[] = officialEsmeBranches.map((b, index) => ({
  id: 10 + index,
  username: b.code.toLowerCase(),
  password: '',
  role: 'store' as const,
  branchId: b.id,
  fullName: `${b.name} Sorumlusu`,
  isSuperAdmin: false
}));

const superAdminUser: User = {
  id: 1,
  username: "O.BAS",
  password: "1864",
  role: "admin",
  isSuperAdmin: true,
  branchId: null,
  fullName: "O.BAS (Genel Yönetici / En Yetkili Admin)",
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

const adminUserTCesur: User = {
  id: 2,
  username: "T.CESUR",
  password: "9084",
  role: "admin",
  isSuperAdmin: true,
  branchId: null,
  fullName: "T.CESUR (Genel Yönetici / Admin)",
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

const initialSampleProducts: Product[] = [];

// Initial assignments (empty - starts clean)
const initialAssignments: { branchId: number; productId: number }[] = [];

export const defaultInitialData: AppDatabase = {
  branches: officialEsmeBranches,
  aisles: defaultAisles,
  users: [superAdminUser, adminUserTCesur, ...initialStoreUsers],
  products: [],
  assignments: [],
  counts: [],
  evaluations: []
};
