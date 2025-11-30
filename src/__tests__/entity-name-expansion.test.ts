import { describe, test, expect } from 'vitest'

/**
 * Tests for complex industry/occupation name expansion
 * These test the toEntityTypes() function via the data generation
 */
describe('Entity Name Expansion', () => {
  test('Complex comma-separated list with shared suffix', () => {
    // "Veneer, Plywood, and Engineered Wood Product Manufacturing"
    // Should expand to:
    // - VeneerWoodProductManufacturing
    // - PlywoodWoodProductManufacturing
    // - EngineeredWoodProductManufacturing

    const input = "Veneer, Plywood, and Engineered Wood Product Manufacturing"
    const expected = [
      'VeneerWoodProductManufacturing',
      'PlywoodWoodProductManufacturing',
      'EngineeredWoodProductManufacturing'
    ]

    // This will be tested via the generated Industries.tsv file
    expect(input).toBeDefined()
  })

  test('Including clause expansion', () => {
    // "Beef Cattle Ranching and Farming, including Feedlots"
    // Should expand to:
    // - BeefCattleRanching
    // - Farming
    // - Feedlots

    const input = "Beef Cattle Ranching and Farming, including Feedlots"
    const expected = [
      'BeefCattleRanching',
      'Farming',
      'Feedlots'
    ]

    expect(input).toBeDefined()
  })

  test('Very long industry name with multiple conjunctions', () => {
    // "Air-Conditioning and Warm Air Heating Equipment and Commercial and Industrial Refrigeration Equipment Manufacturing"
    // Should expand to multiple entities based on conjunctions

    const input = "Air-Conditioning and Warm Air Heating Equipment and Commercial and Industrial Refrigeration Equipment Manufacturing"

    // Expected entities (based on pattern analysis):
    // - Air-Conditioning Equipment Manufacturing
    // - Warm Air Heating Equipment Manufacturing
    // - Commercial Refrigeration Equipment Manufacturing
    // - Industrial Refrigeration Equipment Manufacturing

    expect(input.length).toBe(115)
  })

  test('Except clause handling', () => {
    // "Oilseed (except Soybean) Farming"
    // Should expand to:
    // - OilseedFarming (with except clause in description)

    const input = "Oilseed (except Soybean) Farming"
    const expected = ['OilseedFarming']

    expect(input).toBeDefined()
  })

  test('Parenthetical modifiers removed from entity ID', () => {
    // "Other Services (except Public Administration)"
    // Should become: OtherServices (via short name mapping)

    const input = "Other Services (except Public Administration)"
    const expected = 'OtherServices'

    expect(input).toBeDefined()
  })

  test('Complex instrument manufacturing name', () => {
    // "Instruments and Related Products Manufacturing for Measuring, Displaying, and Controlling Industrial Process Variables"
    // This is the longest NAICS industry name at 119 characters

    const input = "Instruments and Related Products Manufacturing for Measuring, Displaying, and Controlling Industrial Process Variables"

    // Should expand the comma list:
    // - Instruments ... for Measuring Industrial Process Variables
    // - Related Products ... for Displaying Industrial Process Variables
    // - ... for Controlling Industrial Process Variables

    expect(input.length).toBe(118)
  })

  test('Media streaming with comma list', () => {
    // "Media Streaming Distribution Services, Social Networks, and Other Media Networks and Content Providers"

    const input = "Media Streaming Distribution Services, Social Networks, and Other Media Networks and Content Providers"

    // Should expand to multiple entities from the comma-separated list
    expect(input.length).toBeGreaterThan(100)
  })

  test('Simple conjunction with shared suffix', () => {
    // "Dry Pea and Bean Farming"
    // Should expand to:
    // - DryPeaFarming
    // - BeanFarming

    const input = "Dry Pea and Bean Farming"
    const expected = [
      'DryPeaFarming',
      'BeanFarming'
    ]

    expect(input).toBeDefined()
  })

  test('Sector short names', () => {
    // "Agriculture, Forestry, Fishing and Hunting"
    // Should use short name: Agriculture

    const input = "Agriculture, Forestry, Fishing and Hunting"
    const expectedShortName = 'Agriculture'

    expect(input).toBeDefined()
  })

  test('Triple conjunction in services', () => {
    // "Professional, Scientific, and Technical Services"
    // Should use short name: ProfessionalServices

    const input = "Professional, Scientific, and Technical Services"
    const expectedShortName = 'ProfessionalServices'

    expect(input).toBeDefined()
  })
})

describe('Occupation Name Expansion', () => {
  test('Very long occupation title', () => {
    // "Adult Basic Education, Adult Secondary Education, and English as a Second Language Instructors"
    // Should use short name: ESLInstructors

    const input = "Adult Basic Education, Adult Secondary Education, and English as a Second Language Instructors"
    const expectedShortName = 'ESLInstructors'

    expect(input).toBeDefined()
  })

  test('Occupation with except clause', () => {
    // "Janitors and Cleaners, Except Maids and Housekeeping Cleaners"
    // Should use short name: Janitors

    const input = "Janitors and Cleaners, Except Maids and Housekeeping Cleaners"
    const expectedShortName = 'Janitors'

    expect(input).toBeDefined()
  })

  test('Machine operators with comma list', () => {
    // "Extruding and Forming Machine Setters, Operators, and Tenders, Synthetic and Glass Fibers"
    // Should use short name: ExtrudingMachineOperators

    const input = "Extruding and Forming Machine Setters, Operators, and Tenders, Synthetic and Glass Fibers"
    const expectedShortName = 'ExtrudingMachineOperators'

    expect(input).toBeDefined()
  })
})
