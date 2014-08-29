/* createdungeon
 * =============
 *
 * DEPENDENCIES
 *   dungeonmaker 2.05+   ( http://dungeonmaker.sourceforge.net )
 *
 * COMPILE WITH
 *   g++ -o createdungeon createdungeon.cpp -lDungeonMaker
 *
 * CREATED AT
 *   9. Apr 2009
 *
 * AUTHOR
 *   wolfger@spearwolf.de
 */

#include <iostream>
#include <sstream>
#include <cstdio>
//#include <cstdlib>
#include "./dungeonmaker/DungeonMaker.h"

using namespace std;
using namespace alifegames;

char toChar(SquareData sd)  // {{{
{
    char c;
    switch (sd) {
        case OPEN:          c = ' '; break;
        case CLOSED:        c = '#'; break;
        case G_CLOSED:      c = '#'; break;     // GUARANTEED-OPEN AND GUARANTEED-CLOSED
        case G_OPEN:        c = ' '; break;
        case NJ_OPEN:       c = '.'; break;     // NV = non-join, these cannot be joined br Builders
        case NJ_G_OPEN:     c = '_'; break;     //   with others of their own kind
        case NJ_CLOSED:     c = 'x'; break;
        case NJ_G_CLOSED:   c = 'X'; break;
        case IR_OPEN:       c = '\''; break;    // inside-room, open
        case IT_OPEN:       c = ','; break;     // inside-tunnel, open
        case IA_OPEN:       c = '^'; break;     // inside anteroom, open
        case H_DOOR:        c = '='; break;     // horizontal door
        case V_DOOR:        c = '|'; break;     // vertical door
        case MOB1:          c = '1'; break;     // MOBs of different level - higher is better
        case MOB2:          c = '2'; break;
        case MOB3:          c = '3'; break;
        case TREAS1:        c = '4'; break;     // treasure of different level
        case TREAS2:        c = '5'; break;
        case TREAS3:        c = '6'; break;
        case COLUMN:        c = '@'; break;
        default:            c = '?';
    }
    return c;
}
// }}}
int toInt(SquareData sd)  // {{{
{
    int i;
    switch (sd) {
        case OPEN:          i =  0; break;
        case CLOSED:        i =  1; break;
        case G_CLOSED:      i =  2; break;     // GUARANTEED-OPEN AND GUARANTEED-CLOSED
        case G_OPEN:        i =  3; break;
        case NJ_OPEN:       i =  4; break;     // NV = non-join, these cannot be joined br Builders
        case NJ_G_OPEN:     i =  5; break;     //   with others of their own kind
        case NJ_CLOSED:     i =  6; break;
        case NJ_G_CLOSED:   i =  7; break;
        case IR_OPEN:       i =  8; break;    // inside-room, open
        case IT_OPEN:       i =  9; break;     // inside-tunnel, open
        case IA_OPEN:       i = 10; break;     // inside anteroom, open
        case H_DOOR:        i = 11; break;     // horizontal door
        case V_DOOR:        i = 12; break;     // vertical door
        case MOB1:          i = 13; break;     // MOBs of different level - higher is better
        case MOB2:          i = 14; break;
        case MOB3:          i = 15; break;
        case TREAS1:        i = 16; break;     // treasure of different level
        case TREAS2:        i = 17; break;
        case TREAS3:        i = 18; break;
        case COLUMN:        i = 19; break;
        default:            i = -1;
    }
    return i;
}
// }}}
void printMapToStdout(DungeonMaker* theDungeonMaker)  // {{{
{
    for (int x = 0; x < theDungeonMaker->GetDimX() ; ++x) {
        ostringstream row;
        for (int y = 0; y < theDungeonMaker->GetDimY() ; ++y) {
            row << toChar(theDungeonMaker->GetMap(x, y));
        }
        cout << row.str() << endl;
    }
}
// }}}
const char* convertMapToString(DungeonMaker* theDungeonMaker)  // {{{
{
    ostringstream out;
    for (int x = 0; x < theDungeonMaker->GetDimX() ; ++x) {
        for (int y = 0; y < theDungeonMaker->GetDimY() ; ++y) {
            out << toChar(theDungeonMaker->GetMap(x, y));
        }
        out << endl;
    }
    return out.str().c_str();
}
// }}}
void convertMapToDataArray(DungeonMaker* theDungeonMaker, int* arr)  // {{{
{
    int width = theDungeonMaker->GetDimX();
    int height = theDungeonMaker->GetDimY();

    arr[0] = width;
    arr[1] = height;

    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            arr[2 + (y*width) + x] = toInt(theDungeonMaker->GetMap(x, y));
        }
    }
}
// }}}
const char* convertMapToJsonStr(DungeonMaker* theDungeonMaker)  // {{{
{
    ostringstream out;
    char buf_w[128];
    //char buf_h[128];

    int width = theDungeonMaker->GetDimX();
    int height = theDungeonMaker->GetDimY();

    //if (height < 0 || height > 10000) {
        //height = width;
    //}

    out << "{\"width\":";
    std::snprintf(buf_w, 128, "%i", width);
    out << buf_w;
    //cout << "W" << width << ", " << buf_w << endl;
    //out << "," << endl << "\"height\":";
    //std::snprintf(buf_h, 128, "%i", height);
    //out << buf_h;
    //cout << "H" << height << ", " << buf_h << endl;
    out << "," << endl << "\"data\":[" << endl;

    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            out << toInt(theDungeonMaker->GetMap(x, y));
            if (x == width - 1 && y == height - 1) {
                out << "]}";
            } else {
                out << ",";
            }
            out << endl;
        }
    }
    out << endl;

    //cout << out.str().c_str() << endl;

    return out.str().c_str();
}
// }}}

/*
extern "C" const char* createDungeon(char* designFile, unsigned int seed)
{
    //unsigned int seed = 666;  //rand();
    DungeonMaker theDungeonMaker;

    theDungeonMaker.Init_fromFile(designFile, seed);
    theDungeonMaker.generate();

    //return convertMapToString(&theDungeonMaker);
    return convertMapToJsonStr(&theDungeonMaker);
}
*/

int* dungeonArray = 0;

extern "C" int* createDungeonData(char* designFile, unsigned int seed)
{
    DungeonMaker theDungeonMaker;

    theDungeonMaker.Init_fromFile(designFile, seed);
    theDungeonMaker.generate();

    if (dungeonArray) {
        delete[] dungeonArray;
    }
    dungeonArray = new int[2 + (theDungeonMaker.GetDimX()*theDungeonMaker.GetDimY())];

    convertMapToDataArray(&theDungeonMaker, dungeonArray);

    return dungeonArray;
}


int main(int argc, char** argv)
{
    /*
    unsigned int seed = 0;
    DungeonMaker theDungeonMaker;

    if (argc != 2) {
        cerr << "simple usage: " << argv[0] << " " << "<dungeon-config-file>" << endl;
        exit(1);
    }

    theDungeonMaker.Init_fromFile(argv[1], seed);
    //theDungeonMaker.Init_fromFile("design2", seed);
    theDungeonMaker.generate();

    printMapToStdout(&theDungeonMaker);
    //cout << convertMapToJsonStr(&theDungeonMaker) << endl;

    cerr << "Thank you and have a nice day." << endl;
    */
    return 0;
}

