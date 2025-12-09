import { VERB_INDEX, VerbEntry as GeneratedVerbEntry } from './generated/verbs'
import { CONCEPT_INDEX, ConceptEntry as GeneratedConceptEntry } from './generated/concepts'
import { PREPOSITIONS } from './generated/prepositions'
import { CONJUNCTIONS, ConjunctionEntry as GeneratedConjunctionEntry } from './generated/conjunctions'
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
    return tokens.map(token => {
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

      // Check if all are verbs
      const allVerbs = verbs.every(v => this.lexicon.verbs.has(v.toLowerCase()))

      if (allVerbs && verbs.length >= 3) {
        return {
          original: text,
          predicate: this.capitalize(verbs[0]),
          object: verbs.slice(1).join(' and ') + ' ' + rest,
          modifiers: [],
          confidence: 1,
          unknownWords: [],
          hasConjunction: true,
          expansions: verbs.map(verb => this.parseSingle(`${this.capitalize(verb)} ${rest}`)),
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
    // Also check for commas and slashes which indicate lists to expand
    const hasExpandablePattern = /\b(and|or)\b/i.test(text) || text.includes(',') || text.includes('/')
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
    const verbWithSharedSuffix = text.match(/^(\w+)\s+(.+?)\s+(and|or)\s+([^\s]+)\s+(.+)$/i)
    if (verbWithSharedSuffix) {
      const [, verb, left, conj, middle, suffix] = verbWithSharedSuffix
      if (this.lexicon.verbs.has(verb.toLowerCase())) {
        // Recursively expand left and middle
        const leftExpanded = this.expandPhrase(left)
        const middleExpanded = this.expandPhrase(middle)

        // Recursively expand the suffix as well (for nested conjunctions)
        const results = [
          ...leftExpanded.map(l => `${verb} ${l} ${suffix}`),
          ...middleExpanded.map(m => `${verb} ${m} ${suffix}`)
        ]

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

    return [text]
  }

  /**
   * Check if a phrase needs expansion (has conjunctions, commas, or slashes)
   */
  private needsExpansion(phrase: string): boolean {
    return /\b(and|or)\b/i.test(phrase) || phrase.includes(',') || phrase.includes('/')
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

    // Pattern: "X or Y something" where "something" is shared
    // Example: "generation or mechanical equipment" → ["generation equipment", "mechanical equipment"]
    const sharedSuffixMatch = phrase.match(/^(.+?)\s+(and|or)\s+([^\s]+)\s+(.+)$/i)
    if (sharedSuffixMatch) {
      const [, left, conj, middle, suffix] = sharedSuffixMatch
      // Recursively expand left side and middle
      const leftExpanded = this.expandPhrase(left)
      const middleExpanded = this.expandPhrase(middle)

      return [
        ...leftExpanded.map(l => `${l} ${suffix}`),
        ...middleExpanded.map(m => `${m} ${suffix}`)
      ]
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
   */
  private toPascalCase(phrase: string): string {
    const words = phrase.split(/\s+/).filter(w =>
      w && !['and', 'or', 'but', 'the', 'a', 'an'].includes(w.toLowerCase())
    )

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

    if (parse.subject) parts.push(parse.subject)
    if (parse.predicate) parts.push(parse.predicate)
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
        // No internal preposition - convert all to PascalCase
        const filteredWords = words.filter(w => !['and', 'or', 'but'].includes(w.toLowerCase()))
        const pascalCase = filteredWords
          .map(word => {
            // Handle hyphenated compounds: "cross-functional" -> "CrossFunctional"
            return word.split('-')
              .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
              .join('')
          })
          .join('')

        parts.push(pascalCase)
      }
    }
    if (parse.preposition) parts.push(parse.preposition)
    if (parse.complement) {
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
          // Convert to PascalCase, preserving hyphens as compound words
          const pascalCase = words
            .map(word => {
              // Handle hyphenated compounds: "cross-channel" -> "CrossChannel"
              return word.split('-')
                .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                .join('')
            })
            .join('')

          parts.push(pascalCase)
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
