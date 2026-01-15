# Expo Go Android Build Troubleshooting

This skill helps troubleshoot and build the Expo Go Android app, especially when building React Native from source.

## Overview

Expo Go builds React Native from source using a fork located at `react-native-lab/react-native`. This introduces specific build challenges related to:

1. **Hermes prefabs** - CMake package configuration for native builds
2. **ReactAndroid prefab conflicts** - Duplicate prefab packages from local project vs Maven AAR
3. **Environment variables** - JS_RUNTIME must be set for proper Hermes linking

## Key Paths

- **Expo Go Android**: `apps/expo-go/android/`
- **React Native fork**: `react-native-lab/react-native/`
- **ReactAndroid**: `react-native-lab/react-native/packages/react-native/ReactAndroid/`
- **Hermes Engine**: `react-native-lab/react-native/packages/react-native/ReactAndroid/hermes-engine/`
- **Hermes SDK source**: `react-native-lab/react-native/packages/react-native/sdks/hermes/`
- **Codegen (prebuilt)**: `react-native-lab/react-native/packages/react-native-codegen/`

## React Native Fork Cherry-Picks (Codegen)

The Expo fork of React Native includes important cherry-picks that **prebuild codegen** to avoid needing to run codegen during the Android build. This is critical for the multi-pass build process.

### Key Commits

1. **`2b00a79fe25`** - `[react-native-codegen] prebuild codegen lib`
   - Adds the prebuilt `lib/` folder to `packages/react-native-codegen/`
   - Contains all compiled codegen CLI scripts and generators
   - Location: `react-native-lab/react-native/packages/react-native-codegen/lib/`

2. **`0d1ca628176`** - `rebuild buildCodegenCli task`
   - Removes the `buildCodegenCLI` task from `ReactAndroid/build.gradle.kts`
   - Removes `generateCodegenArtifactsFromSchema` dependency from `preBuild`
   - Removes `generateCodegenSchemaFromJavaScript` dependency on `buildCodegenCLI`

### ⚠️ Kotlin DSL Migration Issue (RN 0.76+)

**Root Cause**: The original cherry-pick `0d1ca628176` was created against the **old Groovy** `build.gradle` file. In commit **`a115f97c48f`** ([#41834](https://github.com/facebook/react-native/pull/41834)), React Native converted `ReactAndroid/build.gradle` to `ReactAndroid/build.gradle.kts` (Kotlin DSL).

When the Expo fork was rebased onto RN 0.84, the cherry-pick only **partially applied** because:
1. The Groovy file no longer exists
2. The new Kotlin DSL file has the same `preparePrefab` → `generateCodegenArtifactsFromSchema` dependency
3. The cherry-pick didn't update the Kotlin DSL file

**The cherry-pick successfully removed**:
- The `buildCodegenCLI` task definition
- The `preBuild` dependency on `generateCodegenArtifactsFromSchema`

**The cherry-pick missed**:
- The `preparePrefab` dependency on `generateCodegenArtifactsFromSchema` (line ~88)

### Required Fix for RN 0.76+ (Kotlin DSL)

**File**: `react-native-lab/react-native/packages/react-native/ReactAndroid/build.gradle.kts`

**Change Required** (around line 88):
```kotlin
val preparePrefab by
    tasks.registering(PreparePrefabHeadersTask::class) {
      dependsOn(
          prepareBoost,
          prepareDoubleConversion,
          prepareFastFloat,
          prepareFmt,
          prepareFolly,
          prepareGlog,
      )
      // NOTE: Expo Go prebuilds codegen, so we remove the dependency on generateCodegenArtifactsFromSchema
      // See commit 0d1ca628176 "rebuild buildCodegenCli task" and 2b00a79fe25 "[react-native-codegen] prebuild codegen lib"
      // dependsOn("generateCodegenArtifactsFromSchema")  // <-- REMOVE THIS LINE
```

**Why This Matters**: Without removing this dependency, `preparePrefab` triggers the codegen chain:
- `preparePrefab` → `generateCodegenArtifactsFromSchema` → `generateCodegenSchemaFromJavaScript`

The `generateCodegenSchemaFromJavaScript` task tries to find `@react-native/codegen` in node_modules, which fails because:
1. Expo Go uses yarn workspaces (packages hoisted to root)
2. The RN Gradle plugin looks for codegen at `${root}/node_modules/@react-native/codegen`
3. The prebuilt codegen is at `react-native-lab/react-native/packages/react-native-codegen/`

### Verification

After updating, verify no codegen dependencies remain:
```sh
cd react-native-lab/react-native
grep -n "generateCodegen" packages/react-native/ReactAndroid/build.gradle.kts
# Should only show the comment explaining why it was removed
```

### Future Upgrades

When upgrading React Native versions, always check if the cherry-pick `0d1ca628176` needs to be updated to account for:
1. New dependencies on codegen tasks in `build.gradle.kts`
2. Any structural changes to the Gradle build configuration

## ✅ WORKING BUILD COMMAND (Single-Step, All ABIs)

\`\`\`sh
cd /Users/chrfalch/repos/expo/expo/apps/expo-go/android
JS_RUNTIME=hermes ./gradlew :app:assembleMobileDebug
\`\`\`

For single ABI (faster builds):
\`\`\`sh
JS_RUNTIME=hermes ./gradlew :app:assembleMobileDebug -PreactNativeArchitectures=arm64-v8a
\`\`\`

**Build Time**: ~3-4 minutes on clean cache

## Clean Build Commands

### Quick Clean (CMake caches only)
Use this when CMake configuration issues occur (e.g., header not found errors after config changes):

\`\`\`sh
cd /Users/chrfalch/repos/expo/expo/apps/expo-go/android && \
rm -rf build/react-android-cmake build/hermes-engine-cmake && \
find ../../../node_modules -path "*android/.cxx" -type d 2>/dev/null | xargs rm -rf 2>/dev/null && \
find . -path "*/.cxx" -type d 2>/dev/null | xargs rm -rf 2>/dev/null && \
echo "CMake caches cleaned"
\`\`\`

### Full Clean (All build artifacts)
Use this for a complete fresh build:

\`\`\`sh
cd /Users/chrfalch/repos/expo/expo/apps/expo-go/android && \
rm -rf build app/build expoview/build app/.cxx .gradle \
../../../react-native-lab/react-native/packages/react-native/ReactAndroid/build \
../../../react-native-lab/react-native/packages/react-native/ReactAndroid/.cxx \
../../../react-native-lab/react-native/packages/react-native/ReactAndroid/hermes-engine/build \
../../../react-native-lab/react-native/packages/react-native/ReactAndroid/hermes-engine/.cxx && \
find ../../../node_modules -path "*android/.cxx" -type d 2>/dev/null | xargs rm -rf 2>/dev/null && \
echo "Full clean complete"
\`\`\`

### Multi-Pass Build (For Major React Native Upgrades)
When upgrading React Native versions, native dependencies must be built in order. Use this 3-step process:

\`\`\`sh
cd /Users/chrfalch/repos/expo/expo/apps/expo-go/android

# Step 1: Build hermes-engine native code (all ABIs)
./gradlew :packages:react-native:ReactAndroid:hermes-engine:buildHermesC \
  :packages:react-native:ReactAndroid:hermes-engine:assembleRelease

# Step 2: Build ReactAndroid native code (all ABIs)
./gradlew :packages:react-native:ReactAndroid:assembleDebug

# Step 3: Build the app (all ABIs)
JS_RUNTIME=hermes ./gradlew :app:assembleMobileDebug
\`\`\`

**Why multi-pass?** ReactAndroid depends on hermes-engine outputs. The app depends on ReactAndroid outputs. Building in sequence ensures each dependency is fully built before the next step.

## THE SOLUTION: How We Fixed the Build

### Problem: "Multiple packages named ReactAndroid found"

When building React Native from source with community libraries, AGP finds prefab packages from BOTH:
1. **Local project**: \`build/intermediates/cxx/refs/packages/react-native/ReactAndroid/...\`
2. **Maven AAR**: \`~/.gradle/caches/.../jetified-react-android-.../prefab\`

**Root Cause**: Community libraries declare \`implementation 'com.facebook.react:react-native:+'\`. The \`+\` wildcard forces Gradle to download the AAR from Maven to resolve the version, which creates prefab transforms that conflict with the local project's prefab.

### Solution: Disable prefabPublishing + Generate Manual CMake Configs

The solution implemented in \`apps/expo-go/android/build.gradle\`:

1. **Disable prefabPublishing on local ReactAndroid** - Prevents local project from creating duplicate prefab
2. **Generate \`ReactAndroidConfig.cmake\`** - Manual CMake config with IMPORTED targets for native modules
3. **Generate \`hermes-engineConfig.cmake\`** - Manual CMake config for Hermes
4. **Pass CMake directories to all native modules** - via \`-DReactAndroid_DIR\` and \`-Dhermes-engine_DIR\`

### The Key Code (in build.gradle)

\`\`\`groovy
// 1. Disable prefab publishing on local ReactAndroid
project(':packages:react-native:ReactAndroid').afterEvaluate { reactAndroid ->
  reactAndroid.android.buildFeatures.prefabPublishing = false
}

// 2. Generate ReactAndroidConfig.cmake with IMPORTED targets
//    Creates: ReactAndroid::reactnative, ReactAndroid::jsi, ReactAndroid::hermestooling

// 3. Generate hermes-engineConfig.cmake
//    Creates: hermes-engine::hermesvm

// 4. Pass CMake config dirs to all native modules
subprojects { project ->
  project.afterEvaluate {
    if (project.android?.defaultConfig?.externalNativeBuild?.cmake) {
      externalNativeBuild.cmake.arguments(
        "-DReactAndroid_DIR=\${reactAndroidCmakeConfigDir.absolutePath}",
        "-Dhermes-engine_DIR=\${hermesCmakeConfigDir.absolutePath}"
      )
    }
  }
}
\`\`\`

### Generated CMake Targets

The generated CMake configs create these IMPORTED targets:

| Target | Library | Description |
|--------|---------|-------------|
| \`ReactAndroid::reactnative\` | libreactnative.so | Main React Native library |
| \`ReactAndroid::jsi\` | libjsi.so | JavaScript Interface |
| \`ReactAndroid::hermestooling\` | links to hermesvm | Hermes tooling (interface target) |
| \`hermes-engine::hermesvm\` | libhermesvm.so | Hermes VM runtime |
| \`hermes-engine::libhermes\` | (interface) | Provides Hermes headers |

### Critical CMake Config Details

**hermes-engineConfig.cmake** must set include directories **unconditionally**:

\`\`\`cmake
# CORRECT - always set include directories
set_target_properties(hermes-engine::libhermes PROPERTIES
  INTERFACE_INCLUDE_DIRECTORIES "\${_HERMES_BUILD_DIR}/prefab-headers"
)

# WRONG - conditional check fails at configure time
if(EXISTS "\${_HERMES_BUILD_DIR}/prefab-headers")  # DON'T DO THIS
  set_target_properties(...)
endif()
\`\`\`

**ReactAndroidConfig.cmake** must use correct path for hermes headers:

\`\`\`cmake
# CORRECT - prefab-headers is INSIDE build directory
set_target_properties(hermes-engine::hermesvm PROPERTIES
  INTERFACE_INCLUDE_DIRECTORIES "\${_HERMES_BUILD_DIR}/prefab-headers"
)

# WRONG - looks for sibling directory that doesn't exist
set_target_properties(hermes-engine::hermesvm PROPERTIES
  INTERFACE_INCLUDE_DIRECTORIES "\${_HERMES_BUILD_DIR}/../prefab-headers"  # DON'T DO THIS
)
\`\`\`

### Why This Works

1. **Local ReactAndroid native code still builds from source** ✓
2. **AAR's prefab is NOT collected** because no native module depends on it directly
3. **Native modules find ReactAndroid** via our generated CMake config ✓
4. **No duplicate packages** because local project has \`prefabPublishing = false\` ✓

## Build Output Locations

When the build succeeds:

- **APK**: \`apps/expo-go/android/app/build/outputs/apk/mobile/debug/app-mobile-debug.apk\`
- **ReactAndroid libraries**: \`.../ReactAndroid/build/intermediates/cmake/debug/obj/{abi}/\`
- **Hermes library**: \`.../hermes-engine/build/intermediates/cxx/Release/*/obj/{abi}/libhermesvm.so\`

## ABI to CMake Architecture Mapping

\`\`\`groovy
def abiToCmakeArch = [
  'arm64-v8a': 'aarch64-linux-android',
  'armeabi-v7a': 'arm-linux-androideabi',
  'x86': 'i686-linux-android',
  'x86_64': 'x86_64-linux-android'
]
\`\`\`

## Common Issues

### 1. hermes/hermes.h Not Found

**Error**: \`fatal error: 'hermes/hermes.h' file not found\` in react-native-worklets or other native modules

**Root Cause**: The CMake config for hermes-engine wasn't correctly exposing include directories. Two issues:

1. **Conditional check around INTERFACE_INCLUDE_DIRECTORIES** - The \`if(EXISTS ...)\` check failed at CMake configure time because the directory might not exist yet
2. **Wrong path for prefab-headers** - Used \`/../prefab-headers\` (sibling) instead of \`/prefab-headers\` (child)

**Solution**: In \`build.gradle\`, the hermes-engineConfig.cmake generation must:
- Set \`INTERFACE_INCLUDE_DIRECTORIES\` **unconditionally** (no \`if(EXISTS)\` check)
- Use correct path: \`\${_HERMES_BUILD_DIR}/prefab-headers\` (NOT \`/../prefab-headers\`)

**Key Insight**: For CMake IMPORTED targets, \`INTERFACE_INCLUDE_DIRECTORIES\` must be set unconditionally because:
- Compile commands are generated at CMake configure time
- The directories are needed for header resolution during compilation
- Conditional checks fail if the directory doesn't exist yet at configure time

**After Fix**: Clean all CMake caches and rebuild:
\`\`\`sh
cd /Users/chrfalch/repos/expo/expo/apps/expo-go/android && \
rm -rf build/react-android-cmake build/hermes-engine-cmake && \
find ../../../node_modules -path "*android/.cxx" -type d 2>/dev/null | xargs rm -rf && \
find . -path "*/.cxx" -type d 2>/dev/null | xargs rm -rf && \
JS_RUNTIME=hermes ./gradlew :app:assembleMobileDebug
\`\`\`

### 2. hermes-engine Prefab Not Found

**Error**: \`Could not find a package configuration file provided by "hermes-engine"\`

**Solution**: Already fixed in build.gradle. Generates \`hermes-engineConfig.cmake\` at \`\${rootProject.buildDir}/hermes-engine-cmake\` and passes \`-Dhermes-engine_DIR\` to all native modules.

### 3. ReactAndroid Prefab Not Found

**Error**: \`Could not find a package configuration file provided by "ReactAndroid"\`

**Solution**: Already fixed in build.gradle. Generates \`ReactAndroidConfig.cmake\` at \`\${rootProject.buildDir}/react-android-cmake\` and passes \`-DReactAndroid_DIR\` to all native modules.

### 4. Duplicate ReactAndroid Packages

**Error**: \`Multiple packages named ReactAndroid found\`

**Solution**: Already fixed. We disabled \`prefabPublishing = false\` on local ReactAndroid project.

### 5. react-native-worklets Linking Issues

**Symptom**: Linker errors related to Hermes symbols.

**Solution**: Always set \`JS_RUNTIME=hermes\` environment variable when building.

## Offending Libraries (Use react-native:+)

These community libraries declare \`implementation 'com.facebook.react:react-native:+'\` which forces AAR download:

\`\`\`
react-native-webview
react-native-view-shot
react-native-async-storage
react-native-community_netinfo
react-native-community_slider
react-native-gesture-handler
react-native-masked-view
react-native-pager-view
react-native-picker
react-native-safe-area-context
react-native-screens
react-native-svg
react-native-skia
stripe-react-native
lottie-react-native
react-native-worklets
react-native-reanimated
\`\`\`

**Note**: Expo modules use \`react-android\` WITHOUT a version, relying on dependency substitution, which is correct.

## Gradle Properties Reference

Key properties in \`apps/expo-go/android/gradle.properties\`:

| Property | Description |
|----------|-------------|
| \`hermesEnabled=true\` | Enable Hermes runtime |
| \`hermesV1Enabled=true\` | Use Hermes V1 for building from source |
| \`newArchEnabled=true\` | Enable new architecture (TurboModules/Fabric) |
| \`reactNativeArchitectures\` | ABIs to build (armeabi-v7a,arm64-v8a,x86,x86_64) |

## Build Configuration Architecture

All React Native source build configuration is centralized in the **root** \`build.gradle\`:

### Dependency Substitution (Root build.gradle)

Substitutes Maven artifacts with local projects for building from source:

\`\`\`groovy
// In allprojects.configurations.all
resolutionStrategy.dependencySubstitution {
  substitute(module("com.facebook.react:react-native"))
    .using(project(":packages:react-native:ReactAndroid"))
  substitute(module("com.facebook.react:react-native:+"))
    .using(project(":packages:react-native:ReactAndroid"))
  substitute(module("com.facebook.react:react-android"))
    .using(project(":packages:react-native:ReactAndroid"))
  substitute(module("com.facebook.react:react-android:+"))
    .using(project(":packages:react-native:ReactAndroid"))
  substitute(module("com.facebook.react:hermes-android"))
    .using(project(":packages:react-native:ReactAndroid:hermes-engine"))
  substitute(module("com.facebook.react:hermes-android:+"))
    .using(project(":packages:react-native:ReactAndroid:hermes-engine"))
}
\`\`\`

### Hermesc Task Dependency (Root build.gradle)

Ensures hermesc compiler is built before JS bundling:

\`\`\`groovy
project(':app').afterEvaluate {
  def appProject = project(':app')
  appProject.android.applicationVariants.all { variant ->
    def variantName = variant.name.capitalize()
    tasks.findByName("createBundle\${variantName}JsAndAssets")?.dependsOn(
      ":packages:react-native:ReactAndroid:hermes-engine:buildHermesC"
    )
  }
}
\`\`\`

## Project Structure

\`\`\`
apps/expo-go/android/
├── settings.gradle           # Includes ReactAndroid and hermes-engine projects
├── build.gradle              # Root build - ALL RN source build config consolidated here:
│                             #   - Dependency substitution (react-native → project)
│                             #   - Hermesc task dependency for JS bundling
│                             #   - PrivateReactExtension paths
│                             #   - Hermes prefab workaround (CMake config generation)
│                             #   - ReactAndroid prefab workaround (CMake config generation)
│                             #   - prefabPublishing = false on ReactAndroid
├── gradle.properties         # Build configuration (hermesEnabled, etc.)
├── app/
│   └── build.gradle          # App module - minimal, app-specific config only
└── expoview/                 # Expo view module

react-native-lab/react-native/packages/react-native/
├── ReactAndroid/
│   ├── build.gradle.kts      # ReactAndroid build config
│   ├── .cxx/                 # Generated CMake build directory
│   ├── src/main/jni/
│   │   └── CMakeLists.txt    # Native build - uses find_package(hermes-engine) at line 51
│   └── hermes-engine/
│       ├── build.gradle.kts  # Hermes build config
│       └── build/
│           ├── intermediates/cxx/{variant}/{hash}/obj/{abi}/  # Library outputs
│           └── prefab-headers/  # Headers for prefab
└── gradle/
    └── libs.versions.toml    # Version catalog
\`\`\`

## CMake Warning (Harmless)

During build, you may see this warning:
\`\`\`
CMake Warning:
  Manually-specified variables were not used by the project:
    hermes-engine_DIR
\`\`\`

This is harmless - the warning appears on projects that don't use hermes-engine directly.

## Debugging Tips

1. **Check build outputs**:
   \`\`\`sh
   # ReactAndroid libraries
   ls -la react-native-lab/react-native/packages/react-native/ReactAndroid/build/intermediates/cmake/debug/obj/arm64-v8a/

   # Hermes library
   find react-native-lab/react-native/packages/react-native/ReactAndroid/hermes-engine/build -name "libhermesvm.so"
   \`\`\`

2. **Check generated CMake configs**:
   \`\`\`sh
   cat apps/expo-go/android/build/react-android-cmake/ReactAndroidConfig.cmake
   cat apps/expo-go/android/build/hermes-engine-cmake/hermes-engineConfig.cmake
   \`\`\`

3. **Check prefab_stderr for errors**:
   \`\`\`sh
   find apps/expo-go/android -name "prefab_stderr.txt" -exec cat {} \;
   \`\`\`

4. **Verify Gradle project structure**:
   \`\`\`sh
   cd apps/expo-go/android && ./gradlew projects
   \`\`\`

5. **Check task execution**:
   \`\`\`sh
   JS_RUNTIME=hermes ./gradlew :app:assembleMobileDebug --dry-run 2>&1 | head -100
   \`\`\`

## RN-Tester vs Expo Go Comparison

| Aspect | RN-Tester | Expo Go |
|--------|-----------|---------|
| Community libraries | None | 15+ with \`react-native:+\` |
| Prefab conflicts | No | Yes (before fix) |
| CMake config needed | No (AGP handles it) | Yes (manual generation) |
| Build command | \`./gradlew :app:assembleDebug\` | \`JS_RUNTIME=hermes ./gradlew :app:assembleMobileDebug\` |

**Why RN-Tester works without our fix**: RN-Tester doesn't include third-party community libraries, so there's no AAR downloaded and no duplicate prefab packages.

## Version Information

- **React Native**: 0.84.0-rc.2 (building from source)
- **Gradle**: 9.0.0
- **AGP**: 8.12.0
- **NDK**: 27.1.12297006
- **CMake**: 3.22.1

## Summary of the Fixes

The build issues were solved by multiple fixes in \`build.gradle\`:

### Fix 1: Duplicate ReactAndroid Packages
1. ✅ Disabled \`prefabPublishing\` on local ReactAndroid project
2. ✅ Generated \`ReactAndroidConfig.cmake\` with IMPORTED targets (reactnative, jsi, hermestooling)
3. ✅ Generated \`hermes-engineConfig.cmake\` with IMPORTED target (hermesvm)
4. ✅ Passed \`-DReactAndroid_DIR\` and \`-Dhermes-engine_DIR\` to all native modules

### Fix 2: hermes/hermes.h Not Found
5. ✅ Removed conditional \`if(EXISTS)\` check around \`INTERFACE_INCLUDE_DIRECTORIES\` in hermes-engineConfig.cmake
6. ✅ Fixed path from \`/../prefab-headers\` to \`/prefab-headers\` in ReactAndroidConfig.cmake for hermesvm target

**Critical Insight**: CMake IMPORTED targets require \`INTERFACE_INCLUDE_DIRECTORIES\` to be set **unconditionally** - compile commands are generated at configure time, before any linking happens.

This allows:
- ReactAndroid native code to build from source ✓
- Native modules to find ReactAndroid via manual CMake config ✓
- Native modules to find Hermes headers for compilation ✓
- No duplicate prefab packages ✓
- Single-step build process ✓
