const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set viewport for desktop
  await page.setViewport({ width: 1280, height: 800 });
  
  // 1. Navigate to the app (we need to be logged in, so we might need to login first)
  // Or since I can't easily login via script without credentials, maybe the user has an active session in their local browser.
  // Actually, wait, let's see if the test-insert.js has login details. Yes: vishalkishorekumar@gmail.com / password123
  
  await page.goto('http://localhost:3000/login');
  
  try {
    await page.waitForSelector('input[type="email"]', { timeout: 3000 });
    await page.type('input[type="email"]', 'vishalkishorekumar@gmail.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
  } catch (e) {
    console.log('Login skip or failed:', e.message);
  }

  await page.goto('http://localhost:3000/app');
  
  try {
    // Wait for the New note button (it has text "New note")
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('New note'));
    }, { timeout: 5000 });

    console.log('New note button found!');
    
    // Click it
    const newNoteBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('New note'));
    });
    
    await newNoteBtn.click();
    console.log('Clicked New Note button');
    
    // Wait for NoteView to appear (title input)
    await page.waitForSelector('input[placeholder="Note title..."]', { timeout: 5000 });
    console.log('Blank note opened successfully');
    
    // Type in it
    await page.type('input[placeholder="Note title..."]', 'Puppeteer Test Note');
    
    // Check if Saving... indicator appears (it has text 'Saving...')
    const savingFound = await page.evaluate(() => {
      return document.body.innerText.includes('Saving...');
    });
    console.log('Autosave "Saving..." indicator triggered:', savingFound);
    
    // Test Organize flow form submission
    const organizeInput = await page.$('input[placeholder*="Paste a brain dump"]');
    if (organizeInput) {
      console.log('Found organize input');
      // Just check that it has type="text" and inside a form
      const isInsideForm = await page.evaluate((el) => !!el.closest('form'), organizeInput);
      console.log('Organize input is inside form:', isInsideForm);
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();
