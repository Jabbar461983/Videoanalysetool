import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/test-vp9.webm');

async function start(page: Page) {
  await page.goto('./');
  const ok = page.getByRole('button', { name: 'Verstanden' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByTestId('datei-input').setInputFiles(VIDEO);
  const video = page.getByTestId('video');
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);
  return video;
}

const dauerAus = async (page: Page): Promise<number> => {
  const txt = (await page.getByTestId('clip-editor').textContent()) ?? '';
  const m = /Gesamtdauer des Clips: ([\d.]+) s/.exec(txt);
  return Number(m?.[1]);
};

test('Clip schneiden, trimmen, Standbild/Zeitlupe, Playlist mit Titelfolie abspielen', async ({
  page,
}) => {
  const video = await start(page);
  await page.getByRole('tab', { name: 'Clips' }).click();

  // I / O / Enter
  await video.evaluate((v: HTMLVideoElement) => {
    v.currentTime = 2;
  });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking)).toBe(false);
  await page.keyboard.press('i');
  await expect(page.getByTestId('in-marke')).toBeVisible();
  await video.evaluate((v: HTMLVideoElement) => {
    v.currentTime = 6;
  });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking)).toBe(false);
  await page.keyboard.press('o');
  await expect(page.getByTestId('out-marke')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('clipliste').locator('li')).toHaveCount(1);
  await expect(page.getByTestId('clipliste')).toContainText('Dauer 4.0 s');

  // Trimmen per Tastatur: Position setzen, Shift+O
  await video.evaluate((v: HTMLVideoElement) => {
    v.currentTime = 5;
  });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking)).toBe(false);
  await page.keyboard.press('Shift+O');
  await expect(page.getByTestId('clipliste')).toContainText('Dauer 3.0 s');

  // Trimmen per Ziehen des Griffs (Ende nach links)
  const griff = page.getByTestId('griff-out');
  await expect(griff).toBeVisible();
  const box = (await griff.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 60, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  const txt = (await page.getByTestId('clipliste').textContent()) ?? '';
  const d = Number(/Dauer ([\d.]+) s/.exec(txt)?.[1]);
  expect(d).toBeLessThan(3);
  expect(d).toBeGreaterThanOrEqual(0.5);

  // Clip-Editor
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await expect(page.getByTestId('clip-editor')).toBeVisible();
  await expect(page.getByTestId('modus')).toContainText('Clip');
  const vorher = await dauerAus(page);
  expect(vorher).toBeCloseTo(d, 1);

  // Standbild in der Mitte der Zeitleiste einfügen
  const tl = page.getByTestId('programm-timeline');
  const tb = (await tl.boundingBox())!;
  await page.mouse.click(tb.x + tb.width / 2, tb.y + 60);
  await page.getByTestId('standbild-einfuegen').click();
  await expect(page.getByTestId('seg-freeze')).toHaveCount(1);
  const mitFreeze = await dauerAus(page);
  expect(mitFreeze).toBeCloseTo(vorher + 3, 1);

  // Zeitlupe 0.5× über 0.4 s am Anfang
  await page.mouse.click(tb.x + 4, tb.y + 60);
  await page.getByLabel('Länge im Original (s)').fill('0.4');
  await page.getByTestId('zeitlupe-einfuegen').click();
  const mitZeitlupe = await dauerAus(page);
  expect(mitZeitlupe).toBeCloseTo(mitFreeze + 0.4, 1);

  // Clip abspielen: läuft durch Standbild und endet
  await page.getByTestId('play').click();
  await expect(page.getByTestId('zeit')).toContainText(/00:0[0-9]:/);
  await expect
    .poll(async () => (await page.getByTestId('play').getAttribute('aria-label')) ?? '', {
      timeout: 30000,
    })
    .toBe('Abspielen');
  await page.getByRole('button', { name: 'Editor schliessen' }).click();
  await expect(page.getByTestId('modus')).toBeHidden();

  // Zweiten Clip aus dem ersten duplizieren und beide in die Playlist
  await page.getByRole('button', { name: 'Duplizieren' }).click();
  await expect(page.getByTestId('clipliste').locator('li')).toHaveCount(2);
  await page.getByRole('button', { name: 'In Playlist' }).click();
  await expect(page.getByTestId('playlist-eintrag')).toHaveCount(1);

  // Titelfolie, nach oben schieben
  await page.getByTestId('titelfolie-neu').click();
  await page.getByLabel('Titel', { exact: true }).fill('Analyse 1. Drittel');
  await page.getByLabel('Nach oben').nth(1).click();
  await expect(page.getByTestId('playlist-eintrag').first()).toContainText('Analyse 1. Drittel');
  // Übergang des Clips (Eintrag 2): Blende
  await page.getByTestId('playlist-eintrag').nth(1).getByRole('button').first().click();
  await page.getByLabel('Übergang 2').selectOption('blende');

  // Playlist abspielen: Titelfolie erscheint auf dem Canvas, danach der Clip, am Ende steht der Player
  await page.getByTestId('playlist-abspielen').click();
  await expect(page.getByTestId('modus')).toContainText('Playlist');
  await expect
    .poll(
      () =>
        page.getByTestId('overlay').evaluate((c: HTMLCanvasElement) => {
          const px = c.getContext('2d')!.getImageData(5, 5, 1, 1).data;
          return px[3] === 255 && px[0] === 0x14;
        }),
      { timeout: 5000 },
    )
    .toBe(true);
  await expect
    .poll(async () => (await page.getByTestId('play').getAttribute('aria-label')) ?? '', {
      timeout: 40000,
    })
    .toBe('Abspielen');
  await expect(page.getByTestId('zeit')).toContainText(/ \/ /);

  // Neuladen: Clips und Playlist bleiben
  await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible({
    timeout: 5000,
  });
  await page.reload();
  await page.getByRole('tab', { name: 'Playlist' }).click();
  await expect(page.getByTestId('playlist-eintrag')).toHaveCount(2);
});
