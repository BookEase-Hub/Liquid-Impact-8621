// artifacts/api-server/src/utils/zod-to-gemini.ts
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Converts a Zod schema to a format compatible with Gemini's responseSchema.
 * Gemini expects a JSON Schema-like object but with specific restrictions.
 */
export function zodSchemaToGeminiSchema(schema: z.ZodType<any>): any {
  const jsonSchema: any = zodToJsonSchema(schema, {
    target: 'openApi3',
    definitionPath: 'definitions',
  });

  // Gemini's responseSchema is basically the schema part of the standard JSON schema
  return transformSchema(jsonSchema);
}

function transformSchema(schema: any): any {
  if (!schema) return schema;

  // If it's a reference, we might need to resolve it (for now let's assume no complex refs)
  if (schema.$ref) {
    // This is a simplification. Real implementation might need to resolve definitions.
    return schema;
  }

  const result: any = {
    type: mapType(schema.type),
  };

  if (schema.description) result.description = schema.description;
  if (schema.enum) result.enum = schema.enum;

  if (result.type === 'OBJECT') {
    result.properties = {};
    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        result.properties[key] = transformSchema(value);
      }
    }
    if (schema.required) {
      result.required = schema.required;
    }
  } else if (result.type === 'ARRAY') {
    if (schema.items) {
      result.items = transformSchema(schema.items);
    }
  }

  return result;
}

function mapType(type: any): string {
  if (!type) return 'STRING';
  const t = Array.isArray(type) ? type[0] : type;
  switch (t) {
    case 'string': return 'STRING';
    case 'number': return 'NUMBER';
    case 'integer': return 'INTEGER';
    case 'boolean': return 'BOOLEAN';
    case 'object': return 'OBJECT';
    case 'array': return 'ARRAY';
    default: return 'STRING';
  }
}
