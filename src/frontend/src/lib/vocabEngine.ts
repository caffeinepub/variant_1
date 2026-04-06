// ============================================================
// VOCAB ENGINE — AI-powered vocabulary question generator
// Uses a curated word bank organized by difficulty tier
// ============================================================

export interface VocabOption {
  label: "A" | "B" | "C" | "D";
  text: string;
  isCorrect: boolean;
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
  ],
};

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
  const entry = bank[Math.floor(Math.random() * bank.length)];

  const correct =
    type === "synonym"
      ? entry.synonyms[Math.floor(Math.random() * entry.synonyms.length)]
      : entry.antonyms[Math.floor(Math.random() * entry.antonyms.length)];

  // Pick 3 distractors from the OTHER list to make the question meaningful
  const distractorPool = type === "synonym" ? entry.antonyms : entry.synonyms;
  const distractors = shuffleArray(distractorPool).slice(0, 3);

  const allOptions = shuffleArray([correct, ...distractors]);
  const labels: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];

  const options: VocabOption[] = allOptions.slice(0, 4).map((text, i) => ({
    label: labels[i],
    text,
    isCorrect: text === correct,
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
