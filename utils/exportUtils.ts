
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
