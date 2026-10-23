import test from 'node:test'
import assert from 'node:assert/strict'
import { makeDocument, validateDocument, backupJSON, parseBackup, restoredCopies, fileName } from '../scripts/workspace/model.mjs'
import { reviewDocument, uniqueSlug } from '../scripts/workspace/quality.mjs'
import { templates } from '../scripts/workspace/templates.mjs'

test('all requested templates are useful editable documents', () => {
  assert.deepEqual(templates.map(t => t.id), ['blank', 'sop', 'api', 'troubleshooting', 'user-guide', 'release-notes'])
  for (const template of templates.slice(1)) {
    assert.match(template.content, /^# /)
    assert.ok(template.content.length > 500)
    assert.ok(reviewDocument(makeDocument(template.title, template.content)).some(f => f.rule === 'placeholder'))
  }
})
test('backups validate and restore fresh non-destructive copies', () => {
  const doc = makeDocument('Guide', '# Guide\nPrivate draft', 'Team')
  const incoming = parseBackup(backupJSON([doc]))
  assert.deepEqual(incoming, [doc])
  const copies = restoredCopies([doc], [doc])
  assert.notEqual(copies[0].id, doc.id)
  assert.equal(copies[0].content, doc.content)
  assert.equal(copies[0].title, 'Guide (restored)')
  assert.equal(doc.title, 'Guide')
  assert.equal(restoredCopies([doc], [doc, copies[0]])[0].title, 'Guide (restored 2)')
})
test('reject malformed backups, unsupported types, oversized data and invalid timestamps', () => {
  const doc = makeDocument()
  for (const text of ['{', '[]', '{}', JSON.stringify({format:'silov0-workspace',version:2,documents:[]})]) assert.throws(() => parseBackup(text))
  const wrap = documents => JSON.stringify({format:'silov0-workspace',version:1,documents})
  assert.throws(() => parseBackup(wrap([doc, doc])), /duplicate/)
  assert.throws(() => parseBackup(wrap([{...doc, content: {}}])))
  assert.throws(() => parseBackup(wrap([{...doc, content: 'x'.repeat(1_000_001)}])))
  assert.throws(() => parseBackup(' '.repeat(10_000_001)), /10 MB/)
  assert.throws(() => backupJSON(Array.from({length:11},()=>makeDocument('Large','x'.repeat(1_000_000)))),/10 MB/)
  for (const createdAt of ['bad', '2024-02-30T00:00:00.000Z', 42]) assert.throws(() => validateDocument({...doc,createdAt}))
  assert.throws(() => validateDocument({...doc, revision:-1}))
  const copied = validateDocument({...doc, __proto__: {admin:true}, unknown:'drop'})
  assert.equal(copied.admin,undefined)
  assert.equal(copied.unknown,undefined)
  assert.equal(fileName('../../secret<script>', '.md'), 'secretscript.md')
})
test('quality findings identify structure and explain errors vs warnings', () => {
  const source = '#\n\n### Jump\n\n## Same\n\n## Same\n\n[bad](#missing)\n\n```js\n\n```\n\n![](https://example.invalid/a.png)\n\nTODO write instructions\n\n'+ 'word '.repeat(125)
  const findings = reviewDocument(makeDocument('', source))
  for (const rule of ['title','empty-heading','hierarchy','duplicate-heading','internal-link','empty-code','image-alt','placeholder','long-paragraph']) assert.ok(findings.some(f=>f.rule===rule),rule)
  assert.ok(findings.every(f=>f.explanation && ['error','warning'].includes(f.severity) && Number.isInteger(f.line)))
  assert.ok(findings.find(f=>f.rule==='long-paragraph').severity==='warning')
})
test('quality ignores code examples and resolves unique heading links', () => {
  const source='# Guide\n\n## Install\n\n## Install\n\n[one](#install) [two](#install-2)\n\n```md\n# Fake\nTODO [bad](#missing)\n```'
  const findings=reviewDocument(makeDocument('Guide',source))
  assert.equal(findings.filter(f=>f.rule==='internal-link').length,0)
  assert.equal(findings.filter(f=>f.rule==='placeholder').length,0)
  const seen=new Set()
  assert.equal(uniqueSlug('A **heading**',seen),'a-heading')
  assert.equal(uniqueSlug('A **heading**',seen),'a-heading-2')
})
