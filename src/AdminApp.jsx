import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient'; // Ensure this path matches your project
import { LogOut, Users, PackagePlus, DollarSign } from 'lucide-react';

export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [activeTab, setActiveTab] = useState('inventory'); 
  
  // Inventory States
  const [products, setProducts] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [batchId, setBatchId] = useState(''); 
  
  // Ledger States
  const [customers, setCustomers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('new');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [goodsPurchased, setGoodsPurchased] = useState('');
  const [ledgerBatch, setLedgerBatch] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [initialPaid, setInitialPaid] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProducts();
        fetchCustomers();
        fetchLedgers();
      }
    });
  }, [session]);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (data) setProducts(data);
  };

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('name');
    if (data) setCustomers(data);
  };

  const fetchLedgers = async () => {
    const { data } = await supabase.from('sales_ledger').select(`*, customers (name)`).order('last_payment_date', { ascending: false });
    if (data) setLedgers(data);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const payload = {
      name, price: parseFloat(price), quantity: parseInt(quantity), batch_id: batchId, stock_status: parseInt(quantity) > 0
    };
    await supabase.from('products').insert([payload]);
    fetchProducts();
    setName(''); setPrice(''); setQuantity(''); setBatchId('');
    alert('Produit enregistré avec succès!');
  };

  const handleRecordSale = async (e) => {
    e.preventDefault();
    let customerIdToUse = selectedCustomer;

    if (selectedCustomer === 'new') {
      const { data: newCust, error } = await supabase.from('customers').insert([{ name: newCustomerName }]).select().single();
      if (error) return alert("Erreur lors de la création du client");
      customerIdToUse = newCust.id;
      fetchCustomers();
    }

    const salePayload = {
      customer_id: customerIdToUse,
      goods_description: goodsPurchased,
      batch_reference: ledgerBatch,
      total_amount: parseFloat(totalAmount),
      amount_paid: parseFloat(initialPaid),
      last_payment_date: new Date().toISOString()
    };

    await supabase.from('sales_ledger').insert([salePayload]);
    fetchLedgers();
    setSelectedCustomer('new'); setNewCustomerName(''); setGoodsPurchased(''); setLedgerBatch(''); setTotalAmount(''); setInitialPaid('');
    alert("Vente enregistrée avec succès !");
  };

  const handleUpdatePayment = async (ledgerId, currentPaid, totalCost) => {
    const payment = prompt(`Entrez le nouveau montant payé aujourd'hui (FCFA):`);
    if (!payment || isNaN(payment)) return;
    
    const newTotalPaid = currentPaid + parseFloat(payment);
    if (newTotalPaid > totalCost) return alert("Le montant payé dépasse le total !");

    await supabase.from('sales_ledger').update({ amount_paid: newTotalPaid, last_payment_date: new Date().toISOString() }).eq('id', ledgerId);
    fetchLedgers();
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <form onSubmit={handleAdminLogin} className="bg-white p-8 rounded-2xl shadow-sm border max-w-sm w-full space-y-4">
          <h2 className="text-xl font-bold text-center">Admin DonChike</h2>
          <input type="email" placeholder="Email" onChange={e => setAdminEmail(e.target.value)} className="w-full border p-3 rounded-xl text-sm" required />
          <input type="password" placeholder="Mot de passe" onChange={e => setAdminPassword(e.target.value)} className="w-full border p-3 rounded-xl text-sm" required />
          <button className="w-full bg-black text-white p-3 rounded-xl font-bold">Se connecter</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-4 md:p-8">
      <div className="max-w-7xl mx-auto flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border mb-6">
        <h1 className="font-black text-xl text-[#f68b1e] uppercase tracking-wider">DonChike Dashboard</h1>
        <div className="flex items-center space-x-4">
          <button onClick={() => setActiveTab('inventory')} className={`text-sm font-bold flex items-center space-x-1 ${activeTab === 'inventory' ? 'text-black' : 'text-gray-400'}`}><PackagePlus className="w-4 h-4"/> <span>Stock & Lots</span></button>
          <button onClick={() => setActiveTab('ledger')} className={`text-sm font-bold flex items-center space-x-1 ${activeTab === 'ledger' ? 'text-black' : 'text-gray-400'}`}><Users className="w-4 h-4"/> <span>Ventes & Créances</span></button>
          <button onClick={() => supabase.auth.signOut()} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><LogOut className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border h-fit">
          {activeTab === 'inventory' ? (
            <form onSubmit={handleAddProduct} className="space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wide border-b pb-2">Nouveau Produit (Par Lot)</h3>
              <input type="text" placeholder="Nom du produit" value={name} onChange={e => setName(e.target.value)} className="w-full border p-2 text-sm rounded-lg" required />
              <input type="text" placeholder="Identifiant du Lot (ex: BATCH-A)" value={batchId} onChange={e => setBatchId(e.target.value)} className="w-full border p-2 text-sm rounded-lg border-[#f68b1e]" required />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Prix" value={price} onChange={e => setPrice(e.target.value)} className="w-full border p-2 text-sm rounded-lg" required />
                <input type="number" placeholder="Quantité" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border p-2 text-sm rounded-lg" required />
              </div>
              <button type="submit" className="w-full bg-[#f68b1e] text-white py-2 rounded-lg font-bold text-sm">Ajouter au stock</button>
            </form>
          ) : (
            <form onSubmit={handleRecordSale} className="space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wide border-b pb-2">Enregistrer une Vente</h3>
              <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} className="w-full border p-2 text-sm rounded-lg bg-gray-50">
                <option value="new">+ Nouveau Client</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {selectedCustomer === 'new' && <input type="text" placeholder="Nom du nouveau client" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} className="w-full border p-2 text-sm rounded-lg border-blue-400" required />}
              <textarea placeholder="Marchandise achetée" value={goodsPurchased} onChange={e => setGoodsPurchased(e.target.value)} className="w-full border p-2 text-sm rounded-lg h-16" required />
              <input type="text" placeholder="Lot associé" value={ledgerBatch} onChange={e => setLedgerBatch(e.target.value)} className="w-full border p-2 text-sm rounded-lg" required />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Total (FCFA)" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} className="w-full border p-2 text-sm rounded-lg" required />
                <input type="number" placeholder="Avance (FCFA)" value={initialPaid} onChange={e => setInitialPaid(e.target.value)} className="w-full border p-2 text-sm rounded-lg" required />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold text-sm">Valider la transaction</button>
            </form>
          )}
        </div>

        <div className="md:col-span-2 bg-white p-5 rounded-xl shadow-sm border">
          {activeTab === 'inventory' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="text-gray-400 bg-gray-50"><th className="p-2">Produit</th><th className="p-2">Lot</th><th className="p-2">Prix</th><th className="p-2">Stock</th></tr></thead>
                <tbody className="divide-y">
                  {products.map(p => (
                    <tr key={p.id}>
                      <td className="p-2 font-bold">{p.name}</td>
                      <td className="p-2"><span className="bg-orange-100 text-[#f68b1e] text-xs px-2 py-0.5 rounded font-bold">{p.batch_id || 'N/A'}</span></td>
                      <td className="p-2">{p.price?.toLocaleString()} FCFA</td>
                      <td className="p-2">{p.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead><tr className="text-gray-400 bg-gray-50"><th className="p-2">Client</th><th className="p-2">Marchandise (Lot)</th><th className="p-2">Total</th><th className="p-2">Reste à payer</th><th className="p-2">Action</th></tr></thead>
                <tbody className="divide-y">
                  {ledgers.map(L => {
                    const balance = L.total_amount - L.amount_paid;
                    const isPaidOut = balance <= 0;
                    return (
                      <tr key={L.id} className={isPaidOut ? 'bg-green-50/50' : ''}>
                        <td className="p-2 font-bold">{L.customers?.name}</td>
                        <td className="p-2 text-xs truncate max-w-[150px]">{L.goods_description} ({L.batch_reference})</td>
                        <td className="p-2">{L.total_amount.toLocaleString()}</td>
                        <td className={`p-2 font-black ${isPaidOut ? 'text-green-600' : 'text-red-500'}`}>{balance.toLocaleString()} FCFA</td>
                        <td className="p-2">
                          {!isPaidOut && (
                            <button onClick={() => handleUpdatePayment(L.id, L.amount_paid, L.total_amount)} className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-1.5 rounded text-xs font-bold flex items-center space-x-1">
                              <DollarSign className="w-3 h-3" /> <span>Nouv. Paiement</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}