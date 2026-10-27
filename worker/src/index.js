import { handleRequest } from "./handler.js";
import { callModel } from "./model.js";

export default {
  fetch(request, env) {
    return handleRequest(request, env, { kv: env.ASK_KV, callModel, now: () => new Date() });
  },
};
