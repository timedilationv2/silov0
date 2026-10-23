"""Self-hosted browser acceptance/regression suite. No external service required.
Run: PLAYWRIGHT_BROWSERS_PATH=... python3 tests/workspace_browser.py
"""
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def do_GET(self):
        if self.path.startswith('/silov0/'):
            self.path = self.path[len('/silov0'):]
        super().do_GET()
    def log_message(self, *args): pass

class WorkspaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f'http://127.0.0.1:{cls.server.server_address[1]}/silov0/'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch()
    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.playwright.stop(); cls.server.shutdown(); cls.server.server_close()
    def setUp(self):
        self.context = self.browser.new_context(accept_downloads=True)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.goto(self.base)
        expect(self.page.locator('#create')).to_be_enabled()
    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.context.close()
    def create(self, template='blank'):
        self.page.select_option('#template', template)
        self.page.click('#create')
        expect(self.page.locator('#create')).to_be_enabled()
        expect(self.page.locator('#document-area')).to_be_visible()
        expect(self.page.locator('#save-status')).to_have_text('Saved locally')
    def saved(self): expect(self.page.locator('#save-status')).to_have_text('Saved locally', timeout=10000)
    def download(self, selector):
        with self.page.expect_download() as info: self.page.click(selector)
        return info.value, Path(info.value.path()).read_text()

    def test_sop_acceptance_refresh_reopen_export(self):
        self.create('sop')
        self.page.fill('#doc-title', 'Incident response SOP')
        content = '# Incident response\n\n## Verify\n\n1. Check the queue.\n2. Record the outcome.\n'
        self.page.fill('#editor', content)
        expect(self.page.locator('#preview h1')).to_have_text('Incident response')
        self.saved()
        self.page.reload(); expect(self.page.locator('#editor')).to_have_value(content)
        expect(self.page.locator('#doc-title')).to_have_value('Incident response SOP')
        file, exported = self.download('#export-md')
        self.assertEqual(file.suggested_filename, 'Incident response SOP.md')
        self.assertEqual(exported, content)
        self.create('api')
        self.page.get_by_role('button', name='Incident response SOP', exact=False).click()
        expect(self.page.locator('#editor')).to_have_value(content)

    def test_create_rename_switch_search_collection_delete_confirmation(self):
        self.create(); self.page.fill('#doc-title','Alpha'); self.page.fill('#doc-collection','Operations')
        self.page.fill('#editor','# Alpha\n\nFirst draft')
        # Switch immediately; the application must flush pending edits.
        self.create('user-guide'); self.page.fill('#doc-title','Beta'); self.saved()
        self.page.fill('#search-docs','Alpha'); expect(self.page.locator('.document-item')).to_have_count(1)
        self.page.locator('.document-item').click(); expect(self.page.locator('#editor')).to_have_value('# Alpha\n\nFirst draft')
        self.page.fill('#search-docs',''); self.page.select_option('#collection-filter','Operations')
        expect(self.page.locator('.document-item')).to_have_count(1)
        self.page.click('#delete'); expect(self.page.locator('#confirm-dialog')).to_be_visible()
        self.page.get_by_role('button',name='Cancel',exact=True).click()
        expect(self.page.locator('#doc-title')).to_have_value('Alpha')
        self.page.click('#delete'); self.page.click('#dialog-confirm')
        expect(self.page.locator('#doc-title')).to_have_value('Beta')
        self.page.select_option('#collection-filter',''); expect(self.page.locator('.document-item')).to_have_count(1)

    def test_markdown_rendering_view_modes_keyboard_and_copy(self):
        self.create()
        content = '# Guide\n\n## Install\n\n**Bold** and _italic_ with [section](#install).\n\n- One\n- Two\n\n```js\nconst x = 1\n```\n\n| Key | Value |\n| --- | --- |\n| a | b |'
        self.page.fill('#editor',content)
        expect(self.page.locator('#preview strong')).to_have_text('Bold')
        expect(self.page.locator('#preview em')).to_have_text('italic')
        expect(self.page.locator('#preview li')).to_have_count(2)
        expect(self.page.locator('#preview table')).to_have_count(1)
        expect(self.page.locator('#preview pre code')).to_contain_text('const x = 1')
        self.page.click('[data-view="preview"]'); expect(self.page.locator('#editor')).to_be_hidden()
        self.page.click('[data-view="editor"]'); expect(self.page.locator('#preview')).to_be_hidden()
        self.page.fill('#editor','word'); self.page.locator('#editor').select_text()
        self.page.keyboard.press('Control+b'); expect(self.page.locator('#editor')).to_have_value('**word**')
        self.page.keyboard.press('Control+s'); self.saved()
        self.page.evaluate("Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.copied=text},configurable:true})")
        self.page.click('#copy'); expect(self.page.locator('#notice')).to_have_text('Markdown copied to clipboard.')
        self.assertEqual(self.page.evaluate('window.copied'),'**word**')
        self.page.evaluate("Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied')}},configurable:true})")
        self.page.click('#copy'); expect(self.page.locator('#error')).to_contain_text('Clipboard access was denied')

    def test_import_html_export_backup_restore_no_overwrite(self):
        content='# Imported\n\nA **real** document.'
        self.page.locator('#import-file').set_input_files({'name':'Notes.md','mimeType':'text/markdown','buffer':content.encode()})
        expect(self.page.locator('#doc-title')).to_have_value('Notes')
        expect(self.page.locator('#preview strong')).to_have_text('real')
        _, html = self.download('#export-html')
        self.assertIn('<strong>real</strong>',html); self.assertIn('Content-Security-Policy',html)
        _, backup = self.download('#backup')
        self.assertEqual(json.loads(backup)['documents'][0]['content'],content)
        payload={'name':'backup.json','mimeType':'application/json','buffer':backup.encode()}
        self.page.locator('#restore-file').set_input_files(payload)
        expect(self.page.locator('#confirm-dialog')).to_be_visible()
        self.page.get_by_role('button',name='Cancel',exact=True).click()
        expect(self.page.locator('.document-item')).to_have_count(1)
        self.page.locator('#restore-file').set_input_files(payload); self.page.click('#dialog-confirm')
        expect(self.page.locator('.document-item')).to_have_count(2)
        expect(self.page.locator('#doc-title')).to_have_value('Notes (restored)')
        self.page.locator('#import-file').set_input_files({'name':'Plain.txt','mimeType':'text/plain','buffer':b'# Plain text'})
        expect(self.page.locator('#doc-title')).to_have_value('Plain')
        expect(self.page.locator('.document-item')).to_have_count(3)

    def test_invalid_import_restore_keeps_documents(self):
        self.create(); self.page.fill('#editor','Do not lose this'); self.saved()
        for data in [b'{',b'{"format":"silov0-workspace","version":2,"documents":[]}']:
            self.page.locator('#restore-file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':data})
            expect(self.page.locator('#error')).to_be_visible()
            expect(self.page.locator('.document-item')).to_have_count(1)
            expect(self.page.locator('#editor')).to_have_value('Do not lose this')
        self.page.locator('#import-file').set_input_files({'name':'image.exe','mimeType':'application/octet-stream','buffer':b'bad'})
        expect(self.page.locator('#error')).to_contain_text('Choose a .md or .txt')
        self.page.locator('#import-file').set_input_files({'name':'big.md','mimeType':'text/plain','buffer':b'x'*2_000_001})
        expect(self.page.locator('#error')).to_contain_text('2 MB')

    def test_xss_and_no_content_network_requests(self):
        self.create()
        requests=[]; self.page.on('request',lambda r:requests.append(r.url))
        payload='# Safe\n\n<script>window.pwned=1</script><img src="https://evil.invalid/secret" onerror="window.pwned=1">\n\n[click](javascript:alert(1))\n\n![track](https://evil.invalid/track)\n\n<svg onload=alert(1)><foreignObject>bad</foreignObject></svg>\n\n[encoded](jav&#x61;script:alert(1))'
        self.page.fill('#doc-title','<img onerror=alert(1)>')
        self.page.locator('#import-file').set_input_files({'name':'hostile.md','mimeType':'text/markdown','buffer':payload.encode()})
        self.page.fill('#doc-title','<img onerror=alert(1)>')
        expect(self.page.locator('#preview h1')).to_have_text('Safe')
        self.saved()
        self.assertEqual(self.page.locator('#preview script,#preview img,#preview svg,#preview iframe').count(),0)
        self.assertFalse(self.page.evaluate('Boolean(window.pwned)'))
        self.assertEqual(self.page.locator('#preview a[href^="javascript:"]').count(),0)
        _, html=self.download('#export-html')
        exported=self.context.new_page(); exported.set_content(html)
        self.assertEqual(exported.locator('script,img,svg,iframe').count(),0)
        self.assertEqual(requests,[],'Editing must not send requests or load tracking images')
        exported.close()

    def test_quality_findings_jump_to_editor(self):
        self.create(); self.page.fill('#doc-title','')
        self.page.fill('#editor','#\n\n### Jump\n\n## Same\n\n## Same\n\n[broken](#missing)\n\n```\n\n```\n\n![](https://example.invalid/x)\n\nTODO write this')
        expect(self.page.locator('#findings')).to_contain_text('Missing document title')
        for text in ['Empty heading','Duplicate heading','Heading level skips','Empty code block','Image has no alt text','Unresolved heading link','Unresolved placeholder']:
            expect(self.page.locator('#findings')).to_contain_text(text)
        self.page.locator('.finding').filter(has_text='Missing document title').click()
        expect(self.page.locator('#doc-title')).to_be_focused()
        self.page.click('[data-view="preview"]')
        self.page.locator('.finding').filter(has_text='Unresolved heading link').click()
        expect(self.page.locator('#editor')).to_be_focused()
        expect(self.page.locator('#editor')).to_be_visible()

    def test_conflicting_tabs_preserve_both_drafts(self):
        self.create(); self.page.fill('#doc-title','Shared'); self.page.fill('#editor','# Original'); self.saved()
        other=self.context.new_page(); other.goto(self.base)
        expect(other.locator('#editor')).to_have_value('# Original')
        self.page.fill('#editor','# First tab'); self.saved()
        other.fill('#editor','# Second tab')
        expect(other.locator('#error')).to_contain_text('changed in another tab')
        expect(other.locator('#editor')).to_have_value('# Second tab')
        other.click('#save-copy')
        expect(other.locator('#save-status')).to_have_text('Saved locally')
        expect(other.locator('.document-item')).to_have_count(2)
        self.page.reload(); expect(self.page.locator('#editor')).to_have_value('# Second tab')
        docs=self.page.evaluate("async()=>{const {openStore}=await import('./scripts/workspace/storage.mjs');const s=await openStore();const d=await s.list();s.close();return d}")
        self.assertEqual({d['content'] for d in docs},{'# First tab','# Second tab'})
        other.close()

    def test_storage_write_failure_retains_editor_and_recovery_export(self):
        self.create(); self.page.fill('#editor','# Saved'); self.saved()
        self.page.evaluate("()=>{window.originalTransaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(name,mode,...args){if(mode==='readwrite')throw new DOMException('quota','QuotaExceededError');return window.originalTransaction.call(this,name,mode,...args)}}")
        self.page.fill('#editor','# Unsaved recovery draft')
        expect(self.page.locator('#save-status')).to_have_text('Not saved — export a copy')
        _, content=self.download('#recover-md'); self.assertEqual(content,'# Unsaved recovery draft')
        _, backup=self.download('#backup')
        self.assertEqual({d['content'] for d in json.loads(backup)['documents']},{'# Saved','# Unsaved recovery draft'})
        self.page.click('#create'); expect(self.page.locator('#editor')).to_have_value('# Unsaved recovery draft')
        self.page.evaluate('()=>{IDBDatabase.prototype.transaction=window.originalTransaction}')
        self.page.click('#retry'); self.saved(); self.page.reload()
        expect(self.page.locator('#editor')).to_have_value('# Unsaved recovery draft')

    def test_initial_storage_failure_is_explicit(self):
        context=self.browser.new_context()
        context.add_init_script("indexedDB.open=()=>{throw new Error('Storage unavailable')}")
        page=context.new_page();page.goto(self.base)
        expect(page.locator('#error')).to_be_visible()
        expect(page.locator('#create')).to_be_disabled()
        expect(page.locator('#document-list')).to_contain_text('unavailable')
        context.close()

    def test_mobile_keyboard_theme_and_all_templates(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.click('#toggle-nav');expect(self.page.locator('#sidebar')).to_be_visible()
        self.create('release-notes');expect(self.page.locator('#sidebar')).to_be_hidden()
        self.page.click('#theme'); theme=self.page.locator('html').get_attribute('data-theme')
        self.page.reload();expect(self.page.locator('html')).to_have_attribute('data-theme',theme)
        for view in ['editor','preview','split']:self.page.click(f'button[data-view="{view}"]')
        for width in [320,390,640,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':844})
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width)
        self.page.locator('#editor').focus();self.page.keyboard.press('Control+End');self.page.keyboard.press('Tab')
        self.assertTrue(self.page.locator('#editor').input_value().endswith('  '))
        # Shift+Tab must permit keyboard users to leave the editor.
        self.page.keyboard.press('Shift+Tab');self.assertNotEqual(self.page.evaluate('document.activeElement.id'),'editor')


    def test_all_templates_create_real_documents(self):
        for template, title in [('sop','Standard Operating Procedure'),('api','API Reference'),('troubleshooting','Troubleshooting Guide'),('user-guide','User Guide'),('release-notes','Release Notes')]:
            self.create(template)
            expect(self.page.locator('#preview h1')).to_have_text(title)
        expect(self.page.locator('.document-item')).to_have_count(5)

    def test_restore_transaction_failure_is_atomic(self):
        self.create();self.page.fill('#editor','# Keep original');self.saved()
        _, backup=self.download('#backup')
        data=json.loads(backup)
        second=dict(data['documents'][0]);second['id']='second-id';second['title']='Second'
        data['documents'].append(second)
        self.page.evaluate("()=>{window.originalAdd=IDBObjectStore.prototype.add;let count=0;IDBObjectStore.prototype.add=function(...args){if(++count===2)throw new Error('Simulated disk failure');return window.originalAdd.apply(this,args)}}")
        self.page.locator('#restore-file').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(data).encode()})
        self.page.click('#dialog-confirm');expect(self.page.locator('#error')).to_be_visible()
        self.page.evaluate('()=>{IDBObjectStore.prototype.add=window.originalAdd}')
        self.page.reload();expect(self.page.locator('.document-item')).to_have_count(1)
        expect(self.page.locator('#editor')).to_have_value('# Keep original')

    def test_browser_restart_persistence(self):
        with tempfile.TemporaryDirectory() as profile:
            context=self.playwright.chromium.launch_persistent_context(profile)
            page=context.new_page();page.goto(self.base);expect(page.locator('#create')).to_be_enabled()
            page.select_option('#template','sop');page.click('#create');page.fill('#editor','# Persist across restart')
            expect(page.locator('#save-status')).to_have_text('Saved locally');context.close()
            context=self.playwright.chromium.launch_persistent_context(profile)
            page=context.new_page();page.goto(self.base)
            expect(page.locator('#editor')).to_have_value('# Persist across restart');context.close()

if __name__=='__main__': unittest.main(verbosity=2)
