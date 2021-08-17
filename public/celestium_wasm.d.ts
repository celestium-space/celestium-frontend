declare namespace wasm_bindgen {
	/* tslint:disable */
	/* eslint-disable */
	/**
	* Entry point invoked by `worker.js`, a bit of a hack but see the "TODO" above
	* about `worker.js` in general.
	* @param {number} ptr
	*/
	export function child_entry_point(ptr: number): void;
	/**
	*/
	export class RenderingScene {
	  free(): void;
	/**
	* Returns the JS promise object which resolves when the render is complete
	* @returns {Promise<any>}
	*/
	  promise(): Promise<any>;
	/**
	* Return a progressive rendering of the image so far
	* @returns {any}
	*/
	  imageSoFar(): any;
	}
	/**
	*/
	export class WASMWallet {
	  free(): void;
	/**
	* @param {Uint8Array} pk
	* @param {Uint8Array} sk
	* @param {WorkerPool} pool
	* @param {number} concurrency
	*/
	  constructor(pk: Uint8Array, sk: Uint8Array, pool: WorkerPool, concurrency: number);
	/**
	* @param {Uint8Array} content
	* @returns {Uint8Array}
	*/
	  create_and_mine_string_nft(content: Uint8Array): Uint8Array;
	}
	/**
	*/
	export class WorkerPool {
	  free(): void;
	/**
	* Creates a new `WorkerPool` which immediately creates `initial` workers.
	*
	* The pool created here can be used over a long period of time, and it
	* will be initially primed with `initial` workers. Currently workers are
	* never released or gc'd until the whole pool is destroyed.
	*
	* # Errors
	*
	* Returns any error that may happen while a JS web worker is created and a
	* message is sent to it.
	* @param {number} initial
	*/
	  constructor(initial: number);
	}
	
}

declare type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

declare interface InitOutput {
  readonly __wbg_wasmwallet_free: (a: number) => void;
  readonly wasmwallet_new: (a: number, b: number, c: number, d: number) => number;
  readonly wasmwallet_create_and_mine_string_nft: (a: number, b: number) => number;
  readonly __wbg_renderingscene_free: (a: number) => void;
  readonly renderingscene_promise: (a: number) => number;
  readonly renderingscene_imageSoFar: (a: number) => number;
  readonly __wbg_workerpool_free: (a: number) => void;
  readonly workerpool_new: (a: number) => number;
  readonly child_entry_point: (a: number) => void;
  readonly rustsecp256k1_v0_2_0_context_preallocated_destroy: (a: number) => void;
  readonly rustsecp256k1_v0_2_0_ecdsa_sign: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly rustsecp256k1_v0_2_0_ec_pubkey_parse: (a: number, b: number, c: number, d: number) => number;
  readonly rustsecp256k1_v0_2_0_ec_pubkey_serialize: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly rustsecp256k1_v0_2_0_ec_seckey_verify: (a: number, b: number) => number;
  readonly rustsecp256k1_v0_2_0_ec_pubkey_create: (a: number, b: number, c: number) => number;
  readonly rustsecp256k1_v0_2_0_ecdsa_verify: (a: number, b: number, c: number, d: number) => number;
  readonly rustsecp256k1_v0_2_0_ecdsa_signature_serialize_compact: (a: number, b: number, c: number) => number;
  readonly rustsecp256k1_v0_2_0_context_preallocated_size: (a: number) => number;
  readonly rustsecp256k1_v0_2_0_context_preallocated_create: (a: number, b: number) => number;
  readonly rustsecp256k1_v0_2_0_ecdsa_signature_serialize_der: (a: number, b: number, c: number, d: number) => number;
  readonly rustsecp256k1_v0_2_0_ecdsa_signature_parse_der: (a: number, b: number, c: number, d: number) => number;
  readonly rustsecp256k1_v0_2_0_ecdsa_signature_parse_compact: (a: number, b: number, c: number) => number;
  readonly rustsecp256k1_v0_2_0_ecdsa_signature_normalize: (a: number, b: number, c: number) => number;
  readonly rustsecp256k1_v0_2_0_ec_pubkey_combine: (a: number, b: number, c: number, d: number) => number;
  readonly rustsecp256k1_v0_2_0_context_create: (a: number) => number;
  readonly rustsecp256k1_v0_2_0_context_destroy: (a: number) => void;
  readonly rustsecp256k1_v0_2_0_default_illegal_callback_fn: (a: number, b: number) => void;
  readonly rustsecp256k1_v0_2_0_default_error_callback_fn: (a: number, b: number) => void;
  readonly rustsecp256k1_v0_2_0_context_preallocated_clone_size: (a: number) => number;
  readonly rustsecp256k1_v0_2_0_context_preallocated_clone: (a: number, b: number) => number;
  readonly rustsecp256k1_v0_2_0_context_set_illegal_callback: (a: number, b: number, c: number) => void;
  readonly rustsecp256k1_v0_2_0_context_set_error_callback: (a: number, b: number, c: number) => void;
  readonly rustsecp256k1_v0_2_0_ec_seckey_negate: (a: number, b: number) => number;
  readonly rustsecp256k1_v0_2_0_ec_privkey_negate: (a: number, b: number) => number;
  readonly rustsecp256k1_v0_2_0_ec_pubkey_negate: (a: number, b: number) => number;
  readonly rustsecp256k1_v0_2_0_ec_seckey_tweak_add: (a: number, b: number, c: number) => number;
  readonly rustsecp256k1_v0_2_0_ec_privkey_tweak_add: (a: number, b: number, c: number) => number;
  readonly rustsecp256k1_v0_2_0_ec_pubkey_tweak_add: (a: number, b: number, c: number) => number;
  readonly rustsecp256k1_v0_2_0_ec_seckey_tweak_mul: (a: number, b: number, c: number) => number;
  readonly rustsecp256k1_v0_2_0_ec_privkey_tweak_mul: (a: number, b: number, c: number) => number;
  readonly rustsecp256k1_v0_2_0_ec_pubkey_tweak_mul: (a: number, b: number, c: number) => number;
  readonly rustsecp256k1_v0_2_0_context_randomize: (a: number, b: number) => number;
  readonly rustsecp256k1_v0_2_0_ecdh: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly __wbindgen_export_0: WebAssembly.Memory;
  readonly __wbindgen_malloc: (a: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number) => number;
  readonly __wbindgen_export_3: WebAssembly.Table;
  readonly _dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h2d327cbcae3cb383: (a: number, b: number, c: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __wbindgen_free: (a: number, b: number) => void;
  readonly __wbindgen_start: () => void;
}

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
* @param {WebAssembly.Memory} maybe_memory
*
* @returns {Promise<InitOutput>}
*/
declare function wasm_bindgen (module_or_path?: InitInput | Promise<InitInput>, maybe_memory?: WebAssembly.Memory): Promise<InitOutput>;
