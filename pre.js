/* global Module */
/* global self */
Module['print'] = function(s){console.debug(s)};
Module['printErr'] = function(s){console.warn(s)};
Module['noExitRuntime'] = true;
Module['postRun'] = function(){ self.postMessage("Ready.") };
