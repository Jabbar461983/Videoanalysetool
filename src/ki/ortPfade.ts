import asyncifyMjs from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import asyncifyWasm from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import schlichtMjs from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import schlichtWasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';

/**
 * Laufzeitdateien von onnxruntime-web, mit der App ausgeliefert (kein CDN).
 * «asyncify» enthält WebGPU und CPU; die schlichte Variante ist kleiner und nur für die CPU.
 */
export const ORT_PFADE = {
  webgpu: { mjs: asyncifyMjs, wasm: asyncifyWasm },
  cpu: { mjs: schlichtMjs, wasm: schlichtWasm },
};
