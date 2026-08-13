import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import { ShoppingCart, ShieldCheck, Smartphone, Star, Heart, Trash2, Pencil, Video, Search, X, LogOut } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('client'); 
  
  // REAL SUPABASE AUTHENTICATION STATES
  const [session, setSession] = useState(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // REALTIME SEARCH ENGINE STATE
  const [searchTerm, setSearchTerm] = useState('');

  // Form states (used for both Add and Edit)
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Edit target tracker
  const [editingProduct, setEditingProduct] = useState(null);

  // OFFICIAL LINKS & HANDLES
  const WHATSAPP_NUMBER = '2250100130109'; 
  const FACEBOOK_URL = 'https://facebook.com/profile.php?id=61590626370497'; 
  const TIKTOK_URL = 'https://tiktok.com/@your-profile'; 

  useEffect(() => {
    fetchProducts();

    // Check existing active Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth state changes (login/logout events)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) setProducts(data);
    } catch (err) {
      console.error("Erreur de récupération: ", err);
    }
  };

  // SECURE SUPABASE AUTH LOGIN
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });

      if (error) {
        setAuthError(error.message);
      } else {
        setAdminEmail('');
        setAdminPassword('');
      }
    } catch (err) {
      setAuthError('Une erreur d\'authentification inattendue est survenue.');
    } finally {
      setAuthLoading(false);
    }
  };

  // LOGOUT HANDLER
  const handleAdminLogout = async () => {
    await supabase.auth.signOut();
    cancelEdit();
    setView('client');
  };

  const handleViewToggle = () => {
    if (view === 'client') {
      setView('admin');
    } else {
      cancelEdit();
      setView('client');
    }
  };

  // HELPER FUNCTION: AUTOMATIC IMAGE COMPRESSOR
  const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.75) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error('Échec de la compression d\'image'));
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const addToCart = (product) => {
    const stockAvailable = product.quantity !== null ? product.quantity : (product.stock_status ? 999 : 0);
    if (stockAvailable <= 0) return;

    setCart(curr => {
      const found = curr.find(item => item.id === product.id);
      if (found) {
        return curr.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity < stockAvailable ? item.quantity + 1 : item.quantity } 
            : item
        );
      }
      return [...curr, { ...product, quantity: 1 }];
    });
  };

  const getProductCartQty = (productId) => {
    const item = cart.find(i => i.id === productId);
    return item ? item.quantity : 0;
  };

  const changeQuantity = (product, delta) => {
    const currentQty = getProductCartQty(product.id);
    const newQty = currentQty + delta;
    const stockAvailable = product.quantity !== null ? product.quantity : (product.stock_status ? 999 : 0);

    if (newQty <= 0) {
      setCart(curr => curr.filter(i => i.id !== product.id));
    } else if (newQty <= stockAvailable) {
      setCart(curr => curr.map(i => i.id === product.id ? { ...i, quantity: newQty } : i));
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleWhatsAppCheckout = () => {
    if (cart.length === 0) return;
    let msg = '✨ *DONCHIKE COSMETICS - NOUVELLE COMMANDE* ✨\n------------------------------------------\n\n';
    cart.forEach((item, idx) => {
      msg += `🛍️ *${idx + 1}. ${item.name}*\n   Prix: ${item.price.toLocaleString()} FCFA\n   Qté: ${item.quantity}\n------------------------------------------\n`;
    });
    msg += `\n🎯 *TOTAL GÉNÉRAL:* ${cartTotal.toLocaleString()} FCFA\n\nMerci de confirmer la disponibilité pour expédition immédiate !`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleUpdateStockVolume = async (id, newVolume) => {
    const parsedVolume = parseInt(newVolume) || 0;
    const { error } = await supabase
      .from('products')
      .update({ 
        quantity: parsedVolume,
        stock_status: parsedVolume > 0 
      })
      .eq('id', id);

    if (!error) {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, quantity: parsedVolume, stock_status: parsedVolume > 0 } : p));
    } else {
      alert(`Permission refusée: ${error.message}`);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet article de la liste ?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) {
      setProducts(prev => prev.filter(p => p.id !== id));
    } else {
      alert(`Erreur de suppression: ${error.message}`);
    }
  };

  const startEditProduct = (product) => {
    setEditingProduct(product);
    setName(product.name);
    setPrice(product.price);
    setQuantity(product.quantity);
    setDescription(product.description || '');
    setImageFile(null);
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setName('');
    setPrice('');
    setQuantity('');
    setDescription('');
    setImageFile(null);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!name || !price || !quantity) return;
    setUploading(true);
    
    let image_url = 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=600&q=80';

    try {
      if (imageFile) {
        let fileToUpload = imageFile;
        try {
          fileToUpload = await compressImage(imageFile, 800, 800, 0.75);
        } catch (compressionError) {
          console.warn("Échec de la compression d'image, tentative d'envoi de l'original:", compressionError);
        }

        const cleanName = fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `${Date.now()}_${cleanName}`;
        
        const { error: upErr } = await supabase.storage
          .from('product-images') 
          .upload(fileName, fileToUpload, { cacheControl: '3600', upsert: false });

        if (!upErr) {
          const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
          if (data?.publicUrl) image_url = data.publicUrl;
        } else {
          throw upErr;
        }
      }

      const parsedQty = parseInt(quantity) || 0;
      const payload = {
        name: String(name).trim(),
        description: String(description || '').trim(),
        price: parseFloat(price),
        image_url: image_url,
        quantity: parsedQty,
        stock_status: parsedQty > 0
      };

      const { error: insErr } = await supabase.from('products').insert([payload]);
      if (insErr) throw insErr;

      setName('');
      setPrice('');
      setQuantity('');
      setDescription('');
      setImageFile(null);
      
      await fetchProducts();
      alert('Produit publié avec succès !');
    } catch (err) {
      console.error(err);
      alert(`Erreur d'importation/base de données: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    setUploading(true);

    let image_url = editingProduct.image_url;

    try {
      if (imageFile) {
        let fileToUpload = imageFile;
        try {
          fileToUpload = await compressImage(imageFile, 800, 800, 0.75);
        } catch (compressionError) {
          console.warn("Échec de la compression d'image, utilisation de l'original:", compressionError);
        }

        const cleanName = fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `${Date.now()}_${cleanName}`;

        const { error: upErr } = await supabase.storage
          .from('product-images')
          .upload(fileName, fileToUpload, { cacheControl: '3600', upsert: false });

        if (!upErr) {
          const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
          if (data?.publicUrl) image_url = data.publicUrl;
        } else {
          throw upErr;
        }
      }

      const parsedQty = parseInt(quantity) || 0;
      const payload = {
        name: String(name).trim(),
        description: String(description || '').trim(),
        price: parseFloat(price),
        image_url: image_url,
        quantity: parsedQty,
        stock_status: parsedQty > 0
      };

      const { error: updErr } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editingProduct.id);

      if (updErr) throw updErr;

      cancelEdit();
      await fetchProducts();
      alert('Produit mis à jour avec succès !');
    } catch (err) {
      console.error(err);
      alert(`Erreur de mise à jour: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // REALTIME SEARCH FILTER LOGIC
  const filteredProducts = products.filter(product => {
    const pName = product.name ? product.name.toLowerCase() : '';
    const pDesc = product.description ? product.description.toLowerCase() : '';
    const query = searchTerm.toLowerCase();
    return pName.includes(query) || pDesc.includes(query);
  });

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-900 font-sans antialiased relative">
      
      {/* BRAND HEADER */}
      <header className="bg-white text-black sticky top-0 z-40 shadow-sm border-b border-gray-100 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          
          {/* NEW MODERN LUXURY LOGO */}
          <div 
            className="flex items-center space-x-2.5 cursor-pointer shrink-0 group select-none" 
            onClick={() => { cancelEdit(); setView('client'); setSearchTerm(''); }}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-200 p-1.5">
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white">
                <path 
                  d="M30 25 C30 25, 45 15, 50 15 C55 15, 70 25, 70 25 C70 45, 60 75, 50 85 C40 75, 30 45, 30 25 Z" 
                  stroke="currentColor" 
                  strokeWidth="6" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <circle cx="50" cy="42" r="7" fill="currentColor" />
                <path 
                  d="M40 60 C45 65, 55 65, 60 60" 
                  stroke="currentColor" 
                  strokeWidth="6" 
                  strokeLinecap="round" 
                />
              </svg>
            </div>

            <div className="flex flex-col justify-center">
              <span className="font-black text-base sm:text-xl tracking-wider uppercase text-zinc-900 leading-none group-hover:text-amber-600 transition-colors">
                DONCHIKE
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-amber-500 tracking-[0.25em] uppercase leading-tight mt-0.5">
                COSMETICS
              </span>
            </div>
          </div>

          {/* Action Area */}
          <div className="flex items-center space-x-2 sm:space-x-4 ml-auto">
            
            {/* SOCIAL ICONS GROUP */}
            <div className="flex items-center space-x-1 sm:space-x-2 border-r border-gray-200 pr-2 sm:pr-4 shrink-0">
              <a 
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank" 
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors flex items-center justify-center"
                title="Discuter sur WhatsApp"
              >
                <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </a>

              <a 
                href={FACEBOOK_URL} 
                target="_blank" 
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-xs transition-colors w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center"
                title="Suivre sur Facebook"
              >
                f
              </a>

              <a 
                href={TIKTOK_URL} 
                target="_blank" 
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 text-zinc-900 transition-colors flex items-center justify-center"
                title="Suivre sur TikTok"
              >
                <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </a>
            </div>

            {/* Admin Portal Toggle */}
            <button 
              onClick={handleViewToggle} 
              className="px-2 py-1.5 text-xs rounded-xl font-bold border border-gray-200 hover:bg-gray-50 text-gray-700 flex items-center space-x-1 shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#f68b1e]" />
              <span className="hidden md:inline">{view === 'client' ? 'Espace Admin' : 'Retour à la boutique'}</span>
            </button>

            {/* Header Cart Button */}
            {view === 'client' && (
              <button 
                onClick={() => setIsCartOpen(true)} 
                className="relative bg-black text-white p-2.5 rounded-xl flex items-center space-x-2 hover:bg-zinc-800 transition-colors shrink-0"
              >
                <ShoppingCart className="w-4 h-4" />
                {cartCount > 0 && (
                  <span className="bg-[#f68b1e] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    {cartCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* CLIENT APP VIEW */}
      {view === 'client' && (
        <main className="max-w-7xl w-full mx-auto p-4 md:py-8">
          
          {/* Hero Banner */}
          <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950 text-white rounded-2xl p-6 md:p-8 mb-6 border border-zinc-800 flex flex-col md:flex-row justify-between items-center">
            <div>
              <span className="bg-[#f68b1e]/10 text-[#f68b1e] text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-[#f68b1e]/20">
                ✨ Meilleure Expérience d'Achat
              </span>
              <h1 className="text-xl md:text-3xl font-black mt-2.5 tracking-tight">Collection Don Chike Cosmetics</h1>
              <p className="text-zinc-400 text-xs mt-1">Sélectionnez vos articles et passez votre commande instantanément via WhatsApp.</p>
            </div>
            <div className="bg-white/5 px-4 py-2.5 rounded-xl border border-white/10 mt-4 md:mt-0">
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Livraison Rapide</p>
              <p className="text-[#f68b1e] font-bold text-sm flex items-center justify-center space-x-1 mt-0.5">
                <Smartphone className="w-3.5 h-3.5" /> <span>Commande via WhatsApp</span>
              </p>
            </div>
          </div>

          {/* SEARCH BOX INTERFACE */}
          <div className="max-w-md mx-auto mb-8 relative px-1">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
              <input 
                type="text" 
                placeholder="Rechercher un produit, une marque, un soin..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white text-sm text-black border border-gray-200 pl-10 pr-10 py-2.5 rounded-xl focus:outline-none focus:border-[#f68b1e] focus:ring-1 focus:ring-[#f68b1e] transition-all shadow-xs"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-3 p-1 rounded-full text-gray-400 hover:text-black hover:bg-gray-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchTerm && (
              <p className="text-[11px] text-gray-400 mt-1.5 ml-1">
                Résultats pour « <span className="text-zinc-700 font-medium">{searchTerm}</span> » ({filteredProducts.length} produits trouvés)
              </p>
            )}
          </div>

          {/* SEARCH RESULTS LAYOUT TARGET */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
              <p className="text-gray-400 text-sm">Aucun produit ne correspond à votre recherche.</p>
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="mt-2 text-xs text-[#f68b1e] font-bold hover:underline">
                  Effacer la recherche
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {filteredProducts.map((p) => {
                const itemQtyInCart = getProductCartQty(p.id);
                const isOutOfStock = p.quantity !== null ? p.quantity <= 0 : !p.stock_status;

                return (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-200/60 overflow-hidden flex flex-col justify-between group transition-all duration-300 hover:shadow-lg relative">
                    
                    <button className="absolute top-2 right-2 z-10 p-1.5 bg-white rounded-full shadow-sm text-gray-400 hover:text-red-500">
                      <Heart className="w-3.5 h-3.5" />
                    </button>

                    <div className="relative bg-gray-50 aspect-[4/5] w-full overflow-hidden flex items-center justify-center border-b border-gray-100">
                      <img src={p.image_url} alt={p.name} className="object-cover w-full h-full" />
                      
                      <div className="absolute bottom-2 left-2 z-10">
                        <span className="bg-[#f68b1e] text-white font-bold text-[10px] px-2 py-0.5 rounded shadow-md">
                          {p.quantity > 0 ? `${p.quantity} en stock` : 'Rupture de stock'}
                        </span>
                      </div>

                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex items-center justify-center">
                          <span className="bg-zinc-800 text-white font-bold text-[10px] uppercase tracking-widest px-2.5 py-1 rounded">ÉPUISÉ</span>
                        </div>
                      )}
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between bg-white">
                      <div>
                        <div className="flex items-center space-x-1 mb-1">
                          <span className="font-extrabold text-xs text-zinc-900 group-hover:text-[#f68b1e] transition-colors">DONCHIKE</span>
                          <span className="text-blue-500 text-[10px] font-bold">✔</span>
                        </div>
                        <h3 className="text-sm md:text-base text-black line-clamp-2 min-h-[2.5rem] leading-tight font-extrabold">
                          {p.name} {p.description && <span className="font-normal text-gray-500 text-xs"> • {p.description}</span>}
                        </h3>
                        
                        <div className="flex items-center space-x-1 mt-1.5">
                          <div className="flex text-amber-400">
                            {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium">(4.9)</span>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        {/* PRODUCT PRICE WITH "Prix: " PREFIX */}
                        <p className="text-lg md:text-xl font-black text-[#f68b1e] tracking-tight mb-2">Prix: {p.price.toLocaleString()} FCFA</p>

                        <div className="mt-2.5">
                          {isOutOfStock ? (
                            <button disabled className="w-full bg-gray-100 text-gray-400 text-[11px] font-bold py-1.5 rounded-lg cursor-not-allowed">
                              Rupture de stock
                            </button>
                          ) : itemQtyInCart > 0 ? (
                            <div className="flex items-center justify-between border border-[#f68b1e] rounded-lg overflow-hidden bg-white h-7 shadow-sm">
                              <button onClick={() => changeQuantity(p, -1)} className="bg-[#f68b1e]/5 text-[#f68b1e] w-8 h-full flex items-center justify-center font-bold">-</button>
                              <span className="w-full text-center text-xs font-black text-black">{itemQtyInCart}</span>
                              <button onClick={() => changeQuantity(p, 1)} className="bg-[#f68b1e]/5 text-[#f68b1e] w-8 h-full flex items-center justify-center font-bold">+</button>
                            </div>
                          ) : (
                            <button onClick={() => addToCart(p)} className="w-full bg-[#f68b1e] hover:bg-[#e07a16] text-white font-bold py-1.5 rounded-lg text-xs tracking-wide transition-all">
                              Ajouter au panier
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* ADMIN CONTROL PANEL */}
      {view === 'admin' && (
        <main className="max-w-7xl w-full mx-auto p-4 py-8">
          {!session ? (
            /* SECURE SUPABASE AUTH LOGIN FORM */
            <div className="max-w-sm mx-auto bg-white rounded-2xl border border-gray-200 p-6 mt-10 shadow-sm">
              <div className="text-center mb-5">
                <h2 className="text-lg font-bold text-gray-900">Connexion Admin</h2>
                <p className="text-xs text-gray-500 mt-1">Connectez-vous avec vos identifiants Supabase.</p>
                {authError && <p className="text-red-500 text-xs mt-2 font-medium bg-red-50 p-2 rounded-lg">{authError}</p>}
              </div>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-500 block mb-1">Adresse Email</label>
                  <input 
                    type="email" 
                    placeholder="admin@donchike.com" 
                    value={adminEmail} 
                    onChange={e => setAdminEmail(e.target.value)} 
                    className="w-full border p-2.5 rounded-xl text-xs bg-white text-black focus:outline-none focus:border-[#f68b1e]" 
                    required 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-500 block mb-1">Mot de passe</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={adminPassword} 
                    onChange={e => setAdminPassword(e.target.value)} 
                    className="w-full border p-2.5 rounded-xl text-xs bg-white text-black focus:outline-none focus:border-[#f68b1e]" 
                    required 
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={authLoading}
                  className="w-full bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold py-2.5 rounded-xl uppercase tracking-wider transition-all"
                >
                  {authLoading ? 'Connexion en cours...' : 'Se connecter'}
                </button>
              </form>
            </div>
          ) : (
            <div>
              {/* ADMIN HEADER TOOLBAR */}
              <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400">Session Authentifiée</p>
                  <p className="text-xs font-bold text-gray-800">{session.user.email}</p>
                </div>
                <button 
                  onClick={handleAdminLogout} 
                  className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center space-x-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Déconnexion</span>
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                
                {/* Product Form (Add & Edit) */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-fit">
                  <div className="flex justify-between items-center pb-2 border-b mb-4">
                    <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700">
                      {editingProduct ? 'Modifier le produit' : 'Ajouter un nouveau produit'}
                    </h3>
                    {editingProduct && (
                      <button 
                        onClick={cancelEdit} 
                        className="text-xs text-red-500 hover:text-red-700 font-bold hover:underline"
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                  
                  <form onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct} className="space-y-3.5">
                    <input 
                      type="text" 
                      placeholder="Nom du produit" 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      className="w-full border p-2 text-xs rounded-lg bg-white text-black" 
                      required 
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input 
                        type="number" 
                        placeholder="Prix (FCFA)" 
                        value={price} 
                        onChange={e => setPrice(e.target.value)} 
                        className="w-full border p-2 text-xs rounded-lg bg-white text-black" 
                        required 
                      />
                      <input 
                        type="number" 
                        placeholder="Quantité en stock" 
                        value={quantity} 
                        onChange={e => setQuantity(e.target.value)} 
                        className="w-full border p-2 text-xs rounded-lg bg-white text-black" 
                        required 
                      />
                    </div>
                    <textarea 
                      placeholder="Description" 
                      value={description} 
                      onChange={e => setDescription(e.target.value)} 
                      className="w-full border p-2 text-xs rounded-lg h-14 bg-white text-black" 
                    />
                    
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 block font-bold uppercase">
                        {editingProduct ? 'Changer l\'image du produit (Optionnel)' : 'Image du produit'}
                      </label>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={e => setImageFile(e.target.files[0])} 
                        className="w-full text-xs text-gray-500" 
                      />
                    </div>
                    
                    <button 
                      type="submit" 
                      disabled={uploading} 
                      className="w-full bg-[#f68b1e] text-white text-xs py-2 rounded-lg font-bold uppercase hover:bg-[#e07a16] transition-all"
                    >
                      {uploading ? 'Traitement en cours...' : editingProduct ? 'Enregistrer les modifications' : 'Publier le produit'}
                    </button>
                  </form>
                </div>

                {/* Operational Catalog Controller */}
                <div className="md:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 mb-4 pb-2 border-b">Gestionnaire de Catalogue</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-400 font-bold border-b">
                          <th className="p-2.5">Article</th>
                          <th className="p-2.5">Prix</th>
                          <th className="p-2.5 text-center">En Stock</th>
                          <th className="p-2.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {products.map((p) => (
                          <tr key={p.id} className={`hover:bg-gray-50/50 ${editingProduct?.id === p.id ? 'bg-orange-50/50' : ''}`}>
                            <td className="p-2.5 flex items-center space-x-2">
                              <img src={p.image_url} alt="" className="w-8 h-8 object-cover rounded border" />
                              <span className="font-extrabold text-black line-clamp-1">{p.name}</span>
                            </td>
                            <td className="p-2.5 font-bold text-gray-700">Prix: {p.price.toLocaleString()} FCFA</td>
                            <td className="p-2.5 text-center">
                              <input 
                                type="number" 
                                value={p.quantity !== null ? p.quantity : (p.stock_status ? 10 : 0)} 
                                onChange={(e) => handleUpdateStockVolume(p.id, e.target.value)}
                                className="w-14 border text-center p-0.5 rounded font-bold text-xs bg-white text-black"
                              />
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="flex items-center justify-center space-x-3">
                                <button 
                                  onClick={() => startEditProduct(p)} 
                                  className="text-gray-400 hover:text-green-600 transition-colors"
                                  title="Modifier le produit"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteProduct(p.id)} 
                                  className="text-gray-400 hover:text-red-600 transition-colors"
                                  title="Supprimer le produit"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}
        </main>
      )}

      {/* MOBILE FLOATING CART BUTTON */}
      {view === 'client' && cartCount > 0 && (
        <button 
          onClick={() => setIsCartOpen(true)} 
          className="fixed bottom-6 right-6 z-50 md:hidden bg-black text-white p-4 rounded-full shadow-2xl flex items-center justify-center space-x-2 active:scale-95 hover:bg-zinc-900 transition-all border border-zinc-800"
        >
          <ShoppingCart className="w-6 h-6 text-[#f68b1e]" />
          <span className="bg-[#f68b1e] text-white text-xs font-black px-2 py-0.5 rounded-full">
            {cartCount}
          </span>
        </button>
      )}

      {/* CART SYSTEM */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-end z-50">
          <div className="w-full max-w-sm bg-white h-full p-5 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h3 className="font-bold text-gray-900 uppercase text-xs">Votre Panier ({cartCount})</h3>
                <button onClick={() => setIsCartOpen(false)} className="text-gray-400 text-xl font-light">&times;</button>
              </div>
              {cart.length === 0 ? (
                <p className="text-center text-gray-400 text-xs py-10">Votre panier est vide.</p>
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-[75vh]">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border">
                      <div className="flex items-center space-x-2.5">
                        <img src={item.image_url} alt="" className="w-10 h-10 object-cover rounded bg-white border" />
                        <div>
                          <h4 className="text-sm font-extrabold text-black line-clamp-1">{item.name}</h4>
                          <p className="text-sm font-black text-[#f68b1e]">Prix: {item.price.toLocaleString()} FCFA</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 bg-white border rounded p-0.5">
                        <button onClick={() => changeQuantity(item, -1)} className="px-1.5 text-gray-500 font-bold">-</button>
                        <span className="text-xs font-bold px-1 text-black">{item.quantity}</span>
                        <button onClick={() => changeQuantity(item, 1)} className="px-1.5 text-gray-500 font-bold">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="border-t pt-3">
                <div className="flex justify-between items-baseline font-bold mb-3">
                  <span className="text-gray-400 text-xs uppercase">Total:</span>
                  <span className="text-lg font-black text-black">Prix: {cartTotal.toLocaleString()} FCFA</span>
                </div>
                <button onClick={handleWhatsAppCheckout} className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold text-xs uppercase text-center block">
                  Commander sur WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}