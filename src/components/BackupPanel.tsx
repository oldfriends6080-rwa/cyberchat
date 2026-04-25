import { useState, useRef } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { backupManager } from '../backup/BackupManager'

export function BackupPanel() {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [status, setStatus] = useState<'idle' | 'exporting' | 'importing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    if (!address) return

    setStatus('exporting')
    setMessage('Creating encrypted backup...')

    try {
      const blob = await backupManager.exportVault(address, async (msg) => {
        return signMessageAsync({ message: msg })
      })

      backupManager.downloadBackup(blob, `trustlink_backup_${Date.now()}.json`)

      setStatus('success')
      setMessage('Backup exported successfully!')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      console.error('Export failed:', err)
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Export failed')
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !address || !signMessageAsync) return

    setStatus('importing')
    setMessage('Reading backup file...')

    try {
      const content = await file.text()
      const result = await backupManager.importVault(content, address)

      if (result.success) {
        setStatus('success')
        setMessage(result.message)
        setTimeout(() => setStatus('idle'), 4000)
      } else {
        setStatus('error')
        setMessage(result.message)
      }
    } catch (err) {
      console.error('Import failed:', err)
      setStatus('error')
      setMessage('Failed to read backup file')
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'exporting':
      case 'importing': return 'text-yellow-400'
      case 'success': return 'text-[#00FFA3]'
      case 'error': return 'text-red-500'
      default: return 'text-gray-400'
    }
  }

  const getButtonClass = () => {
    const base = 'px-4 py-2 rounded font-mono text-sm transition-all disabled:opacity-50'
    if (status === 'exporting' || status === 'importing') {
      return `${base} bg-gray-700 cursor-wait`
    }
    return `${base} bg-[#00FFA3] text-black hover:bg-[#00FFA3]/80`
  }

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <div className="p-4 bg-[#1A1A1A] border border-[#00FFA3]/20 rounded-lg">
        <h3 className="font-bold text-sm uppercase mb-3">Export Vault</h3>
        <p className="text-xs text-gray-400 mb-4">
          Download an encrypted backup of all your contacts, credentials, and profile data.
          The file is signed with your wallet to ensure authenticity.
        </p>
        <button
          onClick={handleExport}
          disabled={status === 'exporting' || !address}
          className={getButtonClass()}
        >
          {status === 'exporting' ? 'Exporting...' : 'Download Backup'}
        </button>
      </div>

      {/* Import Section */}
      <div className="p-4 bg-[#1A1A1A] border border-[#00FFA3]/20 rounded-lg">
        <h3 className="font-bold text-sm uppercase mb-3">Import Vault</h3>
        <p className="text-xs text-gray-400 mb-4">
          Restore your data from a previously exported backup file.
          You must sign with the same wallet that created the backup.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={handleImportClick}
          disabled={status === 'importing' || !address}
          className={getButtonClass()}
        >
          {status === 'importing' ? 'Importing...' : 'Upload Backup'}
        </button>
      </div>

      {/* Status Message */}
      {status !== 'idle' && (
        <div className={`p-3 border rounded text-center text-sm ${getStatusColor()} ${
          status === 'error' ? 'border-red-500 bg-red-900/20' : 'border-[#00FFA3]/30 bg-[#00FFA3]/10'
        }`}>
          {message}
        </div>
      )}

      {/* Warning */}
      <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded text-xs text-yellow-500">
        <strong>Security Notice:</strong> Keep your backup file secure. Anyone with this file
        can import your contact notes and credential metadata. Never share it publicly.
      </div>
    </div>
  )
}
