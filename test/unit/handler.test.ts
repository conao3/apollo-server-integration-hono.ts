import { ApolloServer } from "@apollo/server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { describe, expect, it } from "vite-plus/test"
import { startServerAndCreateHonoHandler } from "../../src/index.ts"
import type { HonoContextFunctionArgument } from "../../src/index.ts"

type AppEnv = { Variables: { user: string } }

const typeDefs = `#graphql
  type Query {
    hello: String!
    user: String!
  }
`

const resolvers = {
  Query: {
    hello: () => "world",
    user: () => "anonymous",
  },
}

const userResolvers = {
  Query: {
    hello: () => "world",
    user: (_: unknown, __: unknown, context: { user: string }) => context.user,
  },
}

const post = (query: string, headers: Record<string, string> = {}) => ({
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify({ query }),
})

describe("startServerAndCreateHonoHandler", () => {
  it("answers a query", async () => {
    const app = new Hono()
    app.post(
      "/api/graphql",
      startServerAndCreateHonoHandler(new ApolloServer({ typeDefs, resolvers })),
    )

    const res = await app.request("/api/graphql", post("{ hello }"))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { hello: "world" } })
  })

  it("builds the context from the Hono context", async () => {
    const app = new Hono<AppEnv>()
    app.use(async (c, next) => {
      c.set("user", c.req.header("x-user") ?? "anonymous")
      await next()
    })
    app.post(
      "/api/graphql",
      startServerAndCreateHonoHandler(
        new ApolloServer<{ user: string }>({ typeDefs, resolvers: userResolvers }),
        {
          context: async ({ c }: HonoContextFunctionArgument<AppEnv>) => ({ user: c.get("user") }),
        },
      ),
    )

    const res = await app.request("/api/graphql", post("{ user }", { "x-user": "conao3" }))

    expect(await res.json()).toEqual({ data: { user: "conao3" } })
  })

  it("keeps headers set by Hono middleware", async () => {
    const app = new Hono()
    app.use(cors({ origin: "https://example.test" }))
    app.post(
      "/api/graphql",
      startServerAndCreateHonoHandler(new ApolloServer({ typeDefs, resolvers })),
    )

    const res = await app.request(
      "/api/graphql",
      post("{ hello }", { origin: "https://example.test" }),
    )

    expect(res.headers.get("access-control-allow-origin")).toBe("https://example.test")
    expect(res.headers.get("content-type")).toMatch(/^application\/json/)
  })

  it("answers a GET query", async () => {
    const app = new Hono()
    app.get(
      "/api/graphql",
      startServerAndCreateHonoHandler(new ApolloServer({ typeDefs, resolvers })),
    )

    const res = await app.request("/api/graphql?query=%7B%20hello%20%7D", {
      headers: { "apollo-require-preflight": "true" },
    })

    expect(await res.json()).toEqual({ data: { hello: "world" } })
  })

  it("rejects malformed JSON with 400", async () => {
    const app = new Hono()
    app.post(
      "/api/graphql",
      startServerAndCreateHonoHandler(new ApolloServer({ typeDefs, resolvers })),
    )

    const res = await app.request("/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    })

    expect(res.status).toBe(400)
  })
})
