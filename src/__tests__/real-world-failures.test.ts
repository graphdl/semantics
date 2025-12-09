import { GraphDLParser } from '../parser'

describe('Real World Failure Cases', () => {
  let parser: GraphDLParser

  beforeAll(async () => {
    parser = new GraphDLParser()
    await parser.initialize()
  })

  test('ONET: develop or implement with complex phrase', () => {
    const result = parser.parse('Develop or implement plans for the sustainable regeneration of brownfield sites')
    console.log('Brownfield:', JSON.stringify(result, null, 2))
    expect(result.expansions).toBeDefined()
    expect(result.expansions.length).toBe(2)
    expect(result.expansions[0].predicate.toLowerCase()).toBe('develop')
    expect(result.expansions[1].predicate.toLowerCase()).toBe('implement')
    // Both should have same complement
    expect(result.expansions[0].complement).toContain('sustainable')
    expect(result.expansions[1].complement).toContain('sustainable')
  })

  test('ONET: design or modify', () => {
    const result = parser.parse('Design or modify engineering schematics for electrical transmission')
    console.log('Design/Modify:', JSON.stringify(result, null, 2))
    expect(result.expansions).toBeDefined()
    expect(result.expansions.length).toBe(2)
    expect(result.expansions[0].predicate.toLowerCase()).toBe('design')
    expect(result.expansions[1].predicate.toLowerCase()).toBe('modify')
  })

  test('APQC: discover value with multiple ands', () => {
    const result = parser.parse('Discover potential value in opportunities consistent with trading strategy and objectives')
    console.log('Discover:', JSON.stringify(result, null, 2))
    expect(result.predicate.toLowerCase()).toBe('discover')
    // Object is normalized to PascalCase concept format
    expect(result.object).toBe('PotentialValue')
    // Should NOT expand on "and" within prepositional phrase
    expect(result.complement).toContain('TradingStrategy')
  })

  test('ONET: assist and support - should expand', () => {
    const result = parser.parse('Assist and support children individually')
    console.log('Assist/Support:', JSON.stringify(result, null, 2))
    expect(result.expansions).toBeDefined()
    expect(result.expansions.length).toBe(2)
    expect(result.expansions[0].predicate.toLowerCase()).toBe('assist')
    expect(result.expansions[1].predicate.toLowerCase()).toBe('support')
  })

  test('ONET: organize and label - should expand', () => {
    const result = parser.parse('Organize and label materials')
    console.log('Organize/Label:', JSON.stringify(result, null, 2))
    expect(result.expansions).toBeDefined()
    expect(result.expansions.length).toBe(2)
    expect(result.expansions[0].predicate.toLowerCase()).toBe('organize')
    expect(result.expansions[1].predicate.toLowerCase()).toBe('label')
  })

  // ============================================================================
  // Complex multi-preposition patterns (from longest IDs analysis)
  // ============================================================================

  test('ONET: multiple "to" clauses should be expanded', () => {
    // Original: Direct, plan, or implement policies, objectives, or activities of organizations
    // or businesses to ensure continuing operations, to maximize returns on investments,
    // or to increase productivity.
    const result = parser.parse('Direct policies of organizations to ensure continuing operations, to maximize returns on investments, or to increase productivity')
    console.log('Multiple to clauses:', JSON.stringify(result, null, 2))

    // Should expand the complement into separate statements
    expect(result.expansions).toBeDefined()
    // Each "to X" should be a separate expansion
    expect(result.expansions.length).toBeGreaterThanOrEqual(3)
  })

  test('ONET: complex nested ands and ors', () => {
    // Direct, plan, or implement policies, objectives, or activities
    const result = parser.parse('Direct, plan, or implement policies, objectives, or activities')
    console.log('Complex nested:', JSON.stringify(result, null, 2))

    // Currently expands verbs: direct, plan, implement = 3 expansions
    // TODO: Ideally should also expand objects: policies, objectives, activities
    // for a total of 3 verbs × 3 objects = 9 expansions
    expect(result.expansions).toBeDefined()
    expect(result.expansions.length).toBeGreaterThanOrEqual(3)
    expect(result.expansions[0].predicate.toLowerCase()).toBe('direct')
    expect(result.expansions[1].predicate.toLowerCase()).toBe('plan')
    expect(result.expansions[2].predicate.toLowerCase()).toBe('implement')
  })

  test('ONET: such as examples should be separate expansions', () => {
    // "features such as highway alignments, property boundaries, utilities"
    const result = parser.parse('Survey features such as highway alignments, property boundaries, and utilities')
    console.log('Such as:', JSON.stringify(result, null, 2))

    // Should expand to: Survey highway alignments, Survey property boundaries, Survey utilities
    expect(result.expansions).toBeDefined()
    expect(result.expansions.length).toBeGreaterThanOrEqual(3)
  })

  test('ONET: working from pattern', () => {
    // "working from job orders, sketches, modification orders, samples"
    const result = parser.parse('Modify equipment working from job orders, sketches, and modification orders')
    console.log('Working from:', JSON.stringify(result, null, 2))

    // Should keep "working from" together and expand the list
    expect(result.expansions).toBeDefined()
    expect(result.expansions.length).toBeGreaterThanOrEqual(3)
  })

  test('ONET: comma-separated verb list with oxford comma', () => {
    // "Collect, synthesize, analyze, manage, and report"
    const result = parser.parse('Collect, synthesize, analyze, manage, and report environmental data')
    console.log('Verb list:', JSON.stringify(result, null, 2))

    // Should expand to 5 separate tasks
    expect(result.expansions).toBeDefined()
    expect(result.expansions.length).toBe(5)
    expect(result.expansions[0].predicate.toLowerCase()).toBe('collect')
    expect(result.expansions[4].predicate.toLowerCase()).toBe('report')
  })

  test('GraphDL ID should not contain commas', () => {
    const result = parser.parse('Direct policies to ensure operations, maximize investments')
    console.log('ID test:', JSON.stringify(result, null, 2))

    // When we get expansions, each should produce a clean ID
    if (result.expansions && result.expansions.length > 0) {
      for (const exp of result.expansions) {
        const graphdlId = parser.toGraphDL(exp)
        expect(graphdlId).not.toContain(',')
        console.log('  ID:', graphdlId)
      }
    } else {
      const graphdlId = parser.toGraphDL(result)
      expect(graphdlId).not.toContain(',')
      console.log('  ID:', graphdlId)
    }
  })
})
