import { expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';

export async function inspectRenderedPage(page: Page, scenario: string) {
  const result = await page.evaluate(() => {
    const visible = (el: Element) => {
      if (!el.getClientRects().length) return false;
      for (let node: Element | null = el; node; node = node.parentElement) {
        const s = getComputedStyle(node); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
      }
      return true;
    };
    const rgb = (value: string) => {
      const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return [numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0, numbers[3] ?? 1];
    };
    const blend = (front: number[], back: number[]) => front.slice(0, 3).map((v, i) => v * front[3] + back[i] * (1 - front[3]));
    const background = (el: Element, seed = [255, 255, 255], stopAt: Element | null = null): number[] => {
      const chain: Element[] = []; for (let node: Element | null = el; node && node !== stopAt; node = node.parentElement) chain.unshift(node);
      let color = seed;
      for (const node of chain) {
        const style = getComputedStyle(node); color = blend(rgb(style.backgroundColor), color);
        const stops = style.backgroundImage.match(/rgba?\([^)]+\)/g);
        if (stops?.length) {
          const textColor = rgb(getComputedStyle(el).color);
          color = stops.map(stop => blend(rgb(stop), color)).reduce((worst, candidate) => contrast(blend(textColor, candidate), candidate) < contrast(blend(textColor, worst), worst) ? candidate : worst);
        }
      }
      return color;
    };
    const luminance = (c: number[]) => c.map(x => { const v = x / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
    const contrast = (a: number[], b: number[]) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const identify = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? '#'+el.id : ''}${typeof el.className === 'string' ? '.'+el.className.trim().split(/\s+/).join('.') : ''}`;
    const contrastFailures: unknown[] = [], boundsFailures: unknown[] = [], targetFailures: unknown[] = [], nameFailures: unknown[] = [];
    let checkedText = 0, checkedControls = 0, checkedBoundaries = 0;
    // Solid rendered content backgrounds. Header gradient is inspected separately
    // through its actual computed stop colors in the scenario, not token names.
    const root = document.querySelector('main') ?? document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode, el = text.parentElement;
      if (!text.textContent?.trim() || !el || !visible(el) || el.closest('script,style,option,[disabled]')) continue;
      const style = getComputedStyle(el), bg = background(el), fg = blend(rgb(style.color), bg);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && +style.fontWeight >= 700), threshold = large ? 3 : 4.5;
      const ratio = contrast(fg, bg); checkedText++;
      if (ratio + .01 < threshold) contrastFailures.push({ element: identify(el), ratio: +ratio.toFixed(2), threshold, foreground: fg, background: bg });
    }
    const header = document.querySelector('header');
    if (header) {
      const stops = getComputedStyle(header).backgroundImage.match(/rgba?\([^)]+\)/g)?.map(rgb) ?? [background(header)];
      const nodes = document.createTreeWalker(header, NodeFilter.SHOW_TEXT);
      while (nodes.nextNode()) {
        const el = nodes.currentNode.parentElement;
        if (!nodes.currentNode.textContent?.trim() || !el || !visible(el)) continue;
        const style = getComputedStyle(el), threshold = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && +style.fontWeight >= 700) ? 3 : 4.5;
        const minimum = Math.min(...stops.map(stop => { const bg = background(el, stop, header); return contrast(blend(rgb(style.color), bg), bg); }));
        checkedText++;
        if (minimum + .01 < threshold) contrastFailures.push({ element: identify(el), kind: 'rendered header gradient stops', ratio: +minimum.toFixed(2), threshold });
      }
    }
    for (const el of document.querySelectorAll('main button,main a,main input,main select,main textarea,main h1,main h2,main h3,main dt,main dd,header button,header [role=button]')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect(), style = getComputedStyle(el);
      const tablePane = el.closest('.tickets-table-container,.users-table-container');
      const containedScroll = tablePane && getComputedStyle(tablePane).overflowX === 'auto' && tablePane.scrollWidth > tablePane.clientWidth && (tablePane as HTMLElement).tabIndex === 0 && tablePane.getAttribute('aria-label');
      if (!containedScroll && (r.left < -.5 || r.right > innerWidth + .5)) boundsFailures.push({ element: identify(el), left: r.left, right: r.right });
      const panel = el.closest('.action-card,.action-editor,.action-history,[data-testid="staff-public-comments-section"],[data-testid="staff-internal-notes-section"]');
      if (panel) { const box = panel.getBoundingClientRect(); if (r.left < box.left - .5 || r.right > box.right + .5) boundsFailures.push({ element: identify(el), kind: 'outside containing panel' }); }
      if (!el.matches('button,a,input,select,textarea,[role=button]') || el.matches('[disabled]')) continue;
      checkedControls++;
      if (el.matches('input[type=checkbox],input[type=radio]')) {
        const label = (el as HTMLInputElement).labels?.[0]; const target = label?.getBoundingClientRect();
        if (!target || target.height < 44 || target.width < 44) targetFailures.push({ element: identify(el), width: target?.width, height: target?.height });
      } else if (r.height < 43.9 || r.width < 43.9) targetFailures.push({ element: identify(el), width: r.width, height: r.height });
      const control = el as HTMLInputElement;
      if (el.matches('input,select,textarea') && !control.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) nameFailures.push(identify(el));
      if (el.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea')) {
        const bg = background(el), border = blend(rgb(style.borderTopColor), bg), ratio = contrast(border, bg); checkedBoundaries++;
        if (ratio + .01 < 3) contrastFailures.push({ element: identify(el), kind: 'input boundary', ratio: +ratio.toFixed(2), threshold: 3 });
      }
    }
    const overflowElements = Array.from(document.querySelectorAll('main *,header *')).filter(el => visible(el) && !el.closest('.tickets-table-container,.users-table-container') && el.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(el => ({ element: identify(el), right: el.getBoundingClientRect().right }));
    return { cssViewport: { width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio }, overflowElements, checkedText, checkedControls, checkedBoundaries, contrastFailures, boundsFailures, targetFailures, nameFailures, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches };
  });
  const file = process.env.E2E_AUDIT_OUTPUT;
  if (file) { await fs.mkdir(new URL('.', 'file://'+file).pathname, { recursive: true }); await fs.appendFile(file, JSON.stringify({ scenario, viewport: page.viewportSize(), ...result })+'\n'); }
  expect(result.pageOverflow, scenario+' page overflow').toBe(false);
  expect(result.boundsFailures, scenario+' clipped controls/text').toEqual([]);
  expect(result.targetFailures, scenario+' 44px targets').toEqual([]);
  expect(result.nameFailures, scenario+' control labels').toEqual([]);
  expect(result.contrastFailures, scenario+' rendered text/boundary contrast').toEqual([]);
  expect(result.reducedMotion).toBe(true);
  return result;
}
