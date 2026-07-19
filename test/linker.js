const tape = require('tape');
const keccak256 = require('js-sha3').keccak256;
const linker = require('../linker.js');

// Build a 64-character placeholder label the same way the QuantumCoin
// compiler emits them for unlinked libraries (old-style name label).
function nameLabel (name) {
  var truncated = name.slice(0, 60);
  return '__' + truncated + Array(61 - truncated.length).join('_') + '__';
}

// New-style hashed placeholder: __$<58 hex chars of keccak256(name)>$__
function hashLabel (name) {
  return '__$' + keccak256(name).slice(0, 58) + '$__';
}

const addressL = '0x4200000000000000000000000000000000000000000000000000000000000001';

tape('Link references', function (t) {
  t.test('Empty bytecode', function (st) {
    st.deepEqual(linker.findLinkReferences(''), {});
    st.end();
  });

  t.test('No references', function (st) {
    st.deepEqual(linker.findLinkReferences('6060604052341561000f57600080fd'), {});
    st.end();
  });

  t.test('One reference', function (st) {
    var bytecode = '6060604052341561000f57600080fd5b73' + nameLabel('lib2.sol:L') + '6326121ff0';
    st.deepEqual(linker.findLinkReferences(bytecode), { 'lib2.sol:L': [ { start: 17, length: 32 } ] });
    st.end();
  });

  t.test('Two references', function (st) {
    var bytecode = '6060604052341561000f57600080fd5b73' + nameLabel('lib2.sol:L') + '6326121ff073' + nameLabel('linkref.sol:Lx') + '6326121ff0';
    st.deepEqual(
      linker.findLinkReferences(bytecode),
      { 'lib2.sol:L': [ { start: 17, length: 32 } ], 'linkref.sol:Lx': [ { start: 55, length: 32 } ] }
    );
    st.end();
  });

  t.test('Library name with leading underscore', function (st) {
    var bytecode = '6060604052341561000f57600080fd5b73' + nameLabel('lib2.sol:_L') + '6326121ff0';
    st.deepEqual(
      linker.findLinkReferences(bytecode),
      { 'lib2.sol:_L': [ { start: 17, length: 32 } ] }
    );
    st.end();
  });

  t.test('Library name with underscore in the name', function (st) {
    var bytecode = '6060604052341561000f57600080fd5b73' + nameLabel('lib2.sol:L_L') + '6326121ff0';
    st.deepEqual(
      linker.findLinkReferences(bytecode),
      { 'lib2.sol:L_L': [ { start: 17, length: 32 } ] }
    );
    st.end();
  });

  t.test('Invalid input (too short)', function (st) {
    var bytecode = '6060604052341561000____66606060606060';
    st.deepEqual(
      linker.findLinkReferences(bytecode),
      {}
    );
    st.end();
  });

  t.test('Invalid input (1 byte short)', function (st) {
    var bytecode = '6060604052341561000' + nameLabel('lib2.sol:L').slice(0, 62) + '66606060606060';
    st.deepEqual(
      linker.findLinkReferences(bytecode),
      {}
    );
    st.end();
  });

  t.test('Two references with same library name', function (st) {
    var bytecode = '6060604052341561000f57600080fd5b73' + nameLabel('lib2.sol:L') + '6326121ff073' + nameLabel('lib2.sol:L') + '6326121ff0';
    st.deepEqual(
      linker.findLinkReferences(bytecode),
      { 'lib2.sol:L': [ { start: 17, length: 32 }, { start: 55, length: 32 } ] }
    );
    st.end();
  });
});

tape('Linking', function (t) {
  t.test('link properly (name placeholder)', function (st) {
    var bytecode = '6060604052341561000f57600080fd5b73' + nameLabel('lib.sol:L') + '6326121ff0';
    bytecode = linker.linkBytecode(bytecode, { 'lib.sol:L': addressL });
    st.ok(bytecode.indexOf('_') < 0);
    st.ok(bytecode.indexOf(addressL.slice(2)) >= 0);
    st.end();
  });

  t.test('link properly (hashed placeholder)', function (st) {
    var bytecode = '6060604052341561000f57600080fd5b73' + hashLabel('lib.sol:L') + '6326121ff0';
    bytecode = linker.linkBytecode(bytecode, { 'lib.sol:L': addressL });
    st.ok(bytecode.indexOf('_') < 0);
    st.ok(bytecode.indexOf(addressL.slice(2)) >= 0);
    st.end();
  });

  t.test('link properly with two-level configuration (from standard JSON)', function (st) {
    var bytecode = '6060604052341561000f57600080fd5b73' + nameLabel('lib.sol:L') + '6326121ff0';
    bytecode = linker.linkBytecode(bytecode, { 'lib.sol': { 'L': addressL } });
    st.ok(bytecode.indexOf('_') < 0);
    st.end();
  });

  t.test('short address is left-padded to 32 bytes', function (st) {
    var bytecode = '73' + hashLabel('lib2.sol:L') + '66';
    bytecode = linker.linkBytecode(bytecode, { 'lib2.sol:L': '0x123456' });
    st.equal(bytecode, '73' + Array(59).join('0') + '123456' + '66');
    st.end();
  });

  t.test('linker to fail with missing library', function (st) {
    var bytecode = '6060604052341561000f57600080fd5b73' + nameLabel('lib.sol:L') + '6326121ff0';
    bytecode = linker.linkBytecode(bytecode, { });
    st.ok(bytecode.indexOf('_') >= 0);
    st.end();
  });

  t.test('linker to fail with invalid address', function (st) {
    var bytecode = '6060604052341561000f57600080fd5b73' + nameLabel('lib.sol:L') + '6326121ff0';
    st.throws(function () {
      linker.linkBytecode(bytecode, { 'lib.sol:L': '' });
    });
    st.throws(function () {
      // 33 bytes is too long
      linker.linkBytecode(bytecode, { 'lib.sol:L': '0x' + Array(67).join('1') });
    });
    st.end();
  });

  t.test('linker properly with truncated library name', function (st) {
    var longName = 'lib.sol:L12345678901234567890123456789012345678901234567890123456789012345';
    var bytecode = '6060604052341561000f57600080fd5b73' + nameLabel(longName) + '6326121ff0';
    bytecode = linker.linkBytecode(bytecode, (function () { var l = {}; l[longName] = addressL; return l; })());
    st.ok(bytecode.indexOf('_') < 0);
    st.end();
  });

  t.test('link properly when library doesn\'t have colon in name', function (st) {
    var bytecode = '6060604052341561000f57600080fd5b73' + nameLabel('libName') + '6326121ff0';
    bytecode = linker.linkBytecode(bytecode, { 'libName': addressL });
    st.ok(bytecode.indexOf('_') < 0);
    st.end();
  });
});
