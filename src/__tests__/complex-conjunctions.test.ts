import { GraphDLParser } from '../parser'

describe('Complex Conjunctions', () => {
  let parser: GraphDLParser

  beforeAll(async () => {
    parser = new GraphDLParser()
    await parser.initialize()
  })

  test('conjunctions with prepositional phrases', () => {
    const result = parser.parse('Discover potential value in opportunities consistent with trading strategy and objectives and within established capital allocation and risk limits')
    console.log('Test 1:', JSON.stringify(result, null, 2))
    // Complex prepositional phrases - currently just preserve the phrase structure
    expect(result.predicate.toLowerCase()).toBe('discover')
    expect(result.object).toBe('PotentialValue')
    expect(result.preposition).toBe('in')
    // The complement should preserve all the "and" conjunctions within the phrase
    expect(result.complement).toContain('and')
    expect(result.complement).toContain('objectives')
    expect(result.complement).toContain('CapitalAllocation')
  })

  test('or with long descriptive phrases', () => {
    const result = parser.parse('Develop or implement plans for sustainable regeneration')
    console.log('Test 2:', JSON.stringify(result, null, 2))
    expect(result.expansions).toBeDefined()
    expect(result.expansions.length).toBe(2)
    expect(result.expansions[0].predicate.toLowerCase()).toBe('develop')
    expect(result.expansions[1].predicate.toLowerCase()).toBe('implement')
    expect(result.expansions[0].object).toBe('plans')
    expect(result.expansions[0].preposition).toBe('for')
    expect(result.expansions[0].complement).toBe('sustainable regeneration')
  })

  test('to + infinitive with or', () => {
    const result = parser.parse('Confer with leaders to coordinate training or to find opportunities')
    console.log('Test 3:', JSON.stringify(result, null, 2))
    expect(result.predicate.toLowerCase()).toBe('confer')
    expect(result.preposition).toBe('with')
    expect(result.complement).toContain('leaders')
  })

  test('analyze with long compound object', () => {
    const result = parser.parse('Analyze operations to determine performance of company staff and achievement of objectives in areas such as potential for cost reduction')
    console.log('Test 4:', JSON.stringify(result, null, 2))
    expect(result.predicate.toLowerCase()).toBe('analyze')
    expect(result.object).toBe('operations')
    expect(result.preposition).toBe('to')
    // Complement should preserve the complex phrase structure
    expect(result.complement).toContain('performance')
  })

  test('simple verb or verb', () => {
    const result = parser.parse('Prepare or present reports')
    console.log('Test 5:', JSON.stringify(result, null, 2))
    expect(result.expansions).toBeDefined()
    expect(result.expansions.length).toBe(2)
    expect(result.expansions[0].predicate.toLowerCase()).toBe('prepare')
    expect(result.expansions[1].predicate.toLowerCase()).toBe('present')
    expect(result.expansions[0].object).toBe('reports')
    expect(result.expansions[1].object).toBe('reports')
  })
})
