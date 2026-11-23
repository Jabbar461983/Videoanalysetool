import { expect, test, type Page } from '@playwright/test';

/**
 * Automatisches Mitführen mit echtem Modell (Download, langsam auf der CPU) – nur lokal:
 *   BM_VIDEO=/pfad/pan-gross.webm npx playwright test e2e/tracking-auto.spec.ts
 * Das Video zeigt einen Spieler, der mit 30 px/s nach links durchs Bild wandert (siehe e2e/ki-benchmark.spec.ts).
 */
test.setTimeout(900_000);

async function zeiger(page: Page, typ: string, x: number, y: number) {
  await page.getByTestId('spielerebene').evaluate(
    (el, a) => {
      const r = el.getBoundingClientRect();
      el.dispatchEvent(
        new PointerEvent(a.typ, {
          bubbles: true,
          cancelable: true,
          pointerId: 4,
          pointerType: 'mouse',
          clientX: r.left + r.width * a.x,
          clientY: r.top + r.height * a.y,
          isPrimary: true,
          buttons: 1,
          button: 0,
        }),
      );
    },
    { typ, x, y },
  );
}
test('Spotlight folgt dem Spieler automatisch', async ({ page }) => {
  test.skip(!process.env.BM_VIDEO, 'BM_VIDEO nicht gesetzt');
  await page.addInitScript(() => {
    localStorage.setItem('bdva-test', '1');
    localStorage.setItem('bdva-tracking-erzwingen', '1');
  });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 400)));
  await page.goto('./');
  const ok = page.getByRole('button', { name: 'Verstanden' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByTestId('datei-input').setInputFiles(process.env.BM_VIDEO!);
  const video = page.getByTestId('video');
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);
  await page.getByRole('tab', { name: 'Clips' }).click();
  for (const [zeit, taste] of [
    [1, 'i'],
    [4, 'o'],
  ] as const) {
    await video.evaluate((v: HTMLVideoElement, z: number) => {
      v.currentTime = z;
    }, zeit);
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking)).toBe(false);
    await page.keyboard.press(taste);
  }
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await expect(page.getByTestId('clip-editor')).toBeVisible();
  const springe = (t: number) =>
    page.evaluate(
      (z) =>
        (
          window as unknown as { __bdvaTest: { springe(t: number): Promise<void> } }
        ).__bdvaTest.springe(z),
      t,
    );
  await springe(0.5);
  await page.getByTestId('werkzeug-spieler').click();
  // Spieler bei Quellzeit 1.5: Trikot (ohne Schriftzug) bei x ≈ 0.72, y ≈ 0.32 (Videobild 600×500)
  await zeiger(page, 'pointerdown', 0.717, 0.32);
  await expect(page.getByTestId('spielerliste').locator('li')).toHaveCount(1, { timeout: 600_000 });
  await expect(page.getByTestId('tracking-abbrechen')).toBeVisible({ timeout: 600_000 });
  await expect(page.getByTestId('tracking-abbrechen')).toBeHidden({ timeout: 800_000 });
  console.log(
    'PANEL ' + (await page.getByTestId('spieler-panel').innerText()).replace(/\n/g, ' | '),
  );
  await expect(page.getByTestId('spieler-modus')).toHaveValue('auto');

  // Schwerpunkt des Spotlight-Lochs (Alpha niedrig) auf mehreren Zeilen, bei Clip-Zeit 0.5 und 2.5.
  // Quellzeit 1.5 → 3.5: Der Spieler wandert 60 px (0.1 der Bildbreite) nach links.
  const schwerpunkt = async (clipZeit: number) => {
    await springe(clipZeit);
    await page.waitForTimeout(1500);
    return page.getByTestId('overlay').evaluate((c: HTMLCanvasElement) => {
      const ctx = c.getContext('2d')!;
      let summe = 0;
      let n = 0;
      for (const yy of [0.3, 0.34, 0.38]) {
        const y = Math.round(yy * c.height);
        const zeile = ctx.getImageData(0, y, c.width, 1).data;
        for (let x = 0; x < c.width; x += 2) {
          if (zeile[x * 4 + 3]! < 60) {
            summe += x / c.width;
            n++;
          }
        }
      }
      return n > 0 ? { x: summe / n, n } : null;
    });
  };
  const a1 = await schwerpunkt(0.5);
  const a2 = await schwerpunkt(2.5);
  console.log('SCHWERPUNKT ' + JSON.stringify({ a1, a2 }));
  expect(a1).not.toBeNull();
  expect(a2).not.toBeNull();
  const dx = a2!.x - a1!.x;
  expect(dx).toBeLessThan(-0.06);
  expect(dx).toBeGreaterThan(-0.14);
});
