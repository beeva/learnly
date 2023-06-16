import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const HEADER = "x-request-id";
const SAFE_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Reuse the id from the load balancer (or a client retry) when it looks sane, otherwise
 * mint one. It is echoed back so a learner's bug report can be matched to our logs.
 */
export function requestId(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.get(HEADER);
    const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
    req.requestId = id;
    res.setHeader(HEADER, id);
    next();
  };
}
