// Local, heuristic collection names from the cards' sites and title words.
// Deliberately simple and predictable; nothing leaves the machine.
import type { Card } from './types';

const MAX_LENGTH = 48;
/** Share of cards that must come from one site for it to name the collection. */
const SITE_SHARE = 0.6;
/** Share of cards a title word must appear in to count as a theme. */
const WORD_SHARE = 0.5;

const KNOWN_SITES: Record<string, string> = {
  'github.com': 'GitHub',
  'gitlab.com': 'GitLab',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'stackoverflow.com': 'Stack Overflow',
  'developer.mozilla.org': 'MDN',
  'docs.google.com': 'Google Docs',
  'drive.google.com': 'Google Drive',
  'mail.google.com': 'Gmail',
  'maps.google.com': 'Google Maps',
  'reddit.com': 'Reddit',
  'wikipedia.org': 'Wikipedia',
  'twitter.com': 'X',
  'x.com': 'X',
  'linkedin.com': 'LinkedIn',
  'news.ycombinator.com': 'Hacker News',
  'npmjs.com': 'npm',
  'notion.so': 'Notion',
  'figma.com': 'Figma',
  'medium.com': 'Medium',
};

const STOPWORDS = new Set(
  (
    'the and for with from your you our are was were this that these those into onto about over under ' +
    'how what why when where who which can will not but all any its his her their them they has have had ' +
    'get got new best top free online official site page home welcome login sign log untitled tab tabs ' +
    'via using use one two more most less vs per out off now just also than then there here very ' +
    'www com org net html http https index docs guide'
  ).split(' '),
);

function siteName(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
  if (!host || host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':')) return null;
  const known = KNOWN_SITES[host];
  if (known) return known;

  const labels = host.split('.');
  // Approximate the registrable domain: example.co.uk → example, docs.python.org → python.
  const secondLevel = labels.at(-2) ?? '';
  const isCountrySld = labels.length > 2 && labels.at(-1)!.length === 2 && secondLevel.length <= 3;
  const registrable = labels.slice(isCountrySld ? -3 : -2).join('.');
  const knownRegistrable = KNOWN_SITES[registrable];
  if (knownRegistrable) return knownRegistrable;
  const label = registrable.split('.')[0] ?? '';
  return label ? label[0]!.toUpperCase() + label.slice(1) : null;
}

const cardText = (card: Card) => card.customTitle || card.title || '';

function tokens(title: string): string[] {
  return title.split(/[^\p{L}\p{N}+#]+/u).filter((t) => {
    if (/^\d+$/.test(t)) return false;
    // Keep short acronyms like AI, UI, JS; drop other short words.
    return t.length >= 3 || (t.length === 2 && t === t.toUpperCase() && /\p{L}/u.test(t));
  });
}

function display(word: string): string {
  return word === word.toLowerCase() ? word[0]!.toUpperCase() + word.slice(1) : word;
}

function truncate(text: string): string {
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1).trimEnd()}…` : text;
}

/** Most common site among the cards, if it accounts for enough of them. */
function dominantSites(cards: Card[]) {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const site = siteName(card.url);
    if (site) counts.set(site, (counts.get(site) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
}

/** Title words shared by enough cards, ordered as they tend to appear in titles. */
function themeWords(cards: Card[], ignore: Set<string>): string[] {
  const stats = new Map<string, { df: number; forms: Map<string, number>; position: number; first: number }>();
  cards.forEach((card, cardIndex) => {
    const seen = new Set<string>();
    tokens(cardText(card)).forEach((token, position) => {
      const key = token.toLowerCase();
      if (STOPWORDS.has(key) || ignore.has(key) || seen.has(key)) return;
      seen.add(key);
      const s = stats.get(key) ?? { df: 0, forms: new Map(), position: 0, first: cardIndex };
      s.df++;
      s.position += position;
      s.forms.set(token, (s.forms.get(token) ?? 0) + 1);
      stats.set(key, s);
    });
  });

  const threshold = Math.max(2, Math.ceil(cards.length * WORD_SHARE));
  return [...stats.values()]
    .filter((s) => s.df >= threshold)
    .sort((a, b) => b.df - a.df || a.first - b.first)
    .slice(0, 2)
    .sort((a, b) => a.position / a.df - b.position / b.df)
    .map((s) => display([...s.forms].sort((a, b) => b[1] - a[1])[0]![0]));
}

/** Names a single link: the most specific part of its title, without the site suffix. */
function suggestForOne(card: Card): string | null {
  const site = siteName(card.url);
  const parts = cardText(card)
    .split(/\s+[-|–—·:]\s+/)
    .map((p) => p.trim())
    .filter((p) => p && p.toLowerCase() !== site?.toLowerCase());
  const name = parts[0] ?? site;
  return name ? truncate(name) : null;
}

export function suggestName(cards: Card[]): string | null {
  if (cards.length === 0) return null;
  if (cards.length === 1) return suggestForOne(cards[0]!);

  const sites = dominantSites(cards);
  const ignore = new Set(sites.flatMap(([site]) => site.toLowerCase().split(' ')));
  const words = themeWords(cards, ignore);
  const [top, second] = sites;
  const dominant = top && top[1] / cards.length >= SITE_SHARE ? top[0] : null;

  if (words.length > 0) return truncate(dominant ? `${words.join(' ')} · ${dominant}` : words.join(' '));
  if (dominant) return dominant;
  // Two sites that together cover nearly everything, e.g. "GitHub & Stack Overflow".
  if (top && second && second[1] >= 2 && (top[1] + second[1]) / cards.length >= 0.8) {
    return `${top[0]} & ${second[0]}`;
  }
  return null;
}
