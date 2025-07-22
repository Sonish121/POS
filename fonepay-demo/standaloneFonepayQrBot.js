// standaloneFonepayQrBot.js
// Usage: node standaloneFonepayQrBot.js <username> <password> <amount>
const fs = require('fs');
const { chromium } = require('playwright');
const axios = require('axios');

async function getFonepayQR(username, password, amount) {
  const browser = await chromium.launch({ headless: false }); // Set to false for debugging
  const page = await browser.newPage();
  try {
    await page.goto('https://login.fonepay.com/#/login', { waitUntil: 'networkidle' });
    console.log('Filling username...');
    await page.fill('input[placeholder="Username or email"]', username);
    console.log('Filling password...');
    await page.fill('input[placeholder="Password"]', password);

    // Add a short delay to ensure password is fully typed
    await page.waitForTimeout(500);

    const signInBtnSelector = 'button[type="submit"]';
    console.log('Trying to click sign in...');

    let signInClicked = false;
    try {
      await page.waitForSelector(`${signInBtnSelector}:not([disabled])`, { timeout: 1000 });
      await page.click(`${signInBtnSelector}:not([disabled])`);
      console.log('Clicked enabled sign in button.');
      signInClicked = true;
    } catch (e) {
      // If not enabled, force click with JS
      console.log('Button still disabled, forcing click with JS...');
      await page.evaluate((selector) => {
        const btn = document.querySelector(selector);
        if (btn) btn.click();
      }, signInBtnSelector);
      // Check if navigation started
      await page.waitForTimeout(500);
      if (page.url().includes('/dashboard') || page.url().includes('/paymentRequest')) {
        signInClicked = true;
      }
    }

    if (!signInClicked) {
      // As a last resort, press Enter in the password field
      console.log('Trying to submit by pressing Enter in password field...');
      await page.focus('input[placeholder="Password"]');
      await page.keyboard.press('Enter');
    }

    console.log('Sign in attempted.');

    console.log('Waiting for payment request page...');
    await page.waitForURL('**/paymentRequest', { timeout: 7000 });
    console.log('On payment request page. Filling amount...');
    await page.fill('input[formcontrolname="amount"]', amount.toString());

    console.log('Trying to find and fill remarks field...');
    try {
      // Try common selectors first
      await page.fill('input[placeholder*="remark" i]', 'happy shopping');
      console.log('Filled remarks using placeholder selector.');
    } catch (e1) {
      try {
        await page.fill('textarea[placeholder*="remark" i]', 'happy shopping');
        console.log('Filled remarks using textarea placeholder selector.');
      } catch (e2) {
        // Try the next input/textarea after amount
        const amountBox = await page.$('input[formcontrolname="amount"]');
        const allInputs = await page.$$('input, textarea');
        let remarksBox = null;
        for (let i = 0; i < allInputs.length; i++) {
          const box = allInputs[i];
          if (amountBox && (await box.evaluate((el, amountEl) => el !== amountEl, amountBox))) {
            remarksBox = box;
            break;
          }
        }
        if (remarksBox) {
          await remarksBox.fill('happy shopping');
          console.log('Filled remarks using fallback.');
        } else {
          throw new Error('Could not find remarks field!');
        }
      }
    }

    console.log('Clicking Generate button...');
    await page.click('button:has-text("Generate")');
    console.log('Waiting for QR image...');
    await page.waitForSelector('img.qr-image, img[src*="qr"]', { timeout: 4000 });
    const qrSrc = await page.getAttribute('img.qr-image, img[src*="qr"]', 'src');
    if (!qrSrc) throw new Error('QR image not found');
    let qrBase64;
    if (qrSrc.startsWith('data:image')) {
      qrBase64 = qrSrc.split(',')[1];
    } else {
      const qrBuffer = await page.evaluate(async (src) => {
        const res = await fetch(src);
        const buf = await res.arrayBuffer();
        return Array.from(new Uint8Array(buf));
      }, qrSrc);
      qrBase64 = Buffer.from(qrBuffer).toString('base64');
    }
    fs.writeFileSync('fonepay-qr.png', Buffer.from(qrBase64, 'base64'));
    console.log('QR code saved as fonepay-qr.png');
    console.log('Waiting for payment confirmation (green popup)...');

    let paymentConfirmed = false;
    let popupText = '';
    try {
      // Wait up to 3 minutes for the green popup to appear
      const popup = await page.waitForSelector('div:has-text("Received NPR")', { timeout: 3 * 60 * 1000 });
      popupText = await popup.textContent();
      console.log('Payment confirmation detected!');
      console.log('Popup text:', popupText);
      paymentConfirmed = true;
    } catch (e) {
      console.log('No payment confirmation detected within 3 minutes.');
    }

    if (paymentConfirmed) {
      // Extract amount and traceId from popupText
      const match = popupText.match(/Received NPR\.?([\d.]+).*traceId\s*(\d+)/i);
      let amountPaid = amount;
      let traceId = '';
      if (match) {
        amountPaid = match[1];
        traceId = match[2];
      }

      // Send payment confirmation to backend via WebSocket
      const WebSocket = require('ws');
      const ws = new WebSocket('ws://localhost:5000/fonepay-bot');
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'fonepay_payment_confirmed',
          amount: amountPaid,
          traceId,
          seller: username
        }));
        ws.close();
      });

      await browser.close(); // Immediately close browser after payment
      return;
    }

    // If not confirmed, wait for 3 minutes before closing
    await page.waitForTimeout(3 * 60 * 1000);
    await browser.close();
  } catch (err) {
    await browser.close();
    console.error('Error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  const [,, username, password, amount] = process.argv;
  if (!username || !password || !amount) {
    console.error('Usage: node standaloneFonepayQrBot.js <username> <password> <amount>');
    process.exit(1);
  }
  getFonepayQR(username, password, amount);
}