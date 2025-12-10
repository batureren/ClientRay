// frontend/pages/SettingsPage.jsx

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlugins } from '../context/PluginContext';
import { ArrowLeft, User, Lock, Camera, Save, X, Mail, Database, Settings as SettingsIcon, ExternalLink, Code, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';

export default function SettingsPage() {
  const { t } = useTranslation();
  const user = useAuth();
  const api = useApi();
  const { allPlugins, enabledPlugins, togglePlugin } = usePlugins();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [profileData, setProfileData] = useState({ first_name: '', last_name: '', email: '', profile_picture: null });
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);

  useEffect(() => {
    if (user.user) {
      setProfileData({
        first_name: user.user.first_name || '',
        last_name: user.user.last_name || '',
        email: user.user.email || '',
        profile_picture: user.user.profile_picture || null
      });
      setIsProfileLoaded(true);
    }
  }, [user.user]);

  const [passwordData, setPasswordData] = useState({ new_password: '', confirm_password: '' });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [previewImage, setPreviewImage] = useState(null);

  const handleImageUpload = (file) => {
    if (!file) return null;
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'), img = new Image();
      img.onload = () => {
        try {
          canvas.width = 126; canvas.height = 126;
          const minSize = Math.min(img.width, img.height), scale = 126 / minSize;
          const scaledWidth = img.width * scale, scaledHeight = img.height * scale;
          const offsetX = (126 - scaledWidth) / 2, offsetY = (126 - scaledHeight) / 2;
          ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
          canvas.toBlob((blob) => resolve(blob || null), 'image/webp', 0.7);
        } catch (error) { console.error('Canvas processing error:', error); resolve(null); }
      };
      img.onerror = (error) => { console.error('Image load error:', error); resolve(null); };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert(t('settings.profile.imageFileError')); return; }
    setPreviewImage(URL.createObjectURL(file));
    const webpBlob = await handleImageUpload(file);
    if (webpBlob) setProfileData(prev => ({ ...prev, profile_picture: webpBlob }));
  };

  const removeProfilePicture = () => {
    setProfileData(prev => ({ ...prev, profile_picture: null }));
    setPreviewImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!profileData.first_name.trim()) { setProfileMessage(t('settings.profile.errors.firstNameRequired')); return; }
    if (!profileData.last_name.trim()) { setProfileMessage(t('settings.profile.errors.lastNameRequired')); return; }
    if (!profileData.email.trim()) { setProfileMessage(t('settings.profile.errors.emailRequired')); return; }
    setIsUpdatingProfile(true); setProfileMessage('');
    try {
      const formData = new FormData();
      formData.append('first_name', profileData.first_name);
      formData.append('last_name', profileData.last_name);
      formData.append('email', profileData.email);
      if (profileData.profile_picture instanceof Blob) formData.append('profile_picture', profileData.profile_picture, 'profile.webp');
      const response = await api.put('/auth/profile', formData);
      if (response.success) {
        setProfileMessage(t('settings.profile.success'));
        if (window.updateUser) window.updateUser(response.user);
        setPreviewImage(null);
        setProfileData(prev => ({ ...prev, profile_picture: null }));
      } else {
        setProfileMessage(response.errors?.[0]?.message || t('settings.profile.errors.updateFailed'));
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setProfileMessage(error.response?.data?.errors?.[0]?.message || t('settings.profile.errors.genericError'));
    }
    setIsUpdatingProfile(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setIsChangingPassword(true); setPasswordMessage('');
    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordMessage(t('settings.password.errors.noMatch')); setIsChangingPassword(false); return;
    }
    if (passwordData.new_password.length < 6) {
      setPasswordMessage(t('settings.password.errors.tooShort')); setIsChangingPassword(false); return;
    }
    try {
      await api.put('/auth/change-password', { new_password: passwordData.new_password });
      setPasswordMessage(t('settings.password.success'));
      setPasswordData({ new_password: '', confirm_password: '' });
    } catch (error) {
      setPasswordMessage(t('settings.password.errors.changeFailed')); console.error('Password change error:', error);
    }
    setIsChangingPassword(false);
  };

  if (!isProfileLoaded && user.loading) {
    return (
      <div className="min-h-screen bg-background dark:bg-background container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center h-64"><div className="text-lg text-gray-600 dark:text-gray-300">{t('settings.loading')}</div></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />{t('settings.backToHome')}
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('settings.title')}</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2"><User className="w-5 h-5" />{t('settings.profile.title')}</h2>
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                    {previewImage || (user.user?.profile_picture && typeof user.user.profile_picture === 'string') ? (
                      <img src={previewImage || `${import.meta.env.VITE_BASE_URL}/uploads/profiles/${user.user.profile_picture}`} alt={t('settings.profile.alt')} className="w-full h-full object-cover" />
                    ) : ( <User className="w-12 h-12 text-gray-400" /> )}
                  </div>
                  {(previewImage || user.user?.profile_picture) && ( <button type="button" onClick={removeProfilePicture} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"><X className="w-4 h-4" /></button> )}
                </div>
                <div className="flex gap-2">
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"><Camera className="w-4 h-4" />{t('settings.profile.uploadButton')}</button>
                </div>
                <p className="text-sm text-gray-500 text-center">{t('settings.profile.imageRecommendation')}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label htmlFor="first_name" className="block text-sm font-medium mb-2">{t('settings.profile.firstNameLabel')}</label><input type="text" id="first_name" value={profileData.first_name} onChange={(e) => setProfileData(prev => ({ ...prev, first_name: e.target.value }))} className="w-full px-3 py-2 border rounded-md focus:ring-2" required /></div>
                <div><label htmlFor="last_name" className="block text-sm font-medium mb-2">{t('settings.profile.lastNameLabel')}</label><input type="text" id="last_name" value={profileData.last_name} onChange={(e) => setProfileData(prev => ({ ...prev, last_name: e.target.value }))} className="w-full px-3 py-2 border rounded-md focus:ring-2" required /></div>
              </div>
              <div><label htmlFor="email" className="block text-sm font-medium mb-2">{t('settings.profile.emailLabel')}</label><input type="email" id="email" value={profileData.email} onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))} className="w-full px-3 py-2 border rounded-md focus:ring-2" required /></div>
              {profileMessage && <div className={`p-3 rounded-md ${profileMessage.includes(t('settings.profile.successCheck')) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{profileMessage}</div>}
              <button type="submit" disabled={isUpdatingProfile} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"><Save className="w-4 h-4" />{isUpdatingProfile ? t('settings.profile.updatingButton') : t('settings.profile.updateButton')}</button>
            </form>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2"><Lock className="w-5 h-5" />{t('settings.password.title')}</h2>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div><label htmlFor="new_password" className="block text-sm font-medium mb-2">{t('settings.password.newPasswordLabel')}</label><input type="password" id="new_password" value={passwordData.new_password} onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))} className="w-full px-3 py-2 border rounded-md focus:ring-2" minLength="6" required /></div>
              <div><label htmlFor="confirm_password" className="block text-sm font-medium mb-2">{t('settings.password.confirmPasswordLabel')}</label><input type="password" id="confirm_password" value={passwordData.confirm_password} onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))} className="w-full px-3 py-2 border rounded-md focus:ring-2" minLength="6" required /></div>
              {passwordMessage && <div className={`p-3 rounded-md ${passwordMessage.includes(t('settings.password.successCheck')) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{passwordMessage}</div>}
              <button type="submit" disabled={isChangingPassword} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"><Lock className="w-4 h-4" />{isChangingPassword ? t('settings.password.changingButton') : t('settings.password.changeButton')}</button>
            </form>
          </div>
        </section>
        <section className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Code className="w-5 h-5" />{t('settings.api.title', 'API Documentation')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('settings.api.description', 'View available REST API endpoints for external integrations.')}</p>
            <button onClick={() => navigate('/api-documentation')} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"><Code className="w-4 h-4" />{t('settings.api.button', 'View API Routes')}<ExternalLink className="w-4 h-4" /></button>
            <div className="mt-3 text-xs text-gray-500">{t('settings.api.note', 'Browse and test available API endpoints.')}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Database className="w-5 h-5" />{t('settings.fields.title')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('settings.fields.description')}</p>
            <button onClick={() => navigate('/data-fields')} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"><SettingsIcon className="w-4 h-4" />{t('settings.fields.button')}<ExternalLink className="w-4 h-4" /></button>
            <div className="mt-3 text-xs text-gray-500">{t('settings.fields.note')}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Mail className="w-5 h-5" />{t('settings.email.title')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('settings.email.description')}</p>
            <button onClick={() => navigate('/email-setup')} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"><SettingsIcon className="w-4 h-4" />{t('settings.email.button')}<ExternalLink className="w-4 h-4" /></button>
            <div className="mt-3 text-xs text-gray-500">{t('settings.email.note')}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Code className="w-5 h-5" />{t('settings.form2lead.title')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('settings.form2lead.description')}</p>
            <button onClick={() => navigate('/form2lead-editor')} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"><Code className="w-4 h-4" />{t('settings.form2lead.button')}<ExternalLink className="w-4 h-4" /></button>
            <div className="mt-3 text-xs text-gray-500">{t('settings.form2lead.note')}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Package className="w-5 h-5" />{t('settings.packages.title', 'Packages')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('settings.packages.description', 'Set integrations of 3rd party apps.')}</p>
            <button onClick={() => navigate('/packages')} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg"><Package className="w-4 h-4" />{t('settings.packages.button', 'Manage Integrations')}<ExternalLink className="w-4 h-4" /></button>
            <div className="mt-3 text-xs text-gray-500">{t('settings.packages.note', 'Connect and manage third-party applications.')}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-6">{t('settings.theme.title')}</h2>
            <div className="flex items-center justify-between"><span className="text-lg font-medium">{t('settings.theme.darkMode')}</span><label htmlFor="theme-toggle" className="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="theme-toggle" className="sr-only peer" checked={theme === 'dark'} onChange={toggleTheme} /><div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" /></label></div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-6">{t('settings.plugins.title')}</h2>
            <div className="space-y-4">{allPlugins.map(plugin => { const isEnabled = enabledPlugins[plugin.id] ?? plugin.enabledByDefault; return (<div key={plugin.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100"><div className="flex-1 min-w-0 pr-4"><p className="text-lg font-semibold">{plugin.name}</p><p className="text-sm text-gray-500 mt-1">{plugin.description}</p></div><label htmlFor={`toggle-${plugin.id}`} className="relative inline-flex items-center cursor-pointer flex-shrink-0"><input type="checkbox" id={`toggle-${plugin.id}`} className="sr-only peer" checked={isEnabled} onChange={() => togglePlugin(plugin.id)} /><div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" /></label></div>); })}</div>
          </div>
        </section>
      </div>
    </div>
  );
}