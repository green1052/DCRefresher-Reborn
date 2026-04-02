import {execFileSync} from "node:child_process";
import {existsSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {join} from "node:path";

const buildRoot = join(process.cwd(), "build");
const firefoxBuildDir = join(buildRoot, "firefox-mv2-prod");
const manifestPath = join(firefoxBuildDir, "manifest.json");
const zipPath = join(buildRoot, "firefox-mv2-prod.zip");
const xpiPath = join(buildRoot, "firefox-mv2-prod.xpi");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

manifest.browser_specific_settings ??= {};
manifest.browser_specific_settings.gecko ??= {};
manifest.browser_specific_settings.gecko_android ??= {};

writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);

if (existsSync(zipPath)) {
    rmSync(zipPath);
}

if (existsSync(xpiPath)) {
    rmSync(xpiPath);
}

execFileSync("zip", ["-qr", zipPath, "."], {
    cwd: firefoxBuildDir,
    stdio: "inherit"
});
