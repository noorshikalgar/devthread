import { spawn } from "node:child_process";
import http from "node:http";

const DEV_URL = "http://localhost:1420/";

function checkServer() {
  return new Promise((resolve) => {
    const request = http.get(DEV_URL, (response) => {
      response.resume();
      resolve(response.statusCode !== undefined && response.statusCode < 500);
    });

    request.on("error", () => resolve(false));
    request.setTimeout(800, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function keepAlive() {
  console.log(`Reusing existing Vite dev server at ${DEV_URL}`);
  const timer = setInterval(() => undefined, 60_000);
  const stop = () => {
    clearInterval(timer);
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

if (await checkServer()) {
  keepAlive();
} else {
  const vite = spawn("pnpm", ["exec", "vite"], {
    stdio: "inherit",
    shell: true,
  });

  const stop = (signal) => {
    vite.kill(signal);
  };

  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
  vite.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
}
