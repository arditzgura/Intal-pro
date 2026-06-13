
import { Invoice, Client, Item, StockEntry } from '../types';

declare const XLSX: any;

export const exportInvoicesToExcel = (invoices: Invoice[]) => {
  // Grupimi i artikujve sipas emrit
  const aggregatedItems: Record<string, { name: string, quantity: number, total: number, unit: string }> = {};

  invoices.forEach(inv => {
    inv.items.forEach(item => {
      if (!aggregatedItems[item.name]) {
        aggregatedItems[item.name] = {
          name: item.name,
          quantity: 0,
          total: 0,
          unit: 'copë' // Default
        };
      }
      aggregatedItems[item.name].quantity += item.quantity;
      aggregatedItems[item.name].total += item.total;
    });
  });

  const data = Object.values(aggregatedItems).map(item => ({
    'Artikulli': item.name,
    'Sasia Totale': item.quantity,
    'Vlera Totale (Lek)': item.total,
    'Çmimi Mesatar': (item.total / item.quantity).toFixed(2)
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Përmbledhja e Shitjeve");
  XLSX.writeFile(workbook, `Përmbledhje_Artikujsh_${new Date().toLocaleDateString('en-CA')}.xlsx`);
};

export const exportStockEntryToExcel = (entry: StockEntry) => {
  const data = entry.items.map(item => ({
    'Nr. Hyrje': entry.entryNumber,
    'Data': entry.date.split('-').reverse().join('/'),
    'Origjina': entry.origin,
    'Artikulli': item.name,
    'Sasia': item.quantity,
    'Çmimi Blerjes': item.purchasePrice,
    'Çmimi Shitjes': item.sellingPrice,
    'Vlera Blerjes Totale': item.total,
    'Fitimi i Parashikuar': (item.sellingPrice - item.purchasePrice) * item.quantity
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Fletëhyrje");
  XLSX.writeFile(workbook, `Fletëhyrje_${entry.entryNumber}.xlsx`);
};

export const exportAllStockEntriesToExcel = (entries: StockEntry[]) => {
  const data = entries.flatMap(entry => 
    entry.items.map(item => ({
      'Nr. Hyrje': entry.entryNumber,
      'Data': entry.date.split('-').reverse().join('/'),
      'Origjina': entry.origin,
      'Artikulli': item.name,
      'Sasia': item.quantity,
      'Çmimi Blerjes (Lek)': item.purchasePrice,
      'Çmimi Shitjes (Lek)': item.sellingPrice,
      'Vlera Blerjes Totale (Lek)': item.total,
      'Fitimi i Parashikuar (Lek)': (item.sellingPrice - item.purchasePrice) * item.quantity
    }))
  );

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Lista e Fletëhyrjeve");
  XLSX.writeFile(workbook, `Raporti_Fletëhyrjeve_${new Date().toLocaleDateString('en-CA')}.xlsx`);
};

export const exportClientAnalysisToExcel = (client: Client, invoices: Invoice[], itemSummary: any[]) => {
  const invoicesData = invoices.map(inv => ({
    'Nr. Faturës': inv.invoiceNumber,
    'Data': inv.date.split('-').reverse().join('/'),
    'Totali': inv.total,
    'Paguar': inv.amountPaid,
    'Statusi': inv.status
  }));

  const itemsData = itemSummary.map(row => ({
    'Artikulli': row.name,
    'Sasia Totale': row.totalQty,
    'Vlera Totale': row.totalValue,
    'Fitimi Neto': row.totalProfit
  }));

  const wb = XLSX.utils.book_new();
  const wsInv = XLSX.utils.json_to_sheet(invoicesData);
  const wsItems = XLSX.utils.json_to_sheet(itemsData);

  XLSX.utils.book_append_sheet(wb, wsInv, "Faturat");
  XLSX.utils.book_append_sheet(wb, wsItems, "Artikujt");
  
  XLSX.writeFile(wb, `Analiza_${client.name}.xlsx`);
};

/** Raport periodik: xhiro ditore / mujore, arketime, fitimi */
export const exportPeriodReport = (
  invoices: Invoice[],
  items: Item[],
  filterMode: 'all' | 'today' | 'day' | 'month' | 'year',
  periodLabel: string,
  selectedMonth: string,
  selectedYear: string,
  activeDayStr: string,
) => {
  const getConv = (val: number, curr?: string) => curr === 'EUR' ? val * 100 : val;
  const calcProfit = (inv: Invoice) => {
    let p = 0;
    inv.items.forEach(it => {
      const gi = items.find(i => i.id === it.itemId || i.name === it.name);
      const buy = Number(gi?.purchasePrice || 0);
      const sell = getConv(Number(it.price), inv.currency);
      p += (sell - buy) * Number(it.quantity);
    });
    return p;
  };

  // Mblidh të dhënat për çdo interval (ditë ose muaj)
  type Row = { xhiro: number; arketime: number; fitimi: number };
  const map: Record<string, Row> = {};
  const add = (key: string) => { if (!map[key]) map[key] = { xhiro: 0, arketime: 0, fitimi: 0 }; };

  invoices.forEach(inv => {
    if (inv.status === 'Anuluar') return;
    const invDay   = inv.date.slice(0, 10);
    const invMonth = invDay.slice(0, 7);
    const payDay   = (inv.paymentDate || inv.date).slice(0, 10);
    const payMonth = payDay.slice(0, 7);

    // Xhiro & Fitimi — sipas datës së krijimit
    const xhiroKey = filterMode === 'year' || filterMode === 'all' ? invMonth : invDay;
    add(xhiroKey);
    map[xhiroKey].xhiro   += getConv(inv.subtotal, inv.currency);
    map[xhiroKey].fitimi  += calcProfit(inv);

    // Arketime — sipas datës së pagesës
    const arkKey = filterMode === 'year' || filterMode === 'all' ? payMonth : payDay;
    add(arkKey);
    map[arkKey].arketime += getConv(inv.amountPaid || 0, inv.currency);
  });

  // Formatimi i çelësit për display
  const mn: Record<string, string> = {
    '01':'Janar','02':'Shkurt','03':'Mars','04':'Prill','05':'Maj','06':'Qershor',
    '07':'Korrik','08':'Gusht','09':'Shtator','10':'Tetor','11':'Nëntor','12':'Dhjetor',
  };
  const fmtKey = (k: string) => {
    if (k.length === 7) { const [y, m] = k.split('-'); return `${mn[m] || m} ${y}`; }
    const [y, m, d] = k.split('-'); return `${d}/${m}/${y}`;
  };

  const rows = Object.keys(map).sort().map(k => ({
    'Data': fmtKey(k),
    'Xhiro (Lek)': Math.round(map[k].xhiro),
    'Arketime (Lek)': Math.round(map[k].arketime),
    'Fitimi (Lek)': Math.round(map[k].fitimi),
  }));

  // Rreshti total
  rows.push({
    'Data': 'TOTALI',
    'Xhiro (Lek)': rows.reduce((s, r) => s + r['Xhiro (Lek)'], 0),
    'Arketime (Lek)': rows.reduce((s, r) => s + r['Arketime (Lek)'], 0),
    'Fitimi (Lek)': rows.reduce((s, r) => s + r['Fitimi (Lek)'], 0),
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  // Gjerësia kolonave
  ws['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Raport');
  XLSX.writeFile(wb, `Raport_${periodLabel.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('en-CA')}.xlsx`);
};

export const exportClientsToExcel = (clients: Client[]) => {
  const worksheet = XLSX.utils.json_to_sheet(clients);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Klientet");
  XLSX.writeFile(workbook, "Lista_Klienteve.xlsx");
};

export const exportItemsToExcel = (items: Item[]) => {
  const worksheet = XLSX.utils.json_to_sheet(items);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Artikujt");
  XLSX.writeFile(workbook, "Lista_Artikujve.xlsx");
};
