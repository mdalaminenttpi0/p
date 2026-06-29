const express = require('express');
const puppeteer = require('puppeteer');
const { PDFDocument, rgb } = require('pdf-lib');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: err.message 
  });
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Main PDF conversion endpoint
app.post('/api/convert-to-pdf', async (req, res) => {
  try {
    const { url, quality = 'hd' } = req.body;

    // Validate URL
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    console.log(`Converting URL to PDF: ${url}, Quality: ${quality}`);

    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set quality parameters based on user selection
    const qualitySettings = {
      '4k': { width: 3840, height: 2160, scale: 2, dpi: 300 },
      '8k': { width: 7680, height: 4320, scale: 2, dpi: 600 },
      'hd': { width: 1920, height: 1080, scale: 1.5, dpi: 150 }
    };

    const settings = qualitySettings[quality] || qualitySettings.hd;

    // Set viewport
    await page.setViewport({
      width: settings.width,
      height: settings.height,
      deviceScaleFactor: settings.scale
    });

    // Navigate to URL
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for content to render
    await page.waitForTimeout(2000);

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      scale: settings.scale,
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    });

    await browser.close();

    // Send PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="webpage-${Date.now()}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ 
      error: 'PDF conversion failed', 
      message: error.message 
    });
  }
});

// Advanced conversion with screenshot
app.post('/api/convert-with-screenshot', async (req, res) => {
  try {
    const { url, quality = 'hd', includeMetadata = true } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      new URL(url);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    console.log(`Advanced conversion for: ${url}`);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    const qualitySettings = {
      '4k': { width: 3840, height: 2160, scale: 2 },
      '8k': { width: 7680, height: 4320, scale: 2 },
      'hd': { width: 1920, height: 1080, scale: 1.5 }
    };

    const settings = qualitySettings[quality] || qualitySettings.hd;

    await page.setViewport({
      width: settings.width,
      height: settings.height,
      deviceScaleFactor: settings.scale
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Take screenshot
    const screenshot = await page.screenshot({ fullPage: true });

    // Create PDF from screenshot
    const pdfDoc = await PDFDocument.create();
    const pdfPage = pdfDoc.addPage([settings.width / settings.scale, settings.height / settings.scale]);

    const pngImage = await pdfDoc.embedPng(screenshot);
    pdfPage.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: settings.width / settings.scale,
      height: settings.height / settings.scale
    });

    // Add metadata
    if (includeMetadata) {
      pdfDoc.setTitle(`Web Capture - ${url}`);
      pdfDoc.setAuthor('URL to PDF Converter');
      pdfDoc.setSubject(`Captured from: ${url}`);
      pdfDoc.setKeywords(['web', 'capture', 'pdf']);
      pdfDoc.setProducer('URL to PDF Converter v1.0');
    }

    const pdfBytes = await pdfDoc.save();

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="webpage-screenshot-${Date.now()}.pdf"`);
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Advanced conversion error:', error);
    res.status(500).json({ 
      error: 'Advanced conversion failed', 
      message: error.message 
    });
  }
});

// Batch conversion endpoint
app.post('/api/batch-convert', async (req, res) => {
  try {
    const { urls, quality = 'hd' } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'Array of URLs is required' });
    }

    console.log(`Batch converting ${urls.length} URLs`);

    const results = [];

    for (const url of urls) {
      try {
        new URL(url);
        results.push({ url, status: 'pending' });
      } catch (err) {
        results.push({ url, status: 'invalid', error: 'Invalid URL format' });
      }
    }

    res.json({
      message: 'Batch conversion started',
      totalUrls: urls.length,
      results
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Batch conversion failed', 
      message: error.message 
    });
  }
});

// Use error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 PDF Converter Server running on http://localhost:${PORT}`);
  console.log(`📝 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`🎯 Frontend: http://localhost:${PORT}`);
});
