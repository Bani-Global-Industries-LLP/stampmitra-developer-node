// Minimal typings so the Express example type-checks without installing express.
declare module 'express' {
  export interface Request {
    body: unknown;
    header(name: string): string | undefined;
  }
  export interface Response {
    sendStatus(code: number): void;
    status(code: number): { send(body: string): void };
  }
  interface App {
    post(path: string, ...handlers: unknown[]): void;
    listen(port: number): void;
  }
  interface Express {
    (): App;
    raw(opts: { type: string }): unknown;
  }
  const express: Express;
  export default express;
}
