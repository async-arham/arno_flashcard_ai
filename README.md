# Arno — AI-Only Flashcard Generator

Arno turns PDF, DOCX and study text into up to 10 **Groq AI-generated** flashcards. The existing dark interface, card flipping and scoring are preserved. **There is NO automatic, offline, quick-card or non-AI fallback.** If Groq is unavailable, the app displays an error and generates **zero** cards.

## Updating your existing `arno-ai.vercel.app` deployment (easy Windows instructions)

1. Unzip `Arno_AI_ONLY_READY.zip`.
2. Open your existing project folder in File Explorer: `OneDrive > Desktop > Arno_Flashcard_FIXED` (the folder you have already linked to your Vercel project).
3. Copy **the files and folders inside** the new ZIP's extracted folder into your **existing** `Arno_Flashcard_FIXED` folder. Allow Windows to **Replace the files in the destination**. Don't delete your old `.vercel` folder or the link to your Vercel project.
4. Open your existing project folder in VS Code, then **Terminal > New Terminal**.
5. Run `vercel --prod`. It will update your **existing** project and custom domain rather than creating a new one.
6. In Vercel dashboard: your Arno project > Settings > Environment Variables, ensure `GROQ_API_KEY` is set for **Production**. If you need to add or change it, save the variable, then run `vercel --prod` again. **Never put the key into `index.html`, `vercel.json`, or GitHub.**
7. Open `https://arno-ai.vercel.app`, upload `EXAMPLE_STUDY_NOTES.txt` and choose Generate Flashcards.

**If Vercel asks which project to deploy:** You may have opened the new extracted folder instead of your existing linked folder. Run the command inside your original `Arno_Flashcard_FIXED` folder, which contains a hidden `.vercel` directory created when you linked the project.

## Local running

In your VS Code terminal inside Arno's folder, use PowerShell:

```powershell
$env:GROQ_API_KEY="paste_your_Groq_key_here"
npm start
```

Open `http://localhost:3000` in Chrome. The key set in PowerShell applies only to that terminal session. Don't share it in screenshots or upload it to GitHub. A key in your local PowerShell terminal **does not** automatically configure Vercel, and a key in Vercel does **not** configure local Node.js.

## Behavior and edge cases

- **No Groq key:** Shows a clear setup error. No offline cards are generated.
- **Invalid/revoked key or unavailable Groq model:** Shows a configuration error, not synthetic cards.
- **Rate limit / exhausted provider allowance:** Returns an error and asks the user to retry later. Long Retry-After windows are respected; brief transient failures are retried once.
- **Connection problems / timeout / server failures:** The app shows a retryable error and never displays old cards as a successful new result.
- **Invalid or empty AI response:** Validates the AI's JSON; retries once; otherwise shows an error.
- **Incomplete or oversized file:** Rejects empty / unreadable inputs, PDFs without extractable text, legacy DOC and unsupported formats; each file limited to 12 MB and total upload limited to 20 MB.
- **Long documents:** For source texts longer than ~16,000 characters, the backend uses the beginning, middle and end to stay within a manageable AI request. A brief toast indicates excerpts were used.
- **Duplicate or broken AI cards:** Skipped automatically. Up to 10 usable question-answer pairs are displayed.
- **Card scoring and reset:** Existing card flipping, next/previous buttons, correct/incorrect counters and reset flow remain.

## Supported uploads

Text-based PDFs (PDF.js loads from the internet), DOCX, TXT, Markdown, HTML, CSV, JSON, and RTF. Image-only/scanned PDFs require OCR and are not supported by this version. Files are read in the browser, and extracted text is sent to Groq when generating flashcards. Do not upload private documents without permission.

## Technical details

- No dependencies required for local development beyond Node.js 20+.
- Start locally: `npm start`.
- Test the backend with mocked Groq responses: `npm test`.
- Groq default: `openai/gpt-oss-20b`. Override with `GROQ_MODEL` only if the model is supported in your Groq account.
- GPT-OSS uses Groq's strict JSON schema structured output. Custom Groq models fall back to JSON Object Mode (still **AI**, not a local fallback).
- `GROQ_API_KEY` is read by the backend only and is never sent to the visitor's browser.
- The Vercel configuration includes `outputDirectory: "."` to match the configuration you used to fix Arno's 404 home page. If your Vercel Project Settings specify a different root/output directory, ensure the folder containing `index.html`, `api/`, and `package.json` is the deployment root.

## Important limitations

Automated tests mock Groq's API. A live AI-provider call cannot be verified without a valid secret key and network access. Real generation depends on Groq access, quota and limits. Public websites should consider abuse prevention and provider quota monitoring; this minimal project does not implement per-user rate limiting.
