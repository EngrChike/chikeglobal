import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import { ShieldCheck, Trash2, Pencil, LogOut, Users, Package } from 'lucide-react'; //[cite: 6]

export default function AdminApp() {
  const [session, setSession] = useState(null); //[cite: 6]
  const [adminEmail, setAdminEmail] = useState(''); //[cite: 6]
  const [adminPassword, setAdminPassword] = useState(''); //[cite: 6]
  const [authError, setAuthError] = useState(''); //[cite: 6]
  const [authLoading, setAuthLoading] = useState(false); //[cite: 6]

  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' or 'customers'
  const [products, setProducts] = useState([]); //[cite: 6]

  // Inventory states
  const [name, setName] = useState(''); //[cite: 6]
  const [price, setPrice] = useState(''); //[cite: 6]
  const [quantity, setQuantity] = useState(''); //[cite: 6]
  const [description, setDescription] = useState(''); //[cite: 6]
  const [batch, setBatch] = useState(''); // NEW BATCH TRACKER
  const [imageFile, setImageFile] = useState(null); //[cite: 6]
  const [uploading, setUploading] = useState(false); //[cite: 6]
  const [editingProduct, setEditingProduct] = useState(null); //[cite: 6]

  // Customer Ledger states
  const [customers, setCustomers] = useState([
    { id: 1, name: 'Mr. Obi', totalDebt: 15000, history: [{ date: '2026-08-20', batch: 'Batch A', goods: '10 Cartons Lotion', total: 50000, paid: 35000 }] }
  ]);
  const [ledgerForm, setLedgerForm] = useState({ customerId: '', newName: '', batchRef: '', goods: '', totalCost: '', initialPaid: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', customerId: null });

  useEffect(() => {
    fetchProducts(); //[cite: 6]
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session)); //[cite: 6]
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session)); //[cite: 6]
    return () => subscription.unsubscribe(); //[cite: 6]
  }, []); //[cite: 6]

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false }); //[cite: 6]
      if (!error && data) setProducts(data); //[cite: 6]
    } catch (err) {
      console.error("Erreur: ", err); //[cite: 6]
    }
  };

  const handleAdminLogin = async (e) => { //[cite: 6]
    e.preventDefault(); //[cite: 6]
    setAuthError(''); //[cite: 6]
    setAuthLoading(true); //[cite: 6]
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword }); //[cite: 6]
      if (error) setAuthError(error.message); //[cite: 6]
      else { setAdminEmail(''); setAdminPassword(''); } //[cite: 6]
    } catch (err) {
      setAuthError('Erreur inattendue.'); //[cite: 6]
    } finally {
      setAuthLoading(false); //[cite: 6]
    }
  }; //[cite: 6]

  const handleAdminLogout = async () => await supabase.auth.signOut(); //[cite: 6]

  // IMAGE COMPRESSOR FUNCTION (from original code) //[cite: 6]
  const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.75) => { //[cite: 6]
    return new Promise((resolve, reject) => { //[cite: 6]
      const reader = new FileReader(); //[cite: 6]
      reader.readAsDataURL(file); //[cite: 6]
      reader.onload = (event) => { //[cite: 6]
        const img = new Image(); //[cite: 6]
        img.src = event.target.result; //[cite: 6]
        img.onload = () => { //[cite: 6]
          const canvas = document.createElement('canvas'); //[cite: 6]
          let width = img.width; let height = img.height; //[cite: 6]
          if (width > height) { if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; } } //[cite: 6]
          else { if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; } } //[cite: 6]
          canvas.width = width; canvas.height = height; //[cite: 6]
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height); //[cite: 6]
          canvas.toBlob((blob) => { //[cite: 6]
            if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() })); //[cite: 6]
            else reject(new Error('Compression failed')); //[cite: 6]
          }, 'image/jpeg', quality); //[cite: 6]
        }; img.onerror = (err) => reject(err); //[cite: 6]
      }; reader.onerror = (err) => reject(err); //[cite: 6]
    }); //[cite: 6]
  }; //[cite: 6]

  const handleAddProduct = async (e) => { //[cite: 6]
    e.preventDefault(); //[cite: 6]
    if (!name || !price || !quantity) return; //[cite: 6]
    setUploading(true); //[cite: 6]
    let image_url = 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=600&q=80'; //[cite: 6]
    try {
      if (imageFile) { //[cite: 6]
        let fileToUpload = await compressImage(imageFile, 800, 800, 0.75); //[cite: 6]
        const fileName = `${Date.now()}_${fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_')}`; //[cite: 6]
        const { error: upErr } = await supabase.storage.from('product-images').upload(fileName, fileToUpload, { upsert: false }); //[cite: 6]
        if (!upErr) {
          const { data } = supabase.storage.from('product-images').getPublicUrl(fileName); //[cite: 6]
          if (data?.publicUrl) image_url = data.publicUrl; //[cite: 6]
        }
      }
      const parsedQty = parseInt(quantity) || 0; //[cite: 6]
      const payload = { name: name.trim(), description: description.trim(), price: parseFloat(price), image_url, quantity: parsedQty, stock_status: parsedQty > 0, batch_reference: batch }; // Added batch
      await supabase.from('products').insert([payload]); //[cite: 6]
      setName(''); setPrice(''); setQuantity(''); setDescription(''); setBatch(''); setImageFile(null); //[cite: 6]
      await fetchProducts(); //[cite: 6]
      alert('Produit publié avec succès !'); //[cite: 6]
    } catch (err) { alert(`Erreur: ${err.message}`); } //[cite: 6]
    finally { setUploading(false); } //[cite: 6]
  }; //[cite: 6]

  const handleUpdateStockVolume = async (id, newVolume) => { //[cite: 6]
    const parsedVolume = parseInt(newVolume) || 0; //[cite: 6]
    const { error } = await supabase.from('products').update({ quantity: parsedVolume, stock_status: parsedVolume > 0 }).eq('id', id); //[cite: 6]
    if (!error) setProducts(prev => prev.map(p => p.id === id ? { ...p, quantity: parsedVolume, stock_status: parsedVolume > 0 } : p)); //[cite: 6]
  }; //[cite: 6]

  const handleDeleteProduct = async (id) => { //[cite: 6]
    if (!window.confirm('Voulez-vous vraiment supprimer cet article de la liste ?')) return; //[cite: 6]
    const { error } = await supabase.from('products').delete().eq('id', id); //[cite: 6]
    if (!error) setProducts(prev => prev.filter(p => p.id !== id)); //[cite: 6]
  }; //[cite: 6]

  // NEW: CUSTOMER LEDGER FUNCTIONS
  const handleRecordSale = (e) => {
    e.preventDefault();
    const tCost = parseFloat(ledgerForm.totalCost) || 0;
    const iPaid = parseFloat(ledgerForm.initialPaid) || 0;
    const balance = tCost - iPaid;
    
    const newTransaction = {
      date: new Date().toISOString().split('T')[0],
      batch: ledgerForm.batchRef,
      goods: ledgerForm.goods,
      total: tCost,
      paid: iPaid
    };

    if (ledgerForm.customerId === 'new') {
      const newCustomer = {
        id: Date.now(),
        name: ledgerForm.newName,
        totalDebt: balance,
        history: [newTransaction]
      };
      setCustomers([...customers, newCustomer]);
    } else {
      setCustomers(customers.map(c => 
        c.id === parseInt(ledgerForm.customerId) 
        ? { ...c, totalDebt: c.totalDebt + balance, history: [...c.history, newTransaction] } 
        : c
      ));
    }
    setLedgerForm({ customerId: '', newName: '', batchRef: '', goods: '', totalCost: '', initialPaid: '' });
    alert('Sale Recorded Successfully!');
  };

  const handleRecordPayment = (e) => {
    e.preventDefault();
    const payAmt = parseFloat(paymentForm.amount) || 0;
    setCustomers(customers.map(c => 
      c.id === paymentForm.customerId 
      ? { 
          ...c, 
          totalDebt: c.totalDebt - payAmt, 
          history: [...c.history, { date: new Date().toLocaleString(), type: 'Payment', paid: payAmt, goods: 'Debt Reconciliation' }]
        } 
      : c
    ));
    setPaymentForm({ amount: '', customerId: null });
    alert('Payment Reconciled Successfully!');
  };

  if (!session) { //[cite: 6]
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-gray-900">Connexion Admin</h2>
            <p className="text-xs text-gray-500 mt-1">Connectez-vous avec vos identifiants Supabase.</p>
            {authError && <p className="text-red-500 text-xs mt-2 font-medium bg-red-50 p-2 rounded-lg">{authError}</p>} 
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 block mb-1">Adresse Email</label>
              <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} className="w-full border p-2.5 rounded-xl text-xs" required />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 block mb-1">Mot de passe</label>
              <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full border p-2.5 rounded-xl text-xs" required />
            </div>
            <button type="submit" disabled={authLoading} className="w-full bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold py-2.5 rounded-xl uppercase tracking-wider">{authLoading ? 'Connexion...' : 'Se connecter'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-900 font-sans p-4 py-8">
      <div className="max-w-7xl mx-auto">
        
        {/* ADMIN HEADER */}
        <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex space-x-4">
            <button onClick={() => setActiveTab('inventory')} className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center space-x-2 ${activeTab === 'inventory' ? 'bg-[#f68b1e] text-white' : 'bg-gray-100 text-gray-600'}`}>
              <Package className="w-4 h-4" /> <span>Inventory & Batches</span>
            </button>
            <button onClick={() => setActiveTab('customers')} className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center space-x-2 ${activeTab === 'customers' ? 'bg-[#f68b1e] text-white' : 'bg-gray-100 text-gray-600'}`}>
              <Users className="w-4 h-4" /> <span>Customer Ledger</span>
            </button>
          </div>
          <button onClick={handleAdminLogout} className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center space-x-1.5">
            <LogOut className="w-3.5 h-3.5" /> <span>Déconnexion</span>
          </button>
        </div>

        {/* TAB 1: INVENTORY & BATCHES */}
        {activeTab === 'inventory' && (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-fit">
              <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 mb-4 pb-2 border-b">Ajouter un nouveau produit (Batch Arrival)</h3>
              <form onSubmit={handleAddProduct} className="space-y-3.5">
                <input type="text" placeholder="Nom du produit" value={name} onChange={e => setName(e.target.value)} className="w-full border p-2 text-xs rounded-lg" required />
                <input type="text" placeholder="Batch Number (e.g., Batch B)" value={batch} onChange={e => setBatch(e.target.value)} className="w-full border p-2 text-xs rounded-lg" required />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Prix (FCFA)" value={price} onChange={e => setPrice(e.target.value)} className="w-full border p-2 text-xs rounded-lg" required />
                  <input type="number" placeholder="Quantité" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border p-2 text-xs rounded-lg" required />
                </div>
                <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full border p-2 text-xs rounded-lg h-14" />
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="w-full text-xs text-gray-500" />
                <button type="submit" disabled={uploading} className="w-full bg-[#f68b1e] text-white text-xs py-2 rounded-lg font-bold uppercase">{uploading ? 'Traitement...' : 'Publier le produit'}</button>
              </form>
            </div>

            <div className="md:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 mb-4 pb-2 border-b">Gestionnaire de Catalogue</h3>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-400 font-bold border-b">
                    <th className="p-2.5">Article</th>
                    <th className="p-2.5">Batch</th>
                    <th className="p-2.5 text-center">En Stock</th>
                    <th className="p-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="p-2.5 font-extrabold">{p.name}</td>
                      <td className="p-2.5 text-gray-500">{p.batch_reference || 'N/A'}</td>
                      <td className="p-2.5 text-center">
                        <input type="number" value={p.quantity !== null ? p.quantity : 0} onChange={(e) => handleUpdateStockVolume(p.id, e.target.value)} className="w-14 border text-center p-0.5 rounded" />
                      </td>
                      <td className="p-2.5 text-center">
                        <button onClick={() => handleDeleteProduct(p.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: CUSTOMER LEDGER */}
        {activeTab === 'customers' && (
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* RECORD NEW SALE */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-fit">
              <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 mb-4 pb-2 border-b">Record New Sale</h3>
              <form onSubmit={handleRecordSale} className="space-y-3.5">
                <select value={ledgerForm.customerId} onChange={e => setLedgerForm({...ledgerForm, customerId: e.target.value})} className="w-full border p-2 text-xs rounded-lg" required>
                  <option value="">-- Select Customer --</option>
                  <option value="new">+ Register New Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                
                {ledgerForm.customerId === 'new' && (
                  <input type="text" placeholder="New Customer Name" value={ledgerForm.newName} onChange={e => setLedgerForm({...ledgerForm, newName: e.target.value})} className="w-full border p-2 text-xs rounded-lg" required />
                )}
                
                <input type="text" placeholder="Batch Ref (e.g., Batch B)" value={ledgerForm.batchRef} onChange={e => setLedgerForm({...ledgerForm, batchRef: e.target.value})} className="w-full border p-2 text-xs rounded-lg" required />
                <textarea placeholder="Goods Purchased (e.g., 5 Cartons)" value={ledgerForm.goods} onChange={e => setLedgerForm({...ledgerForm, goods: e.target.value})} className="w-full border p-2 text-xs rounded-lg h-14" required />
                
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Total Cost" value={ledgerForm.totalCost} onChange={e => setLedgerForm({...ledgerForm, totalCost: e.target.value})} className="w-full border p-2 text-xs rounded-lg" required />
                  <input type="number" placeholder="Initial Paid" value={ledgerForm.initialPaid} onChange={e => setLedgerForm({...ledgerForm, initialPaid: e.target.value})} className="w-full border p-2 text-xs rounded-lg" required />
                </div>
                
                <button type="submit" className="w-full bg-black text-white text-xs py-2 rounded-lg font-bold uppercase">Save Sale</button>
              </form>
            </div>

            {/* CUSTOMER DEBT BOARD */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 mb-4 pb-2 border-b">Customer Balances & Payments</h3>
                <div className="grid grid-cols-2 gap-4">
                  {customers.map(c => (
                    <div key={c.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-black text-sm">{c.name}</h4>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${c.totalDebt > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                          Balance: {c.totalDebt.toLocaleString()}
                        </span>
                      </div>
                      
                      {/* PAYMENT RECONCILIATION FORM */}
                      {c.totalDebt > 0 && (
                        <form onSubmit={handleRecordPayment} className="mt-3 flex space-x-2">
                          <input type="number" placeholder="Amount Paid" value={paymentForm.customerId === c.id ? paymentForm.amount : ''} onChange={e => setPaymentForm({ amount: e.target.value, customerId: c.id })} className="w-full border p-1.5 text-xs rounded" required />
                          <button type="submit" className="bg-green-600 text-white text-[10px] px-3 rounded font-bold">Pay</button>
                        </form>
                      )}

                      <div className="mt-4 pt-3 border-t">
                        <p className="text-[10px] font-bold text-gray-400 mb-1">HISTORY:</p>
                        <ul className="text-[10px] space-y-1 text-gray-600 max-h-20 overflow-y-auto">
                          {c.history.map((h, i) => (
                            <li key={i}>• {h.date}: {h.goods} ({h.batch || h.type}) | Paid: {h.paid}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}