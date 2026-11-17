// A small Markdown renderer for school-written text (announcements, events,
// volunteer details, assistant answers): headings, paragraphs, bullet and
// numbered lists, **bold**, *italic* and [links](https://…). Anything else
// shows as plain text; no HTML is ever rendered.

import { Linking, View } from 'react-native';

import { spacing } from '@/theme/tokens';

import { Text } from './primitives';

type Inline = { text: string; bold?: boolean; italic?: boolean; url?: string };

function inline(src: string): Inline[] {
  const out: Inline[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+|tel:[^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  for (const m of src.matchAll(re)) {
    if (m.index! > last) out.push({ text: src.slice(last, m.index) });
    if (m[1]) out.push({ text: m[1], url: m[2] });
    else if (m[3] || m[4]) out.push({ text: (m[3] ?? m[4])!, bold: true });
    else if (m[5] || m[6]) out.push({ text: (m[5] ?? m[6])!, italic: true });
    else if (m[7]) out.push({ text: m[7], url: m[7] });
    last = m.index! + m[0].length;
  }
  if (last < src.length) out.push({ text: src.slice(last) });
  return out;
}

function Spans({ src }: { src: string }) {
  return (
    <>
      {inline(src).map((s, i) =>
        s.url ? (
          <Text key={i} tone="tint" accessibilityRole="link" onPress={() => void Linking.openURL(s.url!)} style={{ textDecorationLine: 'underline' }}>
            {s.text}
          </Text>
        ) : (
          <Text key={i} style={{ fontWeight: s.bold ? '700' : undefined, fontStyle: s.italic ? 'italic' : undefined }}>
            {s.text}
          </Text>
        ),
      )}
    </>
  );
}

type Block = { kind: 'h'; text: string } | { kind: 'p'; text: string } | { kind: 'li'; text: string; marker: string };

function blocks(md: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: 'p', text: para.join(' ') });
    para = [];
  };
  for (const raw of md.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    const ul = /^[-*+]\s+(.*)$/.exec(line);
    const ol = /^(\d+)[.)]\s+(.*)$/.exec(line);
    if (h) {
      flush();
      out.push({ kind: 'h', text: h[1]! });
    } else if (ul) {
      flush();
      out.push({ kind: 'li', text: ul[1]!, marker: '•' });
    } else if (ol) {
      flush();
      out.push({ kind: 'li', text: ol[2]!, marker: `${ol[1]}.` });
    } else if (/^(-{3,}|\*{3,})$/.test(line)) {
      flush();
    } else {
      para.push(line.replace(/^>\s?/, ''));
    }
  }
  flush();
  return out;
}

export function Markdown({ text }: { text: string }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {blocks(text).map((b, i) =>
        b.kind === 'h' ? (
          <Text key={i} variant="headline" accessibilityRole="header" style={{ marginTop: i ? spacing.sm : 0 }}>
            <Spans src={b.text} />
          </Text>
        ) : b.kind === 'li' ? (
          <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, paddingLeft: spacing.xs }}>
            <Text variant="body">{b.marker}</Text>
            <Text variant="body" style={{ flex: 1 }}>
              <Spans src={b.text} />
            </Text>
          </View>
        ) : (
          <Text key={i} variant="body">
            <Spans src={b.text} />
          </Text>
        ),
      )}
    </View>
  );
}
