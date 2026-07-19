#!/usr/bin/env node

var semver = require('semver');

var packageVersion = require('./package.json').version;
var solcVersion = require('./index.js').version();

console.log('solcVersion: ' + solcVersion);
console.log('packageVersion: ' + packageVersion);

// Compare only the base major.minor.patch, so the package can carry
// pre-release/build suffixes (e.g. 0.7.6-qc.1) for wrapper-only changes.
var solcBase = semver.coerce(solcVersion);
var packageBase = semver.coerce(packageVersion);

if (solcBase !== null && packageBase !== null && semver.eq(packageBase, solcBase)) {
  console.log('Version matching');
  process.exit(0);
} else {
  console.log('Version mismatch');
  process.exit(1);
}
