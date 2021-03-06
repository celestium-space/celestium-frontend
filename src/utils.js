import * as Secp256k1 from "secp256k1";
import { sha3_256 } from "./sha3.min.js";
import { randomBytes } from "crypto";

const TRANSACTION_WORK = 0x1000000;

const colorMap = [
  [0x00, 0x00, 0x00],
  [0xe5, 0x00, 0x00],
  [0x02, 0xbe, 0x01],
  [0x00, 0x00, 0xea],
  [0xf8, 0xf2, 0x08],
  [0xfd, 0x5e, 0xf8],
  [0x00, 0xd3, 0xdd],
  [0xff, 0xff, 0xff],
  [0x74, 0x15, 0xcd],
  [0xf3, 0xc9, 0x9d],
  [0x99, 0x99, 0x99],
  [0xe5, 0x95, 0x00],
  [0x00, 0x83, 0xc7],
  [0x34, 0x71, 0x15],
  [0x43, 0x27, 0x0a],
  [0x86, 0x5a, 0x48],

  // Leet h4cker colors
  [0xc5, 0x00, 0x00],
  [0xff, 0x40, 0x40],
  [0x00, 0x9e, 0x00],
  [0x42, 0xfe, 0x41],
  [0x00, 0x00, 0xca],
  [0x40, 0x40, 0xff],
  [0xc5, 0xb9, 0x00],
  [0xff, 0xff, 0x40],
  [0xdd, 0x3e, 0xd8],
  [0xff, 0x9e, 0xff],
  [0x00, 0xb3, 0xbd],
  [0x40, 0xff, 0xff],
  [0x54, 0x00, 0xad],
  [0xb4, 0x55, 0xff],
  [0xd3, 0xa9, 0x7d],
  [0xff, 0xff, 0xdd],
  [0x79, 0x79, 0x79],
  [0xd9, 0xd9, 0xd9],
  [0xc5, 0x75, 0x00],
  [0xff, 0xd5, 0x40],
  [0x00, 0x63, 0xa7],
  [0x40, 0xc3, 0xff],
  [0x14, 0x51, 0x00],
  [0x74, 0xb1, 0x55],
  [0x23, 0x07, 0x00],
  [0x83, 0x67, 0x4a],
  [0x66, 0x3a, 0x28],
  [0xc6, 0x9a, 0x88],
  [0x11, 0x11, 0x11],
  [0x22, 0x22, 0x22],
  [0x33, 0x33, 0x33],
  [0x44, 0x44, 0x44],
  [0x55, 0x55, 0x55],
  [0x66, 0x66, 0x66],
  [0x77, 0x77, 0x77],
  [0x88, 0x88, 0x88],
  [0xaa, 0xaa, 0xaa],
  [0xbb, 0xbb, 0xbb],
  [0xcc, 0xcc, 0xcc],
  [0xdd, 0xdd, 0xdd],
  [0xee, 0xee, 0xee],
];

function numberToShortScale(x) {
  if (x < 1) return "Unknown";
  else if (0 <= x && x < 1000) return `${x.toFixed(2)}`;
  else if (1_000.0 <= x && x < 1_000_000.0)
    return `${(x / 1000).toFixed(2)} thousand`;
  else if (1_000_000.0 <= x && x < 1_000_000_000.0)
    return `${(x / 1_000_000.0).toFixed(2)} billion`;
  else if (1_000_000_000.0 <= x && x < 1_000_000_000_000.0)
    return `${(x / 1_000_000_000.0).toFixed(2)} trillion`;
  else if (1_000_000_000_000.0 <= x && x < 1_000_000_000_000_000.0)
    return `${(x / 1_000_000_000_000.0).toFixed(2)} quadrillion`;
  else if (1_000_000_000_000_000.0 <= x && x < 1_000_000_000_000_000_000.0)
    return `${(x / 1_000_000_000_000_000.0).toFixed(2)} quintillion`;
  else if (
    1_000_000_000_000_000_000.0 <= x &&
    x < 1_000_000_000_000_000_000_000.0
  )
    return `${(x / 1_000_000_000_000_000_000.0).toFixed(2)} sextillion`;
  else return `${(x / 1_000_000_000_000_000_000_000.0).toFixed(2)} septillion`;
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  for (var i = 0; i < a.length; ++i) {
    if (a[i] != b[i]) return false;
  }
  return true;
}

function findColorIndex(rgb) {
  for (let i = 0; i < colorMap.length; i++) {
    if (arraysEqual(colorMap[i], rgb)) return i;
  }
  return -1;
}

function intToColor(i) {
  let [r, g, b] = colorMap[i];
  return [r, g, b, 255];
}

function intToRgb(i) {
  let [r, g, b] = colorMap[i];
  return (
    "rgb(" + r.toString() + ", " + g.toString() + ", " + b.toString() + ")"
  );
}

function range(start, stop, step) {
  if (typeof stop == "undefined") {
    stop = start;
    start = 0;
  }

  if (typeof step == "undefined") {
    step = 1;
  }

  if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
    return [];
  }

  var result = [];
  for (var i = start; step > 0 ? i < stop : i > stop; i += step) {
    result.push(i);
  }

  return result;
}

const thread_work = 0x20000;
const desired_threads = 8; //navigator.hardwareConcurrency; <- This lies
let magic = undefined;
let start = performance.now();
let work_times = [];
let i = 0;
let thread_nr = 0;

function i2hex(i) {
  return ("0" + i.toString(16)).slice(-2);
}

function uint8ArrToHexStr(arr) {
  return arr.reduce(function (memo, i) {
    return memo + i2hex(i);
  }, "");
}

function hexStrToUint8Arr(hex_str) {
  return new Uint8Array(
    hex_str.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
  );
}

function startMiningThreadIfNeeded(
  result,
  mining_data,
  res,
  set_eta,
  extra_work
) {
  if (!magic) {
    let [result_magic, work_time] = result;
    if (result_magic) {
      magic = result_magic;
      let transaction = new Uint8Array(mining_data.length + magic.length);
      for (let i = 0; i < mining_data.length; i++) {
        transaction[i] = mining_data[i];
      }
      for (let i = 0; i < magic.length; i++) {
        transaction[i + mining_data.length] = magic[i];
      }
      //magic = undefined;
      start = performance.now();
      work_times = [];
      i = 0;
      res(transaction);
      console.log("Thread dead...");
    } else {
      let expected_time_left = "Calculating...";
      if (work_time) {
        work_times.push(work_time);
        let expected_required_work = TRANSACTION_WORK + extra_work;
        let expected_required_threads = expected_required_work / thread_work;
        let average_work_time =
          work_times.reduce(
            (accumulator, currentValue) => accumulator + currentValue
          ) /
          work_times.length /
          1000;
        let expected_run_time =
          (expected_required_threads * average_work_time) / desired_threads;
        let elapsed_seconds = (performance.now() - start) / 1000;
        expected_time_left = expected_run_time - elapsed_seconds;
        let eta = new Date(Date.now() + expected_time_left * 1000);
        set_eta(eta);
      }
      let from = i * thread_work;
      let to = (i + 1) * thread_work;

      let worker = new Worker("worker.js");

      worker.addEventListener("message", function (e) {
        startMiningThreadIfNeeded(
          e.data,
          mining_data,
          res,
          set_eta,
          extra_work
        );
      });
      worker.postMessage([from, to, mining_data]);
      i++;
    }
  } else {
    console.log("Thread dead...");
  }
}

function getKeyPair() {
  let sk = localStorage.getItem("sk_bin");
  if (
    sk &&
    sk.length == 64 &&
    Secp256k1.privateKeyVerify(hexStrToUint8Arr(sk))
  ) {
    sk = hexStrToUint8Arr(sk);
    let pk = Secp256k1.publicKeyCreate(sk);
    return [pk, sk];
  } else {
    console.error(
      "Could not verify SK or no SK key in localstorage, generating new SK"
    );
    while (true) {
      let sk = randomBytes(32);
      if (Secp256k1.privateKeyVerify(sk)) {
        localStorage.setItem("sk_bin", uint8ArrToHexStr(sk));
        let pk = Secp256k1.publicKeyCreate(sk);
        return [pk, sk];
      }
    }
  }
}

function create_pixel_nft(block_hash, prev_pixel_hash, x, y, c, pk) {
  const transaction_version_len = 1;
  const transaction_input_count_len = 1;
  const transaction_input_block_hash_len = 32;
  const transaction_input_message_len = 32;
  const transaction_input_index_len = 1;
  const transaction_output_count_len = 1;
  const transaction_output_value_version_len = 1;
  const transaction_output_value_id_len = 32;
  const transaction_output_pk_len = 33;

  let transaction = new Uint8Array(
    transaction_version_len +
      transaction_input_count_len +
      transaction_input_block_hash_len +
      transaction_input_message_len +
      transaction_input_index_len +
      transaction_output_count_len +
      transaction_output_value_version_len +
      transaction_output_value_id_len +
      transaction_output_pk_len
  );

  if (Object.prototype.toString.call(block_hash) != "[object Uint8Array]") {
    console.error(
      'Expected block hash of type "[object Uint8Array]" got "' +
        Object.prototype.toString.call(block_hash) +
        '"'
    );
    return;
  } else if (block_hash.byteLength != 32) {
    console.error(
      "Expected block hash of lenght 32 got " + block_hash.byteLength
    );
    return;
  }

  if (Object.prototype.toString.call(pk) != "[object Uint8Array]") {
    console.error(
      'Expected public key of type "[object Uint8Array]" got "' +
        Object.prototype.toString.call(pk) +
        '"'
    );
    return;
  } else if (pk.byteLength != 33) {
    console.error("Expected public key of lenght 32 got " + pk.byteLength);
    return;
  }

  transaction[0] = 0; // Transaction version
  transaction[1] = 0; // Transaction input count (0 = base transaction)
  transaction.set(block_hash, 2);
  transaction.set(prev_pixel_hash, 34);
  transaction[62] = (x >> 8) & 0xff;
  transaction[63] = x & 0xff;
  transaction[64] = (y >> 8) & 0xff;
  transaction[65] = y & 0xff;
  transaction[66] = c & 0xff;
  transaction[67] = 1; // Transaction output count
  transaction[68] = 1; // Transaction output value version
  let actual_nft = transaction.slice(34, 67);
  let hash = sha3_256(actual_nft);
  transaction.set(hexStrToUint8Arr(hash), 69);
  transaction.set(pk, 101);
  return transaction;
}

function generateAndMinePixelNFT(
  x = 100,
  y = 200,
  color = 3,
  block_hash,
  prev_pixel_hash,
  set_eta
) {
  let prom = new Promise((resolve, reject) => {
    let [pk, _] = getKeyPair();
    let pixel_nft = create_pixel_nft(
      Uint8Array.from(block_hash),
      Uint8Array.from(prev_pixel_hash),
      x,
      y,
      color,
      pk
    );

    magic = undefined;
    start = performance.now();
    for (let i = 0; i < desired_threads; i++) {
      startMiningThreadIfNeeded(
        [undefined, undefined],
        pixel_nft,
        resolve,
        set_eta,
        TRANSACTION_WORK
      );
    }
  });
  return prom;
}

function mineTransaction(transaction, set_eta) {
  return new Promise((resolve, reject) => {
    magic = undefined;
    start = performance.now();
    for (let i = 0; i < desired_threads; i++) {
      startMiningThreadIfNeeded(
        [undefined, undefined],
        transaction,
        resolve,
        set_eta,
        0
      );
    }
  });
}

function getBackendItem() {
  // Get from celestium-api instead
  const transaction_version_len = 1;
  const transaction_input_count_len = 1;
  const transaction_input_block_hash_len = 32;
  const transaction_input_id_len = 32;
  const transaction_input_index_len = 1;
  const transaction_input_len =
    transaction_input_block_hash_len +
    transaction_input_id_len +
    transaction_input_index_len;
  const transaction_output_count_len = 1;
  const transaction_output_value_len = 32;
  const transaction_output_pk_len = 33;
  const transaction_output_len =
    transaction_output_count_len +
    transaction_output_value_len +
    transaction_output_pk_len;
  const transaction_input_sig_len = 64;

  let transaction = new Uint8Array(
    transaction_version_len +
      transaction_input_count_len +
      transaction_input_len * 3 +
      transaction_output_count_len +
      transaction_output_len * 3 +
      transaction_input_sig_len * 3
  );

  let i = 0;
  transaction[i++] = 0; // Transaction version
  transaction[i++] = 3; // Transaction input count
  for (let ii = 1; ii < 4; ii++) {
    transaction.set(
      new Uint8Array(transaction_input_len).map(function (_) {
        return ii;
      }),
      i
    );
    i += transaction_input_len;
  }
  transaction[i++] = 3; // Transaction output count
  for (let ii = 4; ii < 7; ii++) {
    transaction.set(
      new Uint8Array(transaction_output_len).map(function (_) {
        return ii;
      }),
      i
    );
    i += transaction_output_len;
  }
  return transaction;
}

function serializeAsTransactionVarUint(value) {
  let var_uint_arr = [];
  do {
    var_uint_arr = [(value & 0x7f) + 0x80, ...var_uint_arr];
    value >>= 7;
  } while (value);
  var_uint_arr[var_uint_arr.length - 1] &= 0x7f;
  return var_uint_arr;
}

function serializeTransaction(transaction, include_signature) {
  let serialized_transacion = [transaction.version];
  serialized_transacion.push(
    ...serializeAsTransactionVarUint(transaction.input_count)
  );
  for (let input of transaction.inputs) {
    serialized_transacion.push(...input.block_hash);
    serialized_transacion.push(...input.transaction_hash);
    serialized_transacion.push(...input.index);
    if (include_signature) {
      serialized_transacion.push(...input.signature);
    }
  }
  serialized_transacion.push(
    ...serializeAsTransactionVarUint(transaction.output_count)
  );
  for (let input of transaction.outputs) {
    serialized_transacion.push(input.value.version);
    serialized_transacion.push(...input.value.value);
    serialized_transacion.push(...input.pk);
  }
  return serialized_transacion;
}

export {
  generateAndMinePixelNFT,
  mineTransaction,
  range,
  intToColor,
  findColorIndex,
  intToRgb,
  uint8ArrToHexStr,
  hexStrToUint8Arr,
  getKeyPair,
  serializeTransaction,
  numberToShortScale,
};
