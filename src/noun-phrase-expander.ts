/**
 * Noun Phrase Expander
 *
 * Expands compound noun phrases (like occupation titles) into individual entities.
 * Uses grammar rules to identify head nouns, modifiers, and context phrases.
 *
 * Examples:
 * - "Excavating and Loading Machine and Dragline Operators, Surface Mining"
 *   → ["Excavating Machine Operators, Surface Mining", "Loading Machine Operators, Surface Mining", "Dragline Operators, Surface Mining"]
 *
 * - "Radio, Cellular, and Tower Equipment Installers and Repairers"
 *   → ["Radio Equipment Installers", "Radio Equipment Repairers", "Cellular Equipment Installers", ...]
 */

import fs from 'fs'
import path from 'path'

// ============================================================================
// TYPES
// ============================================================================

export interface NounPhraseExpansion {
  original: string
  expansions: string[]
  headNoun?: string
  contextModifier?: string
  structure: 'simple' | 'compound' | 'coordinated'
}

export interface NounEntry {
  canonicalForm: string
  category: string
  pluralForm: string
  isHeadNoun: boolean
  description: string
}

export interface AdjectiveEntry {
  canonicalForm: string
  category: string
  description: string
}

// ============================================================================
// VOCABULARY LOADING
// ============================================================================

// Head nouns that typically appear at the end of occupation titles
const HEAD_NOUNS = new Set([
  'operators', 'operator',
  'installers', 'installer',
  'repairers', 'repairer',
  'technicians', 'technician',
  'specialists', 'specialist',
  'managers', 'manager',
  'supervisors', 'supervisor',
  'workers', 'worker',
  'assistants', 'assistant',
  'clerks', 'clerk',
  'inspectors', 'inspector',
  'testers', 'tester',
  'analysts', 'analyst',
  'engineers', 'engineer',
  'scientists', 'scientist',
  'representatives', 'representative',
  'attendants', 'attendant',
  'aides', 'aide',
  'therapists', 'therapist',
  'instructors', 'instructor',
  'mechanics', 'mechanic',
  'drivers', 'driver',
  'assemblers', 'assembler',
  'fabricators', 'fabricator',
  'setters', 'setter',
  'tenders', 'tender',
  'handlers', 'handler',
  'loaders', 'loader',
  'movers', 'mover',
  'packers', 'packer',
  'sorters', 'sorter',
])

// Adjectives that modify nouns
const ADJECTIVES = new Set([
  'agricultural', 'biological', 'chemical', 'civil', 'clinical',
  'commercial', 'continuous', 'dental', 'diagnostic', 'digital',
  'electrical', 'electronic', 'environmental', 'financial', 'general',
  'geological', 'hazardous', 'heavy', 'industrial', 'legal',
  'light', 'loading', 'local', 'material', 'mechanical',
  'medical', 'mental', 'military', 'mobile', 'municipal',
  'national', 'natural', 'nonmetallic', 'nuclear', 'occupational',
  'optical', 'oral', 'organizational', 'personal', 'physical',
  'postal', 'private', 'professional', 'public', 'recreational',
  'regional', 'residential', 'retail', 'rural', 'scientific',
  'social', 'special', 'specialized', 'structural', 'surface',
  'technical', 'telecommunications', 'thermal', 'transportation',
  'underground', 'urban', 'veterinary', 'vocational', 'wholesale',
  // Verbal adjectives (present participles used as adjectives)
  'excavating', 'loading', 'moving', 'manufacturing', 'processing',
  'operating', 'installing', 'testing', 'cleaning', 'cutting',
  'welding', 'drilling', 'mixing', 'sorting', 'packing',
])

// Coordinating words
const CONJUNCTIONS = new Set(['and', 'or'])
const COMMA_AND_PATTERN = /,\s*(?:and\s+)?/i
const SIMPLE_AND_PATTERN = /\s+and\s+/i

// ============================================================================
// NOUN PHRASE EXPANDER
// ============================================================================

export class NounPhraseExpander {
  /**
   * Expand a compound noun phrase into individual phrases
   */
  expand(phrase: string): NounPhraseExpansion {
    const original = phrase.trim()

    // Check for context modifier (comma-separated suffix like ", Surface Mining")
    const { mainPhrase, contextModifier } = this.extractContextModifier(original)

    // Identify the head noun(s)
    const headNouns = this.findHeadNouns(mainPhrase)

    if (headNouns.length === 0) {
      // No recognized head noun - try simple expansion
      return {
        original,
        expansions: this.simpleExpand(mainPhrase, contextModifier),
        contextModifier,
        structure: 'simple',
      }
    }

    // If multiple head nouns connected by "and", this is a compound role
    // E.g., "Installers and Repairers"
    if (headNouns.length > 1) {
      return {
        original,
        expansions: this.expandWithMultipleHeadNouns(mainPhrase, headNouns, contextModifier),
        headNoun: headNouns.join(' and '),
        contextModifier,
        structure: 'compound',
      }
    }

    // Single head noun - expand modifiers
    const headNoun = headNouns[0]
    return {
      original,
      expansions: this.expandModifiers(mainPhrase, headNoun, contextModifier),
      headNoun,
      contextModifier,
      structure: 'coordinated',
    }
  }

  /**
   * Extract context modifier after final comma
   * E.g., "Operators, Surface Mining" → { mainPhrase: "Operators", contextModifier: "Surface Mining" }
   */
  private extractContextModifier(phrase: string): { mainPhrase: string; contextModifier?: string } {
    // Look for comma followed by 1-3 words at the end (context modifier pattern)
    // This handles cases like ", Surface Mining" or ", Underground Mining"
    const contextMatch = phrase.match(/,\s*([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+){0,2})$/)

    if (contextMatch) {
      const contextModifier = contextMatch[1].trim()
      const mainPhrase = phrase.slice(0, phrase.lastIndexOf(',')).trim()

      // Verify this looks like a context (not just another list item)
      // Context modifiers typically don't end in head nouns
      const words = contextModifier.toLowerCase().split(/\s+/)
      const lastWord = words[words.length - 1]

      if (!HEAD_NOUNS.has(lastWord)) {
        return { mainPhrase, contextModifier }
      }
    }

    return { mainPhrase: phrase }
  }

  /**
   * Find head nouns in a phrase
   */
  private findHeadNouns(phrase: string): string[] {
    const words = phrase.split(/\s+/)
    const headNouns: string[] = []

    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase().replace(/[,]/g, '')
      if (HEAD_NOUNS.has(word)) {
        // Capture the head noun with proper casing
        headNouns.push(words[i].replace(/[,]/g, ''))
      }
    }

    return headNouns
  }

  /**
   * Simple expansion for phrases without recognized head nouns
   */
  private simpleExpand(phrase: string, contextModifier?: string): string[] {
    // Split on commas and "and"
    let parts: string[]

    if (phrase.includes(',')) {
      parts = phrase.split(COMMA_AND_PATTERN).map(p => p.trim()).filter(p => p)
    } else if (SIMPLE_AND_PATTERN.test(phrase)) {
      parts = phrase.split(SIMPLE_AND_PATTERN).map(p => p.trim()).filter(p => p)
    } else {
      parts = [phrase]
    }

    // Add context modifier to each
    if (contextModifier) {
      return parts.map(p => `${p}, ${contextModifier}`)
    }
    return parts
  }

  /**
   * Expand phrase with multiple head nouns (e.g., "Installers and Repairers")
   */
  private expandWithMultipleHeadNouns(phrase: string, headNouns: string[], contextModifier?: string): string[] {
    const results: string[] = []

    // Find the position of the first head noun
    const firstHeadIndex = this.findWordIndex(phrase, headNouns[0])

    // Get the modifier part (everything before the first head noun)
    let modifierPart = phrase.slice(0, firstHeadIndex).trim()

    // Expand modifiers if they have conjunctions
    const modifierExpansions = this.expandModifierList(modifierPart)

    // For each modifier expansion, create entries for each head noun
    for (const modifier of modifierExpansions) {
      for (const headNoun of headNouns) {
        const expanded = modifier ? `${modifier} ${headNoun}` : headNoun
        if (contextModifier) {
          results.push(`${expanded}, ${contextModifier}`)
        } else {
          results.push(expanded)
        }
      }
    }

    return results.length > 0 ? results : [phrase]
  }

  /**
   * Expand modifiers before a single head noun
   */
  private expandModifiers(phrase: string, headNoun: string, contextModifier?: string): string[] {
    // Find position of head noun
    const headIndex = this.findWordIndex(phrase, headNoun)

    // Get modifier part (everything before head noun)
    const modifierPart = phrase.slice(0, headIndex).trim()

    // Expand the modifiers - handle nested "and" patterns
    const modifierExpansions = this.expandNestedModifiers(modifierPart)

    // Combine each modifier expansion with the head noun
    const results = modifierExpansions.map(modifier => {
      const expanded = modifier ? `${modifier} ${headNoun}` : headNoun
      return contextModifier ? `${expanded}, ${contextModifier}` : expanded
    })

    return results.length > 0 ? results : [phrase]
  }

  /**
   * Handle nested conjunction patterns like "Excavating and Loading Machine and Dragline"
   * This should expand to: ["Excavating Machine", "Loading Machine", "Dragline"]
   */
  private expandNestedModifiers(modifiers: string): string[] {
    if (!modifiers) return ['']

    // Split on all "and" occurrences
    const andParts = modifiers.split(/\s+and\s+/i).map(p => p.trim())

    if (andParts.length <= 1) {
      // No "and" - check for commas
      if (modifiers.includes(',')) {
        return this.expandCommaList(modifiers)
      }
      return [modifiers]
    }

    // Multiple "and" parts - need to figure out which share suffixes
    // Pattern: "A and B C and D" where C is shared by A and B
    // Example: "Excavating and Loading Machine and Dragline"
    //   → parts: ["Excavating", "Loading Machine", "Dragline"]
    //   → "Loading Machine" has suffix "Machine" that applies to "Excavating"

    const results: string[] = []

    for (let i = 0; i < andParts.length; i++) {
      const part = andParts[i]
      const partWords = part.split(/\s+/)

      if (partWords.length === 1) {
        // Single word - might need suffix from next part OR it's standalone
        if (i < andParts.length - 1) {
          // Check if next part has a suffix to share
          const nextPart = andParts[i + 1]
          const nextWords = nextPart.split(/\s+/)

          if (nextWords.length >= 2) {
            // Next part has multiple words - first word might pair with current
            // But if next part itself has multiple words, it's likely a complete phrase
            // "Excavating" + "Loading Machine" → "Excavating Machine", "Loading Machine"
            const suffix = nextWords.slice(1).join(' ')
            results.push(`${part} ${suffix}`)
          } else {
            // Next is also single word - both are standalone
            results.push(part)
          }
        } else {
          // Last part, single word - standalone
          results.push(part)
        }
      } else {
        // Multi-word part - add as-is
        results.push(part)
      }
    }

    return results
  }

  /**
   * Expand a modifier list like "Radio, Cellular, and Tower Equipment"
   * into ["Radio Equipment", "Cellular Equipment", "Tower Equipment"]
   */
  private expandModifierList(modifiers: string): string[] {
    if (!modifiers) return ['']

    // Check for comma-separated list
    if (modifiers.includes(',')) {
      return this.expandCommaList(modifiers)
    }

    // Check for "and" pattern with shared suffix
    // E.g., "Excavating and Loading Machine" → ["Excavating Machine", "Loading Machine"]
    if (SIMPLE_AND_PATTERN.test(modifiers)) {
      return this.expandAndPattern(modifiers)
    }

    return [modifiers]
  }

  /**
   * Expand comma-separated list like "Radio, Cellular, and Tower Equipment"
   */
  private expandCommaList(modifiers: string): string[] {
    // Split on commas (with optional "and")
    const parts = modifiers.split(COMMA_AND_PATTERN).map(p => p.trim()).filter(p => p)

    if (parts.length <= 1) return [modifiers]

    // Check if last part has a shared suffix (like "Equipment")
    const lastPart = parts[parts.length - 1]
    const lastWords = lastPart.split(/\s+/)

    // If last part has multiple words, the last word(s) might be a shared suffix
    if (lastWords.length >= 2) {
      // Try to find a shared suffix - could be 1 or 2 words
      const suffix1 = lastWords[lastWords.length - 1]
      const suffix2 = lastWords.slice(-2).join(' ')

      // Check if other parts are missing this suffix (i.e., they're just adjectives/modifiers)
      const otherParts = parts.slice(0, -1)
      const allOthersShort = otherParts.every(p => p.split(/\s+/).length <= 2)

      if (allOthersShort) {
        // Distribute the suffix to all parts
        // Determine suffix length - prefer 2-word suffix if first word is adjective
        let suffix = suffix1
        if (lastWords.length >= 2 && ADJECTIVES.has(lastWords[lastWords.length - 2].toLowerCase())) {
          // Single word suffix is fine
        } else if (lastWords.length >= 2) {
          // Check if 2-word suffix makes sense
          const prefixPart = lastWords.slice(0, -1).join(' ')
          if (otherParts.every(p => !p.toLowerCase().includes(suffix1.toLowerCase()))) {
            suffix = suffix1
          }
        }

        const prefix = lastWords.slice(0, -1).join(' ')
        const results = otherParts.map(p => `${p} ${suffix}`)
        results.push(`${prefix} ${suffix}`)
        return results
      }
    }

    return parts
  }

  /**
   * Expand "X and Y Z" pattern where Z is shared suffix
   * E.g., "Excavating and Loading Machine" → ["Excavating Machine", "Loading Machine"]
   */
  private expandAndPattern(modifiers: string): string[] {
    const andMatch = modifiers.match(/^(.+?)\s+and\s+(.+)$/i)
    if (!andMatch) return [modifiers]

    const [, left, right] = andMatch
    const rightWords = right.split(/\s+/)

    // If right side has multiple words, last word(s) might be shared suffix
    if (rightWords.length >= 2) {
      // Check if left side ends with the same suffix
      const leftWords = left.split(/\s+/)
      const lastRightWord = rightWords[rightWords.length - 1]

      // If left doesn't end with the suffix, distribute it
      if (leftWords[leftWords.length - 1].toLowerCase() !== lastRightWord.toLowerCase()) {
        // Determine how much of the right is the shared suffix
        // Start with single word, expand if needed
        let suffixWords = 1

        // Check if we need a 2-word suffix
        if (rightWords.length >= 3) {
          const twoWordSuffix = rightWords.slice(-2).join(' ')
          // If left side is very short (1-2 words), likely needs more suffix
          if (leftWords.length <= 2) {
            suffixWords = rightWords.length - 1
          }
        }

        const suffix = rightWords.slice(-suffixWords).join(' ')
        const rightPrefix = rightWords.slice(0, -suffixWords).join(' ')

        // Recursively expand left side if it has conjunctions
        const leftExpansions = this.expandModifierList(left)

        const results: string[] = []
        for (const leftExp of leftExpansions) {
          results.push(`${leftExp} ${suffix}`)
        }
        results.push(`${rightPrefix} ${suffix}`)

        return results
      }
    }

    // Simple split
    return [left, right]
  }

  /**
   * Find the index of a word in a phrase
   */
  private findWordIndex(phrase: string, word: string): number {
    const regex = new RegExp(`\\b${word}\\b`, 'i')
    const match = phrase.match(regex)
    return match ? (match.index ?? 0) : 0
  }
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export function expandNounPhrase(phrase: string): string[] {
  const expander = new NounPhraseExpander()
  const result = expander.expand(phrase)
  return result.expansions
}

// CLI for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const testCases = [
    'Excavating and Loading Machine and Dragline Operators, Surface Mining',
    'Loading and Moving Machine Operators, Underground Mining',
    'Radio, Cellular, and Tower Equipment Installers and Repairers',
    'General and Operations Managers',
    'Computer and Information Systems Managers',
    'Food and Tobacco Roasting, Baking, and Drying Machine Operators and Tenders',
  ]

  console.log('Noun Phrase Expander - Test Cases\n')
  console.log('='.repeat(80))

  const expander = new NounPhraseExpander()

  for (const test of testCases) {
    console.log(`\nInput: "${test}"`)
    const result = expander.expand(test)
    console.log('Structure:', result.structure)
    console.log('Head Noun:', result.headNoun || '(none)')
    console.log('Context:', result.contextModifier || '(none)')
    console.log('Expansions:')
    for (const exp of result.expansions) {
      console.log(`  - ${exp}`)
    }
    console.log('-'.repeat(80))
  }
}
