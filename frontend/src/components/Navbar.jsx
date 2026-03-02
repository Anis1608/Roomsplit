import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { Moon, Sun, LogOut, User, X, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const Navbar = () => {
  const { user, logout, updateProfile } = useContext(AuthContext);
  const { darkMode, toggleTheme } = useContext(ThemeContext);
  
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', upiId: '' });

  const openProfile = () => {
    setProfileData({
      name: user?.name || '',
      upiId: user?.upiId || ''
    });
    setShowProfile(true);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      await updateProfile(profileData);
      toast.success("Profile updated successfully!");
      setShowProfile(false);
    } catch (err) {
      toast.error("Failed to update profile");
      console.error(err);
    }
  };

  return (
    <>
    <nav className="fixed top-0 w-full z-40 glass soft-shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            {user && (
              <button onClick={openProfile} className="p-2 sm:mr-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition shadow-sm border border-primary-200 dark:border-primary-800">
                <User size={20} strokeWidth={2.5} />
              </button>
            )}
            <Link to="/" className="text-2xl font-black text-primary-600 dark:text-primary-500 tracking-tight drop-shadow-sm">
              RoomSplit
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium hidden sm:block">Hello, {user?.name}</span>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              aria-label="Toggle Dark Mode"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={logout}
              className="flex items-center space-x-1 p-2 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition"
            >
              <LogOut size={20} />
              <span className="hidden sm:inline font-bold">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
    
    <AnimatePresence>
      {showProfile && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white dark:bg-gray-800 p-8 rounded-[32px] w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-700/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-primary-500 to-primary-700 opacity-20 blur-2xl"></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary-500 to-primary-600 text-white flex items-center justify-center shadow-lg shadow-primary-500/30 text-3xl font-black mb-2">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <button onClick={() => setShowProfile(false)} className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors text-gray-500 dark:text-gray-400">
                  <X size={20} className="shrink-0"/>
                </button>
              </div>
              
              <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-6 tracking-tight">Your Profile</h2>
              
              <form onSubmit={saveProfile} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Name</label>
                  <input type="text" value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} className="w-full px-4 py-3 border-2 border-gray-100 dark:border-gray-700 focus:border-primary-500 dark:focus:border-primary-500 rounded-xl bg-gray-50 dark:bg-gray-900/50 outline-none font-bold text-gray-800 dark:text-white transition-colors" required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">UPI ID</label>
                  <input type="text" value={profileData.upiId} onChange={e => setProfileData({...profileData, upiId: e.target.value})} placeholder="yourname@upi" className="w-full px-4 py-3 border-2 border-gray-100 dark:border-gray-700 focus:border-primary-500 dark:focus:border-primary-500 rounded-xl bg-gray-50 dark:bg-gray-900/50 outline-none font-bold text-gray-800 dark:text-white transition-colors" />
                </div>
                <div className="pt-4">
                  <button type="submit" className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl font-black text-lg transition-transform active:scale-[0.98] shadow-lg shadow-primary-500/30 flex items-center justify-center">
                    <CheckCircle size={20} className="mr-2" /> Save Profile
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default Navbar;
