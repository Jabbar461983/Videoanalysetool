import { expect, test, type Page } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/spieler-vp9.webm');

async function projektMitClip(page: Page) {
  await page.addInitScript(() => localStorage.setItem('bdva-test', '1'));
  await page.goto('./');
  const ok = page.getByRole('button', { name: 'Verstanden' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByTestId('datei-input').setInputFiles(VIDEO);
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
  await expect(page.getByTestId('clipliste').locator('li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await expect(page.getByTestId('clip-editor')).toBeVisible();
}

const springe = (page: Page, t: number) =>
  page.evaluate(
    (z) =>
      (
        window as unknown as { __bdvaTest: { springe(t: number): Promise<void> } }
      ).__bdvaTest.springe(z),
    t,
  );

async function zeiger(
  page: Page,
  typ: 'pointerdown' | 'pointermove' | 'pointerup',
  x: number,
  y: number,
) {
  await page.getByTestId('spielerebene').evaluate(
    (el, a) => {
      const r = el.getBoundingClientRect();
      el.dispatchEvent(
        new PointerEvent(a.typ, {
          bubbles: true,
          cancelable: true,
          pointerId: 3,
          pointerType: 'mouse',
          clientX: r.left + r.width * a.x,
          clientY: r.top + r.height * a.y,
          isPrimary: true,
          buttons: a.typ === 'pointerup' ? 0 : 1,
          button: 0,
        }),
      );
    },
    { typ, x, y },
  );
}

/** Pixel (RGBA) der Vorschau-Zeichenfläche an normierter Position. */
const pixel = (page: Page, x: number, y: number) =>
  page.getByTestId('overlay').evaluate(
    (c: HTMLCanvasElement, p) => {
      const d = c
        .getContext('2d')!
        .getImageData(Math.round(p.x * c.width), Math.round(p.y * c.height), 1, 1).data;
      return [d[0]!, d[1]!, d[2]!, d[3]!];
    },
    { x, y },
  );

function psnrDb(a: string, b: string): number {
  const r = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-'],
    {
      encoding: 'utf8',
    },
  );
  const m = /average:(inf|[\d.]+)/.exec(r.stderr);
  return m ? (m[1] === 'inf' ? 99 : Number(m[1])) : NaN;
}

test('Spieler freistellen, hervorheben, verschieben; Export deckt sich mit der Vorschau', async ({
  page,
}) => {
  test.setTimeout(420_000);
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
  await projektMitClip(page);
  await springe(page, 0.5);
  await page.getByTestId('werkzeug-spieler').click();
  await expect(page.getByTestId('spieler-hilfe')).toBeVisible();

  // Klick auf die rote Figur (Mitte bei x≈0.503, y≈0.49)
  await zeiger(page, 'pointerdown', 0.503, 0.49);
  await zeiger(page, 'pointerup', 0.503, 0.49);
  await expect(page.getByTestId('spielerliste').locator('li')).toHaveCount(1, { timeout: 360_000 });
  await expect(page.getByTestId('spieler-status')).toContainText('Standbild von 3 s eingefügt');

  // Spotlight: Umgebung abgedunkelt, Spieler ausgespart
  const ecke = await pixel(page, 0.1, 0.1);
  expect(ecke[3]).toBeGreaterThan(100);
  const mitte = await pixel(page, 0.503, 0.49);
  expect(mitte[3]).toBeLessThan(20);

  // Verschieben: erst Hintergrund füllen, dann ziehen
  await page.getByTestId('spieler-verschieben').check();
  await expect(page.getByTestId('spieler-eigenschaften')).toHaveAttribute(
    'data-hintergrund',
    'ja',
    {
      timeout: 120_000,
    },
  );
  await zeiger(page, 'pointerdown', 0.503, 0.49);
  await zeiger(page, 'pointermove', 0.35, 0.49);
  await zeiger(page, 'pointermove', 0.2, 0.49);
  await zeiger(page, 'pointerup', 0.2, 0.49);
  await expect
    .poll(async () => (await pixel(page, 0.2, 0.49))[3], { timeout: 10_000 })
    .toBeGreaterThan(200);
  const neu = await pixel(page, 0.2, 0.49);
  expect(neu[0]).toBeGreaterThan(150); // rot
  expect(neu[1]).toBeLessThan(80);
  const alt = await pixel(page, 0.503, 0.49); // alte Stelle: Hintergrund statt Loch, kein Rot
  expect(alt[3]).toBeGreaterThan(250);
  expect(alt[1]).toBeGreaterThan(alt[0]! + 5);

  // Undo macht das Verschieben rückgängig
  await page.keyboard.press('Control+z');
  const zurueck = await pixel(page, 0.2, 0.49);
  expect(zurueck[0]).toBeLessThan(80);
  await page.keyboard.press('Control+y');

  // Export: gleiches Bild wie die Vorschau (im Standbild bei Clip-Zeit 1.5 s)
  await springe(page, 1.5);
  const url = await page.evaluate(() =>
    (
      window as unknown as { __bdvaTest: { vorschauBild(b: number, h: number): string } }
    ).__bdvaTest.vorschauBild(640, 360),
  );
  await page.getByRole('tab', { name: 'Export' }).click();
  await page.getByTestId('export-clip').check();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-start').click(),
  ]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdva-sp-'));
  const mp4 = path.join(dir, 'export.mp4');
  await download.saveAs(mp4);
  const erwartet = path.join(dir, 'vorschau.png');
  fs.writeFileSync(erwartet, Buffer.from(url.split(',')[1]!, 'base64'));
  const exportiert = path.join(dir, 'export.png');
  execFileSync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    mp4,
    '-vf',
    'select=eq(n\\,37)',
    '-vsync',
    '0',
    '-frames:v',
    '1',
    exportiert,
  ]);
  expect(psnrDb(exportiert, erwartet)).toBeGreaterThan(24);

  // ✕ am Spieler entfernt die Markierung
  await page.getByRole('tab', { name: 'Clips' }).click();
  await expect(page.getByTestId('spieler-kreuz')).toHaveCount(1);
  await page.getByTestId('spieler-kreuz').click();
  await expect(page.getByTestId('spielerliste').locator('li')).toHaveCount(0);
});
