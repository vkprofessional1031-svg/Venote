const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('HANDLER') || text.includes('CREATING AS QUICK NOTE') || text.includes('SWITCHING TO QUICK TAB') || text.includes('ORGANIZE')) {
      console.log('BROWSER LOG:', text);
    }
  });

  try {
    // Go directly to /app because we mocked auth
    await page.goto('http://localhost:3000/app', { waitUntil: 'networkidle0' });
    console.log('Loaded /app');

    // Make sure we are on Organized tab
    const currentTab = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const orgTab = tabs.find(b => b.innerText.trim() === 'Organized');
      if (orgTab) orgTab.click();
      return orgTab ? orgTab.innerText : 'Unknown';
    });
    console.log('Current tab:', currentTab);

    // Type in input
    await page.waitForSelector('input[placeholder*="brain dump"]');
    await page.type('input[placeholder*="brain dump"]', 'test note please organize');

    // Click Organize
    console.log('Clicking Organize button');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const organizeBtn = buttons.find(b => b.innerText.includes('Organize') && !b.disabled);
      if (organizeBtn) organizeBtn.click();
    });

    // Wait a bit for the logs to appear
    await new Promise(r => setTimeout(r, 4000));
    
  } catch (err) {
    console.error('Test script error:', err);
  } finally {
    await browser.close();
  }
})();
