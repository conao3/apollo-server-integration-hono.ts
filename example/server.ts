import { ApolloServer } from "@apollo/server"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { startServerAndCreateHonoHandler } from "../src/index.ts"

const server = new ApolloServer({
  typeDefs: `#graphql
    type Query {
      hello(name: String): String!
    }
  `,
  resolvers: {
    Query: {
      hello: (_: unknown, args: { name?: string | null }) => `Hello, ${args.name ?? "world"}!`,
    },
  },
})

const app = new Hono()
app.on(["GET", "POST"], "/api/graphql", startServerAndCreateHonoHandler(server))

const port = Number(process.env.PORT ?? "4000")
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`GraphQL server ready at http://localhost:${info.port}/api/graphql`)
})
