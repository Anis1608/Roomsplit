import { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { motion } from 'framer-motion';
import { Users, PlusCircle } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const Dashboard = () => {
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await api.get('/groups');
      setGroups(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const createGroup = async (e) => {
    e.preventDefault();
    try {
      await api.post('/groups', { name: newGroupName, members: [user._id] });
      setNewGroupName('');
      setShowCreate(false);
      fetchGroups();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Your Groups</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center space-x-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-primary-500/30 transition-all active:scale-[0.98]"
        >
          <PlusCircle size={20} />
          <span className="hidden sm:inline">New Group</span>
        </button>
      </div>

      {showCreate && (
        <motion.form 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass soft-shadow p-6 rounded-2xl border dark:border-gray-700"
          onSubmit={createGroup}
        >
          <h3 className="text-lg font-bold mb-4">Create New Group</h3>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
            <input
              type="text"
              placeholder="e.g. Goa Trip, Apartment 4B"
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-900 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              required
            />
            <button type="submit" className="bg-primary-600 text-white px-8 py-2.5 rounded-xl font-semibold hover:bg-primary-700 transition shadow-md">
              Create
            </button>
          </div>
        </motion.form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group) => (
          <Link key={group._id} to={`/group/${group._id}`}>
            <motion.div 
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="relative overflow-hidden p-4 sm:p-6 rounded-2xl md:rounded-3xl transition-all duration-300 shadow-md hover:shadow-xl shadow-primary-500/10 bg-gradient-to-br from-primary-600 to-primary-800 group"
            >
              {/* Aesthetic glass circles */}
              <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 rounded-full bg-white/10 blur-xl transition-transform group-hover:scale-110"></div>
              <div className="absolute bottom-0 left-0 -ml-4 -mb-4 w-20 h-20 rounded-full bg-black/20 blur-lg"></div>
              
              <div className="relative z-10 flex flex-row items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg sm:text-2xl font-black mb-1.5 text-white drop-shadow-sm leading-tight break-words pr-2">{group.name}</h3>
                  <div className="flex items-center text-primary-50 text-[10px] sm:text-xs font-bold bg-black/20 px-2.5 py-1 rounded-full backdrop-blur-md w-max border border-white/10 uppercase tracking-wide">
                    <Users size={12} className="mr-1.5 opacity-90" />
                    <span>{group.members.length} Members</span>
                  </div>
                </div>
                
                <div className="shrink-0 flex items-center justify-center">
                  <span className="text-base bg-white/20 rounded-full w-8 h-8 flex items-center justify-center backdrop-blur-sm group-hover:translate-x-1 group-hover:bg-white/30 transition-all text-white font-black shadow-inner shadow-white/10">→</span>
                </div>
              </div>
            </motion.div>
          </Link>
        ))}
        {groups.length === 0 && !showCreate && (
          <div className="col-span-full py-16 text-center text-gray-400">
            <Users size={64} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">You haven't joined any groups yet.</p>
            <p className="text-sm mt-1">Create one to start splitting expenses!</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};
export default Dashboard;
