// ============================================================
// VOCAB ENGINE — AI-powered vocabulary question generator
// Uses a curated word bank organized by difficulty tier
// ============================================================

export interface VocabOption {
  label: "A" | "B" | "C" | "D";
  text: string;
  isCorrect: boolean;
  meaning?: string; // shown after answering
}

export interface VocabQuestion {
  word: string;
  meaning: string;
  root: string;
  type: "synonym" | "antonym";
  difficulty: number;
  options: VocabOption[];
  correctLabel: "A" | "B" | "C" | "D";
  correctAnswer: string;
}

export interface SavedWord {
  id: string;
  word: string;
  meaning: string;
  root: string;
  type: "synonym" | "antonym";
  difficulty: number;
  savedAt: number;
}

const VOCAB_STORAGE_KEY = "variant_saved_words";

// ============================================================
// VOCAB NO-REPEAT ENGINE — Fisher-Yates shuffle with localStorage
// Each difficulty tier has its own shuffled cycle stored in localStorage.
// Every word appears exactly once per cycle, different order each cycle.
// State survives page reloads. Never restarts from zero unless user resets.
// ============================================================

import { fisherYatesShuffle } from "./mathEngine";

// Per-tier localStorage keys
const tierShuffleKey = (tier: string): string =>
  `variant_vocab_shuffle_${tier}`;
const tierIndexKey = (tier: string): string => `variant_vocab_index_${tier}`;

/**
 * Pick the next word from a bank tier using Fisher-Yates + localStorage.
 * Guarantees: every word appears exactly once per cycle, no immediate repeats.
 */
function pickWordFisherYates(
  bank: (typeof WORD_BANK)[keyof typeof WORD_BANK],
  tier: string,
): (typeof bank)[number] {
  const allWords = bank.map((e) => e.word);
  let shuffled: string[];
  let index: number;

  try {
    const rawShuffled = localStorage.getItem(tierShuffleKey(tier));
    const rawIndex = localStorage.getItem(tierIndexKey(tier));

    if (!rawShuffled || !rawIndex) {
      // First load — initialize with fresh shuffle
      shuffled = fisherYatesShuffle(allWords);
      localStorage.setItem(tierShuffleKey(tier), JSON.stringify(shuffled));
      localStorage.setItem(tierIndexKey(tier), "0");
      index = 0;
    } else {
      shuffled = JSON.parse(rawShuffled) as string[];
      index = Number.parseInt(rawIndex, 10);

      // Reinitialize if word bank size changed
      if (shuffled.length !== allWords.length) {
        shuffled = fisherYatesShuffle(allWords);
        localStorage.setItem(tierShuffleKey(tier), JSON.stringify(shuffled));
        localStorage.setItem(tierIndexKey(tier), "0");
        index = 0;
      }

      // End of cycle — reshuffle with new random order, reset to 0
      if (index >= shuffled.length) {
        shuffled = fisherYatesShuffle(allWords);
        localStorage.setItem(tierShuffleKey(tier), JSON.stringify(shuffled));
        localStorage.setItem(tierIndexKey(tier), "1");
        index = 0;
      }
    }

    // Advance the index for next call
    localStorage.setItem(tierIndexKey(tier), String(index + 1));

    const wordName = shuffled[index];
    return (
      bank.find((e) => e.word === wordName) ??
      bank[Math.floor(Math.random() * bank.length)]
    );
  } catch {
    // localStorage unavailable — fall back to random
    return bank[Math.floor(Math.random() * bank.length)];
  }
}

export function getSavedWords(): SavedWord[] {
  try {
    const raw = localStorage.getItem(VOCAB_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedWord[];
  } catch {
    return [];
  }
}

export function saveWord(w: SavedWord): void {
  const existing = getSavedWords();
  if (existing.some((s) => s.id === w.id)) return;
  existing.push(w);
  localStorage.setItem(VOCAB_STORAGE_KEY, JSON.stringify(existing));
}

export function deleteSavedWord(id: string): void {
  const existing = getSavedWords().filter((s) => s.id !== id);
  localStorage.setItem(VOCAB_STORAGE_KEY, JSON.stringify(existing));
}

export function getDifficultyLabel(
  d: number,
): "Beginner" | "Intermediate" | "Advanced" | "Professional" {
  if (d <= 3) return "Beginner";
  if (d <= 6) return "Intermediate";
  if (d <= 8) return "Advanced";
  return "Professional";
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Extensive word bank organized by difficulty tier
const WORD_BANK: Record<
  "beginner" | "intermediate" | "advanced" | "professional",
  Array<{
    word: string;
    meaning: string;
    root: string;
    synonyms: string[];
    antonyms: string[];
  }>
> = {
  beginner: [
    {
      word: "abundant",
      meaning: "existing in large quantities; more than enough",
      root: "abund (Latin: to overflow)",
      synonyms: ["plentiful", "ample", "copious", "bountiful"],
      antonyms: ["scarce", "rare", "meager", "sparse"],
    },
    {
      word: "brave",
      meaning: "having or showing courage in the face of danger",
      root: "brav (Old French: wild, savage)",
      synonyms: ["courageous", "bold", "fearless", "valiant"],
      antonyms: ["cowardly", "timid", "fearful", "weak"],
    },
    {
      word: "swift",
      meaning: "moving or capable of moving at high speed",
      root: "Old English: swifan (to move)",
      synonyms: ["fast", "rapid", "quick", "speedy"],
      antonyms: ["slow", "sluggish", "leisurely", "gradual"],
    },
    {
      word: "cheerful",
      meaning: "noticeably happy and optimistic",
      root: "cheer (Old French: face, expression)",
      synonyms: ["happy", "joyful", "merry", "bright"],
      antonyms: ["gloomy", "sad", "morose", "sullen"],
    },
    {
      word: "diligent",
      meaning: "having or showing care and conscientiousness in one's work",
      root: "dilig (Latin: to esteem, love)",
      synonyms: ["hardworking", "industrious", "assiduous", "persistent"],
      antonyms: ["lazy", "idle", "careless", "negligent"],
    },
    {
      word: "frugal",
      meaning: "sparing or economical with money or food",
      root: "frugalis (Latin: virtuous, economical)",
      synonyms: ["thrifty", "economical", "prudent", "careful"],
      antonyms: ["wasteful", "lavish", "extravagant", "profligate"],
    },
    {
      word: "gentle",
      meaning: "mild in temperament or behavior; kind or tender",
      root: "gentilis (Latin: of the same clan)",
      synonyms: ["mild", "soft", "tender", "kind"],
      antonyms: ["harsh", "rough", "aggressive", "violent"],
    },
    {
      word: "humble",
      meaning: "having a modest view of one's own importance",
      root: "humilis (Latin: low, on the ground)",
      synonyms: ["modest", "unassuming", "meek", "unpretentious"],
      antonyms: ["arrogant", "proud", "boastful", "haughty"],
    },
    {
      word: "eager",
      meaning: "strongly wanting to do or have something",
      root: "acris (Latin: sharp, keen)",
      synonyms: ["keen", "enthusiastic", "zealous", "avid"],
      antonyms: ["reluctant", "indifferent", "apathetic", "unwilling"],
    },
    {
      word: "sincere",
      meaning: "free from pretense or deceit; genuine",
      root: "sincerus (Latin: whole, pure, genuine)",
      synonyms: ["genuine", "honest", "authentic", "heartfelt"],
      antonyms: ["insincere", "fake", "deceitful", "hypocritical"],
    },
  ],
  intermediate: [
    {
      word: "meticulous",
      meaning: "showing great attention to detail; very careful and precise",
      root: "metus (Latin: fear) — originally fearful, hence overly careful",
      synonyms: ["precise", "thorough", "scrupulous", "fastidious"],
      antonyms: ["careless", "sloppy", "haphazard", "negligent"],
    },
    {
      word: "benevolent",
      meaning: "well-meaning and kindly; generous",
      root: "bene (Latin: well) + volens (Latin: wishing)",
      synonyms: ["kind", "charitable", "generous", "philanthropic"],
      antonyms: ["malevolent", "cruel", "unkind", "miserly"],
    },
    {
      word: "ephemeral",
      meaning: "lasting for a very short time",
      root: "epi (Greek: on) + hemera (Greek: day)",
      synonyms: ["fleeting", "transient", "momentary", "brief"],
      antonyms: ["permanent", "lasting", "enduring", "eternal"],
    },
    {
      word: "tenacious",
      meaning: "tending to keep a firm hold; persistent and determined",
      root: "tenax (Latin: holding fast)",
      synonyms: ["persistent", "determined", "resolute", "steadfast"],
      antonyms: ["weak", "irresolute", "yielding", "flexible"],
    },
    {
      word: "gregarious",
      meaning: "fond of company; sociable",
      root: "grex (Latin: flock, herd)",
      synonyms: ["sociable", "outgoing", "affable", "convivial"],
      antonyms: ["solitary", "introverted", "reclusive", "antisocial"],
    },
    {
      word: "candid",
      meaning: "truthful and straightforward; frank",
      root: "candidus (Latin: white, pure)",
      synonyms: ["frank", "honest", "sincere", "forthright"],
      antonyms: ["dishonest", "evasive", "deceitful", "guarded"],
    },
    {
      word: "ambiguous",
      meaning: "open to more than one interpretation; unclear",
      root: "ambigere (Latin: to wander, to be uncertain)",
      synonyms: ["vague", "unclear", "equivocal", "nebulous"],
      antonyms: ["clear", "definite", "unambiguous", "explicit"],
    },
    {
      word: "aloof",
      meaning: "not friendly or forthcoming; cold and distant",
      root: "a- (on) + lof (Dutch: windward side of a ship)",
      synonyms: ["distant", "detached", "reserved", "standoffish"],
      antonyms: ["friendly", "warm", "sociable", "approachable"],
    },
    {
      word: "zealous",
      meaning: "having or showing great energy or enthusiasm",
      root: "zelus (Greek/Latin: zeal, jealousy)",
      synonyms: ["enthusiastic", "fervent", "ardent", "passionate"],
      antonyms: ["apathetic", "indifferent", "lukewarm", "disinterested"],
    },
    {
      word: "prudent",
      meaning: "acting with care and thought for the future",
      root: "prudens (Latin: foreseeing, wise)",
      synonyms: ["cautious", "wise", "judicious", "discreet"],
      antonyms: ["reckless", "imprudent", "rash", "foolish"],
    },
  ],
  advanced: [
    {
      word: "magnanimous",
      meaning:
        "generous or forgiving, especially toward a rival or less powerful person",
      root: "magnus (Latin: great) + animus (Latin: soul, spirit)",
      synonyms: ["generous", "noble", "benevolent", "gracious"],
      antonyms: ["petty", "vindictive", "mean-spirited", "grudging"],
    },
    {
      word: "perspicacious",
      meaning: "having a ready insight into things; shrewdly perceptive",
      root: "perspicax (Latin: sharp-sighted)",
      synonyms: ["perceptive", "astute", "shrewd", "discerning"],
      antonyms: ["obtuse", "imperceptive", "unobservant", "dense"],
    },
    {
      word: "sycophant",
      meaning:
        "a person who acts obsequiously toward someone important to gain advantage",
      root: "sykophantes (Greek: informer, slanderer)",
      synonyms: ["flatterer", "toady", "fawner", "yes-man"],
      antonyms: ["critic", "detractor", "independent", "challenger"],
    },
    {
      word: "truculent",
      meaning: "eager or quick to argue or fight; aggressively defiant",
      root: "truculentus (Latin: fierce, savage)",
      synonyms: ["aggressive", "belligerent", "combative", "pugnacious"],
      antonyms: ["peaceful", "docile", "compliant", "amenable"],
    },
    {
      word: "equanimity",
      meaning: "calmness and composure, especially in difficult situations",
      root: "aequus (Latin: equal) + animus (Latin: mind)",
      synonyms: ["composure", "serenity", "poise", "tranquility"],
      antonyms: ["agitation", "anxiety", "turmoil", "distress"],
    },
    {
      word: "loquacious",
      meaning: "tending to talk a great deal; talkative",
      root: "loquax (Latin: talkative)",
      synonyms: ["talkative", "garrulous", "voluble", "verbose"],
      antonyms: ["reticent", "taciturn", "quiet", "reserved"],
    },
    {
      word: "perfidious",
      meaning: "guilty of betrayal; treacherous",
      root: "perfidia (Latin: treachery)",
      synonyms: ["treacherous", "disloyal", "deceitful", "faithless"],
      antonyms: ["loyal", "faithful", "trustworthy", "reliable"],
    },
    {
      word: "inveterate",
      meaning:
        "having a particular habit, activity, or interest that is long-established",
      root: "inveteratus (Latin: of long standing)",
      synonyms: ["habitual", "chronic", "confirmed", "entrenched"],
      antonyms: ["occasional", "temporary", "sporadic", "new"],
    },
    {
      word: "querulous",
      meaning: "complaining in a petulant or whining manner",
      root: "querulus (Latin: complaining)",
      synonyms: ["complaining", "petulant", "grumbling", "whining"],
      antonyms: ["content", "satisfied", "stoic", "placid"],
    },
    {
      word: "insidious",
      meaning: "proceeding in a gradual, subtle way, but with harmful effects",
      root: "insidiae (Latin: ambush, trap)",
      synonyms: ["subtle", "stealthy", "cunning", "treacherous"],
      antonyms: ["harmless", "straightforward", "honest", "benign"],
    },
  ],
  professional: [
    {
      word: "pusillanimous",
      meaning: "showing a lack of courage or determination; timid",
      root: "pusillus (Latin: very small) + animus (Latin: spirit)",
      synonyms: ["cowardly", "timorous", "craven", "spineless"],
      antonyms: ["brave", "courageous", "intrepid", "dauntless"],
    },
    {
      word: "obsequious",
      meaning: "obedient or attentive to an excessive or servile degree",
      root: "obsequium (Latin: compliance, deference)",
      synonyms: ["servile", "fawning", "subservient", "sycophantic"],
      antonyms: ["assertive", "independent", "defiant", "proud"],
    },
    {
      word: "recalcitrant",
      meaning: "having an obstinately uncooperative attitude toward authority",
      root: "recalcitrare (Latin: to kick back)",
      synonyms: ["defiant", "refractory", "obstinate", "intractable"],
      antonyms: ["compliant", "docile", "cooperative", "amenable"],
    },
    {
      word: "supercilious",
      meaning: "behaving as if one is superior to others; condescending",
      root: "supercilium (Latin: eyebrow — raised in disdain)",
      synonyms: ["condescending", "arrogant", "haughty", "disdainful"],
      antonyms: ["humble", "modest", "deferential", "unassuming"],
    },
    {
      word: "inimical",
      meaning: "tending to obstruct or harm; hostile",
      root: "inimicus (Latin: enemy)",
      synonyms: ["hostile", "adverse", "antagonistic", "unfriendly"],
      antonyms: ["friendly", "beneficial", "supportive", "amicable"],
    },
    {
      word: "laconic",
      meaning: "using very few words; brief and concise in speech",
      root: "Lakon (Greek: Spartan, who were known for brevity)",
      synonyms: ["brief", "terse", "succinct", "pithy"],
      antonyms: ["verbose", "loquacious", "garrulous", "wordy"],
    },
    {
      word: "pellucid",
      meaning: "translucently clear; easily understood",
      root: "pellucidus (Latin: transparent)",
      synonyms: ["clear", "transparent", "lucid", "limpid"],
      antonyms: ["opaque", "murky", "obscure", "cloudy"],
    },
    {
      word: "garrulous",
      meaning: "excessively talkative, especially on trivial matters",
      root: "garrulus (Latin: chattering)",
      synonyms: ["talkative", "loquacious", "verbose", "long-winded"],
      antonyms: ["taciturn", "reserved", "reticent", "concise"],
    },
    {
      word: "perfunctory",
      meaning: "carried out with minimum effort; lacking care",
      root: "perfungi (Latin: to get through with)",
      synonyms: ["cursory", "superficial", "hasty", "routine"],
      antonyms: ["thorough", "careful", "diligent", "attentive"],
    },
    {
      word: "inveterate",
      meaning: "deeply entrenched by long habit",
      root: "inveteratus (Latin: of long standing)",
      synonyms: ["habitual", "confirmed", "chronic", "deep-rooted"],
      antonyms: ["occasional", "incidental", "sporadic", "reformed"],
    },
  ],
};

// Flat map: every synonym/antonym word → a short meaning string
// Built lazily so it doesn't run at module parse time.
let _wordMeaningMap: Map<string, string> | null = null;

function getWordMeaningMap(): Map<string, string> {
  if (_wordMeaningMap) return _wordMeaningMap;
  _wordMeaningMap = new Map<string, string>();
  for (const tier of Object.values(WORD_BANK)) {
    for (const entry of tier) {
      // Map every synonym to the main word meaning (best we can without a thesaurus DB)
      for (const syn of entry.synonyms) {
        if (!_wordMeaningMap.has(syn)) {
          _wordMeaningMap.set(
            syn,
            `Synonym of "${entry.word}" — ${entry.meaning}`,
          );
        }
      }
      for (const ant of entry.antonyms) {
        if (!_wordMeaningMap.has(ant)) {
          _wordMeaningMap.set(
            ant,
            `Antonym of "${entry.word}" — ${entry.meaning}`,
          );
        }
      }
      // Also map the headword itself
      if (!_wordMeaningMap.has(entry.word)) {
        _wordMeaningMap.set(entry.word, entry.meaning);
      }
    }
  }
  return _wordMeaningMap;
}

function getTierKey(
  difficulty: number,
): "beginner" | "intermediate" | "advanced" | "professional" {
  if (difficulty <= 3) return "beginner";
  if (difficulty <= 6) return "intermediate";
  if (difficulty <= 8) return "advanced";
  return "professional";
}

function getWordFromBank(
  difficulty: number,
  type: "synonym" | "antonym",
): VocabQuestion {
  const tier = getTierKey(difficulty);
  const bank = WORD_BANK[tier];

  // Use Fisher-Yates localStorage cycle picker — no repeats until all words exhausted
  const entry = pickWordFisherYates(bank, tier as string);

  const correct =
    type === "synonym"
      ? entry.synonyms[Math.floor(Math.random() * entry.synonyms.length)]
      : entry.antonyms[Math.floor(Math.random() * entry.antonyms.length)];

  // Pick 3 distractors from the OTHER list to make the question meaningful
  const distractorPool = type === "synonym" ? entry.antonyms : entry.synonyms;
  const distractors = shuffleArray(distractorPool).slice(0, 3);

  const allOptions = shuffleArray([correct, ...distractors]);
  const labels: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];

  const meaningMap = getWordMeaningMap();
  const options: VocabOption[] = allOptions.slice(0, 4).map((text, i) => ({
    label: labels[i],
    text,
    isCorrect: text === correct,
    meaning:
      meaningMap.get(text.toLowerCase()) ?? meaningMap.get(text) ?? undefined,
  }));

  const correctLabel = options.find((o) => o.isCorrect)?.label ?? "A";

  return {
    word: entry.word,
    meaning: entry.meaning,
    root: entry.root,
    type,
    difficulty,
    options,
    correctLabel,
    correctAnswer: correct,
  };
}

export async function generateVocabQuestion(
  difficulty: number,
  type: "synonym" | "antonym",
): Promise<VocabQuestion> {
  // The word bank is curated and high-quality.
  // An external AI API can be plugged in here in the future.
  return getWordFromBank(difficulty, type);
}
