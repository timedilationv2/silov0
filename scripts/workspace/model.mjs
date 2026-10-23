export const MAX_CONTENT = 1_000_000
export const MAX_FILE_BYTES = 2_000_000
export const MAX_BACKUP_BYTES = 10_000_000
export const MAX_DOCUMENTS = 500
export const BACKUP_FORMAT = 'silov0-workspace'

export function makeDocument(title = 'Untitled document', content = '', collection = '') {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), title, content, collection, createdAt: now, updatedAt: now, revision: 0 }
}

export function validateDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Document must be an object.')
  for (const [key, max] of [['id', 100], ['title', 200], ['content', MAX_CONTENT], ['collection', 80]]) {
    if (typeof value[key] !== 'string' || value[key].length > max) throw new Error(`Invalid document ${key}.`)
  }
  if (!/^[a-zA-Z0-9-]+$/.test(value.id)) throw new Error('Invalid document ID.')
  for (const key of ['createdAt', 'updatedAt']) {
    if (typeof value[key] !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(value[key]) ||
      !Number.isFinite(Date.parse(value[key])) || new Date(value[key]).toISOString() !== value[key]) throw new Error('Invalid document timestamp.')
  }
  if (value.updatedAt < value.createdAt) throw new Error('Modification time precedes creation time.')
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) throw new Error('Invalid document revision.')
  // Explicit construction discards unknown keys, including prototype-shaped keys.
  return { id: value.id, title: value.title, content: value.content, collection: value.collection,
    createdAt: value.createdAt, updatedAt: value.updatedAt, revision: value.revision }
}

export function backupJSON(documents) {
  const text = JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(),
    documents: documents.map(validateDocument) }, null, 2)
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('The combined backup exceeds 10 MB. Export individual Markdown documents or reduce the library before creating a restorable JSON backup.')
  return text
}

export function parseBackup(text) {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('Backup exceeds 10 MB.')
  let data
  try { data = JSON.parse(text) } catch { throw new Error('Backup is not valid JSON.') }
  if (!data || data.format !== BACKUP_FORMAT || data.version !== 1 || !Array.isArray(data.documents) || data.documents.length > MAX_DOCUMENTS) {
    throw new Error('Unsupported backup. Use a version 1 SiloV0 backup with at most 500 documents.')
  }
  const documents = data.documents.map(validateDocument)
  if (new Set(documents.map(d => d.id)).size !== documents.length) throw new Error('Backup contains duplicate IDs.')
  return documents
}

export function restoredCopies(incoming, existing) {
  const titles = new Set(existing.map(d => d.title))
  return incoming.map(value => {
    const doc = validateDocument(value)
    let title = doc.title || 'Untitled document'
    if (titles.has(title)) {
      const base = title.slice(0, 170)
      title = `${base} (restored)`
      let n = 2
      while (titles.has(title)) title = `${base} (restored ${n++})`
    }
    titles.add(title)
    return { ...doc, id: crypto.randomUUID(), title, revision: 0 }
  })
}

export function fileName(title, extension) {
  return (title.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 100) || 'document') + extension
}
