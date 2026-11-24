import { expect, test } from '@playwright/test';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/test-vp9.webm');

test('Playlist automatisch füllen: Tore + Fehler gruppiert mit Titelfolien, anhängen, Playlist im Export wählbar', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('./');
  const ok = page.getByRole('button', { name: 'Verstanden' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByTestId('datei-input').setInputFiles(VIDEO);
  const video = page.getByTestId('video');
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);

  // Zwei Tore und ein Fehler taggen (Hotkeys g = Tor, f = Fehler)
  await page.getByRole('tab', { name: 'Tags' }).click();
  for (const [taste, zeit] of [
    ['g', 1],
    ['g', 2],
    ['f', 3],
  ] as const) {
    await video.evaluate((v: HTMLVideoElement, z) => (v.currentTime = z), zeit);
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking)).toBe(false);
    await page.keyboard.press(taste);
    await page.keyboard.press('Escape');
  }
  await expect(page.getByTestId('tagmarke')).toHaveCount(3);

  // Dialog: Schnellauswahl «Alle Tore» → 2 Szenen, neue Playlist
  await page.getByRole('tab', { name: 'Playlist' }).click();
  await page.getByTestId('auto-fuellen').click();
  await expect(page.getByTestId('auto-dialog')).toBeVisible();
  await expect(page.getByTestId('auto-zusammenfassung')).toContainText('3 Szenen');
  await page.getByTestId('vorlage-tore').click();
  await expect(page.getByTestId('auto-zusammenfassung')).toContainText('2 Szenen');
  await expect(page.getByTestId('auto-neu')).toContainText('2 Szenen und 1 Titelfolie');
  await expect(page.getByTestId('auto-name')).toHaveValue('Tor');
  await page.getByTestId('auto-uebernehmen').click();
  await expect(page.getByTestId('auto-dialog')).toBeHidden();
  await expect(page.getByTestId('playlist-eintrag')).toHaveCount(3);

  // Zweiter Durchgang: alle Szenen an dieselbe Playlist anhängen → nur der Fehler ist neu
  await page.getByTestId('auto-fuellen').click();
  const ziel = page.getByTestId('auto-ziel');
  await ziel.selectOption({ index: 1 });
  await expect(page.getByTestId('auto-neu')).toContainText('1 Szene und 1 Titelfolie');
  await page.getByTestId('auto-uebernehmen').click();
  await expect(page.getByTestId('playlist-eintrag')).toHaveCount(5);

  // Export-Reiter: Playlist wählbar
  await page.getByRole('tab', { name: 'Export' }).click();
  await expect(page.getByTestId('export-playlist-wahl')).toBeVisible();
});
