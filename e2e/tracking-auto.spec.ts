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
const pixel = (page: Page, x: number, y: number) =>
  page.getByTestId('overlay').evaluate(
    (c: HTMLCanvasElement, p) => {
      const d = c
        .getContext('2d')!
        .getImageData(Math.round(p.x * c.width), Math.round(p.y * c.height), 1, 1).data;
      return d[3]!;
    },
    { x, y },
  );

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
  // Spieler bei Quellzeit 1.5: x = (512 - 30·1.5)/600 ≈ 0.78, Brusthöhe y ≈ 0.5 (Videobild 600×500)
  await zeiger(page, 'pointerdown', 0.78, 0.46);
  await expect(page.getByTestId('spielerliste').locator('li')).toHaveCount(1, { timeout: 600_000 });
  await expect(page.getByTestId('tracking-abbrechen')).toBeVisible({ timeout: 600_000 });
  await expect(page.getByTestId('tracking-abbrechen')).toBeHidden({ timeout: 800_000 });
  console.log(
    'PANEL ' + (await page.getByTestId('spieler-panel').innerText()).replace(/\n/g, ' | '),
  );
  await expect(page.getByTestId('spieler-modus')).toHaveValue('auto');

  // Clip-Zeit 0.5 → Quellzeit 1.5, Clip-Zeit 2.5 → Quellzeit 3.5: Spieler wandert 60 px nach links (0.1 der Breite)
  for (const [clipZeit, quellZeit] of [
    [0.5, 1.5],
    [2.5, 3.5],
  ] as const) {
    await springe(clipZeit);
    await page.waitForTimeout(1500);
    const reihe = await page.getByTestId('overlay').evaluate((c: HTMLCanvasElement) => {
      const ctx = c.getContext('2d')!;
      const y = Math.round(0.46 * c.height);
      const out: string[] = [];
      for (let i = 0; i < 40; i++)
        out.push(String(ctx.getImageData(Math.round((i / 40) * c.width), y, 1, 1).data[3]));
      return out.join(',');
    });
    console.log(
      'REIHE clip ' +
        clipZeit +
        ' erwartet x=' +
        ((512 - 30 * quellZeit) / 600).toFixed(3) +
        ' : ' +
        reihe,
    );
    const x = (512 - 30 * quellZeit) / 600;
    await expect.poll(() => pixel(page, x, 0.46), { timeout: 5000 }).toBeLessThan(40); // Loch im Spotlight
    expect(await pixel(page, Math.min(0.97, x + 0.3), 0.46)).toBeGreaterThan(100); // sonst abgedunkelt
  }
});
