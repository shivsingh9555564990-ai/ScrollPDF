import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { htmlContents } = await req.json();

    if (!htmlContents || htmlContents.length === 0) {
      return NextResponse.json({ error: 'No html content provided.' }, { status: 400 });
    }

    const combinedHtml = htmlContents.join('\n<hr class="my-8 border-t-2 border-dashed border-gray-300" />\n');

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { font-family: sans-serif; margin: 0; padding: 0; }
          .page-break { page-break-after: always; }
        </style>
      </head>
      <body>
        <div class="p-4 w-[414px]">
          ${combinedHtml}
        </div>
      </body>
      </html>
    `;

    // Launch puppeteer based on environment
    let browser;
    if (process.env.VERCEL === '1') {
      const chromium = await import('@sparticuz/chromium');
      const puppeteerCore = await import('puppeteer-core');
      
      browser = await puppeteerCore.launch({
        args: chromium.default.args,
        defaultViewport: { width: 414, height: 896 },
        executablePath: await chromium.default.executablePath(),
        headless: true,
      });
    } else {
      const puppeteer = await import('puppeteer');
      browser = await puppeteer.default.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        headless: true
      });
    }
    
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'load' });

    // Wait for Tailwind classes to be applied implicitly by letting script tag run or idle
    await new Promise(r => setTimeout(r, 1000));

    // Get the exact height of the content
    const height = await page.evaluate(() => document.documentElement.scrollHeight);

    // Generate the PDF
    const pdfBuffer = await page.pdf({
      width: '414px',
      height: height + 'px',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    await browser.close();

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="ZeraNotes.pdf"'
      }
    });

  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
