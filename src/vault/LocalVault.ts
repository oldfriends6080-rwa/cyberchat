import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

interface Profile {
  id: string
  displayName: string
  avatarBase64?: string
  createdAt: number
}

interface Contact {
  walletAddress: string
  localName: string
  note?: string
  verifiedBadges: string[]
  updatedAt: number
}

interface Credential {
  id: string
  type: 'github' | 'amazon' | 'linkedin' | 'twitter'
  proofJson: string
  metadata: Record<string, unknown>
  verifiedAt: number
}

interface BackupMeta {
  version: string
  exportedAt: number
  walletAddress: string
}

interface CyberChatDB extends DBSchema {
  profiles: {
    key: string
    value: Profile
  }
  contacts: {
    key: string
    value: Contact
  }
  credentials: {
    key: string
    value: Credential
  }
  backup: {
    key: string
    value: BackupMeta
  }
}

class LocalVault {
  private db: IDBPDatabase<CyberChatDB> | null = null
  private static instance: LocalVault

  private constructor() {}

  static getInstance(): LocalVault {
    if (!LocalVault.instance) {
      LocalVault.instance = new LocalVault()
    }
    return LocalVault.instance
  }

  async init(): Promise<void> {
    if (this.db) return

    this.db = await openDB<CyberChatDB>('cyberchat-vault', 1, {
      upgrade(db) {
        db.createObjectStore('profiles')
        db.createObjectStore('contacts', { keyPath: 'walletAddress' })
        db.createObjectStore('credentials')
        db.createObjectStore('backup')
      },
    })
  }

  async getProfile(walletAddress: string): Promise<Profile | undefined> {
    await this.init()
    return this.db!.get('profiles', walletAddress)
  }

  async setProfile(profile: Profile): Promise<void> {
    await this.init()
    await this.db!.put('profiles', profile, profile.id)
  }

  async getContact(walletAddress: string): Promise<Contact | undefined> {
    await this.init()
    const key = walletAddress.toLowerCase()
    // Try exact lowercase key first (fast path)
    let contact = await this.db!.get('contacts', key)
    if (contact) {
      return { ...contact, walletAddress: key }
    }
    // Fallback: scan all contacts for case-insensitive match (handles legacy mixed-case keys)
    const all = await this.db!.getAll('contacts')
    const found = all.find(c => c.walletAddress.toLowerCase() === key)
    if (found) {
      // Normalize and re-save to prevent future duplicates
      const normalized = { ...found, walletAddress: key }
      await this.db!.put('contacts', normalized)
      // Also delete the old mixed-case key if different
      if (found.walletAddress !== key) {
        await this.db!.delete('contacts', found.walletAddress)
      }
      return normalized
    }
    return undefined
  }

  async setContact(contact: Contact): Promise<void> {
    await this.init()
    const normalized = { ...contact, walletAddress: contact.walletAddress.toLowerCase() }
    await this.db!.put('contacts', normalized)
  }

  async getAllContacts(): Promise<Contact[]> {
    await this.init()
    const all = await this.db!.getAll('contacts')
    // Deduplicate by lowercase walletAddress (in case old mixed-case keys exist)
    const seen = new Set<string>()
    const unique: Contact[] = []
    for (const c of all) {
      const key = c.walletAddress.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        unique.push({ ...c, walletAddress: key })
      }
    }
    // Sort by localName for stable UI ordering
    unique.sort((a, b) => a.localName.localeCompare(b.localName))
    return unique
  }

  async getCredentials(walletAddress: string): Promise<Credential[]> {
    await this.init()
    const all = await this.db!.getAll('credentials')
    return all.filter((c) => c.id.startsWith(walletAddress))
  }

  async addCredential(credential: Credential): Promise<void> {
    await this.init()
    await this.db!.put('credentials', credential, credential.id)
  }

  async removeCredential(walletAddress: string, type: string): Promise<void> {
    await this.init()
    await this.db!.delete('credentials', `${walletAddress}-${type}`)
  }

  async exportVault(walletAddress: string): Promise<{
    profile: Profile | undefined
    contacts: Contact[]
    credentials: Credential[]
    backupMeta: BackupMeta
  }> {
    await this.init()
    const [profile, contacts, credentials] = await Promise.all([
      this.getProfile(walletAddress),
      this.getAllContacts(),
      this.getCredentials(walletAddress),
    ])

    return {
      profile,
      contacts,
      credentials,
      backupMeta: {
        version: '1.0',
        exportedAt: Date.now(),
        walletAddress,
      },
    }
  }

  async importVault(
    walletAddress: string,
    data: {
      profile?: Profile
      contacts?: Contact[]
      credentials?: Credential[]
    }
  ): Promise<void> {
    await this.init()
    // Validate ownership: profile.id must match walletAddress
    if (data.profile && data.profile.id !== walletAddress) {
      throw new Error('Vault profile ID does not match current wallet address')
    }
    if (data.profile) await this.setProfile(data.profile)
    if (data.contacts) {
      for (const contact of data.contacts) {
        await this.setContact(contact)
      }
    }
    if (data.credentials) {
      for (const cred of data.credentials) {
        await this.addCredential(cred)
      }
    }
  }

  async clearAll(): Promise<void> {
    await this.init()
    await this.db!.clear('profiles')
    await this.db!.clear('contacts')
    await this.db!.clear('credentials')
    await this.db!.clear('backup')
  }
}

export const vault = LocalVault.getInstance()
export type { Profile, Contact, Credential, BackupMeta }
