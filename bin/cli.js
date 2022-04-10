
'use strict';

var verbose = process.argv.indexOf('--verbose') !== -1;
var insane = process.argv.indexOf('--insane') !== -1;

if (verbose || insane)
    process.env.GH_VERBOSE = true;

if (insane)
    process.env.GH_VERBOSE_INSANE = true;

require('../cli/cmd.js').run();