import { BookOpen, Bot, ChevronRight, Filter, Gauge, GraduationCap, Layers, Sparkles, Trophy, Zap } from 'lucide-react';
import { LEVELS } from '../data/levels';
import Modal from './Modal';

const FUNNEL = [
  {
    icon: Sparkles,
    title: 'Qiziqish',
    text: "O'yin syujeti, jonli animatsiya va darhol ko'rinadigan natija o'quvchida ichki motivatsiya uyg'otadi. Birinchi bosqichlar ataylab qisqa: muvaffaqiyat tez keladi.",
  },
  {
    icon: GraduationCap,
    title: "To'garak",
    text: "Uch modul bo'ylab bosqichma-bosqich murakkablashuvchi 6 ta masala: sikllar, massivlar va qidiruv, rekursiya va graflar. Har bir bosqich oldingisiga tayanadi.",
  },
  {
    icon: Trophy,
    title: 'Olimpiada',
    text: "Boss-Fight rejimida to'g'ri javobning o'zi yetarli emas: yechim vaqt murakkabligi bo'yicha ham baholanadi. Bu respublika va xalqaro olimpiadalar formatiga mos.",
  },
];

const BLOOM = [
  ['Eslab qolish', "API buyruqlari va sintaksisni eslash", 'Barcha bosqichlardagi API yordamchi paneli'],
  ['Tushunish', "Masala shartini va agent harakatini tushuntirish", "Hikoya va vazifa matni, qadamma-qadam rejim"],
  ["Qo'llash", "Sikl va shart operatorlarini yangi vaziyatda ishlatish", '1.1 va 1.2 bosqichlar'],
  ['Tahlil', "Massivni tahlil qilish, chegaraviy holatlarni ajratish", '2.1 va 2.2 bosqichlar'],
  ['Baholash', "Algoritmlarni samaradorligi bo'yicha solishtirish (DFS va BFS, O(N) va O(N^2))", '3.1, 3.2 va Boss 1'],
  ['Yaratish', "Bir nechta algoritmni birlashtirib, yangi strategiya qurish", 'Boss 2'],
];

const BIGO = [
  ['O(log N)', "Har qadamda masala ikki barobar qisqaradi", "Byudjet 2*log2(N) + 2 o'lchov (2.2)"],
  ['O(N)', "Ma'lumotlar bir marta aylanib chiqiladi", 'Byudjet 20N — 25N amal (2.1, Boss 1)'],
  ['O(V + E)', "Har bir tugun va ulanish bir marta ko'riladi", 'Byudjet 80*(V + 2E) amal (3.2)'],
  ['O(N^2) va undan yuqori', "Ichma-ich to'liq sikllar", 'Katta testlarda energiya tugaydi: TLE'],
];

export default function MethodologicalModal({ onClose }: { onClose(): void }) {
  return (
    <Modal
      title="Metodik Pasport"
      subtitle="AlgoQuest: Olimpiada Arenasi platformasining pedagogik asoslari"
      icon={<BookOpen className="h-5 w-5" />}
      onClose={onClose}
      wide
    >
      <div className="space-y-7 text-sm leading-relaxed text-slate-300">
        <section>
          <p>
            <span className="font-semibold text-slate-100">Maqsad.</span> Platforma umumta'lim maktablari va akademik litseylarning
            informatika to'garaklari hamda olimpiadaga tayyorlov guruhlari uchun mo'ljallangan sinfdan tashqari ta'lim vositasidir.
            O'quvchi algoritmni mavhum matn sifatida emas, kiber-agentning harakati va energiya sarfi orqali ko'radi: xato qaror
            darhol vizual oqibatga olib keladi.
          </p>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Filter className="h-4 w-4 text-neon" />
            1. Voronka tizimi: Qiziqish, To'garak, Olimpiada
          </h3>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
            {FUNNEL.map((f, i) => (
              <div key={f.title} className="contents">
                <div className="rounded-2xl border border-edge bg-obsidian p-4">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-slate-100">
                    <f.icon className={`h-4 w-4 ${i === 2 ? 'text-ember' : 'text-neon'}`} />
                    {f.title}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">{f.text}</p>
                </div>
                {i < 2 && <ChevronRight className="hidden h-5 w-5 self-center text-slate-600 md:block" />}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Voronka tamoyili: keng doiradagi qiziquvchi o'quvchilar to'garak orqali saralanib, eng tayyorlari olimpiada yo'nalishiga
            o'tadi. Reyting jadvali bu o'tishni ko'rinadigan va o'lchanadigan qiladi.
          </p>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Layers className="h-4 w-4 text-neon" />
            2. Blum taksonomiyasi darajalari
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-edge">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-obsidian text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Daraja</th>
                  <th className="px-3 py-2 font-medium">O'quvchi faoliyati</th>
                  <th className="px-3 py-2 font-medium">Platformadagi o'rni</th>
                </tr>
              </thead>
              <tbody>
                {BLOOM.map((r) => (
                  <tr key={r[0]} className="border-t border-edge">
                    <td className="px-3 py-2 font-semibold text-neon">{r[0]}</td>
                    <td className="px-3 py-2">{r[1]}</td>
                    <td className="px-3 py-2 text-slate-400">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Gauge className="h-4 w-4 text-ember" />
            3. Big-O samaradorlik baholash mezoni
          </h3>
          <p className="mb-3">
            Har bir bajarilgan kod satri, massivdan o'qish yoki agent harakati <span className="font-semibold text-ember">energiya</span>{' '}
            sarflaydi. Byudjet masalaning maqsadli murakkabligiga qarab belgilanadi, shuning uchun samarasiz algoritm katta testda
            yarim yo'lda to'xtaydi va «Energiya tugadi (TLE)» xabarini oladi. Shu tariqa mavhum Big-O tushunchasi ko'z bilan
            ko'riladigan energiya shkalasiga aylanadi.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-edge">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-obsidian text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Murakkablik</th>
                  <th className="px-3 py-2 font-medium">Belgisi</th>
                  <th className="px-3 py-2 font-medium">Energiya mezoni</th>
                </tr>
              </thead>
              <tbody>
                {BIGO.map((r, i) => (
                  <tr key={r[0]} className="border-t border-edge">
                    <td className={`px-3 py-2 font-mono font-semibold ${i === 3 ? 'text-danger' : 'text-neon'}`}>{r[0]}</td>
                    <td className="px-3 py-2">{r[1]}</td>
                    <td className="px-3 py-2 text-slate-400">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Baholash formulasi: bosqich XP si + (qolgan energiya ulushi x 25% bonus). Ya'ni tejamkor yechim ko'proq ball oladi.
            Yashirin testlar chegaraviy holatlarni (bitta element, bo'sh yo'l, manfiy sonlar) tekshiradi, shuning uchun
            harakatlarni yodlab yozish natija bermaydi.
          </p>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Bot className="h-4 w-4 text-neon" />
            4. Sokratik mentorlik
          </h3>
          <p>
            Mentor hech qachon tayyor kod bermaydi. U o'quvchining joriy kodi va xato sababini tahlil qilib, bitta yoki ikkita
            yo'naltiruvchi savol beradi. Bu konstruktivistik yondashuv: bilim tayyor holda berilmaydi, o'quvchi uni o'zi kashf
            etadi. Internet yoki API kaliti bo'lmasa ham mahalliy mentor ishlaydi, shuning uchun dars jarayoni uzilmaydi.
          </p>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Zap className="h-4 w-4 text-ember" />
            5. O'quv dasturi xaritasi
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-edge">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="bg-obsidian text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Bosqich</th>
                  <th className="px-3 py-2 font-medium">Mavzu</th>
                  <th className="px-3 py-2 font-medium">Blum darajasi</th>
                  <th className="px-3 py-2 font-medium">Maqsadli murakkablik</th>
                  <th className="px-3 py-2 text-right font-medium">XP</th>
                </tr>
              </thead>
              <tbody>
                {LEVELS.map((l) => (
                  <tr key={l.id} className="border-t border-edge">
                    <td className={`px-3 py-2 font-mono font-semibold ${l.mode === 'boss' ? 'text-ember' : 'text-neon'}`}>{l.code}</td>
                    <td className="px-3 py-2 text-slate-200">{l.title}</td>
                    <td className="px-3 py-2">{l.bloom}</td>
                    <td className="px-3 py-2 font-mono">{l.complexity}</td>
                    <td className="px-3 py-2 text-right font-mono">{l.xp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Modal>
  );
}
