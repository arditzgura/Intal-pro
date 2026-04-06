
import { Client, Item, Invoice, BusinessConfig } from '../types';

const STORAGE_KEYS = {
  CLIENTS: 'fatura_clients',
  ITEMS: 'fatura_items',
  INVOICES: 'fatura_invoices',
  STOCK_ENTRIES: 'fatura_stock_entries', // Key i ri
  CONFIG: 'fatura_config',
  DRAFT: 'fatura_invoice_draft',
};

export const loadData = <T,>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  try {
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

export const saveData = <T,>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const clearData = (key: string): void => {
  localStorage.removeItem(key);
};

export const exportDatabase = () => {
  const db = {
    clients: loadData(STORAGE_KEYS.CLIENTS, []),
    items: loadData(STORAGE_KEYS.ITEMS, []),
    invoices: loadData(STORAGE_KEYS.INVOICES, []),
    stockEntries: loadData(STORAGE_KEYS.STOCK_ENTRIES, []),
    config: loadData(STORAGE_KEYS.CONFIG, null),
  };
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_intal_pro_${new Date().toLocaleDateString('en-CA')}.json`;
  a.click();
};

export const importDatabase = (jsonString: string) => {
  try {
    const db = JSON.parse(jsonString);
    if (db.clients) saveData(STORAGE_KEYS.CLIENTS, db.clients);
    if (db.items) saveData(STORAGE_KEYS.ITEMS, db.items);
    if (db.invoices) saveData(STORAGE_KEYS.INVOICES, db.invoices);
    if (db.stockEntries) saveData(STORAGE_KEYS.STOCK_ENTRIES, db.stockEntries);
    if (db.config) saveData(STORAGE_KEYS.CONFIG, db.config);
    return true;
  } catch (e) {
    console.error("Import error", e);
    return false;
  }
};

export { STORAGE_KEYS };
