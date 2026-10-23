"""Self-hosted real editor workflows. Synthetic profiles only; no live site writes."""
import base64
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
    def do_GET(self):
        if self.path.startswith('/silov0/'): self.path=self.path[len('/silov0'):]
        super().do_GET()
    def log_message(self,*args): pass

class WorkspaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.root=f'http://127.0.0.1:{cls.server.server_address[1]}/silov0/'
        cls.base=cls.root+'workspace.html'
        cls.p=sync_playwright().start()
        cls.browser=cls.p.chromium.launch(executable_path=os.environ.get('SILOV_CHROMIUM_EXECUTABLE'))
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.p.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.context=self.browser.new_context(accept_downloads=True)
        self.page=self.context.new_page();self.page.set_default_timeout(7000);self.errors=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.goto(self.base);expect(self.page.locator('#new-document')).to_be_enabled()
    def tearDown(self):
        self.assertEqual(self.errors,[]);self.context.close()
    def create(self,format='markdown',template='blank'):
        if not self.page.locator('#new-document').is_visible():self.page.click('#toggle-nav')
        self.page.click('#new-document');self.page.select_option('#new-format',format);self.page.select_option('#template',template);self.page.click('#create')
        expect(self.page.locator('#new-dialog')).to_be_hidden();expect(self.page.locator('#document-area')).to_be_visible()
    def source(self):
        expect(self.page.locator('.cm-editor')).to_be_visible()
        return self.page.evaluate("async()=>{const {EditorView}=await import('./assets/vendor/editors.js');return EditorView.findFromDOM(document.querySelector('.cm-editor')).state.doc.toString()}")
    def set_source(self,text):
        self.page.locator('.cm-content').click();self.page.keyboard.press('Control+a');self.page.keyboard.insert_text(text)
        expect(self.page.locator('.cm-content')).to_contain_text(text.split('\n')[0])
    def saved(self):expect(self.page.locator('#save-status')).to_have_text('Saved locally')
    def documents(self):
        return self.page.evaluate("async()=>{const {openStore}=await import('./scripts/workspace/storage.mjs');const s=await openStore();const d=await s.list();s.close();return d}")
    def download(self,selector='#export-md'):
        if selector in ['#backup']:self.page.locator('#library-menu').evaluate('el=>el.open=true')
        if selector in ['#export-html','#export-original']:self.page.locator('#document-menu').evaluate('el=>el.open=true')
        with self.page.expect_download() as result:self.page.click(selector)
        file=result.value
        return file.suggested_filename,Path(file.path()).read_text()
    def show_findings(self):
        self.page.select_option('#panel','validation')
        if not self.page.locator('#inspector').is_visible():self.page.click('#review-toggle')
    def assert_valid(self,scope):
        expect(self.page.locator('#validation-status')).to_contain_text(scope)
        expect(self.page.locator('#validation-status')).to_contain_text('0 errors')

    def test_visual_selection_table_undo_redo_save_reload_export(self):
        self.create('visual');v=self.page.locator('.tiptap');v.click();self.page.keyboard.insert_text('Alpha beta')
        self.page.keyboard.press('Control+a');self.assertEqual(self.page.evaluate('getSelection().toString()'),'Alpha beta');self.page.click('[data-command="bold"]');expect(v.locator('strong')).to_have_text('Alpha beta');self.page.click('[data-command="underline"]')
        expect(v.locator('strong u, u strong')).to_have_text('Alpha beta')
        self.page.keyboard.press('End');self.page.keyboard.press('Enter');self.page.click('[data-command="table"]')
        expect(v.locator('tr')).to_have_count(3);v.locator('td').first.click();self.page.keyboard.insert_text('Cell note')
        self.page.click('[data-command="row"]');expect(v.locator('tr')).to_have_count(4)
        self.page.click('[data-command="column"]');expect(v.locator('tr').first.locator('th')).to_have_count(4)
        self.page.click('#undo');expect(v.locator('tr').first.locator('th')).to_have_count(3)
        self.page.click('#redo');expect(v.locator('tr').first.locator('th')).to_have_count(4)
        self.page.fill('#doc-title','Visual operating note');self.saved();self.page.reload()
        expect(self.page.locator('.tiptap')).to_contain_text('Cell note');expect(self.page.locator('.tiptap tr')).to_have_count(4)
        filename,html=self.download();self.assertTrue(filename.endswith('.html'));self.assertIn('<table',html);self.assertIn('<u>',html);self.assertIn('Cell note',html)
        self.page.locator('#import-file').set_input_files({'name':'Roundtrip.html','mimeType':'text/html','buffer':html.encode()})
        expect(self.page.locator('#confirm-dialog')).to_be_visible();self.page.click('#dialog-confirm')
        expect(self.page.locator('.tiptap tr')).to_have_count(4);expect(self.page.locator('.tiptap')).to_contain_text('Cell note')
        original_name,original=self.download('#export-original');self.assertTrue(original_name.endswith('.html.txt'));self.assertEqual(original,html)

    def test_visual_lists_find_replace_outline_and_keyboard(self):
        self.create('visual');v=self.page.locator('.tiptap');v.click();self.page.keyboard.insert_text('Alpha guide');self.page.select_option('#block-style','1')
        expect(v.locator('h1')).to_have_text('Alpha guide');expect(self.page.locator('#outline')).to_contain_text('Alpha guide')
        self.page.keyboard.press('End');self.page.keyboard.press('Enter');self.page.keyboard.insert_text('First item');self.page.click('[data-command="bullet"]');self.page.keyboard.press('End');self.page.keyboard.press('Enter');self.page.keyboard.insert_text('Second item');self.page.click('[data-command="indent"]')
        expect(v.locator('ul ul')).to_have_count(1);self.page.click('[data-command="outdent"]');expect(v.locator('ul ul')).to_have_count(0)
        v.click();self.page.keyboard.press('Control+f');expect(self.page.locator('#visual-search')).to_be_visible()
        self.page.fill('#find-text','Alpha');self.page.fill('#replace-text','Harbor');self.page.click('[data-search="replace"]');expect(v.locator('h1')).to_have_text('Harbor guide')
        self.page.click('#close-search');expect(v).to_be_focused();self.page.keyboard.press('Control+s');self.saved()

    def test_markdown_source_preview_shortcuts_continuation_and_exact_roundtrip(self):
        self.create();text='# Guide\n\n**Bold** and _italic_.\n\n| Name | Value |\n| --- | --- |\n| State | Ready |\n\n```xml\n<note/>\n```\n'
        self.set_source(text);expect(self.page.locator('#preview strong')).to_have_text('Bold');expect(self.page.locator('#preview table')).to_have_count(1)
        self.assertEqual(self.source(),text);self.saved();_,exported=self.download();self.assertEqual(exported,text)
        self.page.reload();self.assertEqual(self.source(),text)
        self.page.locator('#import-file').set_input_files({'name':'Roundtrip.md','mimeType':'text/markdown','buffer':exported.encode()})
        expect(self.page.locator('#doc-title')).to_have_value('Roundtrip');self.assertEqual(self.source(),text)
        self.set_source('- First');self.page.keyboard.press('End');self.page.keyboard.press('Enter');self.page.keyboard.insert_text('Second')
        self.assertEqual(self.source(),'- First\n- Second')
        self.page.keyboard.press('Control+a');self.page.keyboard.press('Control+b');self.assertTrue(self.source().startswith('**'))
        self.page.click('#find');expect(self.page.locator('.cm-search')).to_be_visible()
        # CodeMirror owns actual highlighted source, folding, history and search.
        self.assertGreater(self.page.locator('.cm-line span').count(),0)

    def test_xml_schema_malformed_diagnostics_repair_and_native_roundtrip(self):
        self.create('xml','xml-manifest');self.assert_valid('release-manifest.xsd 1.0')
        original=self.source();self.set_source(original.replace('status="approved"','status="unknown"',1));self.show_findings()
        expect(self.page.locator('#findings')).to_contain_text('enumeration');expect(self.page.locator('#findings')).to_contain_text('Line')
        self.set_source('<root>\n  <child>bad</root>');expect(self.page.locator('#validation-status')).to_contain_text('XML well-formedness');expect(self.page.locator('#findings')).to_contain_text('mismatch')
        self.page.locator('.finding').first.click();expect(self.page.locator('.cm-content')).to_be_focused()
        self.set_source(original);self.assert_valid('release-manifest.xsd 1.0');self.saved();filename,exported=self.download();self.assertTrue(filename.endswith('.xml'));self.assertEqual(exported,original)
        self.page.locator('#import-file').set_input_files({'name':'Reopened.xml','mimeType':'application/xml','buffer':exported.encode()});expect(self.page.locator('#doc-title')).to_have_value('Reopened');self.assertEqual(self.source(),original)
        self.page.select_option('#schema','release-manifest');self.assert_valid('release-manifest.xsd 1.0');self.saved();self.page.reload();self.assertEqual(self.source(),original);expect(self.page.locator('#schema')).to_have_value('release-manifest')

    def test_xml_matching_tags_completion_indentation_folding_and_search(self):
        self.create('xml');self.set_source('<root>\n  <section>\n    <p>Text</p>\n  </section>\n</root>')
        self.page.locator('.cm-content').click();self.page.keyboard.press('Control+Home');self.page.keyboard.press('ArrowRight');self.page.keyboard.press('ArrowRight')
        expect(self.page.locator('.matching-tag')).to_have_count(2)
        self.page.locator('[title="Fold line"]').first.click();expect(self.page.locator('.cm-foldPlaceholder')).to_have_count(1)
        self.page.locator('.cm-foldPlaceholder').click();expect(self.page.locator('.cm-foldPlaceholder')).to_have_count(0)
        self.set_source('<root>');self.page.keyboard.press('End');self.page.keyboard.insert_text('<child');self.page.keyboard.type('>');expect(self.page.locator('.cm-content')).to_contain_text('</child>')
        self.page.click('#find');expect(self.page.locator('.cm-search')).to_be_visible()
        self.page.locator('.cm-search input[name=search]').fill('child');self.page.locator('.cm-search input[name=replace]').fill('entry');self.page.locator('.cm-search button[name=replaceAll]').click();self.assertIn('<entry></entry>',self.source())

    def test_dita_each_topic_context_insertion_invalid_structure_and_reopen(self):
        for topic in ['concept','task','reference']:
            with self.subTest(topic=topic):
                self.create('dita','dita-'+topic);self.assert_valid('custom DITA 1.3 subset');original=self.source()
                target={'concept':'conbody','task':'steps','reference':'refbody'}[topic]
                self.page.locator('#outline button').filter(has_text=target).first.click()
                child={'concept':'p','task':'step','reference':'section'}[topic]
                self.page.select_option('#dita-element',child);self.page.click('#insert-element')
                self.assertIn('New text' if child=='p' else 'Describe the next action' if child=='step' else 'New section',self.source());self.assert_valid('custom DITA 1.3 subset')
                valid=self.source();self.set_source(valid.replace('<title>','<cmd>',1).replace('</title>','</cmd>',1));self.show_findings();expect(self.page.locator('#findings')).to_contain_text('requires <title>')
                self.set_source(valid);self.assert_valid('custom DITA 1.3 subset');self.saved();name,exported=self.download();self.assertTrue(name.endswith('.dita'));self.assertEqual(exported,valid)
                self.page.locator('#import-file').set_input_files({'name':topic+'.dita','mimeType':'application/xml','buffer':exported.encode()});expect(self.page.locator('#doc-title')).to_have_value(topic);self.assertEqual(self.source(),valid);self.assert_valid('custom DITA 1.3 subset')
                self.page.reload();self.assertEqual(self.source(),valid)

    def test_every_template_real_content_independent_copy_guidance_not_exported(self):
        for format,ids in [('markdown',['sop','api','troubleshooting','user-guide','release-notes']),('dita',['dita-concept','dita-task','dita-reference']),('xml',['xml-manifest'])]:
            for tid in ids:
                with self.subTest(template=tid):
                    self.create(format,tid)
                    if format in ['dita','xml']:self.assert_valid('custom DITA' if format=='dita' else 'release-manifest.xsd')
                    self.assertGreater(len(self.source()),500);self.page.select_option('#panel','guidance');expect(self.page.locator('#guidance')).to_contain_text('Audience:')
                    source=self.source();self.assertNotIn('This guidance is not part',source);self.set_source(source+'\n');self.saved();self.page.reload();self.assertEqual(self.source(),source+'\n');_,exported=self.download();self.assertEqual(exported,source+'\n')
        count=len(self.documents());self.page.reload();self.assertEqual(len(self.documents()),count)
        self.create('markdown','sop');self.set_source('# My changed copy');self.saved();self.create('markdown','sop');self.assertIn('Rotate a Harbor staging API key',self.source());self.assertNotEqual(self.source(),'# My changed copy')

    def test_nondestructive_version_one_migration_and_original_archive(self):
        context=self.browser.new_context();page=context.new_page();page.goto(self.root)
        legacy={'id':'existing-v1','title':'Existing field notes','content':'# Keep my original\n\n<!-- raw source -->','collection':'Operations','createdAt':'2024-01-02T03:04:05.000Z','updatedAt':'2024-01-03T03:04:05.000Z','revision':7}
        page.evaluate('''async doc=>{const db=await new Promise(resolve=>{const r=indexedDB.open('silov0-workspace',1);r.onupgradeneeded=()=>r.result.createObjectStore('documents',{keyPath:'id'});r.onsuccess=()=>resolve(r.result)});await new Promise(resolve=>{const t=db.transaction('documents','readwrite');t.objectStore('documents').put(doc);t.oncomplete=resolve});db.close();localStorage.setItem('silov0-active',doc.id)}''',legacy)
        page.goto(self.base);expect(page.locator('#doc-title')).to_have_value(legacy['title']);expect(page.locator('#document-format')).to_contain_text('Markdown')
        raw=page.evaluate('''async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('silov0-workspace',2);r.onsuccess=()=>resolve(r.result)});const get=name=>new Promise(resolve=>{const r=db.transaction(name).objectStore(name).get('existing-v1');r.onsuccess=()=>resolve(r.result)});const results=[await get('documents'),await get('legacy-v1')];db.close();return results}''')
        self.assertEqual(raw,[legacy,legacy]);page.get_by_role('navigation',name='Main navigation').get_by_text('Documentation',exact=True).click();page.get_by_role('navigation',name='Main navigation').get_by_text('Workspace',exact=True).click();expect(page.locator('#doc-title')).to_have_value(legacy['title']);context.close()

    def test_all_formats_backup_restore_and_legacy_backup(self):
        for format,tid in [('visual','sop'),('markdown','api'),('xml','xml-manifest'),('dita','dita-task')]:self.create(format,tid)
        self.saved();before=self.documents();_,text=self.download('#backup');payload=json.loads(text);self.assertEqual(payload['version'],2);self.assertEqual({d['format'] for d in payload['documents']},{'visual','markdown','xml','dita'})
        self.page.locator('#restore-file').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':text.encode()});self.page.click('#dialog-confirm');expect(self.page.locator('.document-item')).to_have_count(8)
        after=self.documents();self.assertEqual(sorted((d['format'],d['content']) for d in after),sorted([(d['format'],d['content']) for d in before]*2))
        old=dict(next(d for d in before if d['format']=='markdown'));old.pop('format');old.pop('schemaVersion');old.pop('templateId');old.pop('schemaId',None)
        legacy=json.dumps({'format':'silov0-workspace','version':1,'documents':[old]})
        self.page.locator('#restore-file').set_input_files({'name':'old.json','mimeType':'application/json','buffer':legacy.encode()});self.page.click('#dialog-confirm');expect(self.page.locator('.document-item')).to_have_count(9)
        expect(self.page.locator('#document-format')).to_contain_text('Markdown')

    def test_conflicts_quota_recovery_and_restore_atomicity(self):
        self.create();self.set_source('# Original');self.saved();other=self.context.new_page();other.goto(self.base);expect(other.locator('.cm-content')).to_contain_text('Original')
        self.set_source('# First tab');self.saved();other.locator('.cm-content').click();other.keyboard.press('Control+a');other.keyboard.insert_text('# Second tab');expect(other.locator('#error')).to_contain_text('changed in another tab');other.click('#save-copy');expect(other.locator('#save-status')).to_have_text('Saved locally');other.close()
        self.page.reload();self.assertEqual({d['content'] for d in self.documents()},{'# First tab','# Second tab'})
        self.page.evaluate("()=>{window.originalTransaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(n,m,...a){if(m==='readwrite')throw new DOMException('full','QuotaExceededError');return window.originalTransaction.call(this,n,m,...a)}}")
        self.set_source('# Unsaved recovery');expect(self.page.locator('#save-status')).to_contain_text('Not saved');_,text=self.download('#recover-md');self.assertEqual(text,'# Unsaved recovery');_,backup=self.download('#backup');self.assertIn('# Unsaved recovery',[d['content'] for d in json.loads(backup)['documents']])
        self.page.evaluate('()=>{IDBDatabase.prototype.transaction=window.originalTransaction}');self.page.click('#retry');self.saved()
        self.page.evaluate("()=>{window.originalAdd=IDBObjectStore.prototype.add;let count=0;IDBObjectStore.prototype.add=function(...args){if(++count===2)throw Error('Simulated restore failure');return window.originalAdd.apply(this,args)}}")
        count=len(self.documents());self.page.locator('#restore-file').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':backup.encode()});self.page.click('#dialog-confirm');expect(self.page.locator('#error')).to_be_visible();self.page.reload();self.assertEqual(len(self.documents()),count)

    def test_untrusted_html_markdown_xml_and_images_do_not_make_remote_requests(self):
        requests=[];self.page.on('request',lambda r:requests.append(r.url) if not r.url.startswith(self.root) else None)
        html='<h1>Safe</h1><script>window.pwned=1</script><p onclick="window.pwned=1">Text</p><img src="https://evil.invalid/track"><a href="javascript:alert(1)">Bad</a><svg onload="window.pwned=1"></svg>'
        self.page.locator('#import-file').set_input_files({'name':'Unsafe.html','mimeType':'text/html','buffer':html.encode()});self.page.click('#dialog-confirm');expect(self.page.locator('.tiptap h1')).to_have_text('Safe');self.assertEqual(self.page.locator('.tiptap script,.tiptap svg,.tiptap img').count(),0)
        original_name,original=self.download('#export-original');self.assertTrue(original_name.endswith('.html.txt'));self.assertEqual(original,html)
        _,rendered=self.download();self.assertNotIn('<script',rendered);self.assertNotIn('https://evil.invalid',rendered)
        self.create();self.set_source('# Safe\n\n<img src="https://evil.invalid/x" onerror="window.pwned=1">\n\n![track](https://evil.invalid/track)')
        expect(self.page.locator('#preview h1')).to_have_text('Safe');self.assertEqual(self.page.locator('#preview img,#preview script').count(),0)
        self.create('xml');self.set_source('<!DOCTYPE x [<!ENTITY steal SYSTEM "https://evil.invalid/secret">]>\n<x>&steal;</x>');self.show_findings();expect(self.page.locator('#findings')).to_contain_text('DTD and entity declarations are disabled');self.assertFalse(self.page.evaluate('Boolean(window.pwned)'));self.assertEqual(requests,[])

    def test_image_alt_storage_limits_and_safe_export(self):
        self.create('visual');self.page.locator('.tiptap').click();self.page.keyboard.insert_text('Diagram')
        from PIL import Image
        import io
        buf=io.BytesIO();Image.new('RGB',(8,8),(23,102,79)).save(buf,format='PNG')
        self.page.click('#image');self.page.fill('#image-alt','Green status indicator');self.page.locator('#image-file').set_input_files({'name':'status.png','mimeType':'image/png','buffer':buf.getvalue()});self.page.click('#insert-image')
        expect(self.page.locator('.tiptap img')).to_have_attribute('alt','Green status indicator');self.saved();self.page.reload();expect(self.page.locator('.tiptap img')).to_have_count(1)
        _,html=self.download();self.assertIn('data:image/png;base64,',html);self.assertIn('Green status indicator',html)
        self.page.click('#image');self.page.fill('#image-alt','Too large');self.page.locator('#image-file').set_input_files({'name':'large.png','mimeType':'image/png','buffer':b'x'*200001});self.page.click('#insert-image');expect(self.page.locator('#error')).to_contain_text('200 KB');self.page.click('#cancel-image');expect(self.page.locator('.tiptap img')).to_have_count(1)

    def test_browser_restart_and_mobile_layouts_keyboard_focus(self):
        with tempfile.TemporaryDirectory() as profile:
            c=self.p.chromium.launch_persistent_context(profile,executable_path=os.environ.get('SILOV_CHROMIUM_EXECUTABLE'));page=c.new_page();page.goto(self.base);expect(page.locator('#new-document')).to_be_enabled();page.click('#new-document');page.select_option('#new-format','markdown');page.click('#create');page.locator('.cm-content').click();page.keyboard.insert_text('# Persistent note');expect(page.locator('#save-status')).to_have_text('Saved locally');c.close()
            c=self.p.chromium.launch_persistent_context(profile,executable_path=os.environ.get('SILOV_CHROMIUM_EXECUTABLE'));page=c.new_page();page.goto(self.base);expect(page.locator('.cm-content')).to_contain_text('Persistent note');c.close()
        for format,tid in [('visual','sop'),('markdown','api'),('xml','xml-manifest'),('dita','dita-task')]:
            self.create(format,tid)
            for width in [320,390,768,1440]:
                self.page.set_viewport_size({'width':width,'height':900});self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(format,width))
        self.page.locator('.cm-content').click();self.page.keyboard.press('Escape');self.page.keyboard.press('Tab');self.assertFalse(self.page.locator('.cm-content').evaluate('el=>el===document.activeElement'))
        self.page.click('#theme');theme=self.page.locator('html').get_attribute('data-theme');self.page.reload();expect(self.page.locator('html')).to_have_attribute('data-theme',theme)

    def test_storage_unavailable_and_invalid_import_backup_preserve_work(self):
        c=self.browser.new_context();c.add_init_script("indexedDB.open=()=>{throw Error('Storage unavailable')}");page=c.new_page();page.goto(self.base);expect(page.locator('#new-document')).to_be_disabled();expect(page.locator('#error')).to_be_visible();c.close()
        self.create();self.set_source('# Keep this');self.saved()
        for text in [b'{',b'{"format":"silov0-workspace","version":3,"documents":[]}']:
            self.page.locator('#restore-file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':text});expect(self.page.locator('#error')).to_be_visible();self.assertEqual(self.source(),'# Keep this');self.assertEqual(len(self.documents()),1)
        self.page.locator('#import-file').set_input_files({'name':'too-large.md','mimeType':'text/plain','buffer':b'x'*2000001});expect(self.page.locator('#error')).to_contain_text('2 MB');self.assertEqual(self.source(),'# Keep this')

    def test_screenshots_each_editor(self):
        path=Path(os.environ.get('SILOV_SCREENSHOTS','/tmp/silov-editors'));path.mkdir(parents=True,exist_ok=True)
        for format,tid in [('visual','sop'),('markdown','api'),('xml','xml-manifest'),('dita','dita-task')]:
            self.page.set_viewport_size({'width':1600,'height':1100});self.create(format,tid)
            if format in ['xml','dita']:self.assert_valid('release-manifest.xsd' if format=='xml' else 'custom DITA')
            else:expect(self.page.locator('#validation-status')).to_contain_text('0 errors')
            self.page.locator('#doc-title').blur();self.page.screenshot(path=str(path/(format+'-desktop.png')),full_page=True)
            self.page.set_viewport_size({'width':390,'height':844});self.page.screenshot(path=str(path/(format+'-mobile.png')),full_page=True)


    def test_dita_ordering_and_context_singletons(self):
        self.create('dita','dita-task');self.assert_valid('custom DITA')
        original=self.source()
        # A title after the short description is well-formed XML but violates topic order.
        start=original.index('  <title>');end=original.index('</title>',start)+len('</title>')
        title=original[start:end];without=original[:start]+original[end:];position=without.index('</shortdesc>')+len('</shortdesc>')
        self.set_source(without[:position]+'\n'+title+without[position:]);self.show_findings();expect(self.page.locator('#findings')).to_contain_text('must be ordered')
        self.set_source(original);self.assert_valid('custom DITA');self.page.select_option('#panel','outline')
        self.page.locator('#outline button').filter(has_text='task').first.click()
        self.assertNotIn('title',self.page.locator('#dita-element option').all_text_contents())
        self.page.locator('#outline button').filter(has_text='steps').first.click()
        self.assertEqual(self.page.locator('#dita-element option').all_text_contents(),['step'])

if __name__=='__main__':unittest.main(verbosity=2)
