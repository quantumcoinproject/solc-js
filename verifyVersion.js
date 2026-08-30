#!/usr/bin/env node

var semver = require('semver');

var pkg = require('./package.json');
var packageVersion = pkg.version;
var solcVersion = require('./index.js').version();

console.log('solcVersion: ' + solcVersion);
console.log('packageVersion: ' + packageVersion);
console.log('solidityRelease: ' + (pkg.solidityRelease || '(not set)'));

// Compare only major.minor. The embedded compiler stays on the 0.7.x line
// (upstream Solidity 0.7.6 + QuantumCoin 32-byte addresses) while the package
// patch number advances for compiler rebuilds and wrapper-only changes, so
// e.g. package 0.7.7 legitimately ships a compiler that reports 0.7.6.
var solcBase = semver.coerce(solcVersion);
var packageBase = semver.coerce(packageVersion);

// NOTE: use process.exitCode instead of process.exit(). Calling process.exit()
// right after loading the Emscripten module crashes Node on Windows with
// "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" while libuv tears
// down the module's pending async handles.
if (solcBase !== null && packageBase !== null &&
    solcBase.major === packageBase.major && solcBase.minor === packageBase.minor) {
  console.log('Version matching');
  process.exitCode = 0;
} else {
  console.log('Version mismatch');
  process.exitCode = 1;
}
