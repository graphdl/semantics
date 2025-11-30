import { describe, test, expect, beforeAll } from 'vitest'
import { GraphDLParser } from '../parser'

/**
 * Tests for APQC compound term expansion
 *
 * These test cases verify that compound terms like "strategy, plans, and policies"
 * are properly expanded into separate statements rather than being joined into
 * a single CamelCase identifier like "StrategyPlansPolicies".
 *
 * Expected behavior:
 * - "Monitor and update strategy, plans, and policies" should expand to:
 *   - Companies.monitor.Strategy
 *   - Companies.monitor.Plans
 *   - Companies.monitor.Policies
 *   - Companies.update.Strategy
 *   - Companies.update.Plans
 *   - Companies.update.Policies
 */
describe('APQC Compound Term Expansion', () => {
  let parser: GraphDLParser

  beforeAll(async () => {
    parser = new GraphDLParser()
    await parser.initialize()
  })

  test('monitor and update strategy, plans, and policies - should expand all terms', () => {
    const result = parser.parse('Monitor and update strategy, plans, and policies')

    console.log('Strategy/Plans/Policies:', JSON.stringify(result, null, 2))

    // Should have expansions for both verbs
    expect(result.expansions).toBeDefined()
    expect(result.hasConjunction).toBe(true)

    // Verbs should expand
    const predicates = result.expansions!.map(e => e.predicate?.toLowerCase())
    expect(predicates).toContain('monitor')
    expect(predicates).toContain('update')

    // Objects should also expand - strategy, plans, and policies should be SEPARATE
    // NOT combined into "StrategyPlansPolicies"
    const objects = result.expansions!.map(e => e.object?.toLowerCase())

    // The key assertion: we should NOT have a combined term
    expect(objects.every(o => !o?.includes('strategypianspolicies'))).toBe(true)
    expect(objects.every(o => !o?.includes('strategyplanspolicies'))).toBe(true)

    // Each of these should appear as separate expansions
    expect(objects.some(o => o?.includes('strategy'))).toBe(true)
    expect(objects.some(o => o?.includes('plans') || o?.includes('plan'))).toBe(true)
    expect(objects.some(o => o?.includes('policies') || o?.includes('policy'))).toBe(true)

    // Should have 6 total expansions: 2 verbs x 3 objects
    expect(result.expansions!.length).toBeGreaterThanOrEqual(6)
  })

  test('align staffing plan to work force plan and business unit strategies/resource needs', () => {
    const result = parser.parse('Align staffing plan to work force plan and business unit strategies/resource needs')

    console.log('Staffing Plan alignment:', JSON.stringify(result, null, 2))

    // Should have expansions for the "and" conjunction
    expect(result.expansions).toBeDefined()
    expect(result.hasConjunction).toBe(true)

    // Complements should expand - NOT be combined into "WorkForcePlanUnitStrategiesResourceNeeds"
    const complements = result.expansions!.map(e => e.complement?.toLowerCase() || '')

    // The key assertion: we should NOT have a combined mega-term
    expect(complements.every(c => !c?.includes('workforceplanunitstrategiesresourceneeds'))).toBe(true)
    expect(complements.every(c => c.length < 50)).toBe(true) // No mega-long terms

    // Should have separate complements for:
    // 1. work force plan
    // 2. business unit strategies
    // 3. resource needs
    expect(complements.some(c => c?.includes('work') && c?.includes('force'))).toBe(true)
    expect(result.expansions!.length).toBeGreaterThanOrEqual(2)
  })

  test('develop vision and strategy - simple case', () => {
    const result = parser.parse('Develop Vision and Strategy')

    console.log('Vision and Strategy:', JSON.stringify(result, null, 2))

    expect(result.expansions).toBeDefined()
    expect(result.expansions!.length).toBe(2)

    // Should expand to two separate items
    const objects = result.expansions!.map(e => e.object?.toLowerCase())
    expect(objects).toContain('vision')
    expect(objects).toContain('strategy')
  })

  test('comma-separated list with shared verb: analyze trends, risks, and opportunities', () => {
    const result = parser.parse('Analyze trends, risks, and opportunities')

    console.log('Trends/Risks/Opportunities:', JSON.stringify(result, null, 2))

    // Should expand the comma list
    expect(result.expansions).toBeDefined()
    expect(result.expansions!.length).toBe(3)

    const objects = result.expansions!.map(e => e.object?.toLowerCase())
    expect(objects).toContain('trends')
    expect(objects).toContain('risks')
    expect(objects).toContain('opportunities')
  })

  test('compound term should NOT create mega-identifier', () => {
    // This is the anti-pattern we're fixing
    const result = parser.parse('Review contracts, agreements, and policies')

    console.log('Contracts/Agreements/Policies:', JSON.stringify(result, null, 2))

    // GraphDL output should NOT have "ContractsAgreementsPolicies"
    const graphdl = parser.toGraphDL(result)
    console.log('GraphDL output:', graphdl)

    // Should be an array of expansions, not a single mega-term
    expect(graphdl).not.toContain('ContractsAgreementsPolicies')
    expect(graphdl).toContain('[') // Should be bracket notation for expansions
  })

  test('slash-separated alternatives in complement', () => {
    const result = parser.parse('Align staffing plan to strategies/resource needs')

    console.log('Strategies/ResourceNeeds:', JSON.stringify(result, null, 2))

    // Slash should be treated as "or" and expand
    expect(result.expansions).toBeDefined()
    expect(result.expansions!.length).toBeGreaterThanOrEqual(2)
  })

  test('multiple conjunctions: develop or update plans, procedures, and guidelines', () => {
    const result = parser.parse('Develop or update plans, procedures, and guidelines')

    console.log('Plans/Procedures/Guidelines:', JSON.stringify(result, null, 2))

    // Should expand both verbs AND all objects
    expect(result.expansions).toBeDefined()

    // 2 verbs x 3 objects = 6 expansions
    expect(result.expansions!.length).toBeGreaterThanOrEqual(6)

    const predicates = result.expansions!.map(e => e.predicate?.toLowerCase())
    expect(predicates.filter(p => p === 'develop').length).toBe(3)
    expect(predicates.filter(p => p === 'update').length).toBe(3)

    const objects = result.expansions!.map(e => e.object?.toLowerCase())
    expect(objects.filter(o => o === 'plans').length).toBe(2)
    expect(objects.filter(o => o === 'procedures').length).toBe(2)
    expect(objects.filter(o => o === 'guidelines').length).toBe(2)
  })
})
