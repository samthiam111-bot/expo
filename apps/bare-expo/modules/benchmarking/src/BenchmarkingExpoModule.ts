import { requireNativeModule, NativeModule } from 'expo';

declare class BenchmarkingExpoModule extends NativeModule {
  nothing(): void;
  addNumbers(a: number, b: number): number;
  asyncAddNumbers(a: number, b: number): Promise<number>;
  concurrentAddNumbers(a: number, b: number): Promise<number>;
  addStrings(a: string, b: string): string;
  foldArray(array: number[]): number;
}

export default requireNativeModule<BenchmarkingExpoModule>('BenchmarkingExpoModule');
