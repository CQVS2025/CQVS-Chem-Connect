/**
 * JSON-LD injector - renders a <script type="application/ld+json"> with the
 * given schema object. Server Component (no client JS shipped). Keep one
 * <JsonLd /> per schema rather than merging multiple schemas into one
 * graph; Google handles either, but per-schema is easier to debug in the
 * Rich Results Test.
 */

interface JsonLdProps {
  schema: Record<string, unknown>
  /**
   * Optional id so React can dedupe the script tag during hydration. Lets
   * us inject the same schema from multiple places without warnings.
   */
  id?: string
}

export function JsonLd({ schema, id }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      id={id}
      // Schema objects are constructed server-side from typed data, so this
      // is safe - no user-controlled HTML can land here.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
