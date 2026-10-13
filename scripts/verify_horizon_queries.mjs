import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const userProfile = process.env.USERPROFILE;
process.env.USERPROFILE = tmpdir();
process.env.HOME = tmpdir();
const require = createRequire(join(project, "ui", "package.json"));
const duckdb = require("@duckdb/duckdb-wasm/blocking");
const python = process.env.CRIBLE_PYTHON ?? (process.platform === "win32"
  ? join(userProfile, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe")
  : "python3");
const extract = `
import ast, json, pathlib
tree = ast.parse(pathlib.Path('scripts/make_mobile_data.py').read_text(encoding='utf-8'))
scope = {'snapshot': 'snapshot.parquet', 'price_path': pathlib.Path('prices-00.parquet'),
         'EXCHANGES': "('NMS','NYQ','NCM','NGM','ASE')"}
scope['latest'] = "(SELECT * FROM read_parquet('snapshot.parquet') QUALIFY row_number() OVER (PARTITION BY symbol ORDER BY period DESC) = 1)"
queries = {}
for node in ast.walk(tree):
    if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call):
        names = [target.id for target in node.targets if isinstance(target, ast.Name)]
        for name in ('long_candidates', 'short_candidates'):
            if name in names:
                queries[name] = eval(compile(ast.Expression(node.value.args[0]), '<sql>', 'eval'), {}, scope)
print(json.dumps(queries))
`;
const extracted = spawnSync(python, ["-c", extract], { cwd: project, encoding: "utf8" });
if (extracted.status !== 0) throw new Error(extracted.stderr || "Could not extract board queries");
const queries = JSON.parse(extracted.stdout);

const bundles = { mvp: {
  mainModule: require.resolve("@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm"),
  mainWorker: require.resolve("@duckdb/duckdb-wasm/dist/duckdb-node-mvp.worker.cjs"),
} };
const db = await duckdb.createDuckDB(bundles, new duckdb.VoidLogger(), duckdb.NODE_RUNTIME);
await db.instantiate();
db.open({ path: ":memory:" });
const data = join(project, "ui", "public", "data");
for (const file of ["snapshot.parquet", "prices-00.parquet"]) {
  db.registerFileBuffer(file, new Uint8Array(readFileSync(join(data, file))));
}
const conn = db.connect();
try {
  const board = { generated_at: 0, prices_typical_date: null, long: [], short: [] };
  if (process.argv.includes("--write")) {
    const manifest = JSON.parse(readFileSync(join(data, "manifest.json"), "utf8"));
    board.generated_at = manifest.generated_at;
    board.prices_typical_date = manifest.prices?.typical_date ?? null;
  }
  for (const [name, sql] of Object.entries(queries)) {
    const rows = conn.query(sql).toArray().map((row) => row.toJSON());
    console.log(`${name}: ${rows.length} candidates`);
    if (process.argv.includes("--write")) {
      board[name === "long_candidates" ? "long" : "short"] = rows.map((row) => ({
        ...row,
        ...(row.price_date ? { price_date: new Date(row.price_date).toISOString().slice(0, 10) } : {}),
      }));
    }
  }
  if (process.argv.includes("--write")) {
    writeFileSync(join(data, "horizon-board.json"), JSON.stringify(board, (_key, value) =>
      typeof value === "bigint" ? (Number.isSafeInteger(Number(value)) ? Number(value) : value.toString()) : value));
  }
} finally {
  conn.close();
  db.reset();
}
