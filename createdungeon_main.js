/* global define */
(function(){
    "use strict";

    // preface ======================================================== {{{
    var api = {};
    var listener = [];
    var listener_id = 0;

    function add_listener(callback) {
        var id = ++listener_id;
        listener.push({
            id: id,
            fn: callback,
            obj: {
                id: id,
                destroy: function() {
                    remove_listener(id);
                }
            }
        });
        return id;
    }

    function remove_listener(id) {
        for (var i = 0; i < listener.length; i++) {
            if (id === listener[i].id) {
                listener.splice(i, 1);
                return;
            }
        }
    }

    function trigger_listener(data) {
        listener.forEach(function(listen) {
            listen.fn.call(listen.obj, data);
        });
    }
    // ---------------------------------------------------------------- }}}

    function Dungeon(data, uuid, design, seed) {  // {{{

        Object.defineProperties(this, {
            uuid: { enumerable: true, value: uuid },
            design: { enumerable: true, value: design },
            seed: { enumerable: true, value: seed },
            width: { enumerable: true, value: data[0] },
            height: { enumerable: true, value: data[1] },
            data: { value: data } });
    }

    api.Dungeon = Dungeon;

    Dungeon.prototype.get = function(x, y) {
        return this.data[(y*this.width) + x + 2];
    };

    Dungeon.prototype.set = function(x, y, val) {
        this.data[(y*this.width) + x + 2] = val;
        return val;
    };
    // }}}

    api.createDungeon = (function(){
        
        var worker, workerReady;
        
        return function(design, seed) {

            if (!worker) {
                worker = new Worker(api.createDungeon.workerUrl);
                workerReady = new Promise(function(resolve){

                    worker.addEventListener('message', function(e) {
                        if (e.data === 'Ready.') {
                            resolve();
                        } else {
                            trigger_listener(new Dungeon(e.data.data, e.data.uuid, e.data.design, e.data.seed));
                        }
                    }, false);
                });
            }

            var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
            });

            return new Promise(function(resolve){

                api.onCreateDungeon(function(dungeon){
                    if (dungeon.uuid === uuid) {
                        resolve(dungeon);
                        this.destroy();
                    }
                });

                if (typeof seed !== 'number') {
                    seed = (Math.random() * 10000000)|0;
                }

                workerReady.then(function(){
                    worker.postMessage({ design: design, seed: seed, uuid: uuid });
                });
            });
        };
    })();

    api.createDungeon.workerUrl = 'createdungeon_worker.js';

    api.onCreateDungeon = function(callback) {
        return add_listener(callback);
    };

    api.showDungeon = function(dungeon, element){
        if (!dungeon) return;
        if (!element) element = document.body;

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

        if (element !== false) {
            element.appendChild(canvas);
        }

        dungeon.canvas = canvas;

        return dungeon;
    };

    // define.amd or exports ======================================================== {{{
    if (typeof define === 'function' && define.amd) {
        define(function(){
            return api;
        }); 
    } else {
        var root = (typeof exports !== 'undefined' && null !== exports) ? exports : this;
        if (typeof root.dungeonmaker === 'undefined') {
            root.dungeonmaker = Object.create(null);
        }
        for (var key in api) {
            if (api.hasOwnProperty(key)) {
                root.dungeonmaker[key] = api[key];
            }
        }
    }
    // ------------------------------------------------------------------------------ }}}
}).call(this);
