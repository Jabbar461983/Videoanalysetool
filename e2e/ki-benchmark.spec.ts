import { expect, test } from '@playwright/test';

/**
 * Modellvergleich (lädt die KI-Modelle aus dem Netz, daher nur mit gesetzter Umgebungsvariablen):
 *   BM_BILD=/pfad/standbild.jpg BM_X=510 BM_Y=220 npx playwright test e2e/ki-benchmark.spec.ts
 */
test.skip(!process.env.BM_BILD, 'BM_BILD nicht gesetzt');
test.setTimeout(900_000);

test('Benchmark: alle Modelle liefern eine Maske', async ({ page }) => {
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
