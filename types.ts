
export interface Client {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  points?: number;
  photo?: string;
}

export interface PreferentialPrice {
  clientId: string;
  price: number;
}

export interface Item {
  id: string;
  name: string;
  unit: string;
  price: number;
  purchasePrice?: number; // Kostoja e blerjes
  preferentialPrices?: PreferentialPrice[];
}

export interface InvoiceItem {
  itemId: string;
  name: string;
  description?: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  clientId: string;
  clientName: string;
  clientCity?: string; // Qyteti i ruajtur në momentin e faturimit
  clientPhone?: string;
  items: InvoiceItem[];
  currency: 'Lek' | 'EUR';
  subtotal: number;
  tax: number;
  previousBalance: number;
  previousBalanceLabel?: string; // Etiketa e personalizuar
  amountPaid: number;
  amountPaidLabel?: string; // Etiketa e personalizuar
  total: number;
  status: 'E paguar' | 'Pa paguar' | 'Anuluar';
  notes?: string; // Shënime shtesë
  paymentDate?: string; // Data kur faturë është paguar
}

export interface StockEntryItem {
  itemId: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  total: number;
}

export interface StockEntry {
  id: string;
  entryNumber: string;
  date: string;
  origin: string;
  items: StockEntryItem[];
  totalPurchaseValue: number;
  totalSellingValue: number; // Vlera totale në shitje
  notes?: string;
}

export interface BusinessConfig {
  name: string;
  nipt: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoUrl?: string;
  qrCodeUrl?: string;
  slogan?: string;
  invoiceTemplate?: 1 | 2 | 3 | 4 | 5;
  itemFontSize?: number;
  itemFont?: string;
  watermarkUrl?: string;
  watermarkSize?: number;
  watermarkOpacity?: number;
  watermarkX?: number;
  watermarkY?: number;
  watermarkDesaturate?: boolean;
  thermalWidth?: number;   // gjerësia e printerit termal në mm (default 80)
  // Tekstet e editueshmë të faturës
  labelFature?: string;
  labelKlienti?: string;
  labelArtikulli?: string;
  labelSasia?: string;
  labelCmimi?: string;
  labelTotali?: string;
  labelNentotali?: string;
  labelGjendja?: string;
  labelPaguar?: string;
  labelDetyrimi?: string;
  labelTeprica?: string;
  labelFaleminderit?: string;
}

export type View = 'dashboard' | 'invoices' | 'clients' | 'items' | 'new-invoice' | 'settings' | 'stock-entries' | 'new-stock-entry' | 'admin';
