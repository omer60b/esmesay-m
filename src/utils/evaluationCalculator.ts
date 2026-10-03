import { AppDatabase, Branch } from '../types';

export interface BranchAutoEvaluation {
  branchId: number;
  branchName: string;
  branchCode: string;
  totalAssigned: number;
  totalCountedItems: number;
  completenessRate: number; // 0 - 100%
  exactMatches: number;
  shortageCount: number;
  surplusCount: number;
  totalExpectedStock: number;
  totalCountedStock: number;
  netDiff: number;
  absDiffTotal: number;
  exactMatchRate: number; // 0 - 100%
  stockAccuracyRate: number; // 0 - 100%
  performanceScore: number; // 0 - 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  gradeTitle: string;
  statusColor: 'emerald' | 'indigo' | 'amber' | 'rose';
  systemFeedback: string;
  lastCountTime?: string;
  isCompleted: boolean;
}

/**
 * Calculates store success and performance evaluation automatically based on count accuracy
 */
export function calculateBranchAutoEvaluation(
  branch: Branch,
  db: AppDatabase
): BranchAutoEvaluation {
  // 1. Assigned products for this branch
  const assignedIds = db.assignments
    .filter(a => a.branchId === branch.id)
    .map(a => a.productId);

  const totalAssigned = assignedIds.length;

  // 2. Counts recorded for this branch
  const branchCounts = db.counts.filter(c => c.branchId === branch.id);
  const totalCountedItems = branchCounts.filter(c => c.quantity > 0).length;

  let exactMatches = 0;
  let shortageCount = 0;
  let surplusCount = 0;
  let totalExpectedStock = 0;
  let totalCountedStock = 0;
  let netDiff = 0;
  let absDiffTotal = 0;
  let latestTime = '';

  assignedIds.forEach(pId => {
    const prod = db.products.find(p => p.id === pId);
    if (!prod) return;

    const countRec = branchCounts.find(c => c.productId === pId);
    const countedQty = countRec ? countRec.quantity : 0;
    const diff = countedQty - prod.centralStock;
    const absDiff = Math.abs(diff);

    totalExpectedStock += prod.centralStock;
    totalCountedStock += countedQty;
    netDiff += diff;
    absDiffTotal += absDiff;

    if (countRec) {
      if (countRec.countedAt && (!latestTime || countRec.countedAt > latestTime)) {
        latestTime = countRec.countedAt;
      }
      if (diff === 0) {
        exactMatches++;
      } else if (diff < 0) {
        shortageCount++;
      } else {
        surplusCount++;
      }
    }
  });

  // Rates
  const completenessRate = totalAssigned > 0
    ? Math.min(100, Math.round((totalCountedItems / totalAssigned) * 100))
    : 100;

  const countedForMatch = exactMatches + shortageCount + surplusCount;
  const exactMatchRate = countedForMatch > 0
    ? Math.round((exactMatches / countedForMatch) * 100)
    : 0;

  const stockAccuracyRate = totalExpectedStock > 0
    ? Math.max(0, 100 - Math.round((absDiffTotal / totalExpectedStock) * 100))
    : 100;

  // Weighted Performance Score Calculation
  // 45% Exact Match Ratio + 35% Stock Absolute Accuracy + 20% Completeness Rate
  let performanceScore = 0;
  if (totalAssigned > 0) {
    if (countedForMatch === 0) {
      performanceScore = 0;
    } else {
      performanceScore = Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (exactMatchRate * 0.45) +
            (stockAccuracyRate * 0.35) +
            (completenessRate * 0.20)
          )
        )
      );
    }
  } else {
    performanceScore = 100;
  }

  // Grade & Grade Title Determination
  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' = 'D';
  let gradeTitle = 'Kritik Düzey / Yeniden Sayım Gerekli';
  let statusColor: 'emerald' | 'indigo' | 'amber' | 'rose' = 'rose';

  if (performanceScore >= 95) {
    grade = 'A+';
    gradeTitle = 'Kusursuz / Mükemmel Doğruluk';
    statusColor = 'emerald';
  } else if (performanceScore >= 85) {
    grade = 'A';
    gradeTitle = 'Yüksek Başarı / Güvenilir Sayım';
    statusColor = 'indigo';
  } else if (performanceScore >= 70) {
    grade = 'B';
    gradeTitle = 'Kabul Edilebilir / Küçük Sapmalar';
    statusColor = 'amber';
  } else if (performanceScore >= 50) {
    grade = 'C';
    gradeTitle = 'Geliştirilmeli / Önemli Farklar Mevcut';
    statusColor = 'amber';
  } else {
    grade = 'D';
    gradeTitle = 'Kritik / Sayım Yenilenmeli';
    statusColor = 'rose';
  }

  // Automatic Intelligent System Feedback Generation
  let systemFeedback = '';
  if (totalCountedItems === 0) {
    systemFeedback = '⏳ Henüz sayım başlatılmamıştır. Mağaza personeli kör sayıma başladığında performans skoru sistem tarafından otomatik hesaplanacaktır.';
  } else if (shortageCount === 0 && surplusCount === 0 && completenessRate === 100) {
    systemFeedback = `🏆 Kusursuz Mutabakat: Atanan tüm ${totalAssigned} kalem üründe %100 tam eşleşme sağlanmıştır. Kayıp, fire veya fazla stok bulunmamaktadır. Merkez stokları ile tam mutabakat onaylandı.`;
  } else if (performanceScore >= 90) {
    systemFeedback = `🌟 Yüksek Doğruluk Oranı: Şube kör sayımında %${exactMatchRate} tam eşleşme ve %${stockAccuracyRate} genel stok doğruluğu sağlanmıştır. ${exactMatches} kalem ürün merkez stoklarıyla birebir eşleşmiştir.`;
  } else if (shortageCount > surplusCount) {
    systemFeedback = `⚠️ Eksik Stok (Kayıp/Fire) Riski: Sayımda ${shortageCount} kalem üründe toplam ${Math.abs(netDiff)} adet noksanlık tespit edilmiştir. Şube depoları, teşhir reyonları ve son irsaliyeler fiziki olarak denetlenmelidir.`;
  } else if (surplusCount > shortageCount) {
    systemFeedback = `📦 Fazla Stok Tespiti: Sayımda ${surplusCount} kalem üründe merkez kaydından +${netDiff} adet fazla sayılmıştır. Merkez sevkiyat irsaliyeleri veya ters barkod okuma şüphesi incelenmelidir.`;
  } else {
    systemFeedback = `🔍 Karma Sapma Analizi: ${exactMatches} tam eşleşen, ${shortageCount} eksik ve ${surplusCount} fazla kalem mevcuttur. Genel doğruluk puanı ${performanceScore}/100 olarak hesaplanmıştır.`;
  }

  if (completenessRate < 100 && totalCountedItems > 0) {
    systemFeedback += ` (Not: Atanan ürünlerin %${completenessRate}'i sayılmıştır; kalan ${totalAssigned - totalCountedItems} kalem ürünün sayımı beklenmektedir.)`;
  }

  return {
    branchId: branch.id,
    branchName: branch.name,
    branchCode: branch.code,
    totalAssigned,
    totalCountedItems,
    completenessRate,
    exactMatches,
    shortageCount,
    surplusCount,
    totalExpectedStock,
    totalCountedStock,
    netDiff,
    absDiffTotal,
    exactMatchRate,
    stockAccuracyRate,
    performanceScore,
    grade,
    gradeTitle,
    statusColor,
    systemFeedback,
    lastCountTime: latestTime,
    isCompleted: completenessRate === 100 && totalCountedItems > 0
  };
}

/**
 * Calculates evaluations for all branches across the system
 */
export function calculateAllBranchesAutoEvaluations(db: AppDatabase): BranchAutoEvaluation[] {
  return db.branches.map(b => calculateBranchAutoEvaluation(b, db));
}
