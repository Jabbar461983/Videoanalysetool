import { expect, test } from '@playwright/test';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/test-vp9.webm');

test('Layout: alle Spuren sichtbar, Video gross genug, Zeitleistenhöhe verstellbar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('./');
  const ok = page.getByRole('button', { name: 'Verstanden' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByTestId('datei-input').setInputFiles(VIDEO);
  await expect(page.getByTestId('video')).toBeVisible();

  const unten = async (id: string) => {
    const b = (await page.getByTestId(id).boundingBox())!;
    return b.y + b.height;
  };
  // Tag- und Clip-Spur liegen vollständig im sichtbaren Bereich
  expect(await unten('tagspur')).toBeLessThanOrEqual(720);
  expect(await unten('clipspur')).toBeLessThanOrEqual(720);
  // Videobühne ist auf 720p mindestens 250 px hoch
  const video = (await page.getByTestId('video').boundingBox())!;
  expect(video.height).toBeGreaterThan(250);

  // Zeitleiste vergrössern per Ziehen; Doppelklick stellt zurück
  const teiler = page.getByTestId('zeit-teiler');
  const hoehe = async () =>
    await teiler.evaluate((el) => el.parentElement!.getBoundingClientRect().height);
  const h0 = await hoehe();
  const t = (await teiler.boundingBox())!;
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2 - 70, { steps: 5 });
  await page.mouse.up();
  expect(await hoehe()).toBeGreaterThan(h0 + 50);
  // bleibt nach dem Neuladen
  await page.reload();
  expect(
    await page
      .getByTestId('zeit-teiler')
      .evaluate((el) => el.parentElement!.getBoundingClientRect().height),
  ).toBeGreaterThan(h0 + 50);
  await page.getByTestId('zeit-teiler').dblclick();
  expect(await hoehe()).toBeCloseTo(h0, -1);
  // Tastatur
  await teiler.focus();
  await page.keyboard.press('ArrowUp');
  expect(await hoehe()).toBeGreaterThan(h0 + 20);
});
