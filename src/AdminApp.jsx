import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import { ShieldCheck, Trash2, Pencil, LogOut, Users, Package, Phone, CheckCircle, X } from 'lucide-react';

export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' or 'customers'
  const [products, setProducts] = useState([]);

  // Inventory states
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [batch, setBatch] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Customer Ledger states
  const [customers, setCustomers] = useState([
    { 
      id: 1, 
      name: 'Mr. Obi', 
      phone: '+225 07000000', 
      totalDebt: 15000, 
      history: [{ date: '2026-08-20', batch: 'Batch A', goods: '10 Cartons Lotion', total: 50000, paid: 35000 }] 
    }
  ]);
  const [ledgerForm, setLedgerForm] = useState({ customerId: '', newName: '', newPhone: '', batchRef: '', goods: '', totalCost: '', initialPaid: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', customerId: null });
  const [editingCustomer, setEditingCustomer] = useState(null);

  useEffect(() => {
    fetchProducts();
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (!error && data) setProducts(data);
    } catch (err) {
      console.error("Erreur: ", err);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
      if (error) setAuthError(error.message);
      else { setAdminEmail(''); setAdminPassword(''); }
    } catch (err) {
      setAuthError('Erreur inattendue.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = async () => await supabase.auth.signOut();

  // IMAGE COMPRESSOR FUNCTION
  const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.75) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width; let height = img.height;
          if (width > height) { if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; } }
          else { if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
            else reject(new Error('Compression failed'));
          }, 'image/jpeg', quality);
        }; img.onerror = (err) => reject(err);
      }; reader.onerror = (err) => reject(err);
    });
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!name || !price || !quantity) return;
    setUploading(true);
    let image_url = editingProduct ? editingProduct.image_url : 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=600&q=80';
    try {
      if (imageFile) {
        let fileToUpload = await compressImage(imageFile, 800, 800, 0.75);
        const fileName = `${Date.now()}_${fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { error: upErr } = await supabase.storage.from('product-images').upload(fileName, fileToUpload, { upsert: false });
        if (!upErr) {
          const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
          if (data?.publicUrl) image_url = data.publicUrl;
        }
      }
      const parsedQty = parseInt(quantity) || 0;
      const payload = { 
        name: name.trim(), 
        description: description.trim(), 
        price: parseFloat(price), 
        image_url, 
        quantity: parsedQty, 
        stock_status: parsedQty > 0, 
        batch_reference: batch 
      };

      if (editingProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
        if (error) throw error;
        alert('Produit mis à jour avec succès !');
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
        alert('Produit publié avec succès !');
      }

      setName(''); setPrice(''); setQuantity(''); setDescription(''); setBatch(''); setImageFile(null); setEditingProduct(null);
      await fetchProducts();
    } catch (err) { alert(`Erreur: ${err.message}`); }
    finally { setUploading(false); }
  };

  const handleStartEditProduct = (p) => {
    setEditingProduct(p);
    setName(p.name);
    setPrice(p.price);
    setQuantity(p.quantity);
    setDescription(p.description || '');
    setBatch(p.batch_reference || '');
  };

  const handleCancelEditProduct = () => {
    setEditingProduct(null);
    setName(''); setPrice(''); setQuantity(''); setDescription(''); setBatch(''); setImageFile(null);
  };

  const handleUpdateStockVolume = async (id, newVolume) => {
    const parsedVolume = parseInt(newVolume) || 0;
    const { error } = await supabase.from('products').update({ quantity: parsedVolume, stock_status: parsedVolume > 0 }).eq('id', id);
    if (!error) setProducts(prev => prev.map(p => p.id === id ? { ...p, quantity: parsedVolume, stock_status: parsedVolume > 0 } : p));
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet article de la liste ?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) setProducts(prev => prev.filter(p => p.id !== id));
  };

  // CUSTOMER LEDGER FUNCTIONS
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
        phone: ledgerForm.newPhone,
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
    setLedgerForm({ customerId: '', newName: '', newPhone: '', batchRef: '', goods: '', totalCost: '', initialPaid: '' });
    alert('Sale / Add-on Recorded Successfully!');
  };

  const handleRecordPayment = (e) => {
    e.preventDefault();
    const payAmt = parseFloat(paymentForm.amount) || 0;
    setCustomers(customers.map(c => 
      c.id === paymentForm.customerId 
      ? { 
          ...c, 
          totalDebt: c.totalDebt - payAmt, 
          history: [...c.history, { date: new Date().toLocaleString(), type: 'Payment', paid: payAmt, goods: 'Debt Reconciliation', total: 0 }]
        } 
      : c
    ));
    setPaymentForm({ amount: '', customerId: null });
    alert('Payment Reconciled Successfully!');
  };

  const handleSaveCustomerEdit = (e) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setCustomers(customers.map(c => c.id === editingCustomer.id ? { ...c, name: editingCustomer.name, phone: editingCustomer.phone } : c));
    setEditingCustomer(null);
    alert('Customer details updated!');
  };

  // Live calculation preview variables for sale form
  const previewTotal = parseFloat(ledgerForm.totalCost) || 0;
  const previewPaid = parseFloat(ledgerForm.initialPaid) || 0;
  const previewBalanceDue = previewTotal - previewPaid;

  if (!session) {
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
              <div className="flex justify-between items-center mb-4 pb-2 border-b">
                <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700">
                  {editingProduct ? 'Modifier le produit' : 'Ajouter un produit (Batch)'}
                </h3>
                {editingProduct && (
                  <button onClick={handleCancelEditProduct} className="text-gray-400 hover:text-red-500 text-xs flex items-center">
                    <X className="w-3.5 h-3.5 mr-1" /> Annuler
                  </button>
                )}
              </div>
              <form onSubmit={handleSaveProduct} className="space-y-3.5">
                <input type="text" placeholder="Nom du produit" value={name} onChange={e => setName(e.target.value)} className="w-full border p-2 text-xs rounded-lg" required />
                <input type="text" placeholder="Batch Number (e.g., Batch B)" value={batch} onChange={e => setBatch(e.target.value)} className="w-full border p-2 text-xs rounded-lg" required />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Prix (FCFA)" value={price} onChange={e => setPrice(e.target.value)} className="w-full border p-2 text-xs rounded-lg" required />
                  <input type="number" placeholder="Quantité" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border p-2 text-xs rounded-lg" required />
                </div>
                <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full border p-2 text-xs rounded-lg h-14" />
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="w-full text-xs text-gray-500" />
                <button type="submit" disabled={uploading} className="w-full bg-[#f68b1e] text-white text-xs py-2 rounded-lg font-bold uppercase">
                  {uploading ? 'Traitement...' : editingProduct ? 'Enregistrer les modifications' : 'Publier le produit'}
                </button>
              </form>
            </div>

            <div className="md:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 mb-4 pb-2 border-b">Gestionnaire de Catalogue</h3>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-400 font-bold border-b">
                    <th className="p-2.5">Image</th>
                    <th className="p-2.5">Article</th>
                    <th className="p-2.5">Batch</th>
                    <th className="p-2.5">Prix</th>
                    <th className="p-2.5 text-center">En Stock</th>
                    <th className="p-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="p-2.5">
                        <img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover rounded-lg border" />
                      </td>
                      <td className="p-2.5 font-extrabold">{p.name}</td>
                      <td className="p-2.5 text-gray-500">{p.batch_reference || 'N/A'}</td>
                      <td className="p-2.5 font-semibold text-orange-600">{p.price?.toLocaleString()} FCFA</td>
                      <td className="p-2.5 text-center">
                        <input type="number" value={p.quantity !== null ? p.quantity : 0} onChange={(e) => handleUpdateStockVolume(p.id, e.target.value)} className="w-14 border text-center p-0.5 rounded" />
                      </td>
                      <td className="p-2.5 text-center space-x-2">
                        <button onClick={() => handleStartEditProduct(p)} className="text-blue-500 hover:text-blue-700" title="Modifier">
                          <Pencil className="w-4 h-4 inline" />
                        </button>
                        <button onClick={() => handleDeleteProduct(p.id)} className="text-red-400 hover:text-red-600" title="Supprimer">
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
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
            
            {/* RECORD NEW SALE / ADD-ON ITEMS */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-fit">
              <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 mb-4 pb-2 border-b">Record Sale / Add Items</h3>
              <form onSubmit={handleRecordSale} className="space-y-3.5">
                <select value={ledgerForm.customerId} onChange={e => setLedgerForm({...ledgerForm, customerId: e.target.value})} className="w-full border p-2 text-xs rounded-lg" required>
                  <option value="">-- Select Customer --</option>
                  <option value="new">+ Register New Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone || 'No phone'})</option>)}
                </select>
                
                {ledgerForm.customerId === 'new' && (
                  <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
                    <input type="text" placeholder="New Customer Name" value={ledgerForm.newName} onChange={e => setLedgerForm({...ledgerForm, newName: e.target.value})} className="w-full border p-2 text-xs rounded-lg bg-white" required />
                    <input type="text" placeholder="Phone Number (e.g., +225...)" value={ledgerForm.newPhone} onChange={e => setLedgerForm({...ledgerForm, newPhone: e.target.value})} className="w-full border p-2 text-xs rounded-lg bg-white" required />
                  </div>
                )}
                
                <input type="text" placeholder="Batch Ref (e.g., Batch B)" value={ledgerForm.batchRef} onChange={e => setLedgerForm({...ledgerForm, batchRef: e.target.value})} className="w-full border p-2 text-xs rounded-lg" required />
                <textarea placeholder="Goods Purchased / Additional Items (e.g., 5 Cartons Lotion)" value={ledgerForm.goods} onChange={e => setLedgerForm({...ledgerForm, goods: e.target.value})} className="w-full border p-2 text-xs rounded-lg h-14" required />
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold block mb-1">Total Cost (FCFA)</label>
                    <input type="number" placeholder="Total Cost" value={ledgerForm.totalCost} onChange={e => setLedgerForm({...ledgerForm, totalCost: e.target.value})} className="w-full border p-2 text-xs rounded-lg" required />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold block mb-1">Initial Paid (FCFA)</label>
                    <input type="number" placeholder="Initial Paid" value={ledgerForm.initialPaid} onChange={e => setLedgerForm({...ledgerForm, initialPaid: e.target.value})} className="w-full border p-2 text-xs rounded-lg" required />
                  </div>
                </div>

                {/* LIVE PREVIEW TOTAL */}
                {ledgerForm.totalCost !== '' && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between text-gray-600">
                      <span>Total Amount:</span>
                      <span className="font-bold">{previewTotal.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Amount Paid Now:</span>
                      <span className="font-bold text-green-600">{previewPaid.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between border-t border-orange-200 pt-1 text-orange-900 font-extrabold">
                      <span>Added to Debt Balance:</span>
                      <span>{previewBalanceDue > 0 ? `${previewBalanceDue.toLocaleString()} FCFA` : '0 FCFA (Fully Paid)'}</span>
                    </div>
                  </div>
                )}
                
                <button type="submit" className="w-full bg-black text-white text-xs py-2 rounded-lg font-bold uppercase">Save Sale / Add Items</button>
              </form>
            </div>

            {/* CUSTOMER DEBT BOARD & EDIT MODAL */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 mb-4 pb-2 border-b">Customer Balances & History</h3>
                
                {/* Edit Customer Inline Box if active */}
                {editingCustomer && (
                  <form onSubmit={handleSaveCustomerEdit} className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-xs text-blue-900 uppercase">Edit Customer Details</h4>
                      <button type="button" onClick={() => setEditingCustomer(null)} className="text-gray-400 hover:text-red-500 text-xs">Cancel</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" value={editingCustomer.name} onChange={e => setEditingCustomer({...editingCustomer, name: e.target.value})} className="border p-2 text-xs rounded bg-white" required placeholder="Name" />
                      <input type="text" value={editingCustomer.phone} onChange={e => setEditingCustomer({...editingCustomer, phone: e.target.value})} className="border p-2 text-xs rounded bg-white" required placeholder="Phone" />
                    </div>
                    <button type="submit" className="bg-blue-600 text-white text-xs px-4 py-1.5 rounded font-bold">Update Customer Info</button>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customers.map(c => (
                    <div key={c.id} className="border rounded-xl p-4 bg-gray-50 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <h4 className="font-black text-sm">{c.name}</h4>
                            <p className="text-[11px] text-gray-500 flex items-center"><Phone className="w-3 h-3 mr-1" /> {c.phone || 'No phone registered'}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button onClick={() => setEditingCustomer(c)} className="text-gray-400 hover:text-blue-600 text-xs" title="Edit Customer">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${c.totalDebt > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                              Balance: {c.totalDebt.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        
                        {/* PAYMENT RECONCILIATION FORM */}
                        {c.totalDebt > 0 && (
                          <form onSubmit={handleRecordPayment} className="mt-3 flex space-x-2">
                            <input type="number" placeholder="Payment Amount" value={paymentForm.customerId === c.id ? paymentForm.amount : ''} onChange={e => setPaymentForm({ amount: e.target.value, customerId: c.id })} className="w-full border p-1.5 text-xs rounded bg-white" required />
                            <button type="submit" className="bg-green-600 text-white text-[10px] px-3 rounded font-bold">Record Pay</button>
                          </form>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t">
                        <p className="text-[10px] font-bold text-gray-400 mb-1">PURCHASE & PAYMENT HISTORY:</p>
                        <ul className="text-[10px] space-y-1 text-gray-600 max-h-28 overflow-y-auto">
                          {c.history.map((h, i) => (
                            <li key={i} className="bg-white p-1.5 rounded border border-gray-100">
                              <span className="font-bold text-gray-700">{h.date}</span>: {h.goods} <span className="text-orange-600">({h.batch || h.type})</span> | Total: {h.total?.toLocaleString()} | Paid: <span className="text-green-600 font-bold">{h.paid?.toLocaleString()}</span>
                            </li>
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