importScripts("sha3.min.js");

function ContainsEnoughWork(hash) {
  return hash.startsWith("0000");
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

function i2hex(i) {
  return ("0" + i.toString(16)).slice(-2);
}

function IntToMagicStr(input) {
  let result = [input & 0x7f];
  input >>= 7;
  while (input > 0) {
    result.unshift(0x80 + (input & 0x7f));
    input >>= 7;
  }
  return result;
}

self.addEventListener("message", function (e) {
  let start = performance.now();
  let [magic, to, transaction] = e.data;
  let hash = undefined;
  let transaction_array = [];
  for (let i = 0; i < transaction.length; i++) {
    transaction_array.push(transaction[i]);
  }
  let transaction_hash = hexStrToUint8Arr(sha3_256(transaction_array));
  let transaction_hash_array = [];
  for (let i = 0; i < transaction_hash.length; i++) {
    transaction_hash_array.push(transaction_hash[i]);
  }
  while (magic < to) {
    hash = sha3_256(transaction_hash_array.concat(IntToMagicStr(magic)));
    if (ContainsEnoughWork(hash)) {
      self.postMessage([IntToMagicStr(magic), performance.now() - start]);
      self.close();
      return;
    }
    magic++;
  }
  self.postMessage([undefined, performance.now() - start]);
  self.close();
});
