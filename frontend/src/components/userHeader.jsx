import { User, LogOut, Settings, CircleUserRound, HomeIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import TaskNotifications from './notifications/TaskNotifications'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useTranslation } from 'react-i18next'

export default function UserHeader({ user, onTaskClick, refreshTrigger, onLogout, isPersonalPage }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className="flex justify-between items-center mb-6 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
{user.profile_picture ? (
  <img 
    src={`${import.meta.env.VITE_BASE_URL}/uploads/profiles/${user.profile_picture}`} 
    alt="User profile"
    className='rounded-full'
  />
) : (
  <User className="w-5 h-5 text-white" />
)}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {user.first_name} {user.last_name}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 capitalize">{user.role}</p>
        </div>
        {isPersonalPage ? (null) 
        : (
        <TaskNotifications 
          user={user} 
          onTaskClick={onTaskClick}
          refreshTrigger={refreshTrigger}
        />
        )}

      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <LanguageSwitcher />
        {isPersonalPage ? (
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <HomeIcon className="w-4 h-4" />
          {t('navigation.home')}
        </button>
        ) : (
        <button
          onClick={() => navigate('/personal')}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <CircleUserRound className="w-4 h-4" />
          {t('navigation.personal')}
        </button>
        )}


        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          {t('navigation.settings')}
        </button>

        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {t('auth.logout')}
        </button>
      </div>
    </div>
  )
}

