# AlgoQuest: Olimpiada Arenasi

Informatika to'garaklari va olimpiadaga tayyorlov uchun algoritmik RPG va kod jang arenasi.
Vite + React + TypeScript + Tailwind CSS.

## Ishga tushirish

```
npm install
npm run dev
```

## Buyruqlar

- `npm run dev` — ishlab chiqish serveri
- `npm run build` — TypeScript tekshiruvi va ishlab chiqarish yig'masi
- `npm run typecheck` — faqat TypeScript tekshiruvi
- `npm run selftest` — dvigatelni o'z-o'zini tekshirish: har bir daraja uchun etalon yechimlar
  (ichki Python interpretatori va JavaScript) barcha yashirin testlardan o'tishini,
  samarasiz yechimlar esa TLE olishini tekshiradi

## Tuzilma

- `src/types/` — umumiy tiplar
- `src/data/levels.ts` — 8 ta daraja matni, shablonlar, nishonlar, namunaviy reyting
- `src/engine/judge.ts` — yashirin testlar, sahnalar va hakam
- `src/engine/codeRunner.ts` — Web Worker orqali kod ijrosi (asosiy oqim tomoni)
- `src/engine/runner.worker.ts` — ijrochi worker
- `src/engine/pyodideExec.ts` — Pyodide (CPython) ko'prigi, `sys.settrace` bilan amallarni sanash
- `src/engine/miniPython.ts` — oflayn ishlaydigan ichki Python interpretatori
- `src/engine/jsExec.ts` — JavaScript ijrochisi va sikl instrumentatsiyasi
- `src/engine/meter.ts` — Big-O energiya hisoblagichi
- `src/engine/ArenaCanvas.tsx` — 2D Canvas o'yin dvigateli
- `src/components/` — ish maydoni, Sokratik mentor, Metodik pasport, reyting
- `src/lib/mentor.ts` — Gemini so'rovi va mahalliy Sokratik tahlilchi

## Python ijrosi

Sahifa ochilganda Pyodide CDN dan fonda yuklanadi. U tayyor bo'lguncha yoki internet
bo'lmaganda Python kodi ichki interpretatorda bajariladi, shuning uchun platforma darhol
va oflayn ham ishlaydi. Ichki interpretator `try/except`, `class` va `with` ni qo'llab-quvvatlamaydi.

## Gemini API kaliti

Ixtiyoriy. «AI Sozlamalari» orqali kiritiladi, faqat brauzerning `localStorage` xotirasida
saqlanadi va faqat Google Gemini API manziliga yuboriladi. Kalitsiz mahalliy mentor ishlaydi.
