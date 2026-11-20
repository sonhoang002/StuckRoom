import { describe, expect, it } from 'vitest'
import { lintSchemas } from 'deepspace/server'
import type { CollectionSchema } from 'deepspace/schema'
import { schemas } from './schemas'

const appSchemas = ['question', 'reply'].map((name) => {
  const schema = schemas.find((s) => s.name === name)
  if (!schema) throw new Error(`schema "${name}" is not registered in src/schemas.ts`)
  return schema
})

describe('schemas', () => {
  it('passes the DeepSpace schema linter with no warnings', () => {
    expect(lintSchemas(schemas)).toEqual([])
  })

  describe.each(appSchemas.map((s) => [s.name, s] as [string, CollectionSchema]))(
    '%s permissions',
    (_name, schema) => {
      it('defines the "*" fallback role', () => {
        expect(schema.permissions['*']).toBeDefined()
      })

      it('gives signed-out visitors (viewer) and the "*" fallback the same rule', () => {
        expect(schema.permissions['*']).toEqual(schema.permissions.viewer)
      })

      it('never lets signed-out visitors write', () => {
        for (const role of ['viewer', '*']) {
          const p = schema.permissions[role]
          expect(p, `role ${role}`).toBeDefined()
          expect(p).toMatchObject({ create: false, update: false, delete: false })
        }
      })

      it('only lets members update or delete their own rows', () => {
        expect(schema.permissions.member).toMatchObject({ update: 'own', delete: 'own' })
      })

      // 'published' = owner OR visibilityField matches. With no visibilityField the
      // "OR public" half is always false (deepspace/dist/worker.js isPublic), so a
      // signed-out visitor, who owns nothing, would read zero rows.
      it("only uses read: 'published' when the schema declares a visibilityField", () => {
        const usesPublished = Object.values(schema.permissions).some((p) => p.read === 'published')
        if (usesPublished) expect(schema.visibilityField).toBeDefined()
      })
    },
  )

  describe('question visibility', () => {
    const question = appSchemas.find((s) => s.name === 'question')!

    it('is controlled by the "visibility" column (public | private)', () => {
      expect(question.visibilityField).toBe('visibility')
      const col = question.columns.find((c) => c.name === 'visibility')
      expect(col?.interpretation).toMatchObject({ options: ['public', 'private'] })
    })

    it.each([
      ['title', 255],
      ['content', 1000],
    ])('requires %s server-side, capped at %i characters', (name, max) => {
      const col = question.columns.find((c) => c.name === name)
      expect(col).toMatchObject({ required: true, maxLength: max })
    })

    it('lets members write only title and content directly (status/visibility go through actions)', () => {
      expect(question.permissions.member?.writableFields).toEqual(['title', 'content'])
    })

    it('hides private questions from every non-admin role, signed in or not', () => {
      for (const role of ['*', 'viewer', 'member']) {
        expect(question.permissions[role]?.read, `role ${role}`).toBe('published')
      }
    })
  })

  describe('reply visibility (accepted limitation: replies are readable by anyone)', () => {
    const reply = appSchemas.find((s) => s.name === 'reply')!

    it('requires reply content server-side, capped at 1000 characters', () => {
      const col = reply.columns.find((c) => c.name === 'content')
      expect(col).toMatchObject({ required: true, maxLength: 1000 })
    })

    it('blocks direct reply creation by members (replies go through the postReply action)', () => {
      expect(reply.permissions.member?.create).toBe(false)
    })

    it('lets members edit only the text of their own reply (replyToId cannot be re-pointed)', () => {
      expect(reply.permissions.member).toMatchObject({ update: 'own', writableFields: ['content'] })
    })

    it('lets signed-out visitors read replies so public threads are not empty', () => {
      for (const role of ['*', 'viewer']) {
        expect(reply.permissions[role]?.read, `role ${role}`).toBe(true)
      }
    })
  })
})
