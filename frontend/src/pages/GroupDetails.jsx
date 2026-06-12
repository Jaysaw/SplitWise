import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api, { WS_BASE_URL } from '../services/api';
import { 
  RiArrowLeftLine, 
  RiMoneyDollarCircleLine, 
  RiChat4Line, 
  RiDeleteBinLine, 
  RiCalendarLine, 
  RiUserLine,
  RiFileList3Line,
  RiHandCoinLine,
  RiCheckDoubleLine,
  RiCloseLine,
  RiUserAddLine,
  RiSendPlaneLine,
  RiAddLine,
  RiCoinsLine,
  RiPieChartLine,
  RiHistoryLine,
  RiFilterLine
} from 'react-icons/ri';

const CATEGORY_ICONS = {
  FOOD: '🍔',
  RENT: '🏠',
  UTILITIES: '⚡',
  ENTERTAINMENT: '🎬',
  TRAVEL: '✈️',
  OTHER: '📦'
};

const CATEGORY_COLORS = {
  FOOD: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  RENT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  UTILITIES: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  ENTERTAINMENT: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  TRAVEL: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  OTHER: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
};

const GroupDetails = () => {
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Data states
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [balances, setBalances] = useState([]);
  const [whoOwesWhom, setWhoOwesWhom] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active view tab: 'expenses', 'balances', 'settlements', 'activity', 'analytics'
  const [activeTab, setActiveTab] = useState('expenses');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');

  // Modal / Drawer states
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [activeExpense, setActiveExpense] = useState(null); // Drawer trigger

  // Create/Edit Expense form states
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPayer, setExpPayer] = useState('');
  const [expCategory, setExpCategory] = useState('OTHER');
  const [expSplitType, setExpSplitType] = useState('EQUAL');
  const [expSplits, setExpSplits] = useState({}); // Mapping of userId -> values

  // Record Settlement form states
  const [settlePayer, setSettlePayer] = useState('');
  const [settlePayee, setSettlePayee] = useState('');
  const [settleAmount, setSettleAmount] = useState('');

  // Add Member states
  const [newMemberEmail, setNewMemberEmail] = useState('');

  // Real-time Chat / WebSocket states
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const wsRef = useRef(null);
  const chatBottomRef = useRef(null);

  const fetchGroupData = async () => {
    try {
      const groupRes = await api.get(`groups/${groupId}/`);
      setGroup(groupRes.data);
      
      // Build query to support category filter
      let expUrl = `expenses/?group=${groupId}`;
      if (selectedCategoryFilter !== 'ALL') {
        expUrl += `&category=${selectedCategoryFilter}`;
      }
      const expenseRes = await api.get(expUrl);
      setExpenses(expenseRes.data);

      const settlementRes = await api.get(`expenses/settlements/?group=${groupId}`);
      setSettlements(settlementRes.data);

      const balanceRes = await api.get(`groups/${groupId}/balances/`);
      setBalances(balanceRes.data.balances);
      setWhoOwesWhom(balanceRes.data.who_owes_whom);

      // Load activity and analytics in parallel
      const activityRes = await api.get(`groups/${groupId}/activity/`);
      setActivityLogs(activityRes.data);

      const analyticsRes = await api.get(`groups/${groupId}/analytics/`);
      setAnalyticsData(analyticsRes.data);
    } catch (err) {
      toast.error('Failed to load group details');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupData();
  }, [groupId, selectedCategoryFilter]);

  // Connect WebSockets when viewing specific expense in Drawer
  useEffect(() => {
    if (activeExpense) {
      api.get(`expenses/${activeExpense.id}/comments/`).then(res => {
        setComments(res.data);
      }).catch(() => {});

      const token = localStorage.getItem('access_token');
      const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = WS_BASE_URL.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
      const wsUrl = `${wsScheme}://${host}/ws/chat/expense/${activeExpense.id}/?token=${token}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const comment = JSON.parse(event.data);
        setComments(prev => [...prev, comment]);
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
      };

      return () => {
        if (wsRef.current) wsRef.current.close();
      };
    }
  }, [activeExpense]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail) return;
    try {
      await api.post(`groups/${groupId}/members/`, { email: newMemberEmail });
      toast.success('Member added successfully!');
      setNewMemberEmail('');
      setIsAddMemberModalOpen(false);
      fetchGroupData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add member');
    }
  };

  useEffect(() => {
    if (group?.members) {
      const defaultSplits = {};
      group.members.forEach(member => {
        if (expSplitType === 'EQUAL') {
          defaultSplits[member.id] = true;
        } else if (expSplitType === 'PERCENTAGE') {
          defaultSplits[member.id] = (100 / group.members.length).toFixed(1);
        } else if (expSplitType === 'SHARE') {
          defaultSplits[member.id] = '1';
        } else if (expSplitType === 'UNEQUAL') {
          defaultSplits[member.id] = '';
        }
      });
      setExpSplits(defaultSplits);
    }
  }, [expSplitType, isExpenseModalOpen, group]);

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!expDesc || !expAmount || !expPayer) {
      toast.error('Please fill in all core fields');
      return;
    }

    const splitsInput = [];
    if (expSplitType === 'EQUAL') {
      const selectedIds = Object.keys(expSplits).filter(id => expSplits[id]);
      if (selectedIds.length === 0) {
        toast.error('At least one member must be selected');
        return;
      }
      selectedIds.forEach(id => {
        splitsInput.push({ user_id: id });
      });
    } else if (expSplitType === 'UNEQUAL') {
      let sum = 0;
      Object.keys(expSplits).forEach(id => {
        const amt = parseFloat(expSplits[id]) || 0;
        sum += amt;
        splitsInput.push({ user_id: id, amount: amt });
      });
      if (Math.abs(sum - parseFloat(expAmount)) > 0.01) {
        toast.error(`Splits sum ($${sum.toFixed(2)}) must equal total amount ($${parseFloat(expAmount).toFixed(2)})`);
        return;
      }
    } else if (expSplitType === 'PERCENTAGE') {
      let sum = 0;
      Object.keys(expSplits).forEach(id => {
        const pct = parseFloat(expSplits[id]) || 0;
        sum += pct;
        splitsInput.push({ user_id: id, percentage: pct });
      });
      if (Math.abs(sum - 100) > 0.1) {
        toast.error(`Sum of percentages must equal 100% (currently ${sum}%)`);
        return;
      }
    } else if (expSplitType === 'SHARE') {
      let sum = 0;
      Object.keys(expSplits).forEach(id => {
        const shr = parseFloat(expSplits[id]) || 0;
        sum += shr;
        splitsInput.push({ user_id: id, share: shr });
      });
      if (sum <= 0) {
        toast.error('Sum of shares must be greater than 0');
        return;
      }
    }

    try {
      await api.post(`expenses/?group=${groupId}`, {
        group: groupId,
        description: expDesc,
        amount: parseFloat(expAmount),
        paid_by_id: expPayer,
        split_type: expSplitType,
        category: expCategory,
        splits_input: splitsInput
      });
      toast.success('Expense added successfully!');
      setIsExpenseModalOpen(false);
      setExpDesc('');
      setExpAmount('');
      fetchGroupData();
    } catch (err) {
      toast.error('Failed to log expense');
    }
  };

  const handleCreateSettlement = async (e) => {
    e.preventDefault();
    if (!settlePayer || !settlePayee || !settleAmount) {
      toast.error('Please fill in all settlement details');
      return;
    }
    if (settlePayer === settlePayee) {
      toast.error('Payer and payee cannot be the same person');
      return;
    }

    try {
      await api.post(`expenses/settlements/?group=${groupId}`, {
        group: groupId,
        payer_id: settlePayer,
        payee_id: settlePayee,
        amount: parseFloat(settleAmount)
      });
      toast.success('Payment recorded successfully!');
      setIsSettlementModalOpen(false);
      setSettleAmount('');
      fetchGroupData();
    } catch (err) {
      toast.error('Failed to record settlement');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await api.delete(`expenses/${expenseId}/`);
      toast.success('Expense deleted');
      setActiveExpense(null);
      fetchGroupData();
    } catch (err) {
      toast.error('Failed to delete expense');
    }
  };

  const handlePostComment = (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ content: newCommentText }));
      setNewCommentText('');
    } else {
      toast.error('Chat connection lost. Retrying...');
    }
  };

  // Helper values for category spending distribution
  const totalSpend = analyticsData.reduce((acc, c) => acc + c.total, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-dark-950">
      {/* Header bar */}
      <header className="glass sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/')} 
            className="p-2.5 bg-dark-800 hover:bg-dark-700 text-slate-300 rounded-xl transition-all border border-slate-700/50"
          >
            <RiArrowLeftLine size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">{group?.name}</h1>
            <p className="text-slate-400 text-xs truncate max-w-xs md:max-w-md">{group?.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAddMemberModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-dark-800 hover:bg-dark-700 text-white text-xs font-bold rounded-xl transition-colors border border-slate-700/50"
          >
            <RiUserAddLine size={16} /> Add Member
          </button>
        </div>
      </header>

      {/* Main content grid */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 cols - ledger details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quick Action buttons */}
          <div className="flex gap-4">
            <button 
              onClick={() => {
                if (group?.members?.length) setExpPayer(group.members[0].id);
                setIsExpenseModalOpen(true);
              }}
              className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
            >
              <RiAddLine size={20} /> Log Expense
            </button>
            <button 
              onClick={() => {
                if (group?.members?.length >= 2) {
                  setSettlePayer(group.members[0].id);
                  setSettlePayee(group.members[1].id);
                }
                setIsSettlementModalOpen(true);
              }}
              className="flex-1 py-3 bg-dark-850 hover:bg-dark-800 text-primary-400 border border-primary-500/20 font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
            >
              <RiCoinsLine size={20} /> Settle Up
            </button>
          </div>

          {/* Navigation tabs */}
          <div className="flex border-b border-slate-800 overflow-x-auto whitespace-nowrap scrollbar-none">
            <button 
              onClick={() => setActiveTab('expenses')}
              className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'expenses' ? 'border-primary-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              Expenses ({expenses.length})
            </button>
            <button 
              onClick={() => setActiveTab('balances')}
              className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'balances' ? 'border-primary-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              Balances
            </button>
            <button 
              onClick={() => setActiveTab('settlements')}
              className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'settlements' ? 'border-primary-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              Payments ({settlements.length})
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'analytics' ? 'border-primary-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <span className="flex items-center gap-1"><RiPieChartLine /> Analytics</span>
            </button>
            <button 
              onClick={() => setActiveTab('activity')}
              className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'activity' ? 'border-primary-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <span className="flex items-center gap-1"><RiHistoryLine /> Audit Logs</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            
            {activeTab === 'expenses' && (
              <div className="space-y-4">
                {/* Category filter pills */}
                <div className="flex gap-2 items-center overflow-x-auto py-1 scrollbar-none">
                  <span className="text-slate-500 text-xs flex items-center gap-1 font-semibold uppercase mr-1"><RiFilterLine /> Filter:</span>
                  {['ALL', 'FOOD', 'RENT', 'UTILITIES', 'ENTERTAINMENT', 'TRAVEL', 'OTHER'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${selectedCategoryFilter === cat ? 'bg-primary-500 text-white border-primary-400' : 'bg-dark-900 text-slate-400 border-slate-800 hover:border-slate-700'}`}
                    >
                      {cat === 'ALL' ? 'All' : `${CATEGORY_ICONS[cat]} ${cat.toLowerCase()}`}
                    </button>
                  ))}
                </div>

                {expenses.length === 0 ? (
                  <div className="glass p-12 text-center rounded-2xl">
                    <RiFileList3Line size={40} className="mx-auto text-slate-600 mb-3" />
                    <p className="text-slate-400 text-sm">No expenses match this criteria.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expenses.map(exp => (
                      <div 
                        key={exp.id}
                        onClick={() => setActiveExpense(exp)}
                        className="glass p-4 rounded-xl cursor-pointer hover:border-primary-500/20 hover:bg-dark-800/40 transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg ${CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.OTHER}`}>
                            {CATEGORY_ICONS[exp.category] || CATEGORY_ICONS.OTHER}
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-white font-bold text-sm md:text-base">{exp.description}</h4>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-400 text-xs">
                              <span className="flex items-center gap-1"><RiUserLine /> Paid by {exp.paid_by.full_name}</span>
                              <span className="flex items-center gap-1"><RiCalendarLine /> {new Date(exp.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-extrabold text-sm md:text-base">${parseFloat(exp.amount).toFixed(2)}</p>
                          <p className="text-xs text-primary-400 capitalize">{exp.split_type.toLowerCase()} split</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'balances' && (
              <div className="space-y-6">
                
                {/* Owed listings */}
                <div className="glass p-5 rounded-2xl space-y-4">
                  <h4 className="text-white font-bold text-sm border-b border-slate-800 pb-2">Net Balances</h4>
                  <div className="divide-y divide-slate-800/50">
                    {balances.map(b => (
                      <div key={b.user.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-dark-800 flex items-center justify-center font-bold text-xs border border-slate-700 text-slate-300">
                            {b.user.full_name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{b.user.full_name}</p>
                            <p className="text-xs text-slate-400">{b.user.email}</p>
                          </div>
                        </div>
                        <p className={`font-extrabold text-sm ${b.net_balance >= 0 ? 'text-primary-400' : 'text-red-400'}`}>
                          {b.net_balance >= 0 ? 'Owed' : 'Owes'} ${Math.abs(b.net_balance).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Who owes whom Optimized Path list */}
                <div className="glass p-5 rounded-2xl space-y-4">
                  <h4 className="text-white font-bold text-sm border-b border-slate-800 pb-2">Optimal Settle Pathways</h4>
                  {whoOwesWhom.length === 0 ? (
                    <div className="text-center py-4 flex items-center justify-center gap-2 text-primary-400 text-sm">
                      <RiCheckDoubleLine size={18} /> Group is fully settled up!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {whoOwesWhom.map((path, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-dark-900/50 border border-slate-800 p-3.5 rounded-xl text-sm">
                          <span className="text-slate-300">
                            <strong className="text-white">{path.from_user.full_name}</strong> owes <strong className="text-white">{path.to_user.full_name}</strong>
                          </span>
                          <strong className="text-primary-400 font-extrabold">${path.amount.toFixed(2)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {activeTab === 'settlements' && (
              settlements.length === 0 ? (
                <div className="glass p-12 text-center rounded-2xl">
                  <RiHandCoinLine size={40} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-slate-400 text-sm">No payment records found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {settlements.map(setl => (
                    <div key={setl.id} className="glass p-4 rounded-xl flex items-center justify-between border-l-4 border-l-emerald-500">
                      <div className="space-y-1">
                        <p className="text-sm text-slate-200">
                          <strong className="text-white">{setl.payer.full_name}</strong> paid <strong className="text-white">{setl.payee.full_name}</strong>
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <RiCalendarLine /> {new Date(setl.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <strong className="text-white font-extrabold text-sm md:text-base">${parseFloat(setl.amount).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-6">
                
                {/* SVG Visual Chart Panel */}
                <div className="glass p-6 rounded-2xl space-y-6 border border-slate-800">
                  <h4 className="text-white font-bold text-sm border-b border-slate-800 pb-2">Category Spending Distribution</h4>
                  
                  {totalSpend === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-8">Log expenses to see graphical charts</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                      
                      {/* Responsive Interactive SVG Donut chart */}
                      <div className="relative flex justify-center py-2">
                        <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
                          <circle cx="100" cy="100" r="70" fill="transparent" stroke="#1e293b" strokeWidth="20" />
                          {(() => {
                            let cumulativePercent = 0;
                            return analyticsData.map((item, idx) => {
                              if (item.total === 0) return null;
                              const percentage = (item.total / totalSpend) * 100;
                              const strokeDasharray = `${(percentage * 2 * Math.PI * 70) / 100} ${2 * Math.PI * 70}`;
                              const strokeDashoffset = `-${(cumulativePercent * 2 * Math.PI * 70) / 100}`;
                              cumulativePercent += percentage;
                              
                              const colors = {
                                FOOD: '#10b981',
                                RENT: '#3b82f6',
                                UTILITIES: '#f97316',
                                ENTERTAINMENT: '#a855f7',
                                TRAVEL: '#eab308',
                                OTHER: '#64748b'
                              };
                              return (
                                <circle 
                                  key={idx}
                                  cx="100" 
                                  cy="100" 
                                  r="70" 
                                  fill="transparent" 
                                  stroke={colors[item.category] || '#64748b'} 
                                  strokeWidth="20"
                                  strokeDasharray={strokeDasharray}
                                  strokeDashoffset={strokeDashoffset}
                                  className="transition-all duration-500"
                                />
                              );
                            });
                          })()}
                        </svg>
                        
                        {/* Middle total sum text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Spent</span>
                          <span className="text-white text-lg font-black">${totalSpend.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Legend Details */}
                      <div className="space-y-4">
                        {analyticsData.map((item, idx) => {
                          if (item.total === 0) return null;
                          const pct = (item.total / totalSpend) * 100;
                          
                          const colors = {
                            FOOD: 'bg-emerald-500',
                            RENT: 'bg-blue-500',
                            UTILITIES: 'bg-orange-500',
                            ENTERTAINMENT: 'bg-purple-500',
                            TRAVEL: 'bg-yellow-500',
                            OTHER: 'bg-slate-500'
                          };

                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-semibold">
                                <div className="flex items-center gap-1.5 text-slate-300">
                                  <span className={`w-2.5 h-2.5 rounded-full ${colors[item.category] || 'bg-slate-500'}`} />
                                  <span>{CATEGORY_ICONS[item.category]} {item.category.toLowerCase()}</span>
                                </div>
                                <span className="text-white">${item.total.toFixed(2)} ({pct.toFixed(0)}%)</span>
                              </div>
                              {/* Sleek indicator progress bar */}
                              <div className="h-1.5 w-full bg-dark-900 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${colors[item.category] || 'bg-slate-500'} rounded-full`} 
                                  style={{ width: `${pct}%` }} 
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  )}

                </div>

                {/* Optimizations statistics */}
                <div className="glass p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-primary-500 text-sm">
                  <div>
                    <h5 className="font-bold text-white mb-1">Debt Simplification Status</h5>
                    <p className="text-xs text-slate-400">By solving direct balances, we optimized network splits down to {whoOwesWhom.length} total payments.</p>
                  </div>
                  <div className="px-3.5 py-1.5 bg-primary-500/20 text-primary-400 rounded-xl font-bold border border-primary-500/30">
                    Optimized
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'activity' && (
              activityLogs.length === 0 ? (
                <div className="glass p-12 text-center rounded-2xl">
                  <RiHistoryLine size={40} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-slate-400 text-sm">No activity logs recorded yet.</p>
                </div>
              ) : (
                <div className="glass p-5 rounded-2xl space-y-4">
                  <h4 className="text-white font-bold text-sm border-b border-slate-800 pb-2">Activity Stream Audit Trail</h4>
                  
                  {/* Vertical Auditable Log Timeline */}
                  <div className="relative border-l border-slate-800 pl-4 space-y-6 py-2 ml-1.5">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="relative space-y-1">
                        {/* Circle marker */}
                        <div className="absolute -left-[21.5px] top-1.5 w-3.5 h-3.5 rounded-full bg-primary-500 border border-dark-950 shadow-md animate-pulse" />
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <RiCalendarLine /> {new Date(log.created_at).toLocaleString()}
                        </p>
                        <p className="text-sm text-slate-200">{log.description}</p>
                      </div>
                    ))}
                  </div>

                </div>
              )
            )}

          </div>

        </div>

        {/* Right 1 col - Group members list */}
        <div className="space-y-6">
          <div className="glass p-5 rounded-2xl space-y-4">
            <h4 className="text-white font-bold text-sm border-b border-slate-800 pb-2">Group Members ({group?.members?.length || 0})</h4>
            <div className="space-y-3">
              {group?.members?.map(m => (
                <div key={m.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-dark-800 flex items-center justify-center font-bold text-xs border border-slate-700 text-slate-300">
                      {m.full_name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{m.full_name}</p>
                      <p className="text-xs text-slate-400">{m.email}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Expense Modal (Add Expense) */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-lg rounded-2xl shadow-2xl p-6 border border-slate-700/50 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <RiFileList3Line /> Log an Expense
              </h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <RiCloseLine size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-5 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Description *</label>
                <input
                  type="text"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="e.g. Dinner, Rent, Groceries"
                  className="w-full px-4 py-2.5 bg-dark-900 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Amount ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-dark-900 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Paid By *</label>
                  <select
                    value={expPayer}
                    onChange={(e) => setExpPayer(e.target.value)}
                    className="w-full px-4 py-2.5 bg-dark-900 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-primary-500"
                  >
                    {group.members.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Category</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-dark-900 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value="FOOD">🍟 Food & Dining</option>
                    <option value="RENT">🏠 Rent & Housing</option>
                    <option value="UTILITIES">⚡ Bills & Utilities</option>
                    <option value="ENTERTAINMENT">🎬 Movies & Events</option>
                    <option value="TRAVEL">✈️ Travel & Hotel</option>
                    <option value="OTHER">📦 Other Packages</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Split Strategy</label>
                  <select
                    value={expSplitType}
                    onChange={(e) => setExpSplitType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-dark-900 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value="EQUAL">Equally</option>
                    <option value="UNEQUAL">Unequally (Amounts)</option>
                    <option value="PERCENTAGE">Percentages (%)</option>
                    <option value="SHARE">Shares</option>
                  </select>
                </div>
              </div>

              {/* Dynamic split input fields */}
              <div className="bg-dark-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Configure Splits</p>
                {group.members.map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-4 py-1.5">
                    <span className="text-sm text-slate-200">{m.full_name}</span>
                    
                    {expSplitType === 'EQUAL' && (
                      <input
                        type="checkbox"
                        checked={!!expSplits[m.id]}
                        onChange={(e) => setExpSplits({ ...expSplits, [m.id]: e.target.checked })}
                        className="rounded border-slate-700 bg-dark-900 text-primary-500 focus:ring-primary-500 h-5 w-5"
                      />
                    )}

                    {expSplitType === 'UNEQUAL' && (
                      <div className="relative w-28">
                        <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-xs text-slate-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={expSplits[m.id] || ''}
                          onChange={(e) => setExpSplits({ ...expSplits, [m.id]: e.target.value })}
                          className="w-full pl-6 pr-2 py-1 bg-dark-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none"
                          placeholder="0.00"
                        />
                      </div>
                    )}

                    {expSplitType === 'PERCENTAGE' && (
                      <div className="relative w-24">
                        <input
                          type="number"
                          step="0.1"
                          value={expSplits[m.id] || ''}
                          onChange={(e) => setExpSplits({ ...expSplits, [m.id]: e.target.value })}
                          className="w-full pl-2 pr-6 py-1 bg-dark-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none"
                          placeholder="0"
                        />
                        <span className="absolute inset-y-0 right-0 pr-2 flex items-center text-xs text-slate-500">%</span>
                      </div>
                    )}

                    {expSplitType === 'SHARE' && (
                      <input
                        type="number"
                        step="0.5"
                        value={expSplits[m.id] || ''}
                        onChange={(e) => setExpSplits({ ...expSplits, [m.id]: e.target.value })}
                        className="w-20 px-2 py-1 bg-dark-900 border border-slate-700 rounded-lg text-sm text-white text-center focus:outline-none"
                        placeholder="1"
                      />
                    )}

                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 bg-transparent hover:bg-slate-800 border border-slate-700 text-slate-300 text-sm font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold rounded-xl">
                  Add Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Up (Settlement) Modal */}
      {isSettlementModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-2xl shadow-2xl p-6 border border-slate-700/50">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <RiCoinsLine /> Record a Payment
              </h3>
              <button onClick={() => setIsSettlementModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <RiCloseLine size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateSettlement} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Who paid? *</label>
                <select
                  value={settlePayer}
                  onChange={(e) => setSettlePayer(e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-900 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-primary-500"
                >
                  {group.members.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Who received? *</label>
                <select
                  value={settlePayee}
                  onChange={(e) => setSettlePayee(e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-900 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-primary-500"
                >
                  {group.members.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Amount Paid ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 bg-dark-900 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSettlementModalOpen(false)}
                  className="px-4 py-2 bg-transparent hover:bg-slate-800 border border-slate-700 text-slate-300 text-sm font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold rounded-xl">
                  Record Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-sm rounded-2xl shadow-2xl p-6 border border-slate-700/50">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <RiUserAddLine /> Invite Group Member
              </h3>
              <button onClick={() => setIsAddMemberModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <RiCloseLine size={24} />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Member Email *</label>
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className="w-full px-4 py-2.5 bg-dark-900 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
                  required
                />
              </div>

              <button type="submit" className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl transition-colors">
                Add Member
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Expense Detail Drawer / Pane with Real-time Chat Comments */}
      {activeExpense && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="glass w-full max-w-md h-full shadow-2xl border-l border-slate-700/50 flex flex-col justify-between p-6">
            
            {/* Top area - details */}
            <div className="space-y-6 overflow-y-auto flex-1 pr-1">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{activeExpense.description}</h3>
                  <p className="text-xs text-slate-400">Created {new Date(activeExpense.created_at).toLocaleDateString()}</p>
                </div>
                <button 
                  onClick={() => setActiveExpense(null)}
                  className="p-1.5 hover:bg-dark-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <RiCloseLine size={24} />
                </button>
              </div>

              {/* Amount detail */}
              <div className="flex justify-between items-center bg-dark-900/40 p-4 border border-slate-800 rounded-xl">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Cost</p>
                  <p className="text-2xl font-extrabold text-white mt-1">${parseFloat(activeExpense.amount).toFixed(2)}</p>
                </div>
                <button 
                  onClick={() => handleDeleteExpense(activeExpense.id)}
                  className="p-3 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 rounded-xl transition-all"
                  title="Delete Expense"
                >
                  <RiDeleteBinLine size={20} />
                </button>
              </div>

              {/* Splits List */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Split Breakdown</p>
                <div className="bg-dark-900/20 border border-slate-800/80 rounded-xl p-4 divide-y divide-slate-800/50">
                  {activeExpense.splits.map(split => (
                    <div key={split.user.id} className="flex justify-between py-2.5 text-sm">
                      <span className="text-slate-300">{split.user.full_name}</span>
                      <strong className="text-white">${parseFloat(split.amount).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* WebSocket Chat Pane */}
              <div className="space-y-3 flex flex-col h-[320px]">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <RiChat4Line /> Discussion Chat
                </p>
                <div className="flex-1 bg-dark-950 border border-slate-800 rounded-xl p-4 overflow-y-auto space-y-3 flex flex-col">
                  {comments.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center my-auto">No comments yet. Start the conversation!</p>
                  ) : (
                    comments.map(c => (
                      <div key={c.id} className={`flex flex-col max-w-[85%] ${c.user.id === user.id ? 'self-end items-end' : 'self-start'}`}>
                        <span className="text-[10px] text-slate-400 mb-0.5">{c.user.full_name}</span>
                        <div className={`p-2.5 rounded-2xl text-xs ${c.user.id === user.id ? 'bg-primary-500 text-white rounded-tr-none' : 'bg-dark-800 text-slate-100 rounded-tl-none border border-slate-700/50'}`}>
                          {c.content}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatBottomRef} />
                </div>
              </div>

            </div>

            {/* Bottom area - chat input */}
            <form onSubmit={handlePostComment} className="pt-4 border-t border-slate-800 flex items-center gap-2 mt-4">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2.5 bg-dark-900 border border-slate-700/50 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button 
                type="submit"
                className="p-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-all shadow-md"
              >
                <RiSendPlaneLine size={18} />
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default GroupDetails;
