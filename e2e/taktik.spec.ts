import { expect, test, type Page } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/test-vp9.webm');

async function clipOeffnen(page: Page) {
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
    [2, 'i'],
    [6, 'o'],
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

/** Klick auf die Tafel (normiert 0–1 des Canvas) als Zeigerereignisse. */
async function tafelZeiger(
  page: Page,
  typ: 'pointerdown' | 'pointermove' | 'pointerup',
  x: number,
  y: number,
) {
  await page.getByTestId('tafel-canvas').evaluate(
    (el, a) => {
      const r = el.getBoundingClientRect();
      el.dispatchEvent(
        new PointerEvent(a.typ, {
          bubbles: true,
          cancelable: true,
          pointerId: 5,
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

const alphaBei = (page: Page, x: number, y: number) =>
  page
    .getByTestId('overlay')
    .evaluate(
      (c: HTMLCanvasElement, p) =>
        c
          .getContext('2d')!
          .getImageData(Math.round(p.x * c.width), Math.round(p.y * c.height), 1, 1).data[3]!,
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

test('Taktiktafel: Situation zeichnen, per T einblenden, im Export enthalten', async ({ page }) => {
  test.setTimeout(120_000);
  await clipOeffnen(page);
  await page.getByRole('tab', { name: 'Taktik' }).click();
  await expect(page.getByTestId('feld-platzhalter')).toBeVisible();

  // Neue Situation: zwei Spieler und ein Pass
  await page.getByTestId('neue-situation').click();
  await expect(page.getByTestId('tafel-editor')).toBeVisible();
  await page.getByTestId('tafel-w-team1').click();
  await tafelZeiger(page, 'pointerdown', 0.4, 0.45);
  await tafelZeiger(page, 'pointerup', 0.4, 0.45);
  await page.getByTestId('tafel-nummer').fill('7');
  await page.getByTestId('tafel-w-team2').click();
  await tafelZeiger(page, 'pointerdown', 0.65, 0.6);
  await tafelZeiger(page, 'pointerup', 0.65, 0.6);
  await page.getByTestId('tafel-w-pass').click();
  await tafelZeiger(page, 'pointerdown', 0.4, 0.45);
  await tafelZeiger(page, 'pointermove', 0.55, 0.5);
  await tafelZeiger(page, 'pointermove', 0.65, 0.6);
  await tafelZeiger(page, 'pointerup', 0.65, 0.6);
  await expect(page.getByTestId('situationsliste')).toContainText('2 Marker, 1 Pfeile');
  await page.getByTestId('tafel-schliessen').click();
  await expect(page.getByTestId('tafel-editor')).toBeHidden();

  // Ohne Einblenden ist unten rechts nichts gezeichnet; mit T erscheint die Tafel
  await springe(page, 1.0);
  expect(await alphaBei(page, 0.9, 0.9)).toBe(0);
  await page
    .getByTestId('video')
    .click({ position: { x: 5, y: 5 }, force: true })
    .catch(() => undefined);
  await page.keyboard.press('t');
  await expect.poll(() => alphaBei(page, 0.9, 0.9)).toBeGreaterThan(200);
  await expect(page.getByTestId('taktik-balken')).toHaveCount(1);

  // Export und Vorschau stimmen überein (Tafel im Bild)
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdva-tk-'));
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
  // Tafelbereich unten rechts (192×96 bei 640×360) stimmt besonders genau
  const crop = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-i',
      exportiert,
      '-i',
      erwartet,
      '-lavfi',
      '[0:v]crop=200:110:428:238[a];[1:v]crop=200:110:428:238[b];[a][b]psnr',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' },
  );
  const m = /average:(inf|[\d.]+)/.exec(crop.stderr);
  expect(m && (m[1] === 'inf' ? 99 : Number(m[1]))).toBeGreaterThan(24);

  // T entfernt die Tafel wieder
  await page.getByRole('tab', { name: 'Clips' }).click();
  await springe(page, 1.0);
  await page.keyboard.press('t');
  await expect.poll(() => alphaBei(page, 0.9, 0.9)).toBe(0);
});
