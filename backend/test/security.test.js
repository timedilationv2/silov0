import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { normalizePost, savePosts, buildTagIndex, LIMITS } from '../src/postsStore.js'
import { createContentService } from '../src/service.js'

const post = { id: 'one', title: 'Hello', date: '2024-01-01' }
const token = 'test-token-abcdefghijklmnopqrstuvwxyz'

test('validation rejects unsafe URLs, types and excessive fields', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', 'java\nscript:alert(1)', 'https://', 'https://u:p@example.com']) {
    assert.throws(() => normalizePost({ ...post, url }), /url/)
  }
  for (const url of ['https://example.com/a', 'http://example.com', '/relative', '../note', '']) {
    assert.equal(normalizePost({ ...post, url }).url, url)
  }
  for (const field of ['title', 'summary', 'id', 'url']) {
    assert.throws(() => normalizePost({ ...post, [field]: 'x'.repeat(LIMITS[field] + 1) }))
    for (const value of [null, 1, true, [], {}]) assert.throws(() => normalizePost({ ...post, [field]: value }))
  }
  assert.throws(() => normalizePost({ ...post, tags: Array(21).fill('a') }))
  assert.throws(() => normalizePost({ ...post, tags: ['a'.repeat(65)] }))
  const index = buildTagIndex([{ tags: ['__proto__', 'constructor'] }])
  assert.equal(index.__proto__, 1)
  assert.equal(index.constructor, 1)
  assert.equal({}.polluted, undefined)
})

test('concurrent services preserve every create and enforce duplicate IDs', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'silo-concurrent-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const storagePath = path.join(dir, 'posts.json')
  await savePosts([], storagePath)
  const services = Array.from({ length: 3 }, () => createContentService({ storagePath }))
  await Promise.all(Array.from({ length: 25 }, (_, i) => services[i % 3].add({ ...post, id: String(i) })))
  assert.equal(JSON.parse(await fs.readFile(storagePath)).length, 25)
  const results = await Promise.allSettled(services.map(s => s.add(post)))
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(JSON.parse(await fs.readFile(storagePath)).length, 26)
})

test('failed writes preserve file, cache and remove temporary files; later writes recover', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'silo-failure-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const storagePath = path.join(dir, 'posts.json')
  await savePosts([post], storagePath)
  const before = await fs.readFile(storagePath, 'utf8')
  const service = createContentService({ storagePath })
  await service.all()
  const rename = fs.rename
  fs.rename = async () => { throw new Error('sensitive internal path') }
  try { await assert.rejects(service.add({ ...post, id: 'two' })) }
  finally { fs.rename = rename }
  assert.equal(await fs.readFile(storagePath, 'utf8'), before)
  assert.equal((await service.all()).length, 1)
  assert.deepEqual(await fs.readdir(dir), ['posts.json'])
  await service.add({ ...post, id: 'two' })
  assert.equal((await service.all()).length, 2)
})

test('cards/table use text nodes for attacker content and export omits unsafe source URLs', async () => {
  class Node {
    children = []; style = {}; className = ''; textContent = ''
    append(...nodes) { this.children.push(...nodes) }
    replaceChildren() { this.children = [] }
    set innerHTML(value) { throw new Error('HTML parsing is forbidden') }
  }
  const grid = new Node(), rows = new Node()
  const context = vm.createContext({ document: {
    getElementById: id => ({ 'posts-grid': grid, 'post-rows': rows }[id] || null),
    createElement: () => new Node(),
  }, URL, Intl, console })
  let source = await fs.readFile(new URL('../../scripts/app.js', import.meta.url), 'utf8')
  source = source.replace(/init\(\)\s*$/, '')
  vm.runInContext(source, context)
  for (const payload of ['<img src=x onerror="globalThis.pwned=1">', '<script>globalThis.pwned=1</script>', '<svg onload=alert(1)>', '"><a href=javascript:alert(1)>click</a>']) {
    context.posts = [{ ...post, title: payload, summary: payload, tags: [payload], url: 'javascript:alert(1)' }]
    vm.runInContext('renderCards(posts); renderTable(posts)', context)
    assert.equal(grid.children[0].children[0].textContent, payload)
    assert.equal(rows.children[0].children[0].children[0].textContent, payload)
    assert.equal(grid.children[0].children[2].textContent, payload)
    assert.equal(grid.children[0].children[3].children[0].textContent, payload)
    assert.equal(context.pwned, undefined)
    assert.doesNotMatch(vm.runInContext('buildMarkdownDigest(posts)', context), /\[Source\]|<script>|<img/)
  }
})

test('HTTP security: authentication, CORS, headers, limits and concurrent creates', async t => {
  const { createApp } = await import('../src/app.js')
  assert.throws(() => createApp({ apiToken: '' }), /API_TOKEN/)
  assert.throws(() => createApp({ apiToken: 'short' }), /API_TOKEN/)
  assert.throws(() => createApp({ apiToken: token, allowedOrigins: ['*'] }), /CORS/)
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'silo-security-http-'))
  const storagePath = path.join(dir, 'posts.json')
  await savePosts([], storagePath)
  const app = createApp({ service: createContentService({ storagePath }), apiToken: token, allowedOrigins: ['http://localhost:8000'], writeRateLimit: 50 })
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(dir, { recursive: true, force: true }) })
  const base = `http://127.0.0.1:${server.address().port}`
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    assert.equal((await fetch(base + '/api/posts', { method })).status, 401)
  }
  const malformed = await fetch(base + '/api/posts', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{"secret":"sensitive-value"' })
  assert.equal(malformed.status, 400)
  assert.deepEqual(await malformed.json(), { error: 'Invalid request body' })
  const send = (authorization, body = post) => fetch(base + '/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) }, body: JSON.stringify(body) })
  for (const auth of [undefined, 'Bearer wrong', 'Basic abc', `Bearer ${token} extra`, `Bearer ${token.toUpperCase()}`]) assert.equal((await send(auth)).status, 401)
  assert.equal((await send(`Bearer ${token}`)).status, 201)
  assert.equal((await send(`Bearer ${token}`)).status, 409)
  const malicious = { ...post, id: 'html', title: '<script>alert(1)</script>', summary: '<img src=x onerror=alert(1)>', tags: ['<svg onload=alert(1)>'] }
  const htmlResponse = await send(`Bearer ${token}`, malicious)
  assert.equal(htmlResponse.status, 201)
  assert.equal((await htmlResponse.json()).find(p => p.id === 'html').title, malicious.title)
  assert.equal((await send(`Bearer ${token}`, { ...post, url: 'javascript:alert(1)' })).status, 400)
  assert.equal((await send(`Bearer ${token}`, { ...post, summary: 'x'.repeat(40000) })).status, 413)
  const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => send(`Bearer ${token}`, { ...post, id: String(i) })))
  assert.ok(responses.every(r => r.status === 201))
  assert.equal(JSON.parse(await fs.readFile(storagePath)).length, 12)
  for (const origin of ['http://localhost:8000', 'https://evil.example', 'http://localhost:8000.evil.example', 'null']) {
    const res = await fetch(base + '/api/posts', { headers: { Origin: origin } })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('access-control-allow-origin'), origin === 'http://localhost:8000' ? origin : null)
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.ok(res.headers.get('content-security-policy'))
    assert.equal(res.headers.get('x-powered-by'), null)
  }
  const preflight = await fetch(base + '/api/posts', { method: 'OPTIONS', headers: { Origin: 'http://localhost:8000', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } })
  assert.equal(preflight.status, 204)
  assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/)
  assert.equal((await fetch(base + '/health')).status, 200)
})

test('write rate limiting counts unauthorized attempts; read limit is independent', async t => {
  const { createApp } = await import('../src/app.js')
  const server = createApp({ apiToken: token, apiRateLimit: 4, writeRateLimit: 1 }).listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`
  assert.equal((await fetch(base + '/api/posts', { method: 'POST' })).status, 401)
  const limited = await fetch(base + '/api/posts', { method: 'POST', headers: { 'X-Forwarded-For': '203.0.113.1' } })
  assert.equal(limited.status, 429)
  assert.ok(limited.headers.get('retry-after'))
  await fetch(base + '/api/unknown')
  await fetch(base + '/api/unknown')
  assert.equal((await fetch(base + '/api/posts')).status, 429)
  assert.equal((await fetch(base + '/health')).status, 200)
})


test('separate writer processes preserve concurrent creates', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'silo-process-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const storagePath = path.join(dir, 'posts.json')
  await savePosts([], storagePath)
  const serviceUrl = new URL('../src/service.js', import.meta.url).href
  await Promise.all(Array.from({ length: 3 }, (_, i) => promisify(execFile)(process.execPath,
    ['--input-type=module', '-e', `import { createContentService } from ${JSON.stringify(serviceUrl)};
      const service = createContentService({storagePath: process.argv[1]});
      await Promise.all(Array.from({length: 5}, (_, j) => service.add({id: process.argv[2] + '-' + j, title: 'Child', date: '2024-01-01'})));`, storagePath, String(i)])))
  assert.equal(JSON.parse(await fs.readFile(storagePath)).length, 15)
})

test('write failure before rename leaves existing file unchanged', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'silo-partial-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const target = path.join(dir, 'posts.json')
  await savePosts([post], target)
  const before = await fs.readFile(target, 'utf8')
  const open = fs.open
  fs.open = async (...args) => {
    const handle = await open(...args)
    handle.writeFile = async () => { throw new Error('disk full') }
    return handle
  }
  try { await assert.rejects(savePosts([{ ...post, id: 'two' }], target), /disk full/) }
  finally { fs.open = open }
  assert.equal(await fs.readFile(target, 'utf8'), before)
  assert.deepEqual(await fs.readdir(dir), ['posts.json'])
})


test('server fails before listening without configured token', async () => {
  const server = new URL('../src/server.js', import.meta.url)
  await assert.rejects(promisify(execFile)(process.execPath, [server.pathname], {
    env: { ...process.env, API_TOKEN: '' }, timeout: 5000,
  }), error => error.code === 1 && /API_TOKEN/.test(error.stderr))
})
