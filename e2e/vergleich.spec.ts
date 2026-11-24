import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/test-vp9.webm');

async function projektMitZweiClips(page: Page) {
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
  await page.getByRole('tab', { name: 'Tags' }).click();
  for (const zeit of [1, 4]) {
    await video.evaluate((v: HTMLVideoElement, z) => (v.currentTime = z), zeit);
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking)).toBe(false);
    await page.keyboard.press('g');
    await page.keyboard.press('Escape');
  }
  await expect(page.getByTestId('tagmarke')).toHaveCount(2);
}

test('Vergleich: anlegen, nacheinander abspielen (nur eine Seite läuft), Seiten nebeneinander', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await projektMitZweiClips(page);
  await page.getByRole('tab', { name: 'Playlist' }).click();
  await page.getByTestId('vergleich-neu').click();
  await expect(page.getByTestId('playlist-eintrag')).toHaveCount(1);
  await expect(page.getByTestId('vergleich-editor')).toBeVisible();
  await page.getByTestId('vergleich-text-links').fill('Schlecht');
  await expect(page.getByTestId('playlist-eintrag')).toContainText('Schlecht');

  await page.getByTestId('playlist-abspielen').click();
  const links = page.getByTestId('video');
  const rechts = page.getByTestId('video-b');
  // beide Videos sichtbar, je etwa die halbe Breite
  await expect
    .poll(async () => {
      const b = await Promise.all([links, rechts].map((v) => v.boundingBox()));
      return b.every((x) => x && x.width > 0) && b[0]!.x < b[1]!.x;
    })
    .toBe(true);
  const [bl, br] = await Promise.all([links.boundingBox(), rechts.boundingBox()]);
  expect(Math.abs(bl!.width - br!.width)).toBeLessThan(3);
  expect(bl!.x + bl!.width).toBeLessThanOrEqual(br!.x + 1); // nebeneinander, ohne Überlappung

  // Erst läuft links (rechts steht), später rechts (links steht)
  const laeuft = (v: typeof links) => v.evaluate((e: HTMLVideoElement) => !e.paused);
  await expect.poll(() => laeuft(links), { timeout: 15_000 }).toBe(true);
  expect(await laeuft(rechts)).toBe(false);
  await expect.poll(() => laeuft(rechts), { timeout: 30_000 }).toBe(true);
  expect(await laeuft(links)).toBe(false);
});

test('Vergleich-Export: beide Hälften, ruhende Seite abgedunkelt', async ({ page }) => {
  test.setTimeout(180_000);
  await projektMitZweiClips(page);
  await page.getByRole('tab', { name: 'Playlist' }).click();
  await page.getByTestId('vergleich-neu').click();
  // Gleicher Clip auf beiden Seiten, starke Abdunklung: am ersten Bild ist rechts dieselbe Aufnahme, nur dunkler
  const wert = await page.getByTestId('vergleich-clip-links').inputValue();
  await page.getByTestId('vergleich-clip-rechts').selectOption(wert);
  await page.getByTestId('vergleich-dim').fill('80');

  await page.getByRole('tab', { name: 'Export' }).click();
  await expect(page.getByTestId('export-info')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-start').click(),
  ]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdva-vgl-'));
  const mp4 = path.join(dir, 'vergleich.mp4');
  await download.saveAs(mp4);
  const luma = (halbe: 'links' | 'rechts'): number => {
    const out = execFileSync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      mp4,
      '-vf',
      `select=eq(n\\,0),crop=iw/2-20:ih:${halbe === 'links' ? 0 : 'iw/2+20'}:0,scale=1:1`,
      '-vsync',
      '0',
      '-frames:v',
      '1',
      '-pix_fmt',
      'gray',
      '-f',
      'rawvideo',
      '-',
    ]);
    return out[0]!;
  };
  const hell = luma('links');
  const dunkel = luma('rechts');
  expect(hell).toBeGreaterThan(20);
  expect(dunkel).toBeLessThan(hell * 0.5);
});
