import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

import type { SPMPackageSource } from './ExternalPackage';
import { BuildFlavor } from './Prebuilder.types';
import { BuildPlatform, ProductPlatform, SPMProduct } from './SPMConfig.types';
import { SPMGenerator } from './SPMGenerator';
import { spawnXcodeBuildWithSpinner } from './XCodeRunner';
import { getExpoRepositoryRootDir } from '../Directories';
import logger from '../Logger';

export const SPMBuild = {
  /**
   * Builds the Swift package using xcodebuild.
   * @param pkg Pacakge to build
   * @param product Product to build
   * @param buildType Build flavor (Debug or Release)
   * @param platform Optional activate platform to build for
   */
  buildSwiftPackageAsync: async (
    pkg: SPMPackageSource,
    product: SPMProduct,
    buildType: BuildFlavor,
    platform?: BuildPlatform
  ): Promise<void> => {
    logger.info(
      `🏗  Build Swift package for ${chalk.green(pkg.packageName)}/${chalk.green(product.name)} (${buildType.toLowerCase()})`
    );

    // Verify that we have a Package.swift file in the package directory
    const packageSwiftPath = SPMGenerator.getSwiftPackagePath(pkg, product);
    if (!(await fs.existsSync(packageSwiftPath))) {
      throw new Error(`No Package.swift file found in package: ${pkg.packageName}`);
    }

    // Collect all build platforms, filtering if a specific platform is requested
    const buildPlatforms = getBuildPlatformsForProduct(product, platform);
    if (buildPlatforms.length === 0) {
      throw new Error(
        `No build platforms found for product: ${product.name} in package: ${pkg.packageName}`
      );
    }

    // Build for each platform
    for (const buildPlatform of buildPlatforms) {
      await buildForPlatformAsync(pkg, product, buildType, buildPlatform, packageSwiftPath);
    }

    logger.info(`🏗  Swift package successfully built.`);
  },

  /**
   * Cleans the build output folder
   * @param pkg Package
   * @param product Product
   */
  cleanBuildFolderAsync: async (pkg: SPMPackageSource, product: SPMProduct): Promise<void> => {
    const buildFolderToClean = SPMBuild.getPackageBuildPath(pkg, product);
    logger.info(
      `🧹 Cleaning build folder ${chalk.green(path.relative(pkg.buildPath, buildFolderToClean))}...`
    );
    await fs.remove(buildFolderToClean);
  },

  /**
   * Returns the output path where we'll build the frameworks for the package.
   * Build artifacts are stored under packages/precompile/<package-name>/.build/
   * so they survive yarn reinstalls and are centralized.
   * @param pkg Package
   * @param product Product
   * @returns Output path
   */
  getPackageBuildPath: (pkg: SPMPackageSource, product: SPMProduct) => {
    return path.join(pkg.buildPath, '.build', 'frameworks', pkg.packageName, product.name);
  },

  /**
   * Returns the path to the built product for a given package product and build type.
   * @param pkg Pacakge
   * @param product product
   * @param buildType buildType
   * @param buildPlatform build platform
   * @returns Path to the folder where to find the built product and its bundles
   */
  getProductArtifactsPath: (
    pkg: SPMPackageSource,
    product: SPMProduct,
    buildType: BuildFlavor,
    buildPlatform: BuildPlatform
  ) => {
    const buildOutputPath = SPMBuild.getPackageBuildPath(pkg, product);

    const buildFolderPrefix = getBuildFolderPrefixForPlatform(buildPlatform);

    return path.join(buildOutputPath, 'Build', 'Products', `${buildType}-${buildFolderPrefix}`);
  },

  /**
   * Returns the path to the built product framework for a given package product and build type.
   * @param pkg Pacakge
   * @param product product
   * @param buildType buildType
   * @param buildPlatform build platform
   * @returns Path to the folder where to find the built product framework is found
   */
  getProductFrameworkArtifactsPath: (
    pkg: SPMPackageSource,
    product: SPMProduct,
    buildType: BuildFlavor,
    buildPlatform: BuildPlatform
  ) => {
    const productOutputPath = SPMBuild.getProductArtifactsPath(
      pkg,
      product,
      buildType,
      buildPlatform
    );

    return path.join(productOutputPath, 'PackageFrameworks', `${product.name}.framework`);
  },

  /**
   * Returns the path to the build product's dSYM symbols bundle.
   * @param pkg Pacakge
   * @param product product
   * @param buildType buildType
   * @param buildPlatform build platform
   * @returns Path to the folder where to find the built product framework's symbol bundle is found
   */
  getProductSymbolsBundleArtifactsPath: (
    pkg: SPMPackageSource,
    product: SPMProduct,
    buildType: BuildFlavor,
    buildPlatform: BuildPlatform
  ) => {
    const productOutputPath = SPMBuild.getProductArtifactsPath(
      pkg,
      product,
      buildType,
      buildPlatform
    );

    return path.join(productOutputPath, `${product.name}.framework.dSYM`);
  },
};

/**
 * Gets all build platforms for a product, optionally filtering to a specific platform.
 * @param product SPM product
 * @param platform Optional platform to filter to
 * @returns Array of build platforms
 */
const getBuildPlatformsForProduct = (
  product: SPMProduct,
  platform?: BuildPlatform
): BuildPlatform[] => {
  const allPlatforms = product.platforms.flatMap(getBuildPlatformsFromProductPlatform);
  return platform ? allPlatforms.filter((p) => p === platform) : allPlatforms;
};

/**
 * Builds the xcodebuild arguments for a platform build.
 * @param pkg Package
 * @param product Product
 * @param buildType Build flavor
 * @param buildPlatform Target platform
 * @returns Array of xcodebuild arguments
 */
const buildXcodeBuildArgs = (
  pkg: SPMPackageSource,
  product: SPMProduct,
  buildType: BuildFlavor,
  buildPlatform: BuildPlatform
): string[] => {
  const derivedDataPath = SPMBuild.getPackageBuildPath(pkg, product);
  const containsSwiftTargets = product.targets.some((target) => target?.type === 'swift');

  // Remap absolute build paths to a canonical /expo-src prefix in DWARF debug info.
  // This ensures dSYMs are portable across machines — the canonical prefix is resolved
  // to the consumer's local package path at build time via UUID plists.
  // Two separate flags are needed for Swift targets:
  //   -debug-prefix-map: remaps paths in Swift's own DWARF output
  //   -Xcc -fdebug-prefix-map: remaps paths in Clang calls made by Swift (bridging headers, etc.)
  const repoRoot = getExpoRepositoryRootDir();

  // Per-target debug prefix maps: remap staging directory paths to canonical source paths.
  // During the SPM build, source files are symlinked into a staging directory:
  //   <buildPath>/.build/source/<pkgName>/<productName>/<targetName>/
  // The compiler records this staging path (not the symlink target) as DW_AT_comp_dir.
  // These maps ensure DWARF records the canonical /expo-src/<pkgPath>/<target.path>/
  // prefix instead, so the resolve-dsym-sourcemaps.js script can map them to the
  // consumer's local package paths.
  const stagingBase = path.resolve(
    pkg.buildPath,
    '.build',
    'source',
    pkg.packageName,
    product.name
  );
  const cTargetPrefixMaps: string[] = [];
  const swiftTargetPrefixMaps: string[] = [];
  for (const target of product.targets) {
    // Skip binary framework targets (no source files to compile)
    if (target.type === 'framework') continue;
    // Skip targets with generated source in .build/ (not from actual package source)
    if (target.path.startsWith('.build/')) continue;

    const stagingTargetPath = path.join(stagingBase, target.name);
    const canonicalPath = `/expo-src/packages/${pkg.packageName}/${target.path}`;

    // Trailing '/' ensures directory-boundary matching — without it, a target named
    // "ExpoModulesCore" would also match "ExpoModulesCore_ios_objc" as a string prefix.
    cTargetPrefixMaps.push(`-fdebug-prefix-map=${stagingTargetPath}/=${canonicalPath}/`);
    swiftTargetPrefixMaps.push(`-debug-prefix-map ${stagingTargetPath}/=${canonicalPath}/`);
  }

  // General repo root map as catch-all
  const debugPrefixMap = `-fdebug-prefix-map=${repoRoot}=/expo-src`;
  const swiftDebugPrefixMap = `-debug-prefix-map ${repoRoot}=/expo-src`;

  // Build compound flag strings: repo root map FIRST (catch-all), per-target maps LAST (override).
  // Clang applies -fdebug-prefix-map in reverse order (last on command line wins), so the
  // more specific per-target maps must come last to take priority over the general repo root map.
  const allCPrefixMaps = [debugPrefixMap, ...cTargetPrefixMaps].join(' ');
  const allSwiftPrefixMaps = [swiftDebugPrefixMap, ...swiftTargetPrefixMaps].join(' ');
  const allXccPrefixMaps = [debugPrefixMap, ...cTargetPrefixMaps].map((m) => `-Xcc ${m}`).join(' ');

  return [
    '-scheme',
    pkg.packageName,
    '-destination',
    `generic/platform=${buildPlatform}`,
    '-derivedDataPath',
    derivedDataPath,
    '-configuration',
    buildType,
    'SKIP_INSTALL=NO',
    ...(containsSwiftTargets ? ['BUILD_LIBRARY_FOR_DISTRIBUTION=YES'] : []),
    'DEBUG_INFORMATION_FORMAT=dwarf-with-dsym',
    `OTHER_CFLAGS=$(inherited) ${allCPrefixMaps}`,
    `OTHER_CPLUSPLUSFLAGS=$(inherited) ${allCPrefixMaps}`,
    ...(containsSwiftTargets
      ? [`OTHER_SWIFT_FLAGS=$(inherited) ${allSwiftPrefixMaps} ${allXccPrefixMaps}`]
      : []),
    'build',
  ];
};

/**
 * Builds the package for a specific platform.
 * @param pkg Package
 * @param product Product
 * @param buildType Build flavor
 * @param buildPlatform Target platform
 * @param packageSwiftPath Path to Package.swift
 */
const buildForPlatformAsync = async (
  pkg: SPMPackageSource,
  product: SPMProduct,
  buildType: BuildFlavor,
  buildPlatform: BuildPlatform,
  packageSwiftPath: string
): Promise<void> => {
  const args = buildXcodeBuildArgs(pkg, product, buildType, buildPlatform);

  const { code, error: buildError } = await spawnXcodeBuildWithSpinner(
    args,
    path.dirname(packageSwiftPath),
    `Building ${chalk.green(pkg.packageName)}/${chalk.green(product.name)} for ${chalk.green(buildPlatform)}/${chalk.green(buildType.toLowerCase())}`
  );

  if (code !== 0) {
    throw new Error(
      `xcodebuild failed with code ${code}:\n${buildError}\n\nxcodebuild ${args.join(' ')}`
    );
  }
};

/**
 * Maps a ProductPlatform to an array of BuildPlatforms
 */
export const getBuildPlatformsFromProductPlatform = (
  platform: ProductPlatform
): BuildPlatform[] => {
  switch (platform) {
    case 'iOS(.v15)':
      return ['iOS', 'iOS Simulator'];
    case 'macOS(.v11)':
      return ['macOS'];
    case 'tvOS(.v15)':
      return ['tvOS', 'tvOS Simulator'];
    case 'macCatalyst(.v15)':
      return ['macOS,variant=Mac Catalyst'];
    default:
      return [];
  }
};

/**
 * Returns the output folder postfix for a given build platform
 * @param platform Platform
 * @returns Folder name postfix
 */
export const getBuildFolderPrefixForPlatform = (platform: BuildPlatform): string => {
  switch (platform) {
    case 'iOS':
      return 'iphoneos';
    case 'iOS Simulator':
      return 'iphonesimulator';
    case 'macOS':
      return 'macosx';
    case 'macOS,variant=Mac Catalyst':
      return 'maccatalyst';
    case 'tvOS':
      return 'appletvos';
    case 'tvOS Simulator':
      return 'appletvsimulator';
    case 'visionOS':
      return 'visionos';
    case 'visionOS Simulator':
      return 'visionossimulator';
    default:
      return '';
  }
};
