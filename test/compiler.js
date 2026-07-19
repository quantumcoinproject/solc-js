const tape = require('tape');
const solc = require('../index.js');
const linker = require('../linker.js');

const libraryAddress = '0x4200000000000000000000000000000000000000000000000000000000000001';

function getBytecodeStandard (output, fileName, contractName) {
  try {
    return output.contracts[fileName][contractName]['evm']['bytecode']['object'];
  } catch (e) {
    return '';
  }
}

function getGasEstimate (output, fileName, contractName) {
  try {
    return output.contracts[fileName][contractName]['evm']['gasEstimates'];
  } catch (e) {
    return '';
  }
}

function expectError (output, errorType, message) {
  if (output.errors) {
    for (var error in output.errors) {
      error = output.errors[error];
      if (error.type === errorType) {
        if (message) {
          if (error.message.match(message) !== null) {
            return true;
          }
        } else {
          return true;
        }
      }
    }
  }
  return false;
}

function expectNoError (output) {
  if (output.errors) {
    for (var error in output.errors) {
      error = output.errors[error];
      if (error.severity === 'error') {
        return false;
      }
    }
  }
  return true;
}

tape('Version and license', function (t) {
  t.test('check version', function (st) {
    st.equal(typeof solc.version(), 'string');
    st.end();
  });
  t.test('check semver', function (st) {
    st.equal(typeof solc.semver(), 'string');
    st.end();
  });
  t.test('check license', function (st) {
    st.ok(typeof solc.license() === 'undefined' || typeof solc.license() === 'string');
    st.end();
  });
});

tape('Compilation', function (t) {
  t.test('compiling standard JSON (single file)', function (st) {
    var input = {
      'language': 'Solidity',
      'settings': {
        'outputSelection': {
          '*': {
            '*': [ 'evm.bytecode', 'evm.gasEstimates' ]
          }
        }
      },
      'sources': {
        'c.sol': {
          'content': 'contract C { function g() public { } function h() internal {} }'
        }
      }
    };

    var output = JSON.parse(solc.compile(JSON.stringify(input)));
    st.ok(expectNoError(output));
    var C = getBytecodeStandard(output, 'c.sol', 'C');
    st.ok(typeof C === 'string');
    st.ok(C.length > 0);
    var CGas = getGasEstimate(output, 'c.sol', 'C');
    st.ok(typeof CGas === 'object');
    st.ok(typeof CGas['creation'] === 'object');
    st.ok(typeof CGas['creation']['codeDepositCost'] === 'string');
    st.ok(typeof CGas['external'] === 'object');
    st.ok(typeof CGas['external']['g()'] === 'string');
    st.ok(typeof CGas['internal'] === 'object');
    st.ok(typeof CGas['internal']['h()'] === 'string');
    st.end();
  });

  t.test('compiling standard JSON (multiple files)', function (st) {
    var input = {
      'language': 'Solidity',
      'settings': {
        'outputSelection': {
          '*': {
            '*': [ 'evm.bytecode', 'evm.gasEstimates' ]
          }
        }
      },
      'sources': {
        'a.sol': {
          'content': 'contract A { function f() public returns (uint) { return 7; } }'
        },
        'b.sol': {
          'content': 'import "a.sol"; contract B is A { function g() public { f(); } function h() internal {} }'
        }
      }
    };

    var output = JSON.parse(solc.compile(JSON.stringify(input)));
    st.ok(expectNoError(output));
    var B = getBytecodeStandard(output, 'b.sol', 'B');
    st.ok(typeof B === 'string');
    st.ok(B.length > 0);
    st.ok(Object.keys(linker.findLinkReferences(B)).length === 0);
    var A = getBytecodeStandard(output, 'a.sol', 'A');
    st.ok(typeof A === 'string');
    st.ok(A.length > 0);
    st.end();
  });

  t.test('compiling standard JSON (with imports)', function (st) {
    var input = {
      'language': 'Solidity',
      'settings': {
        'outputSelection': {
          '*': {
            '*': [ 'evm.bytecode' ]
          }
        }
      },
      'sources': {
        'b.sol': {
          'content': 'import "a.sol"; contract B is A { function g() public { f(); } }'
        }
      }
    };

    function findImports (path) {
      if (path === 'a.sol') {
        return { contents: 'contract A { function f() public returns (uint) { return 7; } }' };
      } else {
        return { error: 'File not found' };
      }
    }

    var output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
    st.ok(expectNoError(output));
    var A = getBytecodeStandard(output, 'a.sol', 'A');
    st.ok(typeof A === 'string');
    st.ok(A.length > 0);
    var B = getBytecodeStandard(output, 'b.sol', 'B');
    st.ok(typeof B === 'string');
    st.ok(B.length > 0);
    st.ok(Object.keys(linker.findLinkReferences(B)).length === 0);
    st.end();
  });

  t.test('compiling standard JSON (using libraries with 32-byte addresses)', function (st) {
    var input = {
      'language': 'Solidity',
      'settings': {
        'libraries': {
          'lib.sol': {
            'L': libraryAddress
          }
        },
        'outputSelection': {
          '*': {
            '*': [ 'evm.bytecode' ]
          }
        }
      },
      'sources': {
        'lib.sol': {
          'content': 'library L { function f() public returns (uint) { return 7; } }'
        },
        'a.sol': {
          'content': 'import "lib.sol"; contract A { function g() public { L.f(); } }'
        }
      }
    };

    var output = JSON.parse(solc.compile(JSON.stringify(input)));
    st.ok(expectNoError(output));
    var A = getBytecodeStandard(output, 'a.sol', 'A');
    st.ok(typeof A === 'string');
    st.ok(A.length > 0);
    st.ok(Object.keys(linker.findLinkReferences(A)).length === 0);
    st.ok(A.indexOf(libraryAddress.slice(2)) >= 0);
    var L = getBytecodeStandard(output, 'lib.sol', 'L');
    st.ok(typeof L === 'string');
    st.ok(L.length > 0);
    st.end();
  });

  t.test('linking compiler output with linkBytecode (32-byte addresses)', function (st) {
    var input = {
      'language': 'Solidity',
      'settings': {
        'outputSelection': {
          '*': {
            '*': [ 'evm.bytecode' ]
          }
        }
      },
      'sources': {
        'lib.sol': {
          'content': 'library L { function f() public returns (uint) { return 7; } }'
        },
        'a.sol': {
          'content': 'import "lib.sol"; contract A { function g() public { L.f(); } }'
        }
      }
    };

    var output = JSON.parse(solc.compile(JSON.stringify(input)));
    st.ok(expectNoError(output));
    var bytecode = output.contracts['a.sol']['A'].evm.bytecode;
    var A = bytecode.object;
    st.ok(A.length > 0);

    // The compiler must report a 32-byte link reference...
    st.ok(bytecode.linkReferences['lib.sol']['L'].length > 0);
    st.equal(bytecode.linkReferences['lib.sol']['L'][0].length, 32);

    // ...which findLinkReferences must also locate...
    var foundRefs = linker.findLinkReferences(A);
    var refName = Object.keys(foundRefs)[0];
    st.equal(foundRefs[refName][0].length, 32);
    st.equal(foundRefs[refName][0].start, bytecode.linkReferences['lib.sol']['L'][0].start);

    // ...and linkBytecode must fully resolve.
    var linked = linker.linkBytecode(A, { 'lib.sol': { 'L': libraryAddress } });
    st.ok(linked.indexOf('_') < 0);
    st.ok(linked.indexOf(libraryAddress.slice(2)) >= 0);
    st.end();
  });

  t.test('compiling standard JSON (with warning >=0.4.0)', function (st) {
    var input = {
      'language': 'Solidity',
      'settings': {
        'outputSelection': {
          '*': {
            '*': [ 'evm.bytecode' ]
          }
        }
      },
      'sources': {
        'c.sol': {
          'content': 'contract C { function f() public { } }'
        }
      }
    };

    var output = JSON.parse(solc.compile(JSON.stringify(input)));
    st.ok(expectError(output, 'Warning', 'Source file does not specify required compiler version!'));
    st.end();
  });

  t.test('invalid source code fails properly', function (st) {
    var input = {
      'language': 'Solidity',
      'settings': {
        'outputSelection': {
          '*': {
            '*': [ 'evm.bytecode' ]
          }
        }
      },
      'sources': {
        'x.sol': {
          'content': 'contract x { this is an invalid contract }'
        }
      }
    };
    var output = JSON.parse(solc.compile(JSON.stringify(input)));
    st.ok('errors' in output);
    st.ok(output.errors.length >= 1);
    var hasParserError = false;
    for (var error in output.errors) {
      if (output.errors[error].type === 'ParserError') {
        hasParserError = true;
      }
    }
    st.ok(hasParserError);
    st.end();
  });

  t.test('compiling standard JSON (invalid JSON)', function (st) {
    var output = JSON.parse(solc.compile('{invalid'));
    st.ok(expectError(output, 'JSONError'));
    st.end();
  });

  t.test('compiling standard JSON (invalid language)', function (st) {
    var output = JSON.parse(solc.compile('{"language":"InvalidSolidity","sources":{"cont.sol":{"content":""}}}'));
    st.ok(expectError(output, 'JSONError', 'supported as a language.') && expectError(output, 'JSONError', '"Solidity"'));
    st.end();
  });

  t.test('compiling standard JSON (no sources)', function (st) {
    var output = JSON.parse(solc.compile('{"language":"Solidity"}'));
    st.ok(expectError(output, 'JSONError', 'No input sources specified.'));
    st.end();
  });
});
