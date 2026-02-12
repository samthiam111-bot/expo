#!/usr/bin/env node
/**
 * Resolve source path mappings in dSYM bundles for prebuilt XCFrameworks.
 *
 * When Expo modules are prebuilt, absolute source paths in DWARF debug info are
 * replaced with a canonical /expo-src/ prefix via -fdebug-prefix-map. This script
 * writes UUID plists into dSYM bundles that map those canonical paths back to the
 * actual local package paths, so that debuggers (lldb) can resolve source files
 * without manual configuration.
 *
 * This script runs as an Xcode build phase (before compile) and writes plists
 * directly into the source-tree dSYMs embedded inside the xcframework. lldb
 * discovers these dSYMs via Spotlight indexing (by UUID), so the xcframeworks
 * directory must not have a dot prefix to be Spotlight-visible.
 *
 * Usage:
 *   node resolve-dsym-sourcemaps.js -d <dsym_folder> -m <module> -n <npm_package> -r <package_root>
 *
 * Arguments:
 *   -d, --dsym-folder   Folder containing .dSYM bundles
 *   -m, --module        Product/module name (e.g., "ExpoModulesCore")
 *   -n, --npm-package   NPM package name (e.g., "expo-modules-core")
 *   -r, --package-root  Absolute local path to the package root
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    dsymFolder: null,
    module: null,
    npmPackage: null,
    packageRoot: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-d':
      case '--dsym-folder':
        result.dsymFolder = args[++i];
        break;
      case '-m':
      case '--module':
        result.module = args[++i];
        break;
      case '-n':
      case '--npm-package':
        result.npmPackage = args[++i];
        break;
      case '-r':
      case '--package-root':
        result.packageRoot = args[++i];
        break;
    }
  }

  return result;
}

/**
 * Generate DBGVersion=3 plist XML for dSYM source path remapping.
 *
 * This is the same format used by:
 *   - React Native's rncore.rb generate_plist_content()
 *   - Expo's precompiled_modules.rb generate_dsym_plist_content()
 *
 * lldb reads these plists to remap source paths stored in DWARF debug info.
 *
 * @param {Array<[string, string]>} mappings - Array of [from, to] path pairs
 * @returns {string} Plist XML content
 */
function generatePlistContent(mappings) {
  const [firstFrom, firstTo] = mappings[0];

  const remappingEntries = mappings
    .map(([from, to]) => `      <key>${from}</key>\n      <string>${to}</string>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>DBGVersion</key>
  <string>3</string>
  <key>DBGBuildSourcePath</key>
  <string>${firstFrom}</string>
  <key>DBGSourcePath</key>
  <string>${firstTo}</string>
  <key>DBGSourcePathRemapping</key>
  <dict>
${remappingEntries}
  </dict>
</dict>
</plist>
`;
}

/**
 * Extract UUIDs from a dSYM bundle using dwarfdump.
 *
 * @param {string} dsymPath - Path to the .dSYM bundle
 * @returns {string[]} Array of UUID strings
 */
function getUUIDs(dsymPath) {
  try {
    const output = execSync(`dwarfdump --uuid "${dsymPath}" 2>/dev/null`, {
      encoding: 'utf8',
    });
    const uuidRegex = /UUID:\s+([0-9A-F-]{36})/gi;
    const uuids = [];
    let match;
    while ((match = uuidRegex.exec(output)) !== null) {
      uuids.push(match[1]);
    }
    return uuids;
  } catch {
    return [];
  }
}

function main() {
  const args = parseArgs();

  // Validate required arguments
  if (!args.dsymFolder || !args.module || !args.npmPackage || !args.packageRoot) {
    console.error(
      'Usage: resolve-dsym-sourcemaps.js -d <dsym_folder> -m <module> -n <npm_package> -r <package_root>'
    );
    console.error('  -d, --dsym-folder   Folder containing .dSYM bundles');
    console.error('  -m, --module        Product/module name (e.g., "ExpoModulesCore")');
    console.error('  -n, --npm-package   NPM package name (e.g., "expo-modules-core")');
    console.error('  -r, --package-root  Absolute local path to the package root');
    process.exit(1);
  }

  // Locate the dSYM bundle: <dsymFolder>/<module>.framework.dSYM
  const dsymBundleName = `${args.module}.framework.dSYM`;
  const dsymPath = path.join(args.dsymFolder, dsymBundleName);
  const infoPlist = path.join(dsymPath, 'Contents', 'Info.plist');

  if (!fs.existsSync(infoPlist)) {
    // No dSYM bundle found — this is normal for frameworks without debug info
    console.log(
      `[Expo dSYM] ${args.module}: No dSYM bundle found at ${dsymPath}, skipping source map resolution.`
    );
    return;
  }

  // Build source path mappings from the canonical /expo-src/ prefix to local paths.
  // Two mappings cover both internal packages (packages/<name>) and external packages (node_modules/<name>).
  // Resolve the package root to a canonical absolute path (no .. components)
  // because lldb does literal string replacement and won't resolve relative segments.
  const resolvedPackageRoot = path.resolve(args.packageRoot);
  const mappings = [
    [`/expo-src/packages/${args.npmPackage}`, resolvedPackageRoot],
    [`/expo-src/node_modules/${args.npmPackage}`, resolvedPackageRoot],
  ];

  // Extract UUIDs from the dSYM bundle
  const uuids = getUUIDs(dsymPath);
  if (uuids.length === 0) {
    console.log(`[Expo dSYM] ${args.module}: No UUIDs found in dSYM, skipping.`);
    return;
  }

  // Generate plist content and write one plist per UUID
  const plistContent = generatePlistContent(mappings);
  const resourcesDir = path.join(dsymPath, 'Contents', 'Resources');
  fs.mkdirSync(resourcesDir, { recursive: true });

  for (const uuid of uuids) {
    const plistPath = path.join(resourcesDir, `${uuid}.plist`);
    fs.writeFileSync(plistPath, plistContent);
  }

  console.log(
    `[Expo dSYM] ${args.module}: Wrote source path mappings for ${uuids.length} UUID(s).`
  );
}

main();
