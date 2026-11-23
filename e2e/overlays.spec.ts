import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/test-vp9.webm');

const pixel = (page: Page, x0: number, y0: number, x1: number, y1: number) =>
  page.getByTestId('overlay').evaluate(
    (c: HTMLCanvasElement, r) => {
      const d = c
        .getContext('2d')!
        .getImageData(
          Math.floor(r.x0 * c.width),
          Math.floor(r.y0 * c.height),
          Math.max(1, Math.floor((r.x1 - r.x0) * c.width)),
          Math.max(1, Math.floor((r.y1 - r.y0) * c.height)),
        ).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]! > 20) n++;
      return n;
    },
    { x0, y0, x1, y1 },
  );
/** Pixel, die nicht der dunkle Titelfolien-Grund (#141414) sind. */
const nichtGrund = (page: Page, x0: number, y0: number, x1: number, y1: number) =>
  page.getByTestId('overlay').evaluate(
    (c: HTMLCanvasElement, r) => {
      const d = c
        .getContext('2d')!
        .getImageData(
          Math.floor(r.x0 * c.width),
          Math.floor(r.y0 * c.height),
          Math.max(1, Math.floor((r.x1 - r.x0) * c.width)),
          Math.max(1, Math.floor((r.y1 - r.y0) * c.height)),
        ).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3]! > 20 && !(d[i] === 20 && d[i + 1] === 20 && d[i + 2] === 20)) n++;
      }
      return n;
    },
    { x0, y0, x1, y1 },
  );
const SCORE = [0.01, 0.01, 0.45, 0.22] as const;
const LOGO = [0.8, 0.01, 0.99, 0.3] as const;

async function springe(page: Page, sek: number) {
  const video = page.getByTestId('video');
  await video.evaluate((v: HTMLVideoElement, z: number) => {
    v.currentTime = z;
  }, sek);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking)).toBe(false);
}
const standJetzt = async (page: Page) => {
  await page.getByRole('tab', { name: 'Setup' }).click();
  const txt = (await page.getByTestId('stand-jetzt').textContent()) ?? '';
  return /(\d+) : (\d+)/.exec(txt)!.slice(1, 3).join(':');
};
const springeClipZeit = async (page: Page, anteil: number) => {
  const b = (await page.getByTestId('programm-timeline').boundingBox())!;
  await page.mouse.click(b.x + b.width * anteil, b.y + 60);
};

test('Logo und Spielstand: Tor-Tags ändern den Stand, Schalter, Korrektur, Abschnitte, Titelfolie', async ({
  page,
}) => {
  await page.goto('./');
  const ok = page.getByRole('button', { name: 'Verstanden' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByTestId('datei-input').setInputFiles(VIDEO);
  const video = page.getByTestId('video');
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);

  // Logo (Platzhalter) und Spielstand sind sichtbar
  await expect.poll(() => pixel(page, ...LOGO)).toBeGreaterThan(50);
  await expect.poll(() => pixel(page, ...SCORE)).toBeGreaterThan(200);
  expect(await standJetzt(page)).toBe('0:0');

  // Tore: 3 s für Team 1, 8 s für Team 2
  for (const [sek, team] of [
    [3, '1'],
    [8, '2'],
  ] as const) {
    await springe(page, sek);
    await page.keyboard.press('g');
    await page.keyboard.press(team);
    await page.keyboard.press('Escape');
  }
  await springe(page, 2);
  expect(await standJetzt(page)).toBe('0:0');
  await springe(page, 4);
  expect(await standJetzt(page)).toBe('1:0');
  await springe(page, 9);
  expect(await standJetzt(page)).toBe('1:1');

  // Hotkeys L / S
  await page.getByRole('tab', { name: 'Clips' }).click();
  await page.keyboard.press('l');
  await expect.poll(() => pixel(page, ...LOGO)).toBe(0);
  expect(await pixel(page, ...SCORE)).toBeGreaterThan(0);
  await page.keyboard.press('s');
  await expect.poll(() => pixel(page, ...SCORE)).toBe(0);
  await page.keyboard.press('l');
  await page.keyboard.press('s');
  await expect.poll(() => pixel(page, ...LOGO)).toBeGreaterThan(50);
  await expect.poll(() => pixel(page, ...SCORE)).toBeGreaterThan(200);

  // Clip 2–10 s: Stand folgt der Quellzeit des jeweiligen Bildes
  await springe(page, 2);
  await page.keyboard.press('i');
  await springe(page, 10);
  await page.keyboard.press('o');
  await page.keyboard.press('Enter');
  await page.getByTestId('clip-zeichnen').last().click();
  await expect(page.getByTestId('clip-editor')).toBeVisible();
  await springeClipZeit(page, 0.1); // 2.8 s Quelle
  expect(await standJetzt(page)).toBe('0:0');
  await springeClipZeit(page, 0.3); // 4.4 s
  expect(await standJetzt(page)).toBe('1:0');
  await springeClipZeit(page, 0.9); // 9.2 s
  expect(await standJetzt(page)).toBe('1:1');

  // Spielstand in einem Abschnitt des Clips ausblenden (ab ca. 4.4 s für 1.5 s)
  await page.getByRole('tab', { name: 'Clips' }).click();
  await springeClipZeit(page, 0.3);
  await page.getByLabel('Dauer (s)').last().fill('1.5');
  await page.getByTestId('score-aus').click();
  await expect(page.getByTestId('overlay-balken-scoreboard')).toHaveCount(1);
  await springeClipZeit(page, 0.33);
  await expect.poll(() => pixel(page, ...SCORE)).toBe(0);
  expect(await pixel(page, ...LOGO)).toBeGreaterThan(50);
  await springeClipZeit(page, 0.7);
  await expect.poll(() => pixel(page, ...SCORE)).toBeGreaterThan(200);

  // Logo ausblenden für den Anfang
  await springeClipZeit(page, 0.0);
  await page.getByTestId('logo-aus').click();
  await springeClipZeit(page, 0.05);
  await expect.poll(() => pixel(page, ...LOGO)).toBe(0);
  await springeClipZeit(page, 0.7);
  await expect.poll(() => pixel(page, ...LOGO)).toBeGreaterThan(50);

  // Playlist: Clip + Titelfolie (ohne Logo): Titelfolie zeigt kein Scoreboard
  await page.getByRole('button', { name: 'Editor schliessen' }).click();
  await page.getByRole('button', { name: 'In Playlist' }).click();
  await page.getByTestId('titelfolie-neu').click();
  await page.getByTestId('titel-logo').uncheck();
  await page.getByLabel('Nach oben').nth(1).click();
  await page.getByRole('button', { name: 'Vorschau im Player' }).click();
  await expect(page.getByTestId('modus')).toContainText('Playlist');
  await expect.poll(() => pixel(page, 0.3, 0.4, 0.7, 0.6)).toBeGreaterThan(200); // Titelfolie
  expect(await nichtGrund(page, ...LOGO)).toBe(0); // Logo auf der Titelfolie ist aus
  expect(await nichtGrund(page, ...SCORE)).toBe(0); // Spielstand erscheint nie auf Titelfolien
  await page.getByRole('tab', { name: 'Playlist' }).click();
  await page.getByTestId('titel-logo').check();
  await expect.poll(() => nichtGrund(page, ...LOGO)).toBeGreaterThan(50);
  expect(await nichtGrund(page, ...SCORE)).toBe(0);

  // Korrektur: ab Position gilt 5 : 4
  await page.getByRole('button', { name: 'Zurück zur Quelle' }).click();
  await springe(page, 11);
  await page.getByRole('tab', { name: 'Setup' }).click();
  await page.getByLabel('Korrekturen BUL').fill('5');
  await page.getByLabel('Korrekturen GEG').fill('4');
  await page.getByTestId('korrektur-setzen').click();
  await expect(page.getByTestId('korrekturen')).toContainText('5 : 4');
  expect(await standJetzt(page)).toBe('5:4');
  await springe(page, 4);
  expect(await standJetzt(page)).toBe('1:0');
});
