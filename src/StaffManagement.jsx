import React, { useState, useEffect, useMemo } from 'react';
import { UserPlus, UserCheck, UserX, Calendar, Clock, Folder, FolderOpen, ChevronDown, ChevronRight, ShieldCheck, Key } from 'lucide-react';

export default function StaffManagement({ supabase }) {
  const [staffList, setStaffList] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [newStaff, setNewStaff] = useState({ fullName: '', pinCode: '', role: 'staff' });
  const [expandedMonths, setExpandedMonths] = useState({});

  useEffect(() => {
    fetchStaff();
    fetchSales();
  }, []);

  const fetchStaff = async () => {
    const { data, error } = await supabase.from('staff').select('*').order('created_at', { ascending: false });
    if (!error && data) setStaffList(data);
  };

  const fetchSales = async () => {
    // Fetch sales history linked to staff
    const { data, error } = await supabase
      .from('customer_history')
      .select('*')
      .not('staff_id', 'is', null)
      .order('created_at', { ascending: false });
    if (!error && data) setSalesHistory(data);
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.fullName || !newStaff.pinCode) return alert("Nom complet et PIN requis");

    const { error } = await supabase.from('staff').insert([{
      full_name: newStaff.fullName,
      pin_code: newStaff.pinCode,
      role: newStaff.role
    }]);

    if (error) {
      alert(error.code === '23505' ? "Ce code PIN est déjà utilisé." : "Erreur de création.");
    } else {
      setNewStaff({ fullName: '', pinCode: '', role: 'staff' });
      fetchStaff();
      alert("Compte staff créé avec succès !");
    }
  };

  const toggleStaffStatus = async (id, currentStatus) => {
    // Security check: Require Admin PIN before modifying staff status
    const adminPin = prompt("Sécurité Admin : Entrez votre code PIN Administrateur pour confirmer :");
    if (!adminPin) return;

    const verifyingAdmin = staffList.find(s => s.pin_code === adminPin && s.role === 'admin' && s.is_active);
    if (!verifyingAdmin) {
      alert("Code PIN administrateur incorrect ou non autorisé.");
      return;
    }

    const { error } = await supabase.from('staff').update({ is_active: !currentStatus }).eq('id', id);
    if (!error) {
      fetchStaff();
      alert("Statut mis à jour avec succès.");
    } else {
      alert("Erreur lors de la mise à jour.");
    }
  };

  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  // Create a fallback mapping from staff_id to staff name in case sale.staff_name is missing
  const staffMap = useMemo(() => {
    const map = {};
    staffList.forEach(s => {
      map[s.id] = s.full_name;
    });
    return map;
  }, [staffList]);

  // --- LOGIC: Calculate 6 AM Shift & Grouping ---
  const { todayStats, monthlyArchives } = useMemo(() => {
    const now = new Date();
    
    // Determine the start of the current shift (6 AM)
    const shiftStart = new Date(now);
    if (now.getHours() < 6) {
      shiftStart.setDate(shiftStart.getDate() - 1); 
    }
    shiftStart.setHours(6, 0, 0, 0);

    const todayData = {};
    const archives = {};

    salesHistory.forEach(sale => {
      const saleDate = new Date(sale.created_at);
      // Fallback lookup using staff_id if sale.staff_name is not populated
      const staffName = sale.staff_name || staffMap[sale.staff_id] || 'Inconnu';
      const total = sale.total || 0;

      if (saleDate >= shiftStart) {
        // Belongs to TODAY's 6 AM Shift
        if (!todayData[staffName]) todayData[staffName] = { count: 0, total: 0 };
        todayData[staffName].count += 1;
        todayData[staffName].total += total;
      } else {
        // Belongs to MONTHLY ARCHIVES
        const monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = saleDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

        if (!archives[monthKey]) archives[monthKey] = { label: monthLabel, staffData: {} };
        if (!archives[monthKey].staffData[staffName]) archives[monthKey].staffData[staffName] = { count: 0, total: 0 };
        
        archives[monthKey].staffData[staffName].count += 1;
        archives[monthKey].staffData[staffName].total += total;
      }
    });

    return { todayStats: todayData, monthlyArchives: archives };
  }, [salesHistory, staffMap]);

  return (
    <div className="space-y-6">
      
      {/* SECTION 1: ACCOUNT CREATION & MANAGEMENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Account Form */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-fit">
          <h3 className="font-bold text-xs uppercase text-gray-700 pb-2 border-b mb-4 flex items-center">
            <UserPlus className="w-4 h-4 mr-2" /> Créer un Compte Staff
          </h3>
          <form onSubmit={handleCreateStaff} className="space-y-3">
            <input 
              type="text" placeholder="Nom Complet" value={newStaff.fullName}
              onChange={e => setNewStaff({...newStaff, fullName: e.target.value})}
              className="w-full border p-2 text-xs rounded-lg"
            />
            <input 
              type="password" placeholder="Code PIN (ex: 1234)" value={newStaff.pinCode}
              onChange={e => setNewStaff({...newStaff, pinCode: e.target.value})}
              className="w-full border p-2 text-xs rounded-lg"
            />
            <select 
              value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})}
              className="w-full border p-2 text-xs rounded-lg"
            >
              <option value="staff">Vendeur (Staff)</option>
              <option value="admin">Administrateur</option>
            </select>
            <button type="submit" className="w-full bg-black text-white text-xs font-bold py-2.5 rounded-lg uppercase">
              Créer le compte
            </button>
          </form>
        </div>

        {/* Staff List */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-bold text-xs uppercase text-gray-700 pb-2 border-b mb-4 flex items-center justify-between">
            <span>Comptes Existants (PIN masqué par sécurité)</span>
            <Key className="w-4 h-4 text-gray-400" />
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-2">Nom</th>
                  <th className="p-2">Code PIN</th>
                  <th className="p-2">Rôle</th>
                  <th className="p-2">Statut</th>
                  <th className="p-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {staffList.map(staff => (
                  <tr key={staff.id}>
                    <td className="p-2 font-bold">{staff.full_name}</td>
                    <td className="p-2 font-mono text-gray-400 tracking-widest">••••</td>
                    <td className="p-2 uppercase text-[10px] text-gray-500">{staff.role}</td>
                    <td className="p-2">
                      {staff.is_active ? 
                        <span className="text-green-600 bg-green-50 px-2 py-1 rounded flex items-center w-fit"><UserCheck className="w-3 h-3 mr-1"/> Actif</span> : 
                        <span className="text-red-600 bg-red-50 px-2 py-1 rounded flex items-center w-fit"><UserX className="w-3 h-3 mr-1"/> Désactivé</span>
                      }
                    </td>
                    <td className="p-2 text-right">
                      {staff.role !== 'admin' && (
                        <button onClick={() => toggleStaffStatus(staff.id, staff.is_active)} className={`text-[10px] font-bold px-3 py-1 rounded ${staff.is_active ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {staff.is_active ? 'Désactiver' : 'Activer'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 2: PERFORMANCE TRACKING */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="font-bold text-xs uppercase text-gray-700 pb-2 border-b mb-4 flex items-center">
          <Clock className="w-4 h-4 mr-2 text-orange-500" /> 
          Ventes du Jour (Depuis 06:00 AM)
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Object.keys(todayStats).length > 0 ? Object.entries(todayStats).map(([name, data]) => (
            <div key={name} className="p-4 border rounded-xl bg-orange-50 border-orange-100 text-center">
              <p className="text-[10px] text-gray-500 font-bold uppercase">{name}</p>
              <p className="text-lg font-black text-gray-800">{data.total.toLocaleString()} FCFA</p>
              <p className="text-[10px] text-gray-400">{data.count} transaction(s)</p>
            </div>
          )) : (
            <p className="text-xs text-gray-400 italic col-span-full">Aucune vente enregistrée depuis 6h00.</p>
          )}
        </div>

        <h3 className="font-bold text-xs uppercase text-gray-700 pb-2 border-b mb-4 flex items-center mt-8">
          <Folder className="w-4 h-4 mr-2 text-gray-500" /> Archives Mensuelles des Vendeurs
        </h3>
        <div className="space-y-3">
          {Object.entries(monthlyArchives).length > 0 ? Object.entries(monthlyArchives).map(([monthKey, archive]) => {
            const isOpen = expandedMonths[monthKey];
            return (
              <div key={monthKey} className="border rounded-xl overflow-hidden">
                <button onClick={() => toggleMonth(monthKey)} className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 text-left">
                  <span className="font-black text-xs uppercase">{archive.label}</span>
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {isOpen && (
                  <div className="p-3 bg-white grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(archive.staffData).map(([name, data]) => (
                      <div key={name} className="flex justify-between items-center p-3 border rounded-lg bg-gray-50">
                        <span className="font-bold text-xs">{name}</span>
                        <div className="text-right">
                          <span className="block font-black text-sm text-gray-700">{data.total.toLocaleString()} FCFA</span>
                          <span className="block text-[10px] text-gray-500">{data.count} ventes</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }) : (
            <p className="text-xs text-gray-400 italic">Aucune archive mensuelle disponible pour le moment.</p>
          )}
        </div>
      </div>

    </div>
  );
}