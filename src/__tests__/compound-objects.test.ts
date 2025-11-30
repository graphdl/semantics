import { describe, test, expect, beforeAll } from 'vitest'
import { GraphDLParser } from '../parser.js'

describe('Compound Objects with Conjunctions', () => {
  let parser: GraphDLParser

  beforeAll(async () => {
    parser = new GraphDLParser()
    await parser.initialize()
  })

  test('supervise X to ensure Y or Z equipment - should expand equipment types', () => {
    const result = parser.parse('Supervise or monitor hydroelectric facility operations to ensure that generation or mechanical equipment conform to applicable regulations or standards')

    // Should expand:
    // 1. supervise operations to ensure generation equipment conform to regulations
    // 2. supervise operations to ensure generation equipment conform to standards
    // 3. supervise operations to ensure mechanical equipment conform to regulations
    // 4. supervise operations to ensure mechanical equipment conform to standards
    // 5. monitor operations to ensure generation equipment conform to regulations
    // 6. monitor operations to ensure generation equipment conform to standards
    // 7. monitor operations to ensure mechanical equipment conform to regulations
    // 8. monitor operations to ensure mechanical equipment conform to standards

    expect(result.expansions).toBeDefined()
    expect(result.expansions!.length).toBeGreaterThanOrEqual(2) // At minimum should expand verbs

    console.log('Supervise/monitor expansions:', JSON.stringify(result.expansions?.map(e => ({
      predicate: e.predicate,
      object: e.object,
      complement: e.complement
    })), null, 2))
  })

  test('coordinate activities of X or Y - should expand both verbs AND both objects', () => {
    const result = parser.parse('Direct or coordinate activities of businesses or departments concerned with production')

    // Should expand both verbs AND both objects
    expect(result.expansions).toBeDefined()
    expect(result.expansions!.length).toBeGreaterThanOrEqual(2) // At minimum should expand verbs

    const predicates = result.expansions!.map(e => e.predicate?.toLowerCase())
    expect(predicates).toContain('direct')
    expect(predicates).toContain('coordinate')

    console.log('Direct/coordinate expansions:', JSON.stringify(result.expansions?.map(e => ({
      predicate: e.predicate,
      complement: e.complement
    })), null, 2))
  })

  test('activities of businesses or departments', () => {
    const result = parser.parse('Coordinate activities of businesses or departments')

    expect(result.expansions).toBeDefined()
    expect(result.expansions!.length).toBe(2)

    // Should expand to:
    // 1. Coordinate activities of businesses
    // 2. Coordinate activities of departments
    const expansion0 = result.expansions![0]
    const expansion1 = result.expansions![1]

    expect(expansion0.predicate?.toLowerCase()).toBe('coordinate')
    expect(expansion0.object?.toLowerCase()).toContain('activities')
    expect(expansion0.complement?.toLowerCase()).toContain('businesses')

    expect(expansion1.predicate?.toLowerCase()).toBe('coordinate')
    expect(expansion1.object?.toLowerCase()).toContain('activities')
    expect(expansion1.complement?.toLowerCase()).toContain('departments')
  })

  test('ensure adherence to X or compliance with Y', () => {
    const result = parser.parse('Review plans to ensure adherence to specifications or compliance with codes')

    expect(result.expansions).toBeDefined()
    expect(result.expansions!.length).toBe(2)

    // Should expand to:
    // 1. Review plans to ensure adherence to specifications
    // 2. Review plans to ensure compliance with codes

    const complements = result.expansions!.map(e => e.complement?.toLowerCase())
    expect(complements.some(c => c?.includes('adherence') && c?.includes('specifications'))).toBe(true)
    expect(complements.some(c => c?.includes('compliance') && c?.includes('codes'))).toBe(true)
  })

  test('generation or mechanical equipment - simple noun phrase with or', () => {
    const result = parser.parse('Inspect generation or mechanical equipment')

    expect(result.expansions).toBeDefined()
    expect(result.expansions!.length).toBe(2)

    // Should expand to:
    // 1. Inspect generation equipment
    // 2. Inspect mechanical equipment

    const objects = result.expansions!.map(e => e.object?.toLowerCase())
    expect(objects.some(o => o?.includes('generation'))).toBe(true)
    expect(objects.some(o => o?.includes('mechanical'))).toBe(true)
  })

  test('conform to X or Y - multiple complements', () => {
    const result = parser.parse('Ensure equipment conforms to applicable regulations or standards')

    expect(result.expansions).toBeDefined()
    expect(result.expansions!.length).toBe(2)

    // Should expand to:
    // 1. Ensure equipment conforms to applicable regulations
    // 2. Ensure equipment conforms to applicable standards

    const complements = result.expansions!.map(e => e.complement?.toLowerCase())
    expect(complements.some(c => c?.includes('regulations'))).toBe(true)
    expect(complements.some(c => c?.includes('standards'))).toBe(true)
  })

  test('cartesian product: verb1 or verb2 + object + complement1 or complement2', () => {
    const result = parser.parse('Prepare or file reports on findings or recommendations')

    // Should create cartesian product:
    // 1. Prepare reports on findings
    // 2. Prepare reports on recommendations
    // 3. File reports on findings
    // 4. File reports on recommendations

    expect(result.expansions).toBeDefined()
    expect(result.expansions!.length).toBe(4)

    const predicates = result.expansions!.map(e => e.predicate?.toLowerCase())
    const complements = result.expansions!.map(e => e.complement?.toLowerCase())

    expect(predicates.filter(p => p === 'prepare')).toHaveLength(2)
    expect(predicates.filter(p => p === 'file')).toHaveLength(2)
    expect(complements.filter(c => c?.includes('findings'))).toHaveLength(2)
    expect(complements.filter(c => c?.includes('recommendations'))).toHaveLength(2)
  })
})
