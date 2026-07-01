# Tech Stack — Jendela

| Lapisan | Teknologi | Keterangan |
|---|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS v4 | Server-rendered + client components, streaming UI |
| **Backend** | Next.js API Route (`/api/chat`) | Serverless endpoint, NDJSON streaming over SSE |
| **AI Model** | Google Gemini 2.5 Flash | `@google/generative-ai` SDK, streaming text generation |
| **Data Source** | [data.go.id](https://data.go.id) — Portal Satu Data Indonesia | Search via HTML scrape, download XLSX/CSV/JSON |
| **Parser** | SheetJS (`xlsx`) | XLSX → JSON, CSV → JSON with multi-row header merging |
| **Deploy Target** | Vercel / Railway | Edge/serverless, zero-ops |
| **Language** | TypeScript | Strict mode, single-language fullstack |

### Flow
```
User Question
  → Gemini ekstrak kata kunci pencarian
  → Cari dataset di data.go.id (iterative, coba semua kata kunci)
  → Download + parse XLSX/CSV/JSON
  → Gemini 2.5 Flash jawab berdasarkan data
  → Stream balasan ke user (NDJSON)
```
