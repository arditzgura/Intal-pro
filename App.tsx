
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Package, 
  PlusCircle, 
  Menu,
  Settings,
  X as CloseIcon,
  Warehouse,
  ArrowLeft
} from 'lucide-react';
import { Client, Item, Invoice, StockEntry, View, BusinessConfig, InvoiceItem } from './types';
import { loadData, saveData, STORAGE_KEYS, exportDatabase, importDatabase, clearData } from './utils/storage';

// Sub-components
import Dashboard from './components/Dashboard';
import ClientManager from './components/ClientManager';
import ItemManager from './components/ItemManager';
import InvoiceGenerator from './components/InvoiceGenerator';
import InvoiceHistory from './components/InvoiceHistory';
import InvoicePreview from './components/InvoicePreview';
import SettingsPanel from './components/SettingsPanel';
import StockEntryManager from './components/StockEntryManager';
import StockEntryGenerator from './components/StockEntryGenerator';
import ClientProfile from './components/ClientProfile';
import ItemProfile from './components/ItemProfile';
import StockEntryPreview from './components/StockEntryPreview';

const DEFAULT_CONFIG: BusinessConfig = {
  name: 'INTAL ALBANIA',
  nipt: 'L12345678X',
  address: 'Rruga Kryesore, Qyteti, Shqipëri',
  phone: '+355 69 27 76 636',
  email: 'info@intalal.com',
  website: 'www.intalal.com',
  slogan: 'Cilësia është prioriteti ynë'
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [viewHistory, setViewHistory] = useState<View[]>(['dashboard']);
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
  const [config, setConfig] = useState<BusinessConfig>(DEFAULT_CONFIG);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewStockEntry, setPreviewStockEntry] = useState<StockEntry | null>(null);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editStockEntry, setEditStockEntry] = useState<StockEntry | null>(null);
  const [selectedProfileClient, setSelectedProfileClient] = useState<Client | null>(null);
  const [selectedProfileItem, setSelectedProfileItem] = useState<Item | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<string, number>>({});

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const handleScroll = () => {
      scrollPositions.current[currentView] = main.scrollTop;
    };

    main.addEventListener('scroll', handleScroll);
    return () => main.removeEventListener('scroll', handleScroll);
  }, [currentView]);

  useEffect(() => {
    if (mainRef.current) {
      // Përdorim një timeout të vogël për t'u siguruar që DOM është i gatshëm
      setTimeout(() => {
        if (mainRef.current) {
          mainRef.current.scrollTop = scrollPositions.current[currentView] || 0;
        }
      }, 0);
    }
  }, [currentView]);

  useEffect(() => {
    setClients(loadData(STORAGE_KEYS.CLIENTS, []));
    setItems(loadData(STORAGE_KEYS.ITEMS, []));
    setInvoices(loadData(STORAGE_KEYS.INVOICES, []));
    setStockEntries(loadData(STORAGE_KEYS.STOCK_ENTRIES, []));
    setConfig(loadData(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG));
  }, []);

  useEffect(() => {
    if (clients.length > 0) {
      const updatedClients = clients.map(client => {
        const clientInvoices = invoices.filter(inv => inv.clientId === client.id && inv.status !== 'Anuluar');
        const totalPoints = clientInvoices.reduce((sum, inv) => {
          const points = inv.currency === 'EUR' 
            ? Math.floor(inv.subtotal || 0) 
            : Math.floor((inv.subtotal || 0) / 100);
          return sum + points;
        }, 0);
        
        if (client.points !== totalPoints) {
          return { ...client, points: totalPoints };
        }
        return client;
      });
      
      const hasChanged = JSON.stringify(updatedClients) !== JSON.stringify(clients);
      if (hasChanged) {
        setClients(updatedClients);
      }
    }
  }, [invoices]);

  useEffect(() => { saveData(STORAGE_KEYS.CLIENTS, clients); }, [clients]);
  useEffect(() => { saveData(STORAGE_KEYS.ITEMS, items); }, [items]);
  useEffect(() => { saveData(STORAGE_KEYS.INVOICES, invoices); }, [invoices]);
  useEffect(() => { saveData(STORAGE_KEYS.STOCK_ENTRIES, stockEntries); }, [stockEntries]);
  useEffect(() => { saveData(STORAGE_KEYS.CONFIG, config); }, [config]);

  const handleNavigate = (view: View) => {
    if (view !== currentView) {
      setViewHistory(prev => [...prev, view]);
      setCurrentView(view);
    }
    setEditInvoice(null);
    setEditStockEntry(null);
    setSelectedProfileClient(null);
    setSelectedProfileItem(null);
    setIsMobileMenuOpen(false);
  };

  const handleGoBack = () => {
    if (selectedProfileClient) {
      setSelectedProfileClient(null);
      return;
    }
    if (selectedProfileItem) {
      setSelectedProfileItem(null);
      return;
    }
    if (previewInvoice) {
      setPreviewInvoice(null);
      return;
    }
    if (previewStockEntry) {
      setPreviewStockEntry(null);
      return;
    }

    if (viewHistory.length > 1) {
      const newHistory = [...viewHistory];
      newHistory.pop();
      const previousView = newHistory[newHistory.length - 1];
      setViewHistory(newHistory);
      setCurrentView(previousView);
    } else if (currentView !== 'dashboard') {
      setCurrentView('dashboard');
      setViewHistory(['dashboard']);
    }
  };

  const nextInvoiceNumber = useMemo(() => {
    if (invoices.length === 0) return "5507";
    const numbers = invoices.map(inv => parseInt(inv.invoiceNumber)).filter(n => !isNaN(n));
    return (numbers.length === 0 ? 5507 : Math.max(...numbers) + 1).toString();
  }, [invoices]);

  const nextStockNumber = useMemo(() => {
    if (stockEntries.length === 0) return "1001";
    const numbers = stockEntries.map(e => parseInt(e.entryNumber)).filter(n => !isNaN(n));
    return (numbers.length === 0 ? 1001 : Math.max(...numbers) + 1).toString();
  }, [stockEntries]);

  const handleUpdateInvoiceStatus = (id: string, status: Invoice['status']) => {
    const targetInvoice = invoices.find(inv => inv.id === id);
    if (!targetInvoice) return;

    const today = new Date().toLocaleDateString('en-CA');

    setInvoices(prev => prev.map(inv => {
      if (status === 'E paguar') {
        if (inv.clientId === targetInvoice.clientId && (inv.id === id || inv.status === 'Pa paguar')) {
          return {
            ...inv,
            status: 'E paguar' as const,
            amountPaid: inv.subtotal + (inv.previousBalance || 0),
            paymentDate: inv.paymentDate || today
          };
        }
      } else if (status === 'Pa paguar') {
        if (inv.id === id) return { ...inv, status, paymentDate: undefined };
      } else {
        if (inv.id === id) return { ...inv, status };
      }
      return inv;
    }));
  };

  const handleAddStockEntry = (entry: StockEntry, updatePrices: boolean) => {
    if (editStockEntry) {
      setStockEntries(stockEntries.map(e => e.id === entry.id ? entry : e));
      setEditStockEntry(null);
    } else {
      setStockEntries([entry, ...stockEntries]);
    }
    
    let updatedItems = [...items];
    let changed = false;

    entry.items.forEach(stockItem => {
      const idx = updatedItems.findIndex(i => i.id === stockItem.itemId || i.name.toLowerCase() === stockItem.name.toLowerCase());
      if (idx >= 0) {
        updatedItems[idx].purchasePrice = stockItem.purchasePrice; 
        if (updatePrices) updatedItems[idx].price = stockItem.sellingPrice; 
        changed = true;
      } else {
        updatedItems.push({
          id: stockItem.itemId.startsWith('manual') ? 'item-' + Date.now() + Math.random().toString(36).substr(2,5) : stockItem.itemId,
          name: stockItem.name,
          unit: 'copë',
          price: stockItem.sellingPrice,
          purchasePrice: stockItem.purchasePrice,
          preferentialPrices: []
        });
        changed = true;
      }
    });

    if (changed) setItems(updatedItems);
    handleNavigate('stock-entries');
  };

  const addOrUpdateInvoice = (invoice: Invoice) => {
    let finalInvoice = { ...invoice };
    let updatedClients = [...clients];
    let updatedItems = [...items];
    let itemsChanged = false;
    let clientsChanged = false;

    const clientNameLower = invoice.clientName.trim().toLowerCase();
    let existingClient = updatedClients.find(c => c.name.toLowerCase() === clientNameLower);
    
    if (!existingClient) {
      const newClient: Client = {
        id: Date.now().toString(),
        name: invoice.clientName.trim(),
        city: '', address: '', phone: invoice.clientPhone || '', email: '', points: 0 
      };
      updatedClients.push(newClient);
      finalInvoice.clientId = newClient.id;
      clientsChanged = true;
    } else {
      finalInvoice.clientId = existingClient.id;
    }

    const finalItems: InvoiceItem[] = invoice.items.map(invItem => {
      const itemNameLower = invItem.name.trim().toLowerCase();
      let existingItem = updatedItems.find(i => i.name.toLowerCase() === itemNameLower);
      if (!existingItem) {
        const newItem: Item = {
          id: 'item-' + Date.now() + Math.random().toString(36).substr(2, 5),
          name: invItem.name.trim(),
          unit: 'copë',
          price: invItem.price,
          preferentialPrices: []
        };
        updatedItems.push(newItem);
        itemsChanged = true;
        return { ...invItem, itemId: newItem.id };
      } else {
        return { ...invItem, itemId: existingItem.id };
      }
    });

    finalInvoice.items = finalItems;
    if (clientsChanged) setClients(updatedClients);
    if (itemsChanged) setItems(updatedItems);

    const today = new Date().toLocaleDateString('en-CA');
    if (finalInvoice.status === 'E paguar' && !finalInvoice.paymentDate) {
      finalInvoice.paymentDate = today;
    }

    if (finalInvoice.status === 'E paguar') {
      setInvoices(prev => {
        const baseInvoices = editInvoice ? prev.filter(inv => inv.id !== finalInvoice.id) : prev;
        const settledInvoices = baseInvoices.map(inv => {
          if (inv.clientId === finalInvoice.clientId && inv.status === 'Pa paguar') {
            return {
              ...inv,
              status: 'E paguar' as const,
              amountPaid: inv.subtotal + (inv.previousBalance || 0),
              paymentDate: inv.paymentDate || today
            };
          }
          return inv;
        });
        return [finalInvoice, ...settledInvoices];
      });
    } else {
      if (editInvoice) setInvoices(invoices.map(inv => inv.id === finalInvoice.id ? finalInvoice : inv));
      else setInvoices([finalInvoice, ...invoices]);
    }
    
    setEditInvoice(null);
    clearData(STORAGE_KEYS.DRAFT);
    handleNavigate('invoices');
    setPreviewInvoice(finalInvoice);
  };

  const handleNewInvoiceForClient = (client: Client) => {
    const clientInvoices = invoices
      .filter(inv => inv.clientId === client.id && inv.status !== 'Anuluar')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latestInvoice = clientInvoices[0];
    const currentDebt = latestInvoice
      ? (latestInvoice.subtotal + (latestInvoice.previousBalance || 0)) - (latestInvoice.amountPaid || 0)
      : 0;

    const templateInvoice: any = {
      id: '', invoiceNumber: nextInvoiceNumber, date: new Date().toLocaleDateString('en-CA') + 'T' + new Date().toTimeString().split(' ')[0],
      clientId: client.id, clientName: client.name, clientPhone: client.phone || client.address || '',
      items: [], currency: 'Lek', subtotal: 0, tax: 0, previousBalance: currentDebt, amountPaid: 0, total: 0, status: 'Pa paguar'
    };

    setViewHistory(prev => [...prev, 'new-invoice']);
    setCurrentView('new-invoice');
    setEditInvoice(templateInvoice);
    setSelectedProfileClient(null);
    setIsMobileMenuOpen(false);
  };

  const navItems = [
    { id: 'dashboard', label: 'Paneli', icon: <LayoutDashboard size={18} /> },
    { id: 'new-invoice', label: 'Faturë e Re', icon: <PlusCircle size={18} /> },
    { id: 'invoices', label: 'Historia', icon: <FileText size={18} /> },
    { id: 'clients', label: 'Klientët', icon: <Users size={18} /> },
    { id: 'items', label: 'Artikujt', icon: <Package size={18} /> },
    { id: 'stock-entries', label: 'Flethyrje', icon: <Warehouse size={18} /> },
    { id: 'settings', label: 'Cilësimet', icon: <Settings size={18} /> },
  ];

  const showGlobalBack = currentView !== 'dashboard' || selectedProfileClient || selectedProfileItem || previewInvoice || previewStockEntry;

  return (
    <div className="min-h-screen flex bg-slate-50 overflow-hidden">
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-white shrink-0 border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-[#D81B60] p-1.5 rounded-lg shadow-lg">
            <FileText size={22} />
          </div>
          <span className="text-xl font-black italic tracking-tighter">INTAL <span className="text-[#D81B60]">PRO</span></span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id as View)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${
                currentView === item.id || (item.id === 'stock-entries' && currentView === 'new-stock-entry')
                ? 'bg-[#D81B60] text-white shadow-lg shadow-[#D81B60]/20' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
           <p className="text-[10px] text-slate-500 text-center font-bold uppercase tracking-widest">Versioni 1.8.6 - Analytics</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-slate-900 lg:bg-white text-white lg:text-slate-900 p-4 border-b border-slate-200 flex justify-between items-center shrink-0 z-50">
          <div className="flex items-center gap-4">
             {showGlobalBack && (
               <button 
                onClick={handleGoBack}
                className="flex items-center gap-2 bg-slate-100 lg:bg-slate-900 text-slate-600 lg:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md"
               >
                 <ArrowLeft size={16} strokeWidth={3} /> Kthehu
               </button>
             )}
             <div className="lg:hidden flex items-center gap-2">
               <div className="bg-[#D81B60] p-1 rounded-md"><FileText size={18} className="text-white" /></div>
               <span className="font-black italic text-sm text-white">INTAL PRO</span>
             </div>
          </div>
          <div className="hidden lg:block text-right">
             <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Përdoruesi</h2>
             <p className="text-sm font-black text-slate-800 uppercase tracking-tighter">Administrator</p>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2"><Menu /></button>
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto p-3 md:p-8 lg:p-12">
          <div className="max-w-7xl mx-auto space-y-4 md:space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div>
                  <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                    {navItems.find(n => n.id === currentView)?.label || (currentView === 'new-stock-entry' ? 'Detajet e Fletëhyrjes' : '')}
                  </h2>
                  <p className="text-slate-400 text-xs md:text-sm font-medium">Sistemi i Menaxhimit për {config.name}</p>
               </div>
            </div>

            {currentView === 'dashboard' && <Dashboard invoices={invoices} clients={clients} items={items} stockEntries={stockEntries} />}
            {currentView === 'new-invoice' && (
              <InvoiceGenerator 
                key={nextInvoiceNumber} 
                clients={clients} items={items} invoices={invoices}
                initialData={editInvoice} defaultInvoiceNumber={nextInvoiceNumber}
                onSubmit={addOrUpdateInvoice} onCancel={handleGoBack}
              />
            )}
            {currentView === 'stock-entries' && (
              <StockEntryManager 
                entries={stockEntries} items={items}
                onAddNew={() => { setEditStockEntry(null); setCurrentView('new-stock-entry'); }}
                onEdit={(entry) => { setEditStockEntry(entry); setCurrentView('new-stock-entry'); }}
                onDelete={(id) => setStockEntries(stockEntries.filter(e => e.id !== id))}
                onPreview={setPreviewStockEntry}
              />
            )}
            {currentView === 'new-stock-entry' && (
              <StockEntryGenerator 
                items={items} nextNumber={nextStockNumber}
                initialData={editStockEntry} onSave={handleAddStockEntry} onCancel={handleGoBack}
              />
            )}
            {currentView === 'invoices' && (
              <InvoiceHistory 
                invoices={invoices} clients={clients}
                onDelete={(id) => setInvoices(invoices.filter(i => i.id !== id))} 
                onPreview={setPreviewInvoice}
                onEdit={(inv) => { setPreviewInvoice(null); setEditInvoice(inv); setCurrentView('new-invoice'); }}
                onUpdateStatus={handleUpdateInvoiceStatus}
                onSelectClient={(clientId) => {
                  const client = clients.find(c => c.id === clientId);
                  if (client) setSelectedProfileClient(client);
                }}
              />
            )}
            {currentView === 'clients' && (
              <ClientManager 
                clients={clients} items={items} invoices={invoices}
                onAdd={(c) => setClients([...clients, c])} 
                onUpdate={(upd) => setClients(clients.map(c => c.id === upd.id ? upd : c))} 
                onDelete={(id) => setClients(clients.filter(c => c.id !== id))} 
                onUpdateItems={(newItems) => setItems(newItems)}
                onPreviewInvoice={setPreviewInvoice}
                onOpenProfile={setSelectedProfileClient}
              />
            )}
            {currentView === 'items' && (
              <ItemManager 
                items={items} clients={clients} invoices={invoices} stockEntries={stockEntries}
                onAdd={(i) => setItems([...items, i])} 
                onUpdate={(upd) => setItems(items.map(i => i.id === upd.id ? upd : i))} 
                onDelete={(id) => setItems(items.filter(i => i.id !== id))} 
                onOpenProfile={setSelectedProfileItem}
              />
            )}
            {currentView === 'settings' && (
              <SettingsPanel 
                config={config} onUpdate={setConfig} onExport={exportDatabase}
                onImport={async (file) => {
                  try {
                    const text = await file.text();
                    const db = JSON.parse(text);
                    if (!db || typeof db !== 'object') return false;
                    // Shkruaj në localStorage për persistencë
                    importDatabase(text);
                    // Update React state direkt — pa reload
                    if (db.clients)      setClients(db.clients);
                    if (db.items)        setItems(db.items);
                    if (db.invoices)     setInvoices(db.invoices);
                    if (db.stockEntries) setStockEntries(db.stockEntries);
                    if (db.config)       setConfig({ ...DEFAULT_CONFIG, ...db.config });
                    handleNavigate('dashboard');
                    return true;
                  } catch {
                    return false;
                  }
                }}
              />
            )}
          </div>
        </main>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden animate-in fade-in duration-200">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
           <div className="absolute right-0 top-0 bottom-0 w-64 bg-slate-900 p-6 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl">
              <div className="flex justify-between items-center mb-10">
                 <span className="font-black italic text-white uppercase tracking-widest">Menu</span>
                 <button onClick={() => setIsMobileMenuOpen(false)} className="text-white"><CloseIcon /></button>
              </div>
              <div className="flex-1 space-y-2">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id as View)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${
                      currentView === item.id ? 'bg-[#D81B60] text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
           </div>
        </div>
      )}

      {previewInvoice && (
        <InvoicePreview 
          invoice={previewInvoice} business={config}
          client={clients.find(c => c.id === previewInvoice.clientId)}
          onClose={() => setPreviewInvoice(null)} 
          onEdit={(inv) => { setPreviewInvoice(null); setEditInvoice(inv); setCurrentView('new-invoice'); }}
        />
      )}

      {previewStockEntry && (
        <StockEntryPreview 
          entry={previewStockEntry} business={config}
          onClose={() => setPreviewStockEntry(null)} 
          onEdit={(entry) => { setPreviewStockEntry(null); setEditStockEntry(entry); setCurrentView('new-stock-entry'); }}
        />
      )}

      {selectedProfileClient && (
        <ClientProfile
          client={selectedProfileClient} invoices={invoices} items={items}
          onUpdateItems={(newItems) => setItems(newItems)}
          onUpdateClient={(upd) => setClients(clients.map(c => c.id === upd.id ? upd : c))}
          onClose={() => setSelectedProfileClient(null)}
          onViewInvoice={(inv) => { setSelectedProfileClient(null); setPreviewInvoice(inv); }}
          onNewInvoice={handleNewInvoiceForClient}
        />
      )}

      {selectedProfileItem && (
        <ItemProfile 
          item={selectedProfileItem} invoices={invoices} stockEntries={stockEntries}
          clients={clients}
          onUpdateItem={(updatedItem) => setItems(items.map(i => i.id === updatedItem.id ? updatedItem : i))}
          onClose={() => setSelectedProfileItem(null)} 
        />
      )}
    </div>
  );
};

export default App;
