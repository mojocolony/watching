import os
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--allow-file-access-from-files', '--disable-web-security'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    page.goto('file://' + os.path.join(ROOT, 'index.html') + '?demo=1', wait_until='domcontentloaded')
    page.wait_for_selector('text=Watching', timeout=3000)
    assert page.get_by_text('NOW WATCHING').count() == 1
    assert page.get_by_text('QUEUED UP').count() == 1
    assert page.locator('[data-action="add-show"]').count() == 1
    assert page.locator('[data-action="toggle-priya-filter"]').count() == 1
    assert page.locator('.floating-pill').evaluate("el => getComputedStyle(el).flexDirection") == 'column'
    page.locator('[data-action="toggle-show"]').first.click()
    page.wait_for_selector('.episode-row')
    first_episode = page.locator('.episode-row').first
    was_watched = 'episode-row--watched' in (first_episode.get_attribute('class') or '')
    first_episode.locator('button').click()
    is_watched = 'episode-row--watched' in (page.locator('.episode-row').first.get_attribute('class') or '')
    assert was_watched != is_watched
    page.locator('[data-action="toggle-priya-filter"]').click()
    assert page.locator('.priya-marker').count() >= 1
    page.locator('[data-action="add-show"]').click()
    page.wait_for_selector('.sheet')
    assert page.get_by_text('Add manually').count() == 1
    page.locator('[data-action="close-sheet"]').click()
    page.locator('[data-action="open-menu"]').click()
    page.wait_for_selector('.menu-panel')
    assert page.get_by_text('Archive', exact=True).count() == 1
    assert page.get_by_text('v0.2.0').count() == 1
    browser.close()
