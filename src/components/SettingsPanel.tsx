import { useState } from 'react'
import { privacyShield } from '../chat/PrivacyShield'
import { BackupPanel } from './BackupPanel'

export function SettingsPanel() {
  const [cyberMode, setCyberMode] = useState(false)
  const [requiredProviders, setRequiredProviders] = useState<'github' | 'amazon'>('github')

  const toggleCyberMode = () => {
    const newMode = !cyberMode
    setCyberMode(newMode)
    privacyShield.updateConfig({
      cyberMode: newMode,
      requiredProviders: [requiredProviders],
    })
  }

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as 'github' | 'amazon'
    setRequiredProviders(value)
    privacyShield.updateConfig({
      cyberMode: true,
      requiredProviders: [value],
    })
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-400 text-sm">Manage your privacy and data</p>
      </header>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* PrivacyShield Section */}
        <div className="p-4 bg-[#1A1A1A] border border-[#00FFA3]/20 rounded-lg space-y-4">
          <h3 className="font-bold text-sm uppercase">PrivacyShield</h3>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Cyber Mode</div>
              <p className="text-xs text-gray-400 mt-0.5">
                Block messages from unverified users
              </p>
            </div>
            <button
              onClick={toggleCyberMode}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                cyberMode ? 'bg-[#00FFA3]' : 'bg-gray-600'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform absolute top-0.5 ${
                  cyberMode ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {cyberMode && (
            <div className="space-y-2 pt-2 border-t border-[#00FFA3]/10">
              <label className="text-sm text-gray-400">Required verification:</label>
              <select
                value={requiredProviders}
                onChange={handleProviderChange}
                className="w-full bg-[#1A1A1A] border border-[#00FFA3]/30 rounded px-3 py-2 text-sm"
              >
                <option value="github">GitHub (recommended)</option>
                <option value="amazon">Amazon Prime</option>
              </select>
              <p className="text-xs text-gray-500">
                Only users with the selected verification can message you.
              </p>
            </div>
          )}
        </div>

        {/* Backup & Restore Section */}
        <BackupPanel />

        {/* Data Warning */}
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded text-xs text-red-400">
          <strong>Data Sovereignty Notice:</strong> All data resides locally in your browser.
          If you clear site data or switch devices, you must use a backup to restore.
          CyberChat does not store any of your information on centralized servers.
        </div>
      </div>
    </div>
  )
}
