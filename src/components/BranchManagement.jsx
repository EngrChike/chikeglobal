import React from 'react';
import { MapPin, Trash2, Users, Edit } from 'lucide-react';

export default function BranchManagement({
  branches,
  branchName,
  setBranchName,
  branchLocation,
  setBranchLocation,
  editingBranch,
  setEditingBranch,
  handleSaveBranch,
  // NEW PROPS FOR DELETE AND STAFF ASSIGNMENT:
  handleDeleteBranch,
  staffList = [],
  handleReassignStaff
}) {
  return (
    <div className="space-y-6">
      {/* TOP SECTION: Branch Creation and Network List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Branch Form */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit">
          <h3 className="font-semibold text-sm uppercase text-gray-800 mb-5 pb-3 border-b">
            {editingBranch ? 'Edit Branch' : 'Create New Branch'}
          </h3>
          <form onSubmit={handleSaveBranch} className="space-y-4">
            <input 
              type="text" 
              placeholder="Branch Name (e.g. Abidjan Center)" 
              value={branchName} 
              onChange={e => setBranchName(e.target.value)} 
              className="w-full border border-gray-300 p-3 text-sm rounded-lg focus:ring-2 focus:ring-[#0f172a] outline-none" 
              required 
            />
            <input 
              type="text" 
              placeholder="Location Details" 
              value={branchLocation} 
              onChange={e => setBranchLocation(e.target.value)} 
              className="w-full border border-gray-300 p-3 text-sm rounded-lg focus:ring-2 focus:ring-[#0f172a] outline-none" 
            />
            <button 
              type="submit" 
              className="w-full bg-[#0f172a] hover:bg-gray-800 text-white text-sm py-3 rounded-lg font-semibold transition-colors"
            >
              {editingBranch ? 'Update Branch' : 'Register Branch'}
            </button>
            {editingBranch && (
              <button 
                type="button"
                onClick={() => { setEditingBranch(null); setBranchName(''); setBranchLocation(''); }}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm py-3 rounded-lg font-semibold transition-colors mt-2"
              >
                Cancel Edit
              </button>
            )}
          </form>
        </div>

        {/* Branch List */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-sm uppercase text-gray-800 pb-4 border-b flex items-center">
            <MapPin className="w-4 h-4 mr-2 text-gray-500" /> Branch Network
          </h3>
          <div className="overflow-hidden mt-4 rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-4 font-semibold text-gray-600">Branch Name</th>
                  <th className="p-4 font-semibold text-gray-600">Location</th>
                  <th className="p-4 font-semibold text-right text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {branches.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-4 font-medium text-gray-900">{b.name}</td>
                    <td className="p-4 text-gray-500">{b.location || 'N/A'}</td>
                    <td className="p-4 flex items-center justify-end gap-4">
                      <button 
                        onClick={() => { setEditingBranch(b); setBranchName(b.name); setBranchLocation(b.location); }} 
                        className="text-blue-600 font-medium hover:text-blue-800 flex items-center"
                      >
                        <Edit className="w-4 h-4 mr-1" /> Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteBranch && handleDeleteBranch(b.id)} 
                        className="text-red-600 font-medium hover:text-red-800 flex items-center"
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {branches.length === 0 && (
                  <tr>
                    <td colSpan="3" className="p-4 text-center text-gray-500">No branches registered yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: Quick Staff Reassignment */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="font-semibold text-sm uppercase text-gray-800 pb-4 border-b flex items-center">
          <Users className="w-4 h-4 mr-2 text-gray-500" /> Quick Staff Branch Assignment
        </h3>
        <p className="text-xs text-gray-500 mb-4 mt-2">
          Instantly reassign a staff member to a new branch without editing their full profile.
        </p>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 font-semibold text-gray-600">Staff Name</th>
                <th className="p-4 font-semibold text-gray-600">Role</th>
                <th className="p-4 font-semibold text-gray-600">Current Branch</th>
                <th className="p-4 font-semibold text-gray-600">Reassign To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staffList.map(staff => (
                <tr key={staff.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="p-4 font-medium text-gray-900">{staff.full_name}</td>
                  <td className="p-4 text-gray-500 capitalize">{staff.role}</td>
                  <td className="p-4 text-gray-500">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-semibold border border-blue-100">
                      {branches.find(b => String(b.id) === String(staff.branch_id))?.name || 'HQ / Main'}
                    </span>
                  </td>
                  <td className="p-4">
                    <select
                      value={staff.branch_id || ''}
                      onChange={(e) => handleReassignStaff && handleReassignStaff(staff.id, e.target.value)}
                      className="border border-gray-300 p-2 text-sm rounded-lg focus:ring-2 focus:ring-[#0f172a] outline-none min-w-[160px]"
                    >
                      <option value="">HQ / Main</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {staffList.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-gray-500">No staff members found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}