const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:8000'; // Update this if your app runs on a different URL
const TEST_ITERATIONS = 5;
const OUTPUT_DIR = path.join(__dirname, 'performance-results');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper function to save results
function saveResults(data, filename) {
  const filepath = path.join(OUTPUT_DIR, `${filename}-${TIMESTAMP}.json`);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`Results saved to ${filepath}`);
  return filepath;
}

// Test runner
async function runNavigationTest() {
  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI/CD
    devtools: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--js-flags="--max-old-space-size=1024"'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Enable performance metrics
    await page.setViewport({ width: 1280, height: 800 });
    await page.setDefaultNavigationTimeout(60000);
    
    // Set up console logging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    // Load the performance test script
    const testScript = fs.readFileSync(path.join(__dirname, 'static', 'router-perf-test.js'), 'utf8');
    
    // Test guest mode
    console.log('Testing guest mode...');
    await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle0' });
    
    // Inject and run the test
    const guestResults = await page.evaluate(async (script) => {
      // Inject the test script
      const scriptEl = document.createElement('script');
      scriptEl.textContent = script;
      document.head.appendChild(scriptEl);
      
      // Run the test
      const test = new RouterPerfTest();
      return await test.runTest('guest');
    }, testScript);
    
    saveResults(guestResults, 'guest-results');
    
    // Test logged-in mode (if credentials are provided)
    if (process.env.LOGIN_EMAIL && process.env.LOGIN_PASSWORD) {
      console.log('Testing logged-in mode...');
      
      // Navigate to the test page with authentication token
      console.log('Authenticating with provided token...');
      await page.goto('https://dicta2stream.net/?token=d96561d7-6c95-4e10-80f7-62d5d3a5bd04', { 
        waitUntil: 'networkidle0',
        timeout: 60000
      });
      
      // Wait for authentication to complete and verify
      try {
        await page.waitForSelector('body.authenticated', { 
          timeout: 30000,
          visible: true
        });
        console.log('✅ Successfully authenticated');
        
        // Verify user is actually logged in
        const isAuthenticated = await page.evaluate(() => {
          return document.body.classList.contains('authenticated');
        });
        
        if (!isAuthenticated) {
          throw new Error('Authentication failed - not in authenticated state');
        }
        
        // Force a navigation to ensure the state is stable
        await page.goto('https://dicta2stream.net/#welcome-page', { 
          waitUntil: 'networkidle0',
          timeout: 30000 
        });
        
      } catch (error) {
        console.error('❌ Authentication failed:', error.message);
        // Take a screenshot for debugging
        await page.screenshot({ path: 'auth-failure.png' });
        console.log('Screenshot saved as auth-failure.png');
        throw error;
      }
      
      // Wait for the page to fully load after login
      await page.waitForTimeout(2000);
      
      // Run the test in logged-in mode
      const loggedInResults = await page.evaluate(async (script) => {
        const test = new RouterPerfTest();
        return await test.runTest('loggedIn');
      }, testScript);
      
      saveResults(loggedInResults, 'loggedin-results');
      
      // Generate comparison report
      const comparison = {
        timestamp: new Date().toISOString(),
        guest: {
          avg: guestResults.overall.avg,
          min: guestResults.overall.min,
          max: guestResults.overall.max
        },
        loggedIn: {
          avg: loggedInResults.overall.avg,
          min: loggedInResults.overall.min,
          max: loggedInResults.overall.max
        },
        difference: {
          ms: loggedInResults.overall.avg - guestResults.overall.avg,
          percent: ((loggedInResults.overall.avg - guestResults.overall.avg) / guestResults.overall.avg) * 100
        }
      };
      
      const reportPath = saveResults(comparison, 'performance-comparison');
      console.log(`\nPerformance comparison report generated at: ${reportPath}`);
      
      // Take a screenshot of the results
      await page.screenshot({ path: path.join(OUTPUT_DIR, `results-${TIMESTAMP}.png`), fullPage: true });
      
      return comparison;
    }
    
    return guestResults;
    
  } catch (error) {
    console.error('Test failed:', error);
    // Take a screenshot on error
    if (page) {
      await page.screenshot({ path: path.join(OUTPUT_DIR, `error-${TIMESTAMP}.png`), fullPage: true });
    }
    throw error;
    
  } finally {
    await browser.close();
  }
}

// Run the test
runNavigationTest()
  .then(results => {
    console.log('Test completed successfully');
    console.log('Results:', JSON.stringify(results, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
