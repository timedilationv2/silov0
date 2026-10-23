"""Browser smoke check. Serve the repo over HTTP before running this file."""

import sys

from playwright.sync_api import expect, sync_playwright


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000/")

    cards = page.locator("#posts-grid .post-card")
    rows = page.locator("#post-rows tr")
    expect(cards).to_have_count(3)
    expect(rows).to_have_count(3)
    expect(cards.filter(has_text="First Demo Post")).to_have_count(1)
    expect(rows.filter(has_text="First Demo Post")).to_have_count(1)
    expect(page.locator("#filter-count")).to_have_text("3 posts")
    expect(page.locator("#empty-state")).to_be_hidden()
    expect(page.locator("#empty-table")).to_be_hidden()

    page.locator("#search").fill("no matching post")
    expect(cards).to_have_count(0)
    expect(rows).to_have_count(0)
    expect(page.locator("#filter-count")).to_have_text("Showing 0 of 3 posts")
    expect(page.locator("#empty-state")).to_be_visible()
    expect(page.locator("#empty-table")).to_be_visible()

    page.locator("#search").fill("")
    page.locator("#tag-filter").select_option("ai")
    expect(cards).to_have_count(2)
    expect(rows).to_have_count(2)
    page.locator("#search").fill("digest")
    expect(cards).to_have_count(1)
    expect(rows).to_have_count(1)
    expect(cards.first).to_contain_text("Exporting a Markdown digest")
    page.locator("#tag-filter").select_option("web")
    expect(cards).to_have_count(0)
    expect(rows).to_have_count(0)
    page.locator("#search").fill("")
    expect(cards).to_have_count(1)
    expect(rows).to_have_count(1)
    for width in [320, 375, 390, 640, 768, 1024, 1100, 1440]:
        page.set_viewport_size({"width": width, "height": 844})
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), width
    page.set_viewport_size({"width": 390, "height": 844})
    expect(page.locator(".sidebar-nav")).to_be_hidden()
    page.locator(".mobile-navigation summary").click()
    page.get_by_role("navigation", name="Mobile documentation").get_by_text("Live demo").click()
    expect(page.locator("#live-demo")).to_be_in_viewport()
    page.locator("#tag-filter").select_option("ai")
    expect(cards).to_have_count(2)
    expect(rows).to_have_count(2)
    assert page.locator(".table-wrapper").evaluate("el => el.scrollWidth > el.clientWidth")
    assert not errors, errors
    browser.close()
    print("Demo smoke check passed: cards, table, count, search, and tag filter.")
