import { HeaderMap } from "@apollo/server"
import type {
  ApolloServer,
  BaseContext,
  ContextFunction,
  HTTPGraphQLRequest,
  HTTPGraphQLResponse,
} from "@apollo/server"
import type { Context, Env, Handler } from "hono"

export type HonoContextFunctionArgument<E extends Env = Env> = {
  c: Context<E>
}

export type HonoHandlerOptions<TContext extends BaseContext, E extends Env = Env> = {
  context?: ContextFunction<[HonoContextFunctionArgument<E>], TContext>
}

const defaultContext: ContextFunction<[HonoContextFunctionArgument<any>], any> = async () => ({})

export function startServerAndCreateHonoHandler<E extends Env = Env>(
  server: ApolloServer,
  options?: HonoHandlerOptions<BaseContext, E>,
): Handler<E>
export function startServerAndCreateHonoHandler<TContext extends BaseContext, E extends Env = Env>(
  server: ApolloServer<TContext>,
  options: Required<HonoHandlerOptions<TContext, E>>,
): Handler<E>
export function startServerAndCreateHonoHandler<TContext extends BaseContext, E extends Env = Env>(
  server: ApolloServer<TContext>,
  options?: HonoHandlerOptions<TContext, E>,
): Handler<E> {
  server.startInBackgroundHandlingStartupErrorsByLoggingAndFailingAllRequests()

  const contextFunction: ContextFunction<[HonoContextFunctionArgument<E>], TContext> =
    options?.context ?? defaultContext

  return async (c) => {
    let httpGraphQLRequest: HTTPGraphQLRequest
    try {
      httpGraphQLRequest = await toHTTPGraphQLRequest(c.req.raw)
    } catch (error) {
      if (error instanceof SyntaxError) {
        return new Response(error.message, { status: 400 })
      }
      throw error
    }

    const httpGraphQLResponse = await server.executeHTTPGraphQLRequest({
      httpGraphQLRequest,
      context: () => contextFunction({ c }),
    })

    return new Response(toBody(httpGraphQLResponse.body), {
      status: httpGraphQLResponse.status ?? 200,
      headers: [...httpGraphQLResponse.headers],
    })
  }
}

async function toHTTPGraphQLRequest(request: Request): Promise<HTTPGraphQLRequest> {
  const headers = new HeaderMap()
  for (const [key, value] of request.headers) {
    headers.set(key, value)
  }

  return {
    method: request.method.toUpperCase(),
    headers,
    search: new URL(request.url).search.slice(1),
    body: await readBody(request, headers.get("content-type")),
  }
}

async function readBody(request: Request, contentType: string | undefined): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined
  }

  const text = await request.text()
  if (contentType !== undefined && isJSONMediaType(contentType)) {
    return text === "" ? {} : JSON.parse(text)
  }
  return text
}

function isJSONMediaType(contentType: string): boolean {
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase() ?? ""
  return mediaType === "application/json" || mediaType.endsWith("+json")
}

function toBody(body: HTTPGraphQLResponse["body"]): string | ReadableStream<Uint8Array> {
  if (body.kind === "complete") {
    return body.string
  }

  const encoder = new TextEncoder()
  const iterator = body.asyncIterator[Symbol.asyncIterator]()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await iterator.next()
      if (done) {
        controller.close()
      } else {
        controller.enqueue(encoder.encode(value))
      }
    },
    async cancel() {
      await iterator.return?.()
    },
  })
}
