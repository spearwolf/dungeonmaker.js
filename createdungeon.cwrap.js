/* global Module */
var createDungeon = (function(){
    var _createDungeon = Module.cwrap('createDungeonData', '[number]', ['string', 'number']);
    return function(design, seed) {
        if (typeof seed !== 'number') {
            seed = (Math.random() * 10000000)|0;
        }
        var ptr = _createDungeon(design, seed);
        var size = Module.HEAP32.subarray((ptr>>2), (ptr>>2)+2);
        var width = size[0];
        var height = size[1];
        var dungeon = {};
        Object.defineProperty(dungeon, 'width', { enumerable: true, value: width });
        Object.defineProperty(dungeon, 'height', { enumerable: true, value: height });
        Object.defineProperty(dungeon, 'data', {
            value: new Int32Array(Module.HEAP32.subarray((ptr>>2), (ptr>>2)+(width*height)+2))
        });
        dungeon.get = function(x, y) {
            return dungeon.data[(y*width) + x + 2];
        };
        dungeon.set = function(x, y, val) {
            dungeon.data[(y*width) + x + 2] = val;
            return val;
        };
        return dungeon;
    };
})();
var showDungeon = function(dungeon){
    if (!dungeon) return;

    var PIXEL_ZOOM = 2;
    var COLOR = [
                          "#0000ff",
        /* OPEN */        "#f0f0f0",
        /* CLOSED */      "#303030",
        /* G_CLOSED */    "#303030",     // GUARANTEED-OPEN AND GUARANTEED-CLOSED
        /* G_OPEN */      "#f0f0f0",
        /* NJ_OPEN */     "#f0f0f0",     // NV = non-join, these cannot be joined br Builders
        /* NJ_G_OPEN */   "#f0f0f0",     //   with others of their own kind
        /* NJ_CLOSED */   "#303030",
        /* NJ_G_CLOSED */ "#303030",
        /* IR_OPEN */     "#f0f0f0",     // inside-room, open
        /* IT_OPEN */     "#e8e8e8",     // inside-tunnel, open
        /* IA_OPEN */     "#e0e0e0",     // inside anteroom, open
        /* H_DOOR */      "#a04000",     // horizontal door
        /* V_DOOR */      "#a04000",     // vertical door
        /* MOB1 */        "#ff0040",     // MOBs of different level - higher is better
        /* MOB2 */        "#f00030",
        /* MOB3 */        "#e00020",
        /* TREAS1 */      "#ffff00",     // treasure of different level
        /* TREAS2 */      "#f0f000",
        /* TREAS3 */      "#e0e000",
        /* COLUMN */      "#00ff00"
    ];

    var canvas = document.createElement('canvas');
    var dpr = window.devicePixelRatio || 1;
    var pixelSize = dpr * PIXEL_ZOOM;
    canvas.width = pixelSize * dungeon.width;
    canvas.height = pixelSize * dungeon.height;
    canvas.style.width = (dungeon.width * PIXEL_ZOOM) + "px";
    canvas.style.height = (dungeon.height * PIXEL_ZOOM) + "px";

    var ctx = canvas.getContext('2d');
    var x, y, val;
    for (y= 0; y < dungeon.height; y++) {
        for (x= 0; x < dungeon.width; x++) {
            val = dungeon.get(x, y);
            ctx.fillStyle = COLOR[val+1];
            ctx.fillRect(x*pixelSize, y*pixelSize, pixelSize, pixelSize);
        }
    }

    document.body.appendChild(canvas);
    return dungeon;
};
