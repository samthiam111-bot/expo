# Handles precompiled XCFramework module integration for Expo.
#
# This module provides functionality to:
# 1. Link pods with prebuilt XCFrameworks instead of building from source
# 2. Discover which pods are using prebuilt XCFrameworks
# 3. Filter prebuilt libraries from React Native's codegen to avoid duplicate symbols
#
# When EXPO_USE_PRECOMPILED_MODULES=1 is set, packages with matching XCFrameworks
# in the centralized build output will be linked as vendored frameworks.
#
# Build output:     packages/precompile/.build/<pkg>/output/<flavor>/xcframeworks/<Product>.tar.gz
# Podspec install:  <podspec_dir>/xcframeworks/<Product>-<flavor>.tar.gz  (tarball, source of truth)
#                   <podspec_dir>/xcframeworks/<Product>.xcframework      (real dir, extracted from tarball)
#                   <podspec_dir>/xcframeworks/.last_build_configuration  (tracks current flavor)

require 'digest'
require 'fileutils'

module Expo
  module PrecompiledModules
    # The environment variable that enables precompiled modules
    ENV_VAR = 'EXPO_USE_PRECOMPILED_MODULES'.freeze

    # Environment variable for build flavor override
    BUILD_FLAVOR_ENV_VAR = 'EXPO_PRECOMPILED_FLAVOR'.freeze

    # The xcframeworks directory name used at the podspec level
    # Structure: <podspec_dir>/xcframeworks/<Product>-<flavor>.tar.gz  (tarballs, source of truth)
    #            <podspec_dir>/xcframeworks/<Product>.xcframework      (real dir, extracted)
    XCFRAMEWORKS_DIR_NAME = 'xcframeworks'.freeze

    # Centralized build output directory under packages/precompile/
    PRECOMPILE_BUILD_DIR = '.build'.freeze

    # Module-level caches (initialized lazily)
    @pod_lookup_map = nil
    @repo_root = nil
    @logged_pods = nil

    class << self
      # Returns the build flavor (debug/release) for precompiled modules.
      # Defaults to 'debug', can be overridden via EXPO_PRECOMPILED_FLAVOR env var.
      def build_flavor
        ENV[BUILD_FLAVOR_ENV_VAR] || 'debug'
      end

      # Returns true if precompiled modules are enabled via environment variable
      def enabled?
        ENV[ENV_VAR] == '1'
      end

      # Tries to link a pod spec with a prebuilt XCFramework.
      #
      # Looks for tarballs at the centralized build output:
      #   packages/precompile/.build/<pkg>/output/<flavor>/xcframeworks/<Product>.tar.gz
      #
      # Copies them as <podspec_dir>/xcframeworks/<Product>-<flavor>.tar.gz and extracts
      # the default flavor to create real xcframework directories.
      #
      # @param spec [Pod::Spec] The podspec to potentially link with a prebuilt framework
      # @return [Boolean] true if a prebuilt framework was linked, false otherwise
      #
      def try_link_with_prebuilt_xcframework(spec)
        return false unless enabled?

        # Look up the package info from spm.config.json
        pod_info = get_pod_lookup_map[spec.name]
        unless pod_info
          log_linking_status(spec.name, false, "not found in spm.config.json")
          return false
        end

        # The xcframework is named after the SPM product name, not the pod name
        product_name = pod_info[:product_name] || spec.name
        podspec_dir = pod_info[:podspec_dir]
        podspec_xcframeworks_dir = File.join(podspec_dir, XCFRAMEWORKS_DIR_NAME)

        # Check if tarballs already exist alongside the podspec
        local_tarball = File.join(podspec_xcframeworks_dir, "#{product_name}-#{build_flavor}.tar.gz")

        unless File.exist?(local_tarball)
          # Not found locally — try to copy tarballs from centralized build output
          build_output_dir = pod_info[:build_output_dir]
          build_tarball = File.join(build_output_dir, build_flavor, 'xcframeworks', "#{product_name}.tar.gz")

          unless File.exist?(build_tarball)
            log_linking_status(spec.name, false, build_tarball)
            return false
          end

          # Clean up legacy symlink structure from previous versions
          cleanup_legacy_symlink_structure(podspec_xcframeworks_dir)

          # Copy tarballs for each available flavor
          FileUtils.mkdir_p(podspec_xcframeworks_dir)
          ['debug', 'release'].each do |flavor|
            src_tarball = File.join(build_output_dir, flavor, 'xcframeworks', "#{product_name}.tar.gz")
            next unless File.exist?(src_tarball)

            dst_tarball = File.join(podspec_xcframeworks_dir, "#{product_name}-#{flavor}.tar.gz")
            FileUtils.cp(src_tarball, dst_tarball)
          end

          # Extract the default flavor tarball to create real xcframework directories
          extract_tarball(local_tarball, podspec_xcframeworks_dir)

          # Write initial .last_build_configuration
          File.write(File.join(podspec_xcframeworks_dir, '.last_build_configuration'), build_flavor)
        end

        # Verify the extracted xcframework exists
        local_xcframework = File.join(podspec_xcframeworks_dir, "#{product_name}.xcframework")
        unless File.directory?(local_xcframework)
          # Tarball exists but xcframework not extracted — extract now
          extract_tarball(local_tarball, podspec_xcframeworks_dir)
          File.write(File.join(podspec_xcframeworks_dir, '.last_build_configuration'), build_flavor)
        end

        # At this point the xcframework exists at the podspec level
        log_linking_status(spec.name, true, local_xcframework)

        # Vendored path is relative from podspec_dir to xcframeworks/<Product>.xcframework
        relative_path = Pathname.new(local_xcframework).relative_path_from(Pathname.new(podspec_dir)).to_s
        vendored_paths = [relative_path]

        # Vendor SPM dependency xcframeworks (extracted from the same tarball)
        # (e.g., Lottie.xcframework alongside LottieReactNative.xcframework)
        (pod_info[:spm_dependency_frameworks] || []).each do |dep_name|
          dep_xcframework_name = "#{dep_name}.xcframework"
          dep_local_path = File.join(podspec_xcframeworks_dir, dep_xcframework_name)
          next unless File.directory?(dep_local_path)

          dep_relative_path = Pathname.new(dep_local_path).relative_path_from(Pathname.new(podspec_dir)).to_s
          vendored_paths << dep_relative_path
          Pod::UI.info "#{"[Expo-precompiled] ".blue}     📦 #{dep_xcframework_name.green}"
        end

        spec.vendored_frameworks = vendored_paths

        # Add script phases:
        # 1. Switch xcframework via tarball extraction based on build configuration (before compile)
        # 2. Write dSYM source path mapping plists (before compile)
        add_script_phases(spec, product_name, podspec_xcframeworks_dir, pod_info)

        true
      end

      # Adds script phases to the podspec:
      # 1. XCFramework switch phase (before_compile) — extracts debug/release tarball
      # 2. dSYM source map resolution phase (before_compile) — writes UUID plists into
      #    the source-tree xcframework's embedded dSYMs so that Spotlight can find them
      #    and lldb can resolve source paths via DBGSourcePathRemapping
      #
      # @param spec [Pod::Spec] The podspec to add script phases to
      # @param product_name [String] The product/module name
      # @param xcframeworks_dir [String] Absolute path to the xcframeworks directory (<podspec_dir>/xcframeworks)
      # @param pod_info [Hash] Package info from spm.config.json lookup
      def add_script_phases(spec, product_name, xcframeworks_dir, pod_info)
        # Compute paths relative to installation_root so script phases don't contain absolute paths.
        # For pod targets, $SRCROOT points to the Pods/ directory, so we use $PODS_ROOT/..
        # to get back to the installation_root (e.g., <repo>/apps/bare-expo/ios).
        project_root = Pod::Config.instance.installation_root  # e.g., <repo>/apps/bare-expo/ios
        scripts_dir = __dir__
        switch_script_rel = Pathname.new(File.join(scripts_dir, 'replace-xcframework.js')).relative_path_from(project_root).to_s
        dsym_script_rel = Pathname.new(File.join(scripts_dir, 'resolve-dsym-sourcemaps.js')).relative_path_from(project_root).to_s
        xcframeworks_dir_rel = Pathname.new(xcframeworks_dir).relative_path_from(project_root).to_s
        package_root_rel = Pathname.new(pod_info[:package_root]).relative_path_from(project_root).to_s

        # $PODS_ROOT/.. = installation_root at build time
        pods_parent = "$PODS_ROOT/.."
        switch_script_path = "#{pods_parent}/#{switch_script_rel}"
        dsym_script_path = "#{pods_parent}/#{dsym_script_rel}"
        xcframeworks_dir_var = "#{pods_parent}/#{xcframeworks_dir_rel}"
        package_root_var = "#{pods_parent}/#{package_root_rel}"

        dsym_stamp = "$(DERIVED_FILE_DIR)/expo-dsym-resolve-#{product_name}-$(CONFIGURATION).stamp"

        npm_package = pod_info[:npm_package]

        # The switch phase uses always_out_of_date (like React Native) so Xcode always runs it.
        # The shell fast-path (.last_build_configuration check) provides incremental build optimization.
        switch_phase = {
          :name => "[Expo] Switch #{spec.name} XCFramework for build configuration",
          :execution_position => :before_compile,
          :input_files => ["#{pods_parent}/#{switch_script_rel}"],
          :script => xcframework_switch_script(product_name, xcframeworks_dir_var, switch_script_path),
        }

        # :always_out_of_date is only available in CocoaPods 1.13.0 and later
        if Gem::Version.new(Pod::VERSION) >= Gem::Version.new('1.13.0')
          switch_phase[:always_out_of_date] = "1"
        end

        dsym_phase = {
          :name => "[Expo] Resolve #{spec.name} dSYM source maps",
          :execution_position => :before_compile,
          :input_files => ["#{pods_parent}/#{dsym_script_rel}"],
          :output_files => [dsym_stamp],
          :script => dsym_resolve_script(product_name, xcframeworks_dir_var, dsym_script_path, npm_package, package_root_var),
        }

        spec.script_phases = [switch_phase, dsym_phase]
      end

      # Returns the shell script for the xcframework switch phase.
      # The xcframeworks_dir contains tarballs (<Product>-<flavor>.tar.gz) and
      # extracted xcframeworks (<Product>.xcframework) managed by replace-xcframework.js
      def xcframework_switch_script(product_name, xcframeworks_dir, script_path)
        <<-EOS
# Switch between debug/release XCFramework based on build configuration
# This script is auto-generated by expo-modules-autolinking

CONFIG="release"
if echo "$GCC_PREPROCESSOR_DEFINITIONS" | grep -q "DEBUG=1"; then
  CONFIG="debug"
fi

# Early exit: Skip Node.js invocation if configuration hasn't changed
# This optimization avoids ~100-200ms overhead per module on incremental builds
LAST_CONFIG_FILE="#{xcframeworks_dir}/.last_build_configuration"
if [ -f "$LAST_CONFIG_FILE" ] && [ "$(cat "$LAST_CONFIG_FILE")" = "$CONFIG" ]; then
  exit 0
fi

# Configuration changed or first build - invoke Node.js to extract tarball
. "$REACT_NATIVE_PATH/scripts/xcode/with-environment.sh"

"$NODE_BINARY" "#{script_path}" \\
  -c "$CONFIG" \\
  -m "#{product_name}" \\
  -x "#{xcframeworks_dir}"
        EOS
      end

      # Returns the shell script for the dSYM source map resolution phase.
      # Writes UUID plists into the source-tree dSYMs for source path remapping.
      # lldb discovers dSYMs via Spotlight (mdfind by UUID), so the dSYMs must be
      # in a Spotlight-indexed location (i.e., directory name without dot prefix).
      #
      # @param product_name [String] The product/module name (e.g., "ExpoModulesCore")
      # @param xcframeworks_dir [String] Path to the xcframeworks directory (build-time var)
      # @param script_path [String] Path to resolve-dsym-sourcemaps.js (build-time var)
      # @param npm_package [String] NPM package name (e.g., "expo-modules-core")
      # @param package_root [String] Path to the local package root (build-time var)
      def dsym_resolve_script(product_name, xcframeworks_dir, script_path, npm_package, package_root)
        <<-EOS
# Resolve dSYM source path mappings for prebuilt xcframeworks
# This script is auto-generated by expo-modules-autolinking
#
# Writes UUID plists into source-tree dSYMs so lldb can remap
# /expo-src/... paths back to local package paths.

STAMP_FILE="$DERIVED_FILE_DIR/expo-dsym-resolve-#{product_name}-$CONFIGURATION.stamp"

# Find dSYMs inside the source-tree xcframework (all slices)
XCFW_PATH="#{xcframeworks_dir}/#{product_name}.xcframework"

if [ -d "$XCFW_PATH" ]; then
  FOUND_DSYM=0
  for DSYM_DIR in "$XCFW_PATH"/*/dSYMs; do
    if [ -d "$DSYM_DIR/#{product_name}.framework.dSYM" ]; then
      if [ $FOUND_DSYM -eq 0 ]; then
        . "$REACT_NATIVE_PATH/scripts/xcode/with-environment.sh"
        FOUND_DSYM=1
      fi
      "$NODE_BINARY" "#{script_path}" \\
        -d "$DSYM_DIR" \\
        -m "#{product_name}" \\
        -n "#{npm_package}" \\
        -r "#{package_root}"
    fi
  done
fi

# Touch stamp file for Xcode dependency tracking
mkdir -p "$(dirname "$STAMP_FILE")"
touch "$STAMP_FILE"
        EOS
      end

      # Builds and caches a map from pod names to package information.
      # Scans all spm.config.json files in:
      #   - packages/*/spm.config.json (internal Expo packages)
      #   - packages/external/*/spm.config.json (external packages)
      #
      # @return [Hash] Map of podName -> { type:, npm_package:, podspec_dir:, build_output_dir:, codegen_name: }
      def get_pod_lookup_map
        return @pod_lookup_map if @pod_lookup_map

        @pod_lookup_map = {}
        repo_root = find_repo_root
        return @pod_lookup_map unless repo_root

        # Scan internal packages: packages/*/spm.config.json
        Dir.glob(File.join(repo_root, 'packages', '*', 'spm.config.json')).each do |config_path|
          next if config_path.include?('/external/')
          process_spm_config(config_path, :internal, repo_root)
        end

        # Scan external packages: packages/external/*/spm.config.json (non-scoped)
        Dir.glob(File.join(repo_root, 'packages', 'external', '*', 'spm.config.json')).each do |config_path|
          next if config_path.include?('/@') # Skip scoped packages in this pass
          process_spm_config(config_path, :external, repo_root)
        end

        # Scan external packages: packages/external/@scope/*/spm.config.json (scoped)
        Dir.glob(File.join(repo_root, 'packages', 'external', '@*', '*', 'spm.config.json')).each do |config_path|
          process_spm_config(config_path, :external, repo_root)
        end

        @pod_lookup_map
      end

      # Processes a single spm.config.json file and adds entries to the map.
      def process_spm_config(config_path, type, repo_root)
        begin
          config = JSON.parse(File.read(config_path))
          products = config['products'] || []

          # Extract npm_package name from path
          # For scoped packages like packages/external/@shopify/react-native-skia/spm.config.json
          # we need @shopify/react-native-skia, not just react-native-skia
          package_dir = File.dirname(config_path)
          if type == :external
            external_dir = File.join(repo_root, 'packages', 'external')
            npm_package = package_dir.sub("#{external_dir}/", '')
          else
            npm_package = File.basename(package_dir)
          end

          products.each do |product|
            pod_name = product['podName']
            next unless pod_name

            codegen_name = product['codegenName']
            product_name = product['name'] || pod_name  # Product name is used for xcframework naming

            # Centralized build output: packages/precompile/.build/<npm_package>/output/
            build_output_dir = File.join(repo_root, 'packages', 'precompile', PRECOMPILE_BUILD_DIR, npm_package, 'output')

            # Determine podspec directory and package root based on package type and conventions
            if type == :internal
              # Internal packages: podspec in packages/<npm_package>/ios/ or packages/<npm_package>/
              package_root = File.join(repo_root, 'packages', npm_package)
              ios_podspec = File.join(package_root, 'ios', "#{pod_name}.podspec")
              root_podspec = File.join(package_root, "#{pod_name}.podspec")

              podspec_dir = if File.exist?(ios_podspec)
                File.join(package_root, 'ios')
              elsif File.exist?(root_podspec)
                package_root
              else
                # Fallback to ios/ directory (most common for Expo packages)
                File.join(package_root, 'ios')
              end
            else
              # External packages: podspec in node_modules/<npm_package>/
              package_root = File.join(repo_root, 'node_modules', npm_package)
              podspec_dir = package_root
            end

            # Extract target info for dSYM staging path remapping.
            # Each target has a name (staging dir name) and path (real source location relative to package root).
            targets = (product['targets'] || []).select { |t| t['type'] != 'framework' && !t['path']&.start_with?('.build/') }.map do |t|
              { name: t['name'], path: t['path'] }
            end

            # Extract SPM dependency framework names from spmPackages declarations.
            # These are transitive binary dependencies (e.g., Lottie from lottie-spm)
            # that must be vendored alongside the product xcframework.
            spm_dependency_frameworks = (product['spmPackages'] || []).map { |pkg| pkg['productName'] }.compact

            @pod_lookup_map[pod_name] = {
              type: type,
              npm_package: npm_package,
              package_root: package_root,
              podspec_dir: podspec_dir,
              build_output_dir: build_output_dir,
              codegen_name: codegen_name,
              product_name: product_name,
              targets: targets,
              spm_dependency_frameworks: spm_dependency_frameworks
            }
          end
        rescue JSON::ParserError, StandardError => e
          Pod::UI.warn "[Expo-precompiled] Failed to read spm.config.json at #{config_path}: #{e.message}"
        end
      end

      # Extracts a tarball into the destination directory.
      # @param tarball_path [String] Path to the .tar.gz file
      # @param dest_dir [String] Directory to extract into
      def extract_tarball(tarball_path, dest_dir)
        FileUtils.mkdir_p(dest_dir)
        system('tar', '-xzf', tarball_path, '-C', dest_dir)
      end

      # Cleans up legacy symlink-based structure from previous versions.
      # Removes old debug/ and release/ expanded dirs and xcframework symlinks.
      # @param xcframeworks_dir [String] Path to the xcframeworks directory
      def cleanup_legacy_symlink_structure(xcframeworks_dir)
        return unless File.directory?(xcframeworks_dir)

        # Remove old flavor directories (debug/, release/)
        ['debug', 'release'].each do |flavor|
          flavor_path = File.join(xcframeworks_dir, flavor)
          if File.symlink?(flavor_path)
            File.unlink(flavor_path)
          elsif File.directory?(flavor_path)
            FileUtils.rm_rf(flavor_path)
          end
        end

        # Remove old xcframework symlinks
        Dir.glob(File.join(xcframeworks_dir, '*.xcframework')).each do |entry|
          if File.symlink?(entry)
            File.unlink(entry)
          end
        end
      end

      # Finds the repository root by walking up from the current directory.
      # Looks for the 'packages' directory as a marker.
      #
      # @param start_dir [String] Directory to start searching from (defaults to Dir.pwd)
      # @return [String, nil] The repository root path, or nil if not found
      def find_repo_root(start_dir = nil)
        current_dir = start_dir || Dir.pwd

        loop do
          packages_path = File.join(current_dir, 'packages')
          return current_dir if File.directory?(packages_path)

          parent = File.dirname(current_dir)
          break if parent == current_dir # Reached filesystem root
          current_dir = parent
        end

        nil
      end

      # Returns the codegenConfig library names for pods that should be excluded from codegen.
      #
      # Discovers prebuilt packages from packages/external and reads their spm.config.json
      # to find the codegen module names that should be excluded.
      # Only excludes codegen for packages that have actually been built (XCFramework exists).
      #
      # @param pod_targets [Array<Pod::PodTarget>] The pod targets to check (used to find repo root)
      # @return [Array<String>] codegenConfig.name values to exclude from codegen
      #
      def get_codegen_exclusions(pod_targets)
        return [] unless enabled?

        exclusions = []
        pod_map = get_pod_lookup_map

        # Find external packages with codegen that have XCFrameworks built
        pod_map.each do |pod_name, info|
          next unless info[:type] == :external
          next unless info[:codegen_name]

          # Check if the XCFramework actually exists before excluding codegen
          # Use product_name for xcframework path (xcframework is named after product, not pod)
          product_name = info[:product_name] || pod_name
          # Check for tarballs (new format) or expanded dirs (legacy) at podspec-level and build output
          local_tarball = File.join(info[:podspec_dir], XCFRAMEWORKS_DIR_NAME, "#{product_name}-#{build_flavor}.tar.gz")
          build_tarball = File.join(info[:build_output_dir], build_flavor, 'xcframeworks', "#{product_name}.tar.gz")
          local_xcframework = File.join(info[:podspec_dir], XCFRAMEWORKS_DIR_NAME, "#{product_name}.xcframework")
          build_xcframework = File.join(info[:build_output_dir], build_flavor, 'xcframeworks', "#{product_name}.xcframework")
          next unless File.exist?(local_tarball) || File.exist?(build_tarball) || File.directory?(local_xcframework) || File.directory?(build_xcframework)

          exclusions << info[:codegen_name]
          Pod::UI.info "#{('[Expo-precompiled]').blue} Found external package '#{info[:npm_package]}' with codegen module: #{info[:codegen_name]}"
        end

        exclusions.uniq
      end

      # TODO(ExpoModulesJSI-xcframework): Remove this method when ExpoModulesJSI.xcframework
      # is built and distributed separately. At that point, pods can depend on ExpoModulesJSI
      # directly and this header search path workaround won't be needed.
      #
      # Configures header search paths for prebuilt XCFrameworks in the post_install phase.
      #
      # When using prebuilt modules, ExpoModulesJSI headers are bundled inside
      # ExpoModulesCore.xcframework. This method adds the necessary header search paths
      # to all pod targets so that `#import <ExpoModulesJSI/...>` works correctly.
      #
      # @param installer [Pod::Installer] The CocoaPods installer instance
      #
      def configure_header_search_paths(installer)
        return unless enabled?

        # Find ExpoModulesCore.xcframework path
        expo_core_xcframework = find_expo_modules_core_xcframework(installer)
        return unless expo_core_xcframework

        # Collect header search paths from all slices
        header_search_paths = collect_xcframework_header_paths(expo_core_xcframework)
        return if header_search_paths.empty?

        paths_string = header_search_paths.map { |p| "\"#{p}\"" }.join(' ')

        Pod::UI.info "#{('[Expo-precompiled]').blue} Adding ExpoModulesJSI header search paths to all targets"

        # Modify xcconfig files directly - these take precedence over Xcode project settings
        pods_root = installer.sandbox.root
        target_support_files_dir = File.join(pods_root, 'Target Support Files')

        # Update ALL xcconfig files in Target Support Files (includes pod targets and aggregate targets)
        Dir.glob(File.join(target_support_files_dir, '**', '*.xcconfig')).each do |xcconfig_path|
          update_xcconfig_header_search_paths(xcconfig_path, paths_string)
        end

        # Also update the main project targets' build settings directly
        # This ensures the header paths are available when building the main app
        installer.pods_project.targets.each do |target|
          target.build_configurations.each do |config|
            existing = config.build_settings['HEADER_SEARCH_PATHS'] || '$(inherited)'
            unless existing.include?(paths_string)
              config.build_settings['HEADER_SEARCH_PATHS'] = "#{existing} #{paths_string}"
            end
          end
        end
      end

      # Configures the ReactCodegen target to properly handle prebuilt modules.
      # This removes source file references for prebuilt libraries from the compile sources phase
      # and adds a shell script build phase to clean up regenerated codegen files.
      #
      # When a library is prebuilt as an XCFramework, its codegen output is already included
      # in the framework. We need to:
      # 1. Remove the generated source files from ReactCodegen's compile sources
      # 2. Delete regenerated files after each codegen run to avoid duplicate symbols
      def configure_codegen_for_prebuilt_modules(installer)
        return unless enabled?

        script_phase_name = '[Expo] Remove duplicate codegen output'
        react_codegen_target = installer.pods_project.targets.find { |target| target.name == 'ReactCodegen' }

        unless react_codegen_target
          Pod::UI.puts "[Expo] ".yellow + "ReactCodegen target not found in pods project"
          return
        end

        # Check if the build phase already exists
        already_exists = react_codegen_target.build_phases.any? do |phase|
          phase.is_a?(Xcodeproj::Project::Object::PBXShellScriptBuildPhase) && phase.name == script_phase_name
        end

        # Get codegen library names for prebuilt packages that should be excluded
        codegen_exclusions = get_codegen_exclusions(installer.pod_targets)

        if codegen_exclusions.any?
          Pod::UI.puts "[Expo] ".blue + "Will remove codegen output for prebuilt libraries: #{codegen_exclusions.join(', ')}"
          remove_codegen_sources_from_compile_phase(react_codegen_target, codegen_exclusions)
        end

        unless already_exists
          Pod::UI.puts "[Expo] ".blue + "Adding '#{script_phase_name}' build phase to ReactCodegen"
          add_codegen_cleanup_script_phase(react_codegen_target, script_phase_name, codegen_exclusions)
          installer.pods_project.save
        end
      end

      private

      # Removes source file references for prebuilt libraries from ReactCodegen compile sources.
      # This prevents Xcode from trying to compile codegen files that are already in the XCFrameworks.
      def remove_codegen_sources_from_compile_phase(target, codegen_exclusions)
        compile_sources_phase = target.build_phases.find do |p|
          p.is_a?(Xcodeproj::Project::Object::PBXSourcesBuildPhase)
        end

        return unless compile_sources_phase

        files_to_remove = []
        compile_sources_phase.files.each do |build_file|
          file_ref = build_file.file_ref
          next unless file_ref

          file_path = file_ref.path.to_s
          display_name = build_file.display_name.to_s

          codegen_exclusions.each do |lib|
            # Match files like:
            # - rnscreens-generated.mm (file name starts with lib name)
            # - rnscreensJSI-generated.cpp
            # - ShadowNodes.cpp in rnscreens/ group
            # - ComponentDescriptors.cpp in rnscreens/ group
            if file_path.start_with?("#{lib}-") ||
               file_path.start_with?("#{lib}JSI") ||
               display_name.start_with?("#{lib}-") ||
               display_name.start_with?("#{lib}JSI") ||
               file_path.include?("/#{lib}/") ||
               file_path.start_with?("#{lib}/")
              files_to_remove << build_file
              break
            end

            # Also check if the file is in a group named after the library
            if file_ref.respond_to?(:parent) && file_ref.parent
              parent_name = file_ref.parent.name.to_s rescue ""
              if parent_name == lib
                files_to_remove << build_file
                break
              end
            end
          end
        end

        if files_to_remove.any?
          Pod::UI.puts "[Expo] ".blue + "Removing #{files_to_remove.count} codegen source files from ReactCodegen compile sources"
          files_to_remove.each do |build_file|
            compile_sources_phase.files.delete(build_file)
          end
        end
      end

      # Adds a shell script build phase to clean up codegen output for prebuilt libraries.
      # React Native's generate-codegen-artifacts.js doesn't support excluding libraries,
      # so we run codegen normally and then delete the generated files for prebuilt libraries.
      def add_codegen_cleanup_script_phase(target, phase_name, codegen_exclusions)
        codegen_cleanup_list = codegen_exclusions.map { |lib| "\"#{lib}\"" }.join(' ')

        phase = target.new_shell_script_build_phase(phase_name)
        phase.shell_path = '/bin/sh'
        phase.shell_script = codegen_cleanup_shell_script(codegen_cleanup_list)

        # Add input/output files to enable Xcode dependency analysis.
        # This allows Xcode to skip this script phase when inputs haven't changed.
        # Input: autolinking.json - changes when codegen-enabled libraries change
        # Output: A marker file that gets touched when codegen runs
        phase.input_paths = ['$(PODS_ROOT)/../build/generated/autolinking/autolinking.json']
        phase.output_paths = ['$(DERIVED_FILE_DIR)/expo-codegen-cleanup.stamp']

        # Find the index of the "Compile Sources" phase (PBXSourcesBuildPhase)
        compile_sources_index = target.build_phases.find_index do |p|
          p.is_a?(Xcodeproj::Project::Object::PBXSourcesBuildPhase)
        end

        if compile_sources_index
          # Remove the phase from its current position (it was added at the end)
          target.build_phases.delete(phase)
          # Insert it before the "Compile Sources" phase
          target.build_phases.insert(compile_sources_index, phase)
        else
          Pod::UI.puts "[Expo] ".yellow + "Could not find 'Compile Sources' phase, build phase added at default position"
        end
      end

      # Returns the shell script content for the codegen cleanup build phase.
      # This script runs AFTER the main codegen workaround (added by installer.rb) and
      # removes generated files for prebuilt libraries to avoid duplicate symbols.
      def codegen_cleanup_shell_script(codegen_cleanup_list)
        <<~SH
          # Cleanup generated codegen files for prebuilt libraries to avoid duplicate symbols
          # When a library is prebuilt as an XCFramework, its codegen output is already included in the framework.
          # We need to remove the generated files so they don't get compiled into the ReactCodegen pod as well.
          # NOTE: The source file references have already been removed from the Xcode project during pod install,
          # but we still need to delete the files because codegen regenerates them on each build.

          PREBUILT_CODEGEN_LIBS=(#{codegen_cleanup_list})
          CODEGEN_OUTPUT_DIR="$PODS_ROOT/../build/generated/ios/ReactCodegen"

          if [ ${#PREBUILT_CODEGEN_LIBS[@]} -gt 0 ]; then
            echo "[Expo] Cleaning up codegen output for prebuilt libraries: ${PREBUILT_CODEGEN_LIBS[*]}"

            for lib in "${PREBUILT_CODEGEN_LIBS[@]}"; do
              # Remove module directory (contains .h and -generated.mm files)
              if [ -d "$CODEGEN_OUTPUT_DIR/$lib" ]; then
                echo "[Expo] Removing module: $CODEGEN_OUTPUT_DIR/$lib"
                rm -rf "$CODEGEN_OUTPUT_DIR/$lib"
              fi

              # Remove JSI header file
              if [ -f "$CODEGEN_OUTPUT_DIR/${lib}JSI.h" ]; then
                echo "[Expo] Removing JSI header: $CODEGEN_OUTPUT_DIR/${lib}JSI.h"
                rm -f "$CODEGEN_OUTPUT_DIR/${lib}JSI.h"
              fi

              # Remove components directory
              if [ -d "$CODEGEN_OUTPUT_DIR/react/renderer/components/$lib" ]; then
                echo "[Expo] Removing components: $CODEGEN_OUTPUT_DIR/react/renderer/components/$lib"
                rm -rf "$CODEGEN_OUTPUT_DIR/react/renderer/components/$lib"
              fi
            done
          fi

          # Touch the stamp file for Xcode dependency tracking
          mkdir -p "$DERIVED_FILE_DIR"
          touch "$DERIVED_FILE_DIR/expo-codegen-cleanup.stamp"
        SH
      end

      # TODO(ExpoModulesJSI-xcframework): Remove this method when ExpoModulesJSI.xcframework
      # is built and distributed separately.
      #
      # Updates HEADER_SEARCH_PATHS in an xcconfig file
      def update_xcconfig_header_search_paths(xcconfig_path, paths_string)
        content = File.read(xcconfig_path)

        # Find and update HEADER_SEARCH_PATHS line
        if content.include?('HEADER_SEARCH_PATHS')
          updated_content = content.gsub(/^(HEADER_SEARCH_PATHS\s*=\s*)(.*)$/) do |match|
            # Avoid adding duplicate paths
            if $2.include?(paths_string)
              match
            else
              "#{$1}#{$2} #{paths_string}"
            end
          end
          File.write(xcconfig_path, updated_content) if updated_content != content
        else
          # Add HEADER_SEARCH_PATHS if it doesn't exist
          File.open(xcconfig_path, 'a') do |f|
            f.puts "HEADER_SEARCH_PATHS = $(inherited) #{paths_string}"
          end
        end
      end      # Finds the ExpoModulesCore.xcframework path from the installer
      def find_expo_modules_core_xcframework(installer)
        # Look through pod targets to find ExpoModulesCore's vendored framework
        installer.pod_targets.each do |target|
          next unless target.name == 'ExpoModulesCore'

          vendored = target.root_spec.attributes_hash['vendored_frameworks']
          next unless vendored

          frameworks = vendored.is_a?(Array) ? vendored : [vendored]
          frameworks.each do |framework|
            if framework.to_s.include?('ExpoModulesCore.xcframework')
              # The vendored_frameworks path is relative to the podspec location
              # We can get the podspec dir from the target's pod_dir
              podspec_dir = target.sandbox.pod_dir(target.name)
              framework_path = File.expand_path(framework, podspec_dir)

              Pod::UI.info "#{('[Expo-precompiled]').blue} Looking for ExpoModulesCore.xcframework at: #{framework_path}"
              return framework_path if File.directory?(framework_path)
            end
          end
        end

        nil
      end

      # Collects header paths from all slices of an XCFramework
      def collect_xcframework_header_paths(xcframework_path)
        paths = []
        return paths unless File.directory?(xcframework_path)

        Dir.children(xcframework_path).each do |slice|
          slice_path = File.join(xcframework_path, slice)
          next unless File.directory?(slice_path)

          # Look for the framework's Headers directory
          framework_headers = File.join(slice_path, 'ExpoModulesCore.framework', 'Headers')
          paths << framework_headers if File.directory?(framework_headers)
        end

        paths
      end

      # Logs the linking status for a pod (only once per pod to avoid duplicate output)
      def log_linking_status(pod_name, found, path)
        # Skip logging if we've already logged this pod
        @logged_pods ||= {}
        return if @logged_pods[pod_name]
        @logged_pods[pod_name] = true

        status = found ? "" : "(⚠️ Build from source: framework not found #{path})"
        Pod::UI.info "#{"[Expo-precompiled] ".blue} 📦 #{pod_name.green} #{status}"
      end
    end
  end
end
