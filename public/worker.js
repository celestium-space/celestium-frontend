importScripts('sha3.min.js');

function ContainsEnoughWork(hash) {
  return hash.startsWith("0000000");
}

function i2hex(i) {
  return ('0' + i.toString(16)).slice(-2);
}

function IntToMagicStr(input) {
  let result = i2hex(input & 0xff);
  input >>= 7;
  while (input > 0) {
    result = i2hex(0x80 + (input & 0x7f)) + result;
    input >>= 7;
  }
  return result;
}

self.addEventListener('message', function (e) {
  let start = performance.now();
  let [magic, to, pixel_nft] = e.data;
  let hash = undefined;
  let pixel_nft_hex_str = pixel_nft.reduce(function (memo, i) { return memo + i2hex(i) }, '');
  while (magic < to) {
    hash = sha3_256(pixel_nft_hex_str + IntToMagicStr(magic));
    if (ContainsEnoughWork(hash)) {
      self.postMessage([hash, performance.now() - start]);
      self.close();
      return;
    }
    magic++;
  }
  self.postMessage([undefined, performance.now() - start]);
  self.close();
});