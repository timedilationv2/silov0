import { openStore } from './storage.mjs'
import { makeDocument, validateDocument, backupJSON, parseBackup, restoredCopies, fileName,
  MAX_CONTENT, MAX_FILE_BYTES, MAX_BACKUP_BYTES, MAX_DOCUMENTS } from './model.mjs'
import { templates } from './templates.mjs'
import { renderMarkdown, exportHTML } from './markdown.mjs'
import { reviewDocument } from './quality.mjs'

const $ = id => document.getElementById(id)
const node = (tag, text, className) => {
  const element = document.createElement(tag)
  if (text !== undefined) element.textContent = text
  if (className) element.className = className
  return element
}
const preferences = {
  get(key, fallback = '') { try { return localStorage.getItem('silov0-' + key) || fallback } catch { return fallback } },
  set(key, value) { try { localStorage.setItem('silov0-' + key, value) } catch { /* Preferences are optional, never document storage. */ } },
}
let store, documents = [], active = null, dirty = false, generation = 0
let saveTimer, renderTimer, saving = null, busy = false

function notice(message) { $('notice').textContent = message }
function saveStatus(message, state = 'saved') {
  $('save-status').textContent = message
  $('save-status').dataset.state = state
}
function showError(error) {
  $('error-text').textContent = error.name === 'QuotaExceededError' ? 'Browser storage is full. Your draft is still in the editor. Download a copy before leaving, then free storage and retry.' : error.message || 'Operation failed. Your editor content has been preserved.'
  $('error').hidden = false
  $('save-copy').disabled = !active || !store
  $('recover-md').disabled = !active
  $('retry').textContent = store ? 'Retry save' : 'Retry storage'
}
function clearError() { $('error').hidden = true }
function formatDate(iso) { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) }
function displayTitle(doc) { return doc.title.trim() || 'Untitled document' }

function renderNavigation() {
  const search = $('search-docs').value.toLowerCase(), collection = $('collection-filter').value
  const all = documents.map(doc => active?.id === doc.id ? active : doc)
  const matches = all.filter(doc => displayTitle(doc).toLowerCase().includes(search) && (!collection || doc.collection === collection))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const fragment = document.createDocumentFragment()
  for (const doc of matches) {
    const button = node('button', undefined, 'document-item')
    button.setAttribute('aria-current', String(active?.id === doc.id))
    button.append(node('strong', displayTitle(doc)), node('span', (doc.collection || 'Unfiled') + ' · ' + new Date(doc.updatedAt).toLocaleDateString()))
    button.addEventListener('click', () => operation(() => openDocument(doc.id)))
    fragment.append(button)
  }
  if (!matches.length) fragment.append(node('p', all.length ? 'No matching documents. Clear the search or collection filter.' : 'No documents yet. Choose a template and create your first one.'))
  $('document-list').replaceChildren(fragment)
  $('document-count').textContent = all.length
  const collections = [...new Set(all.map(d => d.collection).filter(Boolean))].sort()
  const filter = $('collection-filter'), previous = filter.value
  filter.replaceChildren(new Option('All collections', ''), ...collections.map(c => new Option(c, c)))
  // Keep an active filter visible while a document is being moved out of it.
  if (previous && !collections.includes(previous)) filter.append(new Option(previous, previous))
  filter.value = previous
  $('collections').replaceChildren(...collections.map(c => new Option(c, c)))
}
function renderMetadata() {
  if (!active) return
  $('timestamps').textContent = 'Created ' + formatDate(active.createdAt) + ' · Modified ' + formatDate(active.updatedAt)
}
function renderContent() {
  if (!active) return
  try {
    $('preview').replaceChildren(renderMarkdown(active.content))
    if (!active.content.trim()) $('preview').append(node('p', 'Your rendered document will appear here.'))
    const findings = reviewDocument(active)
    const errors = findings.filter(f => f.severity === 'error').length
    $('review-count').textContent = `${errors} errors · ${findings.length - errors} warnings`
    const fragment = document.createDocumentFragment()
    for (const finding of findings) {
      const button = node('button', undefined, 'finding')
      const label = node('strong')
      label.append(node('span', finding.severity, 'severity ' + finding.severity), document.createTextNode(finding.message + (finding.line ? ` · line ${finding.line}` : '')))
      button.append(label, node('span', finding.explanation))
      button.addEventListener('click', () => {
        if (!finding.line) { $('doc-title').focus(); return }
        if ($('workspace').dataset.view === 'preview') setView('editor')
        const editor = $('editor')
        const position = active.content.split('\n').slice(0, finding.line - 1).join('\n').length + (finding.line > 1 ? 1 : 0)
        editor.focus(); editor.setSelectionRange(position, position)
        editor.scrollTop = Math.max(0, (finding.line - 4) * 25)
        cursorPosition()
      })
      fragment.append(button)
    }
    if (!findings.length) fragment.append(node('p', 'No findings from these checks. This is not a guarantee of accuracy or completeness.', 'review-clean'))
    $('findings').replaceChildren(fragment)
    const words = active.content.trim() ? active.content.trim().split(/\s+/).length : 0
    $('word-count').textContent = `${words} words · ${active.content.length.toLocaleString()} characters`
  } catch {
    $('preview').replaceChildren(node('p', 'Preview could not be rendered. Your Markdown is still available in the editor.'))
    $('review-count').textContent = 'Review unavailable'
    $('findings').replaceChildren()
  }
}
function setActive(doc) {
  clearTimeout(saveTimer); clearTimeout(renderTimer)
  active = doc ? { ...doc } : null
  dirty = false; generation++
  $('document-area').hidden = !active
  $('welcome').hidden = !!active
  if (active) {
    $('doc-title').value = active.title
    $('doc-collection').value = active.collection
    $('editor').value = active.content
    $('editor').setSelectionRange(0, 0)
    $('editor').scrollTop = 0
    $('preview').scrollTop = 0
    preferences.set('active', active.id)
    saveStatus('Saved locally')
    renderMetadata(); renderContent(); cursorPosition()
  } else preferences.set('active', '')
  renderNavigation()
}
function edit() {
  if (!active) return
  active.title = $('doc-title').value
  active.collection = $('doc-collection').value
  active.content = $('editor').value
  active.updatedAt = new Date().toISOString()
  dirty = true; generation++
  saveStatus('Unsaved changes…', 'pending')
  clearTimeout(saveTimer); saveTimer = setTimeout(() => flush(), 450)
  clearTimeout(renderTimer); renderTimer = setTimeout(renderContent, 160)
  renderNavigation(); cursorPosition()
}
async function saveOnce() {
  if (saving) return saving
  const snapshot = { ...active }, version = generation
  saving = (async () => {
    try {
      saveStatus('Saving…', 'pending')
      const saved = await store.save(snapshot)
      documents = documents.map(doc => doc.id === saved.id ? saved : doc)
      if (active?.id === saved.id) {
        active.revision = saved.revision
        if (version === generation) dirty = false
        saveStatus(dirty ? 'Unsaved changes…' : 'Saved locally', dirty ? 'pending' : 'saved')
        renderMetadata()
      }
      clearError(); renderNavigation()
      return true
    } catch (error) {
      saveStatus('Not saved — export a copy', 'error'); showError(error)
      return false
    }
  })()
  try { return await saving } finally { saving = null }
}
async function flush() {
  clearTimeout(saveTimer)
  while (dirty && active) if (!await saveOnce()) return false
  if (saving) return await saving
  return true
}
async function operation(task) {
  if (busy) return
  busy = true
  $('create').disabled = true; $('delete').disabled = true
  try { await task() } catch (error) { showError(error) }
  finally { busy = false; $('create').disabled = !store; $('delete').disabled = false }
}
function closeMobileNav() {
  $('sidebar').classList.remove('is-open')
  $('toggle-nav').setAttribute('aria-expanded', 'false')
}
async function openDocument(id) {
  if (active?.id === id) return
  if (!await flush()) return
  const all = await store.list()
  documents = all
  const selected = all.find(doc => doc.id === id)
  if (!selected) { notice('That document no longer exists in local storage.'); renderNavigation(); return }
  setActive(selected); closeMobileNav()
}
async function createDocument() {
  if (!await flush()) return
  documents = await store.list()
  if (documents.length >= MAX_DOCUMENTS) throw new Error('This workspace supports up to 500 documents. Back up and remove unused documents first.')
  const template = templates.find(t => t.id === $('template').value) || templates[0]
  const title = uniqueTitle(template.title)
  const saved = await store.save(makeDocument(title, template.content))
  documents.push(saved); setActive(saved); closeMobileNav()
  $('doc-title').focus(); $('doc-title').select()
  notice('Created locally. Rename the title above; changes save automatically.')
}
function uniqueTitle(base) {
  const titles = new Set(documents.map(d => d.title))
  let title = base, n = 2
  while (titles.has(title)) title = `${base.slice(0, 180)} (${n++})`
  return title
}
function confirmAction(title, message, label) {
  return new Promise(resolve => {
    const dialog = $('confirm-dialog')
    $('dialog-title').textContent = title
    $('dialog-message').textContent = message
    $('dialog-confirm').textContent = label
    dialog.returnValue = 'cancel'
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true })
    dialog.showModal()
  })
}
async function deleteDocument() {
  if (!active || !await flush()) return
  if (!await confirmAction('Delete this document?', `“${displayTitle(active)}” will be permanently removed from this browser. Export it first if you need a backup.`, 'Delete document')) return
  await store.remove(active)
  documents = await store.list(); setActive(documents[0] || null)
  clearError(); notice('Document deleted from local storage.')
}
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = node('a'); anchor.href = url; anchor.download = name
  document.body.append(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function exportMarkdown() {
  if (!active) return
  download(active.content, fileName(displayTitle(active), '.md'), 'text/markdown;charset=utf-8')
  notice('Markdown download started. It includes the current editor content, even if local saving failed.')
}
async function importDocument(file) {
  if (!file) return
  if (!/\.(md|txt)$/i.test(file.name)) throw new Error('Choose a .md or .txt file.')
  if (file.size > MAX_FILE_BYTES) throw new Error('Import is limited to 2 MB per file.')
  const content = await file.text()
  if (content.length > MAX_CONTENT) throw new Error('Imported text exceeds 1,000,000 characters.')
  if (content.includes('\0')) throw new Error('This file does not appear to be plain text.')
  if (!await flush()) return
  documents = await store.list()
  if (documents.length >= MAX_DOCUMENTS) throw new Error('Document limit reached. Back up and remove unused documents first.')
  const saved = await store.save(makeDocument(uniqueTitle(file.name.replace(/\.(md|txt)$/i, '').slice(0, 180) || 'Imported document'), content))
  documents.push(saved); setActive(saved); closeMobileNav(); notice('File imported as a new local document. Existing documents were not changed.')
}
async function backup() {
  if (!store) throw new Error('Local storage is unavailable. You can still export the current document if one is open.')
  await flush()
  const all = await store.list()
  const snapshot = [...all]
  if (dirty && active) {
    if (all.length >= MAX_DOCUMENTS) throw new Error('Export the unsaved draft as Markdown first. A backup cannot add a recovery copy beyond the 500-document limit.')
    snapshot.push(makeDocument(displayTitle(active).slice(0, 175) + ' (unsaved draft)', active.content, active.collection))
  }
  download(backupJSON(snapshot), 'silov0-backup-' + new Date().toISOString().slice(0, 10) + '.json', 'application/json')
  notice(dirty ? 'Backup downloaded with the current unsaved draft. Local saving still needs attention.' : 'Backup downloaded. Keep it somewhere safe; it contains the full text of your documents.')
}
async function restore(file) {
  if (!file) return
  if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup exceeds 10 MB.')
  const incoming = parseBackup(await file.text())
  if (!incoming.length) throw new Error('This backup contains no documents.')
  if (!await flush()) return
  documents = await store.list()
  if (documents.length + incoming.length > MAX_DOCUMENTS) throw new Error('Restore would exceed the 500-document limit. Nothing was changed.')
  if (!await confirmAction('Restore backup as copies?', `Add ${incoming.length} documents? Existing documents will never be overwritten. Conflicting titles receive a “restored” suffix.`, 'Restore copies')) return
  const copies = await store.addCopies(restoredCopies(incoming, documents))
  documents = await store.list(); setActive(copies[0]); closeMobileNav()
  notice(`Restored ${copies.length} documents as new copies. Existing documents are unchanged.`)
}
function cursorPosition() {
  $('cursor').textContent = 'Line ' + $('editor').value.slice(0, $('editor').selectionStart).split('\n').length
}
function setView(view) {
  if (!['editor', 'preview', 'split'].includes(view)) view = 'split'
  $('workspace').dataset.view = view
  for (const button of document.querySelectorAll('button[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === view))
  preferences.set('view', view)
}
function format(kind) {
  if (!active) return
  if ($('workspace').dataset.view === 'preview') setView('split')
  const editor = $('editor'), start = editor.selectionStart, end = editor.selectionEnd
  const selected = editor.value.slice(start, end)
  const patterns = {
    bold: ['**', '**', 'bold text'], italic: ['_', '_', 'emphasis'], link: ['[', '](https://example.invalid)', 'link text'],
    heading: ['\n## ', '\n', 'Section title'], list: ['\n- ', '\n', 'List item'],
    code: ['\n```text\n', '\n```\n', 'Code example'], table: ['\n', '\n', '| Column | Description |\n| --- | --- |\n| Value | Explanation |'],
  }
  const [before, after, fallback] = patterns[kind]
  const insertion = before + (selected || fallback) + after
  if (editor.value.length - (end - start) + insertion.length > MAX_CONTENT) { showError(new Error('Document character limit reached.')); return }
  editor.focus()
  // insertText integrates with the native textarea undo history when supported.
  const inserted = document.execCommand('insertText', false, insertion)
  if (!inserted) editor.setRangeText(insertion, start, end, 'end')
  editor.setSelectionRange(start + before.length, start + before.length + (selected || fallback).length)
  edit(); renderContent()
}
async function init() {
  try {
    store = await openStore(); documents = await store.list()
    $('template').disabled = false; $('create').disabled = false
    const last = preferences.get('active')
    setActive(documents.find(d => d.id === last) || documents[0] || null)
    clearError()
  } catch (error) {
    store = null; $('document-list').replaceChildren(node('p', 'Local storage is unavailable. Check the error above, then retry.'))
    showError(error)
  }
}

for (const template of templates) $('template').append(new Option(template.name, template.id))
$('create').addEventListener('click', () => operation(createDocument))
$('delete').addEventListener('click', () => operation(deleteDocument))
for (const id of ['doc-title', 'doc-collection', 'editor']) $(id).addEventListener('input', edit)
$('editor').addEventListener('click', cursorPosition)
$('editor').addEventListener('keyup', cursorPosition)
$('search-docs').addEventListener('input', renderNavigation)
$('collection-filter').addEventListener('change', renderNavigation)
for (const button of document.querySelectorAll('button[data-view]')) button.addEventListener('click', () => setView(button.dataset.view))
for (const button of document.querySelectorAll('[data-format]')) button.addEventListener('click', () => format(button.dataset.format))
$('export-md').addEventListener('click', exportMarkdown)
$('recover-md').addEventListener('click', exportMarkdown)
$('export-html').addEventListener('click', () => { if (active) { download(exportHTML(active), fileName(displayTitle(active), '.html'), 'text/html'); notice('Sanitized HTML download started. Remote images are omitted.') } })
$('copy').addEventListener('click', async () => {
  if (!active) return
  try { await navigator.clipboard.writeText(active.content); notice('Markdown copied to clipboard.') }
  catch { showError(new Error('Clipboard access was denied. Use Export .md instead; your document is unchanged.')) }
})
$('import').addEventListener('click', () => { if (!store) { showError(new Error('Open local storage before importing.')); return } $('import-file').click() })
$('restore').addEventListener('click', () => { if (!store) { showError(new Error('Open local storage before restoring.')); return } $('restore-file').click() })
$('import-file').addEventListener('change', event => { const file = event.target.files[0]; event.target.value = ''; operation(() => importDocument(file)) })
$('restore-file').addEventListener('change', event => { const file = event.target.files[0]; event.target.value = ''; operation(() => restore(file)) })
$('backup').addEventListener('click', () => operation(backup))
$('retry').addEventListener('click', () => operation(async () => {
  if (!store) return init()
  if (await flush()) clearError()
}))
$('save-copy').addEventListener('click', () => operation(async () => {
  if (!active || !store) return
  // Do not flush a conflicted original. Persist the complete in-memory draft under a new ID.
  const draft = { ...active }
  documents = await store.list()
  const copy = await store.save(makeDocument(uniqueTitle((draft.title || 'Untitled document').slice(0, 175) + ' (copy)'), draft.content, draft.collection))
  documents.push(copy); setActive(copy); clearError(); notice('Saved a new copy. The other version was not overwritten.')
}))
$('toggle-nav').addEventListener('click', () => {
  const open = $('sidebar').classList.toggle('is-open')
  $('toggle-nav').setAttribute('aria-expanded', String(open))
})
function setTheme(theme) {
  theme = theme === 'light' ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme
  $('theme').textContent = theme === 'dark' ? 'Light theme' : 'Dark theme'
  $('theme').setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`)
  preferences.set('theme', theme)
}
$('theme').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'))
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); flush(); return }
  if (event.target !== $('editor')) return
  if ((event.ctrlKey || event.metaKey) && ['b', 'i', 'k'].includes(event.key.toLowerCase())) {
    event.preventDefault(); format({ b: 'bold', i: 'italic', k: 'link' }[event.key.toLowerCase()])
  }
  if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    event.preventDefault()
    const editor = $('editor')
    if (editor.value.length < MAX_CONTENT - 2) {
      if (!document.execCommand('insertText', false, '  ')) editor.setRangeText('  ', editor.selectionStart, editor.selectionEnd, 'end')
      edit()
    }
  }
})
$('preview').addEventListener('click', event => {
  const link = event.target.closest('a')
  const href = link?.getAttribute('href')
  if (href?.startsWith('#')) {
    event.preventDefault()
    try { document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ block: 'nearest' }) } catch { /* A malformed anchor is reported by review. */ }
  }
})
window.addEventListener('beforeunload', event => { if (dirty || saving) { event.preventDefault(); event.returnValue = '' } })
document.addEventListener('visibilitychange', () => { if (document.hidden && dirty) flush() })
setTheme(preferences.get('theme', window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'))
setView(preferences.get('view', 'split'))
init()
