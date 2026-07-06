<p align="center">
  <img src="images/Jendela.png" alt="JendelaAI Logo" width="100%">
</p>

<h1 align="center">Jendela AI</h1>

<p align="center">
  <strong>Analisis satu putaran.</strong><br>
  Data resmi data.go.id, deteksi kejanggalan via Nemesis, validasi opini publik, dan sintesis AI. 
</p>

--

## Apa itu Jendela AI?

Jendela adalah semantic data gateway berbasis Kecerdasan Buatan (AI) yang dirancang khusus untuk meningkatkan aksesibilitas Open Data Pemerintah (data.go.id). 

Platform ini memecahkan masalah kompleksitas format data mentah (`.csv`/`.xlsx`) dan maraknya hoaks dengan cara mentransformasikan data pemerintah menjadi informasi yang intuitif, visual, serta terverifikasi secara hukum dan publik hanya dengan bermodalkan satu prompt bahasa alami.

## Local Development

```bash
git clone [https://github.com/Soralith/Jendela.git](https://github.com/Soralith/Jendela.git)
cd Jendela
npm install
```
Kemudian konfigurasi Environment Variables (.env.local):
GEMINI_API_KEY=xxx

Bisa juga menggunakan *multiple* kunci API yang juga sudah memiliki fitur *auto-switch* ketika kunci API sebelumnya terkena requests limit:
GEMINI_API_KEY=xxx
GEMINI_API_KEY_2=xxx
GEMINI_API_KEY_3=xxx

Jalan server pengembangan dengan: npm run dev
Buka http://localhost:3000 di browser untuk melihat aplikasi.
