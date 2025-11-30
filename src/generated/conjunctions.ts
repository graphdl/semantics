// AUTO-GENERATED - DO NOT EDIT
// Generated from .enrichment/Language/Language.Conjunctions.tsv

export interface ConjunctionEntry {
  type: 'coordinating' | 'subordinating' | 'correlative'
  expansion: 'cartesian' | 'compound' | 'conditional'
}

const CONJUNCTION_DATA = [
  {
    "word": "and",
    "type": "connects words, phrases, or clauses",
    "expansion": "Coordinating"
  },
  {
    "word": "but",
    "type": "introduces a contrast or exception",
    "expansion": "Coordinating"
  },
  {
    "word": "or",
    "type": "presents alternatives",
    "expansion": "Coordinating"
  },
  {
    "word": "nor",
    "type": "negative alternative",
    "expansion": "Coordinating"
  },
  {
    "word": "for",
    "type": "indicates reason or purpose",
    "expansion": "Coordinating"
  },
  {
    "word": "so",
    "type": "indicates result or consequence",
    "expansion": "Coordinating"
  },
  {
    "word": "yet",
    "type": "introduces a contrasting idea",
    "expansion": "Coordinating"
  },
  {
    "word": "after",
    "type": "follows in time",
    "expansion": "Subordinating"
  },
  {
    "word": "although",
    "type": "despite the fact that",
    "expansion": "Subordinating"
  },
  {
    "word": "as",
    "type": "at the same time; because",
    "expansion": "Subordinating"
  },
  {
    "word": "because",
    "type": "for the reason that",
    "expansion": "Subordinating"
  },
  {
    "word": "before",
    "type": "earlier than",
    "expansion": "Subordinating"
  },
  {
    "word": "if",
    "type": "on the condition that",
    "expansion": "Subordinating"
  },
  {
    "word": "once",
    "type": "as soon as",
    "expansion": "Subordinating"
  },
  {
    "word": "since",
    "type": "from a time in the past",
    "expansion": "Subordinating"
  },
  {
    "word": "than",
    "type": "introduces comparison",
    "expansion": "Subordinating"
  },
  {
    "word": "that",
    "type": "introduces a clause",
    "expansion": "Subordinating"
  },
  {
    "word": "though",
    "type": "despite the fact",
    "expansion": "Subordinating"
  },
  {
    "word": "till",
    "type": "up to the time when",
    "expansion": "Subordinating"
  },
  {
    "word": "unless",
    "type": "except on the condition that",
    "expansion": "Subordinating"
  },
  {
    "word": "until",
    "type": "up to the time that",
    "expansion": "Subordinating"
  },
  {
    "word": "when",
    "type": "at or during the time that",
    "expansion": "Subordinating"
  },
  {
    "word": "where",
    "type": "at or in which place",
    "expansion": "Subordinating"
  },
  {
    "word": "whereas",
    "type": "in contrast to the fact that",
    "expansion": "Subordinating"
  },
  {
    "word": "wherever",
    "type": "in or to whatever place",
    "expansion": "Subordinating"
  },
  {
    "word": "whether",
    "type": "if; either",
    "expansion": "Subordinating"
  },
  {
    "word": "while",
    "type": "during the time that",
    "expansion": "Subordinating"
  },
  {
    "word": "both",
    "type": "the two; one and the other",
    "expansion": "Correlative"
  },
  {
    "word": "either",
    "type": "one or the other of two",
    "expansion": "Correlative"
  },
  {
    "word": "neither",
    "type": "not one nor the other",
    "expansion": "Correlative"
  },
  {
    "word": "not",
    "type": "negation",
    "expansion": "Correlative"
  }
]

export const CONJUNCTIONS = new Map<string, ConjunctionEntry>()

for (const conj of CONJUNCTION_DATA) {
  CONJUNCTIONS.set(conj.word.toLowerCase(), {
    type: conj.type as 'coordinating' | 'subordinating' | 'correlative',
    expansion: conj.expansion as 'cartesian' | 'compound' | 'conditional',
  })
}
