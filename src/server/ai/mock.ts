// Test mode for the AI features: answers without calling Anthropic.
//
// Turned on with AI_MOCK=true when ANTHROPIC_API_KEY is not set (a real key
// always wins, so going live only needs the key). The mock goes through the
// same path as the real model: it calls the same server tools with the
// family's verified identity, cites real passages and returns the same JSON,
// so citations, request cards and drafts work exactly as they will live.
// It does not understand language: it picks a tool by keywords. Every answer
// it stores carries the model name "mock", which the app shows as "Test mode".
import type { AiProvider, AnswerInput, ModelAnswer } from './provider';
import type { AssistantModel, RunInput, RunResult, ToolExec } from './assistant-model';

export const MOCK_MODEL = 'mock';

export const isMockModel = (model: string | null | undefined) => model === MOCK_MODEL;

const pause = () => (process.env.NODE_ENV === 'test' ? Promise.resolve() : new Promise((r) => setTimeout(r, 500 + Math.random() * 600)));

const WORD = /[\p{L}\p{N}]{3,}/gu;
const STOP = new Set(
  'the and are for from have how what when where which who why will with would you your can does did this that there their about please tell our my mine que qué los las del por para con una uno como cómo cuando cuándo donde dónde hay es el la de mi mis sus'.split(' '),
);
const terms = (s: string) => [...new Set((s.toLowerCase().match(WORD) ?? []).filter((w) => !STOP.has(w)))];

/** The passage sentence that shares the most words with the question (copied verbatim, so citations verify). */
export function bestSentence(text: string, question: string): string {
  const q = terms(question);
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 12);
  if (!sentences.length) return text.trim().slice(0, 280);
  let best = sentences[0]!;
  let score = -1;
  for (const s of sentences) {
    const w = terms(s);
    const n = q.filter((t) => w.some((x) => x.startsWith(t.slice(0, 5)))).length;
    if (n > score) {
      score = n;
      best = s;
    }
  }
  return best.slice(0, 280);
}

const SPANISH = /(?<!\p{L})(qué|que|cuándo|cuando|cómo|como|dónde|hola|gracias|mi|mis|hijo|hija|hijos|colegio|escuela|mañana|hoy|semana|puedes|quiero|necesito|enfermo|enferma|falta|faltará|ausencia|oficina|solicitud|hay|el|la|los|las|por favor)(?!\p{L})/iu;

type Lang = 'en' | 'es';
const say = (lang: Lang, en: string, es: string) => (lang === 'es' ? es : en);

type Child = { ref: string; name: string; grade: string | null; canReportAbsence: boolean };
type Final = { answer: string; citations: { source: string; quote: string }[] };

const DAYS_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A date named in the message (ISO, today, tomorrow or a weekday), or null. */
export function findDate(msg: string, today: string): string | null {
  const m = msg.toLowerCase();
  const iso = m.match(/\b(20\d\d-\d\d-\d\d)\b/);
  if (iso) return iso[1]!;
  if (/\b(tomorrow|mañana)\b/.test(m) && !/\b(por|de|en) la mañana\b|\bthis morning\b/.test(m)) return addDays(today, 1);
  if (/\b(today|hoy|this morning|esta mañana)\b/.test(m)) return today;
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  for (let i = 0; i < 7; i++) {
    if (new RegExp(`\\b(${DAYS_EN[i]}|${DAYS_ES[i]})\\b`).test(m)) return addDays(today, (i - dow + 7) % 7);
  }
  return null;
}

/** "at 10", "at 10:30am", "a las 9", "13:15" → "HH:MM". */
export function findTime(msg: string): string | null {
  const m = msg.toLowerCase().match(/\b(?:at|a las?)\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?|\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?/);
  if (!m) return null;
  let h = Number(m[1] ?? m[4]);
  const min = Number(m[2] ?? m[5] ?? 0);
  const ampm = m[3] ?? m[6];
  if (ampm?.startsWith('p') && h < 12) h += 12;
  if (ampm?.startsWith('a') && h === 12) h = 0;
  // School-day hours without am/pm: 1–5 means afternoon.
  if (!ampm && h >= 1 && h <= 5) h += 12;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const ABSENCE = /\b(absent|absence|miss(ing)? school|stay(ing)? home|sick|ill\b|late|tardy|early|pick (him|her|them) up|ausente|ausencia|falta(rá|r)?|no (irá|va a ir|vendrá)|enferm[oa]|tarde|temprano|recoger)/i;
/** Questions about the rules go to the school's information, not to a draft. */
const POLICY = /\b(policy|policies|rules?|how do i|how to|how can i|what happens|política|reglas?|cómo (se|puedo|hago))\b/i;
const OFFICE = /\b(message|write|email|send|tell|contact|ask) (to )?(the )?(office|school|teacher)|\b(request|question) (to|for) the office|\b(mensaje|escrib\w*|envi\w*|avis\w*|pregunt\w*|solicitud) (a|para|de)? ?(la )?(oficina|escuela|colegio|maestr[oa])/i;
const REQUESTS = /\b(my requests?|my messages?|status|requests? (i|we) (sent|made)|mis solicitudes|mis mensajes|estado de)/i;
const REF = /\bR-?(\d{3,9})\b/i;
const CHILDREN = /\b(my (children|kids|child|son|daughter)|which (children|kids)|mis hij[oa]s|mi hij[oa])\b/i;
const CALENDAR = /\b(calendar|event|events|this week|next week|weekend|no school|day off|holiday|break|mass|game|field trip|calendario|evento|eventos|esta semana|próxima semana|no hay clases?|vacaciones|feriado|misa|partido)\b/i;
const HELLO = /^(hi|hello|hey|hola|buenas|buenos días|good (morning|afternoon))\b[!. ]*$/i;
const HELP = /\b(what can you do|help me|how does this work|qué puedes hacer|ayuda)\b/i;

/** Scripted stand-in for the Family Assistant model. */
export class MockAssistantModel implements AssistantModel {
  async run(input: RunInput, exec: ToolExec): Promise<RunResult> {
    let rounds = 0;
    const has = (name: string) => input.tools.some((t) => t.name === name);
    const call = async <T>(name: string, args: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> => {
      rounds++;
      const r = await exec(name, args);
      let parsed: unknown;
      try {
        parsed = JSON.parse(r.content);
      } catch {
        parsed = null;
      }
      if (r.isError) return { ok: false, error: (parsed as { error?: string } | null)?.error ?? 'That lookup failed.' };
      return { ok: true, data: parsed as T };
    };
    await pause();
    const final = await this.answer(input, has, call);
    return { text: JSON.stringify(final), model: MOCK_MODEL, inputTokens: 0, outputTokens: 0, costMicroUsd: 0, rounds: Math.max(rounds, 1) };
  }

  private async answer(
    input: RunInput,
    has: (n: string) => boolean,
    call: <T>(name: string, args: unknown) => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
  ): Promise<Final> {
    const today = input.system.match(/Today is (\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10);
    // A short follow-up to a question the assistant asked ("Which child?") continues that request.
    const last = input.history.at(-1);
    const prevUser = [...input.history].reverse().find((t) => t.role === 'user');
    const followUp = last?.role === 'assistant' && last.text.trim().endsWith('?') && prevUser && input.message.length < 80;
    const msg = followUp ? `${prevUser!.text} ${input.message}` : input.message;
    const lang: Lang = SPANISH.test(msg) ? 'es' : 'en';
    const plain = (answer: string): Final => ({ answer, citations: [] });

    if (HELLO.test(input.message.trim()) || HELP.test(msg)) {
      return plain(
        say(
          lang,
          'Hi! I can look up the school\'s information and calendar, check your requests to the office, and prepare an absence notice or a message for you to review before it is sent.',
          '¡Hola! Puedo buscar en la información y el calendario del colegio, revisar tus solicitudes a la oficina y preparar un aviso de ausencia o un mensaje para que lo revises antes de enviarlo.',
        ),
      );
    }

    const ref = msg.match(REF);
    if (ref && has('get_request')) {
      const r = await call<{ reference: string; subject: string; status: string; updates: { from: string; date: string; text: string }[] }>('get_request', { number: Number(ref[1]) });
      if (!r.ok) return plain(say(lang, `I couldn't find request R-${ref[1]} for your family.`, `No encontré la solicitud R-${ref[1]} de tu familia.`));
      const lastUpdate = r.data.updates.filter((u) => u.from === 'school').at(-1);
      return plain(
        say(lang, `${r.data.reference} "${r.data.subject}" is ${r.data.status.toLowerCase()}.`, `${r.data.reference} "${r.data.subject}" está en estado: ${r.data.status}.`) +
          (lastUpdate ? say(lang, ` Latest reply from the school (${lastUpdate.date}): ${lastUpdate.text}`, ` Última respuesta del colegio (${lastUpdate.date}): ${lastUpdate.text}`) : ''),
      );
    }

    if (ABSENCE.test(msg) && !POLICY.test(msg) && has('prepare_absence_notice') && has('list_my_children')) return this.absence(msg, lang, today, call);

    if (OFFICE.test(msg) && has('prepare_office_request')) {
      const body = (msg.split(/\b(?:saying|that|diciendo|que diga|que)\b|:/i).slice(1).join(' ').trim() || msg).slice(0, 2000);
      const subject = body.replace(/\s+/g, ' ').slice(0, 80);
      const r = await call<{ summary: string }>('prepare_office_request', { kind: /\?|\b(ask|pregunt)/i.test(msg) ? 'question' : 'request', subject: subject.length >= 3 ? subject : 'Message from the assistant', body });
      if (!r.ok) return plain(say(lang, `I couldn't prepare that message: ${r.error}`, `No pude preparar ese mensaje: ${r.error}`));
      return plain(say(lang, 'I prepared a message to the office. Review it below and press Send if it looks right.', 'Preparé un mensaje para la oficina. Revísalo abajo y pulsa Enviar si está bien.'));
    }

    if (REQUESTS.test(msg) && has('list_my_requests')) {
      const r = await call<{ reference: string; subject: string; status: string }[]>('list_my_requests', { include: /\b(all|todas|todos)\b/i.test(msg) ? 'all' : 'open' });
      if (!r.ok) return plain(r.error);
      if (!r.data.length) return plain(say(lang, 'You have no open requests with the office.', 'No tienes solicitudes abiertas con la oficina.'));
      return plain(
        say(lang, 'Your open requests:', 'Tus solicitudes abiertas:') + '\n' + r.data.map((x) => `- ${x.reference} ${x.subject}: ${x.status}`).join('\n'),
      );
    }

    if (CHILDREN.test(msg) && has('list_my_children')) {
      const r = await call<Child[]>('list_my_children', {});
      if (!r.ok) return plain(r.error);
      if (!r.data.length) return plain(say(lang, 'The school\'s directory has no children linked to your account yet. The office can link them.', 'El directorio del colegio todavía no tiene hijos vinculados a tu cuenta. La oficina puede vincularlos.'));
      return plain(r.data.map((c) => `- ${c.name}${c.grade ? ` (${c.grade})` : ''}`).join('\n'));
    }

    if (CALENDAR.test(msg) && has('upcoming_events')) {
      const days = /\b(this week|esta semana)\b/i.test(msg) ? 7 : /\b(next|no school|day off|holiday|break|próxim\w*|no hay clase|vacaciones|feriado)\b/i.test(msg) ? 60 : 14;
      const r = await call<{ when: string; title: string; location: string | null }[]>('upcoming_events', { days });
      if (!r.ok) return plain(r.error);
      let list = r.data;
      if (/\b(no school|day off|holiday|break|no hay clase|vacaciones|feriado)\b/i.test(msg)) list = list.filter((e) => /no school|holiday|break|closed|day off|vacation|recess|no classes/i.test(e.title));
      if (!list.length) return plain(say(lang, `I don't see anything matching on the school calendar for the next ${days} days.`, `No veo nada que coincida en el calendario del colegio en los próximos ${days} días.`));
      return plain(say(lang, 'From the school calendar:', 'Del calendario del colegio:') + '\n' + list.slice(0, 8).map((e) => `- ${e.when}: ${e.title}${e.location ? ` (${e.location})` : ''}`).join('\n'));
    }

    if (has('search_school_info')) {
      const r = await call<{ source: string; title: string; text: string }[]>('search_school_info', { query: msg.slice(0, 200) });
      if (r.ok && r.data.length) {
        const top = r.data[0]!;
        const quote = bestSentence(top.text, msg);
        const second = r.data.find((x) => x.title !== top.title);
        const quote2 = second ? bestSentence(second.text, msg) : null;
        const answer = say(lang, `According to "${top.title}": ${quote}`, `Según "${top.title}": ${quote}`) + (second && quote2 ? `\n\n${say(lang, 'Also', 'También')} "${second.title}": ${quote2}` : '');
        const citations = [{ source: top.source, quote }];
        if (second && quote2) citations.push({ source: second.source, quote: quote2 });
        return { answer, citations };
      }
    }
    return plain(
      say(
        lang,
        'I couldn\'t find that in the information the school has shared, so I won\'t guess. You can ask the office, and I can prepare the message for you.',
        'No encontré eso en la información que ha compartido el colegio, así que no voy a adivinar. Puedes preguntar a la oficina; si quieres, preparo el mensaje.',
      ),
    );
  }

  private async absence(
    msg: string,
    lang: Lang,
    today: string,
    call: <T>(name: string, args: unknown) => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
  ): Promise<Final> {
    const plain = (answer: string): Final => ({ answer, citations: [] });
    const kids = await call<Child[]>('list_my_children', {});
    if (!kids.ok) return plain(kids.error);
    const allowed = kids.data.filter((k) => k.canReportAbsence);
    if (!allowed.length) {
      return plain(
        say(
          lang,
          'The school\'s directory has no children linked to your account that you can report absences for, so I can\'t prepare a notice. Please call the office.',
          'El directorio del colegio no tiene hijos vinculados a tu cuenta para los que puedas avisar ausencias, así que no puedo preparar el aviso. Llama a la oficina, por favor.',
        ),
      );
    }
    const lower = msg.toLowerCase();
    const named = allowed.filter((k) => lower.includes(k.name.split(' ')[0]!.toLowerCase()));
    const child = allowed.length === 1 ? allowed[0] : named.length === 1 ? named[0] : undefined;
    if (!child) return plain(say(lang, `Which child is it for: ${allowed.map((k) => k.name.split(' ')[0]).join(', ')}?`, `¿Para cuál de tus hijos es: ${allowed.map((k) => k.name.split(' ')[0]).join(', ')}?`));
    const type = /\b(late|tardy|tarde)\b/.test(lower) ? 'late' : /\b(early|pick (him|her|them) up|temprano|recoger)\b/.test(lower) ? 'early_dismissal' : 'absent';
    const date = findDate(msg, today);
    if (!date) return plain(say(lang, 'Which day is it for?', '¿Para qué día es?'));
    const time = type === 'absent' ? null : findTime(msg);
    if (type !== 'absent' && !time) return plain(say(lang, 'At what time?', '¿A qué hora?'));
    const reason = /\b(sick|ill|fever|flu|cold|enferm|fiebre|gripe|resfriad)/.test(lower)
      ? 'illness'
      : /\b(doctor|dentist|appointment|médico|medico|dentista|cita)/.test(lower)
        ? 'medical_appointment'
        : /\b(family|trip|funeral|familia|viaje)/.test(lower)
          ? 'family'
          : 'other';
    const r = await call<{ summary: string }>('prepare_absence_notice', { child: child.ref, type, dateFrom: date, ...(time ? { time } : {}), reason });
    if (!r.ok) return plain(say(lang, `I couldn't prepare the notice: ${r.error}`, `No pude preparar el aviso: ${r.error}`));
    return plain(say(lang, `I prepared this notice: ${r.data.summary} Review it below and press Send.`, `Preparé este aviso: ${r.data.summary} Revísalo abajo y pulsa Enviar.`));
  }
}

/** Scripted stand-in for the School Knowledge AI: quotes the best-matching passage. */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  async answer(input: AnswerInput): Promise<ModelAnswer> {
    await pause();
    const base = { model: MOCK_MODEL, inputTokens: 0, outputTokens: 0, costMicroUsd: 0 };
    const top = input.passages[0];
    if (!top) return { status: 'not_found', answer: '', citations: [], ...base };
    const quote = bestSentence(top.text, input.question);
    return { status: 'answered', answer: `According to "${top.title}": ${quote}`, citations: [{ source: top.n, quote }], ...base };
  }
}
