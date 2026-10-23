"""Browser regression check; serve the repository over HTTP first."""
import sys
from playwright.sync_api import expect, sync_playwright

with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page()
    errors, requests = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: requests.append(request.url))
    # Exercise the export button without depending on OS clipboard permissions.
    page.add_init_script("Object.defineProperty(navigator, 'clipboard', {value: {writeText: async text => {window.copiedDigest = text}}})")
    page.goto(sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8000/')
    cards = page.locator('#posts-grid .post-card')
    rows = page.locator('#post-rows tr')
    expect(cards).to_have_count(4)
    expect(rows).to_have_count(4)
    expect(page.locator('#filter-count')).to_have_text('4 samples')
    expect(page.locator('#empty-state')).to_be_hidden()
    expect(page.locator('#empty-table')).to_be_hidden()
    assert any('/posts/posts.json' in url for url in requests)
    assert not any('/api/' in url for url in requests), requests

    for target in ['overview', 'live-demo', 'samples', 'architecture', 'case-study', 'api-reference']:
        expect(page.locator('#' + target)).to_have_count(1)
    page.locator('#search').fill('no matching sample')
    expect(cards).to_have_count(0)
    expect(rows).to_have_count(0)
    expect(page.locator('#filter-count')).to_have_text('Showing 0 of 4 samples')
    expect(page.locator('#empty-state')).to_be_visible()
    expect(page.locator('#empty-table')).to_be_visible()
    page.locator('#export-markdown').click()
    expect(page.locator('#filter-count')).to_contain_text('Copied digest for 0 samples')
    assert 'No posts match your filters' in page.evaluate('window.copiedDigest')

    page.locator('#search').fill('')
    page.locator('#tag-filter').select_option('api')
    expect(cards).to_have_count(2)
    expect(rows).to_have_count(2)
    page.locator('#search').fill('AUTHENTICATION')
    expect(cards).to_have_count(1)
    expect(rows).to_have_count(1)
    expect(cards.first).to_contain_text('Resolve an unauthorized write')
    page.locator('#export-markdown').click()
    expect(page.locator('#filter-count')).to_contain_text('Copied digest for 1 sample')
    digest = page.evaluate('window.copiedDigest')
    assert 'Resolve an unauthorized write' in digest
    assert '[Source](samples.html#unauthorized-write)' in digest
    assert 'Preview the documentation library' not in digest
    page.locator('#tag-filter').select_option('tutorial')
    expect(cards).to_have_count(0)
    expect(rows).to_have_count(0)
    page.locator('#search').fill('')
    expect(cards).to_have_count(1)
    page.locator('#tag-filter').select_option('')

    for width in [320, 375, 390, 640, 768, 1024, 1100, 1440]:
        page.set_viewport_size({'width': width, 'height': 844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
    page.set_viewport_size({'width': 390, 'height': 844})
    expect(page.locator('.desktop-nav')).to_be_hidden()
    page.locator('.mobile-navigation summary').click()
    page.get_by_role('navigation', name='Mobile navigation').get_by_text('Interactive Demo', exact=True).click()
    expect(page.locator('#demo-title')).to_be_in_viewport()
    assert page.locator('.table-wrapper').evaluate('el => el.scrollWidth > el.clientWidth')

    # Sample links are safe relative links and point to real writing, not placeholders.
    for anchor in ['local-preview', 'filter-posts', 'unauthorized-write', 'markdown-export']:
        link = page.locator('#posts-grid a[href="samples.html#' + anchor + '"]')
        expect(link).to_have_count(1)
    page.locator('#posts-grid a[href="samples.html#local-preview"]').click()
    expect(page.locator('#local-preview h2')).to_have_text('Preview the documentation library locally')
    for width in [320, 390, 768, 1440]:
        page.set_viewport_size({'width': width, 'height': 844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
    assert not errors, errors
    browser.close()
    print('Portfolio browser checks passed: navigation, JSON-only reads, both views, filters, exports, sample links, and responsive layouts.')
