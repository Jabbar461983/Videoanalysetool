import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/test-vp9.webm');
const DATEN = fs.readFileSync(VIDEO);

async function neuesProjekt(page: Page) {
  await page.addInitScript(() => localStorage.setItem('bdva-test', '1'));
  await page.goto('./');
  const ok = page.getByRole('button', { name: 'Verstanden' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await expect(page.getByTestId('link-import')).toBeVisible();
}

test('YouTube-Link: Anleitung statt Download', async ({ page }) => {
  await neuesProjekt(page);
  await page
    .getByTestId('link-eingabe')
    .fill('https://www.youtube.com/live/O-9KUZ-XcPg?is=dKPWX91BX3oRlEeG');
  await page.getByTestId('link-laden').click();
  await expect(page.getByTestId('link-youtube')).toContainText('YouTube Studio');
  await expect(page.getByTestId('link-youtube')).toContainText('Herunterladen');
  // Es wurde nichts geladen
  await expect(page.getByTestId('link-fortschritt')).toHaveCount(0);
});

test('Direkter Videolink wird geladen und als Quelle hinzugefügt', async ({ page }) => {
  await neuesProjekt(page);
  await page.route('https://videos.verein.test/spiele/halbzeit-1.webm', (route) =>
    route.fulfill({
      status: 200,
      body: DATEN,
      headers: {
        'content-type': 'video/webm',
        'content-length': String(DATEN.length),
        'access-control-allow-origin': '*',
      },
    }),
  );
  await page.getByTestId('link-eingabe').fill('https://videos.verein.test/spiele/halbzeit-1.webm');
  await page.getByTestId('link-laden').click();
  await expect(page.getByText('halbzeit-1.webm').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('640×360').first()).toBeVisible();
  const video = page.getByTestId('video');
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(2);
});

test('Link-Fehler werden verständlich gemeldet (kein CORS, Webseite statt Video, nur http)', async ({
  page,
}) => {
  await neuesProjekt(page);
  // Server nicht erreichbar bzw. ohne CORS-Erlaubnis: Der Browser meldet in beiden Fällen nur einen Netzfehler
  await page.route('https://ohne-cors.test/v.mp4', (route) => route.abort('failed'));
  await page.getByTestId('link-eingabe').fill('https://ohne-cors.test/v.mp4');
  await page.getByTestId('link-laden').click();
  await expect(page.getByTestId('link-fehler')).toContainText('CORS');
  // Webseite statt Video
  await page.route('https://seite.test/film', (route) =>
    route.fulfill({
      status: 200,
      body: '<html></html>',
      headers: { 'content-type': 'text/html', 'access-control-allow-origin': '*' },
    }),
  );
  await page.getByTestId('link-eingabe').fill('https://seite.test/film');
  await page.getByTestId('link-laden').click();
  await expect(page.getByTestId('link-fehler')).toContainText('nicht zu einer Videodatei');
  // http
  await page.getByTestId('link-eingabe').fill('http://unsicher.test/v.mp4');
  await page.getByTestId('link-laden').click();
  await expect(page.getByTestId('link-fehler')).toContainText('https://');
});

test('Aus Ordner importieren: Ordner wählen, Video auswählen, hinzufügen', async ({ page }) => {
  await neuesProjekt(page);
  await page.route('**/__fixture.webm', (route) =>
    route.fulfill({ status: 200, body: DATEN, headers: { 'content-type': 'video/webm' } }),
  );
  // Testordner im Browserspeicher anlegen (der echte Ordnerdialog des Betriebssystems ist nicht automatisierbar)
  await page.evaluate(async () => {
    const bytes = await (await fetch('/Videoanalysetool/__fixture.webm')).arrayBuffer();
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('testordner', { create: true });
    const w = await (
      await dir.getFileHandle('Spiel Kernenried.webm', { create: true })
    ).createWritable();
    await w.write(bytes);
    await w.close();
    await (
      await dir.getFileHandle('notizen.txt', { create: true })
    )
      .createWritable()
      .then(async (x) => {
        await x.write('kein Video');
        await x.close();
      });
    (window as unknown as { __bdvaTestOrdner: FileSystemDirectoryHandle }).__bdvaTestOrdner = dir;
  });
  // Quellen-Reiter neu aufbauen, damit die Schaltfläche erscheint
  await page.getByRole('tab', { name: 'Tags' }).click();
  await page.getByRole('tab', { name: 'Quellen' }).click();
  await page.getByTestId('ordner-oeffnen').click();
  await page.getByTestId('ordner-waehlen').click();
  await expect(page.getByTestId('ordner-liste').locator('li')).toHaveCount(1); // nur das Video, nicht die Textdatei
  await expect(page.getByTestId('ordner-liste')).toContainText('Spiel Kernenried.webm');
  await expect(page.getByTestId('ordner-video')).toBeChecked();
  await page.getByTestId('ordner-hinzufuegen').click();
  await expect(page.getByTestId('ordner-dialog')).toBeHidden();
  await expect(page.getByText('Spiel Kernenried.webm').first()).toBeVisible();
  await expect(page.getByText('640×360').first()).toBeVisible();
});
