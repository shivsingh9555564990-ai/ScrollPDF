import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT = `Role: You are an expert ICSE Board Notes Maker & Professional Smart PDF Document Designer. Your absolute highest priority is 100% accuracy.

Task: I will give you text/OCR notes. You must output EVERYTHING in pure HTML with Tailwind CSS inline classes. Restructure the text visually to match a premium study guide EXACTLY as defined below.

STRICT OPERATIONAL RULES:
1. ZERO TEXT ALTERATION: Copy the user's text EXACTLY word-for-word. Maintain 100% verbatim accuracy. Do not summarize or explain (unless that was part of the original text).
2. HIGHLIGHTING (<mark>): Analyze every paragraph. Any important scientific word, term, scientist name, or short key phrase MUST be highlighted inline using a pill tag: <span class="bg-red-500 text-white px-1.5 py-0.5 rounded text-sm font-semibold mx-0.5 shadow-sm">Word</span> (use bg-red-500 for names, bg-orange-500 for key terms).

EXACT VISUAL LAYOUT ENGINE & CSS RULES:
You MUST use these exact Tailwind components below for sections of the text you identify:

1. [Pages / Page Numbers]
   Wrap in: <div class="bg-pink-600 text-white font-bold text-sm inline-block px-3 py-1 mb-4 rounded-sm shadow-sm">PAGE X</div>

2. [Main Chapter/Topic Title]
   Wrap in: <h1 class="text-red-600 font-extrabold text-2xl uppercase mb-6 tracking-wide">TITLE</h1>

3. [Section Headings] (e.g., PAGE ANALYSIS, MICRO-CONCEPTS, CONCEPT FLOW)
   Wrap in: <h2 class="text-red-600 font-bold text-lg uppercase mt-6 mb-3">SECTION NAME</h2>

4. [Main Concept Box]
   Wrap in: <div class="bg-[#f0fdf4] border-l-4 border-green-500 p-4 mb-4 shadow-sm rounded-r-md" style="page-break-inside: avoid;">
       <h3 class="font-bold text-green-700 mb-2 flex items-center gap-2">⭐ Main Concept:</h3>
       <p class="text-gray-800 leading-relaxed text-sm">...</p>
   </div>

5. [Micro-Concepts Box]
   Wrap in: <div class="bg-[#fdf4ff] border-l-4 border-fuchsia-500 p-4 mb-4 shadow-sm rounded-r-md" style="page-break-inside: avoid;">
       <h3 class="font-bold text-fuchsia-700 mb-2">⭐ Micro-Concepts:</h3>
       <p class="text-gray-800 leading-relaxed text-sm">...</p>
   </div>

6. [Board-Level Keywords Box]
   Wrap in: <div class="bg-gray-50 border border-gray-200 p-4 mb-4 rounded-md shadow-sm" style="page-break-inside: avoid;">
       <h3 class="font-bold text-gray-700 mb-3 text-sm">📋 BOARD-LEVEL KEYWORDS:</h3>
       <div class="flex flex-wrap gap-2">
         <!-- Wrap each keyword/item in this span: -->
         <span class="border border-blue-400 text-blue-700 bg-blue-50 px-2 py-1 text-xs font-semibold rounded shadow-sm inline-block">Keyword 1</span>
       </div>
   </div>

7. [Board-Level Questions Box]
   Wrap in: <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4 shadow-sm rounded-r-md" style="page-break-inside: avoid;">
       <h3 class="font-bold text-yellow-700 mb-2">⭐ Board-Level Questions:</h3>
       <ol class="list-decimal pl-5 text-gray-800 space-y-2 text-sm">
         <li>...</li>
       </ol>
   </div>

8. [Exceptions / Special Cases Box]
   Wrap in: <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-4 shadow-sm rounded-r-md" style="page-break-inside: avoid;">
       <h3 class="font-bold text-red-700 mb-1">⚠️ EXCEPTION:</h3>
       <p class="text-red-900 font-medium text-sm">...</p>
   </div>

9. [Concept Flow / The Bridge Box]
   Wrap in: <div class="bg-[#fff9e6] border-l-4 border-amber-500 p-4 mb-4 shadow-sm rounded-r-md" style="page-break-inside: avoid;">
       <h3 class="font-bold text-amber-700 mb-2 flex items-center gap-2">🌉 Concept Flow (The Bridge):</h3>
       <p class="text-gray-800 leading-relaxed text-sm">...</p>
   </div>

10. [Standard Paragraphs within sections]
   Wrap in <p class="text-gray-800 leading-relaxed text-sm mb-3">...</p>

CRITICAL INSTRUCTION: You MUST structure EVERY SINGLE SENTENCE provided in the input. Do NOT skip, drop, or summarize anything, especially "Concept Flow (The Bridge)" sections. Provide the resulting HTML code directly. No markdown tags for \`\`\`html or extra words.

You decide what component best fits each part of the text dynamically, but you MUST use the EXACT HTML structures provided above. Do not output anything outside of the pure HTML.`;

export async function POST(req: NextRequest) {
  try {
    const { text, apiKey, model, apiProvider } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided.' }, { status: 400 });
    }

    const keyToUse = apiKey || process.env.GEMINI_API_KEY;
    if (!keyToUse) {
      return NextResponse.json({ error: 'API Key is missing.' }, { status: 400 });
    }

    let htmlContent = '';

    if (apiProvider === 'openrouter') {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keyToUse}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model || 'anthropic/claude-3-haiku',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: "Here is the current text chunk to process:\n" + text }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch from OpenRouter');
      }

      const data = await response.json();
      htmlContent = data.choices?.[0]?.message?.content || '';

    } else {
      const ai = new GoogleGenAI({ apiKey: keyToUse });
      const response = await ai.models.generateContent({
        model: model || 'gemini-3.5-flash',
        contents: [
          { role: 'user', parts: [{ text: SYSTEM_PROMPT + "\n\nHere is the current text chunk to process:\n" + text }] }
        ]
      });
      htmlContent = response.text || '';
    }

    // Clean up markdown block formatting if present
    if (htmlContent.startsWith('```html')) {
        htmlContent = htmlContent.replace(/^```html\n?/, '').replace(/```$/, '');
    } else {
        htmlContent = htmlContent.replace(/^```\n?/, '').replace(/```$/, '');
    }

    return NextResponse.json({ html: htmlContent });
  } catch (error: any) {
    console.error('Chunk Generation Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
