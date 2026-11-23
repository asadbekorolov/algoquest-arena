import type { BadgeDef, LevelDef } from '../types';

const M1 = '1-modul: Sikllar va Shart Operatorlari';
const M2 = '2-modul: Massivlar va Qidiruv Algoritmlari';
const M3 = '3-modul: Rekursiya va Graflar';
const MB = 'Olimpiada Arena: Boss-Fight';

export const LEVELS: LevelDef[] = [
  {
    id: 'club-1-1',
    mode: 'club',
    code: '1.1',
    module: M1,
    title: "Energiya Yo'lagi",
    story:
      "Kiber-agent energiya stansiyasining zinapoyasimon yo'lagiga tushib qoldi. Har bir zinada bittadan energiya kristali bor. Agent barcha kristallarni yig'ib, yuqoridagi portalga yetib borishi kerak, ammo akkumulyator quvvati cheklangan.",
    task:
      "Yo'lak N ta bir xil zinadan iborat. N o'zgaruvchisi dasturga tayyor holda beriladi va har bir testda har xil bo'ladi. Bitta zinani bosib o'tish tartibi: 2 qadam oldinga, chapga burilish, 1 qadam oldinga, o'ngga burilish. for sikli yordamida barcha zinalarni bosib o'ting.",
    api: [
      { name: 'move_forward()', desc: "Agent qarab turgan tomonga 1 katak yuradi" },
      { name: 'turn_left()', desc: "Joyida chapga 90 gradus buriladi" },
      { name: 'turn_right()', desc: "Joyida o'ngga 90 gradus buriladi" },
      { name: 'N', desc: "Zinalar soni (tayyor o'zgaruvchi)" },
    ],
    input: "N — zinalar soni (1 <= N <= 6)",
    output: "Agent barcha kristallarni yig'ib, portalda to'xtashi kerak",
    complexity: 'O(N)',
    energyNote: "Har bir harakat 1 energiya sarflaydi. Byudjet: 8N + 4",
    energyUnit: 'harakat',
    bloom: "Qo'llash",
    xp: 100,
    starter: {
      python: `# N - zinalar soni (tayyor o'zgaruvchi, har bir testda har xil)
# Bitta zina: 2 qadam oldinga, chapga burilish,
#             1 qadam oldinga, o'ngga burilish

for i in range(N):
    move_forward()
    # Zinaning qolgan harakatlarini shu yerga yozing
`,
      javascript: `// N - zinalar soni (tayyor o'zgaruvchi, har bir testda har xil)
// Bitta zina: 2 qadam oldinga, chapga burilish,
//             1 qadam oldinga, o'ngga burilish

for (let i = 0; i < N; i++) {
  move_forward();
  // Zinaning qolgan harakatlarini shu yerga yozing
}
`,
    },
    hints: [
      "Bitta zinani bosib o'tish uchun aniq nechta buyruq kerak? Ularni tartib bilan sanab bera olasizmi?",
      "Sikl tanasi bir marta bajarilgandan keyin agent qaysi tomonga qarab turadi? Keyingi zina uchun bu to'g'ri yo'nalishmi?",
      "Agar N = 1 bo'lsa dasturingiz nechta harakat bajaradi? N = 6 bo'lsa-chi?",
    ],
  },
  {
    id: 'club-1-2',
    mode: 'club',
    code: '1.2',
    module: M1,
    title: "Lazer To'siqlar",
    story:
      "Portalga olib boradigan yo'lakni lazer darvozalari qo'riqlaydi. Har bir darvoza o'z ritmi bilan yonib-o'chadi. Faol lazerga kirgan agent darhol ishdan chiqadi, shuning uchun har bir qadamdan oldin sensor bilan oldinni tekshirish shart.",
    task:
      "scan() agent oldidagi katakni tekshiradi va \"lazer\", \"devor\", \"kristall\", \"portal\" yoki \"bosh\" satrini qaytaradi. Lazer faol bo'lsa wait() bilan bir takt kuting, aks holda oldinga yuring. Yo'lak uzunligi va lazerlar ritmi har bir testda har xil, shuning uchun qadamlarni oldindan sanab yozib bo'lmaydi.",
    api: [
      { name: 'scan()', desc: "Oldingi katak holati: \"lazer\", \"devor\", \"kristall\", \"portal\", \"bosh\"" },
      { name: 'move_forward()', desc: "1 katak oldinga yuradi" },
      { name: 'wait()', desc: "Bir takt kutadi (lazerlar holati o'zgaradi)" },
      { name: 'at_portal()', desc: "Agent portalda bo'lsa True (true) qaytaradi" },
    ],
    input: "Yo'lak uzunligi L (6 <= L <= 13), lazerlar soni va ritmi noma'lum",
    output: "Agent birorta faol lazerga urilmasdan portalga yetishi kerak",
    complexity: 'O(L)',
    energyNote: "Har bir yurish va kutish 1 energiya. Byudjet: 4L + 10",
    energyUnit: 'harakat',
    bloom: "Qo'llash",
    xp: 120,
    starter: {
      python: `# scan()      -> "lazer", "devor", "kristall", "portal" yoki "bosh"
# wait()      -> bir takt kutish (lazerlar holati o'zgaradi)
# at_portal() -> agent portalga yetgan bo'lsa True

while not at_portal():
    oldinda = scan()
    # if / else yordamida qaror qabul qiling:
    # lazer faol bo'lsa kuting, aks holda oldinga yuring
    move_forward()
`,
      javascript: `// scan()      -> "lazer", "devor", "kristall", "portal" yoki "bosh"
// wait()      -> bir takt kutish (lazerlar holati o'zgaradi)
// at_portal() -> agent portalga yetgan bo'lsa true

while (!at_portal()) {
  const oldinda = scan();
  // if / else yordamida qaror qabul qiling:
  // lazer faol bo'lsa kuting, aks holda oldinga yuring
  move_forward();
}
`,
    },
    hints: [
      "Agent yurishdan oldin oldidagi katak haqida nimani bilishi kerak? Bu ma'lumotni qaysi funksiya beradi?",
      "scan() \"lazer\" qaytarganda va boshqa qiymat qaytarganda agent bir xil ish qilishi kerakmi?",
      "Lazer faol bo'lgan paytda oldinga yurmasdan vaqt o'tkazishning qanday yo'li bor?",
    ],
  },
  {
    id: 'club-2-1',
    mode: 'club',
    code: '2.1',
    module: M2,
    title: 'Shifrlangan Sandiqlar',
    story:
      "Jarlik ustidagi ko'prik yashirin. Uni ochish uchun sandiqlardagi shifrlarni tahlil qilish kerak: eng katta shifrli sandiq o'rni ko'prikning X koordinatasini, eng kichik shifrli sandiq o'rni esa Y koordinatasini beradi.",
    task:
      "solve(data) funksiyasini yozing: data massividagi eng katta va eng kichik elementlarning indekslarini [max_indeks, min_indeks] ko'rinishida qaytaring. Bir xil qiymatlar uchrasa, eng birinchi uchragan indeks olinadi. Massivni bir marta aylanib chiqish yetarli.",
    api: [{ name: 'solve(data)', desc: "data — butun sonlar massivi; [max_indeks, min_indeks] qaytaradi" }],
    input: "data — butun sonlar massivi (1 <= N <= 400), manfiy sonlar bo'lishi mumkin",
    output: '[max_indeks, min_indeks]',
    complexity: 'O(N)',
    energyNote: "Har bir bajarilgan satr va massivdan o'qish 1 energiya. Byudjet: 20N + 80",
    energyUnit: 'amal',
    bloom: 'Tahlil',
    xp: 150,
    starter: {
      python: `def solve(data):
    max_i = 0
    min_i = 0
    # Massivni bir marta aylanib chiqing va indekslarni yangilang

    return [max_i, min_i]
`,
      javascript: `function solve(data) {
  let maxI = 0;
  let minI = 0;
  // Massivni bir marta aylanib chiqing va indekslarni yangilang

  return [maxI, minI];
}
`,
    },
    hints: [
      "Massivni chapdan o'ngga o'qiyotganda har bir qadamda xotirada nimani saqlab borish yetarli?",
      "Massivda bir xil eng katta qiymat ikki marta uchrasa, qaysi indeks qaytishi kerak? Taqqoslash belgingiz (> yoki >=) bunga qanday ta'sir qiladi?",
      "Massivda faqat manfiy sonlar bo'lsa yoki bitta element bo'lsa, boshlang'ich qiymatlaringiz to'g'ri ishlaydimi?",
    ],
  },
  {
    id: 'club-2-2',
    mode: 'club',
    code: '2.2',
    module: M2,
    title: 'Binar Qidiruv Darvozasi',
    story:
      "Darvoza faqat to'g'ri kirish chastotasi bilan ochiladi. Chastotalar o'sish tartibida saralangan, ammo har bir o'lchov agentning energiyasini oladi. Hamma chastotani birma-bir tekshirishga quvvat yetmaydi.",
    task:
      "solve(data, target) funksiyasini yozing: o'sish tartibida saralangan data massivida target qiymatining indeksini qaytaring, topilmasa -1 qaytaring. Massivdan har bir o'qish (data[i]) 1 energiya sarflaydi, byudjet esa atigi 2*log2(N) + 2 o'lchov.",
    api: [{ name: 'solve(data, target)', desc: "Saralangan massivda target indeksini yoki -1 qaytaradi" }],
    input: "data — o'suvchi tartibdagi turli butun sonlar (1 <= N <= 1024), target — qidirilayotgan son",
    output: 'target indeksi yoki -1',
    complexity: 'O(log N)',
    energyNote: "Faqat massivdan o'qish energiya sarflaydi. Byudjet: 2*log2(N) + 2",
    energyUnit: "o'lchov",
    bloom: 'Tahlil',
    xp: 180,
    starter: {
      python: `def solve(data, target):
    chap = 0
    ong = len(data) - 1
    # Qidiruv oralig'ini har qadamda ikki barobar qisqartiring.
    # Maslahat: data[orta] ni bir marta o'qib, o'zgaruvchiga saqlang.

    return -1
`,
      javascript: `function solve(data, target) {
  let chap = 0;
  let ong = data.length - 1;
  // Qidiruv oralig'ini har qadamda ikki barobar qisqartiring.
  // Maslahat: data[orta] ni bir marta o'qib, o'zgaruvchiga saqlang.

  return -1;
}
`,
    },
    hints: [
      "Massiv saralangani sizga qanday qo'shimcha ma'lumot beradi? O'rtadagi elementni ko'rgach, massivning qaysi yarmini butunlay tashlab yuborish mumkin?",
      "1000 ta elementni har safar ikkiga bo'lsangiz, necha qadamdan keyin bitta element qoladi?",
      "Sikl sharti chap < ong bo'lsa va chap <= ong bo'lsa farqi nimada? Bitta elementli massivda dasturingiz nima qiladi?",
    ],
  },
  {
    id: 'club-3-1',
    mode: 'club',
    code: '3.1',
    module: M3,
    title: 'Kvant Labirint',
    story:
      "Kvant labirintning yo'laklari tarmoqlanadi va ba'zilari halqa hosil qilib, agentni yana eski joyiga qaytaradi. Portalga olib boradigan yo'lni topish uchun agentga tizimli izlash strategiyasi kerak.",
    task:
      "solve(maze) funksiyasini yozing. maze — satrlar ro'yxati: '#' devor, '.' bo'sh katak, 'S' agent, 'P' portal. S dan P gacha boradigan istalgan to'g'ri yo'lni 'U' (yuqoriga), 'D' (pastga), 'L' (chapga), 'R' (o'ngga) harflaridan iborat satr sifatida qaytaring. Labirintda halqalar bor: tashrif buyurilgan kataklarni belgilab boring.",
    api: [{ name: 'solve(maze)', desc: "Yo'lni 'U', 'D', 'L', 'R' harflari satri sifatida qaytaradi" }],
    input: "maze — R ta satr, har biri C ta belgidan iborat (R, C <= 11). Chetlari devor bilan o'ralgan",
    output: "Masalan: \"RRDDR\"",
    complexity: 'O(R * C)',
    energyNote: "Har bir bajarilgan satr 1 energiya. Byudjet: 300 * R * C",
    energyUnit: 'amal',
    bloom: 'Baholash',
    xp: 220,
    starter: {
      python: `def solve(maze):
    rows, cols = len(maze), len(maze[0])
    # 1. 'S' katakning koordinatasini toping
    # 2. DFS (rekursiya) yoki BFS (navbat) bilan 'P' gacha yo'l qidiring
    # 3. Tashrif buyurilgan kataklarni belgilashni unutmang
    # 4. Yo'lni 'U', 'D', 'L', 'R' harflari bilan qaytaring
    return ""
`,
      javascript: `function solve(maze) {
  const rows = maze.length, cols = maze[0].length;
  // 1. 'S' katakning koordinatasini toping
  // 2. DFS (rekursiya) yoki BFS (navbat) bilan 'P' gacha yo'l qidiring
  // 3. Tashrif buyurilgan kataklarni belgilashni unutmang
  // 4. Yo'lni 'U', 'D', 'L', 'R' harflari bilan qaytaring
  return "";
}
`,
    },
    hints: [
      "Agent chorrahaga kelganda qaysi yo'llarni sinab ko'rganini qayerda eslab qoladi? Boshi berk ko'chadan qaytganda nima bo'lishi kerak?",
      "Labirintda halqa bo'lsa va tashrif buyurilgan kataklar belgilanmasa, izlash qachon to'xtaydi?",
      "Rekursiv funksiyangizning to'xtash sharti qanday? U portal topilgan holatni ham, boshi berk holatni ham qamrab oladimi?",
    ],
  },
  {
    id: 'club-3-2',
    mode: 'club',
    code: '3.2',
    module: M3,
    title: 'Tarmoq Tugunlari',
    story:
      "Signal server tugunlari tarmog'i orqali uzatiladi. Har bir ulanish vaqt oladi, shuning uchun signal manba tugundan maqsad tugunga eng kam ulanish orqali yetib borishi kerak.",
    task:
      "solve(graph, start, target) funksiyasini yozing. graph[u] — u tugunga bevosita ulangan tugunlar ro'yxati. start dan target gacha eng kam ulanishli yo'lni tugunlar ro'yxati sifatida qaytaring (masalan [0, 2, 5]). Yo'l mavjud bo'lmasa bo'sh ro'yxat qaytaring.",
    api: [{ name: 'solve(graph, start, target)', desc: "Eng qisqa yo'ldagi tugunlar ro'yxatini qaytaradi" }],
    input: "graph — qo'shnilik ro'yxati (V <= 40 tugun), start va target — tugun raqamlari",
    output: "Tugunlar ro'yxati, masalan [0, 1, 4, 6, 7]; yo'l bo'lmasa []",
    complexity: 'O(V + E)',
    energyNote: "Har bir bajarilgan satr 1 energiya. Byudjet: 80 * (V + 2E) + 300",
    energyUnit: 'amal',
    bloom: 'Baholash',
    xp: 250,
    starter: {
      python: `from collections import deque

def solve(graph, start, target):
    navbat = deque([start])
    ota = {start: None}
    # BFS: navbatdan tugun oling, hali ko'rilmagan qo'shnilarini
    # navbatga qo'shing va 'ota' lug'atiga yozing.
    # target topilgach, 'ota' orqali yo'lni orqaga qarab tiklang.
    return []
`,
      javascript: `function solve(graph, start, target) {
  const navbat = [start];
  const ota = new Map([[start, null]]);
  // BFS: navbatdan tugun oling, hali ko'rilmagan qo'shnilarini
  // navbatga qo'shing va 'ota' xaritasiga yozing.
  // target topilgach, 'ota' orqali yo'lni orqaga qarab tiklang.
  return [];
}
`,
    },
    hints: [
      "DFS topgan birinchi yo'l har doim eng qisqa bo'ladimi? Tugunlarni manbadan uzoqligi bo'yicha qatlam-qatlam ko'rib chiqadigan usul qaysi?",
      "Maqsad tugunga yetganingizda u yerga qaysi tugundan kelganingizni qayerdan bilasiz? Yo'lni tiklash uchun nimani saqlash kerak?",
      "start va target bir xil bo'lsa yoki ular orasida umuman yo'l bo'lmasa, funksiyangiz nima qaytaradi?",
    ],
  },
  {
    id: 'boss-1',
    mode: 'boss',
    code: 'B1',
    module: MB,
    title: "Vaqt Qo'riqchisi",
    story:
      "Vaqt Qo'riqchisi minglab sensorlardan iborat devorni boshqaradi. Uni yengish uchun eng kuchli signal segmentini qo'riqchi energiyangizni so'rib olishidan oldin topish kerak. Bu yerda to'g'ri javobning o'zi yetarli emas: algoritm tez ham bo'lishi shart.",
    task:
      "solve(data, k) funksiyasini yozing: data — N ta sensor ko'rsatkichi. Uzunligi aynan k bo'lgan ketma-ket segmentlar ichidan eng katta yig'indini qaytaring. N 5000 gacha yetadi: ichma-ich sikl (O(N * k)) energiya byudjetiga sig'maydi. Prefiks yig'indi yoki sirpanuvchi oyna (sliding window) g'oyasidan foydalaning.",
    api: [{ name: 'solve(data, k)', desc: "Uzunligi k bo'lgan segmentning eng katta yig'indisini qaytaradi" }],
    input: "data — butun sonlar (1 <= k <= N <= 5000), qiymatlar manfiy bo'lishi mumkin",
    output: "Bitta butun son — eng katta segment yig'indisi",
    complexity: 'O(N)',
    energyNote: "Har bir bajarilgan satr va massivdan o'qish 1 energiya. Byudjet: 25N + 200",
    energyUnit: 'amal',
    bloom: 'Baholash va Yaratish',
    xp: 400,
    starter: {
      python: `def solve(data, k):
    # Sodda yechim: to'g'ri ishlaydi, lekin murakkabligi O(N * k).
    # Vazifa: uni O(N) ga keltiring.
    eng_katta = None
    for i in range(len(data) - k + 1):
        yigindi = 0
        for j in range(i, i + k):
            yigindi += data[j]
        if eng_katta is None or yigindi > eng_katta:
            eng_katta = yigindi
    return eng_katta
`,
      javascript: `function solve(data, k) {
  // Sodda yechim: to'g'ri ishlaydi, lekin murakkabligi O(N * k).
  // Vazifa: uni O(N) ga keltiring.
  let engKatta = null;
  for (let i = 0; i + k <= data.length; i++) {
    let yigindi = 0;
    for (let j = i; j < i + k; j++) {
      yigindi += data[j];
    }
    if (engKatta === null || yigindi > engKatta) {
      engKatta = yigindi;
    }
  }
  return engKatta;
}
`,
    },
    hints: [
      "Oyna bir katak o'ngga surilganda uning ichidagi nechta element o'zgaradi? Qolganlarini qayta qo'shish shartmi?",
      "N = 5000 va k = 2500 bo'lsa, ichki sikl jami necha marta aylanadi? Bu son energiya byudjetidan necha barobar katta?",
      "Agar har bir i uchun data[0..i] yig'indisini oldindan bilsangiz, istalgan segment yig'indisini nechta amal bilan topasiz?",
    ],
  },
  {
    id: 'boss-2',
    mode: 'boss',
    code: 'B2',
    module: MB,
    title: "Kiber-Qal'a Strategiyasi",
    story:
      "Kiber-qal'a ichida bir nechta energiya yadrosi yashiringan. Qal'a himoyasi faqat barcha yadrolar yig'ilgach va agent portalga eng qisqa marshrut bilan yetib borgandagina o'chadi. Bitta ortiqcha qadam ham signalizatsiyani ishga tushiradi.",
    task:
      "solve(grid) funksiyasini yozing. 'S' agent, 'K' energiya yadrolari (0 dan 4 tagacha), 'P' portal, '#' devor. Barcha K larni yig'ib, P da tugaydigan ENG QISQA marshrutni 'U', 'D', 'L', 'R' harflari satri sifatida qaytaring. G'oya: muhim nuqtalar orasidagi masofalarni BFS bilan toping, so'ng yadrolarni yig'ish tartiblarini solishtiring.",
    api: [{ name: 'solve(grid)', desc: "Barcha K larni yig'ib P ga boradigan eng qisqa marshrut satri" }],
    input: "grid — R ta satr (R, C <= 13), chetlari devor; K lar soni 4 tadan oshmaydi",
    output: "Masalan: \"RRDDLLDR\" — qadamlar soni optimal bo'lishi shart",
    complexity: 'O(K * R * C + K!)',
    energyNote: "Qadamlar soni optimaldan oshmasligi kerak. Energiya byudjeti: 60 000 amal",
    energyUnit: 'amal',
    bloom: 'Yaratish',
    xp: 500,
    starter: {
      python: `from collections import deque

def bfs(grid, start):
    # start katakdan barcha kataklargacha masofa va 'ota' xaritasi
    masofa = {start: 0}
    ota = {start: None}
    navbat = deque([start])
    while navbat:
        r, c = navbat.popleft()
        # 4 ta qo'shni katakni tekshiring va navbatga qo'shing
    return masofa, ota

def solve(grid):
    # 1. S, P va barcha K nuqtalarni toping
    # 2. Har bir muhim nuqtadan BFS ishga tushiring
    # 3. K larni yig'ish tartiblarini solishtirib, eng qisqasini tanlang
    # 4. Marshrutni 'U', 'D', 'L', 'R' satriga aylantiring
    return ""
`,
      javascript: `function bfs(grid, start) {
  // start = [r, c] katakdan barcha kataklargacha masofa va 'ota' xaritasi
  const masofa = new Map([[start.join(","), 0]]);
  const ota = new Map([[start.join(","), null]]);
  const navbat = [start];
  let bosh = 0;
  while (bosh < navbat.length) {
    const [r, c] = navbat[bosh++];
    // 4 ta qo'shni katakni tekshiring va navbatga qo'shing
  }
  return { masofa, ota };
}

function solve(grid) {
  // 1. S, P va barcha K nuqtalarni toping
  // 2. Har bir muhim nuqtadan BFS ishga tushiring
  // 3. K larni yig'ish tartiblarini solishtirib, eng qisqasini tanlang
  // 4. Marshrutni 'U', 'D', 'L', 'R' satriga aylantiring
  return "";
}
`,
    },
    hints: [
      "Har doim eng yaqin yadroga borish umumiy marshrutni eng qisqa qiladimi? Bunga qarshi misol o'ylab topa olasizmi?",
      "Yadrolar soni 4 tadan oshmasa, ularni yig'ishning nechta turli tartibi bor? Hammasini tekshirish qimmatmi?",
      "Ikki muhim nuqta orasidagi masofani har safar qaytadan hisoblash kerakmi yoki bir marta hisoblab saqlab qo'yish mumkinmi?",
    ],
  },
];

export const LEVEL_BY_ID: Record<string, LevelDef> = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

export const BADGES: BadgeDef[] = [
  { id: 'sikl-ustasi', title: 'Sikl Ustasi', desc: "1-modulning ikkala bosqichi yechildi", requires: ['club-1-1', 'club-1-2'] },
  { id: 'qidiruv-mohiri', title: 'Qidiruv Mohiri', desc: "2-modulning ikkala bosqichi yechildi", requires: ['club-2-1', 'club-2-2'] },
  { id: 'graf-sayyohi', title: 'Graf Sayyohi', desc: "3-modulning ikkala bosqichi yechildi", requires: ['club-3-1', 'club-3-2'] },
  { id: 'big-o-strategi', title: 'Big-O Strategi', desc: "Vaqt Qo'riqchisi O(N) yechim bilan yengildi", requires: ['boss-1'] },
  { id: 'olimpiada-nomzodi', title: 'Olimpiada Nomzodi', desc: "Ikkala Boss ham yengildi", requires: ['boss-1', 'boss-2'] },
];

export interface Peer {
  name: string;
  track: "To'garak" | 'Olimpiada';
  bigO: string;
  xp: number;
}

/** Namunaviy to'garak a'zolari (simulyatsiya qilingan ma'lumot). */
export const PEERS: Peer[] = [
  { name: 'Jasur Karimov', track: 'Olimpiada', bigO: 'O(N)', xp: 2180 },
  { name: 'Malika Yusupova', track: 'Olimpiada', bigO: 'O(N log N)', xp: 1890 },
  { name: 'Sardor Toshpulatov', track: 'Olimpiada', bigO: 'O(N log N)', xp: 1540 },
  { name: 'Dilnoza Rahimova', track: "To'garak", bigO: 'O(N)', xp: 1210 },
  { name: 'Bekzod Aliyev', track: "To'garak", bigO: 'O(N log N)', xp: 960 },
  { name: 'Nigora Ismoilova', track: "To'garak", bigO: 'O(N^2)', xp: 720 },
  { name: 'Otabek Nurmatov', track: "To'garak", bigO: 'O(N^2)', xp: 480 },
  { name: 'Shahzoda Qodirova', track: "To'garak", bigO: 'O(N^2)', xp: 260 },
];
