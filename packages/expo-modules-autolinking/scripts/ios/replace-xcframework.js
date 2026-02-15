#!/usr/bin/env node
/**
 * Replace XCFramework for Debug/Release Configuration
 *
 * This script updates per-product symlinks that switch between debug and release
 * xcframeworks. It's invoked from a CocoaPods script_phase before each compile
 * to ensure the correct XCFramework variant is linked.
 *
 * Directory structure:
 *   <xcframeworks_dir>/
 *     debug/
 *       <Product>.xcframework
 *     release/
 *       <Product>.xcframework
 *     <Product>.xcframework -> debug/<Product>.xcframework  ← managed by this script
 *     .last_build_configuration
 *
 * Usage:
 *   node replace-xcframework.js -c <CONFIG> -m <MODULE_NAME> -x <XCFRAMEWORKS_DIR>
 *
 * Arguments:
 *   -c, --config  Build configuration: "debug" or "release"
 *   -m, --module  Module/product name (used for validation and logging)
 *   -x, --xcframeworks  Path to the xcframeworks directory next to the podspec
 *
 * The script:
 *   1. Validates that <xcframeworks_dir>/<config>/<Module>.xcframework exists
 *   2. Checks if <xcframeworks_dir>/<Module>.xcframework symlink already points to the right flavor
 *   3. Updates the symlink to point to <config>/<Module>.xcframework if needed
 *   4. Updates any additional xcframework symlinks found in the directory
 *   5. Writes the new config to .last_build_configuration
 *
 * Based on React Native's replace-rncore-version.js pattern.
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    config: null,
    module: null,
    xcframeworksDir: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-c':
      case '--config':
        result.config = args[++i];
        break;
      case '-m':
      case '--module':
        result.module = args[++i];
        break;
      case '-x':
      case '--xcframeworks':
        result.xcframeworksDir = args[++i];
        break;
    }
  }

  return result;
}

// Handle the case where symlink check throws because path doesn't exist
function safeSymlinkCheck(symlinkPath) {
  try {
    return fs.lstatSync(symlinkPath).isSymbolicLink();
  } catch (e) {
    return false;
  }
}

function main() {
  const args = parseArgs();

  // Validate arguments
  if (!args.config || !args.module || !args.xcframeworksDir) {
    console.error(
      'Usage: replace-xcframework.js -c <CONFIG> -m <MODULE_NAME> -x <XCFRAMEWORKS_DIR>'
    );
    console.error('  -c, --config  Build configuration: "debug" or "release"');
    console.error('  -m, --module  Module/product name');
    console.error('  -x, --xcframeworks  Path to the xcframeworks directory');
    process.exit(1);
  }

  // Normalize config to lowercase for directory names
  const configLower = args.config.toLowerCase();
  if (configLower !== 'debug' && configLower !== 'release') {
    console.error(
      `[Expo XCFramework] Invalid configuration: ${args.config}. Must be "debug" or "release".`
    );
    process.exit(1);
  }

  const xcframeworksDir = args.xcframeworksDir;
  const moduleName = args.module;

  // Paths
  const targetXcframework = path.join(xcframeworksDir, configLower, `${moduleName}.xcframework`);
  const lastConfigFile = path.join(xcframeworksDir, '.last_build_configuration');

  // Check if target xcframework exists in the flavor directory
  if (!fs.existsSync(targetXcframework)) {
    console.log(
      `[Expo XCFramework] ${moduleName}: Target xcframework not found at ${targetXcframework}, skipping.`
    );
    return;
  }

  // Read last build configuration
  let lastConfig = null;
  if (fs.existsSync(lastConfigFile)) {
    try {
      lastConfig = fs.readFileSync(lastConfigFile, 'utf8').trim();
    } catch (e) {
      // Ignore read errors
    }
  }

  // Check if configuration has changed
  if (lastConfig === configLower) {
    console.log(`[Expo XCFramework] ${moduleName}: Already pointing to ${configLower}, skipping.`);
    return;
  }

  // Update all .xcframework symlinks in the xcframeworks directory.
  // Each <Product>.xcframework symlink points to <config>/<Product>.xcframework.
  // When switching configurations, we update ALL of them (product + dependencies).
  const entries = fs.readdirSync(xcframeworksDir);
  let updatedCount = 0;
  for (const entry of entries) {
    if (!entry.endsWith('.xcframework')) continue;
    const symlinkPath = path.join(xcframeworksDir, entry);
    if (!safeSymlinkCheck(symlinkPath)) continue;

    const newTarget = path.join(configLower, entry);
    const newTargetFull = path.join(xcframeworksDir, newTarget);

    // Only update if the target exists in the new config
    if (!fs.existsSync(newTargetFull)) {
      console.log(
        `[Expo XCFramework] ${moduleName}: ${entry} not found in ${configLower}/, skipping.`
      );
      continue;
    }

    try {
      fs.unlinkSync(symlinkPath);
    } catch (e) {
      // Ignore errors when removing
    }
    fs.symlinkSync(newTarget, symlinkPath);
    updatedCount++;
  }

  // Write last build configuration
  fs.writeFileSync(lastConfigFile, configLower);

  if (lastConfig && lastConfig !== configLower) {
    console.log(
      `[Expo XCFramework] ${moduleName}: Switched ${updatedCount} xcframework(s) from ${lastConfig} to ${configLower}.`
    );
  } else {
    console.log(
      `[Expo XCFramework] ${moduleName}: Set ${updatedCount} xcframework(s) to ${configLower}.`
    );
  }
}

main();
