import serverlessExpress from "@vendia/serverless-express";
import type { Handler } from "aws-lambda";
import { buildApp } from "./app";
import { serveStatic } from "./vite";

let handlerCache: ReturnType<typeof serverlessExpress> | undefined;

async function getHandler() {
  if (!handlerCache) {
    const app = await buildApp();
    serveStatic(app);
    handlerCache = serverlessExpress({ app });
  }
  return handlerCache;
}

export const handler: Handler = async (event, context, callback) => {
  const expressHandler = await getHandler();
  return expressHandler(event, context, callback);
};
