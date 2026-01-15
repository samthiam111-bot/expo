# Task: Upstream Fix for React Native Build-from-Source `find_package(hermes-engine)` Failure

## Status: ✅ VERIFIED WORKING - Ready for Upstream PR

### Completed Steps

- ✅ **Step 1**: Implemented fix in `react-native-lab/react-native/packages/react-native/ReactAndroid/build.gradle.kts`
  - Added hermes-engine CMake config generation (lines 70-162)
  - Added `-Dhermes-engine_DIR` to CMake arguments (lines 678-681)
  - Verified: CMake config file is generated correctly at `ReactAndroid/build/hermes-engine-cmake/hermes-engineConfig.cmake`
  - No syntax errors in the Kotlin DSL

- ✅ **Step 2**: Tested with clean RN 0.84.0-rc.2 project at `/tmp/FromSourceTest`
  - Successfully reproduced the original error (find_package failure)
  - Applied fix and verified CMake configuration passes
  - Successfully built APK with build-from-source

### Test Results

- Gradle configuration phase succeeds and generates:
  - `hermes-engineConfig.cmake` - CMake package config with IMPORTED target
  - `hermes-engineConfigVersion.cmake` - Version info for find_package
- CMake output shows our fix working:
  - `[hermes-prefab] hermesvm not found yet, using predicted path: ...`
  - `[hermes-prefab] Set INTERFACE_INCLUDE_DIRECTORIES: ...`
- Build completes successfully after hermes-engine native libs are built

### Note on Task Dependencies
The fix works for CMake configuration, but users building from source may still need to ensure
hermes-engine native libs are built before ReactAndroid's CMake build runs. This is a separate
AGP limitation. Workaround: Run `./gradlew :react-native:...:hermes-engine:externalNativeBuildDebug`
before the main build, or add explicit task dependencies in the consuming app.

### Next Steps

1. **Step 3**: Submit upstream PR to facebook/react-native
2. **Step 4**: After upstream merge, remove redundant code from Expo's build.gradle

## Problem Statement

When building React Native from source on Android, the build fails with:

```
CMake Error at CMakeLists.txt:51 (find_package):
  Could not find a package configuration file provided by "hermes-engine"
  with any of the following names:

    hermes-engineConfig.cmake
    hermes-engine-config.cmake

  Add the installation prefix of "hermes-engine" to CMAKE_PREFIX_PATH or set
  "hermes-engine_DIR" to a directory containing one of the above files.
```

**Location**: `react-native/packages/react-native/ReactAndroid/src/main/jni/CMakeLists.txt` line 51

## Root Cause

**This is an Android Gradle Plugin (AGP) limitation, NOT a React Native regression.**

AGP's prefab integration only generates CMake config files for **AAR dependencies from Maven**. When ReactAndroid depends on hermes-engine as a **project dependency** (building from source), AGP does NOT generate `hermes-engineConfig.cmake`.

| Scenario | CMake Config Source | Works? |
|----------|---------------------|--------|
| Maven AAR (normal apps) | AGP generates from prefab metadata in AAR | ✅ Yes |
| Build from source (project dep) | AGP does NOT generate for project deps | ❌ No |
| Expo Go (with workarounds) | Manual CMake config generation | ✅ Yes |

**Related**: [Google Issue Tracker #265544858](https://issuetracker.google.com/issues/265544858)

## Solution

Generate `hermes-engineConfig.cmake` manually in ReactAndroid's Gradle build when building from source, and pass `-Dhermes-engine_DIR` to CMake.

### Reference Implementation (Expo Go)

Expo Go has a working implementation in `apps/expo-go/android/build.gradle`. The key parts:

#### 1. Generate hermes-engineConfig.cmake

```groovy
def hermesCmakeConfigDir = new File(rootProject.buildDir, "hermes-engine-cmake")
def hermesProject = project(':packages:react-native:ReactAndroid:hermes-engine')
def hermesBuildDir = hermesProject.buildDir

// ABI to CMake architecture mapping
def abiToCmakeArch = [
  'arm64-v8a': 'aarch64-linux-android',
  'armeabi-v7a': 'arm-linux-androideabi',
  'x86': 'i686-linux-android',
  'x86_64': 'x86_64-linux-android'
]

hermesCmakeConfigDir.mkdirs()
def hermesConfigContent = """
# Auto-generated hermes-engine CMake config for building from source
# This file is generated because AGP doesn't create prefab CMake configs for project dependencies

set(_HERMES_BUILD_DIR "${hermesBuildDir.absolutePath}")

if(NOT TARGET hermes-engine::hermesvm)
  add_library(hermes-engine::hermesvm SHARED IMPORTED)

  # Determine library path based on ABI
  ${abiToCmakeArch.collect { abi, arch ->
    """
  if(ANDROID_ABI STREQUAL "${abi}")
    # Try to find the library in the build output
    file(GLOB _HERMES_LIB_PATH "\${_HERMES_BUILD_DIR}/intermediates/cxx/*/obj/${abi}/libhermesvm.so")
    if(NOT _HERMES_LIB_PATH)
      # Fallback for clean builds - use predicted path
      set(_HERMES_LIB_PATH "\${_HERMES_BUILD_DIR}/intermediates/cxx/MinSizeRel/3q4s5a21/obj/${abi}/libhermesvm.so")
    else()
      list(GET _HERMES_LIB_PATH 0 _HERMES_LIB_PATH)
    endif()
    set(_HERMES_CMAKE_ARCH "${arch}")
  endif()"""
  }.join('\n')}

  set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "\${_HERMES_LIB_PATH}"
  )

  message(STATUS "[hermes-prefab] Found hermesvm: \${_HERMES_LIB_PATH}")
endif()

# CRITICAL: Set INTERFACE_INCLUDE_DIRECTORIES unconditionally
# CMake compile commands are generated at configure time, before linking
# Conditional checks like if(EXISTS ...) fail because directory may not exist yet
if(NOT TARGET hermes-engine::libhermes)
  add_library(hermes-engine::libhermes INTERFACE IMPORTED)
  set_target_properties(hermes-engine::libhermes PROPERTIES
    INTERFACE_INCLUDE_DIRECTORIES "\${_HERMES_BUILD_DIR}/prefab-headers"
  )
  message(STATUS "[hermes-prefab] Set INTERFACE_INCLUDE_DIRECTORIES: \${_HERMES_BUILD_DIR}/prefab-headers")
endif()
"""

new File(hermesCmakeConfigDir, "hermes-engineConfig.cmake").text = hermesConfigContent
```

#### 2. Pass -Dhermes-engine_DIR to CMake

```groovy
project(':packages:react-native:ReactAndroid').afterEvaluate { reactAndroid ->
  reactAndroid.android.defaultConfig.externalNativeBuild.cmake {
    arguments("-Dhermes-engine_DIR=${hermesCmakeConfigDir.absolutePath}")
  }
}
```

### Critical Implementation Details

1. **INTERFACE_INCLUDE_DIRECTORIES must be set unconditionally**
   - Do NOT use `if(EXISTS ...)` checks - they fail at CMake configure time
   - The headers directory may not exist yet when CMake configures
   - Compile commands are generated at configure time, before any build happens

2. **Correct path for prefab-headers**
   - Use `${_HERMES_BUILD_DIR}/prefab-headers` (child of build dir)
   - NOT `${_HERMES_BUILD_DIR}/../prefab-headers` (sibling - wrong!)

3. **Library path needs glob for variant/hash**
   - Hermes builds to `intermediates/cxx/{variant}/{hash}/obj/{abi}/libhermesvm.so`
   - The `{hash}` changes, so use `file(GLOB ...)` to find it

4. **Task dependency ordering**
   - The CMake config generation runs at Gradle configuration time (not task execution)
   - This is fine - the config file just needs to exist before `configureCMake*` tasks run

## Implementation Plan

### Step 1: Implement in ReactAndroid/build.gradle.kts

**File**: `react-native-lab/react-native/packages/react-native/ReactAndroid/build.gradle.kts`

Add logic to:
1. Check if hermes-engine is a project dependency (not Maven AAR)
2. Generate `hermes-engineConfig.cmake` in build directory
3. Add `-Dhermes-engine_DIR` to CMake arguments

### Step 2: Submit PR to facebook/react-native

**Title**: `[Android] Support building ReactAndroid from source by generating hermes-engine CMake config`

**Description should include**:
- The error message
- Root cause: AGP doesn't generate prefab CMake configs for project dependencies
- Reference: [Google Issue Tracker #265544858](https://issuetracker.google.com/issues/265544858)
- Solution: Generate CMake config manually when hermes-engine is a project dependency
- Credit Expo's implementation as reference

### Step 3: Test on Expo Go

1. Cherry-pick the upstream PR into `react-native-lab/react-native`
2. Remove the `hermes-engineConfig.cmake` generation from `apps/expo-go/android/build.gradle`
3. Clean and rebuild:
   ```sh
   cd apps/expo-go/android
   rm -rf build/hermes-engine-cmake
   JS_RUNTIME=hermes ./gradlew :app:assembleMobileDebug -PreactNativeArchitectures=arm64-v8a
   ```
4. Verify build succeeds

### Step 4: Clean up Expo Go

After upstream PR is merged and released:

**Remove from `apps/expo-go/android/build.gradle`**:
- `hermes-engineConfig.cmake` generation code
- The `-Dhermes-engine_DIR` injection (if upstream handles it)

**Keep in `apps/expo-go/android/build.gradle`** (Expo-specific):
- Dependency substitution (monorepo)
- Repository exclusions for `com.facebook.react` and `com.facebook.hermes`
- `ReactAndroidConfig.cmake` generation (needed due to community libs using `react-native:+`)
- `prefabPublishing = false` on ReactAndroid (same reason)
- Codegen prebuilding cherry-picks

## Related Files

| File | Purpose |
|------|---------|
| `react-native-lab/react-native/packages/react-native/ReactAndroid/build.gradle.kts` | Where upstream fix goes |
| `react-native-lab/react-native/packages/react-native/ReactAndroid/src/main/jni/CMakeLists.txt` | Contains `find_package(hermes-engine)` at line 51 |
| `react-native-lab/react-native/packages/react-native/ReactAndroid/hermes-engine/build.gradle.kts` | Hermes prefab config |
| `apps/expo-go/android/build.gradle` | Expo's working workaround (reference implementation) |

## Notes

- This is NOT a regression from PR #53833 (Hermes artifact publishing change)
- PR #53833 only affects Maven coordinate changes, not source builds
- The issue has always existed for source builds - most users don't hit it because they use prebuilt AARs
- Expo Go has had workarounds since SDK-55
