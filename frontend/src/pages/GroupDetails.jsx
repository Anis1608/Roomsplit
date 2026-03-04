import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { PlusCircle, Plus, Users, UserPlus, FileSpreadsheet, MessageCircle, CheckCircle, Receipt, Wallet, Home, ChevronDown, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';

const isDev = import.meta.env.MODE === 'development';
const SOCKET_ORIGIN = isDev ? 'http://localhost:5000' : (import.meta.env.VITE_SOCKET_ORIGIN || 'https://vhatti.online');
const SOCKET_PATH = isDev ? '/socket.io' : (import.meta.env.VITE_SOCKET_PATH || '/roomsplit-be/socket.io');
const socket = io(SOCKET_ORIGIN, { path: SOCKET_PATH, withCredentials: true });

const GroupDetails = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const [group, setGroup] = useState(null);
  const [balances, setBalances] = useState({});
  const [simplifiedDebts, setSimplifiedDebts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('expenses'); // mobile tabs: 'expenses' or 'balances'

  // Custom UI states
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [showPaidByDropdown, setShowPaidByDropdown] = useState(false);
  const [settleConfig, setSettleConfig] = useState(null);
  const [confirmExpenseConfig, setConfirmExpenseConfig] = useState(null);

  // Form states
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(user?._id || '');
  const [splitAmong, setSplitAmong] = useState([]);
  const [splitType, setSplitType] = useState('equal');
  const [exactSplits, setExactSplits] = useState({});
  const [addingUserId, setAddingUserId] = useState('');

  useEffect(() => {
    fetchGroupData();
    fetchAllUsers();
    
    socket.emit('join_group', id);
    socket.on('new_expense', (expense) => {
      setExpenses((prev) => [expense, ...prev]);
      fetchGroupData(); // refresh balances
      toast.success(`New expense added: ${expense.description}`, { icon: '💸' });
    });

    socket.on('update_expense', (updatedExpense) => {
      setExpenses((prev) => prev.map(e => e._id === updatedExpense._id ? updatedExpense : e));
      fetchGroupData(); // refresh balances
      if (updatedExpense.status === 'completed') {
        toast.success(`Settlement approved!`, { icon: '✅' });
      } else if (updatedExpense.status === 'rejected') {
        toast.error(`Settlement declined!`, { icon: '❌' });
      }
    });

    return () => {
      socket.off('new_expense');
      socket.off('update_expense');
    };
  }, [id]);

  useEffect(() => {
    if (user && paidBy === '') setPaidBy(user._id);
  }, [user]);

  const fetchGroupData = async () => {
    try {
      const res = await api.get(`/groups/${id}`);
      setGroup(res.data.group);
      setBalances(res.data.balances);
      setSimplifiedDebts(res.data.simplifiedDebts || []);
      setExpenses(res.data.expenses.reverse());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await api.get('/auth/users');
      setAllUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExactAmountChange = (uId, val) => {
    setExactSplits(prev => {
      const next = { ...prev, [uId]: val };
      if (uId !== user?._id && splitAmong.includes(user?._id)) {
        let totalOthers = 0;
        splitAmong.forEach(id => {
          if (id !== user?._id) totalOthers += Number(next[id] || 0);
        });
        const remainder = Math.max(0, Number(amount || 0) - totalOthers);
        next[user?._id] = remainder > 0 ? remainder.toFixed(2) : '';
      }
      return next;
    });
  };

  const addExpense = (e) => {
    e.preventDefault();
    if (splitAmong.length === 0) return toast.error('Select at least one member to split among');
    
    let currentExactSplits = [];
    if (splitType === 'exact') {
      let total = 0;
      for (const uId of splitAmong) {
        const val = Number(exactSplits[uId] || 0);
        total += val;
        currentExactSplits.push({ user: uId, amount: val });
      }
      if (Math.abs(total - Number(amount)) > 0.01) {
         return toast.error(`Split amounts sum to ₹${total.toFixed(2)}, but total expense is ₹${amount}. They must match!`);
      }
    } else {
      const equalAmount = Number(amount) / splitAmong.length;
      splitAmong.forEach(uId => {
         currentExactSplits.push({ user: uId, amount: equalAmount });
      });
    }

    setConfirmExpenseConfig({
      description: desc,
      amount: Number(amount),
      paidBy,
      splitAmong,
      splitType,
      exactSplits: currentExactSplits
    });
  };

  const submitExpense = async () => {
    if (!confirmExpenseConfig) return;
    try {
      await api.post('/expenses', {
        groupId: id,
        ...confirmExpenseConfig
      });
      setDesc('');
      setAmount('');
      setSplitAmong([]);
      setSplitType('equal');
      setExactSplits({});
      setConfirmExpenseConfig(null);
      setShowAddExpense(false);
      setActiveTab('expenses');
      toast.success('Expense added successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add expense');
    }
  };

  const triggerSettle = (fromId, toId, amount) => {
    setSettleConfig({ fromId, toId, amount: amount.toString(), originalAmount: amount.toString(), customMode: false, showUpiConfirmation: false, pendingAmount: null });
  };

  const triggerUpiAndConfirm = (toUserObj, explicitAmount) => {
    if (!settleConfig) return;
    const finalAmount = explicitAmount || settleConfig.amount;
    if (!finalAmount || isNaN(finalAmount) || Number(finalAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    // 1. Open UPI App
    const upiUrl = `upi://pay?pa=${toUserObj.upiId}&pn=${encodeURIComponent(toUserObj.name)}&am=${finalAmount}&cu=INR`;
    window.location.href = upiUrl;

    // 2. Transition modal to post-payment confirmation
    setSettleConfig(prev => ({ ...prev, showUpiConfirmation: true, pendingAmount: finalAmount }));
  };

  const finalizeSettle = async (finalAmount, fromId, toId) => {
    try {
      await api.post('/expenses/settle', {
        groupId: id,
        amount: Number(finalAmount),
        paidBy: fromId,
        splitAmong: [toId]
      });
      fetchGroupData();
      toast.success('Settlement request sent for approval! ⏳');
      setSettleConfig(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to send settlement request');
    }
  };

  const handleApprove = async (expenseId) => {
    try {
      await api.put(`/expenses/${expenseId}/approve`);
      toast.success('Settlement approved! Email sent.');
    } catch (err) {
      toast.error('Failed to approve');
    }
  };

  const handleDecline = async (expenseId) => {
    try {
      await api.put(`/expenses/${expenseId}/decline`);
      toast.success('Settlement declined.');
    } catch (err) {
      toast.error('Failed to decline');
    }
  };

  const confirmAddMember = async (e) => {
    e?.preventDefault();
    try {
      if (!addingUserId) return toast.error('Please select a user first');
      await api.put(`/groups/${id}/members`, { userId: addingUserId });
      setAddingUserId('');
      fetchGroupData();
      toast.success('Member added correctly!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add member');
    }
  };

  const toggleSplitMember = (memberId) => {
    setSplitAmong(prev => 
      prev.includes(memberId) 
        ? prev.filter(m => m !== memberId)
        : [...prev, memberId]
    );
  };

  const applyPreset = (presetMembers) => {
    setSplitAmong(presetMembers.map(m => m._id || m));
  };

  if (!group) return <div className="text-center mt-20">Loading...</div>;

  const nonMembers = allUsers.filter(u => !group.members.find(m => m._id === u._id));
  const selectedAddingUser = nonMembers.find(u => u._id === addingUserId);
  const selectedPayer = group.members.find(m => m._id === paidBy);

  return (
    <div className="space-y-8 pb-20">
      
      {/* Settings/Settle confirmation Modal */}
      <AnimatePresence>
        {settleConfig && (() => {
          const toUserObj = group.members.find(m => m._id === settleConfig.toId);
          const hasUpi = toUserObj?.upiId && toUserObj.upiId.trim() !== '';

          return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-gray-800 p-8 rounded-[30px] w-full max-w-sm shadow-2xl glass">
              <h3 className="text-2xl font-black mb-2 flex items-center"><Wallet className="mr-3 text-primary-500"/> Confirm Settlement</h3>
              
              {settleConfig.showUpiConfirmation ? (
                <>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 font-medium border-b border-gray-100 dark:border-gray-700 pb-4">
                    Have you successfully completed the payment of <span className="font-bold text-gray-800 dark:text-gray-200">₹{settleConfig.pendingAmount}</span> via your UPI App?
                  </p>
                  <div className="flex flex-col space-y-3">
                    <button onClick={() => finalizeSettle(settleConfig.pendingAmount, settleConfig.fromId, settleConfig.toId)} className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl font-black transition-transform active:scale-[0.98] shadow-lg shadow-green-500/30 flex justify-center items-center text-lg">
                      <CheckCircle className="mr-2"/> Yes, I've paid
                    </button>
                    <button onClick={() => setSettleConfig({...settleConfig, showUpiConfirmation: false})} className="w-full py-3.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-2xl font-bold transition-colors">
                      No, go back
                    </button>
                  </div>
                </>
              ) : hasUpi && !settleConfig.customMode ? (
                <>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 font-medium">How would you like to settle with {toUserObj.name} using UPI?</p>
                  <div className="flex flex-col space-y-3">
                    <button onClick={() => triggerUpiAndConfirm(toUserObj, settleConfig.originalAmount)} className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl font-black transition-transform active:scale-[0.98] shadow-lg shadow-blue-500/30 flex justify-center items-center text-lg">
                      Pay Full Amount (₹{settleConfig.originalAmount})
                    </button>
                    <button onClick={() => setSettleConfig({...settleConfig, customMode: true})} className="w-full py-3.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-2xl font-bold transition-colors">
                      Pay Custom Amount
                    </button>
                    <button onClick={() => setSettleConfig(null)} className="w-full py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold mt-2 transition-colors">Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 font-medium">
                    {hasUpi ? "Enter a custom amount to send via UPI." : "Please enter the exact cash/transfer amount you are paying."}
                  </p>
                  
                  <div className="mb-6">
                    <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">Amount to Settle (₹)</label>
                    <input 
                      type="number" 
                      autoFocus
                      className="w-full px-5 py-4 border-2 border-gray-200 dark:border-gray-700 focus:border-primary-500 dark:focus:border-primary-500 rounded-2xl bg-gray-50 dark:bg-gray-900 outline-none font-black text-2xl text-primary-600 dark:text-primary-400 shadow-inner"
                      value={settleConfig.amount} 
                      onChange={e => setSettleConfig({...settleConfig, amount: e.target.value})} 
                    />
                  </div>
                  
                  <div className="flex flex-col space-y-3">
                    {hasUpi ? (
                      <>
                        <button onClick={() => triggerUpiAndConfirm(toUserObj, settleConfig.amount)} className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl font-bold transition-colors shadow-lg shadow-blue-500/30 flex justify-center items-center">
                          Pay Custom Amount with UPI
                        </button>
                        <button onClick={() => setSettleConfig({...settleConfig, customMode: false})} className="w-full py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-bold transition-colors">Back</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => finalizeSettle(settleConfig.amount, settleConfig.fromId, settleConfig.toId)} className="w-full py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/30 rounded-2xl font-bold transition-colors">
                          Confirm Cash Settlement
                        </button>
                        <button onClick={() => setSettleConfig(null)} className="w-full py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold transition-colors">Cancel</button>
                      </>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {confirmExpenseConfig && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-gray-800 p-8 rounded-[30px] w-full max-w-sm shadow-2xl glass">
              <h3 className="text-2xl font-black mb-1 flex items-center"><CheckCircle className="mr-3 text-primary-500"/> Confirm Expense</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 font-medium border-b border-gray-100 dark:border-gray-700 pb-4">
                Verify the exact splits below before saving.
              </p>
              
              <div className="mb-6 max-h-48 overflow-y-auto space-y-2 pr-2">
                <div className="flex justify-between font-bold text-gray-800 dark:text-gray-100 mb-2 px-2">
                  <span>Total Amount</span>
                  <span className="text-primary-600 dark:text-primary-400">₹{confirmExpenseConfig.amount.toFixed(2)}</span>
                </div>
                {confirmExpenseConfig.exactSplits.map((split, i) => {
                  const mName = group.members.find(m => m._id === split.user)?.name;
                  return (
                    <div key={i} className="flex justify-between items-center text-sm p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/60">
                      <span className="font-semibold text-gray-600 dark:text-gray-300">{mName === user?.name ? 'Me' : mName}</span>
                      <span className="font-bold text-gray-900 dark:text-white">₹{Number(split.amount).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex space-x-3">
                <button onClick={() => setConfirmExpenseConfig(null)} className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-2xl font-bold transition-colors">Edit</button>
                <button onClick={submitExpense} className="flex-1 py-3.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-2xl font-bold transition-colors shadow-lg shadow-green-500/30">Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative overflow-hidden flex flex-col md:flex-row justify-between items-center md:items-center p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-md shadow-primary-500/10 bg-gradient-to-tr from-primary-600 to-primary-800 gap-3 md:gap-4 mt-1">
         {/* Glassmorphism aesthetics */}
         <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-2xl"></div>
         <div className="absolute bottom-0 left-0 -ml-6 -mb-6 w-24 h-24 rounded-full bg-black/20 blur-xl"></div>
         
         <div className="relative z-10 w-full flex flex-row items-center justify-between gap-3">
          <h1 className="text-xl sm:text-3xl md:text-4xl font-black tracking-tight text-white drop-shadow-sm truncate flex-1">{group.name}</h1>
          <div className="shrink-0">
            <span className="text-primary-50 flex items-center font-bold text-[10px] sm:text-xs bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-md w-max border border-white/10 uppercase tracking-wider shadow-inner shadow-white/5">
              <Users size={12} className="mr-1.5 opacity-90" />
              {group.members.length} <span className="hidden xs:inline ml-1">Members</span>
            </span>
          </div>
        </div>
        <div className="hidden md:flex gap-3 relative z-10 shrink-0">
          <button onClick={() => setShowAddExpense(!showAddExpense)} className="flex items-center justify-center px-4 py-2.5 sm:px-6 sm:py-3 bg-white text-primary-700 hover:bg-gray-50 rounded-xl sm:rounded-2xl transition-all font-black shadow-md active:scale-95 text-sm sm:text-base">
            <Plus size={18} className="mr-1.5" strokeWidth={3} /> Add Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column - Expenses (Hidden on mobile if Balances tab is active) */}
        <div className={`lg:col-span-2 space-y-6 ${activeTab === 'expenses' || activeTab === 'add' ? 'block' : 'hidden md:block'}`}>
          <AnimatePresence>
            {showAddExpense && (
              <motion.form initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} onSubmit={addExpense} className="glass soft-shadow p-8 rounded-3xl border border-gray-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100 flex items-center"><FileSpreadsheet className="mr-3 text-primary-500"/> New Expense</h3>
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold mb-1 text-gray-600 dark:text-gray-400">Description</label>
                      <input type="text" required placeholder="e.g. Dinner, Rent"
                        className="w-full px-4 py-3 border dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50 outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                        value={desc} onChange={e => setDesc(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1 text-gray-600 dark:text-gray-400">Amount</label>
                      <input type="number" required placeholder="0.00" min="0.01" step="0.01"
                        className="w-full px-4 py-3 border dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50 outline-none focus:ring-2 focus:ring-primary-500 font-medium text-lg text-primary-600 dark:text-primary-400"
                        value={amount} onChange={e => setAmount(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-600 dark:text-gray-400">Paid By</label>
                    <div className="relative">
                      <div 
                        onClick={() => setShowPaidByDropdown(!showPaidByDropdown)}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl font-medium cursor-pointer flex justify-between items-center transition hover:border-primary-400"
                      >
                        <span className="truncate">{selectedPayer ? (selectedPayer.name === user?.name ? 'Me' : selectedPayer.name) : 'Select payer...'}</span>
                        <ChevronDown size={18} className={`text-gray-400 transition-transform ${showPaidByDropdown ? 'rotate-180' : ''}`} />
                      </div>
                      
                      <AnimatePresence>
                        {showPaidByDropdown && (
                          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute z-20 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                            {group.members.map(m => (
                              <div 
                                key={m._id}
                                onClick={() => { setPaidBy(m._id); setShowPaidByDropdown(false); }}
                                className="px-4 py-3 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer text-sm font-bold border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors"
                              >
                                {m.name === user?.name ? 'Me' : m.name}
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Header Controls */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Split Among</label>
                        <div className="flex bg-gray-100 dark:bg-gray-800/80 rounded-xl p-1 shadow-inner border border-gray-200 dark:border-gray-700 w-[180px]">
                           <button type="button" onClick={() => setSplitType('equal')} className={`flex-1 text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${splitType === 'equal' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow' : 'text-gray-500 dark:text-gray-400'}`}>Equally</button>
                           <button type="button" onClick={() => setSplitType('exact')} className={`flex-1 text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${splitType === 'exact' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow' : 'text-gray-500 dark:text-gray-400'}`}>Unequally</button>
                        </div>
                      </div>
                      
                      {group.presets.length > 0 && (
                        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-0 mt-1 sm:mt-0">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Presets</span>
                          <div className="flex gap-2">
                            {group.presets.map((p, i) => (
                              <button type="button" key={i} onClick={() => applyPreset(p.members)} className="text-primary-600 dark:text-primary-400 text-xs font-bold hover:underline transition-all">
                                {p.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Member Selection Buttons */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {group.members.map(m => (
                        <button type="button" key={m._id} onClick={() => toggleSplitMember(m._id)}
                          className={`px-4 py-2 rounded-full text-sm font-bold transition-all border shadow-sm ${splitAmong.includes(m._id) ? 'bg-primary-500 text-white border-primary-500 shadow-primary-500/30' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary-400'}`}>
                          {m.name === user?.name ? 'Me' : m.name}
                        </button>
                      ))}
                    </div>
                    
                    {/* Exact Amounts Configurator */}
                    {splitType === 'exact' && splitAmong.length > 0 && (
                      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-gray-200 dark:border-gray-700/60 overflow-hidden shadow-inner flex flex-col">
                        <div className="flex justify-between items-center text-[10px] font-black text-gray-400 dark:text-gray-500 px-5 py-3 bg-gray-100/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700/60">
                          <span className="uppercase tracking-widest">Member</span>
                          <span className="uppercase tracking-widest">Exact Amount</span>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
                          {splitAmong.map(uId => {
                             const userObj = group.members.find(m => m._id === uId);
                             return (
                               <div key={uId} className="flex justify-between items-center px-5 py-3.5 transition-colors hover:bg-white dark:hover:bg-gray-800/50">
                                 <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center text-sm">
                                   <div className="w-2.5 h-2.5 rounded-full bg-primary-500 dark:bg-primary-400 mr-3 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                   {userObj?.name === user?.name ? 'Me' : userObj?.name}
                                 </span>
                                 <div className="relative group">
                                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-bold transition-colors group-hover:text-primary-500">₹</span>
                                   <input type="number" placeholder="0.00" min="0" step="0.01" 
                                     className={`w-[120px] pl-8 pr-4 py-2.5 border ${userObj?._id === user?._id ? 'border-primary-200 dark:border-primary-900/30 bg-primary-50/50 dark:bg-primary-900/10 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white'} rounded-xl outline-none focus:ring-2 focus:ring-primary-500 font-bold text-right shadow-sm transition-all placeholder:text-gray-300 dark:placeholder:text-gray-700`}
                                     value={exactSplits[uId] || ''} 
                                     onChange={e => handleExactAmountChange(uId, e.target.value)} 
                                     readOnly={userObj?._id === user?._id}
                                     title={userObj?._id === user?._id ? "Your exact amount is auto-calculated" : ""}
                                   />
                                 </div>
                               </div>
                             )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </div>
                  <button 
                    type="submit" 
                    disabled={!desc || !amount || Number(amount) <= 0 || splitAmong.length === 0}
                    className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:from-gray-300 disabled:to-gray-400 disabled:dark:from-gray-700 disabled:dark:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-primary-500/40 disabled:shadow-none transition-all text-lg active:scale-[0.98]">
                    Save Expense
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div className={`glass soft-shadow rounded-3xl overflow-hidden border border-white/50 dark:border-gray-700 ${activeTab === 'add' ? 'hidden md:block' : ''}`}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/30">
              <h3 className="text-xl font-bold">Recent Expenses</h3>
            </div>
            <div className="p-3 sm:p-5 space-y-3">
              {(() => {
                const myExpenses = expenses.filter(exp => exp.paidBy?._id === user?._id || exp.splitAmong.some(s => (s._id || s) === user?._id));
                
                if (myExpenses.length === 0) {
                  return <div className="p-10 text-center text-gray-400 dark:text-gray-500 font-medium">{expenses.length === 0 ? 'No expenses yet.' : 'No expenses involving you.'}</div>;
                }
                
                return myExpenses.map(exp => {
                  const isPending = exp.status === 'pending';
                  const isRejected = exp.status === 'rejected';
                  const canApprove = isPending && user?._id === exp.splitAmong[0]?._id;
                
                return (
                  <div key={exp._id} className={`flex ${canApprove ? 'flex-col' : 'flex-row justify-between items-center'} p-3.5 sm:p-4 rounded-2xl border ${isPending ? 'bg-yellow-50/20 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/60' : isRejected ? 'opacity-50 border-gray-200 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-900/20' : 'bg-white/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-700/60'} shadow-sm transition-all hover:shadow-md group`}>
                    
                    {/* Left: Title, Status, and Payer/Date */}
                    <div className={`${canApprove ? 'mb-4' : ''}`}>
                      <div className="flex items-center gap-2">
                        <h4 className={`font-black text-sm sm:text-base flex items-center gap-1.5 ${isRejected ? 'line-through text-gray-400' : isPending ? 'text-yellow-700 dark:text-yellow-500' : 'text-gray-800 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors'}`}>
                          {exp.description === 'Settlement' && exp.status === 'completed' && (
                            <CheckSquare className="text-green-500 w-3.5 h-3.5 fill-green-500/20 mb-0.5" strokeWidth={3} />
                          )}
                          {exp.description.replace(/^Settlement$/, 'Approved Settlement')}
                        </h4>
                        {isPending && (
                          <span className="text-[7px] sm:text-[8px] bg-yellow-100 text-yellow-800 dark:bg-yellow-600/30 dark:text-yellow-500 px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest border border-yellow-200 dark:border-yellow-600/50 mt-0.5">
                            Pending
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-[11px] font-bold mt-1 flex items-center text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                        <span className="text-gray-600 dark:text-gray-400">{exp.paidBy?.name === user?.name ? 'You' : exp.paidBy?.name}</span> 
                        <span className="mx-1.5 opacity-50">•</span>
                        {new Date(exp.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
                      </p>
                    </div>

                    {/* Right: Amount and Split Info */}
                    <div className={`${canApprove ? 'flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800/60' : 'flex flex-col items-end'}`}>
                      <div className="flex flex-col items-end">
                        <span className={`text-base sm:text-lg font-black leading-none ${isPending ? 'text-yellow-600 dark:text-yellow-500' : 'text-gray-900 dark:text-white'}`}>
                          ₹{exp.amount}
                        </span>
                        <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1 opacity-80">
                          {isPending ? `to ${exp.splitAmong[0]?.name}` : `Split w/ ${exp.splitAmong.length}`}
                        </span>
                      </div>
                      
                      {/* Approval Action Buttons */}
                      {canApprove && (
                        <div className="flex space-x-2">
                          <button onClick={() => handleDecline(exp._id)} className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 border border-gray-200 dark:border-gray-700 dark:hover:border-red-800/50 text-[10px] sm:text-xs font-black rounded-lg transition-all active:scale-95 uppercase tracking-wider">
                            Decline
                          </button>
                          <button onClick={() => handleApprove(exp._id)} className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-[10px] sm:text-xs font-black rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 uppercase tracking-wider">
                            Approve
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                );
            });
            })()}
            </div>
          </div>
        </div>

        {/* Right Column - Balances & Members */}
        <div className={`space-y-6 ${(activeTab === 'balances' || activeTab === 'members') ? 'block' : 'hidden md:block'}`}>
          {/* Balances Section */}
          <div className={`glass soft-shadow p-6 rounded-3xl border border-white/50 dark:border-gray-700 ${activeTab === 'members' ? 'hidden md:block' : ''}`}>
            <h3 className="text-xl font-bold mb-6 flex items-center"><Wallet className="mr-2 text-primary-500"/> Your Balances</h3>
            
            {/* Simple Net Summary */}
            <div className="mb-6">
              {(() => {
                const myBal = balances[user?._id]?.netBalance || 0;
                if (myBal > 0) return <div className="text-green-500 font-bold p-6 bg-green-50 dark:bg-green-900/20 rounded-2xl text-center shadow-sm text-xl border border-green-100 dark:border-green-800">You will get back ₹{myBal.toFixed(2)}</div>;
                if (myBal < 0) return <div className="text-red-500 font-bold p-6 bg-red-50 dark:bg-red-900/20 rounded-2xl text-center shadow-sm text-xl border border-red-100 dark:border-red-800">You need to pay ₹{Math.abs(myBal).toFixed(2)}</div>;
                return <div className="text-gray-500 font-bold p-6 bg-gray-50 dark:bg-gray-800/40 rounded-2xl text-center shadow-sm text-xl border border-gray-200 dark:border-gray-700">You are settled up!</div>;
              })()}
            </div>

            {/* Explicit Debt Breakdown */}
            {simplifiedDebts.some(debt => debt.from === user?._id || debt.to === user?._id) && (
              <div className="mt-6 pt-6 border-t dark:border-gray-700">
                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center">Your pending settlements</h4>
                <div className="space-y-3">
                  {simplifiedDebts.filter(debt => debt.from === user?._id || debt.to === user?._id).map((debt, index) => {
                    const fromUser = group.members.find(m => m._id === debt.from);
                    const toUser = group.members.find(m => m._id === debt.to);
                    if (!fromUser || !toUser) return null;
                    const isMeFrom = fromUser._id === user?._id;
                    const isMeTo = toUser._id === user?._id;
                    
                    const hasPendingSettlement = expenses.some(exp => {
                      if (exp.status !== 'pending') return false;
                      const expPaidBy = exp.paidBy?._id || exp.paidBy;
                      const matchFrom = String(expPaidBy) === String(fromUser._id);
                      const matchTo = exp.splitAmong.some(s => String(s._id || s) === String(toUser._id));
                      return matchFrom && matchTo;
                    });
                    
                    return (
                      <div key={index} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-sm p-4 sm:p-5 rounded-2xl border ${hasPendingSettlement ? 'bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800' : 'bg-gray-50/80 dark:bg-gray-800/80 border-gray-100 dark:border-gray-700'} shadow-sm transition-all`}>
                        <div className="flex flex-wrap items-center w-full sm:w-auto">
                          <span className={`font-bold text-base ${isMeFrom ? 'text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>{isMeFrom ? 'You' : fromUser.name}</span>
                          <span className="mx-2 text-gray-400 font-medium">pay</span>
                          <span className={`font-bold text-base ${isMeTo ? 'text-green-500' : 'text-gray-800 dark:text-gray-200'}`}>{isMeTo ? 'You' : toUser.name}</span>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto border-t border-gray-200 sm:border-0 dark:border-gray-700 pt-3 sm:pt-0">
                          <span className="font-black text-xl text-gray-900 dark:text-white mr-4">₹{debt.amount}</span>
                          <div className="flex items-center space-x-2">
                            {(!isMeFrom || isMeTo) && (
                              <a 
                                href={`https://wa.me/?text=${encodeURIComponent(`Hey ${fromUser.name}! Just a quick reminder to send the ₹${debt.amount} to ${isMeTo ? 'me' : toUser.name} for our RoomSplit group "${group.name}". Thanks! 💸`)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 px-3 py-2 rounded-xl transition-colors font-bold"
                                title={`Send WhatsApp reminder to ${fromUser.name}`}
                              >
                                <MessageCircle size={18} className="sm:mr-1" /> <span className="hidden sm:inline">Remind</span>
                              </a>
                            )}
                            {isMeFrom && (
                              hasPendingSettlement ? (
                                <div className="text-yellow-700 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-500 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-xl flex items-center shadow-sm border border-yellow-200 dark:border-yellow-700/50 cursor-not-allowed whitespace-nowrap">
                                  <CheckCircle size={16} className="mr-1.5 opacity-70 shrink-0" /> Pending
                                </div>
                              ) : (
                                <button
                                  onClick={() => triggerSettle(fromUser._id, toUser._id, debt.amount)}
                                  className="text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/30 dark:hover:bg-primary-900/50 px-4 py-2 text-sm font-bold rounded-xl flex items-center transition-colors shadow-sm whitespace-nowrap shrink-0"
                                >
                                  <CheckCircle size={18} className="mr-1.5 shrink-0" /> Settle
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Members Section */}
          <div className={`glass soft-shadow p-6 rounded-3xl border border-white/50 dark:border-gray-700 ${activeTab === 'balances' ? 'hidden md:block' : ''}`}>
            <h3 className="text-xl font-bold mb-6 flex items-center"><Users className="mr-2 text-primary-500"/> Group Members</h3>
            
            <div className="space-y-3 mb-8">
              {group.members.map(member => (
                <div key={member._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/60 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm gap-1">
                  <div className="font-semibold text-gray-800 dark:text-gray-200">
                    {member.name} {member._id === user?._id && <span className="text-primary-500 font-bold ml-1 tracking-wide">(You)</span>}
                  </div>
                  <div className="text-xs text-gray-500 font-medium truncate">{member.email}</div>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><UserPlus className="mr-2 text-primary-500"/> Add New Member</h4>
              <form onSubmit={confirmAddMember} className="flex flex-col space-y-3">
                <div className="relative">
                  <div 
                    onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                    className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl font-medium cursor-pointer flex justify-between items-center transition hover:border-primary-400"
                  >
                    <span className="truncate">{selectedAddingUser ? `${selectedAddingUser.name} (${selectedAddingUser.email})` : 'Select a user...'}</span>
                    <ChevronDown size={18} className={`text-gray-400 transition-transform ${showMemberDropdown ? 'rotate-180' : ''}`} />
                  </div>
                  
                  <AnimatePresence>
                    {showMemberDropdown && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute z-20 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                        {nonMembers.map(u => (
                          <div 
                            key={u._id}
                            onClick={() => { setAddingUserId(u._id); setShowMemberDropdown(false); }}
                            className="px-4 py-3 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer text-sm border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors"
                          >
                            <span className="font-bold">{u.name}</span> <span className="text-gray-400">({u.email})</span>
                          </div>
                        ))}
                        {nonMembers.length === 0 && <div className="px-4 py-3 text-gray-400 text-sm font-medium">No users available</div>}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-primary-500/30 active:scale-[0.98] transition-all">
                  Add to Group
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar - 5 Items for Perfect Symmetry */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 flex justify-between items-center pb-safe pt-2 px-1 z-50 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.06)]">
        <button 
          onClick={() => window.location.href = '/'} 
          className="flex flex-col items-center p-2 flex-1 transition-colors text-gray-400 hover:text-gray-600"
        >
          <Home size={22} />
          <span className="text-[9px] font-bold mt-1 tracking-wide uppercase">Home</span>
        </button>

        <button 
          onClick={() => { setActiveTab('expenses'); setShowAddExpense(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
          className={`flex flex-col items-center p-2 flex-1 transition-colors ${activeTab === 'expenses' ? 'text-primary-600 scale-105' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Receipt size={22} />
          <span className="text-[9px] font-bold mt-1 tracking-wide uppercase">Expenses</span>
        </button>
        
        <div className="flex-[1.2] flex justify-center -mt-10 relative z-50 px-1">
          <button 
            onClick={() => { 
              setActiveTab('add'); 
              setShowAddExpense(true); 
              window.scrollTo({ top: 0, behavior: 'smooth' }); 
            }} 
            className={`bg-primary-500 hover:bg-primary-600 text-white rounded-full h-[60px] w-[60px] flex items-center justify-center shadow-xl shadow-primary-500/40 border-[5px] border-white dark:border-gray-900 transition-transform active:scale-95 ${activeTab === 'add' ? 'scale-110 ring-4 ring-primary-100 dark:ring-primary-900/40' : ''}`}
          >
            <Plus size={28} />
          </button>
        </div>

        <button 
          onClick={() => { setActiveTab('balances'); setShowAddExpense(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
          className={`flex flex-col items-center p-2 flex-1 transition-colors ${activeTab === 'balances' ? 'text-primary-600 scale-105' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Wallet size={22} />
          <span className="text-[9px] font-bold mt-1 tracking-wide uppercase">Balances</span>
        </button>

        <button 
          onClick={() => { setActiveTab('members'); setShowAddExpense(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
          className={`flex flex-col items-center p-2 flex-1 transition-colors ${activeTab === 'members' ? 'text-primary-600 scale-105' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Users size={22} />
          <span className="text-[9px] font-bold mt-1 tracking-wide uppercase">Members</span>
        </button>
      </div>

    </div>
  );
};

export default GroupDetails;
