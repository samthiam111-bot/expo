/**
 * Result of a verification check
 */
export interface VerificationResult {
  success: boolean;
  message: string;
  details?: string;
}

/**
 * Slice information extracted from xcframework
 */
export interface XCFrameworkSlice {
  sliceId: string;
  frameworkName: string;
  frameworkPath: string;
  binaryPath: string;
  sdkName: string;
}

/**
 * Complete verification report for an xcframework
 */
export interface XCFrameworkVerificationReport {
  xcframeworkPath: string;
  infoPlistValid: VerificationResult;
  codesignValid: VerificationResult;
  junkFiles: string[];
  slices: SliceVerificationReport[];
  overallSuccess: boolean;
}

/**
 * Verification report for a single slice
 */
export interface SliceVerificationReport {
  sliceId: string;
  frameworkName: string;
  /** True if the framework contains only ObjC/C++ code (no Swift modules) */
  isObjCOnly: boolean;
  machoInfo: VerificationResult;
  linkedDeps: string[];
  headersPresent: VerificationResult;
  modulesPresent: VerificationResult;
  moduleMapPresent: VerificationResult;
  modularHeadersValid: VerificationResult;
  clangModuleImport: VerificationResult;
  swiftInterfaceTypecheck: VerificationResult;
  /** Whether a matching dSYM bundle exists for this slice */
  dsymPresent: VerificationResult;
  /** Whether dSYM UUIDs match the framework binary UUIDs */
  dsymUuidMatch: VerificationResult;
  /** Whether DWARF source paths use the canonical /expo-src/ prefix (no absolute CI paths) */
  dsymDebugPrefixMapping: VerificationResult;
}

/**
 * Options for verification
 */
export interface VerifyOptions {
  /** Skip codesign verification */
  skipCodesign?: boolean;
  /** Skip clang module import check */
  skipClangCheck?: boolean;
  /** Skip swift interface typecheck */
  skipSwiftCheck?: boolean;
  /** Skip dSYM verification (presence, UUID match, debug prefix mapping) */
  skipDsymCheck?: boolean;
  /** Show detailed error messages */
  verbose?: boolean;
}
