import React, { useState } from 'react';
import { X, ReceiptText, Calendar, Building2, Search, Printer } from 'lucide-react';

export default function TransferHistoryModal({ isOpen, onClose, transferLogs = [], branches = [] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  if (!isOpen) return null;

  // Safe parser for items (handles JSON strings or raw arrays)
  const parseItems = (items) => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') {
      try {
        const parsed = JSON.parse(items);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const filteredLogs = transferLogs.filter(log => {
    const refMatch = (log.transfer_ref || '').toLowerCase().includes(searchQuery.toLowerCase());
    const authorMatch = (log.created_by || '').toLowerCase().includes(searchQuery.toLowerCase());
    return refMatch || authorMatch;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] flex flex-col justify-between space-y-4">
        
        {/* HEADER */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-zinc-900 text-amber-400 rounded-xl">
              <ReceiptText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 uppercase">
                Historique des Transferts & Reçus
              </h3>
              <p className="text-xs text-gray-500">
                Traçabilité administrative des dispatchings QG vers les succursales
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SEARCH BAR */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input 
            type="text" 
            placeholder="Rechercher par référence (ex: TRF-...) ou auteur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#0f172a]"
          />
        </div>

        {/* LOGS TABLE / RECEIPT VIEW */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
          {selectedReceipt ? (
            /* PRINTABLE RECEIPT CARD */
            <div className="bg-amber-50/30 p-6 rounded-2xl border border-amber-200/60 space-y-5 print:p-0">
              <div className="flex justify-between items-start border-b pb-4 border-amber-200">
                <div>
                  <h4 className="font-black text-sm text-gray-900 uppercase">Bordereau de Transfert de Stock</h4>
                  <p className="text-xs text-amber-900 font-mono font-bold mt-1">Réf: {selectedReceipt.transfer_ref}</p>
                </div>
                <div className="text-right text-xs text-gray-500 space-y-1">
                  <p className="flex items-center justify-end gap-1">
                    <Calendar className="w-3.5 h-3.5" /> 
                    {selectedReceipt.created_at ? new Date(selectedReceipt.created_at).toLocaleString('fr-FR') : 'Date N/A'}
                  </p>
                  <p className="font-medium">Émis par: <strong>{selectedReceipt.created_by || 'Admin'}</strong></p>
                </div>
              </div>

              <div className="border border-amber-200/80 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-amber-100/50 font-bold text-gray-700 border-b border-amber-200">
                    <tr>
                      <th className="p-3">Produit</th>
                      <th className="p-3">Lot</th>
                      <th className="p-3 text-center">Quantité</th>
                      <th className="p-3">Succursale Cible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parseItems(selectedReceipt.items).map((item, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/20">
                        <td className="p-3 font-bold text-gray-900">{item.product_name || item.name}</td>
                        <td className="p-3 font-mono text-gray-500 uppercase">{item.batch_reference || 'N/A'}</td>
                        <td className="p-3 text-center font-black text-indigo-700">{item.qty || item.quantity} unit(s)</td>
                        <td className="p-3 font-bold text-emerald-800">🏪 {item.target_branch_name || 'Succursale'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button 
                  onClick={() => setSelectedReceipt(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl"
                >
                  ← Retour au tableau
                </button>
                <button 
                  onClick={handlePrint}
                  className="px-4 py-2 bg-zinc-900 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm"
                >
                  <Printer className="w-4 h-4 text-amber-400" /> Imprimer le Reçu
                </button>
              </div>
            </div>
          ) : (
            /* LOGS LIST */
            filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Building2 className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="font-bold text-sm">Aucun bordereau de transfert trouvé</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                    <tr>
                      <th className="p-3">Réf Transfert</th>
                      <th className="p-3">Date & Heure</th>
                      <th className="p-3">Auteur</th>
                      <th className="p-3 text-center">Volume Total</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLogs.map(log => {
                      const itemsList = parseItems(log.items);
                      const totalQty = itemsList.reduce((acc, i) => acc + (Number(i.qty || i.quantity) || 0), 0);
                      return (
                        <tr key={log.id || log.transfer_ref} className="hover:bg-gray-50">
                          <td className="p-3 font-mono font-bold text-indigo-700">{log.transfer_ref}</td>
                          <td className="p-3 text-gray-500">
                            {log.created_at ? new Date(log.created_at).toLocaleString('fr-FR') : 'Date N/A'}
                          </td>
                          <td className="p-3 font-semibold text-gray-800">{log.created_by || 'Admin'}</td>
                          <td className="p-3 text-center font-black text-gray-900">{totalQty} article(s)</td>
                          <td className="p-3 text-center">
                            <button 
                              onClick={() => setSelectedReceipt(log)}
                              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-900 text-amber-400 font-bold rounded-lg text-[11px]"
                            >
                              Voir le Reçu
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

      </div>
    </div>
  );
}