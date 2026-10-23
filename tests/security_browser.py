"""Serve the static site locally, then run alongside demo_smoke.py."""
import json
import sys
import os
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("SILOV_CHROMIUM_EXECUTABLE"))
    page = browser.new_page()
    payload = '<img src=x onerror="window.pwned=1"><script>window.pwned=1</script><svg onload="window.pwned=1">'
    posts = [{"id": "evil", "title": payload, "summary": payload, "tags": [payload], "date": "2024-01-01", "url": "javascript:window.pwned=1"}]
    page.route('**/posts/posts.json', lambda route: route.fulfill(content_type='application/json', body=json.dumps(posts)))
    base = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8000/'
    page.goto(base.rstrip('/') + '/documentation.html')
    for selector in ['.post-title', '.post-summary', '.post-tag', '#post-rows strong', '.table-tag', '#post-rows td:last-child']:
        expect(page.locator(selector)).to_have_text(payload)
    assert page.locator('#posts-grid img, #posts-grid script, #posts-grid svg, #post-rows img, #post-rows script, #post-rows svg').count() == 0
    assert page.evaluate('window.pwned') is None
    assert page.locator('#posts-grid a, #post-rows a').count() == 0
    assert '[Source]' not in page.evaluate('buildMarkdownDigest(' + json.dumps(posts) + ')')
    page.locator('#search').fill('no-match')
    expect(page.locator('.post-card')).to_have_count(0)
    browser.close()
    print('Browser XSS regression passed: payloads remain text in both views; unsafe URL omitted.')
