/*------------------------------------------------------------------------
DungeonMaker.h: header of the DungeonMaker class.

Copyright (C) 2001 Dr. Peter Henningsen

This set of classes is released under the Free Software Foundation's General Public License (GPL). You cam also buy a commercial license. For further details, see the enclosed manual.

The GPL gives you the right to modify this software and incorporate it into your own project, as long as your project is also released under the Free Software Foundation's General Public License. You can obtain the text of this license by writing to 
Free Software Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

For bug reports, support requests, and inquiries about including DungeonMaker code in projects that are not released under the GPL, contact:
peter@alifegames.com

For more information about DungeonMaker check out 
http://dungeonmaker.sourceforge.net
------------------------------------------------------------------------*/
#ifndef DUNGEONMAKER_H_INCLUDED
#define DUNGEONMAKER_H_INCLUDED 1

#include <utility>
#include <vector>
#include <list>
#include <string>
#include <assert.h>

///* ATTENTION: In this version, the method DungeonMaker:: PutPlonkOnMap() puts MOBs and treasure on the map literally, by changing the SquareData of the Map square where the stuff goes. This is just for demonstration purposes to make it easier to show stuff without having an engine for rendering objects. If you use the DungeonMaker in your own program, you must refrain from calling this function, and instead write your own function that puts stuff on the map as objects and leaves the MapData as it is.

namespace alifegames
{
  ////////////begin IntCoordinate
  struct IntCoordinate : std::pair<int , int>
  {
    IntCoordinate( ) : std::pair<int , int>(0 , 0) {};
    IntCoordinate(int x , int y) : std::pair<int , int>(x , y) {};
    int ShowX() {return(first);}
    int ShowY() {return(second);}
    IntCoordinate(const IntCoordinate& Coord) : std::pair<int , int>(Coord.first , Coord.second) {};
    IntCoordinate& operator=(const IntCoordinate& rhs) {first = rhs.first; second = rhs.second; return *this;};
  };

  const IntCoordinate operator+(const  IntCoordinate& lhs , const  IntCoordinate& rhs);

  const IntCoordinate operator-(const  IntCoordinate& lhs , const  IntCoordinate& rhs);

  const IntCoordinate operator-(const  IntCoordinate& Coord);

  const IntCoordinate operator*(const int& lhs , const IntCoordinate& rhs);

  const bool operator==(const IntCoordinate& lhs , const IntCoordinate& rhs);

  //////////////end IntCoordinate

//////////////begin Map and associated stuff
//   Map arrangement:

//             y=0 , y=1 , y=2 ,      y              y=dimY-1
//   x=0      (0,0) (0,1) (0,2)     (0,y)           (0,dimY-1)   ;   NW              North           NE
//   x=1      (1,0) (1,1) (1,2)     (1,y)           (1,dimY-1)   ;
//   x=2      (2,0) (2,1) (2,2)     (2,y)           (2,dimY-1)   ;   West                            East
//                                  .....
//    x                             (x,y)           (x,dimY-1)   ;   SW              South           SE
//                                  .....
// x=dimX-1   (dimX-1,0)  ...     (dimX-1,y)      (dimX-1,dimY-1)

//   N = x--;  E = y++;   S = x++;   W = y--;
//   NE = x-- , y++;  SE = x++ , y++;   SW = x++ , y--;   NW = x-- , y--;
  enum SquareData{
    OPEN=0 , CLOSED , G_OPEN , G_CLOSED , //GUARANTEED-OPEN AND GUARANTEED-CLOSED
    NJ_OPEN , NJ_CLOSED , NJ_G_OPEN , NJ_G_CLOSED , //NJ = non-join, these cannot be joined br Builders with others of their own kind 
    IR_OPEN , IT_OPEN , IA_OPEN ,        //inside-room, open; inside-tunnel, open; inside anteroom, open
    H_DOOR , V_DOOR ,   //horizontal door, varies over y-axis , vertical door, over x-axis(up and down)
    MOB1 , MOB2 , MOB3 ,   //MOBs of different level            - higher is better
    TREAS1 , TREAS2 , TREAS3 ,  //treasure of different value
    COLUMN 
  };

  std::istream& operator>>(std::istream& stream , SquareData& data);

  enum Direction{
    NO=0 , EA , SO , WE , NE , SE , SW , NW , XX  //north, east (=right), south (=down) , west (=left), plus mixed directions
                                               //XX is for ease of reading files. this is the comment marker on the next line
                                             // XX also means "no intended direction" 
  };

  enum RoomSize{
    SMALL , MEDIUM , LARGE
    };

  std::istream& operator>>(std::istream& stream , Direction& dir);
  std::ostream& operator<<(std::ostream& stream , Direction dir);
  IntCoordinate TransformDirection(Direction d);

  struct SquareInfo
  {
    int xCoord , yCoord ;
    SquareData type;

    SquareInfo(int x , int y , SquareData t) : xCoord(x) , yCoord(y) , type(t) {}
    SquareInfo(const SquareInfo& data) : xCoord(data.xCoord) , yCoord(data.yCoord) , type(data.type) {}
    SquareInfo& operator=(const SquareInfo& rhs) {xCoord = rhs.xCoord; yCoord = rhs.yCoord; type = rhs.type; return *this;}
  };

  struct SpawnInfo
  {
    int xCoord , yCoord;
    int type;

    SpawnInfo() : xCoord(0) , yCoord(0) , type(-1) {}   //invalid type
    SpawnInfo(int x , int y , int t) : xCoord(x) , yCoord(y) , type(t) {}
  };

  struct TripleInt
  {
    int sm , md , lg;

    TripleInt() : sm(0) , md(0) , lg(0) {}
    TripleInt(int s , int m , int l) : sm(s) , md(m) , lg(l) {}
  };

  struct FlagsDirs
  {
    unsigned char checked;

    FlagsDirs( ) : checked(0) {}
    FlagsDirs(unsigned char in) : checked(in) {}
  };

  struct RectFill
  {
   int startX , startY , endX , endY;
   SquareData type;

   RectFill(int sX , int sY , int eX , int eY , SquareData t) : startX(sX) , startY(sY) , endX(eX) , endY(eY) , type(t) {}
  };

  struct CrawlerData
  {
    IntCoordinate loc , dir , intDir;
    int age , maxAge , gen , sL , op , cW , sSSP , sDSP , tSSP , tDSP , cDP;

    CrawlerData( ) : loc(0 , 0) , dir(-1 , 0) , intDir(-1 , 0) , age(0) , maxAge(0) , gen(0) , sL(1) , op(1) , cW(1) , sSSP(0) , sDSP(0) , tSSP(0) , tDSP(0) , cDP(0) {}
  };

  struct TunnelerData
  {
    IntCoordinate loc , dir , intDir;
    int age , maxAge , gen , sL , tW , sDSP , tDSP , cDP , mRRP , mRLP , jP;

    TunnelerData( ) : loc(0 , 0) , dir(-1 , 0) , intDir(-1 , 0) , age(0) , maxAge(0) , gen(0) , sL(1) , tW(0) , sDSP(0) , tDSP(0) , cDP(0) , mRRP(0) , mRLP(0) , jP(50) {}
  };

  class Room
    {//this class is not made use of except to create a list of rooms while the dungeon is constructed
      //later this list will be used to place treasure and MOBs, and the rooms will be used in the MOB-AI
      //the map used in the game will have acess from every IR_OPEN square to the corresponding Room-object
    private:
      std::vector<IntCoordinate> Inside;
      bool inDungeon;   //if this is false, the room is part of the labyrinth
      //      unsigned int size;   //number of squares in this room
    public:
      Room( std::vector<IntCoordinate> ins ) : Inside(ins) , inDungeon(false) {/* size = Inside.size();*/ }
      Room() : inDungeon(false) {assert(Inside.size() == 0);/* size = 0;*/}  //empty vector Inside
      ~Room() {}
      void AddSquare(IntCoordinate square) { Inside.push_back(square);/* size++;*/ }
      std::vector<IntCoordinate> GetInside() {return(Inside);}
      void SetInDungeon(bool iD) {if(iD) inDungeon = true;  else inDungeon = false; }
      bool GetInDungeon() {return(inDungeon);}
      unsigned int GetSize() {return(Inside.size());}
      IntCoordinate GetRandomSquare() {return(Inside[rand()%GetSize()]);}
    };

  class RoomComp
    { //for sorting Rooms according to size
    public:
      bool operator()(Room first , Room second) { return( first.GetSize() > second.GetSize() ); }
    };

  class Config
  {
  public:
    int dX , dY ;    //dimensions
    SquareData bg ;  //background
    std::vector<Direction> op;  //openings (in edge od dungeon wall)
    std::vector<RectFill> des;  //design elements (pre-placed rooms, etc
    std::vector<int> SL;
    std::vector<int> CW;
    std::vector<int> MAC , MAT;   //maxAgesCrawler/Tunneler
    std::vector<CrawlerData> Crawlers;
    std::vector<TunnelerData> Tunnelers;
    std::vector<std::pair<CrawlerData , CrawlerData> > CrawlerPairs;
    //    int mSRIM , mMRIM , mLRIM;   // int maxSmallRooms , maxMediumRooms , maxLargeRooms; 
    std::vector<int> BDPFGT;   // BabyDelayProbsForGeneration - Tunnelers
    std::vector<int> BDPFGC;   // BabyDelayProbsForGeneration - Crawlers
    std::vector<int> BDPFGR;   // BabyDelayProbsForGeneration - Roomies

    std::vector<TripleInt> RSPS;        // RoomSizeProbS;   //std::vector index = tunnelWidth; S = sideways rooms
    std::vector<TripleInt> RSPB;       //  RoomSizeProbB;   //std::vector index = tunnelWidth; B = rooms made when branching (e.g. with anterooms)

    int mut;             //mutator
    int nHP;             //noHeadingProbability
    int jD;   //joinDist
    int minRS , medRS , larRS , maxRS;                     //minRoomSz , medRoomSz , larRoomSz , maxRoomSz; 
    int numSmallL , numMedL , numLarL;               //numSmallRooms , numMediumRooms , numLargeRooms;  in LABYRINTH
    int numSmallD , numMedD , numLarD;               //numSmallRooms , numMediumRooms , numLargeRooms;  in DUNGEON

    std::vector<int> rCPG;   // RandCrawlerPerGeneration
    int rC_sSSP , rC_sDSP , rC_tSSP , rC_tDSP , rC_cDP;   //genetic variables for randCrawlers

    std::vector<int> jP;                   //  std::vector<int> joinPref;
    std::vector<int> sUpP , sDownP;        //  std::vector<int> sizeUpP , sizeDownP; 
    int pat;                          //  patience
    int tJD;                          // int tunnelJoinDist;
    int sUGD;                         //sizeUpGenDelay
    bool cIT;                         //columnsInTunnels
    double rAR;                       //roomAspectRatio
    std::vector<int> aRP;                  // anteRoomProb; 
    int gSUOAR;                       //  genSpeedUpOnAnteRoom;
    bool crIT;                         //crawlersInTunnels
    bool crIA;                         //crawlersInAnterooms
    int sCIT;                         //seedCrawlersInTunnels
    bool showM , storeM;              //showMovie , storeMovie;
    CrawlerData TCS;                  // TunnelCrawlerStats;
    unsigned int randSeed;            //default seed used on construction of DungeonMaker to guarantee good first dungeon
    std::vector<int> MLR;                  //MOBsInLabRooms; //labyrinth
    std::vector<int> MLO;                  //MOBsInLabOpen;
    std::vector<int> MDR;                  //MOBsInDunRooms; //dungeon
    std::vector<int> MDO;                  //MOBsInDunOpen;  //MOBs in the open parts of the dungeon are in anterooms
    std::vector<int> TIL;                  //TreasInLab;     //all treasure is in rooms
    std::vector<int> TID;                  //TreasInDun;
    int gSMOBLR;         //average group size for MOBs in the labyrinth - rooms
    //    int gSMOBLO;         //average group size for MOBs in the labyrinth - OPEN
    int gSMOBDR;         //average group size for MOBs in the DUNGEON - rooms
    //    int gSMOBDO;         //average group size for MOBs in the dungeon - open
    int gSTreasL;         //average group size for treasure in the labyrinth
    int gSTreasD;         //average group size for treasure in the dungeon
    int gSVMOBLR;         //group size variance for MOBs in the labyrinth - rooms
    //    int gSVMOBLO;         //group size variance for MOBs in the labyrinth - OPEN
    int gSVMOBDR;         //group size variance for MOBs in the DUNGEON - rooms
    //    int gSVMOBDO;         //group size variance for MOBs in the dungeon - open
    int gSVTreasL;         //group size variance for treasure in the labyrinth
    int gSVTreasD;         //group size variance for treasure in the dungeon
    int iARP;               //inAnteRoomProb;   
    int tCG;                      //tunnelCrawlerGeneration  
    int tCCP;               //tunnelCrawlerClosedProb
    TunnelerData lCT;      // TunnelerData lastChanceTunneler; 
    int gDLC;             //genDelayLastChance;       


    Config();
    Config(int x , int y);
    bool ReadDesign(const char* dF);
	bool AcceptDesign(const char* dF);
	bool ValidateDirections(Direction d , Direction iD);
  };

  class DungeonMaker;

  class Builder
    {
    public:
      Builder(DungeonMaker* pdm , IntCoordinate loc , IntCoordinate fwd , int a , int mA , int g);
      virtual ~Builder();
      virtual bool StepAhead( void ) = 0;     
      int GetAge() { return(age); }
      int GetGeneration() { return(generation); }
      void AdvanceAge(int adv) { age = age + adv; }

    protected:
      DungeonMaker* pDM;                  //to get access to the Map
      IntCoordinate Location;             //location
      IntCoordinate Forward;              //forward, the direction the Builder is facing
      int age;
      int maxAge;
      int generation;                     //generation where this Builder will be active                                          
    };

  class WallCrawler : public Builder 
    { 
    public: 
      virtual ~WallCrawler( ); 
      WallCrawler( DungeonMaker* pdm , IntCoordinate loc , IntCoordinate fwd , int a , int mA , int g , IntCoordinate intDir , int sL ,  int o, int cW , int sSSP , int sDSP , int tSSP , int tDSP , int cDP ); 
      int FrontFree( IntCoordinate Position , IntCoordinate Heading , int& leftFree , int& rightFree );
                                          //determines how many rows ahead are free to build in, leaving the 
                                          //clearancaes leftFree and rightFree; Upon returning, leftFree and rightFree give info on 
                                          //how many columns to the left and right are *actually* buildable
                                          // (the returned values must be >= those that were passed in initially)
                                          // to check ahead of a Builder, pass in Location for Position, and Forward for Heading
      virtual bool StepAhead( void ); 

    private:  
      IntCoordinate intDirection;           //intended Direction, the direction the Crawler should be heading
                                            // (0 , 0) <==> can head anywhere
      int stepLength;                //maximal number of wall tiles this crawler can lay down in one iteration 
      int opening;                   //opening = 1 <==> leave opening at end of wall 
                                            //        = 0 no opening in this wall 
      int corridorWidth;             //just that...
      int straightSingleSpawnProb;   //probability to make a single baby when going straight
      int straightDoubleSpawnProb;   //probability to make two balies when going straight
      int turnSingleSpawnProb;       //probability to make a single baby when turning
      int turnDoubleSpawnProb;       //probability to make two balies when turning (=changing direction)
      int changeDirProb;             //probability to change direction

      bool Join( int frontFree );
    };

  class Tunneler : public Builder 
    { 
    public: 
      virtual ~Tunneler( ); 
      Tunneler( DungeonMaker* pdm , IntCoordinate loc , IntCoordinate fwd , int a , int mA , int g , IntCoordinate intDir , int sL , int tW , int sDSP , int tDSP , int cDP , int mRRP , int mRLP , int jP ); 
      int FrontFree( IntCoordinate Position , IntCoordinate Heading , int& leftFree , int& rightFree );
      virtual bool StepAhead( void ); 

    private:  
      IntCoordinate intDirection;    //intended Direction, the direction the Tunneler should be heading
                                     // (0 , 0) <==> can head anywhere
      int stepLength;                //maximal length of tunnel for one iteration 
      int tunnelWidth;               //actual width is 1 + 2*tunnelWidth, ensuring all width's are uneven numbers
                                     //with a well defined center where the Tunneler resideth
      int straightDoubleSpawnProb;   //probability to make two balies when going straight
      int turnDoubleSpawnProb;       //probability to make two balies when turning (=changing direction)
                  //in both the above cases an anteroom is produced, and one or both of the spawns can be Roomies
                  //whether Roomies are produced is governed by the Dungeonmaker class based on need for rooms and the "patience"-param
      int changeDirProb;             //probability to change direction      

      int makeRoomsRightProb;        //prob to make a small room off to the right side IN THE MIDDLE OF ONE STEP
      int makeRoomsLeftProb;         //prob to make a small room off to the left side IN THE MIDDLE OF ONE STEP
                                     //these are small rooms that at high probabilities typically follow each other like rooms on a corridor

      int joinPreference;            //when time comes to join another tunnel or to make a terminating room, this preference decides
                                     //0 <==> make room always;   100 <==> join always; joinPref is probability to call Join-method
      //inherited params:
      //stepLength (dependent on tunnelWidth); tunnelWidth (subject to global sizeUp/sizeDownProbs); sDSP , tDSP , cDP;
      //mRRP , mRLP;
      //governed by the global Dungeonmaker:
      //joinPreference , sizeUpProb , SizeDownprob (for tunnelWidth), maxAge
    

      bool Join( int frontFree );
      bool BuildAnteRoom(int length , int width);  //returns true if room gets built, false otherwise
      bool BuildAnteRoom(IntCoordinate lB , IntCoordinate rT);  // [lB , rT] = [leftBottom , rightTop] defines a rectangle for the anteroom
      bool BuildTunnel(int length , int width);    //returns true when tunnel gets built, false otherwise
    };

  class Roomie : public Builder
    {
    public:
      virtual ~Roomie();
      Roomie( DungeonMaker* pdm , IntCoordinate loc , IntCoordinate fwd , int a , int mA , int g , int dW , RoomSize s , int cat);
      virtual bool StepAhead( void ); 
      int FrontFree( IntCoordinate Position , IntCoordinate Heading , int& leftFree , int& rightFree );

    private:
      int defaultWidth;   //we TRY to build a room with defaultWidth to the left and right of the Roomie start position
                          //so that the toal width is 2*defaultWidth + 1, however, this is NOT guaranteed
      RoomSize size;      //actual sizes of SMALL,etc rooms are read from file - this size can be overrridden by category
      int category;       //gives type of decoration, and can override size (to make very few very large rooms) //UNUSED - HERE
    };

  class DungeonMaker
    {
    private:
      std::vector<SquareData> Map;
      std::vector<Room> Rooms;
      std::vector<FlagsDirs> MapFlagsDirs;
      std::vector<Builder*> BuilderPointerVector;
      std::vector< std::vector< SquareInfo > > Movie;   //Movie[k] is a std::vector showing what has changed on the map in itereation k
      std::vector< SquareInfo > ChangedThisIteration;
      CrawlerData TunnelCrawlerStats;  //to hold the stats for Crawlers seeded in Tunnels
      bool showMovie , storeMovie;
      int dimX , dimY;
      SquareData background;   //must be OPEN or CLOSED -- the map will be set to this value in the constructor before design elements are read in
      std::vector<Direction> openings;  //the border of the map will be G_CLOSED, except for 3 squares here 
      std::vector<RectFill> design;
      std::vector<int> StepLengths;
      std::vector<int> CorrWidths;
      std::vector<int> MaxAgesC;   //Crawlers
      std::vector<int> MaxAgesT;   //Tunnelers
      std::vector<TripleInt> RoomSizeProbS;   //std::vector index = tunnelWidth; S = sideways rooms
      std::vector<TripleInt> RoomSizeProbB;   //std::vector index = tunnelWidth; B = rooms made when branching (e.g. with anterooms)
      //      double roomMultiplier;   //values larger than 1 force the  construction of  more rooms
                               //values smaller than 1 reduce the number of rooms compared to the design numbers
      int activeGeneration;
      int seedCrawlersInTunnels;   //will be seeded after the completion of the dungeon run if this is > 0
      int joinDist;   //a wall that will close the gap does so when distance to wall is less than this
      int minRoomSz , medRoomSz , larRoomSz , maxRoomSz;  //minRS <= smallRoom < medRS <= medRoom < larRS <= larRoom < maxRS
      int numSmallRoomsL , numMediumRoomsL , numLargeRoomsL;   //maximum wanted numbers of rooms in LABYRINTH
      int currSmallRoomsL , currMediumRoomsL , currLargeRoomsL; //used for counting, updated by Roomies
      int numSmallRoomsD , numMediumRoomsD , numLargeRoomsD;   //maximum wanted numbers of rooms in DUNGEON
      int currSmallRoomsD , currMediumRoomsD , currLargeRoomsD; //used for counting, updated by Roomies

      std::vector<int> BabyDelayProbsForGenerationT;
      std::vector<int> BabyDelayProbsForGenerationR;  //R = Roomies   C = Crawlers   T = Tunnelers
      std::vector<int> BabyDelayProbsForGenerationC;  // BabyDelayProbsForGeneration[i] = probability that a baby will be born i generations after the parent  -  i=0 <==> becomes active immediately  - std::vector will run from 0 to 10 inclusive (11 elements)
      int mutator;  //gives the maximum value by which the probabilities that are inherited by Crawlers
                    // from their parents are changed each generation
      int noHeadingProb;   //probability that a new Crawler will have (0 , 0 ) as intended direction (<===> no intended direction)

      //Tunnelers:    //joinPreference , sizeUpProb , SizeDownProb (for tunnelWidth)
      std::vector<int> joinPref;
      std::vector<int> sizeUpP , sizeDownP;  //for the current generation, determines the prob that babies have diff sizes
      std::vector<int> anteRoomProb;         //index is tunnelWidth, std::vector gives probability to make an anteroom
      int patience;   //if patience=0, Tunnelers make a room immediately when they get a chance during doubleSpawning
                      //if patience = 100, we wait forever, and never make a roomie during doublespawning
      int tunnelJoinDist;  //maximum distance at which a tunnel joins another when reaching maxAge
      int sizeUpGenDelay;  //generational delay for tunneler babies that have been sized up (these normally will become active before 
                           //their smaller cousins so they have room, and can become BIG
      bool columnsInTunnels;    //yes or no
      double roomAspectRatio;  //the smallest allowable ratio length/width or width/length (both must be >= rAR)
      int genSpeedUpOnAnteRoom;  //the generational delay specified in BabyDelayProbs.. is divided by this factor
                                 //for Roomies that branch off anterooms - as opposed to siderooms
      bool crawlersInTunnels;    //if true, Crawlers can enter Tunnels and build walls in there
      bool crawlersInAnterooms;    //if true, Crawlers can enter Anterooms and build walls in there
      int tunnelCrawlerGeneration;   //the generation in which Crawlers are seeded into tunnels; 
                                     // -1 <==> they're seeded after all normal generations have died out
      int tunnelCrawlerClosedProb;   //guess!
      TunnelerData lastChanceTunneler;  //gets created when a Tunneler runs out of room
      int genDelayLastChance;           //generational delay for last chance Tunnelers
      //////////////////MOBs and treasure:  
      std::vector<int> MOBsInLabRooms; //labyrinth
      std::vector<int> MOBsInLabOpen;
      std::vector<int> MOBsInDunRooms; //dungeon
      std::vector<int> MOBsInDunOpen;  //MOBs in the open parts of the dungeon are in anterooms
      std::vector<int> TreasInLab;     //all treasure is in rooms
      std::vector<int> TreasInDun;
      int groupSizeMOBLR;         //average group size for MOBs in the labyrinth - rooms
      //      int groupSizeMOBLO;         //average group size for MOBs in the labyrinth - OPEN
      int groupSizeMOBDR;         //average group size for MOBs in the DUNGEON - rooms
      //      int groupSizeMOBDO;         //average group size for MOBs in the dungeon - open
      int groupSizeTreasL;         //average group size for treasure in the labyrinth
      int groupSizeTreasD;         //average group size for treasure in the dungeon
      int gSVarMOBLR;         //group size variance for MOBs in the labyrinth - rooms
      //      int gSVarMOBLO;         //group size variance for MOBs in the labyrinth - OPEN
      int gSVarMOBDR;         //group size variance for MOBs in the DUNGEON - rooms
      //      int gSVarMOBDO;         //group size variance for MOBs in the dungeon - open
      int gSVarTreasL;         //group size variance for treasure in the labyrinth
      int gSVarTreasD;         //group size variance for treasure in the dungeon
      std::vector<SpawnInfo> MOBInfo;    //results of the plonking process, location and type of MOB
      std::vector<SpawnInfo> TreasInfo;  //and treasure - type=category, or level maybe
      int inAnteRoomProb;             //probability that a MOB will be in an anteroom as opposed to in a tunnel, must be between 0 and 100


      bool IsOpen(IntCoordinate pos) { SquareData type = GetMap(pos);   if( ( OPEN == type ) || ( NJ_OPEN == type  ) || ( IT_OPEN == type  ) || ( IA_OPEN == type  ) || ( G_OPEN == type ) || ( NJ_G_OPEN == type  ) )   return(true); else return(false); }  //returns false inside-room/tunnel-open squares, for use in CreateRoom
      bool IsChecked(IntCoordinate pos , std::vector<IntCoordinate> Checked);
      bool IsActive(IntCoordinate pos , std::list<IntCoordinate> Active);

    public:
      //      DungeonMaker(const Config& config , int rs , double mRM);   //rs = random seed, mRM = roomMultiplier
                                                                  //all other initialization data are in the config-struct
																  
	  DungeonMaker() : activeGeneration(0) , currSmallRoomsL(0) , currMediumRoomsL(0) , currLargeRoomsL(0) , currSmallRoomsD(0) , currMediumRoomsD(0) , currLargeRoomsD(0) {}
	  void Init_fromConfig(const Config& config, unsigned int seed);
	  void Init_fromFile(const char* filename, unsigned int seed);
	  void Init_fromText(const char* designText, unsigned int seed);

	  void generate();
	  
      void SetMap(int x , int y , SquareData dat) { assert( (x < dimX) && (y < dimY) && (x >= 0) && (y >= 0)); Map[ x * dimY + y ] = dat;
if(showMovie || storeMovie) { SquareInfo changed(x , y , dat);   ChangedThisIteration.push_back( changed );} }
      void SetMap(IntCoordinate pos , SquareData dat) { assert( (pos.first < dimX) && (pos.second < dimY) && (pos.first >= 0) && (pos.second >= 0)); Map[ pos.first * dimY + pos.second ] = dat;
if(showMovie || storeMovie) { SquareInfo changed(pos.first , pos.second , dat);   ChangedThisIteration.push_back( changed );} }

      SquareData GetMap(int x , int y) { assert( (x < dimX) && (y < dimY) && (x >= 0) && (y >= 0)); return( Map[ x * dimY + y ] ); }
      SquareData GetMap(IntCoordinate pos) { assert( (pos.first < dimX) && (pos.second < dimY) && (pos.first >= 0) && (pos.second >= 0)); return( Map[ pos.first * dimY + pos.second ] ); }

      void SetRect(int startX , int startY , int endX , int endY , SquareData dat); //sets the entire rectangle to dat, including both start and endlines
      void SetRect(RectFill rectDat);
      int GetDimX( ) { return(dimX); }
      int GetDimY( ) { return(dimY); }
      //      int GetMinCorrWidth( ) {return(minCorrWidth);}
      //      double GetRoomMultiplier( ) {return(roomMultiplier);}
      int GetActiveGeneration() {return(activeGeneration);}
      int GetMinRoomSize(RoomSize sz);
      int GetMaxRoomSize(RoomSize sz);
      SquareData GetBackground() {return(background);}
      std::vector< std::vector< SquareInfo > > GetMovie() {return(Movie);}
      bool ShowMovie() {return(showMovie);}
      bool StoreMovie() {return(storeMovie);}
      std::vector<RectFill> GetDesign() { return(design); }

	  std::vector<Room> GetRooms() { return(Rooms); }
	  std::vector<SpawnInfo> GetMOBs() { return(MOBInfo); }
	  std::vector<SpawnInfo> GetTreas() { return(TreasInfo); }

      int GetRoomSizeProbS(unsigned int tW , RoomSize sz);
      int GetRoomSizeProbB(unsigned int tW , RoomSize sz);
      bool WantsMoreRoomsL(RoomSize sz) {if(SMALL  == sz) return( numSmallRoomsL > currSmallRoomsL );    else if(MEDIUM  == sz) return( numMediumRoomsL > currMediumRoomsL );    else if(LARGE  == sz) return( numLargeRoomsL > currLargeRoomsL );  else assert(false); /*MAKE GCC HAPPY*/ return false;} //in LABYRINTH
      bool WantsMoreRoomsL() {return(  WantsMoreRoomsL(SMALL) ||  WantsMoreRoomsL(MEDIUM) ||  WantsMoreRoomsL(LARGE) ); }
      bool WantsMoreRoomsD(RoomSize sz) {if(SMALL  == sz) return( numSmallRoomsD > currSmallRoomsD );    else if(MEDIUM  == sz) return( numMediumRoomsD > currMediumRoomsD );    else if(LARGE  == sz) return( numLargeRoomsD > currLargeRoomsD );  else assert(false); /*MAKE GCC HAPPY*/ return false;} //in DUNGEON
      bool WantsMoreRoomsD() {return(  WantsMoreRoomsD(SMALL) ||  WantsMoreRoomsD(MEDIUM) ||  WantsMoreRoomsD(LARGE) ); }
    
      void BuiltRoomD(RoomSize sz) {if(SMALL == sz) currSmallRoomsD++; else if(MEDIUM == sz) currMediumRoomsD++; else if(LARGE == sz) currLargeRoomsD++; }
      void SortRooms();

      std::vector< SquareInfo > GetChangedThisIteration() {return(ChangedThisIteration);}
      int GetBabyDelayProbsForGenerationC(int gen) {if((0 <= gen) && (gen <= 10)) return( BabyDelayProbsForGenerationC[gen] ); else return(0);}
      int GetBabyDelayProbsForGenerationR(int gen) {if((0 <= gen) && (gen <= 10)) return( BabyDelayProbsForGenerationR[gen] ); else return(0);}
      int GetBabyDelayProbsForGenerationT(int gen) {if((0 <= gen) && (gen <= 10)) return( BabyDelayProbsForGenerationT[gen] ); else return(0);}
      int GetGenSpeeUpOnAnteRoom() {return(genSpeedUpOnAnteRoom);}
      //      int GetMutator() {return(mutator);}
      inline int Mutate(int input);
      inline int Mutate2(int input);
      int GetNoHeadingProb() {return(noHeadingProb);}
      int GetStepLength(unsigned int g) { if(g >= StepLengths.size() ) return(StepLengths.back() ); else return(StepLengths[g]); }
      int GetCorrWidth(unsigned int g) { if(g >= CorrWidths.size() ) return(CorrWidths.back() ); else return(CorrWidths[g]); }
      int GetMaxAgeC(unsigned int g) { if(g >= MaxAgesC.size() ) return(MaxAgesC.back() ); else return(MaxAgesC[g]); }
      int GetMaxAgeT(unsigned int g) { if(g >= MaxAgesT.size() ) return(MaxAgesT.back() ); else return(MaxAgesT[g]); }
      int GetAnteRoomProb(unsigned int tW) { if(tW >= anteRoomProb.size() ) return(100); else return(anteRoomProb[tW]); }
      int GetJoinDist() {return(joinDist);}
      int GetSizeUpGenDelay() {return(sizeUpGenDelay);}
      int GetTunnelJoinDist() {return(tunnelJoinDist);}
      void CreateCrawler( IntCoordinate loc , IntCoordinate fwd , int a , int mA , int g , IntCoordinate intDir , int sL ,  int o, int cW ,  int sSSP , int sDSP , int tSSP , int tDSP , int cDP );
      void CreateTunneler( IntCoordinate loc , IntCoordinate fwd , int a , int mA , int g , IntCoordinate intDir , int sL , int tW , int sDSP , int tDSP , int cDP , int mRRP , int mRLP , int jP );
      void CreateRoomie( IntCoordinate loc , IntCoordinate fwd , int a , int mA , int g , int dW , RoomSize s , int cat );
      bool MakeIteration();  //returns true if changes are made to the map, false otherwise
      bool AdvanceGeneration();   //should only be called when MakeIteration has returned false
                                 //returns true if live Builders exist, false if Building is finished
      bool CreateRoom(RectFill rect);         //attempts to create a room in a (norrmally finished) maze/dugeon - most often will fail
      //returns true upon success, false on failure to build room  -- we only need the rect info from the RectFill

      int GetJoinPref(unsigned int g) { if(g >= joinPref.size() ) return( joinPref.back() ); else return(joinPref[g]); }
      int GetSizeUpProb(unsigned int g) { if(g >= sizeUpP.size() ) return(sizeUpP.back() ); else return(sizeUpP[g]); }
      int GetSizeDownProb(unsigned int g) { if(g >= sizeDownP.size() ) return(sizeDownP.back() ); else return(sizeDownP[g]); }
      //the generation in these functions is the parent generation
      int GetPatience() {return(patience); }
      double GetRoomAspectRatio() {return(roomAspectRatio);}
      bool WeWantColumnsInTunnels() {return(columnsInTunnels);}
      bool CrawlersInTunnels() {return(crawlersInTunnels);}
      bool CrawlersInAnterooms() {return(crawlersInAnterooms);}
      void SeedCrawlersInTunnels();   //this method creates "number=seedCrawlersInTunnels" Crawwlers in the middle of tunnels
      int GetTunnelCrawlerGeneration() { return(tunnelCrawlerGeneration); }   
     
      int GetLastChanceRoomsRightProb() { return(lastChanceTunneler.mRRP); }
      int GetLastChanceRoomsLeftProb() { return(lastChanceTunneler.mRLP); }
      int GetLastChanceChangeDirProb() { return(lastChanceTunneler.cDP); }
      int GetLastChanceStraightSpawnProb() { return(lastChanceTunneler.sDSP); }
      int GetLastChanceTurnSpawnProb() { return(lastChanceTunneler.tDSP); }
      int GetLastChanceGenDelay() { return(genDelayLastChance); }

      void AddRoom(Room r) { Rooms.push_back(r); }
      unsigned int NumberOfRooms() {return(Rooms.size());}
      Room RoomNumber(unsigned int i) {assert(i < Rooms.size() ); return(Rooms[i]); }    
      void PlonkDownStuff();
      void PutPlonkOnMap();     //shows just 3 different types, PROVISIONAL   
 
      //////////////////////////////////MapFlagsDirs methods//////////////////////////////////////
      bool IsChecked(IntCoordinate pos) { assert( (pos.first < dimX) && (pos.second < dimY) && (pos.first >= 0) && (pos.second >= 0)); return( MapFlagsDirs[ pos.first * dimY + pos.second ].checked ); }
      void SetChecked(IntCoordinate pos) { assert( (pos.first < dimX) && (pos.second < dimY) && (pos.first >= 0) && (pos.second >= 0)); MapFlagsDirs[ pos.first * dimY + pos.second ].checked = 1; }
      void SetUnchecked(IntCoordinate pos) { assert( (pos.first < dimX) && (pos.second < dimY) && (pos.first >= 0) && (pos.second >= 0)); MapFlagsDirs[ pos.first * dimY + pos.second ].checked = 0; }
      ////////////////////////////////end MapFlagsDirs methods////////////////////////////////////

    };

}

#endif //DUNGEONMAKER_H_INCLUDED
