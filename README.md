# @graphdl/semantics

GraphDL semantic parser for converting natural language statements to graph notation.

## Installation

```bash
npm install @graphdl/semantics
# or
pnpm add @graphdl/semantics
```

## Usage

```typescript
import { GraphDLParser } from '@graphdl/semantics'

// Create parser with optional lexicon
const parser = new GraphDLParser({
  verbs: ['Manage', 'Develop', 'Analyze'],
  nouns: ['Budget', 'Strategy', 'Data'],
  prepositions: ['for', 'with', 'using']
})

// Parse a statement
const result = parser.parse('Manage budgets for department')
console.log(result)
// {
//   subject: undefined,
//   verb: 'Manage',
//   object: 'budgets',
//   preposition: 'for',
//   prepositionalObject: 'department'
// }
```

## API

### `GraphDLParser`

#### Constructor

```typescript
new GraphDLParser(lexicon?: Lexicon)
```

- `lexicon.verbs` - Array of verb strings
- `lexicon.nouns` - Array of noun strings
- `lexicon.prepositions` - Array of preposition strings

#### Methods

- `parse(statement: string): ParsedStatement` - Parse a natural language statement into GraphDL notation
- `addVerb(verb: string)` - Add a verb to the lexicon
- `addNoun(noun: string)` - Add a noun to the lexicon
- `addPreposition(prep: string)` - Add a preposition to the lexicon

### `ParsedStatement`

```typescript
interface ParsedStatement {
  subject?: string
  verb?: string
  object?: string
  preposition?: string
  prepositionalObject?: string
  modifiers?: string[]
}
```

## GraphDL Notation

GraphDL uses a dot-notation syntax for expressing semantic relationships:

```
Subject.verb.Object.preposition.PrepObject
```

Examples:
- `Manager.manages.Budget` - Simple subject-verb-object
- `Analyst.analyzes.Data.using.Tools` - With prepositional phrase
- `develop.Strategy.for.Organization` - Implicit subject

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm dev
```

## License

MIT
