import { execSync } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const projectRoot = path.resolve(__dirname, "..");
const buildRoot = path.join(projectRoot, "build");
const lambdaDir = path.join(buildRoot, "lambda");
const artifactPath = path.join(buildRoot, "lambda.zip");

async function ensureCleanDir(dir: string) {
  await fsPromises.rm(dir, { recursive: true, force: true });
  await fsPromises.mkdir(dir, { recursive: true });
}

async function copyIfExists(source: string, destination: string) {
  if (!fs.existsSync(source)) return;
  await fsPromises.cp(source, destination, { recursive: true });
}

async function packageLambda() {
  await ensureCleanDir(lambdaDir);
  await fsPromises.rm(artifactPath, { force: true });

  execSync("npm run build", { stdio: "inherit", cwd: projectRoot });

  await build({
    entryPoints: [path.join(projectRoot, "server", "lambda.ts")],
    bundle: true,
    platform: "node",
    target: "node18",
    format: "esm",
    outfile: path.join(lambdaDir, "index.mjs"),
  });

  await copyIfExists(path.join(projectRoot, "dist"), path.join(lambdaDir, "dist"));
  await copyIfExists(path.join(projectRoot, "shared"), path.join(lambdaDir, "shared"));
  await copyIfExists(path.join(projectRoot, "client"), path.join(lambdaDir, "client"));
  await copyIfExists(path.join(projectRoot, "node_modules"), path.join(lambdaDir, "node_modules"));

  execSync("zip -qr lambda.zip .", { stdio: "inherit", cwd: lambdaDir });

  console.log(`Lambda package created at ${artifactPath}`);
}

packageLambda().catch((error) => {
  console.error("Failed to package Lambda artifact", error);
  process.exit(1);
});
