import { expect, test } from '@playwright/test';

const routes = ['Home', 'Issuer search', 'Facts', 'Fundamental metrics', 'Insights', 'Price import', 'Data management'];

test('320 CSS px reflow and 200 percent text zoom avoid page-level horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });

  for (const route of routes) {
    await page.getByRole('button', { name: route }).click();
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }));
    expect(dimensions.scrollWidth, `${route} must not create two-dimensional page scrolling`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    expect(dimensions.bodyWidth, `${route} body must remain within the viewport`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  }
});

test('visible controls retain keyboard focus and minimum target height', async ({ page }) => {
  await page.goto('/');
  const controls = page.locator('button:visible, input:visible, select:visible, textarea:visible, a:visible');
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    const box = await control.boundingBox();
    if (box !== null) expect(box.height).toBeGreaterThanOrEqual(44);
  }

  const home = page.getByRole('button', { name: 'Home' });
  await home.focus();
  await expect(home).toHaveCSS('outline-style', 'solid');
});

test('reduced motion disables meaningful transitions and animation loops', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const timings = await page.getByRole('button', { name: 'Home' }).evaluate((element) => {
    const style = getComputedStyle(element);
    return { animationDuration: style.animationDuration, transitionDuration: style.transitionDuration };
  });
  expect(timings.animationDuration).toMatch(/(?:0s|0\.00001s|0\.01ms|1e-05s)/u);
  expect(timings.transitionDuration).toMatch(/(?:0s|0\.00001s|0\.01ms|1e-05s)/u);
});
