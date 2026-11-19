var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/room.ts
import { DurableObject } from "cloudflare:workers";

// src/state/reducer.ts
var MAX_REACTIONS = 60;
var MAX_KEEPSAKES = 80;
var EMPTY_RECORD = { works: "", feelings: "", insights: "", feedback: "" };
function initialState(roomId) {
  return {
    version: 1,
    roomId,
    startedAt: null,
    world: "campfire",
    visited: [],
    current: null,
    history: [],
    deckUsed: [],
    theme: "",
    participants: {},
    reactions: [],
    reactionCount: { campfire: 0, lantern: 0, nagori: 0, minasoko: 0, bbq: 0, town: 0 },
    speakQueue: [],
    leaves: [],
    lanterns: [],
    scenes: {},
    bottles: [],
    scraps: [],
    records: {}
  };
}
__name(initialState, "initialState");
function visit(state, world, at) {
  const last = state.visited[state.visited.length - 1];
  return last?.world === world ? state.visited : [...state.visited, { world, at }];
}
__name(visit, "visit");
function reduce(state, action) {
  switch (action.type) {
    case "join":
      return {
        ...state,
        participants: { ...state.participants, [action.participant.seat]: action.participant }
      };
    case "leave": {
      const participants = { ...state.participants };
      delete participants[action.seat];
      return { ...state, participants, speakQueue: state.speakQueue.filter((q) => q.seat !== action.seat) };
    }
    case "start":
      return { ...state, startedAt: action.at, visited: visit(state, state.world, action.at) };
    case "travel":
      if (state.world === action.world) return state;
      return { ...state, world: action.world, visited: visit(state, action.world, action.at) };
    case "drawTopic": {
      const used = state.deckUsed.includes(action.drawn.topic.id) ? state.deckUsed : [...state.deckUsed, action.drawn.topic.id];
      return { ...state, current: action.drawn, history: [...state.history, action.drawn], deckUsed: used };
    }
    case "clearTopic":
      return { ...state, current: null };
    case "setTheme":
      return { ...state, theme: action.theme };
    case "react": {
      const { event } = action;
      const queued = state.speakQueue.some((q) => q.seat === event.seat);
      return {
        ...state,
        reactions: [...state.reactions, event].slice(-MAX_REACTIONS),
        reactionCount: { ...state.reactionCount, [event.world]: (state.reactionCount[event.world] ?? 0) + 1 },
        speakQueue: event.reaction === "speak" && !queued ? [...state.speakQueue, { seat: event.seat, at: event.at }] : state.speakQueue
      };
    }
    case "speakDone":
      return { ...state, speakQueue: state.speakQueue.filter((q) => q.seat !== action.seat) };
    case "addLeaf":
      return { ...state, leaves: [...state.leaves, action.leaf].slice(-MAX_KEEPSAKES) };
    case "floatLantern":
      return { ...state, lanterns: [...state.lanterns, action.lantern].slice(-MAX_KEEPSAKES) };
    case "setScene":
      return { ...state, scenes: { ...state.scenes, [action.world]: action.scene } };
    case "keepBottle":
      return { ...state, bottles: [...state.bottles, action.bottle].slice(-MAX_KEEPSAKES) };
    case "addScrap":
      return { ...state, scraps: [...state.scraps, action.scrap].slice(-MAX_KEEPSAKES) };
    case "updateRecord": {
      const prev = state.records[action.seat] ?? EMPTY_RECORD;
      return { ...state, records: { ...state.records, [action.seat]: { ...prev, ...action.patch } } };
    }
    case "fx":
      return state;
    case "reset":
      return { ...initialState(state.roomId), participants: state.participants, startedAt: action.at };
  }
}
__name(reduce, "reduce");
function upgrade(state) {
  const base = initialState(state.roomId);
  return { ...base, ...state, reactionCount: { ...base.reactionCount, ...state.reactionCount } };
}
__name(upgrade, "upgrade");

// worker/room.ts
var MAX_SOCKETS = 12;
var Room = class extends DurableObject {
  static {
    __name(this, "Room");
  }
  state;
  rev = 0;
  roomId = "room";
  async load() {
    if (this.state !== void 0) return;
    this.roomId = await this.ctx.storage.get("name") ?? this.roomId;
    const saved = await this.ctx.storage.get("room");
    this.state = saved ? upgrade(saved.state) : null;
    this.rev = saved?.rev ?? 0;
  }
  async save() {
    if (this.state) await this.ctx.storage.put("room", { rev: this.rev, state: this.state });
  }
  async fetch(request) {
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS) return new Response("Room is full", { status: 429 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ clientId: null, seat: null });
    const name = new URL(request.url).pathname.split("/").pop();
    if (name && !await this.ctx.storage.get("name")) await this.ctx.storage.put("name", decodeURIComponent(name));
    return new Response(null, { status: 101, webSocket: client });
  }
  others(ws) {
    return this.ctx.getWebSockets().filter((s) => s !== ws);
  }
  broadcast(from, data) {
    for (const s of this.others(from)) {
      try {
        s.send(data);
      } catch {
      }
    }
  }
  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string" || raw.length > 256e3) return;
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    const att = ws.deserializeAttachment() ?? { clientId: null, seat: null };
    if (!att.clientId && typeof m.from === "string") {
      att.clientId = m.from.slice(0, 64);
      ws.serializeAttachment(att);
    }
    switch (m.kind) {
      case "hello": {
        await this.load();
        ws.send(JSON.stringify({ kind: "snapshot", from: "server", to: m.from, rev: this.rev, state: this.state ?? null, authoritative: true }));
        for (const s of this.others(ws)) {
          const a = s.deserializeAttachment();
          if (a?.clientId) ws.send(JSON.stringify({ kind: "presence", from: a.clientId, seat: a.seat, at: Date.now() }));
        }
        break;
      }
      case "seed": {
        await this.load();
        if (this.state === null && m.state?.version === 1) {
          this.state = upgrade(m.state);
          this.rev = 1;
          await this.save();
        }
        break;
      }
      case "action": {
        await this.load();
        if (m.action.type !== "fx") {
          const base = this.state ?? initialState(this.roomId);
          const next = reduce(base, m.action);
          if (next !== this.state) {
            this.state = next;
            this.rev += 1;
            await this.save();
          }
        }
        this.broadcast(ws, raw);
        break;
      }
      case "presence":
        att.seat = m.seat;
        ws.serializeAttachment(att);
        this.broadcast(ws, raw);
        break;
      case "bye":
        this.broadcast(ws, raw);
        break;
      case "signal": {
        if (!m.to) {
          this.broadcast(ws, raw);
          break;
        }
        for (const s of this.others(ws)) {
          const a = s.deserializeAttachment();
          if (a?.clientId === m.to) s.send(raw);
        }
        break;
      }
      default:
        break;
    }
  }
  async webSocketClose(ws) {
    const att = ws.deserializeAttachment();
    if (att?.clientId) {
      const bye = JSON.stringify({ kind: "bye", from: att.clientId, seat: att.seat });
      this.broadcast(ws, bye);
      this.broadcast(ws, JSON.stringify({ kind: "signal", from: att.clientId, data: { type: "voice-leave" } }));
    }
    try {
      ws.close();
    } catch {
    }
  }
  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }
};

// worker/index.ts
var ROOM_PATH = /^\/api\/room\/([\w-]{1,32})$/;
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(ROOM_PATH);
    if (match) {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket only", { status: 426 });
      const stub = env.ROOMS.get(env.ROOMS.idFromName(match[1]));
      return stub.fetch(request);
    }
    if (url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
    return env.ASSETS.fetch(request);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-w4gkHe/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-w4gkHe/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  Room,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
