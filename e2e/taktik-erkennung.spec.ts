import { expect, test } from '@playwright/test';

/**
 * «Alle Spieler erkennen» mit echtem Modell (Download, nur lokal):
 *   BM_VIDEO=/pfad/pan-gross.webm npx playwright test e2e/taktik-erkennung.spec.ts
 * Das Video zeigt Fussballspieler; kalibriert wird mit den vier Bildecken, sodass das ganze Bild im Feld liegt.
 */
test.setTimeout(600_000);

test('Alle Spieler erkennen und auf die Tafel übertragen', async ({ page }) => {
  test.skip(!process.env.BM_VIDEO, 'BM_VIDEO nicht gesetzt');
  await page.addInitScript(() => {
    localStorage.setItem('bdva-test', '1');
    localStorage.setItem('bdva-ki-geraet', 'wasm');
  });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto('./');
  const ok = page.getByRole('button', { name: 'Verstanden' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByTestId('datei-input').setInputFiles(process.env.BM_VIDEO!);
  const video = page.getByTestId('video');
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);
  await video.evaluate((v: HTMLVideoElement) => {
    v.currentTime = 1;
  });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking)).toBe(false);
  await page.getByRole('tab', { name: 'Taktik' }).click();
  await page.getByTestId('neu-kalibrieren').click();
  const klick = (x: number, y: number) =>
    page.getByTestId('kalibrier-bild').evaluate(
      (el, a) => {
        const r = el.getBoundingClientRect();
        el.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            clientX: r.left + r.width * a.x,
            clientY: r.top + r.height * a.y,
            pointerId: 8,
            pointerType: 'mouse',
            button: 0,
            buttons: 1,
            isPrimary: true,
          }),
        );
      },
      { x, y },
    );
  await klick(0.05, 0.05);
  await klick(0.95, 0.05);
  await klick(0.05, 0.95);
  await klick(0.95, 0.95);
  await page.getByTestId('kalibrierung-speichern').click();
  await page.getByTestId('uebernehmen-auto').click();
  await expect(page.getByTestId('tafel-editor')).toBeVisible({ timeout: 540_000 });
  console.log(
    'MELDUNG ' +
      (await page
        .getByTestId('taktik-meldung')
        .innerText()
        .catch(() => '')),
  );
  const p = await page.evaluate(() =>
    (
      window as unknown as {
        __bdvaTest: {
          projekt(): {
            taktik: { situationen: { marker: { art: string; x: number; y: number }[] }[] };
          };
        };
      }
    ).__bdvaTest.projekt(),
  );
  const s = p.taktik.situationen.at(-1)!;
  console.log(
    'MARKER ' + JSON.stringify(s.marker.map((m) => [m.art, Math.round(m.x), Math.round(m.y)])),
  );
  expect(s.marker.length).toBeGreaterThanOrEqual(1);
});
