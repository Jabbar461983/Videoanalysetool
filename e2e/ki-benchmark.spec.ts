import { expect, test } from '@playwright/test';

/**
 * Modellvergleich (lädt die KI-Modelle aus dem Netz, daher nur mit gesetzter Umgebungsvariablen):
 *   BM_BILD=/pfad/standbild.jpg BM_X=510 BM_Y=220 npx playwright test e2e/ki-benchmark.spec.ts
 */
test.setTimeout(900_000);

test('Benchmark: alle Modelle liefern eine Maske', async ({ page }) => {
  test.skip(!process.env.BM_BILD, 'BM_BILD nicht gesetzt');
  await page.goto('#/benchmark');
  await page.getByTestId('bm-bild').setInputFiles(process.env.BM_BILD!);
  const c = page.getByTestId('bm-canvas');
  await expect(c).toBeVisible();
  const box = (await c.boundingBox())!;
  const dim = await c.evaluate((el: HTMLCanvasElement) => [el.width, el.height]);
  const x = Number(process.env.BM_X ?? 0.5 * dim[0]!);
  const y = Number(process.env.BM_Y ?? 0.5 * dim[1]!);
  await page.mouse.click(box.x + (x / dim[0]!) * box.width, box.y + (y / dim[1]!) * box.height);
  if (process.env.BM_GERAET) await page.locator('select').selectOption(process.env.BM_GERAET);
  await page.getByTestId('bm-start').click();
  await expect(page.getByTestId('bm-tabelle').locator('tbody tr')).toHaveCount(3, {
    timeout: 800_000,
  });
  const text = await page.getByTestId('bm-tabelle').innerText();
  console.log('BENCHMARK\n' + text);
  await page
    .getByTestId('bm-tabelle')
    .screenshot({ path: process.env.BM_OUT ?? 'test-results/benchmark.png' });
});

/**
 * Tracking-Test mit Panorama-Video (Spieler wandert bei bekannter Geschwindigkeit durchs Bild):
 *   BM_VIDEO=/pfad/video.webm BM_T="0,512,270,215,430,4" npx playwright test e2e/ki-benchmark.spec.ts -g Tracking
 * BM_T = zeit,cx,cy,b,h,dauer (Pixel des Videobilds); BM_DX = erwartete Verschiebung in x pro Sekunde.
 */
test('Tracking: folgt dem Spieler über das Panorama-Video', async ({ page }) => {
  test.skip(!process.env.BM_VIDEO, 'BM_VIDEO nicht gesetzt');
  await page.goto('#/benchmark');
  const [zeit, cx, cy, b, h, dauer] = (process.env.BM_T ?? '0,512,270,215,430,4')
    .split(',')
    .map(Number);
  await page.getByTestId('bm-t-datei').setInputFiles(process.env.BM_VIDEO!);
  for (const [k, v] of Object.entries({ zeit, cx, cy, b, h, dauer }))
    await page.getByTestId(`bm-t-${k}`).fill(String(v));
  await page.getByTestId('bm-t-start').click();
  page.on('console', (m) => console.log('PAGE', m.type(), m.text().slice(0, 300)));
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const wach = setInterval(() => {
    void page
      .getByTestId('bm-t-status')
      .innerText()
      .then((x) => console.log('STATUS', x))
      .catch(() => undefined);
  }, 15_000);
  await expect(page.getByTestId('bm-t-status')).toContainText(/Fertig|Fehler/, {
    timeout: 840_000,
  });
  clearInterval(wach);
  console.log('TRACK ' + (await page.getByTestId('bm-t-status').innerText()));
  const punkte = JSON.parse(await page.getByTestId('bm-t-json').innerText()) as [
    number,
    number,
    number,
    string,
  ][];
  console.log('TRACKJSON ' + JSON.stringify(punkte.filter((_, i) => i % 6 === 0)));
  const dx = Number(process.env.BM_DX ?? -30);
  const abw = punkte.map(([t, x]) => Math.abs(x - (cx! + dx * (t - zeit!))));
  console.log(
    'ABWEICHUNG max ' +
      Math.max(...abw).toFixed(1) +
      ' mittel ' +
      (abw.reduce((a, c) => a + c, 0) / abw.length).toFixed(1),
  );
});
