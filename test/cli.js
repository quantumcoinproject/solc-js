const tape = require('tape');
const path = require('path');
const spawnSync = require('child_process').spawnSync;
const pkg = require('../package.json');

const solcjsPath = path.resolve(__dirname, '..', 'solcjs');

function runCli (args, stdin) {
  return spawnSync(process.execPath, [solcjsPath].concat(args), {
    input: stdin,
    encoding: 'utf8',
    cwd: path.resolve(__dirname, '..')
  });
}

tape('CLI', function (t) {
  t.test('--version', function (st) {
    var result = runCli(['--version']);
    st.equal(result.status, 0);
    st.ok(result.stdout.indexOf(pkg.version) >= 0);
    st.end();
  });

  t.test('no parameters', function (st) {
    var result = runCli([]);
    st.notEqual(result.status, 0);
    st.ok(/Must provide a file/.test(result.stderr));
    st.end();
  });

  t.test('no mode specified', function (st) {
    var result = runCli(['test/resources/fixtureSmoke.sol']);
    st.notEqual(result.status, 0);
    st.ok(/Invalid option selected/.test(result.stderr));
    st.end();
  });

  t.test('--bin', function (st) {
    var result = runCli(['--bin', 'test/resources/fixtureSmoke.sol']);
    st.equal(result.status, 0);
    st.equal(result.stderr, '');
    st.end();
  });

  t.test('--bin --optimize', function (st) {
    var result = runCli(['--bin', '--optimize', 'test/resources/fixtureSmoke.sol']);
    st.equal(result.status, 0);
    st.equal(result.stderr, '');
    st.end();
  });

  t.test('invalid file specified', function (st) {
    var result = runCli(['--bin', 'test/fileNotFound.sol']);
    st.notEqual(result.status, 0);
    st.ok(/Error reading /.test(result.stderr));
    st.end();
  });

  t.test('incorrect source source', function (st) {
    var result = runCli(['--bin', 'test/resources/fixtureIncorrectSource.sol']);
    st.notEqual(result.status, 0);
    st.ok(/SyntaxError: Invalid pragma "contract"/.test(result.stderr));
    st.end();
  });

  t.test('--abi', function (st) {
    var result = runCli(['--abi', 'test/resources/fixtureSmoke.sol']);
    st.equal(result.status, 0);
    st.equal(result.stderr, '');
    st.end();
  });

  t.test('--bin --abi', function (st) {
    var result = runCli(['--bin', '--abi', 'test/resources/fixtureSmoke.sol']);
    st.equal(result.status, 0);
    st.equal(result.stderr, '');
    st.end();
  });

  t.test('no-base-path', function (st) {
    var result = runCli(['--bin', 'test/resources/importA.sol']);
    st.notEqual(result.status, 0);
    st.ok(/not found: File import callback not supported/.test(result.stderr));
    st.end();
  });

  t.test('base-path', function (st) {
    var result = runCli(['--bin', '--base-path', 'test/resources', 'test/resources/importA.sol']);
    st.equal(result.status, 0);
    st.equal(result.stderr, '');
    st.end();
  });

  t.test('standard json', function (st) {
    var input = {
      'language': 'Solidity',
      'settings': {
        'outputSelection': {
          '*': {
            '*': [ 'evm.bytecode', 'userdoc' ]
          }
        }
      },
      'sources': {
        'Contract.sol': {
          'content': 'pragma solidity >=0.5.0; contract Contract { function f() pure public {} }'
        }
      }
    };
    var result = runCli(['--standard-json'], JSON.stringify(input));
    st.equal(result.status, 0);
    st.ok(/Contract.sol/.test(result.stdout));
    st.ok(/userdoc/.test(result.stdout));
    st.end();
  });

  t.test('standard json base path', function (st) {
    var input = {
      'language': 'Solidity',
      'settings': {
        'outputSelection': {
          '*': {
            '*': [ 'metadata' ]
          }
        }
      },
      'sources': {
        'importA.sol': {
          'content': 'import "./importB.sol";'
        }
      }
    };
    var result = runCli(['--standard-json', '--base-path', 'test/resources'], JSON.stringify(input));
    st.equal(result.status, 0);
    st.ok(/{"contracts":{"importB.sol":{"D":{"metadata":/.test(result.stdout));
    st.end();
  });
});
