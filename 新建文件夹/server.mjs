import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { initDb } from "./db.mjs";
import { generateWeeklyPlan, canonical } from "./plan.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function handleWeeklyPlan(request, response) {
  try {
    const url = new URL(request.url, "http://localhost");
    const raw = url.searchParams.get("ingredients") || "";
    const ingredients = [...new Set(raw.split(/[，,、\s]+/).map((name) => name.trim()).filter(Boolean).map(canonical))];
    if (!ingredients.length) {
      sendJson(response, 400, { error: "请先添加食材，再生成一周食谱" });
      return;
    }
    if (ingredients.length > 60) {
      sendJson(response, 400, { error: "食材种类太多啦（最多 60 种），请精简后重试" });
      return;
    }
    const seed = url.searchParams.get("seed") || "";
    sendJson(response, 200, generateWeeklyPlan(ingredients, seed));
  } catch (error) {
    sendJson(response, 500, { error: `生成一周食谱失败：${error.message}` });
  }
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  if (pathname === "/api/weekly-plan") {
    if (request.method === "HEAD") {
      response.writeHead(405, { Allow: "GET" }).end();
      return;
    }
    handleWeeklyPlan(request, response);
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(root + sep)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    await access(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
});

try {
  initDb();
} catch (error) {
  console.error(`启动失败：${error.message}`);
  console.error("如果还没有菜谱数据，请先运行 npm run db:sync 生成 data/recipes.json 并播种数据库。");
  process.exit(1);
}

server.listen(port, "0.0.0.0", () => {
  console.log(`一餐灵感已启动: http://localhost:${port}`);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === "IPv4" && !address.internal) {
        console.log(`同一 Wi-Fi 下的手机可访问: http://${address.address}:${port}`);
      }
    }
  }
  console.log("手机主屏安装需使用 HTTPS 部署地址；局域网 HTTP 可直接浏览和使用。按 Ctrl+C 停止。");
});
