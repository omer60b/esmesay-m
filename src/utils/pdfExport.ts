import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppDatabase } from '../types';

// Safely sanitize Turkish characters for standard jsPDF fonts to avoid broken glyphs
export function sanitizePdfText(text: string | number | undefined | null): string {
  if (text === undefined || text === null) return '';
  const str = String(text);
  const charMap: Record<string, string> = {
    'ğ': 'g', 'Ğ': 'G',
    'ı': 'i', 'İ': 'I',
    'ş': 's', 'Ş': 'S',
    'ç': 'c', 'Ç': 'C',
    'ö': 'o', 'Ö': 'O',
    'ü': 'u', 'Ü': 'U'
  };
  return str.replace(/[ğĞıİşŞçÇöÖüÜ]/g, (m) => charMap[m] || m);
}

export function exportComparisonReportPdf(
  db: AppDatabase,
  selectedBranchId: string | number,
  selectedStatus: string
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  let branchTitle = 'Tüm Mağazalar';
  if (selectedBranchId !== 'all') {
    const b = db.branches.find(br => br.id === Number(selectedBranchId));
    if (b) branchTitle = `${b.name} (${b.code})`;
  }

  // Header Background bar
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, 297, 24, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(sanitizePdfText('ESME SAYIM PANELI - RESMI KOR SAYIM VE STOK FARK RAPORU'), 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text(sanitizePdfText(`Rapor Tarihi: ${dateStr}  |  Kapsam: ${branchTitle}`), 14, 18);

  // Filter counts
  let counts = db.counts;
  if (selectedBranchId !== 'all') {
    counts = counts.filter(c => c.branchId === Number(selectedBranchId));
  }

  let totalCounted = 0;
  let exactCount = 0;
  let shortageCount = 0;
  let surplusCount = 0;
  let netDifferenceSum = 0;

  const tableRows: any[] = [];

  counts.forEach((c, idx) => {
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

    let status = 'Tam Eslesme';
    if (diff < 0) {
      status = `Eksik (${diff})`;
      shortageCount++;
    } else if (diff > 0) {
      status = `Fazla (+${diff})`;
      surplusCount++;
    } else {
      exactCount++;
    }

    if (selectedStatus === 'exact' && diff !== 0) return;
    if (selectedStatus === 'diff' && diff === 0) return;

    totalCounted++;
    netDifferenceSum += diff;

    tableRows.push([
      idx + 1,
      sanitizePdfText(branch.name),
      sanitizePdfText(aisle.name),
      sanitizePdfText(prod.description),
      prod.barcode,
      prod.centralStock,
      c.quantity,
      diff > 0 ? `+${diff}` : `${diff}`,
      sanitizePdfText(status)
    ]);
  });

  // KPI Mini Boxes
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);

  // 4 metric badges
  const boxY = 28;
  const boxW = 65;
  const boxH = 14;

  // Box 1: Total
  doc.roundedRect(14, boxY, boxW, boxH, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(sanitizePdfText('Toplam Sayilan Kalem'), 17, boxY + 5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(String(totalCounted), 17, boxY + 11);

  // Box 2: Exact
  doc.roundedRect(14 + boxW + 4, boxY, boxW, boxH, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(sanitizePdfText('Tam Eslesen Urun'), 14 + boxW + 7, boxY + 5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52); // green
  doc.text(String(exactCount), 14 + boxW + 7, boxY + 11);

  // Box 3: Shortage
  doc.roundedRect(14 + (boxW + 4) * 2, boxY, boxW, boxH, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(sanitizePdfText('Eksik Stok (Kayip/Fire)'), 14 + (boxW + 4) * 2 + 3, boxY + 5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28); // red
  doc.text(String(shortageCount), 14 + (boxW + 4) * 2 + 3, boxY + 11);

  // Box 4: Surplus & Net Diff
  doc.roundedRect(14 + (boxW + 4) * 3, boxY, boxW, boxH, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(sanitizePdfText('Fazla Stok / Net Fark'), 14 + (boxW + 4) * 3 + 3, boxY + 5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9); // amber
  doc.text(`${surplusCount} ad. (Net: ${netDifferenceSum})`, 14 + (boxW + 4) * 3 + 3, boxY + 11);

  // Generate AutoTable
  autoTable(doc, {
    startY: 46,
    head: [[
      'No',
      'Magaza',
      'Reyon',
      'Urun Tanimi',
      'Barkod',
      'Merkez Stok',
      'Sayilan',
      'Fark',
      'Durum'
    ]],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [79, 70, 229], // Indigo 600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 65 },
      4: { cellWidth: 30, font: 'courier' },
      5: { cellWidth: 24, halign: 'center' },
      6: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 20, halign: 'center' },
      8: { cellWidth: 28, halign: 'center' }
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const row = tableRows[data.row.index];
        const diffText = row[7];
        if (data.column.index === 7 || data.column.index === 8) {
          if (diffText.startsWith('-')) {
            data.cell.styles.textColor = [185, 28, 28]; // red
          } else if (diffText.startsWith('+')) {
            data.cell.styles.textColor = [180, 83, 9]; // amber
          } else {
            data.cell.styles.textColor = [22, 101, 52]; // green
          }
        }
      }
    }
  });

  // Footer & Signatures
  const pageHeight = doc.internal.pageSize.height;
  const lastY = (doc as any).lastAutoTable.finalY || 150;

  let signatureY = lastY + 18;
  if (signatureY > pageHeight - 35) {
    doc.addPage();
    signatureY = 30;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(20, signatureY, 95, signatureY);
  doc.line(195, signatureY, 275, signatureY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(sanitizePdfText('Sayim ve Saha Sorumlusu'), 35, signatureY + 5);
  doc.text(sanitizePdfText('Merkez Denetim ve Onay Yetkilisi'), 205, signatureY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(sanitizePdfText('Isim / Imza / Tarih'), 42, signatureY + 9);
  doc.text(sanitizePdfText('Isim / Imza / Tarih'), 222, signatureY + 9);

  // Save PDF
  const filename = `Stok_Sayim_Raporu_${now.toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

export function exportBranchDetailPdf(
  db: AppDatabase,
  branchId: number
) {
  const branch = db.branches.find(b => b.id === branchId);
  if (!branch) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  // Header bar
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(sanitizePdfText(`${branch.name} (${branch.code})`), 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(sanitizePdfText(`Magaza Sayim Denetim ve Mutabakat Raporu | ${dateStr}`), 14, 18);

  const assignedIds = db.assignments.filter(a => a.branchId === branchId).map(a => a.productId);
  const assignedProducts = db.products.filter(p => assignedIds.includes(p.id));

  let totalAssigned = assignedProducts.length;
  let totalCounted = 0;
  let exactCount = 0;
  let diffCount = 0;

  const tableRows: any[] = [];

  assignedProducts.forEach((p, idx) => {
    const countRec = db.counts.find(c => c.branchId === branchId && c.productId === p.id);
    const qty = countRec ? countRec.quantity : 0;
    if (countRec) totalCounted++;
    const diff = qty - p.centralStock;

    if (diff === 0) exactCount++;
    else diffCount++;

    const aisle = db.aisles.find(a => a.id === p.aisleId) || { name: 'Genel' };
    const status = diff === 0 ? 'Tam Eslesme' : diff < 0 ? `Eksik (${diff})` : `Fazla (+${diff})`;

    tableRows.push([
      idx + 1,
      sanitizePdfText(aisle.name),
      sanitizePdfText(p.description),
      p.barcode,
      p.centralStock,
      qty,
      diff > 0 ? `+${diff}` : `${diff}`,
      sanitizePdfText(status)
    ]);
  });

  const evals = db.evaluations.filter(e => e.branchId === branchId);
  const lastEval = evals.length ? evals[evals.length - 1] : null;

  // Overview box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 28, 182, 18, 2, 2, 'F');

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(sanitizePdfText(`Atanan / Sayilan Urun: ${totalCounted} / ${totalAssigned}`), 18, 35);
  doc.text(sanitizePdfText(`Tam Eslesen: ${exactCount}  |  Fark Olan Kalem: ${diffCount}`), 18, 41);

  const scoreText = lastEval ? `Son Puan: ${lastEval.score} / 100` : 'Puan: Henuz Girilmedi';
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text(sanitizePdfText(scoreText), 130, 35);

  if (lastEval && lastEval.feedback) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(sanitizePdfText(`Yonetim Notu: "${lastEval.feedback.slice(0, 45)}..."`), 130, 41);
  }

  autoTable(doc, {
    startY: 50,
    head: [[
      'No',
      'Reyon',
      'Urun Tanimi',
      'Barkod',
      'Merkez',
      'Sayilan',
      'Fark',
      'Durum'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8.5
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 55 },
      3: { cellWidth: 26, font: 'courier' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 18, halign: 'center' }
    }
  });

  const pageHeight = doc.internal.pageSize.height;
  const lastY = (doc as any).lastAutoTable.finalY || 180;
  let sigY = lastY + 20;
  if (sigY > pageHeight - 30) {
    doc.addPage();
    sigY = 30;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(20, sigY, 80, sigY);
  doc.line(130, sigY, 190, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(sanitizePdfText(`${branch.name} Yetkilisi`), 30, sigY + 5);
  doc.text(sanitizePdfText('Merkez Denetcisi'), 145, sigY + 5);

  const filename = `${sanitizePdfText(branch.name).replace(/\s+/g, '_')}_Sayim_Raporu.pdf`;
  doc.save(filename);
}

export function exportCountHistoryPdf(
  db: AppDatabase,
  countsToExport: any[],
  subTitleText: string = 'Tum Gecmis Sayim Kayitlari'
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  // Header Bar
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(sanitizePdfText('ESME SAYIM PANELI - GECMIS SAYIM VE DENETIM ARSIV RAPORU'), 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(sanitizePdfText(`Rapor Tarihi: ${dateStr}  |  Kapsam: ${subTitleText}  |  Toplam Kayit: ${countsToExport.length}`), 14, 18);

  const tableRows = countsToExport.map((c, idx) => {
    const branch = db.branches.find(b => b.id === c.branchId) || { name: 'Bilinmiyor', code: '-' };
    const prod = db.products.find(p => p.id === c.productId) || {
      description: 'Silinmis Urun',
      barcode: '-',
      centralStock: 0,
      aisleId: 0
    };
    const aisle = db.aisles.find(a => a.id === prod.aisleId) || { name: 'Genel' };
    const diff = c.quantity - prod.centralStock;

    let status = 'Tam Eslesme';
    if (diff < 0) status = `Eksik (${diff})`;
    else if (diff > 0) status = `Fazla (+${diff})`;

    return [
      idx + 1,
      c.countedAt || '-',
      sanitizePdfText(branch.name),
      sanitizePdfText(aisle.name),
      sanitizePdfText(prod.description),
      prod.barcode,
      prod.centralStock,
      c.quantity,
      diff > 0 ? `+${diff}` : `${diff}`,
      sanitizePdfText(status),
      sanitizePdfText(c.counterName || 'Magaza Personeli')
    ];
  });

  autoTable(doc, {
    startY: 30,
    head: [[
      'No',
      'Tarih/Saat',
      'Magaza',
      'Reyon',
      'Urun Tanimi',
      'Barkod',
      'Merkez',
      'Sayilan',
      'Fark',
      'Durum',
      'Sayimi Yapan'
    ]],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [79, 70, 229], // Indigo 600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 26, font: 'courier' },
      2: { cellWidth: 32 },
      3: { cellWidth: 30 },
      4: { cellWidth: 55 },
      5: { cellWidth: 26, font: 'courier' },
      6: { cellWidth: 16, halign: 'center' },
      7: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      8: { cellWidth: 16, halign: 'center' },
      9: { cellWidth: 24, halign: 'center' },
      10: { cellWidth: 28 }
    }
  });

  const pageHeight = doc.internal.pageSize.height;
  const lastY = (doc as any).lastAutoTable.finalY || 160;
  let sigY = lastY + 18;
  if (sigY > pageHeight - 35) {
    doc.addPage();
    sigY = 30;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(20, sigY, 95, sigY);
  doc.line(195, sigY, 275, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(sanitizePdfText('Sayim Arsiv Sorumlusu'), 35, sigY + 5);
  doc.text(sanitizePdfText('Merkez Denetim Yetkilisi'), 210, sigY + 5);

  const filename = `Gecmis_Sayim_Arsiv_${now.toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

