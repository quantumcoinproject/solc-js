var assert = require('assert');
var keccak256 = require('js-sha3').keccak256;

// QuantumCoin uses 32-byte addresses. A library placeholder occupies the
// full 32 bytes (64 hex characters) in the bytecode:
//   __$<58 hex chars of keccak256(fully qualified library name)>$__
function libraryHashPlaceholder (input) {
  return '$' + keccak256(input).slice(0, 58) + '$';
}

var linkBytecode = function (bytecode, libraries) {
  assert(typeof bytecode === 'string');
  assert(typeof libraries === 'object');
  // NOTE: for backwards compatibility support old compiler which didn't use file names
  var librariesComplete = {};
  for (var libraryName in libraries) {
    if (typeof libraries[libraryName] === 'object') {
      // API compatible with the standard JSON i/o
      for (var lib in libraries[libraryName]) {
        librariesComplete[lib] = libraries[libraryName][lib];
        librariesComplete[libraryName + ':' + lib] = libraries[libraryName][lib];
      }
    } else {
      // backwards compatible API for early solc-js versions
      var parsed = libraryName.match(/^([^:]+):(.+)$/);
      if (parsed) {
        librariesComplete[parsed[2]] = libraries[libraryName];
      }
      librariesComplete[libraryName] = libraries[libraryName];
    }
  }

  for (libraryName in librariesComplete) {
    var hexAddress = librariesComplete[libraryName];
    // 32-byte address: '0x' followed by up to 64 hex characters
    if (hexAddress.slice(0, 2) !== '0x' || hexAddress.length > 66) {
      throw new Error('Invalid address specified for ' + libraryName);
    }
    // remove 0x prefix and left-pad to 64 hex characters
    hexAddress = hexAddress.slice(2);
    hexAddress = Array(64 - hexAddress.length + 1).join('0') + hexAddress;

    // Support old (library name) and new (hash of library name)
    // placeholders.
    var replace = function (name) {
      // truncate to 60 characters
      var truncatedName = name.slice(0, 60);
      var libLabel = '__' + truncatedName + Array(61 - truncatedName.length).join('_') + '__';
      while (bytecode.indexOf(libLabel) >= 0) {
        bytecode = bytecode.replace(libLabel, hexAddress);
      }
    };

    replace(libraryName);
    replace(libraryHashPlaceholder(libraryName));
  }

  return bytecode;
};

var findLinkReferences = function (bytecode) {
  assert(typeof bytecode === 'string');
  // find 64 bytes in the pattern of __...<60 chars>...__
  // e.g. __Lib.sol:L_____________________________________________________
  var linkReferences = {};
  var offset = 0;
  while (true) {
    var found = bytecode.match(/__(.{60})__/);
    if (!found) {
      break;
    }

    var start = found.index;
    // trim trailing underscores
    // NOTE: this has no way of knowing if the trailing underscore was part of the name
    var libraryName = found[1].replace(/_+$/gm, '');

    if (!linkReferences[libraryName]) {
      linkReferences[libraryName] = [];
    }

    linkReferences[libraryName].push({
      // offsets are in bytes in binary representation (and not hex)
      start: (offset + start) / 2,
      length: 32
    });

    offset += start + 64;

    bytecode = bytecode.slice(start + 64);
  }
  return linkReferences;
};

module.exports = {
  linkBytecode: linkBytecode,
  findLinkReferences: findLinkReferences
};
