importScripts("sha3.min.js");

function ContainsEnoughWork(hash) {
  return hash.startsWith("0000");
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
  let [magic, to, pixel_nft] = e.data;
  let hash = undefined;
  //let pixel_nft_hex_str = pixel_nft.reduce(function (memo, i) { return memo + i2hex(i) }, '');
  //console.log(`Pixel nft hex str: ${pixel_nft_hex_str}`);
  let pixel_nft_array = [];
  for (let i = 0; i < pixel_nft.length; i++) {
    pixel_nft_array.push(pixel_nft[i]);
  }
  while (magic < to) {
    hash = sha3_256(pixel_nft_array.concat(IntToMagicStr(magic)));
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
