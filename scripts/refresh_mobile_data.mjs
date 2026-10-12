import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(project, "ui", "public", "data");
const DEFAULT_ORIGIN = "https://maxgfr.github.io/crible/data/";
const CHUNK_SIZE = 4 * 1024 * 1024;
const BUNDLE_VERSION = 2;

export function needsRefresh(remote, local) {
  if (!local) return true;
  if (local.bundle_version !== BUNDLE_VERSION) return true;
  if (remote.generated_at > local.generated_at) return true;
  if (remote.generated_at < local.generated_at) return false;
  return Boolean(remote.prices?.max_date &&
    (!local.prices?.max_date || remote.prices.max_date > local.prices.max_date));
}

export function sourceFiles(manifest) {
  const shards = manifest.prices?.shards?.map((shard) => shard.file) ?? [];
  if (shards.some((name) => !/^prices-\d+\.parquet$/.test(name))) {
    throw new Error("上游价格分片文件名不合法");
  }
  const files = ["snapshot.parquet", ...shards];
  if (files.some((name) => !/^[a-zA-Z0-9_-]+\.parquet$/.test(name))) {
    throw new Error("上游清单包含不合法的文件名");
  }
  return [...new Set(files)];
}

async function fetchManifest(origin, fetchImpl = fetch) {
  const response = await fetchImpl(new URL(`manifest.json?t=${Date.now()}`, origin), {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`上游清单请求失败：HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest.schema !== 2 || !Number.isFinite(manifest.generated_at) ||
      manifest.snapshot_symbols < 1 || manifest.snapshot_rows < 1) {
    throw new Error("上游清单无效，保留现有数据");
  }
  sourceFiles(manifest);
  return manifest;
}

export async function downloadParquet(url, path, fetchImpl = fetch) {
  const probe = await fetchImpl(url, {
    headers: { Range: "bytes=0-0" },
    signal: AbortSignal.timeout(30_000),
  });
  const match = /^bytes 0-0\/(\d+)$/.exec(probe.headers.get("content-range") ?? "");
  await probe.body?.cancel();
  if (probe.status !== 206 || !match) throw new Error(`无法分段下载 ${url}`);
  const size = Number(match[1]);
  if (!Number.isSafeInteger(size) || size < 8) throw new Error(`文件大小无效：${url}`);

  const file = await open(path, "w+");
  try {
    await file.truncate(size);
    let cursor = 0;
    const worker = async () => {
      while (cursor < size) {
        const start = cursor;
        cursor += CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, size) - 1;
        let saved = false;
        for (let attempt = 0; attempt < 4 && !saved; attempt++) {
          try {
            const response = await fetchImpl(url, {
              headers: { Range: `bytes=${start}-${end}` },
              signal: AbortSignal.timeout(60_000),
            });
            if (response.status !== 206 ||
                response.headers.get("content-range") !== `bytes ${start}-${end}/${size}`) {
              throw new Error(`分段响应不匹配：${start}-${end}`);
            }
            const bytes = Buffer.from(await response.arrayBuffer());
            if (bytes.length !== end - start + 1) throw new Error(`下载不完整：${start}-${end}`);
            await file.write(bytes, 0, bytes.length, start);
            saved = true;
          } catch (error) {
            if (attempt === 3) throw error;
            await new Promise((done) => setTimeout(done, (attempt + 1) * 1000));
          }
        }
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    const first = Buffer.alloc(4);
    const last = Buffer.alloc(4);
    await file.read(first, 0, 4, 0);
    await file.read(last, 0, 4, size - 4);
    if (first.toString() !== "PAR1" || last.toString() !== "PAR1") {
      throw new Error(`Parquet 校验失败：${url}`);
    }
  } finally {
    await file.close();
  }
  return size;
}

function pythonExecutable() {
  const userProfile = process.env.USERPROFILE;
  const bundled = userProfile && join(userProfile, ".cache", "codex-runtimes",
    "codex-primary-runtime", "dependencies", "python", "python.exe");
  const candidates = [process.env.CRIBLE_PYTHON, bundled, "python3", "python"].filter(Boolean);
  return candidates.find((candidate) => candidate.includes("\\") || candidate.includes("/")
    ? existsSync(candidate) : true);
}

async function publish(stageDir) {
  const previous = `${dataDir}.previous`;
  if (!existsSync(dataDir) && existsSync(previous)) await rename(previous, dataDir);
  await rm(previous, { recursive: true, force: true });
  const hadCurrent = existsSync(dataDir);
  if (hadCurrent) await rename(dataDir, previous);
  try {
    await rename(stageDir, dataDir);
  } catch (error) {
    if (hadCurrent) await rename(previous, dataDir);
    throw error;
  }
  await rm(previous, { recursive: true, force: true });
}

async function withRefreshLock(action) {
  const lockPath = `${dataDir}.refresh.lock`;
  let lock;
  try {
    lock = await open(lockPath, "wx");
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const age = Date.now() - (await stat(lockPath)).mtimeMs;
    if (age < 3 * 60 * 60 * 1000) throw new Error("已有数据更新任务在运行");
    await rm(lockPath);
    lock = await open(lockPath, "wx");
  }
  try {
    await lock.writeFile(`${process.pid}\n${new Date().toISOString()}\n`);
    return await action();
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}

export async function refresh({ origin = DEFAULT_ORIGIN, force = false, check = false } = {}) {
  return withRefreshLock(() => runRefresh({ origin, force, check }));
}

async function runRefresh({ origin, force, check }) {
  const base = new URL(origin.endsWith("/") ? origin : `${origin}/`);
  const previous = `${dataDir}.previous`;
  if (!existsSync(dataDir) && existsSync(previous)) await rename(previous, dataDir);
  const remote = await fetchManifest(base);
  const local = await readFile(join(dataDir, "manifest.json"), "utf8")
    .then(JSON.parse).catch(() => null);
  const needed = force || needsRefresh(remote, local);
  console.log(`上游快照：${new Date(remote.generated_at * 1000).toISOString()}`);
  console.log(`本地快照：${local ? new Date(local.generated_at * 1000).toISOString() : "无"}`);
  if (check || !needed) {
    console.log(needed ? "有新数据可更新" : "已经是最新数据");
    return needed;
  }

  const stage = await mkdtemp(join(tmpdir(), "crible-mobile-"));
  const source = join(stage, "source");
  const output = join(stage, "output");
  await mkdir(source);
  await mkdir(output);
  try {
    await writeFile(join(source, "manifest.json"), JSON.stringify(remote));
    for (const name of sourceFiles(remote)) {
      const bytes = await downloadParquet(new URL(`${name}?v=${remote.generated_at}`, base), join(source, name));
      console.log(`${name}：${(bytes / 1e6).toFixed(1)} MB`);
    }
    const python = pythonExecutable();
    if (!python) throw new Error("找不到 Python，请设置 CRIBLE_PYTHON");
    const pythonPath = process.env.CRIBLE_PYTHONPATH ?? join(project, ".python-deps");
    const result = spawnSync(python, [join(project, "scripts", "make_mobile_data.py"),
      "--source-dir", source, "--output-dir", output], {
      cwd: project,
      encoding: "utf8",
      env: { ...process.env, PYTHONPATH: [pythonPath, process.env.PYTHONPATH].filter(Boolean).join(process.platform === "win32" ? ";" : ":") },
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.status !== 0) throw new Error(result.stderr || `数据生成失败：${result.status}`);
    const built = JSON.parse(await readFile(join(output, "manifest.json"), "utf8"));
    if (built.bundle_version !== BUNDLE_VERSION || built.generated_at !== remote.generated_at ||
        built.snapshot_symbols < 1000 ||
        (remote.prices?.shards?.length && !built.prices?.bars)) {
      throw new Error("生成结果未通过覆盖量或价格校验，保留现有数据");
    }
    await publish(output);
    console.log(`更新完成：${built.snapshot_symbols} 家公司、${built.prices?.bars ?? 0} 条收盘价记录`);
    return true;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const origin = args.find((arg) => arg.startsWith("--origin="))?.slice(9) ?? DEFAULT_ORIGIN;
  refresh({ origin, force: args.includes("--force"), check: args.includes("--check") })
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
