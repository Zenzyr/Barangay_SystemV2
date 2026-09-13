import { RequestHandler } from "express";

// Express v5 types require handlers to return void | Promise<void>, but many
// controller methods return Response objects from `return response.send(...)`.
// This cast wraps any async controller handler into a compatible RequestHandler
// without changing controller internals.
export const handler = (fn: (...args: any[]) => any): RequestHandler =>
  fn as unknown as RequestHandler;
