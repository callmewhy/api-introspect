/**
 * OpenAPI 3.0 spec served at /openapi.json. Mirrors the routes implemented in routes.ts.
 */
export const spec = {
  openapi: '3.0.0',
  info: {
    title: 'Petstore',
    description: 'A demo OpenAPI service. Use api-introspect against the spec URL.',
    version: '1.0.0',
  },
  servers: [
    { url: 'http://localhost:3002', description: 'Local example server' },
  ],
  components: {
    schemas: {
      Pet: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          tag: { type: 'string' },
        },
        required: ['id', 'name'],
      },
      NewPet: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          tag: { type: 'string' },
        },
        required: ['name'],
      },
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
        required: ['message'],
      },
    },
  },
  paths: {
    '/pets': {
      get: {
        summary: 'List all pets',
        operationId: 'listPets',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer' }, description: 'Maximum number of pets to return' },
        ],
        responses: {
          200: {
            description: 'A list of pets',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Pet' } },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create a new pet',
        operationId: 'createPet',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NewPet' } } },
        },
        responses: {
          201: {
            description: 'The created pet',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } },
          },
        },
      },
    },
    '/pets/{id}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
      ],
      get: {
        summary: 'Get a pet by ID',
        operationId: 'getPet',
        responses: {
          200: {
            description: 'The pet',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } },
          },
          404: {
            description: 'Not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
      delete: {
        summary: 'Delete a pet',
        operationId: 'deletePet',
        responses: {
          200: {
            description: 'The deleted pet',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } },
          },
        },
      },
    },
  },
}
