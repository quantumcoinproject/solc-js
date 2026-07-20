// Regression test for the QuantumSwap "CreatedToken" generation: compiles the
// user-deployable ERC20 that the QuantumSwap web app embeds (via its
// scripts/gen-created-token.mjs) and asserts this compiler keeps producing the
// expected artifacts. The key guard is 32-byte address semantics: upstream
// Ethereum solc masks every address to 160 bits, which silently corrupts
// QuantumCoin addresses, so the bytecode must never contain that mask.
const tape = require('tape');
const fs = require('fs');
const path = require('path');
const solc = require('../index.js');

const resources = path.join(__dirname, 'resources');
const source = fs.readFileSync(path.join(resources, 'CreatedToken.sol'), 'utf8');
const expectedAbi = JSON.parse(fs.readFileSync(path.join(resources, 'CreatedToken.expected.abi'), 'utf8'));
const expectedBin = fs.readFileSync(path.join(resources, 'CreatedToken.expected.bin'), 'utf8').trim();

// The trailing CBOR metadata blob ("a264 ipfs ...") encodes an IPFS hash of the
// compiler metadata JSON (exact build string, source name, source hash), so it
// legitimately varies across compiler rebuilds. Comparisons use the code
// section only.
const METADATA_MARKER = 'a2646970667358';

function codeSection (bin) {
  const at = bin.lastIndexOf(METADATA_MARKER);
  return at >= 0 ? bin.slice(0, at) : bin;
}

function compileCreatedToken () {
  const input = {
    language: 'Solidity',
    sources: {
      'CreatedToken.sol': { content: source }
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': [ 'abi', 'evm.bytecode.object' ]
        }
      }
    }
  };
  return JSON.parse(solc.compile(JSON.stringify(input)));
}

tape('CreatedToken generation (QuantumSwap web app)', function (t) {
  const output = compileCreatedToken();
  const contract = output.contracts &&
    output.contracts['CreatedToken.sol'] &&
    output.contracts['CreatedToken.sol']['CreatedToken'];

  t.test('compiles without errors', function (st) {
    const errors = (output.errors || []).filter(function (e) { return e.severity === 'error'; });
    st.deepEqual(errors, []);
    st.ok(contract, 'CreatedToken present in output');
    st.end();
  });

  t.test('ABI matches the embedded artifact', function (st) {
    st.deepEqual(contract.abi, expectedAbi);
    st.end();
  });

  t.test('bytecode is clean, even-length hex', function (st) {
    // The same checks the web app's gen-created-token.mjs enforces: the wallet
    // rejects deploy payloads whose hex has an odd length.
    const bin = contract.evm.bytecode.object;
    st.ok(/^[0-9a-fA-F]+$/.test(bin), 'clean hex');
    st.equal(bin.length % 2, 0, 'even length');
    st.end();
  });

  t.test('bytecode keeps 32-byte address semantics (no 160-bit mask)', function (st) {
    // 6001600160a01b03 pushes the 2^160-1 mask upstream solc applies to every
    // address; its presence means an upstream-Ethereum soljson build slipped in.
    const bin = contract.evm.bytecode.object;
    st.equal(bin.indexOf('6001600160a01b03'), -1);
    st.end();
  });

  t.test('code section matches the expected artifact', function (st) {
    const bin = contract.evm.bytecode.object;
    st.equal(codeSection(bin), codeSection(expectedBin));
    st.end();
  });
});
