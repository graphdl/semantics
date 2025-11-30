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
})
