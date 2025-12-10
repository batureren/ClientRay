// frontend/pages/DataFields.jsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Database } from 'lucide-react';
import CustomFieldsSection from '../components/sections/CustomFieldsSection';
import FieldMappingsSection from '../components/sections/FieldMappingsSection';
import FormulaFieldsSection from '../components/sections/FormulaFieldsSection';
import ChainFieldsSection from '../components/sections/ChainFieldsSection';

export default function DataFieldsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('fields');
  const [message, setMessage] = useState({ type: '', content: '' });

  const clearMessage = () => setMessage({ type: '', content: '' });

  const TabButton = ({ tabName, label }) => (
    <button
      onClick={() => {
        setActiveTab(tabName);
        clearMessage();
      }}
      className={`px-4 py-2 rounded-lg transition-colors ${
        activeTab === tabName
          ? 'bg-blue-600 text-white'
          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('dataFields.backToSettings')}
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Database className="w-6 h-6" />
            {t('dataFields.title')}
          </h1>
        </div>
      </div>

      <div className="flex space-x-1 mb-6">
        <TabButton tabName="fields" label={t('dataFields.tabs.customFields')} />
        <TabButton tabName="mappings" label={t('dataFields.tabs.fieldMappings')} />
        <TabButton tabName="formulas" label={t('dataFields.tabs.formulaFields')} />
        <TabButton tabName="chain-fields" label={t('dataFields.tabs.chainFields')} />
      </div>

      {message.content && (
        <div className={`p-3 rounded-md mb-4 text-center ${message.type === 'success'
          ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
          : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
        }`}>
          {message.content}
        </div>
      )}

      <div>
        {activeTab === 'fields' && <CustomFieldsSection message={message} setMessage={setMessage} />}
        {activeTab === 'mappings' && <FieldMappingsSection message={message} setMessage={setMessage} />}
        {activeTab === 'formulas' && <FormulaFieldsSection message={message} setMessage={setMessage} />}
        {activeTab === 'chain-fields' && <ChainFieldsSection message={message} setMessage={setMessage} />}
      </div>
    </div>
  );
}