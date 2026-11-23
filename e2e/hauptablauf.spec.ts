import { expect, test } from '@playwright/test';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/test-vp9.webm');

test('Projekt anlegen, Video importieren, abspielen, neu laden', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Deine Spielanalysen' })).toBeVisible();
  // Hinweisdialog (Feature-Detection) schliessen, falls sichtbar
  const ok = page.getByRole('button', { name: 'Verstanden' });
  if (await ok.isVisible().catch(() => false)) await ok.click();

  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await expect(page.getByLabel('Projektname')).toBeVisible();

  await page.getByTestId('datei-input').setInputFiles(VIDEO);
  await expect(page.getByText('test-vp9.webm', { exact: true })).toBeVisible();
  await expect(page.getByText(/640×360/)).toBeVisible();
  // Vorschaubilder entstehen im Worker
  await expect(page.getByTestId('timeline').locator('img').first()).toBeVisible({ timeout: 15000 });

  const video = page.getByTestId('video');
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);

  // Bildweise vor
  await page.getByRole('button', { name: 'Ein Bild vor' }).click();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0.03);
  const t1 = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  await page.getByRole('button', { name: 'Ein Bild zurück' }).click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeLessThan(t1);

  // Leertaste: Abspielen und Pause
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press(' ');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
  await page.keyboard.press(' ');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);

  // +2 s Sprung
  await page.keyboard.press('Shift+ArrowRight');
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(1.9);

  // Undo/Redo der Umbenennung
  const name = page.getByLabel('Projektname');
  await name.fill('Spiel gegen Test');
  await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible({
    timeout: 5000,
  });
  await page.reload();
  await expect(page.getByLabel('Projektname')).toHaveValue('Spiel gegen Test');
  // Quelle ist noch im Projekt; Datei muss (ohne Handle in Playwright) neu verknüpft werden
  await expect(page.getByTestId('quellen-banner')).toContainText('test-vp9.webm');
  await expect(
    page.getByRole('region', { name: 'Quellen' }).getByText('test-vp9.webm', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Datei erneut auswählen' })).toBeVisible();
});

test('Projektliste: umbenennen, duplizieren, löschen', async ({ page }) => {
  await page.goto('./');
  const ok = page.getByRole('button', { name: 'Verstanden' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByRole('link', { name: 'Projekte' }).click();
  await expect(page.getByRole('heading', { name: 'Deine Spielanalysen' })).toBeVisible();
  page.on('dialog', (d) => void (d.type() === 'prompt' ? d.accept('Umbenannt') : d.accept()));
  await page.getByRole('button', { name: 'Umbenennen' }).first().click();
  await expect(page.getByRole('button', { name: 'Umbenannt', exact: true }).first()).toBeVisible();
  const vorher = await page.getByRole('button', { name: 'Duplizieren' }).count();
  await page.getByRole('button', { name: 'Duplizieren' }).first().click();
  await expect(page.getByRole('button', { name: 'Duplizieren' })).toHaveCount(vorher + 1);
  await page.getByRole('button', { name: 'Löschen' }).first().click();
  await expect(page.getByRole('button', { name: 'Duplizieren' })).toHaveCount(vorher);
});
