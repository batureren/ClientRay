import { PluginProvider } from './context/PluginContext'
import { AuthProvider } from './context/AuthContext'
import { PackagesProvider } from './context/PackagesContext'
import MainPage from './pages/MainPage'
import SettingsPage from './pages/SettingsPage'
import PersonalPage from './pages/PersonalPage'
import EmailProviderSettings from './pages/EmailProviderSettings'
import DataFields from './pages/DataFields'
import ApiDocumentationPage from './pages/ApiDocumentationPage'
import Form2LeadEditor from './pages/Form2LeadEditor'
import PackagesPage from './pages/PackagesPage'
import ErrorBoundary from './components/ErrorBoundary'
import { Routes, Route } from 'react-router-dom'

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ErrorBoundary>
          <PluginProvider>
            <ErrorBoundary>
              <PackagesProvider>
                <Routes>
                  <Route path="/" element={<MainPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/personal" element={<PersonalPage />} />
                  <Route path="/email-setup" element={<EmailProviderSettings />} />
                  <Route path="/data-fields" element={<DataFields />} />
                  <Route path="/form2lead-editor" element={<Form2LeadEditor />} />
                  <Route path="/packages" element={<PackagesPage />} />
                  <Route path="/api-documentation" element={<ApiDocumentationPage />} />
                </Routes>
              </PackagesProvider>
            </ErrorBoundary>
          </PluginProvider>
        </ErrorBoundary>
      </AuthProvider>
    </ErrorBoundary>
  )
}