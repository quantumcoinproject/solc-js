# @quantumcoin/solc

Solidity compiler for [QuantumCoin](https://quantumcoin.org) with 32-byte address support.

This package is a QuantumCoin adaptation of [ethereum/solc-js](https://github.com/ethereum/solc-js) (v0.7.6). The compiler itself (`soljson.js`, an Emscripten/WebAssembly build of the [QuantumCoin Solidity fork](https://github.com/quantumcoinproject/Solidity)) is embedded directly in the package, so installation requires no downloads, no network access, and no external tooling.

## Installation

```bash
npm install @quantumcoin/solc
```

## Usage

### Compiling (Standard JSON input/output)

```javascript
var solc = require('@quantumcoin/solc');

var input = {
  language: 'Solidity',
  sources: {
    'test.sol': {
      content: 'contract C { function f() public { } }'
    }
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['*']
      }
    }
  }
};

var output = JSON.parse(solc.compile(JSON.stringify(input)));

for (var contractName in output.contracts['test.sol']) {
  console.log(
    contractName + ': ' + output.contracts['test.sol'][contractName].evm.bytecode.object
  );
}
```

### Import callbacks

```javascript
function findImports(path) {
  if (path === 'lib.sol') {
    return { contents: 'library L { function f() internal returns (uint) { return 7; } }' };
  }
  return { error: 'File not found' };
}

var output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
```

### Linking libraries (32-byte addresses)

QuantumCoin uses 32-byte addresses. Unlinked bytecode contains 64-character placeholders of the form `__$<58 hex chars>$__`. Use the linker to insert library addresses after compilation:

```javascript
var linker = require('@quantumcoin/solc/linker.js');

var linkedBytecode = linker.linkBytecode(bytecode, {
  'lib.sol:L': '0x4200000000000000000000000000000000000000000000000000000000000001'
});

// Find remaining (unlinked) references:
var references = linker.findLinkReferences(bytecode);
```

Libraries can also be linked at compile time via `settings.libraries` in the Standard JSON input, using 32-byte addresses.

### Command-line interface

```bash
npx solcjs --bin --abi contract.sol

# Standard JSON mode
cat input.json | npx solcjs --standard-json

# Resolve imports relative to a base path
npx solcjs --bin --base-path . contract.sol
```

## Version

The embedded compiler reports:

```
0.7.6+commit.6da11747.mod.Emscripten.clang
```

built from [quantumcoinproject/Solidity v32b.8.12](https://github.com/quantumcoinproject/Solidity/releases/tag/v32b.8.12), which is based on upstream Solidity 0.7.6 with 32-byte address support.

## License and attribution

This package is derived from [ethereum/solc-js](https://github.com/ethereum/solc-js) v0.7.6, which is licensed under the [MIT license](LICENSE); the original license text and copyright are retained in this repository.

The embedded `soljson.js` binary is built from the [QuantumCoin Solidity fork](https://github.com/quantumcoinproject/Solidity), which (like upstream [Solidity](https://github.com/ethereum/solidity)) is licensed under GPL-3.0. This mirrors the licensing of the upstream `solc` npm package, which also ships GPL-licensed compiler binaries under an MIT-licensed JavaScript wrapper.
