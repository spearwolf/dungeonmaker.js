DIST=./dist

emcc -O2 -o index.html dungeonmaker/.libs/DungeonMaker.o createdungeon.cpp \
    -s EXPORTED_FUNCTIONS="['_createDungeon','_createDungeonData']" \
    --pre-js pre.js \
    --embed-file design \
    --embed-file design2 \
    --embed-file design3A \
    --embed-file design3WithTunnelers \
    --embed-file design4A \
    --embed-file design5 \
    --embed-file design6 \
    --embed-file design7 \
    --embed-file designEmpty \
    --embed-file designEmpty2 \
    --embed-file designOld1

cp index.js createdungeon.js
cat createdungeon.cwrap.js >>createdungeon.js

cp index.js createdungeon_worker.js
cat createdungeon_worker.cwrap.js >>createdungeon_worker.js

#### create dist/

mkdir -p $DIST

cp createdungeon_worker.html $DIST/index.html
cp index.html.mem $DIST/index.html.mem
cp createdungeon_worker.js $DIST/createdungeon_worker.js
cp createdungeon_main.js $DIST/createdungeon_main.js

