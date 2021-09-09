import * as Secp256k1 from 'secp256k1';
import { sha3_256 } from './sha3.min.js';
import { randomBytes } from 'crypto';

const colorMap = [
	[0, 0, 0],
	[255, 0, 0],
	[0, 255, 0],
	[0, 0, 255],
	[255, 255, 0],
	[255, 0, 255],
	[0, 255, 255],
	[255, 255, 255]
];

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
		if (arraysEqual(colorMap[i], rgb))
			return i;
	}
	return -1;
}

function intToColor(i) {
	let [r, g, b] = colorMap[i];
	return [r, g, b, 255];
}

function intToRgb(i) {
	let [r, g, b] = colorMap[i];
	return 'rgb(' + r.toString() + ', ' + g.toString() + ', ' + b.toString() + ')';
}

function range(start, stop, step) {
	if (typeof stop == 'undefined') {
		stop = start;
		start = 0;
	}

	if (typeof step == 'undefined') {
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
};

const thread_work = 0x20000;
const desired_threads = 8; //navigator.hardwareConcurrency; <- This lies
let magic = undefined;
let start = performance.now();
let work_times = []
let i = 0;
let thread_nr = 0;

function i2hex(i) {
	return ('0' + i.toString(16)).slice(-2);
}

function uint8ArrToHexStr(arr) {
	return arr.reduce(function (memo, i) { return memo + i2hex(i) }, '');
}

function hexStrToUint8Arr(hex_str) {
	return new Uint8Array(hex_str.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}


function startMiningThreadIfNeeded(result, mining_data, res) {
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
			work_times = []
			i = 0;
			thread_nr = 0;
			res(transaction);
		} else {
			let expected_time_left = "Calculating...";
			if (work_time) {
				work_times.push(work_time);
				let expected_required_work = 0x10000000 / 2;
				let expected_required_threads = expected_required_work / thread_work;
				let average_work_time = (work_times.reduce((accumulator, currentValue) => accumulator + currentValue) / work_times.length) / 1000;
				let expected_run_time = (expected_required_threads * average_work_time) / desired_threads;
				let elapsed_seconds = (performance.now() - start) / 1000;
				expected_time_left = expected_run_time - elapsed_seconds;
			}
			let from = i * thread_work;
			let to = (i + 1) * thread_work;

			let worker = new Worker('worker.js');

			worker.addEventListener('message', function (e) {
				startMiningThreadIfNeeded(e.data, mining_data, res);
			});
			worker.postMessage([from, to, mining_data]);
			i++;
		}
	}
}

function getKeyPair() {
	let pk = localStorage.getItem("pk_bin");
	let sk = localStorage.getItem("sk_bin");
	if (pk && sk) {
		return [hexStrToUint8Arr(pk), hexStrToUint8Arr(sk)];
	} else {
		console.log("No keys in localstorage, generating new pair");
		while (true) {
			sk = randomBytes(32);
			if (Secp256k1.privateKeyVerify(sk)) {
				pk = Secp256k1.publicKeyCreate(sk);
				localStorage.setItem("pk_bin", uint8ArrToHexStr(pk));
				localStorage.setItem("sk_bin", uint8ArrToHexStr(sk));
				return [pk, sk]
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
		transaction_output_pk_len);

	if (Object.prototype.toString.call(block_hash) != "[object Uint8Array]") {
		console.error('Expected block hash of type "[object Uint8Array]" got "' + Object.prototype.toString.call(block_hash) + '"');
		return;
	} else if (block_hash.byteLength != 32) {
		console.error('Expected block hash of lenght 32 got ' + block_hash.byteLength);
		return;
	}

	if (Object.prototype.toString.call(pk) != "[object Uint8Array]") {
		console.error('Expected public key of type "[object Uint8Array]" got "' + Object.prototype.toString.call(pk) + '"');
		return;
	} else if (pk.byteLength != 33) {
		console.error('Expected public key of lenght 32 got ' + pk.byteLength);
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
	let actual_nft = transaction.slice(35, 68);
	let hash = sha3_256(uint8ArrToHexStr(actual_nft));
	transaction.set(hexStrToUint8Arr(hash), 69);
	transaction.set(pk, 101);
	return transaction;
}

function generateAndMinePixelNFT(x = 100, y = 200, color = 3, block_hash, prev_pixel_hash) {
	let prom = new Promise((resolve, reject) => {
		let [pk, _] = getKeyPair();
		let pixel_nft = create_pixel_nft(Uint8Array.from(block_hash), Uint8Array.from(prev_pixel_hash), x, y, color, pk);

		magic = undefined;
		start = performance.now();
		for (let i = 0; i < desired_threads; i++) {
			startMiningThreadIfNeeded([undefined, undefined], pixel_nft, resolve);
		}
	});
	return prom;
}

function getBackendItem() { // Get from celestium-api instead
	const transaction_version_len = 1;
	const transaction_input_count_len = 1;
	const transaction_input_block_hash_len = 32;
	const transaction_input_id_len = 32;
	const transaction_input_index_len = 1;
	const transaction_input_len = transaction_input_block_hash_len + transaction_input_id_len + transaction_input_index_len;
	const transaction_output_count_len = 1;
	const transaction_output_value_len = 32;
	const transaction_output_pk_len = 33;
	const transaction_output_len = transaction_output_count_len + transaction_output_value_len + transaction_output_pk_len;
	const transaction_input_sig_len = 64;

	let transaction = new Uint8Array(
		transaction_version_len +
		transaction_input_count_len +
		transaction_input_len * 3 +
		transaction_output_count_len +
		transaction_output_len * 3 +
		transaction_input_sig_len * 3);

	let i = 0;
	transaction[i++] = 0; // Transaction version
	transaction[i++] = 3; // Transaction input count
	for (let ii = 1; ii < 4; ii++) {
		transaction.set(new Uint8Array(transaction_input_len).map(function (_) { return ii; }), i);
		i += transaction_input_len;
	}
	transaction[i++] = 3; // Transaction output count
	for (let ii = 4; ii < 7; ii++) {
		transaction.set(new Uint8Array(transaction_output_len).map(function (_) { return ii; }), i);
		i += transaction_output_len;
	}
	return transaction;
}

function buyBackendItem() {
	let [_, sk] = getKeyPair();
	let backend_item_transaction = getBackendItem(); // Get from celestium-api instead
	let transaction_content_len = backend_item_transaction.byteLength - 64 * 3;
	let transaction_content = backend_item_transaction.slice(0, transaction_content_len);
	const signature = Secp256k1.ecdsaSign(hexStrToUint8Arr(sha3_256(uint8ArrToHexStr(transaction_content))), sk).signature;
	backend_item_transaction.set(signature, transaction_content_len);
	start = performance.now();
	for (let i = 0; i < desired_threads; i++) {
		startMiningThreadIfNeeded([undefined, undefined], backend_item_transaction);
	}
}

export { generateAndMinePixelNFT, buyBackendItem, range, intToColor, findColorIndex, intToRgb, uint8ArrToHexStr };