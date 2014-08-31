/* global Module */
/* global self */
var createDungeon = (function(){
    var _createDungeon = Module.cwrap('createDungeonData', '[number]', ['string', 'number']);
    return function(design, seed) {
        if (typeof seed !== 'number') {
            seed = (Math.random() * 10000000)|0;
        }
        //console.log('_createDungeon(', design, seed, ')');
        var ptr = _createDungeon(design, seed);
        var size = Module.HEAP32.subarray((ptr>>2), (ptr>>2)+2);
        var width = size[0];
        var height = size[1];
        return Module.HEAP32.subarray((ptr>>2), (ptr>>2)+(width*height)+2);
    };
})();
self.addEventListener('message', function(e) {
    var design = e.data.design;
    var seed = e.data.seed;
    self.postMessage({
        uuid: e.data.uuid,
        seed: seed,
        design: design,
        data: createDungeon(design, seed) });
}, false);
