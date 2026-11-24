import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import { unzipSync } from 'fflate';
import os from 'node:os';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/test-vp9.webm');

test('Projektdatei: exportieren, importieren, fehlendes Video wird angefordert und zugeordnet', async ({
  page,
}) => {
  await page.goto('./');
  const ok = page.getByRole('button', { name: 'Verstanden' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByLabel('Projektname').fill('Spiel U12 gegen Horgenberg');
  await page.getByTestId('datei-input').setInputFiles(VIDEO);
  const video = page.getByTestId('video');
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);
  await video.evaluate((v: HTMLVideoElement) => {
    v.currentTime = 3;
  });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking)).toBe(false);
  await page.getByLabel('Projektname').blur(); // Tasten sollen nicht ins Namensfeld gehen
  await page.keyboard.press('g'); // Tor-Tag mit Auto-Clip
  await expect(page.getByTestId('tagmarke')).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible({
    timeout: 5000,
  });

  // Exportieren
  await page.getByRole('tab', { name: 'Export' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('bdva-export').click(),
  ]);
  expect(download.suggestedFilename()).toBe('Spiel U12 gegen Horgenberg.bdva');
  const datei = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'bdva-')),
    download.suggestedFilename(),
  );
  await download.saveAs(datei);
  const kopf = fs.readFileSync(datei).subarray(0, 2).toString('latin1');
  expect(kopf).toBe('PK'); // ZIP
  // ohne Quellvideo: im Archiv liegt keine Videodatei (Projekt, Aufnahmen und Logo sind drin)
  const eintraege = Object.keys(unzipSync(new Uint8Array(fs.readFileSync(datei))));
  expect(eintraege).toContain('projekt.json');
  expect(eintraege.some((n) => /\.(webm|mp4|mov|mkv|m4v)$/i.test(n))).toBe(false);

  // Importieren (Startseite): gleiche Id existiert → Kopie
  await page.getByRole('link', { name: 'Projekte' }).click();
  await page.getByTestId('bdva-import-input').setInputFiles(datei);
  await expect(page.getByTestId('import-info')).toContainText(
    'Spiel U12 gegen Horgenberg (importiert)',
  );
  await page
    .getByRole('button', { name: 'Spiel U12 gegen Horgenberg (importiert)', exact: true })
    .click();
  await expect(page.getByLabel('Projektname')).toHaveValue(
    'Spiel U12 gegen Horgenberg (importiert)',
  );

  // Neue Sitzung: Videodateien liegen nur im Arbeitsspeicher und gehen beim Neuladen verloren
  await page.reload();

  // Tag und Clip sind da, das Video fehlt → Banner
  await expect(page.getByTestId('tagmarke')).toHaveCount(1);
  await expect(page.getByTestId('quellen-banner')).toContainText('Eine Videodatei fehlt');
  await expect(page.getByTestId('quellen-banner')).toContainText('test-vp9.webm');

  // Zuordnen über die Dateiauswahl im Reiter «Quellen» (gleiche Datei → gleiche Quelle)
  await page.getByTestId('datei-input').setInputFiles(VIDEO);
  await expect(page.getByTestId('quellen-banner')).toBeHidden();
  await expect
    .poll(() => page.getByTestId('video').evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);

  // Beschädigte Datei: verständliche Meldung
  await page.getByRole('link', { name: 'Projekte' }).click();
  const kaputt = path.join(os.tmpdir(), 'kaputt.bdva');
  fs.writeFileSync(kaputt, 'das ist kein zip');
  await page.getByTestId('bdva-import-input').setInputFiles(kaputt);
  await expect(page.getByRole('alert')).toContainText('keine gültige Projektdatei');
});
