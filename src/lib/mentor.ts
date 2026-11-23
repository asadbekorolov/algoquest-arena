import type { Lang, LevelDef, RunResult } from '../types';

export const SYSTEM_INSTRUCTION =
  "You are a Socratic Informatics Olympiad mentor. Respond in Uzbek. NEVER write the final code or give the direct answer. Analyze the student's current code and failure reason, and ask 1 or 2 sharp guiding questions to help them discover the algorithmic bug or Big-O bottleneck themselves.";

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

function describeResult(result: RunResult | null): string {
  if (!result) return "O'quvchi kodni hali ishga tushirmagan.";
  const failed = result.tests.find((t) => !t.ok);
  return [
    `Hukm: ${result.verdict}`,
    `Xabar: ${result.message}`,
    failed ? `Muvaffaqiyatsiz test: ${failed.name} (sarflangan energiya ${failed.used} / ${failed.budget})` : '',
    `O'tgan testlar: ${result.tests.filter((t) => t.ok).length} / ${result.totalTests}`,
    result.errorLine ? `Xato satri: ${result.errorLine}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Gemini API orqali jonli Sokratik maslahat. Kalit faqat so'rov sarlavhasida yuboriladi. */
export async function askGemini(key: string, level: LevelDef, lang: Lang, code: string, result: RunResult | null): Promise<string> {
  const prompt = [
    `Masala: ${level.code} — ${level.title}`,
    `Shart: ${level.task}`,
    `Maqsadli murakkablik: ${level.complexity}. ${level.energyNote}`,
    `Dasturlash tili: ${lang === 'python' ? 'Python' : 'JavaScript'}`,
    '',
    "O'quvchining joriy kodi:",
    '```',
    code,
    '```',
    '',
    'Oxirgi ishga tushirish natijasi:',
    describeResult(result),
  ].join('\n');

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API javob bermadi (HTTP ${res.status})`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  if (!text) throw new Error("Gemini bo'sh javob qaytardi");
  return text;
}

function stripComments(code: string, lang: Lang): string {
  if (lang === 'python') return code.replace(/#.*$/gm, '');
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Ichma-ich sikl bor-yo'qligini taxminiy aniqlaydi. */
export function hasNestedLoops(code: string, lang: Lang): boolean {
  const lines = code.split('\n');
  if (lang === 'python') {
    const stack: number[] = [];
    for (const raw of lines) {
      if (!raw.trim()) continue;
      const indent = raw.length - raw.trimStart().length;
      while (stack.length && indent <= stack[stack.length - 1]) stack.pop();
      if (/^\s*(for|while)\b/.test(raw)) {
        if (stack.length) return true;
        stack.push(indent);
      }
    }
    return false;
  }
  let depth = 0;
  const stack: number[] = [];
  for (const raw of lines) {
    const isLoop = /\b(for|while)\s*\(/.test(raw);
    if (isLoop) {
      if (stack.length) return true;
      stack.push(depth);
    }
    for (const ch of raw) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        while (stack.length && depth <= stack[stack.length - 1]) stack.pop();
      }
    }
  }
  return false;
}

/**
 * Internet va API kalitsiz ishlaydigan mahalliy Sokratik mentor:
 * kod holati va oxirgi natijaga qarab yo'naltiruvchi savollar tanlaydi.
 */
export function localMentor(level: LevelDef, lang: Lang, code: string, result: RunResult | null, turn: number): string {
  const src = stripComments(code, lang);
  const q: string[] = [];
  const has = (re: RegExp) => re.test(src);
  const loop = has(/\b(for|while)\b/);
  const nested = hasNestedLoops(src, lang);
  const hiddenLoop =
    loop &&
    (lang === 'python'
      ? has(/\b(sum|max|min|sorted)\s*\(\s*data\s*\[/) || has(/data\s*\[[^\]\n]*:[^\]\n]*\]/)
      : has(/\.(slice|reduce|indexOf|includes)\s*\(/));
  const v = result?.verdict;
  const msg = result?.message ?? '';
  const lineHint = result?.errorLine ? `${result.errorLine}-satrda` : 'xato chiqqan satrda';

  if (v === 'error') {
    if (/SyntaxError|IndentationError/.test(msg))
      q.push(`Dastur ishga tushmasdan to'xtadi: «${msg}». ${lineHint} qavslar, ikki nuqta va chekinishlar (indent) to'g'ri yozilganmi?`);
    else if (/NameError|ReferenceError|is not defined/.test(msg))
      q.push(`Xabar: «${msg}». Bu nom qayerda e'lon qilingan? Uni ishlatishdan oldin qiymat berilganmi va imlosi bir xilmi?`);
    else if (/IndexError|KeyError|undefined/.test(msg))
      q.push(`Xabar: «${msg}». ${lineHint} indeks qanday eng kichik va eng katta qiymatlarni qabul qilishi mumkin? Massiv uzunligi bilan solishtirib ko'ring.`);
    else if (/Recursion|call stack/.test(msg))
      q.push("Rekursiya to'xtamayapti. Funksiya o'zini chaqirmasdan javob qaytaradigan holat (baza holati) qaysi? Har bir chaqiruvda masala rostdan ham kichrayapti-mi?");
    else q.push(`Dastur xato bilan to'xtadi: «${msg}». ${lineHint} har bir o'zgaruvchi qanday qiymatga ega bo'lishini kutgan edingiz? Uni print() bilan tekshirib ko'rsangiz nima ko'rinadi?`);
  }

  switch (level.id) {
    case 'club-1-1':
      if (!loop) q.push("Zinalar soni 3 emas, 6 ta bo'lsa buyruqlarni necha marta qayta yozishga to'g'ri keladi? Takrorlanadigan qismni bir marta yozish imkonini beruvchi konstruksiya qaysi?");
      else if (!has(/\bN\b/)) q.push("Sikl necha marta aylanishini qayerdan oladi? Yashirin testlarda zinalar soni boshqa bo'lsa, dasturingiz buni qanday biladi?");
      if (!has(/turn_left|turnLeft/) || !has(/turn_right|turnRight/)) q.push("Agent bir zinani chiqib bo'lgach qaysi tomonga qarab turishi kerak? Buning uchun ikkala burilish ham kerakmi?");
      if (v === 'crash') q.push("Agent devorga urilgan paytda qaysi tomonga qarab turgan edi? Sikl tanasidagi buyruqlar tartibini qog'ozda bitta zina uchun bajarib ko'ring.");
      if (v === 'tle') q.push("Bitta zina uchun nechta harakat yetarli? Dasturingiz undan ko'proq harakat qilayotgan joy qayerda?");
      break;
    case 'club-1-2':
      if (!has(/\bscan\s*\(/)) q.push("Agent oldidagi lazer hozir faolmi yoki yo'qmi — buni qadam tashlashdan oldin qanday bilib olasiz?");
      else if (!has(/\bif\b/)) q.push("scan() natijasi \"lazer\" bo'lganda ham, \"bosh\" bo'lganda ham agent bir xil ish qilyapti. Bu ikki holatni qanday ajratasiz?");
      if (has(/\bscan\s*\(/) && !has(/\bwait\s*\(/)) q.push("Lazer faol bo'lsa agent nima qilishi kerak? Joyida turib vaqt o'tkazadigan buyruq bormi?");
      if (!has(/\bwhile\b/)) q.push("Yo'lak uzunligi har testda har xil. Qadamlar sonini oldindan bilmasangiz, \"portalga yetguncha takrorla\" degan fikrni qaysi sikl ifodalaydi?");
      if (v === 'crash') q.push("Agent lazerga urilgan qadamdan oldin scan() nima qaytargan edi? Tekshiruv va yurish orasida boshqa harakat bajarilmadimi?");
      break;
    case 'club-2-1':
      if (!loop && !has(/\b(max|min|Math\.max|Math\.min)\b/)) q.push("Eng katta elementni topish uchun massivning nechta elementini ko'rib chiqish shart? Buni qaysi konstruksiya bilan yozasiz?");
      if (nested) q.push("Kodingizda ichma-ich sikl bor: N = 400 bo'lsa ichki qism necha marta bajariladi? Har bir element uchun massivni qaytadan aylanish shartmi yoki oldingi natijani eslab qolish mumkinmi?");
      if (v === 'wrong') q.push("Bir xil qiymatli elementlar bo'lsa qaysi indeks qaytishi kerak? Taqqoslashda > va >= belgilarining farqi bu yerda nimaga olib keladi?");
      if (v === 'tle') q.push("Energiya byudjeti taxminan 20N. Massivni necha marta to'liq aylanib chiqyapsiz?");
      break;
    case 'club-2-2':
      if (!has(/\/\/|>>|Math\.floor|Math\.trunc/)) q.push("Massiv saralangan. O'rtadagi elementga qarab, massivning qaysi yarmida target bo'lishi mumkin emasligini ayta olasizmi? O'rta indeks qanday hisoblanadi?");
      if (v === 'tle') q.push("Byudjet atigi 2*log2(N) + 2 ta o'lchov. Bitta sikl aylanishida data[...] dan necha marta o'qiyapsiz va sikl jami necha marta aylanadi?");
      if (v === 'wrong') q.push("Qidiruv oralig'ida bitta element qolganda sikl sharti (chap < ong yoki chap <= ong) uni tekshiradimi? Chegaralarni orta, orta + 1 yoki orta - 1 ga surishda element tushib qolmayaptimi?");
      if (loop && !has(/\bwhile\b/)) q.push("for sikli massivni boshidan oxirigacha o'qiydi. Har qadamda oraliqni ikki barobar qisqartirish uchun qaysi shart bilan aylanadigan sikl qulayroq?");
      break;
    case 'club-3-1':
      if (!has(/visited|seen|korilgan|ko_rilgan|tashrif|Set\b|set\s*\(|\bota\b|parent|prev/i)) q.push("Labirintda halqa bor. Agent bir katakka ikkinchi marta kelganini qanday biladi? Bu ma'lumotni qayerda saqlaysiz?");
      if (!loop && !has(/def\s+\w+|function\s+\w+/)) q.push("Har bir katakdan to'rtta yo'nalishni sinab ko'rish kerak. Bu fikrni rekursiya yoki navbat yordamida qanday ifodalaysiz?");
      if (v === 'crash') q.push("Yo'lingiz devorga urildi. Qo'shni katakka o'tishdan oldin u '#' emasligini tekshiryapsizmi? Satr va ustun indekslari (maze[r][c]) va 'U'/'D'/'L'/'R' yo'nalishlari bir-biriga mos kelyaptimi?");
      if (v === 'wrong') q.push("Qaytarilgan yo'l portalda tugamadi. Boshi berk ko'chaga kirganda yo'lga qo'shilgan harflar orqaga qaytishda olib tashlanyaptimi?");
      break;
    case 'club-3-2':
      if (!has(/deque|popleft|shift\s*\(|navbat|queue|bosh\+\+|\[h\]|h\+\+/i)) q.push("Eng qisqa yo'l kerak. Tugunlarni manbaga yaqinligi tartibida ko'rib chiqish uchun qaysi ma'lumotlar tuzilmasi kerak: stek yoki navbat?");
      if (!has(/ota|parent|prev|from/i)) q.push("Maqsad tugun topilganda u yerga qaysi tugun orqali kelganingizni qanday bilasiz? Yo'lni orqaga qarab tiklash uchun nimani yozib borish kerak?");
      if (v === 'wrong' && /qisqa/.test(msg)) q.push("Topilgan yo'l to'g'ri, lekin eng qisqa emas. Tugun birinchi marta ko'rilgan paytda belgilanyaptimi yoki navbatdan olinganda? DFS bilan BFS ning farqi bu yerda nimada?");
      if (v === 'wrong' && !/qisqa/.test(msg)) q.push("start va target bir xil bo'lganda yoki yo'l umuman bo'lmaganda funksiyangiz aynan nima qaytaradi?");
      break;
    case 'boss-1':
      if (nested || hiddenLoop) q.push("Har bir boshlang'ich pozitsiya uchun k ta elementni qaytadan qo'shyapsiz. Oyna bir katak o'ngga surilganda yig'indiga nechta yangi element qo'shiladi va nechtasi chiqib ketadi?");
      if (v === 'tle') q.push("N = 5000, k = 2500 bo'lganda dasturingiz taxminan nechta amal bajaradi? Byudjet esa 25N atrofida. Bu ikki sonni solishtirsangiz qanday xulosa chiqadi?");
      if (v === 'wrong') q.push("Barcha sonlar manfiy bo'lsa eng katta yig'indi ham manfiy bo'ladi. Javobni saqlaydigan o'zgaruvchining boshlang'ich qiymati bu holatda to'g'ri ishlaydimi?");
      if (!nested && !hiddenLoop && !v) q.push("Birinchi oynaning yig'indisini bilsangiz, ikkinchi oyna yig'indisini nechta amal bilan topa olasiz?");
      break;
    case 'boss-2':
      if (!has(/deque|popleft|navbat|queue|bfs/i)) q.push("Ikki katak orasidagi eng qisqa masofani devorlarni hisobga olib qanday topasiz? Koordinatalar ayirmasi (Manxetten masofasi) bu yerda nega yetarli emas?");
      if (!has(/permutations|rec\s*\(|order|tartib/i)) q.push("Yadrolarni qaysi tartibda yig'ish eng qisqa ekanini qanday aniqlaysiz? Tartiblar soni 4! = 24 dan oshmasa, hammasini solishtirib chiqish qimmatmi?");
      if (v === 'wrong' && /qisqa/.test(msg)) q.push("Marshrut to'g'ri, lekin optimal emas. Har doim eng yaqin yadroga borish strategiyasi umumiy yo'lni uzaytirib yuboradigan vaziyatni tasavvur qila olasizmi?");
      if (v === 'wrong' && /yig'ilmadi|portalda/.test(msg)) q.push("Marshrutning har bir bo'lagi oldingisi tugagan katakdan boshlanyaptimi? Oxirgi bo'lak albatta portalda tugashi uchun nima qilish kerak?");
      if (v === 'tle') q.push("Bir xil nuqtadan BFS ni necha marta ishga tushiryapsiz? Natijani bir marta hisoblab, saqlab qo'yish mumkinmi?");
      break;
    default:
      break;
  }

  if (!result && q.length === 0) q.push("Kod yozishdan oldin: masalani o'z so'zlaringiz bilan qanday tushuntirasiz va birinchi qadamda aynan nimani hisoblash kerak?");
  if (v === 'ok') {
    return "Yechim barcha testlardan o'tdi. Endi o'ylab ko'ring: kirish ma'lumotlari 10 barobar kattalashsa, dasturingiz bajaradigan amallar soni necha barobar ortadi? Buni yanada kamaytirish yo'li bormi?";
  }

  const hint = level.hints[turn % level.hints.length];
  const picked: string[] = [];
  if (q.length) picked.push(q[turn % q.length]);
  if (q.length > 1 && turn === 0) picked.push(q[1]);
  if (picked.length < 2 && !picked.includes(hint)) picked.push(hint);
  return picked.map((text, i) => `${i + 1}. ${text}`).join('\n\n');
}
