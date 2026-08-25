import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient'; // Ensure this path matches your project
import { ShoppingCart, Smartphone, Video, Search, X } from 'lucide-react';

export default function ClientApp() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const WHATSAPP_NUMBER = '2250100130109'; 
  const FACEBOOK_URL = 'https://facebook.com/profile.php?id=61590626370497'; 
  const TIKTOK_URL = 'https://tiktok.com/@your-profile'; 

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) setProducts(data);
    } catch (err) {
      console.error("Fetch Error: ", err);
    }
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

  const filteredProducts = products.filter(product => {
    const pName = product.name ? product.name.toLowerCase() : '';
    const pDesc = product.description ? product.description.toLowerCase() : '';
    const query = searchTerm.toLowerCase();
    return pName.includes(query) || pDesc.includes(query);
  });

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-900 font-sans antialiased relative">
      {/* HEADER */}
      <header className="bg-white text-black sticky top-0 z-40 shadow-sm border-b border-gray-100 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2.5 cursor-pointer shrink-0 group select-none">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-md p-1.5">
               <svg viewBox="0 0 100 100" fill="none" className="w-full h-full text-white">
                <path d="M30 25 C30 25, 45 15, 50 15 C55 15, 70 25, 70 25 C70 45, 60 75, 50 85 C40 75, 30 45, 30 25 Z" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="50" cy="42" r="7" fill="currentColor" />
                <path d="M40 60 C45 65, 55 65, 60 60" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-black text-base sm:text-xl tracking-wider uppercase text-zinc-900 leading-none group-hover:text-amber-600 transition-colors">DONCHIKE</span>
              <span className="text-[10px] sm:text-[11px] font-bold text-amber-500 tracking-[0.25em] uppercase leading-tight mt-0.5">COSMETICS</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4 ml-auto">
            <div className="flex items-center space-x-1 sm:space-x-2 border-r border-gray-200 pr-2 sm:pr-4 shrink-0">
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg bg-green-50 text-green-600"><Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></a>
              <a href={FACEBOOK_URL} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center">f</a>
              <a href={TIKTOK_URL} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg bg-zinc-50 text-zinc-900"><Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></a>
            </div>
            <button onClick={() => setIsCartOpen(true)} className="relative bg-black text-white p-2.5 rounded-xl flex items-center space-x-2 hover:bg-zinc-800 shrink-0">
              <ShoppingCart className="w-4 h-4" />
              {cartCount > 0 && <span className="bg-[#f68b1e] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl w-full mx-auto p-4 md:py-8">
        <div className="max-w-md mx-auto mb-8 relative px-1">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5" />
            <input 
              type="text" 
              placeholder="Rechercher un produit..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white text-sm border border-gray-200 pl-10 pr-10 py-2.5 rounded-xl focus:border-[#f68b1e] focus:outline-none"
            />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 p-1 text-gray-400"><X className="w-3.5 h-3.5" /></button>}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
            <p className="text-gray-400 text-sm">Aucun produit trouvé.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {filteredProducts.map((p) => {
              const itemQtyInCart = getProductCartQty(p.id);
              const isOutOfStock = p.quantity !== null ? p.quantity <= 0 : !p.stock_status;

              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200/60 overflow-hidden flex flex-col group relative">
                  <div className="relative bg-gray-50 aspect-[4/5] w-full flex items-center justify-center border-b border-gray-100">
                    {/* Add fallback for missing image_url */}
                    <img src={p.image_url || '/placeholder.png'} alt={p.name} className="object-cover w-full h-full" />
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <span className="bg-zinc-800 text-white font-bold text-[10px] px-2.5 py-1 rounded">ÉPUISÉ</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm md:text-base text-black line-clamp-2 font-extrabold">{p.name}</h3>
                    </div>
                    <div className="mt-3">
                      <p className="text-lg md:text-xl font-black text-[#f68b1e] mb-2">Prix: {p.price?.toLocaleString()} FCFA</p>
                      {isOutOfStock ? (
                        <button disabled className="w-full bg-gray-100 text-gray-400 text-[11px] font-bold py-1.5 rounded-lg">Rupture</button>
                      ) : itemQtyInCart > 0 ? (
                        <div className="flex items-center justify-between border border-[#f68b1e] rounded-lg h-7">
                          <button onClick={() => changeQuantity(p, -1)} className="text-[#f68b1e] w-8 font-bold">-</button>
                          <span className="text-xs font-black">{itemQtyInCart}</span>
                          <button onClick={() => changeQuantity(p, 1)} className="text-[#f68b1e] w-8 font-bold">+</button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(p)} className="w-full bg-[#f68b1e] text-white font-bold py-1.5 rounded-lg text-xs">Ajouter au panier</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* CART OVERLAY */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
          <div className="w-full max-w-sm bg-white h-full p-5 flex flex-col justify-between shadow-xl">
             <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h3 className="font-bold uppercase text-xs">Panier ({cartCount})</h3>
                <button onClick={() => setIsCartOpen(false)} className="text-gray-400 text-xl">&times;</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                 {cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border mb-2">
                      <div>
                        <h4 className="text-sm font-extrabold line-clamp-1">{item.name}</h4>
                        <p className="text-sm font-black text-[#f68b1e]">{item.price.toLocaleString()} FCFA</p>
                      </div>
                    </div>
                  ))}
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between items-baseline font-bold mb-3">
                  <span className="text-gray-400 text-xs uppercase">Total:</span>
                  <span className="text-lg font-black text-black">{cartTotal.toLocaleString()} FCFA</span>
                </div>
                <button onClick={handleWhatsAppCheckout} className="w-full bg-green-600 text-white py-2.5 rounded-xl font-bold text-xs uppercase">
                  Commander sur WhatsApp
                </button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}