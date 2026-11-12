// Declare Cloudflare namespace fallback for client imports of AppType
declare namespace Cloudflare {
  interface Env {
    [key: string]: any;
  }
}
