import { VERB_INDEX, VerbEntry as GeneratedVerbEntry } from './generated/verbs.js'
import { CONCEPT_INDEX, ConceptEntry as GeneratedConceptEntry } from './generated/concepts.js'
import { PREPOSITIONS } from './generated/prepositions.js'
import { CONJUNCTIONS, ConjunctionEntry as GeneratedConjunctionEntry } from './generated/conjunctions.js'
import fs from 'fs'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Lexicon {
  verbs: Map<string, VerbEntry>
  nouns: Map<string, NounEntry>
  concepts: Map<string, ConceptEntry>
  prepositions: ReadonlySet<string> | Set<string>
  conjunctions: Map<string, ConjunctionEntry>
  determiners: Set<string>
  pronouns: Map<string, PronounEntry>
  adverbs: Map<string, AdverbEntry>
  adjectives: Set<string>
}

export interface VerbEntry {
  canonicalForm: string
  predicate: string
  event: string
  activity: string
  actor: string
  object: string
  inverse: string
}

export interface NounEntry {
  canonicalForm: string
  category?: string
}

export interface ConceptEntry {
  id: string
  description: string
  baseNoun: string
  modifiers: string
  category: string
}

export interface ConjunctionEntry {
  type: 'coordinating' | 'subordinating' | 'correlative'
  expansion: 'cartesian' | 'compound' | 'conditional'
}

export interface PronounEntry {
  type: string
  category: string
}

export interface AdverbEntry {
  category: string
}

export interface Token {
  text: string
  pos: string // part of speech
  index: number
  normalized: string
}

export interface ParsedStatement {
  original: string
  subject?: string
  predicate?: string
  object?: string
  preposition?: string
  complement?: string
  modifiers: string[]
  confidence: number
  unknownWords: string[]
  expansions?: ParsedStatement[]
  hasConjunction?: boolean
}

// ============================================================================
// LEXICON LOADER
// ============================================================================

export class LexiconLoader {
  async load(): Promise<Lexicon> {
    const lexicon: Lexicon = {
      verbs: VERB_INDEX,
      nouns: new Map(),
      concepts: CONCEPT_INDEX,
      prepositions: PREPOSITIONS,
      conjunctions: CONJUNCTIONS,
      determiners: this.loadDeterminers(),
      pronouns: new Map(),
      adverbs: new Map(),
      adjectives: new Set(),
    }

    return lexicon
  }

  private loadDeterminers(): Set<string> {
    return new Set([
      'a',
      'an',
      'the',
      'this',
      'that',
      'these',
      'those',
      'my',
      'your',
      'his',
      'her',
      'its',
      'our',
      'their',
      'some',
      'any',
      'all',
      'each',
      'every',
      'no',
      'none',
      'few',
      'many',
      'much',
      'several',
      'more',
      'most',
      'less',
      'least',
    ])
  }
}

// ============================================================================
// TOKENIZER
// ============================================================================

export class Tokenizer {
  tokenize(text: string): Token[] {
    // Split on whitespace and punctuation, but keep punctuation
    const regex = /([a-zA-Z]+(?:'[a-z]+)?|[.,;:\-\/()])/g
    const matches = text.matchAll(regex)

    const tokens: Token[] = []
    let index = 0

    for (const match of matches) {
      const text = match[0]
      tokens.push({
        text,
        normalized: text.toLowerCase(),
        pos: '', // Will be filled by POS tagger
        index: index++,
      })
    }

    return tokens
  }
}

// ============================================================================
// POS TAGGER
// ============================================================================

export class POSTagger {
  constructor(private lexicon: Lexicon) {}

  tag(tokens: Token[]): Token[] {
    // First pass: assign POS based on lexicon
    const tagged = tokens.map(token => {
      const norm = token.normalized

      // Check each part of speech
      if (this.lexicon.determiners.has(norm)) {
        token.pos = 'DET'
      } else if (this.lexicon.pronouns.has(norm)) {
        token.pos = 'PRON'
      } else if (this.lexicon.verbs.has(norm)) {
        token.pos = 'VERB'
      } else if (this.lexicon.prepositions.has(norm)) {
        token.pos = 'PREP'
      } else if (this.lexicon.conjunctions.has(norm)) {
        token.pos = 'CONJ'
      } else if (this.lexicon.adverbs.has(norm)) {
        token.pos = 'ADV'
      } else if (this.lexicon.adjectives.has(norm)) {
        token.pos = 'ADJ'
      } else if (token.text.match(/^[A-Z]/)) {
        // TitleCase = Noun (GraphDL convention)
        token.pos = 'NOUN'
      } else if (token.text.match(/^[a-z]/)) {
        // camelCase or lowercase = likely verb or adjective
        token.pos = 'UNK-VERB'
      } else if (token.text.match(/[.,;:\-\/()]/)) {
        token.pos = 'PUNCT'
      } else {
        token.pos = 'UNK'
      }

      return token
    })

    // Second pass: contextual disambiguation
    // Words ending in -ing that are followed by a noun are likely noun modifiers, not verbs
    // e.g., "building design" - "building" is a noun modifier, not a verb
    for (let i = 0; i < tagged.length - 1; i++) {
      const current = tagged[i]
      const next = tagged[i + 1]

      // If current is tagged as VERB and ends in -ing, check context
      if (current.pos === 'VERB' && current.normalized.endsWith('ing')) {
        // If followed by a noun (or something that looks like a noun), re-tag as NOUN
        // Common gerunds used as nouns: building, planning, manufacturing, shipping, etc.
        if (next.pos === 'NOUN' || next.pos === 'UNK' ||
            (next.pos === 'VERB' && !next.normalized.endsWith('ing')) ||
            next.text.match(/^[A-Z]/)) {
          current.pos = 'NOUN'
        }
      }
    }

    // Also check: if -ing word is the LAST word, it's likely a noun (no object follows)
    if (tagged.length > 0) {
      const last = tagged[tagged.length - 1]
      if (last.pos === 'VERB' && last.normalized.endsWith('ing')) {
        // Re-check if this is actually a gerund used as noun
        // In imperative sentences, verbs have objects, so a trailing -ing is often a noun
        last.pos = 'NOUN'
      }
    }

    return tagged
  }
}

// ============================================================================
// CONJUNCTION EXPANDER
// ============================================================================

export class ConjunctionExpander {
  constructor(private lexicon: Lexicon) {}

  /**
   * Expands conjunctions like "and/or" to create subtasks
   * Example: "Develop Vision and Strategy" -> ["Develop Vision", "Develop Strategy"]
   */
  expand(text: string): string[] {
    // Check if there's an "and" or "or" in the text
    const hasConjunction = /\b(and|or)\b/i.test(text)

    if (!hasConjunction) {
      return [text]
    }

    // Pattern: "Verb Object1 and Object2" or "Verb1 and Verb2 Object"
    // Split into parts but preserve the verb
    const words = text.split(/\s+/)

    // Find the first verb (usually first word in imperative)
    let verb = words[0]

    // Find conjunction indices
    const conjunctionIndices: number[] = []
    words.forEach((word, idx) => {
      if (word.toLowerCase() === 'and' || word.toLowerCase() === 'or') {
        conjunctionIndices.push(idx)
      }
    })

    if (conjunctionIndices.length === 0) {
      return [text]
    }

    // Simple case: "Verb Noun1 and Noun2"
    // Split on conjunction and create subtasks
    const results: string[] = []

    // For now, return original - we'll handle in parser
    return [text]
  }

  private splitOnCoordinating(text: string): string[][] {
    // Find all coordinating conjunctions (and, or)
    const tokens = text.split(/\s+/)
    const groups: string[][] = [[]]
    let currentGroup = 0

    for (const token of tokens) {
      const norm = token.toLowerCase().replace(/[,;]/g, '')

      if (norm === 'and' || norm === 'or') {
        currentGroup++
        groups[currentGroup] = []
      } else {
        if (!groups[currentGroup]) groups[currentGroup] = []
        groups[currentGroup].push(token)
      }
    }

    return groups.filter(g => g.length > 0)
  }

  private cartesianProduct(groups: string[][]): string[] {
    if (groups.length === 0) return []
    if (groups.length === 1) return [groups[0].join(' ')]

    const result: string[] = []
    const [first, ...rest] = groups
    const restProduct = this.cartesianProduct(rest)

    for (const item of first) {
      for (const restItem of restProduct) {
        result.push(`${item} ${restItem}`)
      }
    }

    return result
  }
}

// ============================================================================
// STATEMENT PARSER
// ============================================================================

export class StatementParser {
  private tokenizer: Tokenizer
  private tagger: POSTagger
  private expander: ConjunctionExpander

  constructor(private lexicon: Lexicon) {
    this.tokenizer = new Tokenizer()
    this.tagger = new POSTagger(lexicon)
    this.expander = new ConjunctionExpander(lexicon)
  }

  private capitalize(text: string): string {
    if (!text) return text
    return text.charAt(0).toUpperCase() + text.slice(1)
  }

  /**
   * Parse a natural language statement into GraphDL structure
   * Target: Subject.predicate.Object.preposition.Complement
   */
  parse(text: string): ParsedStatement {
    // Check for slash-separated verbs: "Research/Resolve order exceptions"
    const slashVerbMatch = text.match(/^(\w+)\/(\w+)\s+(.+)$/i)
    if (slashVerbMatch) {
      const [, verb1, verb2, rest] = slashVerbMatch
      if (this.lexicon.verbs.has(verb1.toLowerCase()) && this.lexicon.verbs.has(verb2.toLowerCase())) {
        return {
          original: text,
          predicate: this.capitalize(verb1),
          object: `and ${verb2} ${rest}`,
          modifiers: [],
          confidence: 1,
          unknownWords: [],
          hasConjunction: true,
          expansions: [
            this.parseSingle(`${this.capitalize(verb1)} ${rest}`),
            this.parseSingle(`${this.capitalize(verb2)} ${rest}`),
          ],
        }
      }
    }

    // Check for Oxford comma verb lists: "Verb1, Verb2, and/or Verb3 Object"
    // Requires at least one comma in the verb list to distinguish from simple "Verb1 and Verb2"
    const oxfordCommaMatch = text.match(/^(\w+,\s*\w+(?:,\s*\w+)*),?\s+(and|or)\s+(\w+)\s+(.+)$/i)
    if (oxfordCommaMatch) {
      const [, verbList, conj, lastVerb, rest] = oxfordCommaMatch
      const verbs = verbList.split(/,\s*/).concat([lastVerb])

      // Check if first word is a verb (imperative sentences start with verb)
      // Don't require ALL to be verbs (some may be missing from lexicon)
      const firstIsVerb = this.lexicon.verbs.has(verbs[0].toLowerCase())
      // Also check that the "rest" doesn't start with a verb (which would indicate wrong split)
      const restWords = rest.trim().split(/\s+/)
      const restStartsWithVerb = restWords.length > 0 && this.lexicon.verbs.has(restWords[0].toLowerCase())

      if (firstIsVerb && !restStartsWithVerb && verbs.length >= 3) {
        // Recursively expand the rest if it has "such as" or other patterns
        let allExpansions: ParsedStatement[] = []
        for (const verb of verbs) {
          const verbText = `${this.capitalize(verb)} ${rest}`
          const needsExpansion = /\bsuch as\b/i.test(rest) || /\b(and|or)\b/i.test(rest) || rest.includes(',')
          if (needsExpansion) {
            const subExpansions = this.expandRawText(verbText)
            if (subExpansions.length > 1) {
              allExpansions.push(...subExpansions.map(exp => this.parseSingle(exp)))
            } else {
              allExpansions.push(this.parseSingle(verbText))
            }
          } else {
            allExpansions.push(this.parseSingle(verbText))
          }
        }
        return {
          original: text,
          predicate: this.capitalize(verbs[0]),
          object: verbs.slice(1).join(' and ') + ' ' + rest,
          modifiers: [],
          confidence: 1,
          unknownWords: [],
          hasConjunction: true,
          expansions: allExpansions,
        }
      }
    }

    // Check for simple verb lists: "Verb1 and/or Verb2 Object"
    const verbListMatch = text.match(/^(\w+)\s+(and|or)\s+(\w+)\s+(.+)$/i)
    if (verbListMatch) {
      const [, verb1, conj, verb2, object] = verbListMatch
      // Check if both are verbs
      if (this.lexicon.verbs.has(verb1.toLowerCase()) && this.lexicon.verbs.has(verb2.toLowerCase())) {
        // Recursively expand the object if it contains conjunctions, commas, or slashes
        const needsObjectExpansion = /\b(and|or)\b/i.test(object) || object.includes(',') || object.includes('/')
        const objectExpansions = needsObjectExpansion
          ? this.expandRawText(`${verb1} ${object}`)
          : [`${verb1} ${object}`]

        // Create cartesian product of verb variations and object expansions
        const verb1Expansions = objectExpansions.map(exp => exp)
        const verb2Capitalized = this.capitalize(verb2)
        const verb2Expansions = objectExpansions.map(exp => exp.replace(new RegExp(`^${verb1}\\s+`, 'i'), `${verb2Capitalized} `))

        return {
          original: text,
          predicate: this.capitalize(verb1),
          object: `${conj} ${verb2} ${object}`,
          modifiers: [],
          confidence: 1,
          unknownWords: [],
          hasConjunction: true,
          expansions: [
            ...verb1Expansions.map(exp => this.parseSingle(exp)),
            ...verb2Expansions.map(exp => this.parseSingle(exp)),
          ],
        }
      }
    }

    // Check for noun conjunctions in raw text before parsing
    // This allows us to expand BEFORE concept normalization
    // Also check for commas, slashes, and "such as" which indicate lists to expand
    const hasExpandablePattern = /\b(and|or)\b/i.test(text) || text.includes(',') || text.includes('/') || /\bsuch as\b/i.test(text)
    if (hasExpandablePattern && !this.isVerbConjunction(text)) {
      const expansions = this.expandRawText(text)
      if (expansions.length > 1) {
        const parsed = this.parseSingle(text)
        return {
          ...parsed,
          hasConjunction: true,
          expansions: expansions.map(exp => this.parseSingle(exp))
        }
      }
    }

    const parsed = this.parseSingle(text)
    return parsed
  }

  /**
   * Check if text has a verb conjunction (already handled above)
   */
  private isVerbConjunction(text: string): boolean {
    const verbListMatch = text.match(/^(\w+)\s+(and|or)\s+(\w+)\s+(.+)$/i)
    if (verbListMatch) {
      const [, verb1, conj, verb2] = verbListMatch
      return this.lexicon.verbs.has(verb1.toLowerCase()) && this.lexicon.verbs.has(verb2.toLowerCase())
    }
    return false
  }

  /**
   * Expand raw text containing conjunctions into multiple statements
   * Example: "Inspect generation or mechanical equipment" → ["Inspect generation equipment", "Inspect mechanical equipment"]
   * Example: "Monitor strategy, plans, and policies" → ["Monitor strategy", "Monitor plans", "Monitor policies"]
   */
  private expandRawText(text: string): string[] {
    // Pattern: "Verb Object of X or Y" (conjunction in complement) - check this FIRST
    const verbObjectComplement = text.match(/^(\w+)\s+(.+?)\s+(of|to|for|with|from|in|on|at|by)\s+(.+)$/i)
    if (verbObjectComplement) {
      const [, verb, obj, prep, comp] = verbObjectComplement
      if (this.lexicon.verbs.has(verb.toLowerCase())) {
        // Expand the complement if it has conjunctions, commas, or slashes
        const compVariations = this.needsExpansion(comp) ? this.expandPhrase(comp) : [comp]

        // Expand the object if it has conjunctions or commas
        const objVariations = this.needsExpansion(obj) ? this.expandPhrase(obj) : [obj]

        // Create cartesian product of object and complement variations
        const results: string[] = []
        for (const o of objVariations) {
          for (const c of compVariations) {
            results.push(`${verb} ${o} ${prep} ${c}`)
          }
        }
        return results
      }
    }

    // Check if we have a verb followed by a comma-separated list
    // Pattern: "Verb X, Y, and Z" → ["Verb X", "Verb Y", "Verb Z"]
    const verbCommaListMatch = text.match(/^(\w+)\s+(.+?,\s*.+)$/i)
    if (verbCommaListMatch) {
      const [, verb, objectList] = verbCommaListMatch
      if (this.lexicon.verbs.has(verb.toLowerCase())) {
        const objectVariations = this.expandPhrase(objectList)
        if (objectVariations.length > 1) {
          return objectVariations.map(obj => `${verb} ${obj}`)
        }
      }
    }

    // Check if we have a verb followed by an object containing slash
    // Pattern: "Verb X/Y Z" → ["Verb X Z", "Verb Y Z"] (shared suffix)
    // Pattern: "Verb X/Y" → ["Verb X", "Verb Y"] (no suffix)
    if (text.includes('/') && !/\b(and|or)\b/i.test(text)) {
      const verbSlashMatch = text.match(/^(\w+)\s+(.+)$/i)
      if (verbSlashMatch) {
        const [, verb, rest] = verbSlashMatch
        if (this.lexicon.verbs.has(verb.toLowerCase())) {
          const slashExpanded = this.expandSlashPattern(rest)
          if (slashExpanded.length > 1) {
            return slashExpanded.map(obj => `${verb} ${obj}`)
          }
        }
      }
    }

    // Pattern: "Verb X or Y Z" where Z is shared suffix (only when no preposition)
    // BUT: Don't match when middle is a hyphenated modifier (like "long-term vision")
    // because that's a compound noun phrase, not a shared suffix pattern
    const verbWithSharedSuffix = text.match(/^(\w+)\s+(.+?)\s+(and|or)\s+([^\s]+)\s+(.+)$/i)
    if (verbWithSharedSuffix) {
      const [, verb, left, conj, middle, suffix] = verbWithSharedSuffix
      if (this.lexicon.verbs.has(verb.toLowerCase())) {
        // Check if middle+suffix forms a known concept (don't split compound noun phrases)
        const middleSuffixPhrase = `${middle} ${suffix}`.toLowerCase().replace(/-/g, ' ')
        const middleSuffixJoined = `${middle}${suffix}`.toLowerCase().replace(/-/g, '')
        const isCompoundConcept = this.lexicon.concepts.has(middleSuffixPhrase) ||
                                  this.lexicon.concepts.has(middleSuffixJoined) ||
                                  this.lexicon.concepts.has(`${middle}-${suffix}`.toLowerCase())

        // Also check if middle is a typical modifier (hyphenated or adjective-like)
        const isMiddleModifier = middle.includes('-') ||
                                 middle.toLowerCase().endsWith('term') ||
                                 middle.toLowerCase().endsWith('time') ||
                                 middle.toLowerCase().endsWith('level')

        // Also check if "middle suffix" forms a compound phrase that should stay together
        const isCompoundPhraseMatch = this.isCompoundPhrase(middle, suffix)

        // If middle is a verb AND left is NOT a single verb, this is likely a mixed pattern
        // e.g., "department heads and assign or delegate responsibilities"
        //   left="department heads" (noun phrase), middle="assign" (verb) → skip shared suffix
        // But: "assign or delegate responsibilities"
        //   left="assign" (verb), middle="delegate" (verb) → USE shared suffix
        const isMiddleVerb = this.lexicon.verbs.has(middle.toLowerCase())
        const leftWords = left.trim().split(/\s+/)
        const leftLastWord = leftWords[leftWords.length - 1]?.toLowerCase() || ''
        const isLeftVerb = leftWords.length === 1 && this.lexicon.verbs.has(leftLastWord)

        // Skip shared suffix only if middle is a verb but left is NOT a verb
        const skipDueToVerbMismatch = isMiddleVerb && !isLeftVerb

        if (isCompoundConcept || isMiddleModifier || isCompoundPhraseMatch || skipDueToVerbMismatch) {
          // Don't use shared suffix pattern - fall through to simple conjunction
        } else {
          // Recursively expand left and middle
          const leftExpanded = this.expandPhrase(left)
          const middleExpanded = this.expandPhrase(middle)

          // Don't add suffix if left already ends with it (avoid "demand forecast forecast")
          const suffixLower = suffix.toLowerCase()
          const results: string[] = []

          for (const l of leftExpanded) {
            const lWords = l.trim().split(/\s+/)
            const lastWord = lWords[lWords.length - 1]?.toLowerCase()
            if (lastWord === suffixLower) {
              results.push(`${verb} ${l}`)
            } else {
              results.push(`${verb} ${l} ${suffix}`)
            }
          }

          for (const m of middleExpanded) {
            results.push(`${verb} ${m} ${suffix}`)
          }

          // If suffix has conjunctions, expand each result
          if (this.needsExpansion(suffix)) {
            const expandedResults: string[] = []
            for (const result of results) {
              const subExpansions = this.expandRawText(result)
              expandedResults.push(...subExpansions)
            }
            return expandedResults
          }

          return results
        }
      }
    }

    // Pattern: "Verb X and Y" (simple conjunction with no shared suffix)
    // Example: "Develop Vision and Strategy" → ["Develop Vision", "Develop Strategy"]
    const simpleVerbConjunction = text.match(/^(\w+)\s+(.+?)\s+(and|or)\s+(.+)$/i)
    if (simpleVerbConjunction) {
      const [, verb, left, conj, right] = simpleVerbConjunction
      if (this.lexicon.verbs.has(verb.toLowerCase())) {
        // Recursively expand both sides in case they have their own conjunctions
        const leftExpanded = this.expandPhrase(left)
        const rightExpanded = this.expandPhrase(right)

        return [
          ...leftExpanded.map(l => `${verb} ${l}`),
          ...rightExpanded.map(r => `${verb} ${r}`)
        ]
      }
    }

    // Pattern: "Verb X such as A, B, and C" → ["Verb A", "Verb B", "Verb C"]
    // Example: "Survey features such as highway alignments, property boundaries, utilities"
    //       → ["Survey highway alignments", "Survey property boundaries", "Survey utilities"]
    const suchAsMatch = text.match(/^(\w+)\s+(.+?)\s+such\s+as\s+(.+)$/i)
    if (suchAsMatch) {
      const [, verb, category, examples] = suchAsMatch
      if (this.lexicon.verbs.has(verb.toLowerCase())) {
        // Expand the examples list
        const expandedExamples = this.expandSuchAs(`${category} such as ${examples}`)
        if (expandedExamples.length > 1) {
          return expandedExamples.map(ex => `${verb} ${ex}`)
        }
      }
    }

    return [text]
  }

  /**
   * Check if a phrase needs expansion (has conjunctions, commas, slashes, or "such as")
   */
  private needsExpansion(phrase: string): boolean {
    return /\b(and|or)\b/i.test(phrase) || phrase.includes(',') || phrase.includes('/') || /\bsuch as\b/i.test(phrase)
  }

  /**
   * Expand "such as" patterns - extract BOTH the category and examples
   * Example: "features such as highway alignments, property boundaries, utilities"
   *       → ["features", "highway alignments", "property boundaries", "utilities"]
   * Example: "publications such as brochures"
   *       → ["publications", "brochures"]
   * This creates tasks for both the general category and specific examples
   */
  private expandSuchAs(phrase: string): string[] {
    const match = phrase.match(/^(.+?)\s+such\s+as\s+(.+)$/i)
    if (!match) return [phrase]

    const [, prefix, examples] = match

    // Clean up the prefix (remove trailing comma if present)
    const cleanPrefix = prefix.replace(/,\s*$/, '').trim()

    // Split the examples on commas and "and"/"or"
    let parts = examples.split(/\s*,\s*(?:and\s+|or\s+)?|\s+and\s+|\s+or\s+/i)
      .map(p => p.trim())
      .filter(p => p.length > 0)

    // Return both the category (prefix) and the examples
    if (parts.length >= 1 && cleanPrefix) {
      return [cleanPrefix, ...parts]
    }

    return [phrase]
  }

  private expandConjunctions(parsed: ParsedStatement): ParsedStatement[] {
    // Expand conjunctions in object, creating variations
    const objectVariations = this.expandPhrase(parsed.object || '')

    // Expand conjunctions in complement if present
    const complementVariations = parsed.complement
      ? this.expandPhrase(parsed.complement)
      : ['']

    // Create cartesian product of all variations
    const expansions: ParsedStatement[] = []

    for (const obj of objectVariations) {
      for (const comp of complementVariations) {
        expansions.push({
          original: `${parsed.predicate || ''} ${obj}${parsed.preposition ? ' ' + parsed.preposition : ''}${comp ? ' ' + comp : ''}`.trim(),
          predicate: parsed.predicate,
          object: obj || undefined,
          preposition: parsed.preposition,
          complement: comp || undefined,
          modifiers: parsed.modifiers,
          confidence: parsed.confidence,
          unknownWords: [],
        })
      }
    }

    return expansions.length > 1 ? expansions : []
  }

  /**
   * Expand nested conjunction patterns where a subject conjunction is followed by a connector phrase
   * and then an object list with its own conjunction.
   *
   * Pattern: "X or Y <connector> A, B, and C"
   * Example: "businesses or departments concerned with production, pricing, sales, or distribution"
   * Result: cartesian product → ["businesses concerned with production", "businesses concerned with pricing", ...]
   *
   * Common connector phrases: "concerned with", "related to", "involved in", "responsible for",
   * "engaged in", "associated with", "dealing with", "focused on"
   */
  private expandNestedConjunction(phrase: string): string[] {
    // Common connector phrases that join a subject to an object list
    const connectorPhrases = [
      'concerned with',
      'related to',
      'involved in',
      'responsible for',
      'engaged in',
      'associated with',
      'dealing with',
      'focused on',
      'pertaining to',
      'regarding',
    ]

    // Try to match pattern: "(subject conjunction) <connector> (object list)"
    for (const connector of connectorPhrases) {
      const connectorIndex = phrase.toLowerCase().indexOf(connector)
      if (connectorIndex === -1) continue

      const subjectPart = phrase.slice(0, connectorIndex).trim()
      const objectPart = phrase.slice(connectorIndex + connector.length).trim()

      // Check if subject part has a conjunction (and/or) but NO commas (to avoid matching Oxford comma lists)
      if (!/\b(and|or)\b/i.test(subjectPart)) continue
      if (subjectPart.includes(',')) continue

      // Check if object part has a list (commas or conjunctions)
      if (!objectPart.includes(',') && !/\b(and|or)\b/i.test(objectPart)) continue

      // Expand both parts
      const subjects = this.expandSimpleConjunction(subjectPart)
      const objects = this.expandObjectList(objectPart)

      // If we got meaningful expansions, create cartesian product
      if (subjects.length > 1 || objects.length > 1) {
        const results: string[] = []
        for (const subj of subjects) {
          for (const obj of objects) {
            results.push(`${subj} ${connector} ${obj}`)
          }
        }
        return results
      }
    }

    return [phrase]
  }

  /**
   * Expand a simple conjunction like "X or Y" or "X and Y" without shared suffix detection
   */
  private expandSimpleConjunction(phrase: string): string[] {
    const match = phrase.match(/^(.+?)\s+(and|or)\s+(.+)$/i)
    if (match) {
      const [, left, , right] = match
      return [left.trim(), right.trim()]
    }
    return [phrase]
  }

  /**
   * Expand an object list that may contain commas and/or conjunctions
   * Example: "production, pricing, sales, or distribution of products"
   */
  private expandObjectList(phrase: string): string[] {
    // First check for Oxford comma pattern
    const oxfordMatch = phrase.match(/^(.+?),\s*(.+?),?\s*(and|or)\s+(.+)$/i)
    if (oxfordMatch) {
      const [, first, middle, , last] = oxfordMatch
      const middleParts = middle.split(/,\s*/).map(p => p.trim()).filter(p => p)
      return [first.trim(), ...middleParts, last.trim()]
    }

    // Check for simple conjunction
    const conjMatch = phrase.match(/^(.+?)\s+(and|or)\s+(.+)$/i)
    if (conjMatch) {
      const [, left, , right] = conjMatch
      return [left.trim(), right.trim()]
    }

    // Check for comma-separated list
    if (phrase.includes(',')) {
      return phrase.split(/,\s*/).map(p => p.trim()).filter(p => p)
    }

    return [phrase]
  }

  /**
   * Check if "middle suffix" forms a compound phrase that should stay together
   * Examples of compound phrases: "record keeping", "policy changes", "cost reduction"
   * These should NOT be treated as shared suffix patterns
   */
  private isCompoundPhrase(middle: string, suffix: string): boolean {
    const middleLower = middle.toLowerCase()
    const suffixLower = suffix.toLowerCase()

    // Known compound phrases that should stay together
    const compoundPhrases = new Set([
      'record keeping', 'record-keeping', 'policy changes', 'cost reduction',
      'quality control', 'data management', 'risk management', 'project management',
      'change management', 'time management', 'resource allocation', 'budget allocation',
      'staff development', 'team building', 'problem solving', 'decision making',
      'policy making', 'rule making', 'law enforcement', 'code enforcement',
    ])

    const combined = `${middleLower} ${suffixLower}`
    if (compoundPhrases.has(combined)) {
      return true
    }

    // Heuristic: if middle is a noun and suffix ends in -ing (gerund), likely a compound
    // e.g., "record keeping", "problem solving", "decision making"
    if (/ing$/i.test(suffix) && !/^(assign|implement|develop|manage|create|ensure)$/i.test(middle)) {
      // Check if middle looks like a noun (not a verb)
      const verbPatterns = /^(assign|delegate|implement|develop|manage|create|ensure|maintain|review|approve|coordinate|direct|evaluate|identify|analyze|perform|conduct|establish|prepare|provide|support|monitor|report|document|communicate|facilitate|generate|produce|process|recommend|select|determine|define|design|plan|organize|lead|guide|handle|negotiate|resolve|validate|verify|test|train|assess|measure|inspect|investigate|research|execute|deliver)$/i
      if (!verbPatterns.test(middle)) {
        return true
      }
    }

    // Heuristic: if middle is a noun and suffix is "changes", "reduction", "allocation", etc.
    const businessSuffixes = /^(changes|reduction|allocation|management|development|building|solving|making|enforcement|control|planning|analysis|assessment|evaluation|implementation)$/i
    if (businessSuffixes.test(suffix) && !/^(assign|implement|develop|manage|create|ensure)$/i.test(middle)) {
      return true
    }

    return false
  }

  /**
   * Expand slash patterns with shared prefix/suffix detection
   * Examples:
   * - "existing products/services" → ["existing products", "existing services"]
   * - "role/activity diagrams" → ["role diagrams", "activity diagrams"]
   * - "product/service/delivery channel method" → ["product channel method", "service channel method", "delivery channel method"]
   * - "products/services" → ["products", "services"]
   */
  private expandSlashPattern(phrase: string): string[] {
    // Find where slashes are in the phrase
    const words = phrase.split(/\s+/)

    // Find words containing slashes
    const slashWordIndices: number[] = []
    words.forEach((word, idx) => {
      if (word.includes('/')) {
        slashWordIndices.push(idx)
      }
    })

    if (slashWordIndices.length === 0) return [phrase]

    // Get the prefix (words before first slash word)
    const firstSlashIdx = slashWordIndices[0]
    const prefix = words.slice(0, firstSlashIdx).join(' ')

    // Get the suffix (words after last slash word)
    const lastSlashIdx = slashWordIndices[slashWordIndices.length - 1]
    const suffix = words.slice(lastSlashIdx + 1).join(' ')

    // Get all the slash-separated alternatives
    // Handle multiple slash words like "product/service/delivery"
    const slashWords = words.slice(firstSlashIdx, lastSlashIdx + 1)
    const slashContent = slashWords.join(' ')

    // Split on slashes, handling spaces around them
    const alternatives = slashContent.split(/\s*\/\s*/).map(s => s.trim()).filter(s => s)

    if (alternatives.length <= 1) return [phrase]

    // Build expanded phrases with shared prefix and suffix
    const expanded: string[] = []
    for (const alt of alternatives) {
      const parts: string[] = []
      if (prefix) parts.push(prefix)
      parts.push(alt)
      if (suffix) parts.push(suffix)
      expanded.push(parts.join(' '))
    }

    return expanded
  }

  /**
   * Expand a phrase containing "or", "and", commas, or slashes into separate items
   * Handles patterns like:
   * - "X or Y" → ["X", "Y"]
   * - "X or Y Z" → ["X Z", "Y Z"] (shared suffix)
   * - "X Y or Z" → ["X Y", "Z"] (simple split)
   * - "X or Y or Z" → ["X", "Y", "Z"] (multiple ors)
   * - "X, Y, and Z" → ["X", "Y", "Z"] (Oxford comma)
   * - "X, Y" → ["X", "Y"] (simple comma list)
   * - "X/Y" → ["X", "Y"] (slash as "or")
   */
  private expandPhrase(phrase: string): string[] {
    if (!phrase) return [phrase]

    // Check for "such as" pattern first - extract examples
    // Example: "features such as highway alignments, property boundaries, utilities"
    //       → ["highway alignments", "property boundaries", "utilities"]
    // Example: "publications such as brochures" → ["brochures"]
    if (/\bsuch\s+as\b/i.test(phrase)) {
      const suchAsExpanded = this.expandSuchAs(phrase)
      // If we got different results than the original, use them (even if just 1)
      if (suchAsExpanded.length >= 1 && (suchAsExpanded.length > 1 || suchAsExpanded[0] !== phrase)) {
        return suchAsExpanded.flatMap(p => this.expandPhrase(p))
      }
    }

    // Check for slash pattern with shared prefix/suffix
    // Examples:
    // - "existing products/services" → ["existing products", "existing services"] (shared prefix)
    // - "role/activity diagrams" → ["role diagrams", "activity diagrams"] (shared suffix)
    // - "product/service/delivery channel method" → shared suffix "channel method"
    // But only if there's no "and/or" - slash is lower priority
    if (phrase.includes('/') && !/\b(and|or)\b/i.test(phrase)) {
      const slashExpanded = this.expandSlashPattern(phrase)
      if (slashExpanded.length > 1) {
        return slashExpanded.flatMap(p => this.expandPhrase(p))
      }
    }

    // IMPORTANT: Check for nested conjunction pattern BEFORE Oxford comma
    // Pattern: "X or Y <connector> A, B, and C" where connector phrases join subject to object list
    // Example: "businesses or departments concerned with production, pricing, sales, or distribution"
    // Should create cartesian product: (businesses, departments) × (production, pricing, sales, distribution)
    const nestedConjunctionResult = this.expandNestedConjunction(phrase)
    if (nestedConjunctionResult.length > 1) {
      return nestedConjunctionResult
    }

    // Check for Oxford comma pattern: "X, Y, and Z" or "X, Y, or Z"
    // This handles comma-separated lists with a final conjunction
    // Note: Handle cases like "strategy, plans, and policies" where comma is directly before "and"
    const oxfordCommaMatch = phrase.match(/^(.+?),\s*(.+?),?\s*(and|or)\s+(.+)$/i)
    if (oxfordCommaMatch) {
      const [, first, middle, conj, last] = oxfordCommaMatch

      // Split the middle part by commas (for lists like "X, Y, Z, and W")
      const middleParts = middle.split(/,\s*/).map(p => p.trim()).filter(p => p)

      // Combine all parts
      const allParts = [first.trim(), ...middleParts, last.trim()]

      // Recursively expand each part in case it has nested conjunctions
      return allParts.flatMap(p => this.expandPhrase(p))
    }

    // Check for simple comma list without conjunction: "X, Y, Z"
    if (phrase.includes(',') && !/\b(and|or)\b/i.test(phrase)) {
      const commaParts = phrase.split(/,\s*/).map(p => p.trim()).filter(p => p)
      if (commaParts.length > 1) {
        return commaParts.flatMap(p => this.expandPhrase(p))
      }
    }

    // No conjunction or comma pattern to expand
    if (!/\b(and|or)\b/i.test(phrase)) {
      return [phrase]
    }

    // Handle "both X and Y" pattern - strip "both" and expand normally
    // Example: "both enterprise and customer" → ["enterprise", "customer"]
    if (/^both\s+/i.test(phrase)) {
      const withoutBoth = phrase.replace(/^both\s+/i, '')
      return this.expandPhrase(withoutBoth)
    }

    // Pattern: "X or Y something" where "something" is shared
    // Example: "generation or mechanical equipment" → ["generation equipment", "mechanical equipment"]
    // BUT: Don't match when middle is a determiner (the, a, an) - that's likely "X and the Y"
    // Also: Don't add suffix if left already ends with the suffix (avoid "demand forecast forecast")
    // Also: Don't match if "middle + suffix" forms a common compound phrase
    const sharedSuffixMatch = phrase.match(/^(.+?)\s+(and|or)\s+([^\s]+)\s+(.+)$/i)
    if (sharedSuffixMatch) {
      const [, left, conj, middle, suffix] = sharedSuffixMatch
      const middleLower = middle.toLowerCase()

      // If middle is a determiner, this is not a shared suffix pattern
      // e.g., "enterprise and the customer" is NOT "enterprise customer" and "the customer"
      if (['the', 'a', 'an', 'this', 'that', 'these', 'those'].includes(middleLower)) {
        // Skip to simple split
      }
      // Check if "middle suffix" forms a common compound phrase that should stay together
      // Common patterns: "record keeping", "policy changes", "cost reduction", "quality control"
      // Heuristic: if suffix is a gerund (ing) or plural noun, and middle+suffix makes sense together
      else if (this.isCompoundPhrase(middle, suffix)) {
        // Skip to simple split - don't treat as shared suffix
      }
      // If middle is a verb AND left is NOT a single verb, skip shared suffix
      // e.g., "department heads and assign or delegate responsibilities"
      //   left="department heads" (noun phrase), middle="assign" (verb) → skip
      // But: "assign or delegate responsibilities" (both verbs) → use shared suffix
      else {
        const leftWords = left.trim().split(/\s+/)
        const leftLastWord = leftWords[leftWords.length - 1]?.toLowerCase() || ''
        const isLeftVerb = leftWords.length === 1 && this.lexicon.verbs.has(leftLastWord)
        const isMiddleVerb = this.lexicon.verbs.has(middleLower)
        if (isMiddleVerb && !isLeftVerb) {
          // Skip to simple split - mixed verb/noun pattern
        } else {
        // Recursively expand left side and middle
        const leftExpanded = this.expandPhrase(left)
        const middleExpanded = this.expandPhrase(middle)

        // Don't add suffix if left already ends with it
        const suffixLower = suffix.toLowerCase()
        const results: string[] = []

        for (const l of leftExpanded) {
          const lWords = l.trim().split(/\s+/)
          const lastWord = lWords[lWords.length - 1]?.toLowerCase()
          if (lastWord === suffixLower) {
            // Left already has the suffix, don't duplicate
            results.push(l)
          } else {
            results.push(`${l} ${suffix}`)
          }
        }

        for (const m of middleExpanded) {
          results.push(`${m} ${suffix}`)
        }

        return results
        }
      }
    }

    // Pattern: "X or Y" (no shared suffix)
    // Example: "regulations or standards" → ["regulations", "standards"]
    const simpleSplitMatch = phrase.match(/^(.+?)\s+(and|or)\s+(.+)$/i)
    if (simpleSplitMatch) {
      const [, left, conj, right] = simpleSplitMatch
      // Recursively expand both sides
      const leftExpanded = this.expandPhrase(left)
      const rightExpanded = this.expandPhrase(right)

      return [...leftExpanded, ...rightExpanded]
    }

    return [phrase]
  }

  private normalizeConceptsInText(text: string): string {
    let normalized = text

    // Sort concepts by length (longest first) to avoid partial matches
    const conceptPhrases = Array.from(this.lexicon.concepts.entries())
      .map(([phrase, entry]) => ({ phrase, entry }))
      .sort((a, b) => b.phrase.length - a.phrase.length)

    for (const { phrase, entry } of conceptPhrases) {
      // Only match complete concept phrases
      const regex = new RegExp(`\\b${phrase}\\b`, 'gi')
      normalized = normalized.replace(regex, entry.id)
    }

    return normalized
  }

  private parseSingle(text: string): ParsedStatement {
    // First, detect and replace multi-word concepts with their IDs
    const normalizedText = this.normalizeConceptsInText(text)

    const tokens = this.tokenizer.tokenize(normalizedText)
    const tagged = this.tagger.tag(tokens)

    const result: ParsedStatement = {
      original: text,
      modifiers: [],
      confidence: 1.0,
      unknownWords: [],
      hasConjunction: false,
    }

    // Extract unknown words (excluding punctuation and determiners)
    result.unknownWords = tagged
      .filter(t => t.pos.startsWith('UNK') && t.pos !== 'UNK-VERB')
      .map(t => t.text)

    // For APQC/ONET style imperatives, the pattern is:
    // VERB [DET] [ADJ]* NOUN [PREP [DET] [ADJ]* NOUN]
    // No explicit subject (imperative form)

    let i = 0
    const modifiers: string[] = []

    // Find predicate (first VERB) - imperatives start with verb
    while (i < tagged.length && tagged[i].pos !== 'VERB' && !tagged[i].pos.includes('VERB')) {
      if (tagged[i].pos === 'ADV' || tagged[i].pos === 'ADJ') {
        modifiers.push(tagged[i].text)
      }
      i++
    }
    if (i < tagged.length) {
      // Keep original verb form, don't conjugate
      result.predicate = tagged[i].text
      i++
    }

    // Find object - collect all tokens until PREP or end
    // Keep conjunctions, adjectives, nouns, everything
    // But stop at certain punctuation (periods, semicolons) not commas
    const objectTokens: string[] = []
    while (i < tagged.length && tagged[i].pos !== 'PREP') {
      // Stop at sentence-ending punctuation but not commas
      if (tagged[i].pos === 'PUNCT' && (tagged[i].text === '.' || tagged[i].text === ';' || tagged[i].text === ')')) {
        break
      }
      // Skip determiners and commas, but keep everything else
      if (tagged[i].pos !== 'DET' && tagged[i].text !== ',') {
        objectTokens.push(tagged[i].text)
      }
      i++
    }
    if (objectTokens.length > 0) {
      result.object = objectTokens.join(' ')
    }

    // Find preposition
    if (i < tagged.length && tagged[i].pos === 'PREP') {
      result.preposition = tagged[i].normalized
      i++
    }

    // Skip determiners before complement
    while (i < tagged.length && (tagged[i].pos === 'DET' || tagged[i].pos === 'ADV' || tagged[i].pos === 'ADJ')) {
      if (tagged[i].pos === 'ADV' || tagged[i].pos === 'ADJ') {
        modifiers.push(tagged[i].text)
      }
      i++
    }

    // Find complement (final phrase after preposition)
    // Include everything except determiners, but keep hyphens for compound words
    const complementTokens: string[] = []
    while (i < tagged.length) {
      // Stop at sentence-ending punctuation but not hyphens
      if (tagged[i].pos === 'PUNCT' && (tagged[i].text === '.' || tagged[i].text === ';' || tagged[i].text === ')')) {
        break
      }
      // Skip determiners but keep everything else including hyphens
      if (tagged[i].pos !== 'DET') {
        complementTokens.push(tagged[i].text)
      }
      i++
    }
    if (complementTokens.length > 0) {
      result.complement = complementTokens.join(' ')
    }

    result.modifiers = modifiers

    // Adjust confidence based on unknowns
    if (result.unknownWords.length > 0) {
      result.confidence -= (result.unknownWords.length * 0.1)
    }

    return result
  }
}

// ============================================================================
// UNKNOWN WORD ANALYZER
// ============================================================================

export class UnknownWordAnalyzer {
  private unknownWords: Map<string, number> = new Map()

  addParse(parse: ParsedStatement): void {
    for (const word of parse.unknownWords) {
      this.unknownWords.set(word, (this.unknownWords.get(word) || 0) + 1)
    }

    // Recursively add from expansions
    if (parse.expansions) {
      for (const expansion of parse.expansions) {
        this.addParse(expansion)
      }
    }
  }

  getTopUnknown(limit: number = 100): Array<[string, number]> {
    return Array.from(this.unknownWords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
  }

  exportTSV(outputPath: string): void {
    const entries = this.getTopUnknown(1000)
    const lines = ['word\tfrequency\tsuggested_pos']

    for (const [word, freq] of entries) {
      // Heuristic: TitleCase = noun, camelCase/lowercase = verb
      const suggestedPOS = word.match(/^[A-Z]/) ? 'NOUN' : 'VERB'
      lines.push(`${word}\t${freq}\t${suggestedPOS}`)
    }

    fs.writeFileSync(outputPath, lines.join('\n'))
  }
}

// ============================================================================
// MAIN PARSER FACADE
// ============================================================================

export class GraphDLParser {
  private lexicon?: Lexicon
  private parser?: StatementParser
  private analyzer: UnknownWordAnalyzer

  constructor() {
    this.analyzer = new UnknownWordAnalyzer()
  }

  async initialize(): Promise<void> {
    const loader = new LexiconLoader()
    this.lexicon = await loader.load()
    this.parser = new StatementParser(this.lexicon)
  }

  parse(text: string): ParsedStatement {
    if (!this.parser) {
      throw new Error('Parser not initialized. Call initialize() first.')
    }

    const result = this.parser.parse(text)
    this.analyzer.addParse(result)
    return result
  }

  getUnknownWords(limit?: number): Array<[string, number]> {
    return this.analyzer.getTopUnknown(limit)
  }

  exportUnknownWords(outputPath: string): void {
    this.analyzer.exportTSV(outputPath)
  }

  /**
   * Convert a phrase to PascalCase
   * Handles hyphenated compounds and multi-word phrases
   * Strips commas, periods, and other punctuation
   */
  private toPascalCase(phrase: string): string {
    const words = phrase.split(/\s+/)
      .map(w => w.replace(/[,;:()']/g, '')) // Strip punctuation including apostrophes
      .filter(w => w && !['and', 'or', 'but', 'the', 'a', 'an'].includes(w.toLowerCase()))

    return words
      .map(word => {
        // Handle hyphenated compounds: "cross-functional" -> "CrossFunctional"
        return word.split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join('')
      })
      .join('')
  }

  toGraphDL(parse: ParsedStatement): string {
    // If there are expansions, return them in bracket notation
    // This avoids creating long strings with "and" and other conjunctions
    if (parse.expansions && parse.expansions.length > 0) {
      const expandedGraphDL = parse.expansions.map(e => this.toGraphDL(e)).join(', ')
      return `[${expandedGraphDL}]`
    }

    const parts: string[] = []

    if (parse.subject) parts.push(this.toPascalCase(parse.subject))
    // Predicate (verb) should be camelCase (lowercase)
    if (parse.predicate) parts.push(parse.predicate.toLowerCase())
    if (parse.object) {
      // For objects, preserve ALL words - no truncation
      // Handle hyphenated compounds: "cross-functional strategies" -> "CrossFunctionalStrategies"
      // Handle prepositions by inserting dots: "quality of customer" -> "Quality.of.Customer"

      const objectPhrase = parse.object

      // Split into words
      const words = objectPhrase.split(/\s+/).filter(w => w)

      // Check for preposition in object (e.g., "quality of customer")
      const prepIndex = words.findIndex(w =>
        ['of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by'].includes(w.toLowerCase())
      )

      if (prepIndex > 0 && prepIndex < words.length - 1) {
        // Split at preposition: "quality of customer" -> "Quality.of.Customer"
        const beforePrep = words.slice(0, prepIndex).filter(w => !['and', 'or', 'but'].includes(w.toLowerCase()))
        const prep = words[prepIndex]
        const afterPrep = words.slice(prepIndex + 1).filter(w => !['and', 'or', 'but'].includes(w.toLowerCase()))

        const beforePascal = this.toPascalCase(beforePrep.join(' '))
        const afterPascal = this.toPascalCase(afterPrep.join(' '))

        parts.push(`${beforePascal}.${prep.toLowerCase()}.${afterPascal}`)
      } else {
        // No internal preposition - convert all to PascalCase using helper
        parts.push(this.toPascalCase(objectPhrase))
      }
    }
    if (parse.preposition) parts.push(parse.preposition)
    if (parse.complement) {
      // When preposition is "to", check if complement is an infinitive verb phrase
      // e.g., "to fund operations" -> to.fund.Operations
      if (parse.preposition === 'to') {
        const complementWords = parse.complement.split(/\s+/).filter(w => w)
        if (complementWords.length >= 2) {
          const firstWord = complementWords[0].toLowerCase()
          // Check if first word is a known verb (infinitive form)
          // IMPORTANT: Words ending in -ing are NOT infinitives - they're gerunds used as nouns
          // e.g., "to building design" -> "BuildingDesign" (not building.Design)
          // Infinitives are base form: "to build", "to fund", "to address"
          const isGerund = firstWord.endsWith('ing')
          const verbsMap = this.lexicon?.verbs
          // Only treat as verb if it's NOT a gerund and matches verb patterns
          const isLikelyVerb = !isGerund && (
            (verbsMap && verbsMap.has(firstWord)) ||
            firstWord.endsWith('ize') || firstWord.endsWith('ate') ||
            firstWord.endsWith('ify') || firstWord.endsWith('ect') ||
            firstWord.endsWith('uce') || firstWord.endsWith('ase')
          )
          if (isLikelyVerb) {
            // Infinitive: verb.Object
            const verbPart = firstWord
            const objectPart = this.toPascalCase(complementWords.slice(1).join(' '))
            parts.push(`${verbPart}.${objectPart}`)
          } else {
            // Not a verb (or is a gerund), treat as noun phrase
            parts.push(this.toPascalCase(parse.complement))
          }
        } else if (complementWords.length === 1) {
          // Single word - could be a verb infinitive (to be, to do) or noun
          const word = complementWords[0].toLowerCase()
          // Gerunds are nouns, not infinitive verbs
          const isGerund = word.endsWith('ing')
          const verbsMap = this.lexicon?.verbs
          if (!isGerund && verbsMap && verbsMap.has(word)) {
            parts.push(word)
          } else {
            parts.push(this.toPascalCase(parse.complement))
          }
        }
      } else {
        const verbsMap = this.lexicon?.verbs

        // Helper to check if a word is an infinitive verb (NOT a gerund)
        // Gerunds (-ing) are nouns: "building design", "swimming pool"
        // Infinitives are base form: "build", "fund", "address"
        const isInfinitiveVerb = (word: string): boolean => {
          const lower = word.toLowerCase()
          // Gerunds are NOT infinitive verbs
          if (lower.endsWith('ing')) return false
          return (verbsMap && verbsMap.has(lower)) ||
            lower.endsWith('ize') || lower.endsWith('ate') ||
            lower.endsWith('ify') || lower.endsWith('ure') // ensure, secure
        }

        // Check if complement starts with "to + infinitive" (no noun before it)
        // e.g., "to maximize returns" -> "maximize.Returns"
        const startsWithToMatch = parse.complement.match(/^to\s+(\w+)\s+(.+)$/i)
        if (startsWithToMatch) {
          const [, potentialVerb, afterVerb] = startsWithToMatch
          if (isInfinitiveVerb(potentialVerb)) {
            // "to maximize returns" -> "maximize.Returns"
            const verb = potentialVerb.toLowerCase()
            const objectPascal = this.toPascalCase(afterVerb)
            parts.push(`${verb}.${objectPascal}`)
          } else {
            parts.push(this.toPascalCase(parse.complement))
          }
        }
        // Check for "to + infinitive" clause within the complement (with noun before)
        // e.g., "organizations to maximize returns" should be split
        else {
          const toInfinitiveMatch = parse.complement.match(
            /^(.+?)\s+to\s+(\w+)\s+(.+)$/i
          )

          if (toInfinitiveMatch) {
            const [, beforeTo, potentialVerb, afterVerb] = toInfinitiveMatch

            if (isInfinitiveVerb(potentialVerb)) {
              // Split at "to" infinitive: "organizations to maximize returns" ->
              // "Organizations.to.maximize.Returns"
              const beforePascal = this.toPascalCase(beforeTo)
              const verb = potentialVerb.toLowerCase()
              const objectPascal = this.toPascalCase(afterVerb)
              parts.push(`${beforePascal}.to.${verb}.${objectPascal}`)
            } else {
              // Not an infinitive, fall through to normal handling
              parts.push(this.toPascalCase(parse.complement))
            }
          } else {
            // Check if complement contains an internal prepositional phrase
            // Pattern: "X <verb> <prep> Y" like "businesses concerned with production"
            // Should become: Businesses.concerned.with.Production
            const internalPrepMatch = parse.complement.match(
              /^(.+?)\s+(concerned|related|involved|responsible|engaged|associated|dealing|focused|pertaining)\s+(with|to|in|for|on)\s+(.+)$/i
            )

            if (internalPrepMatch) {
              const [, subject, verb, prep, object] = internalPrepMatch
              // Format: Subject.verb.prep.Object
              const subjectPascal = this.toPascalCase(subject)
              const objectPascal = this.toPascalCase(object)
              parts.push(`${subjectPascal}.${verb.toLowerCase()}.${prep.toLowerCase()}.${objectPascal}`)
            } else {
              // Apply same hyphenated compound logic for complement
              const words = parse.complement.split(/\s+/).filter(w =>
                w && !['and', 'or', 'but'].includes(w.toLowerCase())
              )

              // Check for preposition in complement (e.g., "requirements of customers")
              const prepIndex = words.findIndex(w =>
                ['of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by'].includes(w.toLowerCase())
              )

              if (prepIndex > 0 && prepIndex < words.length - 1) {
                // Split at preposition: "requirements of customers" -> "Requirements.of.Customers"
                const beforePrep = words.slice(0, prepIndex)
                const prep = words[prepIndex]
                const afterPrep = words.slice(prepIndex + 1)

                const beforePascal = this.toPascalCase(beforePrep.join(' '))
                const afterPascal = this.toPascalCase(afterPrep.join(' '))

                parts.push(`${beforePascal}.${prep.toLowerCase()}.${afterPascal}`)
              } else {
                // Convert to PascalCase using helper (strips commas and other punctuation)
                parts.push(this.toPascalCase(parse.complement))
              }
            }
          }
        }
      }
    }

    return parts.join('.')
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

async function main() {
  const parser = new GraphDLParser()
  await parser.initialize()

  // Test with some APQC examples
  const testCases = [
    "Research/Resolve order exceptions",
    "Acquire, Construct, and Manage Assets",
    "Develop Vision and Strategy",
    "Define the business concept and long-term vision",
    "Analyze and evaluate competition",
  ]

  console.log('GraphDL Parser - Test Cases\n')
  console.log('='.repeat(80))

  for (const test of testCases) {
    console.log(`\nInput: "${test}"`)
    const result = parser.parse(test)
    console.log('Parsed:', JSON.stringify(result, null, 2))
    console.log('GraphDL:', parser.toGraphDL(result))
    console.log('-'.repeat(80))
  }

  console.log('\nTop Unknown Words:')
  const unknowns = parser.getUnknownWords(20)
  for (const [word, freq] of unknowns) {
    console.log(`  ${word}: ${freq}`)
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
