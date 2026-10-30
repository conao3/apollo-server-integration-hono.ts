# @conao3/apollo-server-integration-hono

[Apollo Server](https://www.apollographql.com/docs/apollo-server) integration for [Hono](https://hono.dev).

It passes the whole `@apollo/server-integration-testsuite`, including incremental delivery (`@defer` / `@stream`), which streams `multipart/mixed` responses as they are produced.

## Install

```sh
pnpm add @conao3/apollo-server-integration-hono @apollo/server graphql hono
```

## Usage

```ts
import { ApolloServer } from "@apollo/server"
import { startServerAndCreateHonoHandler } from "@conao3/apollo-server-integration-hono"
import { serve } from "@hono/node-server"
import { Hono } from "hono"

const server = new ApolloServer({
  typeDefs: `#graphql
    type Query {
      hello: String!
    }
  `,
  resolvers: { Query: { hello: () => "world" } },
})

const app = new Hono()
app.on(["GET", "POST"], "/api/graphql", startServerAndCreateHonoHandler(server))

serve({ fetch: app.fetch, port: 4000 })
```

`startServerAndCreateHonoHandler` starts the server in the background, so call it once at startup and do not call `server.start()` yourself. It returns a Hono handler, which works on every runtime Hono supports.

### Context

The `context` function receives the Hono context as `c`. Give its argument the `Env` of your app to read variables set by middleware:

```ts
import type { HonoContextFunctionArgument } from "@conao3/apollo-server-integration-hono"

type AppEnv = { Variables: { user: string } }
type GraphQLContext = { user: string }

const app = new Hono<AppEnv>()
app.use(async (c, next) => {
  c.set("user", c.req.header("x-user") ?? "anonymous")
  await next()
})
app.post(
  "/api/graphql",
  startServerAndCreateHonoHandler(new ApolloServer<GraphQLContext>({ typeDefs, resolvers }), {
    context: async ({ c }: HonoContextFunctionArgument<AppEnv>) => ({ user: c.get("user") }),
  }),
)
```

Headers that middleware sets on the Hono context (for example `hono/cors`) are kept on the GraphQL response.

## Development

```sh
nix develop          # Node.js 26, pnpm and a local Vite+ CLI wrapper
vp install           # installs dependencies and the pre-commit hook
vp run check         # format, lint, type check, unit tests and the Apollo Server integration test suite
vp pack              # builds dist/ and the example bundle
nix build .#build    # builds the package with Nix
nix run              # starts the example server at http://localhost:4000/api/graphql (PORT overrides the port)
```

Unit tests in `test/unit/` run on Vitest. The Apollo Server integration test suite in `test/integration/` runs on Jest, which the suite requires.

When `pnpm-lock.yaml` changes, update `hash` in `flake.nix` (set it to `pkgs.lib.fakeHash`, run `nix build .#build`, and use the `got:` value).

## License

Apache-2.0
