import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT = `Role: You are a pure HTML formatter and layout designer. Your ONLY job is to wrap the user's raw text into beautiful Tailwind CSS HTML structures.

STRICT HARDCODED RULES - NEVER CHANGE:
1. ZERO TEXT ALTERATION: You must NEVER add, remove, rewrite, translate, or modify a single character, word, or paragraph. Do NOT add your own explanations, do NOT translate to Hinglish, do NOT summarize.
2. EXACT CONTENT ONLY: The output must contain the EXACT 100% verbatim text provided by the user, and NOTHING else. 
3. STRUCTURE ONLY: Your task is ONLY to design the visual structure (HTML tags, Tailwind classes) around the user's EXACT words.

EXACT VISUAL LAYOUT ENGINE & CSS RULES:
You MUST use these exact Tailwind components to organize the exact text provided:

1. [Page Numbers] (If present in text, e.g., "Page 1")
   Wrap in: <div class="bg-pink-600 text-white font-bold text-sm inline-block px-3 py-1 mb-4 rounded-sm shadow-sm">STAGE / PAGE X</div>

2. [Main Titles]
   Wrap in: <h1 class="text-red-600 font-extrabold text-2xl uppercase mb-6 tracking-wide">...</h1>

3. [Section Headings]
   Wrap in: <h2 class="text-red-600 font-bold text-lg uppercase mt-6 mb-3">...</h2>

4. [Important Blocks / Concepts]
   Wrap blocks of text in: <div class="bg-[#f0fdf4] border-l-4 border-green-500 p-4 mb-4 shadow-sm rounded-r-md" style="page-break-inside: avoid;">
       <p class="text-gray-800 leading-relaxed text-sm">...</p>
   </div>

5. [Secondary Blocks / Details]
   Wrap in: <div class="bg-[#fdf4ff] border-l-4 border-fuchsia-500 p-4 mb-4 shadow-sm rounded-r-md" style="page-break-inside: avoid;">
       <p class="text-gray-800 leading-relaxed text-sm">...</p>
   </div>

6. [Standard Paragraphs]
   Wrap general text in: <p class="text-gray-800 leading-relaxed text-sm mb-3">...</p>

CRITICAL INSTRUCTION: You MUST structure EVERY SINGLE SENTENCE provided in the input. Do NOT skip, drop, or summarize anything. Copy the user's text EXACTLY. Provide the resulting pure HTML code directly. No markdown tags like \`\`\`html or extra words.`;

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
