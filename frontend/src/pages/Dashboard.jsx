import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { 
  RiGroupLine, 
  RiAddLine, 
  RiLogoutBoxRLine, 
  RiArrowRightSLine, 
  RiMoneyDollarCircleLine,
  RiArrowUpDoubleLine,
  RiArrowDownDoubleLine,
  RiSearchLine,
  RiCloseLine,
  RiUserAddLine
} from 'react-icons/ri';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Overall balance summary states
  const [totalOwed, setTotalOwed] = useState(0);
  const [totalOwe, setTotalOwe] = useState(0);

  // Create group modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);

  const fetchGroupsAndBalances = async () => {
    try {
      const res = await api.get('groups/');
      setGroups(res.data);

      // Aggregate balances across all groups
      let aggregateOwed = 0;
      let aggregateOwe = 0;
      
      for (const group of res.data) {
        try {
          const balanceRes = await api.get(`groups/${group.id}/balances/`);
          const myBalance = balanceRes.data.balances.find(b => b.user.id === user.id);
          if (myBalance) {
            const bal = myBalance.net_balance;
            if (bal > 0) {
              aggregateOwed += bal;
            } else if (bal < 0) {
              aggregateOwe += Math.abs(bal);
            }
          }
        } catch (e) {
          console.error("Failed to load balances for group", group.id);
        }
      }

      setTotalOwed(aggregateOwed);
      setTotalOwe(aggregateOwe);
    } catch (err) {
      toast.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupsAndBalances();
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  // Search members to add
  const handleSearchUsers = async (val) => {
    setSearchQuery(val);
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`auth/search/?q=${val}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const addMember = (userToAdd) => {
    if (selectedMembers.find(m => m.id === userToAdd.id)) {
      toast.error('User already added to list');
      return;
    }
    setSelectedMembers([...selectedMembers, userToAdd]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeMember = (userId) => {
    setSelectedMembers(selectedMembers.filter(m => m.id !== userId));
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName) {
      toast.error('Group name is required');
      return;
    }

    try {
      // 1. Create group
      const res = await api.post('groups/', {
        name: groupName,
        description: groupDesc
      });
      const createdGroup = res.data;

      // 2. Add selected members
      for (const member of selectedMembers) {
        await api.post(`groups/${createdGroup.id}/members/`, {
          email: member.email
        });
      }

      toast.success('Group created successfully!');
      setIsModalOpen(false);
      setGroupName('');
      setGroupDesc('');
      setSelectedMembers([]);
      fetchGroupsAndBalances();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create group');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-dark-950">
      {/* Header bar */}
      <header className="glass sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RiGroupLine className="text-primary-500 text-3xl" />
          <h1 className="text-xl font-extrabold text-white tracking-tight">
            Split<span className="text-gradient">wise</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-white">{user?.full_name}</p>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
          <button 
            onClick={handleLogout} 
            className="p-2.5 bg-dark-800 hover:bg-red-500/10 hover:text-red-500 text-slate-300 rounded-xl transition-all duration-200 border border-slate-700/50"
            title="Log Out"
          >
            <RiLogoutBoxRLine size={20} />
          </button>
        </div>
      </header>

      {/* Main dashboard content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Welcome Section */}
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-slate-400 text-sm mt-1">Manage your shared budgets and settle obligations</p>
        </div>

        {/* Aggregate Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass p-6 rounded-2xl flex items-center justify-between border-l-4 border-l-primary-500">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Balance</p>
              <h3 className={`text-2xl font-bold mt-2 ${totalOwed - totalOwe >= 0 ? 'text-primary-400' : 'text-red-400'}`}>
                {totalOwed - totalOwe >= 0 ? '+' : '-'}${Math.abs(totalOwed - totalOwe).toFixed(2)}
              </h3>
            </div>
            <RiMoneyDollarCircleLine size={40} className="text-slate-500" />
          </div>

          <div className="glass p-6 rounded-2xl flex items-center justify-between border-l-4 border-l-red-500">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">You owe</p>
              <h3 className="text-2xl font-bold mt-2 text-red-400">
                ${totalOwe.toFixed(2)}
              </h3>
            </div>
            <RiArrowDownDoubleLine size={40} className="text-red-500/80" />
          </div>

          <div className="glass p-6 rounded-2xl flex items-center justify-between border-l-4 border-l-primary-500">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">You are owed</p>
              <h3 className="text-2xl font-bold mt-2 text-primary-400">
                ${totalOwed.toFixed(2)}
              </h3>
            </div>
            <RiArrowUpDoubleLine size={40} className="text-primary-500/80" />
          </div>
        </div>

        {/* Groups Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <RiGroupLine /> Your Groups ({groups.length})
            </h3>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white text-sm font-bold rounded-xl shadow-lg transition-all duration-200"
            >
              <RiAddLine size={18} /> Create Group
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
            </div>
          ) : groups.length === 0 ? (
            <div className="glass p-12 text-center rounded-2xl border border-dashed border-slate-700/50">
              <RiGroupLine size={48} className="mx-auto text-slate-600 mb-4" />
              <h4 className="text-white font-bold mb-1">No groups found</h4>
              <p className="text-slate-400 text-sm mb-6">Create a group to start splitting bills with friends</p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-md transition-colors"
              >
                Create First Group
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((group) => (
                <div 
                  key={group.id} 
                  onClick={() => navigate(`/groups/${group.id}`)}
                  className="glass p-5 rounded-2xl cursor-pointer flex items-center justify-between border border-slate-700/50 hover:border-primary-500/30 hover:bg-dark-800/50 transition-all duration-200"
                >
                  <div className="space-y-2">
                    <h4 className="text-white font-bold text-lg">{group.name}</h4>
                    <p className="text-slate-400 text-xs line-clamp-1">{group.description || 'No description provided'}</p>
                    <p className="text-slate-500 text-xs">{group.members?.length || 0} members</p>
                  </div>
                  <RiArrowRightSLine className="text-slate-400 group-hover:text-primary-500 transition-colors" size={24} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Glassmorphic Modal for Creating Group */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-lg rounded-2xl shadow-2xl p-6 border border-slate-700/50 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <RiGroupLine /> Create a New Group
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setGroupName('');
                  setGroupDesc('');
                  setSelectedMembers([]);
                  setSearchResults([]);
                }} 
                className="text-slate-400 hover:text-white transition-colors"
              >
                <RiCloseLine size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-5 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Roommates Apartment 4B"
                  className="w-full px-4 py-2.5 bg-dark-900 border border-slate-700/50 rounded-xl focus:outline-none focus:border-primary-500 text-white placeholder-slate-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Optional description..."
                  className="w-full px-4 py-2.5 bg-dark-900 border border-slate-700/50 rounded-xl focus:outline-none focus:border-primary-500 text-white placeholder-slate-500 h-20 resize-none"
                />
              </div>

              {/* Members Adding Section */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Add Members (by Username/Email)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <RiSearchLine size={16} />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    placeholder="Search friend's email/username"
                    className="w-full pl-9 pr-4 py-2 bg-dark-900 border border-slate-700/50 rounded-xl focus:outline-none focus:border-primary-500 text-white text-sm"
                  />
                </div>

                {/* Search Results list */}
                {searchResults.length > 0 && (
                  <div className="bg-dark-900/95 border border-slate-800 rounded-xl divide-y divide-slate-800/50 max-h-40 overflow-y-auto">
                    {searchResults.map(resUser => (
                      <div 
                        key={resUser.id}
                        onClick={() => addMember(resUser)}
                        className="flex items-center justify-between p-3 hover:bg-primary-500/10 cursor-pointer transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{resUser.full_name}</p>
                          <p className="text-xs text-slate-400">{resUser.email}</p>
                        </div>
                        <RiUserAddLine className="text-primary-500" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected members tags */}
                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedMembers.map(m => (
                      <span 
                        key={m.id}
                        className="inline-flex items-center gap-1 bg-dark-800 text-slate-200 text-xs px-3 py-1.5 rounded-full border border-slate-700"
                      >
                        {m.full_name}
                        <button 
                          type="button" 
                          onClick={() => removeMember(m.id)}
                          className="text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <RiCloseLine size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-transparent hover:bg-slate-800 border border-slate-700 text-slate-300 text-sm font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
