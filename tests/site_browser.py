"""Navigation, compatibility, theme, responsive layout, and screenshot regression.
Run with a static server: python3 tests/site_browser.py http://localhost:8000/
"""
import os
from pathlib import Path
import sys
from urllib.parse import urljoin, urlparse, unquote
from playwright.sync_api import sync_playwright, expect

base = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8000/').rstrip('/') + '/'
pages = ['index.html', 'workspace.html', 'documentation.html', 'using-workspace.html',
         'running.html', 'api.html', 'samples.html', 'history.html', 'learn.html']
artifacts = Path(os.environ.get('SILOV_SCREENSHOTS', '/tmp/silov-screenshots'))
artifacts.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('SILOV_CHROMIUM_EXECUTABLE'))
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    links = set()
    for filename in pages:
        response = page.goto(urljoin(base, filename))
        assert response.status == 200, filename
        nav = page.get_by_role('navigation', name='Main navigation')
        assert nav.locator('a').all_text_contents() == ['Overview', 'Workspace', 'Documentation', 'GitHub']
        assert nav.locator('a').evaluate_all('(nodes) => nodes.map(n => n.getAttribute("href"))') == ['index.html', 'workspace.html', 'documentation.html', 'https://github.com/timedilationv2/silov0']
        for width in [320, 390, 768, 1440]:
            page.set_viewport_size({'width': width, 'height': 1000})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (filename, width)
        for href in page.locator('a[href]').evaluate_all('(nodes) => nodes.map(n => n.href)'):
            if href.startswith(base): links.add(href)
    # Fetch every internal destination and check real fragment targets.
    checker = context.new_page()
    for link in sorted(links):
        response = context.request.get(link.split('#')[0])
        assert response.status == 200, link
        if urlparse(link).path.endswith('.xsd'):
            assert '<xs:schema' in response.text(), link
            continue
        checker.goto(link)
        fragment = unquote(urlparse(checker.url).fragment)
        if fragment:
            assert checker.locator('[id]').evaluate_all('(els, id) => els.some(el => el.id === id)', fragment), link
    checker.close()
    for old, target in [('index.html#live-demo', 'documentation.html#live-demo'),
                        ('index.html#samples', 'documentation.html#live-demo'),
                        ('index.html#case-study', 'history.html'),
                        ('index.html#api-reference', 'api.html'),
                        ('index.html#architecture', 'running.html#storage'),
                        ('index.html#cards', 'documentation.html#cards'),
                        ('index.html#table', 'documentation.html#table'),
                        ('learn.html#overview', 'index.html#overview'),
                        ('learn.html#architecture', 'running.html#storage'),
                        ('learn.html#live-demo', 'documentation.html#live-demo')]:
        page.goto(urljoin(base, old)); expect(page).to_have_url(urljoin(base, target))
    page.goto(base)
    page.keyboard.press('Tab')
    expect(page.locator('.skip-link')).to_be_focused()
    page.keyboard.press('Enter')
    expect(page.locator('#main')).to_be_focused()
    page.click('#theme')
    theme = page.locator('html').get_attribute('data-theme')
    page.get_by_role('navigation', name='Main navigation').get_by_text('Workspace', exact=True).click()
    expect(page.locator('html')).to_have_attribute('data-theme', theme)
    page.reload(); expect(page.locator('html')).to_have_attribute('data-theme', theme)
    # Capture both themes and mobile layouts using synthetic data only.
    page.evaluate("localStorage.setItem('silov0-theme','light')")
    page.goto(urljoin(base, 'documentation.html'))
    page.screenshot(path=str(artifacts/'documentation-desktop.png'), full_page=True)
    page.goto(base)
    page.screenshot(path=str(artifacts/'overview-desktop.png'), full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(artifacts/'overview-mobile.png'), full_page=True)
    page.goto(urljoin(base, 'workspace.html'))
    expect(page.locator('#welcome-create')).to_be_enabled()
    page.click('#welcome-create')
    page.select_option('#new-format','visual')
    page.select_option('#template','sop')
    page.click('#create')
    expect(page.locator('#save-status')).to_have_text('Saved locally')
    page.set_viewport_size({'width':1440,'height':1000})
    page.locator('.tiptap').focus()
    page.screenshot(path=str(artifacts/'workspace-desktop.png'), full_page=True)
    page.click('#theme')
    page.screenshot(path=str(artifacts/'workspace-dark.png'), full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(artifacts/'workspace-mobile.png'), full_page=True)
    assert not errors, errors
    context.close(); browser.close()
    print(f'Site checks passed: {len(pages)} pages, {len(links)} internal links, legacy URLs, shared theme, keyboard entry, four viewport sizes. Screenshots: {artifacts}')
