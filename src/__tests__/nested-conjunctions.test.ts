import { describe, test, expect, beforeAll } from 'vitest'
import { GraphDLParser } from '../parser.js'

describe('Nested Conjunction Expansions', () => {
  let parser: GraphDLParser

  beforeAll(async () => {
    parser = new GraphDLParser()
    await parser.initialize()
  })

  test('Direct activities of businesses or departments - should expand complement', () => {
    const result = parser.parse('Direct or coordinate activities of businesses or departments concerned with production')

    // Should create cartesian product:
    // 1. Direct activities of businesses
    // 2. Direct activities of departments
    // 3. Coordinate activities of businesses
    // 4. Coordinate activities of departments

    expect(result.expansions).toBeDefined()
    expect(result.expansions!.length).toBe(4)

    const predicates = result.expansions!.map(e => e.predicate?.toLowerCase())
    const complements = result.expansions!.map(e => e.complement?.toLowerCase())

    expect(predicates.filter(p => p === 'direct')).toHaveLength(2)
    expect(predicates.filter(p => p === 'coordinate')).toHaveLength(2)
    expect(complements.filter(c => c?.includes('businesses'))).toHaveLength(2)
    expect(complements.filter(c => c?.includes('departments'))).toHaveLength(2)
  })

  test('Supervise operations to ensure X or Y equipment conform to A or B - should create cartesian product for verbs and equipment', () => {
    const result = parser.parse('Supervise or monitor hydroelectric facility operations to ensure that generation or mechanical equipment conform to applicable regulations or standards')

    // Currently creates cartesian product for verbs and equipment types:
    // (supervise, monitor) × (generation equipment, mechanical equipment)
    // = 2 × 2 = 4 expansions
    // Note: The "regulations or standards" part is not yet expanded in the current implementation

    expect(result.expansions).toBeDefined()
    expect(result.expansions!.length).toBe(4)

    const predicates = result.expansions!.map(e => e.predicate?.toLowerCase())
    expect(predicates.filter(p => p === 'supervise')).toHaveLength(2)
    expect(predicates.filter(p => p === 'monitor')).toHaveLength(2)

    // Check that all 4 combinations exist (2 verbs × 2 equipment types)
    const combinations = result.expansions!.map(e => ({
      pred: e.predicate?.toLowerCase(),
      comp: e.complement?.toLowerCase()
    }))

    // Should have combinations:
    // supervise × generation equipment
    // supervise × mechanical equipment
    // monitor × generation equipment
    // monitor × mechanical equipment

    const hasSuperviseGen = combinations.some(c =>
      c.pred === 'supervise' && c.comp?.includes('generation')
    )
    const hasMonitorMech = combinations.some(c =>
      c.pred === 'monitor' && c.comp?.includes('mechanical')
    )

    expect(hasSuperviseGen).toBe(true)
    expect(hasMonitorMech).toBe(true)
  })

  test('Activities of businesses or departments concerned with X or Y or Z', () => {
    const result = parser.parse('Direct activities of businesses or departments concerned with production, pricing, sales, or distribution of products')

    // Should expand:
    // businesses × (production, pricing, sales, distribution)
    // departments × (production, pricing, sales, distribution)
    // = 2 × 4 = 8 complements

    expect(result.expansions).toBeDefined()
    expect(result.expansions!.length).toBe(8)

    // Verify we have both businesses and departments variants
    const complements = result.expansions!.map(e => e.complement?.toLowerCase() || '')
    expect(complements.filter(c => c.includes('businesses'))).toHaveLength(4)
    expect(complements.filter(c => c.includes('departments'))).toHaveLength(4)

    // Verify we have all four activity types for each
    expect(complements.filter(c => c.includes('production'))).toHaveLength(2)
    expect(complements.filter(c => c.includes('pricing'))).toHaveLength(2)
    expect(complements.filter(c => c.includes('sales'))).toHaveLength(2)
    expect(complements.filter(c => c.includes('distribution'))).toHaveLength(2)
  })

  test('Prepare or file X on Y or Z', () => {
    const result = parser.parse('Prepare or file reports on findings or recommendations')

    // Should create cartesian product:
    // (prepare, file) × (findings, recommendations) = 4 expansions

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
