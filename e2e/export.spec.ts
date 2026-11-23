import { expect, test, type Page } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/test-vp9.webm');

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
  const springe = async (z: number) => {
    await video.evaluate((v: HTMLVideoElement, zz: number) => {
      v.currentTime = zz;
    }, z);
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking)).toBe(false);
  };
  await springe(3); // Tor Team 1
  await page.keyboard.press('g');
  await page.keyboard.press('1');
  await page.keyboard.press('Escape');
  await springe(2);
  await page.keyboard.press('i');
  await springe(6);
  await page.keyboard.press('o');
  await page.keyboard.press('Enter');
}

const ffprobe = (datei: string) =>
  JSON.parse(
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_streams',
      '-show_format',
      '-of',
      'json',
      datei,
    ]).toString(),
  ) as {
    streams: {
      codec_type: string;
      codec_name: string;
      width?: number;
      height?: number;
      avg_frame_rate?: string;
      duration?: string;
    }[];
    format: { duration: string };
  };
/** PSNR über stderr von ffmpeg (execFileSync liefert stderr nur im Fehlerfall, daher spawnSync). */
function psnrDb(a: string, b: string, crop?: string): number {
  const lavfi = crop ? `[0:v]crop=${crop}[a];[1:v]crop=${crop}[b];[a][b]psnr` : 'psnr';
  const r = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', a, '-i', b, '-lavfi', lavfi, '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  const m = /average:(inf|[\d.]+)/.exec(r.stderr);
  return m ? (m[1] === 'inf' ? 99 : Number(m[1])) : NaN;
}

test('MP4-Export: gültige Datei (H.264, Ton, Dauer) und Bild deckungsgleich mit der Vorschau', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await projektMitClip(page);
  await page.getByRole('tab', { name: 'Export' }).click();
  await page.getByTestId('export-clip').check();
  await page.locator('select[aria-label="Einzelclip"]').selectOption({ label: 'Clip 00:02:00' });
  await expect(page.getByTestId('export-info')).toContainText('640×360');
  await expect(page.getByTestId('export-info')).toContainText(/H\.264|VP9/);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-start').click(),
  ]);
  await expect(page.getByTestId('export-fortschritt')).toBeVisible();
  expect(download.suggestedFilename()).toMatch(/\.mp4$/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdva-'));
  const mp4 = path.join(dir, 'export.mp4');
  await download.saveAs(mp4);
  await expect(page.getByTestId('export-meldung')).toContainText('Heruntergeladen');

  // Struktur der Datei
  const info = ffprobe(mp4);
  const v = info.streams.find((s) => s.codec_type === 'video')!;
  const a = info.streams.find((s) => s.codec_type === 'audio');
  expect(v.codec_name).toBe('h264');
  expect([v.width, v.height]).toEqual([640, 360]);
  expect(v.avg_frame_rate).toBe('25/1');
  expect(Number(info.format.duration)).toBeGreaterThan(3.9);
  expect(Number(info.format.duration)).toBeLessThan(4.2);
  expect(a).toBeTruthy(); // Ton ist drin (AAC oder Opus)

  // Parität: dasselbe Bild in der Vorschau (renderFrame im Hauptthread) und im Export (renderFrame im Worker)
  await page.getByRole('tab', { name: 'Clips' }).click();
  await page.getByTestId('clip-zeichnen').last().click();
  await expect(page.getByTestId('clip-editor')).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { __bdvaTest: { springe(t: number): Promise<void> } }).__bdvaTest.springe(
      2.48,
    ),
  );
  const url = await page.evaluate(() =>
    (
      window as unknown as { __bdvaTest: { vorschauBild(b: number, h: number): string } }
    ).__bdvaTest.vorschauBild(640, 360),
  );
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
    'select=eq(n\\,62)',
    '-vsync',
    '0',
    '-frames:v',
    '1',
    exportiert,
  ]);
  expect(psnrDb(exportiert, erwartet)).toBeGreaterThan(26); // ganzes Bild (Videokompression)
  expect(psnrDb(exportiert, erwartet, '230:50:0:0')).toBeGreaterThan(24); // Scoreboard-Bereich: Text, Streifen, Stand
  // Auch das Logo (oben rechts) stimmt
  expect(psnrDb(exportiert, erwartet, '120:70:520:0')).toBeGreaterThan(24);
});

test('PNG-Export enthält Overlays; Abbrechen stoppt den Export und meldet es', async ({ page }) => {
  test.setTimeout(120_000);
  await projektMitClip(page);
  await page.getByRole('tab', { name: 'Export' }).click();
  const [bild] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('png-export').click(),
  ]);
  expect(bild.suggestedFilename()).toMatch(/\.png$/);
  const png = await bild.path();
  const kopf = fs.readFileSync(png!).subarray(0, 8);
  expect([...kopf]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      png!,
    ])
      .toString()
      .trim(),
  ).toBe('640,360');

  // Abbrechen: grosse Playlist (Clip mehrfach), Start, sofort Abbruch
  await page.getByRole('tab', { name: 'Clips' }).click();
  await page.getByTestId('clip-zeichnen').last().click();
  await page.getByRole('button', { name: 'Editor schliessen' }).click();
  for (let i = 0; i < 8; i++) {
    await page.getByRole('tab', { name: 'Clips' }).click();
    await page.getByRole('button', { name: 'In Playlist' }).click();
  }
  await page.getByRole('tab', { name: 'Export' }).click();
  await page.getByTestId('export-playlist').check();
  await expect(page.getByTestId('export-info')).toContainText('640×360');
  await page.getByTestId('export-start').click();
  await expect(page.getByTestId('export-abbrechen')).toBeVisible();
  await page.getByTestId('export-abbrechen').click();
  await expect(page.getByTestId('export-meldung')).toContainText('abgebrochen', {
    timeout: 20_000,
  });
  await expect(page.getByTestId('export-start')).toBeEnabled();
});
