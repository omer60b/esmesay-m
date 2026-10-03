import * as XLSX from 'xlsx';
import { AppDatabase } from '../types';

export function downloadSampleExcelTemplate() {
  const sampleData = [
    {
      'Barkod': '2714808711829',
      'Ürün Kodu': '126-001-088',
      'Ürün Adı': 'Esme Sleep Serenity Tavşan Tüyü 100x200 Yatak',
      'Renk Adı': '',
      'Envanter Miktarı': 1
    },
    {
      'Barkod': '2714808724089',
      'Ürün Kodu': '126-001-001',
      'Ürün Adı': 'Esme Sleep Special Ultra Ortapedik 90*190 Yatak',
      'Renk Adı': '',
      'Envanter Miktarı': 3
    },
    {
      'Barkod': '2714808724126',
      'Ürün Kodu': '126-001-005',
      'Ürün Adı': 'Esme Sleep Aysan Pamuk Yatak 90*190',
      'Renk Adı': '',
      'Envanter Miktarı': 1
    },
    {
      'Barkod': '2714808724584',
      'Ürün Kodu': '126-001-052',
      'Ürün Adı': 'Esme Sleep Style Yatak 90*190',
      'Renk Adı': 'Gri',
      'Envanter Miktarı': 2
    },
    {
      'Barkod': '2714808724799',
      'Ürün Kodu': '126-001-066',
      'Ürün Adı': 'Esme Sleep Therapy Yatak 90*190',
      'Renk Adı': 'Krem',
      'Envanter Miktarı': 3
    },
    {
      'Barkod': '2714808724805',
      'Ürün Kodu': '126-001-067',
      'Ürün Adı': 'Esme Sleep Therapy Yatak 100*200',
      'Renk Adı': 'Krem',
      'Envanter Miktarı': 1
    },
    {
      'Barkod': '2714808724836',
      'Ürün Kodu': '126-001-070',
      'Ürün Adı': 'Esme Sleep Therapy Yatak 150*200',
      'Renk Adı': 'Krem',
      'Envanter Miktarı': 1
    },
    {
      'Barkod': '2714808724843',
      'Ürün Kodu': '126-001-071',
      'Ürün Adı': 'Esme Sleep Therapy Yatak 160*200',
      'Renk Adı': 'Krem',
      'Envanter Miktarı': 5
    },
    {
      'Barkod': '2714808725048',
      'Ürün Kodu': '126-001-091',
      'Ürün Adı': 'Esme Sleep Serenity Tavsantuyu 150*200 Yatak',
      'Renk Adı': '',
      'Envanter Miktarı': 1
    },
    {
      'Barkod': '2714808725147',
      'Ürün Kodu': '126-001-101',
      'Ürün Adı': 'Esme Sleep Caprice 90*190 Yatak',
      'Renk Adı': '',
      'Envanter Miktarı': 3
    },
    {
      'Barkod': '2714808742212',
      'Ürün Kodu': '320104SVG002',
      'Ürün Adı': 'Esme Sleep Essence Pedli Pocket Yatak 150*200',
      'Renk Adı': '',
      'Envanter Miktarı': 1
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ürün Listesi');
  XLSX.writeFile(wb, 'Esme_Urun_Yukleme_Sablonu.xlsx');
}

export function exportComparisonReportExcel(
  db: AppDatabase,
  selectedBranchId: string | number,
  selectedStatus: string
) {
  let counts = db.counts;
  if (selectedBranchId !== 'all') {
    counts = counts.filter(c => c.branchId === Number(selectedBranchId));
  }

  const rows: any[] = [];

  counts.forEach((c) => {
    const branch = db.branches.find(b => b.id === c.branchId) || { name: 'Bilinmiyor', code: '-' };
    const prod = db.products.find(p => p.id === c.productId) || {
      description: 'Bilinmeyen Ürün',
      barcode: '-',
      stockCode: '-',
      centralStock: 0,
      aisleId: 0
    };
    const aisle = db.aisles.find(a => a.id === prod.aisleId) || { name: 'Genel' };
    const diff = c.quantity - prod.centralStock;

    let status = 'Tam Eşleşme';
    if (diff < 0) status = `Eksik (${diff})`;
    else if (diff > 0) status = `Fazla (+${diff})`;

    if (selectedStatus === 'exact' && diff !== 0) return;
    if (selectedStatus === 'diff' && diff === 0) return;

    rows.push({
      'Mağaza Adı': branch.name,
      'Mağaza Kodu': branch.code,
      'Reyon Adı': aisle.name,
      'Barkod': prod.barcode,
      'Stok Kodu': prod.stockCode,
      'Ürün Tanımı': prod.description,
      'Merkez Stok': prod.centralStock,
      'Sayılan Miktar': c.quantity,
      'Net Fark': diff,
      'Durum': status,
      'Sayım Tarihi': c.countedAt || '-'
    });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stok Sayım Raporu');
  XLSX.writeFile(wb, `Sayim_Karsilastirma_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
}
