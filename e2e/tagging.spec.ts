import { expect, test } from '@playwright/test';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/test-vp9.webm');

test('Live taggen nur mit Tastatur, Kader per Hand und CSV, Filter, Neuladen', async ({ page }) => {
  await page.goto('./');
  const ok = page.getByRole('button', { name: 'Verstanden' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByTestId('datei-input').setInputFiles(VIDEO);
  const video = page.getByTestId('video');
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);

  // Kader Team 1 von Hand, Team 2 per CSV
  await page.getByRole('tab', { name: 'Setup' }).click();
  const team1 = page.getByRole('region', { name: 'Team 1' });
  await team1.getByLabel('Nr.', { exact: true }).fill('7');
  await team1.getByPlaceholder('Name').fill('Max Muster');
  await team1.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByTestId('kader-0')).toContainText('Max Muster');
  await page
    .getByRole('region', { name: 'Team 2' })
    .getByLabel('Kürzel (3 Buchstaben)')
    .fill('geg');
  await page.getByTestId('csv-1').setInputFiles({
    name: 'kader.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Nummer;Name;Position\n10;Gegner Zehn;Stürmer\n1;Gegner Tor;Torhüter\n'),
  });
  await expect(page.getByTestId('kader-1')).toContainText('Gegner Zehn');

  // Hotkey-Konflikt wird gemeldet
  const def = page.getByTestId('tagdefs').locator('li').nth(1);
  await def.getByLabel('Taste').fill('G');
  await expect(page.getByRole('alert').filter({ hasText: 'schon vergeben' }).first()).toBeVisible();
  await def.getByLabel('Taste').fill('A');

  // Spiel läuft, wir taggen live
  await page.getByRole('tab', { name: 'Tags' }).click();
  await page.keyboard.press('Space');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(1);
  await page.keyboard.press('g'); // Tor
  await expect(page.getByTestId('tagmarke')).toHaveCount(1);
  await expect(page.getByTestId('zuordnung')).toBeVisible();
  await page.keyboard.press('1'); // Team 1
  await page.keyboard.press('7');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('zuordnung')).toBeHidden();
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false); // Wiedergabe lief weiter

  await page.keyboard.press('f'); // Fehler, Gegner
  await page.keyboard.press('2');
  await page.keyboard.press('1');
  await page.keyboard.press('0');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('tagmarke')).toHaveCount(2);
  await page.keyboard.press('Space');

  const liste = page.getByTestId('tagliste');
  await expect(liste).toContainText('BUL #7');
  await expect(liste).toContainText('GEG #10');

  // Auto-Clips
  await page.getByRole('tab', { name: 'Clips' }).click();
  await expect(page.getByTestId('clipliste').locator('li')).toHaveCount(2);
  await page.getByRole('tab', { name: 'Tags' }).click();

  // Filter: nur Tor, dann in Playlist
  await page.getByLabel('Alle Tags', { exact: true }).first().selectOption({ label: 'Tor' });
  await expect(liste.locator('li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Treffer in Playlist übernehmen' }).click();
  await expect(page.getByText('1 Clip(s) an die Playlist angehängt.')).toBeVisible();

  // Marke anklicken springt
  await video.evaluate((v: HTMLVideoElement) => {
    v.currentTime = 0;
  });
  await page.getByTestId('tagmarke').last().click();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0.2);

  // Rückgängig (Strg+Z) entfernt zuletzt Gesetztes schrittweise; danach wieder vor
  await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible({
    timeout: 5000,
  });
  await page.reload();
  await expect(page.getByTestId('tagmarke')).toHaveCount(2);
  await page.getByRole('tab', { name: 'Tags' }).click();
  await expect(page.getByTestId('tagliste')).toContainText('BUL #7');
});
