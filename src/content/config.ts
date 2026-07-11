import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const portfolio = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    location: z.string(),
    summary: z.string(),
    elevation: z.string().optional(),
    scope: z.array(z.string()).default([]),
    waterUse: z.string().optional(),
    year: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, portfolio };
