import { createServer } from "node:http"
import { ApolloServer } from "@apollo/server"
import type { ApolloServerOptions, BaseContext } from "@apollo/server"
import { defineIntegrationTestSuite } from "@apollo/server-integration-testsuite"
import type { CreateServerForIntegrationTestsOptions } from "@apollo/server-integration-testsuite"
import { getRequestListener } from "@hono/node-server"
import { Hono } from "hono"
import { startServerAndCreateHonoHandler } from "../../src/index.ts"

defineIntegrationTestSuite(
  async (
    serverOptions: ApolloServerOptions<BaseContext>,
    testOptions?: CreateServerForIntegrationTestsOptions,
  ) => {
    const server = new ApolloServer(serverOptions)
    const app = new Hono()
    app.all("*", startServerAndCreateHonoHandler(server, { context: testOptions?.context }))

    const httpServer = createServer(getRequestListener(app.fetch))
    await new Promise<void>((resolve) => httpServer.listen({ port: 0, host: "127.0.0.1" }, resolve))
    const address = httpServer.address()
    if (address === null || typeof address === "string") {
      throw new Error("The test server is not listening on a TCP port")
    }

    return {
      server,
      url: `http://127.0.0.1:${address.port}/`,
      async extraCleanup() {
        await new Promise<void>((resolve, reject) =>
          httpServer.close((error) => (error ? reject(error) : resolve())),
        )
      },
    }
  },
  { serverIsStartedInBackground: true },
)
