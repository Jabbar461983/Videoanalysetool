import { expect, test } from '@playwright/test';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/test-vp9.webm');

test('Feste Ansicht (schmaler Bildschirm): alle Spuren sichtbar, Video gross genug, Zeitleistenhöhe verstellbar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 800 });
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
  expect(await unten('tagspur')).toBeLessThanOrEqual(800);
  expect(await unten('clipspur')).toBeLessThanOrEqual(800);
  // Videobühne ist mindestens 250 px hoch
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

async function projektOeffnen(page: import('@playwright/test').Page) {
  await page.addInitScript(() => localStorage.setItem('bdva-test', '1'));
  await page.goto('./');
  const ok = page.getByRole('button', { name: 'Verstanden' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByTestId('datei-input').setInputFiles(VIDEO);
  await expect(page.getByTestId('video')).toBeVisible();
}

test('Freies Layout: Standardansicht, Grösse ändern, merken, zurücksetzen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await projektOeffnen(page);
  const unten = async (id: string) => {
    const b = (await page.getByTestId(id).boundingBox())!;
    return b.y + b.height;
  };
  // Standard: Spuren sichtbar, Video nutzbar gross, alle Register vorhanden
  expect(await unten('tagspur')).toBeLessThanOrEqual(720);
  expect(await unten('clipspur')).toBeLessThanOrEqual(720);
  expect((await page.getByTestId('video').boundingBox())!.height).toBeGreaterThan(170);
  for (const n of ['Quellen', 'Tags', 'Clips', 'Playlist', 'Taktik', 'Setup', 'Export'])
    await expect(page.getByRole('tab', { name: n, exact: true })).toHaveCount(1);

  // Register wechseln wie bisher
  await page.getByRole('tab', { name: 'Playlist', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Playlist', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByTestId('titelfolie-neu')).toBeVisible();

  // Zeitleiste per Ziehen am Trennbalken vergrössern
  const hoehe = () =>
    page.evaluate(() => {
      const api = (
        window as unknown as { __bdvaLayout: { getPanel(id: string): { api: { height: number } } } }
      ).__bdvaLayout;
      return api.getPanel('zeit').api.height;
    });
  const h0 = await hoehe();
  const kopf = (await page.getByRole('tab', { name: 'Zeitleiste', exact: true }).boundingBox())!;
  await page.mouse.move(640, kopf.y - 2);
  await page.mouse.down();
  await page.mouse.move(640, kopf.y - 92, { steps: 6 });
  await page.mouse.up();
  expect(await hoehe()).toBeGreaterThan(h0 + 60);

  // Nach dem Neuladen gleiches Layout
  await page.waitForTimeout(900); // Speichern ist entprellt, Layout hat sich gesetzt
  const h1 = await hoehe();
  await page.reload();
  await page.waitForFunction(
    () => !!(window as unknown as { __bdvaLayout?: unknown }).__bdvaLayout,
  );
  await expect.poll(async () => Math.abs((await hoehe()) - h1), { timeout: 5000 }).toBeLessThan(6);

  // Zurücksetzen
  await page.getByTestId('layout-reset').click();
  await expect.poll(async () => Math.abs((await hoehe()) - h0)).toBeLessThan(6);
});

test('Freies Layout: Modul per Ziehen in andere Position (Register trennen)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await projektOeffnen(page);
  // «Export» aus der Registergruppe lösen und unter das Video legen (per API, wie es das Ziehen bewirkt)
  await page.evaluate(() => {
    const api = (
      window as unknown as {
        __bdvaLayout: {
          getPanel(id: string): { api: { moveTo(o: unknown): void } };
          addGroup(o: unknown): unknown;
        };
      }
    ).__bdvaLayout;
    const g = api.addGroup({ direction: 'below', referencePanel: 'buehne' });
    api.getPanel('export').api.moveTo({ group: g, position: 'center' });
  });
  const gruppeVonExport = await page.evaluate(
    () =>
      (
        window as unknown as { __bdvaLayout: { getPanel(id: string): { group: { id: string } } } }
      ).__bdvaLayout.getPanel('export').group.id,
  );
  const gruppeVonQuellen = await page.evaluate(
    () =>
      (
        window as unknown as { __bdvaLayout: { getPanel(id: string): { group: { id: string } } } }
      ).__bdvaLayout.getPanel('quellen').group.id,
  );
  expect(gruppeVonExport).not.toBe(gruppeVonQuellen);
  // Das Modul funktioniert an der neuen Stelle
  await page.getByRole('tab', { name: 'Export', exact: true }).click();
  await expect(page.getByTestId('export-panel')).toBeVisible();
});
