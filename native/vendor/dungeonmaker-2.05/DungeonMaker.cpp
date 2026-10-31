/*------------------------------------------------------------------------
DungeonMaker.cpp: implementation of the DungeonMaker class.

Copyright (C) 2001 Dr. Peter Henningsen

This set of classes is released under the Free Software Foundation's General Public License (GPL). You cam also buy a commercial license. For further details, see the enclosed manual.

The GPL gives you the right to modify this software and incorporate it into your own project, as long as your project is also released under the Free Software Foundation's General Public License. You can obtain the text of this license by writing to 
Free Software Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

For bug reports, and inquiries about including DungeonMaker code in projects that are not released under the GPL, contact:
peter@alifegames.com

For more information about DungeonMaker check out 
http://dungeonmaker.sourceforge.net
the mailing list there is open for your questions and support reqiests
------------------------------------------------------------------------*/
#include "DungeonMaker.h"
#include <cassert>
#include <cstdlib>     //for rand()
// #include <time.h>       //for time in rand seed
#include <cstdio>      //for file handling
#include <iostream>   //for console traffic
#include <fstream>    //for file input
#include <algorithm>  //for sort
#include <string>
#include <list>
#include <sstream>  //stringstream used in file input - not available!!!
using namespace std;

const alifegames::IntCoordinate alifegames::operator+(const  alifegames::IntCoordinate& lhs , const  alifegames::IntCoordinate& rhs)
{
  return(  alifegames::IntCoordinate( lhs.first + rhs.first , lhs.second + rhs.second ));
}

const alifegames::IntCoordinate alifegames::operator-(const  alifegames::IntCoordinate& lhs , const  alifegames::IntCoordinate& rhs)
{
  return(  alifegames::IntCoordinate( lhs.first - rhs.first , lhs.second - rhs.second ));
}


const alifegames::IntCoordinate alifegames::operator-(const  alifegames::IntCoordinate& Coord)
{
  return( alifegames::IntCoordinate( -Coord.first , -Coord.second ) );
}

const alifegames::IntCoordinate alifegames::operator*(const int& lhs , const  alifegames::IntCoordinate& rhs)
{
  return(  alifegames::IntCoordinate( lhs * rhs.first , lhs * rhs.second ));
}

const bool  alifegames::operator==(const alifegames::IntCoordinate& lhs , const alifegames::IntCoordinate& rhs)
{
  return( ( lhs.first == rhs.first ) && ( lhs.second == rhs.second ) );
}


istream& alifegames::operator>>(istream& stream , SquareData& data)
{
  string s;
  stream >> s;
  if(s == "OPEN")
    data = OPEN;
  else if(s == "CLOSED")
    data = CLOSED;
  else if (s == "G_OPEN")
    data = G_OPEN;
  else if(s == "G_CLOSED")
    data = G_CLOSED;
  else if(s == "NJ_OPEN")
    data = NJ_OPEN;
  else if(s == "NJ_CLOSED")
    data = NJ_CLOSED;
  else if (s == "NJ_G_OPEN")
    data = NJ_G_OPEN;
  else if(s == "NJ_G_CLOSED")
    data = NJ_G_CLOSED;
  else if(s == "H_DOOR")
    data = H_DOOR;
  else if (s == "V_DOOR")
    data = V_DOOR;
  else if(s == "COLUMN")
    data = COLUMN;
  else if(s == "IR_OPEN")
    data = IR_OPEN;
  else if(s == "IT_OPEN")
    data = IT_OPEN;
  else if(s == "IA_OPEN")
    data = IA_OPEN;
  else if(s == "MOB1")
    data = MOB1;
  else if(s == "MOB2")
    data = MOB2;
  else if(s == "MOB3")
    data = MOB3;
  else if(s == "TREAS1")
    data = TREAS1;
  else if(s == "TREAS2")
    data = TREAS2;
  else if(s == "TREAS3")
    data = TREAS3;
  else 
    cout << "Input operator >> is ignoring unknown SquareData: " << s << endl;

  return stream;
}

istream& alifegames::operator>>(istream& stream , Direction& dir)
{
  string s;
  // NO=0 , EA , SO , WE , NE , SE , SW , NW
  stream >> s;
  if(s == "NO")
    dir = NO;
  else if(s == "EA")
    dir = EA;
  else if (s == "SO")
    dir = SO;
  else if(s == "WE")
    dir = WE;
  else if(s == "NE")
    dir = NE;
  else if(s == "SE")
    dir = SE;
  else if (s == "SW")
    dir = SW;
  else if(s == "NW")
    dir = NW;
  else if(s == "XX")
    dir = XX;
  else 
    cout << "Input operator >> is ignoring unknown direction: " << s << endl;

  return stream;
}

ostream& alifegames::operator<<(ostream& stream , Direction dir)
{
  string s;
  // NO=0 , EA , SO , WE , NE , SE , SW , NW
  if(NO == dir)
    s = "NO";
  else if(EA == dir)
    s = "EA";
  else if(SO == dir)
    s = "SO";
  else if(WE == dir) 
    s = "WE";
  else if(NE == dir)
    s = "NE";
  else if(SE == dir)
    s = "SE";
  else if(SW == dir)
    s = "SW";
  else if(NW == dir)
    s = "NW";
  else if(XX == dir)
    s = "XX";
  else 
    cout << "Output operator << is ignoring unknown direction" << endl;

  stream << s;
  return stream;
}

alifegames::IntCoordinate alifegames::TransformDirection(alifegames::Direction d)
{
//   N = x--;  E = y++;   S = x++;   W = y--;
//   NE = x-- , y++;  SE = x++ , y++;   SW = x++ , y--;   NW = x-- , y--;
  switch(d)
    {
    case(NO): return(alifegames::IntCoordinate(-1 , 0)); break;
    case(EA): return(alifegames::IntCoordinate(0 , 1)); break;
    case(SO): return(alifegames::IntCoordinate(1 , 0)); break;
    case(WE): return(alifegames::IntCoordinate(0 , -1)); break;
    case(NE): return(alifegames::IntCoordinate(-1 , 1)); break;
    case(SE): return(alifegames::IntCoordinate(1 , 1)); break;
    case(SW): return(alifegames::IntCoordinate(1 , -1)); break;
    case(NW): return(alifegames::IntCoordinate(-1 , -1)); break;
    case(XX): return(alifegames::IntCoordinate(0 , 0)); break;
    default:  assert(false);
    }
	//MAKE GCC HAPPY
	return alifegames::IntCoordinate();
}

/////////Config methods

alifegames::Config::Config()
{
  dX = 100;
  dY = 100;
  bg = OPEN;
}
 alifegames::Config::Config(int x , int y)
{
  dX = x;
  dY = y;
  bg = OPEN;
}

bool alifegames::Config::ValidateDirections(Direction d , Direction iD)
{//returns true if intended direction iD and direction d are consistent
  if(XX == iD)
    return(true);   //anything goes
  if(NO == iD)
    if( ( WE == d ) || ( NW == d ) || ( NO == d ) || ( NE == d ) || ( EA == d ) )
      return(true);
  if(EA == iD)
    if( ( NO == d ) || ( NE == d ) || ( EA == d ) || ( SE == d ) || ( SO == d ) )
      return(true);
  if(SO == iD)
    if( ( WE == d ) || ( SW == d ) || ( SO == d ) || ( SE == d ) || ( EA == d ) )
      return(true);
  if(WE == iD)
    if( ( NO == d ) || ( NW == d ) || ( WE == d ) || ( SW == d ) || ( SO == d ) )
      return(true);
  if(NW == iD)
    if( ( NO == d ) || ( WE == d ) )
      return(true);
  if(SW == iD)
    if( ( SO == d ) || ( WE == d ) )
      return(true);
  if(NE == iD)
    if( ( NO == d ) || ( EA == d ) )
      return(true);
  if(SE == iD)
    if( ( SO == d ) || ( EA == d ) )
      return(true);
  //WELL, TOO BAD, if we get here we are inconsistsnt
  return(false);
}

bool alifegames::Config::ReadDesign(const char* dF)
{
  ifstream designFile(dF);
  if(designFile.fail() )
    {
      cout << "could not open " << dF << endl;
      return(false);
    }
	
	string sofar;
	string current;
	while (!designFile.eof()) {
		getline(designFile, current);
		sofar = sofar + current + "\n";
	}
	
	return AcceptDesign(sofar.c_str());
}

bool alifegames::Config::AcceptDesign(const char* dF)
{
  istringstream designFile(dF);
//  if(designFile.fail() )
//    {
//      cout << "could not open " << dF << endl;
//      return(false);
//    }

  char c;
  //  char text[200];
  string str;
  int sX , sY , eX , eY , prob , intIn;
  SquareData t;
  Direction d;
  do{
      designFile >> c;
	  	//cout << "First character is a " << c << endl;
      if( designFile.eof() )
	break;
      if( 'X' == c )   //comment line
	{
	  designFile >> c;
	  assert('X' == c);
	  getline(designFile , str);
	  //	  cout << "Encountered the comment: " << str << endl;
	}
      else if( ( 'R' == c ) || ( 'r' == c) )
	{//read in a line with squareData
	  designFile >> sX >> sY >> eX >> eY >> t;
	  RectFill rF(sX , sY , eX , eY , t);
	  des.push_back(rF);
	}
      else if( ( 'W' == c ) || ( 'w' == c) )
	{//read in a line with CrawlerData
	  designFile >> c;
	  if( ( 'S' == c ) || ( 's' == c) )
	    {//read in a single Crawler
	      CrawlerData cd;
	      Direction d , iD;
	      designFile >> cd.loc.first >> cd.loc.second >> d >> iD >> cd.age >> cd.maxAge >> cd.gen >> cd.sL >> cd.op >> cd.cW >> cd.sSSP >> cd.sDSP >> cd.tSSP >> cd.tDSP >> cd.cDP;
	      if( ValidateDirections(d , iD) )
		{
		  cd.dir = TransformDirection(d);
		  cd.intDir = TransformDirection(iD);
		  Crawlers.push_back(cd);
		}
	      else
		cout << "Ignoring Crawlerdata because of inconsistent directions - :" << endl << "Starting direction = " << d << "; intended direction = " << iD << endl;
	    }
	  else if( ( 'P' == c ) || ( 'p' == c) )
	    {//read in a Crawler pair to --> vector<pair<CrawlerData , CrawlerData>> CrawlerPairs;
	      pair<CrawlerData , CrawlerData> CDPair;
	      CrawlerData cd;
	      designFile >> c;
	      //reading first line
	      if('1' != c)
		{
		  cout << "Expected WP1 for first of Crawler Pair, bailing out..." << endl;
		  return(false);
		}
	      Direction d , iD;
	      designFile >> cd.loc.first >> cd.loc.second >> d >> iD >> cd.age >> cd.maxAge >> cd.gen >> cd.sL >> cd.op >> cd.cW >> cd.sSSP >> cd.sDSP >> cd.tSSP >> cd.tDSP >> cd.cDP;
	      if( ValidateDirections(d , iD) )
		{
		  cd.dir = TransformDirection(d);
		  cd.intDir = TransformDirection(iD);
		  CDPair.first = cd;
		}
	       else
		 {
		   cout << "Ignoring Crawlerdata because of inconsistent directions - :" << endl << "Starting direction = " << d << "; intended direction = " << iD << endl << "Bailing out..." << endl;
		   return(false);
		 }
	      //reading second line
	      designFile >> c;
	      if('W' != c)
		{
		  cout << "Expected WP2 for second of Crawler Pair, bailing out..." << endl;
		  return(false);
		}
	      designFile >> c;
	      if('P' != c)
		{
		  cout << "Expected WP2 for second of Crawler Pair, bailing out..." << endl;
		  return(false);
		}
	      designFile >> c;
	      if('2' != c)
		{
		  cout << "Expected WP2 for second of Crawler Pair, bailing out..." << endl;
		  return(false);
		}
	      designFile >> cd.loc.first >> cd.loc.second >> d >> iD >> cd.age >> cd.maxAge >> cd.gen >> cd.sL >> cd.op >> cd.cW >> cd.sSSP >> cd.sDSP >> cd.tSSP >> cd.tDSP >> cd.cDP;
	      if( ValidateDirections(d , iD) )
		{
		  cd.dir = TransformDirection(d);
		  cd.intDir = TransformDirection(iD);
		  CDPair.second = cd;
		  CrawlerPairs.push_back(CDPair);
		}
	       else
		cout << "Ignoring Crawlerdata because of inconsistent directions - :" << endl << "Starting direction = " << d << "; intended direction = " << iD << endl;
	    }
	}
      else if( ( 'U' == c ) || ( 'u' == c) )
	{//read in a line with tUnnelerData
	  TunnelerData cd;
	  Direction d1 , d2;
	  designFile >> cd.loc.first >> cd.loc.second >> d1 >> d2 >> cd.age >> cd.maxAge >> cd.gen >> cd.sL >> cd.tW >> cd.sDSP >> cd.tDSP >> cd.cDP >> cd.mRRP >> cd.mRLP >> cd.jP;
	  cd.dir = TransformDirection(d1);
	  cd.intDir = TransformDirection(d2);
	  Tunnelers.push_back(cd);
	}
      else if( ( 'B' == c ) || ( 'b' == c) )
	{//read in the line with generational delays for Babies
	  designFile >> c;
	  if('C' == c)   ///baby Crawlers
	    {
	      int sum = 0;
	      for(int ind = 0; ind <= 10; ind++)
		{
		  designFile >> prob;
		  sum = sum + prob;
		  BDPFGC.push_back(prob);
		}
	      if(sum != 100) 
		cout << "The probabilities for generational delay in Crawler babies (input line labelled 'BC') do not add up to 100. Correct the design file, SVP." << endl;
	    }
	  else if('R' == c)   ///baby Roomies
	    {
	      int sum = 0;
	      for(int ind = 0; ind <= 10; ind++)
		{
		  designFile >> prob;
		  sum = sum + prob;
		  BDPFGR.push_back(prob);
		}
	      if(sum != 100) 
		cout << "The probabilities for generational delay in Roomie babies (input line labelled 'BR') do not add up to 100. Correct the design file, SVP." << endl;
	    }
	  else if('T' == c)   ///baby Tunnelers
	    {
	      int sum = 0;
	      for(int ind = 0; ind <= 10; ind++)
		{
		  designFile >> prob;
		  sum = sum + prob;
		  BDPFGT.push_back(prob);
		}
	      if(sum != 100) 
		cout << "The probabilities for generational delay in Tunneler babies (input line labelled 'BT') do not add up to 100. Correct the design file, SVP." << endl;
	    }
	}
      else if( ( 'M' == c ) || ( 'm' == c ) )
	{ 
	  int in1 = 1;
	  int in2 = 1;
	  designFile >> mut >> nHP >> pat >> sUGD >> in1 >> in2 >> rAR >> gSUOAR; 
	  if(0 == in1)
	    cIT = false;
	  else
	    cIT = true;
	  if(0 == in2)
	    crIT = false;
	  else
	    crIT = true;
	}
      else if( ( 'N' == c ) || ( 'n' == c ) )
	{ 
	  designFile >> sCIT >> tCG >> showM >> storeM >> randSeed >> crIA;; 
	}
      else if( ( 'T' == c ) || ( 't' == c ) )
	{//room sizes and numbers         
	  designFile >> minRS >> medRS >> larRS >> maxRS >> numSmallL >> numMedL >> numLarL >> numSmallD >> numMedD >> numLarD ;
	}
      else if( ( 'S' == c ) || ( 's' == c ) )
	{
	  bool keepReading = true;
	  while(keepReading)
	    {
	      designFile >> intIn; 
	      if(0 == intIn)
		keepReading = false;
	      else
		SL.push_back(intIn);
	    }
	}
      else if( ( 'C' == c ) || ( 'c' == c ) )
	{
	  bool keepReading = true;
	  while(keepReading)
	    {
	      designFile >> intIn; 
	      if(0 == intIn)
		keepReading = false;
	      else
		CW.push_back(intIn);
	    }
	}
      else if( ( 'G' == c ) || ( 'g' == c ) )
	{//roomsize depending on tunnelwidth
	  designFile >> c;
	  int in1 , in2 , in3;
	  if('S' == c)   //sideways rooms
	    {
	      bool keepReading = true;
	      while(keepReading)
		{
		  designFile >> in1 >> in2 >> in3;
		  if( ( 100 != in1+in2+in3 ) || ( in1 < 0 ) || ( in2 < 0 ) || ( in3 < 0 ) )
		    {
		      cout << "Bailing out because roomSize probabilities have illegal values : " << in1 << " , " << in2 << " , " << in3 << endl; 
		      return(false);
		    }
		  TripleInt in(in1 , in2 , in3);
		  RSPS.push_back(in);
		  if( 100 == in3 )
		    keepReading = false;
		}
	    }
	  else if('B' == c)   //branching rooms
	    {
	      bool keepReading = true;
	      while(keepReading)
		{
		  designFile >> in1 >> in2 >> in3;
		  if( ( 100 != in1+in2+in3 ) || ( in1 < 0 ) || ( in2 < 0 ) || ( in3 < 0 ) )
		    {
		      cout << "Bailing out because roomSize probabilities have illegal values : " << in1 << " , " << in2 << " , " << in3 << endl; 
		      return(false);
		    }
		  TripleInt in(in1 , in2 , in3);
		  RSPB.push_back(in);
		  if( 100 == in3 )
		    keepReading = false;
		}
	    }
	}
      else if( ( 'F' == c ) || ( 'f' == c ) )
	{
	  bool keepReading = true;
	  while(keepReading)
	    {
	      designFile >> intIn; 
	      aRP.push_back(intIn);
	      if(100 == intIn)
		keepReading = false;
	    }
	}
      else if( ( 'J' == c ) || ( 'j' == c ) )
	{
	  bool keepReading = true;
	  while(keepReading)
	    {
	      designFile >> intIn; 
	      if(-1 == intIn)
		keepReading = false;
	      else
		jP.push_back(intIn);
	    }
	}
      else if( ( 'A' == c ) || ( 'a' == c ) )
	{
	  designFile >> c;
	  if('C' == c)   //Crawlers
	    {
	      bool keepReading = true;
	      while(keepReading)
		{
		  designFile >> intIn; 
		  if(0 == intIn)
		    keepReading = false;
		  else
		    MAC.push_back(intIn);
		}
	    }
	  if('T' == c)   //Tunnelers
	    {
	      bool keepReading = true;
	      while(keepReading)
		{
		  designFile >> intIn; 
		  if(0 == intIn)
		    keepReading = false;
		  else
		    MAT.push_back(intIn);
		}
	    }
	}
      else if( ( 'Z' == c ) || ( 'z' == c ) )
	{
	  designFile >> c;
	  if('U' == c)   //sizeUpProb
	    {
	      bool keepReading = true;
	      while(keepReading)
		{
		  designFile >> intIn; 
		  if(-1 == intIn)
		    keepReading = false;
		  else
		    sUpP.push_back(intIn);
		}
	    }
	  else if('D' == c)   //sizeDownProb
	    {
	      bool keepReading = true;
	      while(keepReading)
		{
		  designFile >> intIn; 
		  if(-1 == intIn)
		    keepReading = false;
		  else
		    sDownP.push_back(intIn);
		}
	    }
	}
      else if( ( 'E' == c ) || ( 'e' == c ) )
	{//MOBs in labyrinth
	  designFile >> c;
	  if('1' == c)   //in rooms
	    {
	      designFile >> gSMOBLR >> gSVMOBLR;
	      bool keepReading = true;
	      while(keepReading)
		{
		  designFile >> intIn; 
		  if(intIn < 0)
		    keepReading = false;
		  else
		    MLR.push_back(intIn);
		}
	    }
	  else if('2' == c)   //in open
	    {
	      //	      designFile >> gSMOBLO >> gSVMOBLO;
	      bool keepReading = true;
	      while(keepReading)
		{
		  designFile >> intIn; 
		  if(intIn < 0)
		    keepReading = false;
		  else
		    MLO.push_back(intIn);
		}
	    }
	}
      else if( ( 'H' == c ) || ( 'h' == c ) )
	{//MOBs in dungeon
	  designFile >> c;
	  if('1' == c)   //in rooms
	    {
	      designFile >> gSMOBDR >> gSVMOBDR;
	      bool keepReading = true;
	      while(keepReading)
		{
		  designFile >> intIn; 
		  if(intIn < 0)
		    keepReading = false;
		  else
		    MDR.push_back(intIn);
		}
	    }
	  else if('2' == c)   //in open
	    {
	      designFile >> iARP;
	      bool keepReading = true;
	      while(keepReading)
		{
		  designFile >> intIn; 
		  if(intIn < 0)
		    keepReading = false;
		  else
		    MDO.push_back(intIn);
		}
	    }
	}
      else if( ( 'I' == c ) || ( 'i' == c ) )
	{//treasure
	  designFile >> c;
	  if('1' == c)  // in labyrinth
	    {
	      designFile >> gSTreasL >> gSVTreasL;
	      bool keepReading = true;
	      while(keepReading)
		{
		  designFile >> intIn; 
		  if(intIn < 0)
		    keepReading = false;
		  else
		    TIL.push_back(intIn);
		}
	    }
	  else if('2' == c)   //in dungeon
	    {
	      designFile >> gSTreasD >> gSVTreasD;
	      bool keepReading = true;
	      while(keepReading)
		{
		  designFile >> intIn; 
		  if(intIn < 0)
		    keepReading = false;
		  else
		    TID.push_back(intIn);
		}
	    }
	}
      else if( ( 'K' == c ) || ( 'k' == c ) )
	{ //randCrawlers per generation
	  bool keepReading = true;
	  while(keepReading)
	    {
	      designFile >> intIn; 
	      if(99 == intIn)
		keepReading = false;
	      else
		rCPG.push_back(intIn);
	    }
	}
      else if( ( 'P' == c ) || ( 'p' == c) )
	{//read in a line wiTH genetic params for randCrawlers
	  designFile >> c; 
	  if('R' == c)
	    {//RandCrawler stats
	      designFile >> rC_sSSP >> rC_sDSP >> rC_tSSP >> rC_tDSP >> rC_cDP;

	      if(rC_sSSP < 0)   rC_sSSP = 0;
	      if(rC_sSSP > 100) rC_sSSP = 100;
	      if(rC_sDSP < 0)   rC_sDSP = 0;
	      if(rC_sDSP > 100) rC_sDSP = 100;
	      if(rC_tSSP < 0)   rC_tSSP = 0;
	      if(rC_tSSP > 100) rC_tSSP = 100;
	      if(rC_tDSP < 0)   rC_tDSP = 0;
	      if(rC_tDSP > 100) rC_tDSP = 100;
	      if(rC_cDP < 0)   rC_cDP = 0;
	      if(rC_cDP > 100) rC_cDP = 100;
	    }
	  else if('T' == c)
	    {//Crawler seeded in tunnels
	      designFile >> TCS.maxAge >> TCS.sL >> TCS.sSSP >> TCS.sDSP >> TCS.tSSP >>  TCS.tDSP >> TCS.cDP >> tCCP;

	      if(TCS.sSSP < 0)   TCS.sSSP = 0;
	      if(TCS.sSSP > 100) TCS.sSSP = 100;
	      if(TCS.sDSP < 0)   TCS.sDSP = 0;
	      if(TCS.sDSP > 100) TCS.sDSP = 100;
	      if(TCS.tSSP < 0)   TCS.tSSP = 0;
	      if(TCS.tSSP > 100) TCS.tSSP = 100;
	      if(TCS.tDSP < 0)   TCS.tDSP = 0;
	      if(TCS.tDSP > 100) TCS.tDSP = 100;
	      if(TCS.cDP < 0)   TCS.cDP = 0;
	      if(TCS.cDP > 100) TCS.cDP = 100;
	    }
	  else if('U' == c)
	    {//last chance Tunnelers
	      designFile >> lCT.mRLP >> lCT.mRRP >> lCT.cDP >> lCT.sDSP >> lCT.tDSP >> gDLC;

	      if(gDLC < 1)       gDLC = 1;

	      if(lCT.mRLP < 0)   lCT.mRLP = 0;
	      if(lCT.mRLP > 100) lCT.mRLP = 100;
	      if(lCT.sDSP < 0)   lCT.sDSP = 0;
	      if(lCT.sDSP > 100) lCT.sDSP = 100;
	      if(lCT.mRRP < 0)   lCT.mRRP = 0;
	      if(lCT.mRRP > 100) lCT.mRRP = 100;
	      if(lCT.tDSP < 0)   lCT.tDSP = 0;
	      if(lCT.tDSP > 100) lCT.tDSP = 100;
	      if(lCT.cDP < 0)   lCT.cDP = 0;
	      if(lCT.cDP > 100) lCT.cDP = 100;
	    }
	}
      else if( ( 'D' == c ) || ( 'd' == c ) )
	{
	  designFile >> dX >> dY >> bg >> jD >> tJD;
	  do
	    {
	      designFile >> d;
	      if(d != XX)
		op.push_back(d);
	      else
		{
		  designFile.putback('X');
		  designFile.putback('X');
		  break;
		}
	    }while(true);
/////////////////////////this doesn't work because <sstream> isn't available
// 	  //now read in openings
// 	  getline(designFile , str);
// 	  istringstream ist(str);  //turning str into a stringstream
// 	  while(ist >> d) //putting whitespace-separated parts of the string into d
// 	    op.push_back(d);
////////////////////////////////////////////////////////////////////pity;-(
	}
  }while(true);
  return(true);
}

/////////////////end Config methods

/////////////////////////////start Builder methods

alifegames::Builder::Builder(DungeonMaker* pdm , IntCoordinate loc , IntCoordinate fwd , int a , int mA , int g): pDM(pdm) , Location(loc) , Forward(fwd) , age(a) , maxAge(mA) , generation(g)
{
  ///////////////////////////DEBUG - failed//////////////////////////////////////
  assert( ( Forward.first == 0 && ( Forward.second == -1 || Forward.second == 1 ) )
 	    || ( Forward.second == 0 && ( Forward.first == -1 || Forward.first == 1 ) ) );
  assert( ( Location.first >= 0 ) && ( Location.second >= 0 )  && ( Location.first < pDM->GetDimX() ) && ( Location.second < pDM->GetDimY() ) );
}

alifegames::Builder::~Builder()
{
  //nothing to do, nowhere to go...
}

/////////////////////////////end Builder methods   

////////////////////////////////start WallCrawler methods

alifegames::WallCrawler::WallCrawler( DungeonMaker* pdm , IntCoordinate loc , IntCoordinate fwd , int a , int mA , int g , IntCoordinate intDir , int sL ,  int o, int cW , int sSSP , int sDSP , int tSSP , int tDSP , int cDP )
  : alifegames::Builder::Builder( pdm , loc , fwd , a , mA , g) ,
			 intDirection(intDir) , stepLength(sL) , opening(o) , corridorWidth(cW) , straightSingleSpawnProb(sSSP) , straightDoubleSpawnProb(sDSP) , turnSingleSpawnProb(tSSP) , turnDoubleSpawnProb(tDSP) , changeDirProb(cDP)
{
  assert(corridorWidth >= 0 );
}

alifegames::WallCrawler::~WallCrawler()
{
  //nothing to destroy
}

int alifegames::WallCrawler::FrontFree( IntCoordinate Position , IntCoordinate Heading , int& leftFree , int& rightFree )
{
  assert( (leftFree >= 1 ) &&  (rightFree >= 1 ) );
  //must hold, make sure no smaller parameters are ever passed

  //returns the number of rows free in front of Position, looking towards Heading
  //make sure the input is legal:
  int dX =  pDM -> GetDimX();   //we need that often later on
  int dY =  pDM -> GetDimY();
  assert( ( Position.ShowX() >= 0 ) && ( Position.ShowY() >= 0 ) &&
	  ( Position.ShowX() < dX ) && ( Position.ShowY() < dY ) );

  assert( ( ( Heading.ShowX() == 0 ) && ( ( Heading.ShowY() == 1 ) || ( Heading.ShowY() == -1 ) ) )
	  || ( ( Heading.ShowY() == 0 ) && ( ( Heading.ShowX() == 1 ) || ( Heading.ShowX() == -1 ) ) ) );

  int frontFree = -1;    //impossible value indicates parameter not found yet

  IntCoordinate Right;
  IntCoordinate Test;

    //assign the "Right" direction based on Heading

  if( Heading.ShowX( ) == 0 )
    {
      IntCoordinate Temp( Heading.ShowY() , 0 );
      Right = Temp;
    }
  else if( Heading.ShowY( ) == 0 )
    {
      IntCoordinate Temp(0 , - Heading.ShowX() );
      Right = Temp;
    }
    //check in the direction of Heading in front of Position whether we encounter a non-floor tile
    //we check with a width of (leftFree + 1 + rightFree) - leftFree and rightFree must be at elast corrWidth
  int checkDist = 0;     //zero is the line of Position - we start one line ahead of that
  SquareData datAtTest;
  while( -1 == frontFree )
    {//the extension of the box has not been found yet - we do that now
      ++checkDist;  // = 1 when we first enter here
      for(int i = -leftFree; i <= rightFree; ++i)
 	{
	  Test = Position + i * Right + checkDist * Heading;
// 	    //first check whether we are in legal territory
	  if( ( Test.ShowX() < 0 ) || ( Test.ShowY() < 0 ) || ( Test.ShowX() >= dX ) || ( Test.ShowY() >= dY ) )
 	    {//we are outside the map and must not try to access map data - consider the place blocked
	      frontFree = checkDist - 1;
	      break;  //stop the for loop
 	    }
	  else 
	    datAtTest = pDM -> GetMap( Test.ShowX() , Test.ShowY() );
	  //now check whether this is open and buildable
	  if( pDM -> CrawlersInTunnels() && pDM -> CrawlersInAnterooms() )
	    {//here we're also allowing IT_OPEN and IA_OPEN
	      if( ( (i == 0) &&  ( datAtTest != OPEN ) && ( datAtTest != NJ_OPEN ) && ( datAtTest != IT_OPEN ) && ( datAtTest != IA_OPEN ) )   //we are blocked
		  || ( ( datAtTest != OPEN ) && ( datAtTest != NJ_OPEN ) && ( datAtTest != IT_OPEN ) && ( datAtTest != IA_OPEN ) && ( datAtTest != G_OPEN ) && ( datAtTest != NJ_G_OPEN ) ) )
		//away from the center line, we can have squares that are guaranteed-open, but not on the center line
		//where we want to build the wall
		{
		  frontFree = checkDist - 1;
		  break;  //stop the for loop
		}
	    }
	  else if( pDM -> CrawlersInTunnels() )
	    {//here we're also allowing IT_OPEN but not IA_OPEN
	      if( ( (i == 0) &&  ( datAtTest != OPEN ) && ( datAtTest != NJ_OPEN ) && ( datAtTest != IT_OPEN ) )   //we are blocked
		  || ( ( datAtTest != OPEN ) && ( datAtTest != NJ_OPEN ) && ( datAtTest != IT_OPEN ) && ( datAtTest != G_OPEN ) && ( datAtTest != NJ_G_OPEN ) ) )
		//away from the center line, we can have squares that are guaranteed-open, but not on the center line
		//where we want to build the wall
		{
		  frontFree = checkDist - 1;
		  break;  //stop the for loop
		}
	    }
	  else
	    {
	      if( ( (i == 0) &&  ( datAtTest != OPEN ) && ( datAtTest != NJ_OPEN ) )   //we are blocked
		  || ( ( datAtTest != OPEN ) && ( datAtTest != NJ_OPEN ) && ( datAtTest != G_OPEN ) && ( datAtTest != NJ_G_OPEN ) ) )
		//away from the center line, we can have squares that are guaranteed-open, but not on the center line
		//where we want to build the wall
		{
		  frontFree = checkDist - 1;
		  break;  //stop the for loop
		}
	    }
 	}
     }//frontFree is the number of rows that are free in front of the row that contains the Builder head
      //which is always situated on a wall tile
  assert(frontFree >= 0);   //must have been changed in while loop

  //now check to the sides to see which updated values for leftFree and rightFree can be returned
  if(frontFree > 0)
    {//code not valid for frontFree == 0
      checkDist = leftFree;
      bool done = false;
      while(!done)  //checking towards the left
	{
	  ++checkDist;   // = leftFree+1 when we first enter here
	  for(int i = 1; i <= frontFree; i++)
	    {
	      Test = Position - checkDist * Right + i * Heading;  //we now check parallel to our line of sight, going further out to the left
	      if( ( Test.ShowX() < 0 ) || ( Test.ShowY() < 0 ) || ( Test.ShowX() >= dX ) || ( Test.ShowY() >= dY ) )
		{//we are outside the map and must not try to access map data - consider the place blocked
		  leftFree = checkDist - 1;
		  done = true;
		  break;  //stop the for loop
		}
	      else 
		datAtTest = pDM -> GetMap( Test.ShowX() , Test.ShowY() );
	      //now check whether this is open
	      if(pDM -> CrawlersInTunnels() && pDM -> CrawlersInAnterooms() )
		{//here we're also allowing IT_OPEN and IA_OPEN
		  if( ( datAtTest != OPEN ) && ( datAtTest != NJ_OPEN ) && ( datAtTest != G_OPEN ) && ( datAtTest != IT_OPEN ) && ( datAtTest != IA_OPEN ) && ( datAtTest != NJ_G_OPEN ) )
		    //encountered a non-floor square
		    {
		      leftFree = checkDist - 1;
		      done = true;
		      break;  //stop the for loop
		    }
		}
	      else if(pDM -> CrawlersInTunnels() )
		{//here we're also allowing IT_OPEN but not IA_OPEN
		  if( ( datAtTest != OPEN ) && ( datAtTest != NJ_OPEN ) && ( datAtTest != G_OPEN ) && ( datAtTest != IT_OPEN ) && ( datAtTest != NJ_G_OPEN ) )
		    //encountered a non-floor square
		    {
		      leftFree = checkDist - 1;
		      done = true;
		      break;  //stop the for loop
		    }
		}
	      else
		{
		  if( ( datAtTest != OPEN ) && ( datAtTest != NJ_OPEN ) && ( datAtTest != G_OPEN ) && ( datAtTest != NJ_G_OPEN ) )
		    //encountered a non-floor square
		    {
		      leftFree = checkDist - 1;
		      done = true;
		      break;  //stop the for loop
		    }
		}
	    }
	}  //while !done

      checkDist = rightFree;
      done = false;
      while(!done)  //checking towards the right
	{
	  ++checkDist;   // = rightFree+1 when we first enter here
	  for(int i = 1; i <= frontFree; i++)
	    {
	      Test = Position + checkDist * Right + i * Heading;  //we now check parallel to our line of sight, going further out to the right
	      if( ( Test.ShowX() < 0 ) || ( Test.ShowY() < 0 ) || ( Test.ShowX() >= dX ) || ( Test.ShowY() >= dY ) )
		{//we are outside the map and must not try to access map data - consider the place blocked
		  rightFree = checkDist - 1;
		  done = true;
		  break;  //stop the for loop
		}
	      else 
		datAtTest = pDM -> GetMap( Test.ShowX() , Test.ShowY() );
	      //now check whether this is open
	      if(pDM -> CrawlersInTunnels() && pDM -> CrawlersInAnterooms() )
		{//here we're also allowing IT_OPEN and IA_OPEN
		  if( ( datAtTest != OPEN ) && ( datAtTest != NJ_OPEN ) && ( datAtTest != G_OPEN ) && ( datAtTest != IT_OPEN ) && ( datAtTest != IA_OPEN ) && ( datAtTest != NJ_G_OPEN ) )
		    //encountered a non-floor square
		    {
		      rightFree = checkDist - 1;
		      done = true;
		      break;  //stop the for loop
		    }
		}
	      else if(pDM -> CrawlersInTunnels() )
		{//here we're also allowing IT_OPEN but not IA_OPEN
		  if( ( datAtTest != OPEN ) && ( datAtTest != NJ_OPEN ) && ( datAtTest != G_OPEN ) && ( datAtTest != IT_OPEN ) && ( datAtTest != NJ_G_OPEN ) )
		    //encountered a non-floor square
		    {
		      rightFree = checkDist - 1;
		      done = true;
		      break;  //stop the for loop
		    }
		}
	      else
		{
		  if( ( datAtTest != OPEN ) && ( datAtTest != NJ_OPEN ) && ( datAtTest != G_OPEN ) && ( datAtTest != NJ_G_OPEN ) )
		    //encountered a non-floor square
		    {
		      rightFree = checkDist - 1;
		      done = true;
		      break;  //stop the for loop
		    }
		}
	    }
	}  //while !done
    }

  return(frontFree);
}

bool alifegames::WallCrawler::StepAhead( void )
{
  if(generation != pDM -> GetActiveGeneration() )
    {
      return( true );  //nothing's done with Builders of different generations
      assert(generation > pDM->GetActiveGeneration());  //make sure all old ones are actually deleted
    }
  ++age;
  if( age >= maxAge )
    return( false );
  else if( age < 0 )
    return( true );
  //if age >= maxAge, the Builder returns false and will be deleted
  //if age < 0 the builder returns true so as not to be deleted, but does not perform a step - it is dormant

  //this builds a section of wall and possibly a room, positions the crawler at a new spot, and may create new crawlers
  int leftFree = corridorWidth;
  int rightFree = corridorWidth;
  int frontFree = FrontFree( Location , Forward , leftFree , rightFree );

  IntCoordinate Right;
  IntCoordinate Left;
  IntCoordinate Test;

  //assign the "Right" direction based on Forward (which is a member of Builder)
  if( Forward.ShowX( ) == 0 )
    {
      IntCoordinate Temp( Forward.ShowY() , 0 );
      Right = Temp;
      Left = - Right; 
    }
  else if( Forward.ShowY( ) == 0 )
    {
      IntCoordinate Temp(0 , - Forward.ShowX() );
      Right = Temp;
      Left = - Right;
    }
  else
    assert(false);  //illegal value of Forward, member of Builder - not a direction

  //if we want to join up with a wall up front, do so now
  if( ( 0 == opening ) && ( frontFree < pDM -> GetJoinDist() ) )
    {
      if( Join( frontFree ) )
	return( false );   //the wall has been joined, the crawler will be deleted
    }

  int tilesLaid = stepLength;
  if( frontFree > corridorWidth )  //we can place at least one wall tile without becoming too narrow
    {
      //we build wall tiles in the heading of the crawler - determine how many
      if( (frontFree - corridorWidth) < stepLength)
	tilesLaid = frontFree - corridorWidth;

      for(int i = 1; i <= tilesLaid; ++i)
 	{
	  Test = Location + i*Forward;
	  if(1 == opening)
	    pDM -> SetMap( Test.ShowX() , Test.ShowY() , CLOSED);
	  else
	    {
	      assert(0 == opening);
	      pDM -> SetMap( Test.ShowX() , Test.ShowY() , NJ_CLOSED);  //otherwise closed spaces can form
	    }
	}

      //now relocate the crawler at the front of this wall section, possibly changing direction
      //right now Test is where we laid the last floor tile, and where the crawler should move
      Location = Test;

      //now... creating parameters needed for making babies
      int diceRoll = rand()%101;
      unsigned int babyGeneration = generation + 1;   //default
      int summedProbs = 0;
      for(unsigned int ind = 0; ind <= 10; ind++)
	{
	  summedProbs = summedProbs +  pDM -> GetBabyDelayProbsForGenerationC(ind);
	  if (diceRoll < summedProbs)
	    {
	      babyGeneration = generation + ind;
	      break;
	    }
	}
      //determine other parameters
//       int rP = pDM -> Mutate(roomProb);  //range [roomProb - mutator , roomProb + mutator], roomProb inherited from parent

      int sSSP =  pDM -> Mutate(straightSingleSpawnProb);

      int sDSP =  pDM -> Mutate(straightDoubleSpawnProb);  

      int tSSP =  pDM -> Mutate(turnSingleSpawnProb);

      int tDSP =  pDM -> Mutate(turnDoubleSpawnProb);   

      int cDP =  pDM -> Mutate(changeDirProb);   
      ///////////////////end making baby parameters

      if( (rand()%100) < changeDirProb )   //roll of the dice
 	{// change the direction
 	  //keep the old direction for future reference
 	  IntCoordinate OldForward(Forward);
	  //first compare the current heading to the intended heading to see where we can go
 	  if( ( ( intDirection.ShowX( ) == 0 ) && ( intDirection.ShowY( ) == 0 ) ) ||   //we can go anywhere
 	      ( ( intDirection.ShowX( ) == Forward.ShowX( ) ) && ( intDirection.ShowY( ) == Forward.ShowY( ) ) ) )
 	    {//we can go left or right as we choose,  and go randomly in 50% of the cases
 	      int random = rand() % 4;
	      if( 0 == random )
		Forward = Right;
 	      else if( 1 == random )
		Forward = Left;
 	      else
		{//we go where there is more room
 		  if( (rightFree > leftFree) || ( ( rightFree == leftFree ) && ( 0 == (rand()%2) ) ) )
		    Forward = Right;
		  else
		    Forward = Left;
 		}
 	    }
 	  else
	    {//the intendedHeading leaves us no choice where to go 
	      if( ( 0 == intDirection.ShowX( ) ) || ( 0 == intDirection.ShowY(  ) ) )
		//the intended heading is one of the four pure directions, and our new heading must be the intended heading
		Forward = intDirection;
	      else
		{//the intended heading must be in one of the four intermediate directions
		  assert( ( 0 != intDirection.ShowX( ) ) && ( 0 != intDirection.ShowY( ) ) ); 
		  Forward = intDirection - Forward;
		}
	    }

	  //make babies now
	  if( (rand()%101) < turnDoubleSpawnProb )
	    {//we create two balies
	      IntCoordinate iD(-Forward);    //same as direction when it is being created
	      if( (rand()%101) < pDM -> GetNoHeadingProb() )
		iD = 0 * iD;  //set to (0 , 0) to indicate no intended heading
	      pDM ->  CreateCrawler( Location , - Forward , 0 , pDM -> GetMaxAgeC(babyGeneration) , babyGeneration , iD , pDM -> GetStepLength(babyGeneration) , 1 , pDM -> GetCorrWidth(babyGeneration) , sSSP , sDSP , tSSP , tDSP , cDP );

	      iD = OldForward;      //same as direction when it is being created
	      if( (rand()%101) < pDM -> GetNoHeadingProb() )
		iD = 0 * iD;  //set to (0 , 0) to indicate no intended heading
	      pDM ->  CreateCrawler( Location , OldForward , 0 , pDM -> GetMaxAgeC(babyGeneration) , babyGeneration , iD , pDM -> GetStepLength(babyGeneration) , 1 , pDM -> GetCorrWidth(babyGeneration) , sSSP , sDSP , tSSP , tDSP , cDP );
	    }

	  else if( (rand()%101) < turnSingleSpawnProb )
	    {//create a baby looking the other way
	      //determine intended direction
	      IntCoordinate iD(-Forward);    //same as direction when it is being created
	      if( (rand()%101) < pDM -> GetNoHeadingProb() )
		iD = 0 * iD;  //set to (0 , 0) to indicate no intended heading

	      pDM ->  CreateCrawler( Location , - Forward , 0 , pDM -> GetMaxAgeC(babyGeneration) , babyGeneration , iD , pDM -> GetStepLength(babyGeneration) , 1 , pDM -> GetCorrWidth(babyGeneration) , sSSP , sDSP , tSSP , tDSP , cDP );
	    }//end create Crawler going opposite to the new Forward direction
 	}//end if change Direction
      else //we keep going straight on
 	{//create baby if appropriate
	  if( (rand()%101) < straightDoubleSpawnProb )
	    {//we create two balies
	      IntCoordinate iD(Right);    
	      if( (rand()%101) < pDM -> GetNoHeadingProb() )
		iD = 0 * iD;  //set to (0 , 0) to indicate no intended heading
	      pDM ->  CreateCrawler( Location , Right , 0 , pDM -> GetMaxAgeC(babyGeneration) , babyGeneration , iD , pDM -> GetStepLength(babyGeneration) , 1 , pDM -> GetCorrWidth(babyGeneration) , sSSP , sDSP , tSSP , tDSP , cDP );

	      iD = Left;      
	      if( (rand()%101) < pDM -> GetNoHeadingProb() )
		iD = 0 * iD;  //set to (0 , 0) to indicate no intended heading
	      pDM ->  CreateCrawler( Location , Left , 0 , pDM -> GetMaxAgeC(babyGeneration) , babyGeneration , iD , pDM -> GetStepLength(babyGeneration) , 1 , pDM -> GetCorrWidth(babyGeneration) , sSSP , sDSP , tSSP , tDSP , cDP );
	    }//end create two baies

	  else if( (rand()%101) < straightSingleSpawnProb )
	    {//create a baby looking sideways
	      if((leftFree > rightFree) || ( ( leftFree == rightFree ) && ( (rand()%2) == 0 ) ) )
		Test = Left;
	      else
		Test = Right;
	      //however, in a third of all cases, we choose the other side:
	      if(0 == (rand()%3) )
		Test = - Test;;

	      //determine intended direction
	      IntCoordinate iD(Test);    //same as direction when it is being created
	      if( (rand()%101) < pDM -> GetNoHeadingProb() )
		iD = 0 * iD;  //set to (0 , 0) to indicate no intended heading

	      pDM ->  CreateCrawler( Location , Test , 0 , pDM -> GetMaxAgeC(babyGeneration) , babyGeneration , iD , pDM -> GetStepLength(babyGeneration) , 1 , pDM -> GetCorrWidth(babyGeneration) , sSSP , sDSP , tSSP , tDSP , cDP );
	    }//end create single Crawler when going straight
 	}//end we go straight, making baies section
     }
   else //we have : frontFree <= corridorWidth
     {
       int cW1 = corridorWidth;  //needed in several places
       int cW2 = corridorWidth; 
      //we relocate the crawler to look sideways, but only if there is more room that way
       if( ( ( ( Forward.ShowX( ) == intDirection.ShowX( ) ) && ( Forward.ShowY( ) == intDirection.ShowY( ) ) )
 	    || ( ( 0 == intDirection.ShowX( ) ) && ( 0 == intDirection.ShowY( ) ) ) ) )
 	{//we can relocate both ways, and check where we have more room

 	  int rFree = -1;  //these are different from leftFree and rightFree
 	  int lFree = -1;
 	  rFree = FrontFree(Location , Right , cW1 , cW2 );
	  cW1 = corridorWidth;  //cannot pass corridorWidth into function, gets changed
	  cW2 = corridorWidth; 
	  lFree = FrontFree(Location , Left , cW1 , cW2);

 	  if( ( rFree <= corridorWidth ) && ( lFree <= corridorWidth ) )
 	    {
 	      //we cannot relocate because there is not enough room either way to build
	      return(false);   //this crawler is toast!
	    }
 	  else  //rFree or lFree must be > corridorWidth
 	    if( ( rFree > 2*corridorWidth+1 ) && ( lFree > 2*corridorWidth+1 ) )
 	      {//lots of room on both sides, we choose randomly
		if( 0 == rand()%2 )
		  Forward = Right;
		else
		  Forward = Left;
 	      }
 	    else if( rFree > lFree )
	      Forward = Right;
 	    else if(lFree > rFree)
	      Forward = Left;
 	    else if( 0 == (rand() % 2) )//rightFree == leftFree , we go randomly after all
	      Forward = Right;
 	    else
	      Forward = Left;
	  //well, which way is Forward, Right or Left? the age old question, will it be answered here??
 	}//crawler has now been relocated
       else
 	{//we can relocate only in the direction of the intended heading
 	  if( ( 0 == intDirection.ShowX( ) ) || ( 0 == intDirection.ShowY(  ) ) )
 	    {//the intended heading is one of the four pure directions, and our new heading must be the intended heading
 	      //check whether we have room enough there
	      cW1 = corridorWidth;  //cannot pass corridorWidth into function, gets changed
	      cW2 = corridorWidth; 
 	      int dirFree = FrontFree(Location , intDirection , cW1 , cW2);
 	      if(dirFree > corridorWidth)
		Forward = intDirection;
 	      else 		  //we cannot relocate because there is not enough room either way to build
		return(false);   //this crawler is toast!
 	    }
 	  else
 	    {//the intended heading must be in one of the four intermediate directions
	      assert( ( 0 != intDirection.ShowX( ) ) && ( 0 != intDirection.ShowY( ) ) ); 
	      Test = intDirection - Forward;   //only other possible heading
	      cW1 = corridorWidth;  //cannot pass corridorWidth into function, gets changed
	      cW2 = corridorWidth; 
	      int testFree = FrontFree(Location , Test , cW1 , cW2);
	      if(testFree > corridorWidth)
		Forward = Test;
	      else		  //we cannot relocate because there is not enough room either way to build
		return(false);   //this crawler is toast!
 	    }
 	}
     }
  return( true); // to indicate success
}

bool alifegames::WallCrawler::Join( int frontFree )
{//joins the wall made by this crawler to an existing wall if possible - returns true if successful, false if nothing was done
  //parameter frontFree is passed in to avoid having to compute it again - this must be the number of rows free in front of
  //the crawler as computed by LookAhead or we get bad results
    IntCoordinate Right;
    IntCoordinate Test;
    //    IntCoordinate Head( Location );   //eliminate???

    //assign the "Right" direction based on Forward (which is a member of Builder)
    if( Forward.ShowX( ) == 0 )
      {
	IntCoordinate Temp( Forward.ShowY() , 0 );
	Right = Temp;
      }
    else if( Forward.ShowY( ) == 0 )
      {
	IntCoordinate Temp(0 , - Forward.ShowX() );
	Right = Temp;
      }
    else
      assert(false);  //illegal value of Forward, member of Builder - not a direction

    //find the location of a wall tile in row frontFree + 1 - first we check straight ahead
    Test = Location + (frontFree+1) * Forward;
    if( ( Test.ShowX() < 0 ) || ( Test.ShowY() < 0 ) || ( Test.ShowX() >= pDM -> GetDimX() ) || ( Test.ShowY() >= pDM -> GetDimY() ) )  
      return(false);//we have started outside the dungeon

    SquareData type = pDM -> GetMap( Test.ShowX( ) , Test.ShowY( ) );
    if( ( CLOSED == type ) || ( G_CLOSED == type ) )   //this is a joinable wall tile
    {
	for(int i = 1; i <= frontFree; ++i)
	{
	  Test = Location + i*Forward;
	  if( ( Test.ShowX() < 0 ) || ( Test.ShowY() < 0 ) || ( Test.ShowX() >= pDM -> GetDimX() ) || ( Test.ShowY() >= pDM -> GetDimY() ) )  
	    return(false);
	  pDM -> SetMap( Test.ShowX( ) , Test.ShowY( ) , NJ_CLOSED );  //these guys cannot be joined, or closed spaces are possible
	}
    	return( true );   //the wall has been joined
    }
    else if( ( NJ_CLOSED == type ) || ( NJ_G_CLOSED == type ) )    //a non-joinable type is straight ahead, we bail out
        return(false);

    //now we have to check sideways, which is much more difficult - however, if we don;t do that, too many walls stay unconnected
    IntCoordinate Wall;
    int sidestep = 0;
    for(int i = 1; i <= corridorWidth; ++i)
    {
      Test = Location + i*Right + (frontFree+1)*Forward;
      if( ( Test.ShowX() < 0 ) || ( Test.ShowY() < 0 ) || ( Test.ShowX() >= pDM -> GetDimX() ) || ( Test.ShowY() >= pDM -> GetDimY() ) )  
	return(false);//we have started outside the dungeon
      type = pDM -> GetMap( Test.ShowX( ) , Test.ShowY( ) );

      if( (CLOSED == type) || ( G_CLOSED == type ) || (NJ_CLOSED == type) || ( NJ_G_CLOSED == type ) )
	{
	  Wall = Test;
	  sidestep = i;
	  break;   //end the for loop
	}
	//now the same thing towards the other side
      Test = Location - i*Right + (frontFree+1)*Forward;
      if( ( Test.ShowX() < 0 ) || ( Test.ShowY() < 0 ) || ( Test.ShowX() >= pDM -> GetDimX() ) || ( Test.ShowY() >= pDM -> GetDimY() ) )  
	return(false);//we have started outside the dungeon
      type = pDM -> GetMap( Test.ShowX( ) , Test.ShowY( ) );

      if( (CLOSED == type) || ( G_CLOSED == type ) || (NJ_CLOSED == type) || ( NJ_G_CLOSED == type ) )
	{
	  Wall = Test;
	  sidestep = -i;
	  break;   //end the for loop
	}
    }//checking the width of the corridor

    if( (0 != Wall.ShowX() ) || (0 != Wall.ShowY() ) )  //we must have found a wall tile, or else the value of frontFree was wrong 
                                       //that's assuming we passed in corrWidth for leftFree and rightFree ---   DO THAT ALWAYS
      return(false);    //in rare instances wew return from here, wonder why
    if(sidestep != 0)
      return(false);    //failed assert replaced with this
    if( (NJ_CLOSED == type) || ( NJ_G_CLOSED == type ) )   //this is a grid type that we cannot connect a wall to
        return( false );

    //if we get here, Wall is the position of a joinable wall tile. Now check whether we can get there without blocking paths to the side
    //    int mCW = pDungeonMaker -> ShowMCW();   //if we use the current corridorWidth, too many Crawlers never close their walls
    if(sidestep < 0)   //Wall is to the left, look rig
      Test = Right;
    else  //Wall is to the right, look left
      Test = -Right;

    int left = 1;
    int right = 1;
    int free = FrontFree(Wall , Test , left , right);  //if free >= 1 + abs(sidestep) we can build a connecting wall without blocking another corridor
    int abs_sidestep, factor_sidestep;
    if(sidestep > 0)
      {
	abs_sidestep = sidestep;
	factor_sidestep = 1;
      }
    else
      {
	abs_sidestep = - sidestep;
	factor_sidestep = - 1;
      }
    if(free < abs_sidestep + 1)
        return( false );

    //if we get here there is enough room to construct the connecting wall, so we do it
    for(int i = 1; i <= frontFree + 1; ++i)
    {
      Test = Location + i*Forward;
      if( ( Test.ShowX() < 0 ) || ( Test.ShowY() < 0 ) || ( Test.ShowX() >= pDM -> GetDimX() ) || ( Test.ShowY() >= pDM -> GetDimY() ) )  
	return(false);//we have started outside the dungeon
      pDM -> SetMap( Test.ShowX( ) , Test.ShowY( ) , NJ_CLOSED );
    }
    //this has built the straight section forward, now turn left or right
    for(int i = 1; i < abs_sidestep; ++i)
    {
      Test = Location + (i*factor_sidestep)*Right + (frontFree+1)*Forward;
      if( ( Test.ShowX() < 0 ) || ( Test.ShowY() < 0 ) || ( Test.ShowX() >= pDM -> GetDimX() ) || ( Test.ShowY() >= pDM -> GetDimY() ) )  
	return(false);//we have started outside the dungeon
      pDM -> SetMap( Test.ShowX( ) , Test.ShowY( ) , NJ_CLOSED );
    }

    return( true );   //the wall hath been joined !! (we hope)
}

////////////////////////////////end WallCrawler methods

/////////////////////////////////////////Tunneler starts here/////////////////

alifegames::Tunneler::Tunneler( DungeonMaker* pdm , IntCoordinate loc , IntCoordinate fwd , int a , int mA , int g , IntCoordinate intDir , int sL , int tW , int sDSP , int tDSP , int cDP , int mRRP , int mRLP , int jP )
  : alifegames::Builder::Builder( pdm , loc , fwd , a , mA , g) ,
			 intDirection(intDir) , stepLength(sL) , tunnelWidth(tW) , straightDoubleSpawnProb(sDSP) , turnDoubleSpawnProb(tDSP) , changeDirProb(cDP) , makeRoomsRightProb(mRRP) , makeRoomsLeftProb(mRLP) , joinPreference(jP) {}

alifegames::Tunneler::~Tunneler()
{
  //nada
}

int alifegames::Tunneler::FrontFree( IntCoordinate Position , IntCoordinate Heading , int& leftFree , int& rightFree )
{
  assert( (leftFree >= 1 ) &&  (rightFree >= 1 ) );
  //must hold, make sure no smaller parameters are ever passed

  //returns the number of rows free in front of Position, looking towards Heading
  //make sure the input is legal:
  int dX =  pDM -> GetDimX();   //we need that often later on
  int dY =  pDM -> GetDimY();
  assert( ( Position.ShowX() >= 0 ) && ( Position.ShowY() >= 0 ) &&
	  ( Position.ShowX() < dX ) && ( Position.ShowY() < dY ) );

  assert( ( ( Heading.ShowX() == 0 ) && ( ( Heading.ShowY() == 1 ) || ( Heading.ShowY() == -1 ) ) )
	  || ( ( Heading.ShowY() == 0 ) && ( ( Heading.ShowX() == 1 ) || ( Heading.ShowX() == -1 ) ) ) );

  int frontFree = -1;    //impossible value indicates parameter not found yet

  IntCoordinate Right;
  IntCoordinate Test;

    //assign the "Right" direction based on Heading

  if( Heading.ShowX( ) == 0 )
    {
      IntCoordinate Temp( Heading.ShowY() , 0 );
      Right = Temp;
    }
  else if( Heading.ShowY( ) == 0 )
    {
      IntCoordinate Temp(0 , - Heading.ShowX() );
      Right = Temp;
    }
    //check in the direction of Heading in front of Position whether we encounter a non-CLOSED tile
    //we check with a width of (leftFree + 1 + rightFree) - leftFree and rightFree must be at elast corrWidth
  int checkDist = 0;     //zero is the line of Position - we start one line ahead of that
  SquareData datAtTest;
  while( -1 == frontFree )
    {//the extension of the box has not been found yet - we do that now
      ++checkDist;  // = 1 when we first enter here
      for(int i = -leftFree; i <= rightFree; ++i)
 	{
	  Test = Position + i * Right + checkDist * Heading;
 	    //first check whether we are in legal territory
	  if( ( Test.ShowX() < 0 ) || ( Test.ShowY() < 0 ) || ( Test.ShowX() >= dX ) || ( Test.ShowY() >= dY ) )
 	    {//we are outside the map and must not try to access map data - consider the place blocked
	      frontFree = checkDist - 1;
	      break;  //stop the for loop
 	    }
	  else 
	    datAtTest = pDM -> GetMap( Test );
	  //now check whether this is CLOSED and can be tunneled through
	  if( (datAtTest != CLOSED) &&  (datAtTest != NJ_CLOSED) )   //we are blocked
	    {
	      frontFree = checkDist - 1;
	      break;  //stop the for loop
	    }
 	}
     }//frontFree is the number of rows that are free in front of the row that contains the Builder head
      //which is always situated on a wall tile
  assert(frontFree >= 0);   //must have been changed in while loop

  //now check to the sides to see which updated values for leftFree and rightFree can be returned
  if(frontFree > 0)
    {//code not valid for frontFree == 0
      checkDist = leftFree;
      bool done = false;
      while(!done)  //checking towards the left
	{
	  ++checkDist;   // = leftFree+1 when we first enter here
	  for(int i = 1; i <= frontFree; i++)
	    {
	      Test = Position - checkDist * Right + i * Heading;  //we now check parallel to our line of sight, going further out to the left
	      if( ( Test.ShowX() < 0 ) || ( Test.ShowY() < 0 ) || ( Test.ShowX() >= dX ) || ( Test.ShowY() >= dY ) )
		{//we are outside the map and must not try to access map data - consider the place blocked
		  leftFree = checkDist - 1;
		  done = true;
		  break;  //stop the for loop
		}
	      else 
		datAtTest = pDM -> GetMap( Test.ShowX() , Test.ShowY() );
	      //now check whether this is CLOSED and can be tunneled through
	      if( (datAtTest != CLOSED) &&  (datAtTest != NJ_CLOSED) )   //we are blocked
		{
		  leftFree = checkDist - 1;
		  done = true;
		  break;  //stop the for loop
		}
	    }
	}  //while !done

      checkDist = rightFree;
      done = false;
      while(!done)  //checking towards the right
	{
	  ++checkDist;   // = rightFree+1 when we first enter here
	  for(int i = 1; i <= frontFree; i++)
	    {
	      Test = Position + checkDist * Right + i * Heading;  //we now check parallel to our line of sight, going further out to the right
	      if( ( Test.ShowX() < 0 ) || ( Test.ShowY() < 0 ) || ( Test.ShowX() >= dX ) || ( Test.ShowY() >= dY ) )
		{//we are outside the map and must not try to access map data - consider the place blocked
		  rightFree = checkDist - 1;
		  done = true;
		  break;  //stop the for loop
		}
	      else 
		datAtTest = pDM -> GetMap( Test.ShowX() , Test.ShowY() );
	      //now check whether this is CLOSED and can be tunneled through
	      if( (datAtTest != CLOSED) &&  (datAtTest != NJ_CLOSED) )   //we are blocked
		{
		  rightFree = checkDist - 1;
		  done = true;
		  break;  //stop the for loop
		}
	    }
	}  //while !done
    }

  return(frontFree);
}

bool alifegames::Tunneler::StepAhead( void )
{
  if(generation != pDM -> GetActiveGeneration() )
    {
      return( true );  //nothing's done with Builders of different generations
      assert(generation > pDM->GetActiveGeneration());  //make sure all old ones are actually deleted
    }
  ++age;
  if( age >= maxAge )
    return( false );
  else if( age < 0 )
    return( true );

  //if age >= maxAge, the Builder returns false and will be deleted
  //if age < 0 the builder returns true so as not to be deleted, but does not perform a step - it is dormant

  assert(tunnelWidth >= 0);
  int leftFree = tunnelWidth + 1;
  int rightFree = tunnelWidth + 1;
  int frontFree = FrontFree( Location , Forward , leftFree , rightFree );
  if(frontFree == 0)
    return(false);   //can't do a thing, eliminate this Tunneler

  IntCoordinate Right;
  IntCoordinate Left;
  IntCoordinate Test;

  RoomSize szS , szB;    //sideways and branching room sizes
  int probMS , probSS , probMB , probSB ;   //L=LARGE, M=MEDIUM, S=SMALL; S=sideways, B=branching

  probMS = pDM -> GetRoomSizeProbS(tunnelWidth , MEDIUM);
  probSS = pDM -> GetRoomSizeProbS(tunnelWidth , SMALL);

  probMB = pDM -> GetRoomSizeProbB(tunnelWidth , MEDIUM);
  probSB = pDM -> GetRoomSizeProbB(tunnelWidth , SMALL);
 
  int diceRoll = rand()%100;
  if(diceRoll < probSS)
    szS = SMALL;
  else if(diceRoll < (probSS + probMS) )
    szS = MEDIUM;
  else
    szS = LARGE;

  if(diceRoll < probSB)
    szB = SMALL;
  else if(diceRoll < (probSB + probMB) )
    szB = MEDIUM;
  else
    szB = LARGE;

  //assign the "Right" direction based on Forward (which is a member of Builder)
  if( Forward.ShowX( ) == 0 )
    {
      IntCoordinate Temp( Forward.ShowY() , 0 );
      Right = Temp;
      Left = - Right; 
    }
  else if( Forward.ShowY( ) == 0 )
    {
      IntCoordinate Temp(0 , - Forward.ShowX() );
      Right = Temp;
      Left = - Right;
    }
  else
    assert(false);  //illegal value of Forward, member of Builder - not a direction

  //now... creating parameters needed for making Roomies
  diceRoll = rand()%101;
  unsigned int roomieGeneration = generation;   //default
  int summedProbs = 0;
  for(unsigned int ind = 0; ind <= 10; ind++)
    {
      summedProbs = summedProbs +  pDM -> GetBabyDelayProbsForGenerationR(ind);
      if (diceRoll < summedProbs)
	{
	  roomieGeneration = generation + ind;
	  break;
	}
    }

  //if room is running out, or maxAge is reached, join or build terminating room
  if( ( frontFree < (2*stepLength) ) || ( (maxAge-1) == age ) )
    {//first check out what's ahead of us
      bool G_CLOSEDahead = false;
      bool OPENahead = false;
      bool ROOMahead = false;
      SquareData dat;
      //first see whether we can join straight ahead at full width
      int count = 0;
      for(int i = -tunnelWidth; i <= tunnelWidth; i++)
	{
	  Test = Location + (frontFree+1)*Forward + i*Right;
	  dat = pDM -> GetMap(Test);
	  if( (OPEN == dat) || (G_OPEN == dat) || (IT_OPEN == dat) || (IA_OPEN == dat) )
	    {
	      OPENahead = true;
	      count++;
	    }
	  else if( (G_CLOSED == dat) || (NJ_G_CLOSED == dat) )
	    {
	      G_CLOSEDahead = true;
	      count = 0;  //start counting fresh, we only want consecutive OPEN squares counted
	    }
	  else if( IR_OPEN == dat )
	    {
	      ROOMahead = true;
	      count = 0;  //start counting fresh, we only want consecutive OPEN squares counted
	    }
	  else
	    count = 0;
	}	  

      //if we try to join because reaching maxAge, we must also check that the distance to the tunnel to be joined is not too large:
      if( ( ( (rand()%101) <= joinPreference ) && ( ( age < maxAge - 1 ) || ( frontFree <= pDM -> GetTunnelJoinDist() ) ) )
	  || (frontFree < 5) )  //if this is true, we don't have enough room to build a room and must join in any case
	{//we try to join other tunnel
///////////////////////////////moved up
// 	  bool G_CLOSEDahead = false;
// 	  bool OPENahead = false;
// 	  bool ROOMahead = false;
// 	  SquareData dat;
// 	  //first see whether we can join straight ahead at full width
// 	  int count = 0;
// 	  for(int i = -tunnelWidth; i <= tunnelWidth; i++)
// 	    {
// 	      Test = Location + (frontFree+1)*Forward + i*Right;
// 	      dat = pDM -> GetMap(Test);
// 	      if( (OPEN == dat) || (G_OPEN == dat) || (IT_OPEN == dat) || (IA_OPEN == dat) )
// 		{
// 		  OPENahead = true;
// 		  count++;
// 		}
// 	      else if( (G_CLOSED == dat) || (NJ_G_CLOSED == dat) )
// 		{
// 		  G_CLOSEDahead = true;
// 		  count = 0;  //start counting fresh, we only want consecutive OPEN squares counted
// 		}
// 	      else if( IR_OPEN == dat )
// 		{
// 		  ROOMahead = true;
// 		  count = 0;  //start counting fresh, we only want consecutive OPEN squares counted
// 		}
// 	      else
// 		count = 0;
// 	    }	  
///////////////////////////////block moved into enclosing brace
	  if( (2*tunnelWidth + 1) == count )
	    {   //for the full width of the tunnel, we are faced with open squares
	      //	      bool weHaveJoined = BuildTunnel(frontFree , tunnelWidth);
	      // 	      if(!weHaveJoined)   //////////just for testing, remove variable later
	      // 		cout << "Join Failed, fF = " << frontFree << "; tW = " << tunnelWidth << endl;
	      BuildTunnel(frontFree , tunnelWidth);
	      return(false);   //delete this Tunneler
	    }

	  if(OPENahead)
	    {//we have OPEN squares ahead, but not for the full width of the Tunnel, make the tunnel smaller and join anyway
	      //we join with the first OPEN square we find, and narrow the tunnel to width 1
	      Test = Location + (frontFree+1)*Forward;
	      dat = pDM -> GetMap(Test);
	      if( (OPEN == dat) || (G_OPEN == dat) || (IT_OPEN == dat) || (IA_OPEN == dat) )
		{//small opening straight ahead
		  if(!BuildTunnel(frontFree , 0))
		    cout << "OpenAhead, failed to join, fF = " << frontFree << endl;
		  return(false);
		}
	    
	      int offset = 0;
	      for(int i = 1; i <= tunnelWidth; i++)
		{
		  Test = Location + (frontFree+1)*Forward + i*Right;
		  dat = pDM -> GetMap(Test);
		  if( (OPEN == dat) || (G_OPEN == dat) || (IT_OPEN == dat) || (IA_OPEN == dat) )
		    {
		      offset = i;
		      break;
		    }
		  Test = Location + (frontFree+1)*Forward - i*Right;
		  dat = pDM -> GetMap(Test);
		  if( (OPEN == dat) || (G_OPEN == dat) || (IT_OPEN == dat) || (IA_OPEN == dat) )
		    {
		      offset = -i;
		      break;
		    }
		}
	      assert(offset != 0);  //because OPENahead == true and center has been eliminated earler
	      for(int i = 1; i <= frontFree; i++)
		{//build the narrow tunnel by hand:
		  Test = Location + i*Forward + offset*Right;
		  pDM -> SetMap(Test , IT_OPEN);
		}//we tunneled and joined, so:
	      return(false);
	    }//OPENahead == true

	  if( ROOMahead && (tunnelWidth == 0) )
	    {//make a small entry into the room, we don't do this for wider corridors
	      if(frontFree > 1)
		{//otherwise we can make adjacent doors into end-of-tunnel room
		  Test = Location + (frontFree+1)*Forward;
		  dat = pDM -> GetMap(Test);
		  assert(dat == IR_OPEN);
		  BuildTunnel(frontFree-1 , 0);
		  if(Forward.ShowX() == 0)
		    pDM -> SetMap(Location + frontFree*Forward , V_DOOR);
		  else
		    {
		      assert(Forward.ShowY() == 0);
		      pDM -> SetMap(Location + frontFree*Forward , H_DOOR);
		    }
		  return(false);
		}
	    }

	  if(G_CLOSEDahead)
	    {
// 	      ///////////////////////////removed because unused in the current version
// 	      //we look for a gap between the G_CLOSED squares
// 	      //we must find a CLOSED followed by an OPEN  square
// 	      Test = Location + (frontFree+1)*Forward;
// 	      dat = pDM -> GetMap(Test);
// 	      if( (CLOSED == dat) || (NJ_CLOSED == dat) )
// 		{//this might work here... check further
// 		  Test = Location + (frontFree+2)*Forward;
// 		  dat = pDM -> GetMap(Test);   //edge of map must always be G_CLOSED or this assertion may fail
// 		  if( (OPEN == dat) || (G_OPEN == dat) || (IT_OPEN == dat) || (IA_OPEN == dat) )
// 		    {//yess, this place works out alright
// 		      if( !BuildTunnel(frontFree+1 , 0) )
// 			cout << "ClosedAhead Join failed" << endl;
// 		      return(false);
// 		    }
// 		}
// 	      int offset = 0;
// 	      for(int i = 1; i <= tunnelWidth; i++)
// 		{
// 		  Test = Location + (frontFree+1)*Forward + i*Right;
// 		  dat = pDM -> GetMap(Test);
// 		  if( (CLOSED == dat) || (NJ_CLOSED == dat) )  //not the G_CLOSED place we try to avoid
// 		    {
// 		      Test = Location + (frontFree+2)*Forward + i*Right;
// 		      dat = pDM -> GetMap(Test);    //edge of map must always be G_CLOSED or this assertion may fail
// 		      if( (OPEN == dat) || (G_OPEN == dat) || (IT_OPEN == dat) || (IA_OPEN == dat) )
// 			{
// 			  offset = i;
// 			  break;
// 			}
// 		    }
// 		  Test = Location + (frontFree+1)*Forward - i*Right;
// 		  dat = pDM -> GetMap(Test);
// 		  if( (CLOSED == dat) || (NJ_CLOSED == dat) )  //not the G_CLOSED place we try to avoid
// 		    {
// 		      Test = Location + (frontFree+2)*Forward - i*Right;
// 		      dat = pDM -> GetMap(Test);    //edge of map must always be G_CLOSED or this assertion may fail
// 		      if( (OPEN == dat) || (G_OPEN == dat) || (IT_OPEN == dat) || (IA_OPEN == dat) )
// 			{
// 			  offset = -i;
// 			  break;
// 			}
// 		    }
// 		}

// 	      if(offset != 0)   //we found a gap
// 		{
// 		  for(int i = 1; i <= frontFree+1; i++)
// 		    {//build the narrow tunnel by hand:
// 		      Test = Location + i*Forward + offset*Right;
// 		      pDM -> SetMap(Test , IT_OPEN);
// 		      pDM -> SetMap( Location + (frontFree+1)*Forward + offset*Right , COLUMN);
// 		    }//we tunneled and joined, so:
// 		  return(false);
// 		}
// 	      ////////////////////////end - removed////////////////////

	      //if this didn't work, we often are at the edge of the map, looking towards the edge
	      //change direction - this code only good for tunnelWidth == 0, but other cases have not been observed
	      if(tunnelWidth == 0)
		{
		  int jP = (rand()%11) * 10;
		  if(leftFree >= rightFree)
		    {
		      if( (joinPreference != 100) || (makeRoomsLeftProb != 20) || (makeRoomsRightProb != 20) || (changeDirProb != 30) || (straightDoubleSpawnProb != 0) || (turnDoubleSpawnProb != 0) || (tunnelWidth != 0) ) //this condition prevents an infinite loop of Tunnelrs creating identical babies
			pDM -> CreateTunneler( Location , -Right , 0 , maxAge , generation+1 , -Right , 3 , 0 , 0 , 0 , 30 , 20 , 20 , jP );
		    }
		  else
		    {
		      if( (joinPreference != 100) || (makeRoomsLeftProb != 20) || (makeRoomsRightProb != 20) || (changeDirProb != 30) || (straightDoubleSpawnProb != 0) || (turnDoubleSpawnProb != 0) || (tunnelWidth != 0) ) //this condition prevents an infinite loop of Tunnelrs creating identical babies
			pDM -> CreateTunneler( Location , Right , 0 , maxAge , generation+1 , Right , 3 , 0 , 0 , 0 , 30 , 20 , 20 , jP );
		    }
		  return(false);   //create a new one and delete this one
		}

	    }//G_CLOSEDahead == true

	  if( (!OPENahead) && (!G_CLOSEDahead) )
	    {//we treat special case that can arise when frontFree was in fact based on an OPEN square that's tunnelWidth+1 off center
	      bool weHaveSpecialCase = true;
	      //test that assumption:
	      for(int i = -tunnelWidth; i <= tunnelWidth; i++)
		{
		  Test = Location + (frontFree+1)*Forward + i*Right;
		  dat = pDM -> GetMap(Test);
		  if( CLOSED != dat )
		    {
		      weHaveSpecialCase = false;
		      break;
		    }
		}	
	      //now test to the side
	      IntCoordinate TestR = Location + (frontFree+1)*Forward + (tunnelWidth+1)*Right;
	      IntCoordinate TestL = Location + (frontFree+1)*Forward - (tunnelWidth+1)*Right;
	      SquareData datR = pDM -> GetMap(TestR);
	      SquareData datL = pDM -> GetMap(TestL);
	      if( !( (OPEN == datR) || (G_OPEN == datR) || (IT_OPEN == datR) || (IA_OPEN == datR) || (OPEN == datL) || (G_OPEN == datL) || (IT_OPEN == datL) || (IA_OPEN == datL) ) )
		  weHaveSpecialCase = false;
	      if( (IR_OPEN == datR) || (IR_OPEN == datL) ) 
		  weHaveSpecialCase = false;

	      //test next row to prevent collision with rooms
	      for(int i = -tunnelWidth-1; i <= tunnelWidth+1; i++)
		{
		  Test = Location + (frontFree+2)*Forward + i*Right;
		  dat = pDM -> GetMap(Test);
		  if( IR_OPEN == dat )
		    {
		      weHaveSpecialCase = false;
		      break;
		    }
		}		    


	      if(weHaveSpecialCase)
		{
		  bool weHaveJoined = BuildTunnel(frontFree , tunnelWidth);
		  assert(weHaveJoined);
		  //we have to treat the next row manually:
		  for(int i = -tunnelWidth; i <= tunnelWidth; i++)
		    pDM -> SetMap(Location + (frontFree+1)*Forward + i*Right , IT_OPEN);

		  //keep going while we are still in contact with another tunnel on one side:
		  int fwd = frontFree + 2;
		  bool contactInNextRow = true;
		  bool rowAfterIsOK = true;
		  while(contactInNextRow && rowAfterIsOK)
		    {
		      for(int i = -tunnelWidth; i <= tunnelWidth; i++)
			{
			  Test = Location + fwd*Forward + i*Right;
			  dat = pDM -> GetMap(Test);
			  if( CLOSED != dat )
			    {
			      contactInNextRow = false;
			      break;
			    }
			}
		      //now check for contact
		      TestR = Location + fwd*Forward + (tunnelWidth+1)*Right;
		      TestL = Location + fwd*Forward - (tunnelWidth+1)*Right;
		      datR = pDM -> GetMap(TestR);
		      datL = pDM -> GetMap(TestL);
		      if( !( (OPEN == datR) || (G_OPEN == datR) || (IT_OPEN == datR) || (IA_OPEN == datR) || (OPEN == datL) || (G_OPEN == datL) || (IT_OPEN == datL) || (IA_OPEN == datL) ) )
			{
			  contactInNextRow = false;
			  break;
			}
		      if( (IR_OPEN == datR) || (IR_OPEN == datL) ) 
		 	{
			  contactInNextRow = false;
			  break;
			}

		      //now check the row after:
		      for(int i = -tunnelWidth; i <= tunnelWidth; i++)
			{
			  Test = Location + (fwd+1)*Forward + i*Right;
			  dat = pDM -> GetMap(Test);
			  if( CLOSED != dat )
			    rowAfterIsOK = false;
			}
		      //now check the two outlying squares
		      TestR = Location + (fwd+1)*Forward + (tunnelWidth+1)*Right;
		      TestL = Location + (fwd+1)*Forward - (tunnelWidth+1)*Right;
		      datR = pDM -> GetMap(TestR);
		      datL = pDM -> GetMap(TestL);
		      if( !( (OPEN == datR) || (G_OPEN == datR) || (IT_OPEN == datR) || (IA_OPEN == datR) || (CLOSED == datR) || (OPEN == datL) || (G_OPEN == datL) || (IT_OPEN == datL) || (IA_OPEN == datL) || (CLOSED == datL) ) )
			rowAfterIsOK = false;
		      if( (IR_OPEN == datR) || (IR_OPEN == datL) )
			rowAfterIsOK = false;
		      //however, if the entire row after is IT_OPEN, it's also OK
		      bool allOpen = true;
		      for(int i = -tunnelWidth-1; i <= tunnelWidth+1; i++)
			{
			  Test = Location + (fwd+1)*Forward + i*Right;
			  dat = pDM -> GetMap(Test);
			  if( ( IT_OPEN != dat ) && ( IA_OPEN != dat ) )
			    allOpen = false;
			}
		      if(allOpen)
			rowAfterIsOK = true;

		      // build another row
		      if(contactInNextRow && rowAfterIsOK)
			{
			  for(int i = -tunnelWidth; i <= tunnelWidth; i++)
			    pDM -> SetMap(Location + fwd*Forward + i*Right , IT_OPEN);
			}

		      fwd++; //try the next row;-)
		    }//contactInnextRow && rowAfterIsOK
		  return(false);   //delete this Tunneler
		}//weHaveSpecialCase
	      //now treat the case that a room blocks the path off center, only for tunnelWidth == 0:
	      if(tunnelWidth == 0)
		{
		  if( CLOSED ==  pDM->GetMap( Location + (frontFree+1)*Forward ) )
		    {
		      //look sideways, and turn away from the room
		      if( pDM->GetMap( Location + (frontFree+1)*Forward + Right ) == IR_OPEN )
			{
			  Forward = -Right;
			  if( (Forward.ShowX() == -intDirection.ShowX() ) && (Forward.ShowY() == -intDirection.ShowY() ) )
			    Forward = intDirection;   //to prevent heading off in the wrong direction
			  return(true);
			}
		      else if( pDM->GetMap( Location + (frontFree+1)*Forward - Right ) == IR_OPEN )
			{
			  Forward = Right;
			  if( (Forward.ShowX() == -intDirection.ShowX() ) && (Forward.ShowY() == -intDirection.ShowY() ) )
			    Forward = intDirection;   //to prevent heading off in the wrong direction
			  return(true);
			}
		    }//CLOSED == dat
		}
	    } //if( (!OPENahead) && (!G_CLOSEDahead) )
	  //we give up, we have failed in our attempt to join, so let's try and build a room instead
	}//end "Join other tunnel"
      //if we get here we build a room, if we want one
      if(pDM -> WantsMoreRoomsD(szB) )
	{
	  int dW =  2*tunnelWidth;
	  if(dW < 1)
	    dW = 1;
	  pDM->CreateRoomie( Location , Forward , 0 , 2 , generation , dW , szB , 0 );      //let it execute right away
	}
      //also, in case this Roomie fails or wasn't created, let's create a Tunneler that executes a bit later:
      //HERE
      int jP = (rand()%11) * 10;
//       if( (joinPreference != 100) || (makeRoomsLeftProb != 10) || (makeRoomsRightProb != 10) || (changeDirProb != 40) || (straightDoubleSpawnProb != 0) || (turnDoubleSpawnProb != 0) || (tunnelWidth != 0) ) //this condition prevents an infinite loop of Tunnelrs creating identical 

      if( (joinPreference != 100) || (makeRoomsLeftProb != pDM->GetLastChanceRoomsLeftProb() ) || (makeRoomsRightProb != pDM->GetLastChanceRoomsRightProb() ) || (changeDirProb != pDM->GetLastChanceChangeDirProb() ) || (straightDoubleSpawnProb != pDM->GetLastChanceStraightSpawnProb() ) || (turnDoubleSpawnProb != pDM->GetLastChanceTurnSpawnProb() ) || (tunnelWidth != 0) ) //this condition prevents an infinite loop of Tunnelrs creating identical babies
	{
	  int lF = tunnelWidth + 1;
	  int rF = tunnelWidth + 1;
	  int fFR = FrontFree( Location + tunnelWidth*Right , Right , lF , rF );    
	  lF = tunnelWidth + 1;
	  rF = tunnelWidth + 1;  
	  int fFL = FrontFree( Location - tunnelWidth*Right , Left , lF , rF );   
	  lF = tunnelWidth + 1;
	  rF = tunnelWidth + 1;  
	  int fFB = FrontFree( Location , -Forward , lF , rF );  

	  if(tunnelWidth == 0)
	    {
// 	      if( (makeRoomsLeftProb == 10) && (makeRoomsRightProb == 10) && (changeDirProb == 40) && (straightDoubleSpawnProb == 0) && (turnDoubleSpawnProb == 0) )
	      if( (makeRoomsLeftProb == pDM->GetLastChanceRoomsLeftProb() ) && (makeRoomsRightProb == pDM->GetLastChanceRoomsRightProb() ) && (changeDirProb == pDM->GetLastChanceChangeDirProb() ) && (straightDoubleSpawnProb == pDM->GetLastChanceStraightSpawnProb() ) && (turnDoubleSpawnProb == pDM->GetLastChanceTurnSpawnProb() ) )
		{//we have a baby of one spawned here which may be stuck, so redirect it
		  if( (frontFree >= fFR) && (frontFree >= fFL) && (frontFree >= fFB) )
		    pDM -> CreateTunneler( Location , Forward , 0 , maxAge , generation+1 , Forward , 3 , 0 , pDM->GetLastChanceStraightSpawnProb() , pDM->GetLastChanceTurnSpawnProb() , pDM->GetLastChanceChangeDirProb() , pDM->GetLastChanceRoomsRightProb() , pDM->GetLastChanceRoomsLeftProb() , jP );
		  else if( (fFB >= fFR) && (fFB >= fFL) )
		    pDM -> CreateTunneler( Location , -Forward , 0 , maxAge , generation + pDM->GetLastChanceGenDelay() , -Forward , 3 , 0 ,  pDM->GetLastChanceStraightSpawnProb() , pDM->GetLastChanceTurnSpawnProb() , pDM->GetLastChanceChangeDirProb() , pDM->GetLastChanceRoomsRightProb() , pDM->GetLastChanceRoomsLeftProb() , jP );
		  else if( (fFR >= fFL) || ( (fFR == fFL) && ( (rand()%100) < 50 ) ) )
		    pDM -> CreateTunneler( Location , Right , 0 , maxAge , generation + pDM->GetLastChanceGenDelay() , Right , 3 , 0 ,  pDM->GetLastChanceStraightSpawnProb() , pDM->GetLastChanceTurnSpawnProb() , pDM->GetLastChanceChangeDirProb() , pDM->GetLastChanceRoomsRightProb() , pDM->GetLastChanceRoomsLeftProb() , jP );
		  else
		    pDM -> CreateTunneler( Location , Left , 0 , maxAge , generation + pDM->GetLastChanceGenDelay() , Left , 3 , 0 ,  pDM->GetLastChanceStraightSpawnProb() , pDM->GetLastChanceTurnSpawnProb() , pDM->GetLastChanceChangeDirProb() , pDM->GetLastChanceRoomsRightProb() , pDM->GetLastChanceRoomsLeftProb() , jP );
		}
	      else 
		pDM -> CreateTunneler( Location , Forward , 0 , maxAge , generation + pDM->GetLastChanceGenDelay() , Forward , 3 , 0 ,  pDM->GetLastChanceStraightSpawnProb() , pDM->GetLastChanceTurnSpawnProb() , pDM->GetLastChanceChangeDirProb() , pDM->GetLastChanceRoomsRightProb() , pDM->GetLastChanceRoomsLeftProb() , jP );
	    }
	  else
	    {//here the forks at the end of wide tunnels get created
	      //  G_CLOSEDahead  OPENahead  ROOMahead 
	      if( G_CLOSEDahead )
		{//we go left and right
		  pDM -> CreateTunneler( Location + tunnelWidth*Right , Right , 0 , maxAge , generation + pDM->GetLastChanceGenDelay() , Right , 3 , 0 ,  pDM->GetLastChanceStraightSpawnProb() , pDM->GetLastChanceTurnSpawnProb() , pDM->GetLastChanceChangeDirProb() , pDM->GetLastChanceRoomsRightProb() , pDM->GetLastChanceRoomsLeftProb() , jP );
		  pDM -> CreateTunneler( Location - tunnelWidth*Right , Left , 0 , maxAge , generation + pDM->GetLastChanceGenDelay() , Left , 3 , 0 ,  pDM->GetLastChanceStraightSpawnProb() , pDM->GetLastChanceTurnSpawnProb() , pDM->GetLastChanceChangeDirProb() , pDM->GetLastChanceRoomsRightProb() , pDM->GetLastChanceRoomsLeftProb() , jP );
		}
	      else if( ROOMahead )
		{
		  if( (fFR >= fFL) || ( (fFR == fFL) && ( (rand()%100) < 50 ) ) )
		    {
		      pDM -> CreateTunneler( Location + tunnelWidth*Right , Right , 0 , maxAge , generation + pDM->GetLastChanceGenDelay() , Right , 3 , 0 ,  pDM->GetLastChanceStraightSpawnProb() , pDM->GetLastChanceTurnSpawnProb() , pDM->GetLastChanceChangeDirProb() , pDM->GetLastChanceRoomsRightProb() , pDM->GetLastChanceRoomsLeftProb() , jP );
		      pDM -> CreateTunneler( Location - tunnelWidth*Right , Forward , 0 , maxAge , generation + pDM->GetLastChanceGenDelay() , Forward , 3 , 0 ,  pDM->GetLastChanceStraightSpawnProb() , pDM->GetLastChanceTurnSpawnProb() , pDM->GetLastChanceChangeDirProb() , pDM->GetLastChanceRoomsRightProb() , pDM->GetLastChanceRoomsLeftProb() , jP );
		    }
		  else
		    {
		      pDM -> CreateTunneler( Location + tunnelWidth*Right , Forward , 0 , maxAge , generation + pDM->GetLastChanceGenDelay() , Forward , 3 , 0 ,  pDM->GetLastChanceStraightSpawnProb() , pDM->GetLastChanceTurnSpawnProb() , pDM->GetLastChanceChangeDirProb() , pDM->GetLastChanceRoomsRightProb() , pDM->GetLastChanceRoomsLeftProb() , jP );
		      pDM -> CreateTunneler( Location - tunnelWidth*Right , Left , 0 , maxAge , generation + pDM->GetLastChanceGenDelay() , Left , 3 , 0 ,  pDM->GetLastChanceStraightSpawnProb() , pDM->GetLastChanceTurnSpawnProb() , pDM->GetLastChanceChangeDirProb() , pDM->GetLastChanceRoomsRightProb() , pDM->GetLastChanceRoomsLeftProb() , jP );
		    }
		}
	      else
		{
		  pDM -> CreateTunneler( Location + tunnelWidth*Right , Forward , 0 , maxAge , generation + pDM->GetLastChanceGenDelay() , Forward , 3 , 0 ,  pDM->GetLastChanceStraightSpawnProb() , pDM->GetLastChanceTurnSpawnProb() , pDM->GetLastChanceChangeDirProb() , pDM->GetLastChanceRoomsRightProb() , pDM->GetLastChanceRoomsLeftProb() , jP );
		  pDM -> CreateTunneler( Location - tunnelWidth*Right , Forward , 0 , maxAge , generation + pDM->GetLastChanceGenDelay() , Forward , 3 , 0 ,  pDM->GetLastChanceStraightSpawnProb() , pDM->GetLastChanceTurnSpawnProb() , pDM->GetLastChanceChangeDirProb() , pDM->GetLastChanceRoomsRightProb() , pDM->GetLastChanceRoomsLeftProb() , jP );
		}
	    }//end forks
	}

      return(false);
    }//end "room is running out or maxAge is reached"


  //if we get here, we must have:
  assert(frontFree >= 2*stepLength);

  assert(stepLength > 0);
  BuildTunnel(stepLength , tunnelWidth);
  //build side rooms if desired
  if( (rand()%100) < makeRoomsRightProb )
    {
      IntCoordinate SpawnPoint = Location + (stepLength/2 + 1) * Forward + tunnelWidth * Right;
      //use this and Right in Roomie;
      int dW = stepLength/2 - 1;
      if(dW < 1)
	dW = 1;
      pDM->CreateRoomie( SpawnPoint , Right , -1 , 2 , roomieGeneration , dW , szS , 0 );
      //let it execute with one step delay, to let the Tunneler get ahead, possibly going sideways and blocking room
    }
  if( (rand()%100) < makeRoomsLeftProb )
    {
      IntCoordinate SpawnPoint = Location + (stepLength/2 + 1) * Forward + tunnelWidth * Left;
      //use this and left in Roomie;
      int dW = stepLength/2 - 1;
      if(dW < 1)
	dW = 1;
      pDM->CreateRoomie( SpawnPoint , Left , -1 , 2 , roomieGeneration , dW , szS , 0 );
      //let it execute with one step delay, to let the Tunneler get ahead, possibly going sideways and blocking room
    }
  Location = Location + stepLength*Forward;  //relocate the Tunneler to the front of the new Tunnel section

  bool smallAnteRoomPossible = false;
  bool largeAnteRoomPossible = false;

  assert(tunnelWidth >= 0);
  leftFree = tunnelWidth + 2;
  rightFree = tunnelWidth + 2;
  assert(pDM->GetMap(Location) ==  IT_OPEN);
  pDM->SetMap(Location , CLOSED);   //temporary, so we can step back to see it's free in our own row
  for(int m = 1; m <= tunnelWidth; m++)
    {
      assert(pDM->GetMap(Location + m*Right) ==  IT_OPEN);
      assert(pDM->GetMap(Location - m*Right) ==  IT_OPEN);
      pDM->SetMap(Location + m*Right , CLOSED);
      pDM->SetMap(Location - m*Right , CLOSED);
    }
  frontFree = FrontFree( Location - Forward , Forward , leftFree , rightFree );
  if(frontFree >= 2*tunnelWidth+5 )
    smallAnteRoomPossible = true;
  pDM->SetMap(Location , IT_OPEN);
  for(int m = 1; m <= tunnelWidth; m++)
    {
      pDM->SetMap(Location + m*Right , IT_OPEN);
      pDM->SetMap(Location - m*Right , IT_OPEN);
    }

  leftFree = tunnelWidth + 3;
  rightFree = tunnelWidth + 3;
  assert(pDM->GetMap(Location) ==  IT_OPEN);
  pDM->SetMap(Location , CLOSED);   //temporary, so we can step back to see it's free in our own row
  for(int m = 1; m <= tunnelWidth; m++)
    {
      assert(pDM->GetMap(Location + m*Right) ==  IT_OPEN);
      assert(pDM->GetMap(Location - m*Right) ==  IT_OPEN);
      pDM->SetMap(Location + m*Right , CLOSED);
      pDM->SetMap(Location - m*Right , CLOSED);
    }
  frontFree = FrontFree( Location - Forward , Forward , leftFree , rightFree );
  if(frontFree >= 2*tunnelWidth+7 )
    largeAnteRoomPossible = true;
  pDM->SetMap(Location , IT_OPEN);
  for(int m = 1; m <= tunnelWidth; m++)
    {
      pDM->SetMap(Location + m*Right , IT_OPEN);
      pDM->SetMap(Location - m*Right , IT_OPEN);
    }

  bool sizeUpTunnel = false;
  bool sizeDownTunnel = false;
  diceRoll = rand()%101;
  int sUpProb = pDM -> GetSizeUpProb(generation);
  int sDownProb = sUpProb +  pDM -> GetSizeDownProb(generation);
  if(diceRoll < sUpProb)
    sizeUpTunnel = true;
  else if(diceRoll < sDownProb)
    sizeDownTunnel = true;
  //if none if these is true, we stay at the same tunnel size

  if(sizeUpTunnel && !largeAnteRoomPossible)
    return(true);  //we cannot build the anteroom we need, thus we don't branch here
//   else if(!smallAnteRoomPossible)
//     return(true);  //if we cannot build an anteroom, we do not branch here
//////////////////////////////////////////////////////but we may want to change direction
  
  bool changeDir = false;
  if( (rand()%100) < changeDirProb )
    changeDir = true;

  bool doSpawn = false;
  if( changeDir && ( (rand()%101) < turnDoubleSpawnProb ) )
    doSpawn = true;
 if( !changeDir && ( (rand()%101) < straightDoubleSpawnProb ) )
    doSpawn = true;

 if( !changeDir && !doSpawn )
   return(true);   //nothing else to do

 bool doSpawnRoom = false;
 if(doSpawn && ( (rand()%101) > pDM -> GetPatience() ) )  //> is there on purpose;-)
   doSpawnRoom = true;

      //now... creating parameters needed for making babies
  diceRoll = rand()%101;
  unsigned int babyGeneration = generation + 1;   //default
  summedProbs = 0;
  if(doSpawn)
    {
      if(!sizeUpTunnel)
	{
	  for(unsigned int ind = 0; ind <= 10; ind++)
	    {
	      summedProbs = summedProbs +  pDM -> GetBabyDelayProbsForGenerationT(ind);
	      if (diceRoll < summedProbs)
		{
		  babyGeneration = generation + ind;
		  break;
		}
	    }
	}
      else
	{//these get special fast treatment:
	  babyGeneration = generation + pDM->GetSizeUpGenDelay();
	}

    }


  //determine other parameters:
  int sDSP =  pDM -> Mutate(straightDoubleSpawnProb);  

  int tDSP =  pDM -> Mutate(turnDoubleSpawnProb);   

  int cDP =  pDM -> Mutate(changeDirProb);   

  int mRRP = pDM -> Mutate(makeRoomsRightProb);

  int mRLP = pDM -> Mutate(makeRoomsLeftProb);

  int jP = pDM -> Mutate(joinPreference);
  ///////////////////end making baby parameters

  bool TEST = false;
  IntCoordinate SpawnPointForward , SpawnPointRight , SpawnPointLeft; 
  //locations on the anteroom where Tunneler will be spawned or repositioned
  bool usedRight = false;
  bool usedLeft = false;   //to keep track which points have been used
  bool builtAnteRoom = false;
  if(sizeUpTunnel)
    {
      if( ( (rand()%100) < pDM -> GetAnteRoomProb(tunnelWidth) ) || doSpawn )
	{//if we spawn this would look weird without anteroom
	  TEST = BuildAnteRoom(2*tunnelWidth + 5 , tunnelWidth + 2);
	  SpawnPointForward = Location + (2*tunnelWidth + 5) * Forward;
	  SpawnPointRight = Location + (tunnelWidth + 3) * Forward + (tunnelWidth+2) * Right;
	  SpawnPointLeft = Location + (tunnelWidth + 3) * Forward + (tunnelWidth+2) * Left;
	  assert(TEST);
	  builtAnteRoom = true;
	}
      else
	{//determine spawnpoints without anteroom:
	  SpawnPointForward = Location;
	  SpawnPointRight = Location - tunnelWidth * Forward + tunnelWidth * Right;
	  SpawnPointLeft = Location  - tunnelWidth * Forward + tunnelWidth * Left;
	  if( (IT_OPEN != pDM -> GetMap(SpawnPointRight) ) || (IT_OPEN != pDM -> GetMap(SpawnPointLeft) ) )
	    return(true);  //we didn't make a long enough step so we cannot really go back on this tunnel, bail out!
	}
    }
  else
    {
      if( ( (rand()%100) < pDM -> GetAnteRoomProb(tunnelWidth) ) && smallAnteRoomPossible )
	{
	  TEST = BuildAnteRoom(2*tunnelWidth + 3 , tunnelWidth + 1);
	  SpawnPointForward = Location + (2*tunnelWidth + 3) * Forward;
	  SpawnPointRight = Location + (tunnelWidth + 2) * Forward + (tunnelWidth + 1) * Right;
	  SpawnPointLeft = Location + (tunnelWidth + 2) * Forward + (tunnelWidth + 1) * Left;
	  assert(TEST);
	  builtAnteRoom = true;
	}
      else
	{//determine spawnpoints without anteroom:
	  SpawnPointForward = Location;
	  SpawnPointRight = Location - tunnelWidth * Forward + tunnelWidth * Right;
	  SpawnPointLeft = Location  - tunnelWidth * Forward + tunnelWidth * Left;
	  if( (IT_OPEN != pDM -> GetMap(SpawnPointRight) ) || (IT_OPEN != pDM -> GetMap(SpawnPointLeft) ) )
	    return(true);  //we didn't make a long enough step so we cannot really go back on this tunnel, bail out!
	}
    }

 //keep the old direction for future reference
  IntCoordinate OldForward(Forward);   //in case Forward changes we will need this
  if( changeDir )   
    {// change the direction
      //first check for available space
      int lF = tunnelWidth + 1;
      int rF = tunnelWidth + 1;
      int fFR = FrontFree( SpawnPointRight , Right , lF , rF );    
      lF = tunnelWidth + 1;
      rF = tunnelWidth + 1;  
      int fFL = FrontFree( SpawnPointLeft , Left , lF , rF );      

      if( ( ( intDirection.ShowX( ) == 0 ) && ( intDirection.ShowY( ) == 0 ) ) ||   //we can go anywhere
	  ( ( intDirection.ShowX( ) == Forward.ShowX( ) ) && ( intDirection.ShowY( ) == Forward.ShowY( ) ) ) )
	{//we can go left or right as we choose
	  if( (!sizeUpTunnel) || (!doSpawn) )
	    {//we go where there is more room
	      if( (fFR > fFL) || ( ( fFR == fFL ) && ( 0 == (rand()%2) ) ) )
		{
		  if(fFR > 0)
		    {
		      Location = SpawnPointRight;
		      Forward = Right;
		      usedRight = true;
		    }
		}
	      else if(fFL > 0)
		{
		  Location = SpawnPointLeft;
		  Forward = Left;
		  usedLeft = true;
		}
	    }
	  else // we spawn a baby with a larger tunnelWidth param
	    {//we go where there is less room to leave the greater room for the large baby
	      assert(doSpawn);   //check whether this always holds, otherwise switch here
	      if( (fFR < fFL) || ( ( fFR == fFL ) && ( 0 == (rand()%2) ) ) )
		{
		  if(fFR > 0)
		    {
		      Location = SpawnPointRight;
		      Forward = Right;
		      usedRight = true;
		    }
		}
	      else if(fFL > 0)
		{
		  Location = SpawnPointLeft;
		  Forward = Left;
		  usedLeft = true;
		}
	    }
	}
      else
	{//the intendedHeading leaves us no choice where to go 
	  if( ( 0 == intDirection.ShowX( ) ) || ( 0 == intDirection.ShowY(  ) ) )
	    {//the intended heading is one of the four pure directions, and our new heading must be the intended heading
	      Forward = intDirection;
	      if( ( Forward.ShowX() == Right.ShowX() ) && ( Forward.ShowY() == Right.ShowY() ) )
		{
		  if(fFR > 0)
		    {
		      usedRight = true;
		      Location = SpawnPointRight;
		    }
		}
	      else if(fFL > 0)
		{
		  assert( ( Forward.ShowX() == Left.ShowX() ) && ( Forward.ShowY() == Left.ShowY() ) );
		  Location = SpawnPointLeft;
		  usedLeft = true;
		}
	    }
	  else
	    {//the intended heading must be in one of the four intermediate directions
	      assert( ( 0 != intDirection.ShowX( ) ) && ( 0 != intDirection.ShowY( ) ) ); 
	      Forward = intDirection - Forward;
	      if( ( Forward.ShowX() == Right.ShowX() ) && ( Forward.ShowY() == Right.ShowY() ) )
		{
		  if(fFR > 0)
		    {
		      usedRight = true;
		      Location = SpawnPointRight;
		    }
		}
	      else if(fFL > 0)
		{
		  assert( ( Forward.ShowX() == Left.ShowX() ) && ( Forward.ShowY() == Left.ShowY() ) );
		  Location = SpawnPointLeft;
		  usedLeft = true;
		}
	    }
	}

      //make 2 babies now
      if( doSpawn )
	{
	  IntCoordinate SpawnPoint , SpawnDir;
	  if(usedLeft)
	    {
	      SpawnPoint = SpawnPointRight;
	      SpawnDir = Right;
	    }
	  else if(usedRight)
	    {
	      SpawnPoint = SpawnPointLeft;
	      SpawnDir = Left;
	    }
	  else
	    goto goStraight; //we could not change direction for lack of space, going straight instead

	  int diceRoll = rand()%100;
	  //first spawning to the left or right (the way the old Tunneler didn't take):
	  if( doSpawnRoom && ( diceRoll < 50 ) )
	    {
	      int dW = 2*tunnelWidth;
	      if(dW < 1)
		dW = 1;
	      int rG = roomieGeneration;
	      if(builtAnteRoom)
		rG = generation + (roomieGeneration - generation)/(pDM->GetGenSpeeUpOnAnteRoom());
	      pDM->CreateRoomie( SpawnPoint , SpawnDir , 0 , 2 , rG , dW , szB , 0 );
	    }	   
	  //let it execute right away
	  else
	    {
	      int tW = tunnelWidth;
	      int sL = stepLength;
	      if(sizeUpTunnel)
		{
		  tW++;
		  sL = sL + 2;   ////////////////TODO: make better stepLength changes
		}
	      else if(sizeDownTunnel)
		{
		  tW--;
		  if(tW < 0)
		    tW = 0;
		  sL = sL - 2;
		  if(sL < 3)
		    sL = 3;
		}
	      pDM -> CreateTunneler( SpawnPoint , SpawnDir , 0 , pDM->GetMaxAgeT(babyGeneration) , babyGeneration , SpawnDir , sL , tW , sDSP , tDSP , cDP , mRRP , mRLP , jP );
	    }

	  //now spawning in the OldForward direction:
	  if( doSpawnRoom && ( diceRoll >= 50 ) )
	    {
	      int dW = 2*tunnelWidth;
	      if(dW < 1)
		dW = 1;
	      int rG = roomieGeneration;
	      if(builtAnteRoom)
		rG = generation + (roomieGeneration - generation)/(pDM->GetGenSpeeUpOnAnteRoom());
	  
	      pDM->CreateRoomie( SpawnPointForward , OldForward , 0 , 2 , rG , dW , szB , 0 );
	    }
	  else
	    {
	      int tW = tunnelWidth;
	      int sL = stepLength;
	      if(sizeUpTunnel)
		{
		  tW++;
		  sL = sL + 2;   ////////////////TODO: make better stepLength changes
		}
	      else if(sizeDownTunnel)
		{
		  tW--;
		  if(tW < 0)
		    tW = 0;
		  sL = sL - 2;
		  if(sL < 3)
		    sL = 3;
		}
	      pDM -> CreateTunneler( SpawnPointForward , OldForward , 0 , pDM->GetMaxAgeT(babyGeneration) , babyGeneration , OldForward , sL , tW , sDSP , tDSP , cDP , mRRP , mRLP , jP );
	    }
	}
    }//end if change Direction
  else //we keep going straight on
    {
      //first relocate the Tunneler:
 goStraight:     Location = SpawnPointForward;
      //now create babies if appropriate
      int diceRoll = rand()%100;
      //first spawning to the right:
      if( doSpawnRoom && ( diceRoll < 50 ) )
	{
	  int dW = 2*tunnelWidth;
	  if(dW < 1)
	    dW = 1;
	  int rG = roomieGeneration;
	  if(builtAnteRoom)
	    rG = generation + (roomieGeneration - generation)/(pDM->GetGenSpeeUpOnAnteRoom());
	  pDM->CreateRoomie( SpawnPointRight , Right , 0 , 2 , rG , dW , szB , 0 );
	}
      else
	{
	  int tW = tunnelWidth;
	  int sL = stepLength;
	  if(sizeUpTunnel)
	    {
	      tW++;
	      sL = sL + 2;   ////////////////TODO: make better stepLength changes
	    }
	  else if(sizeDownTunnel)
	    {
	      tW--;
	      if(tW < 0)
		tW = 0;
	      sL = sL - 2;
	      if(sL < 3)
		sL = 3;
	    }
	  pDM -> CreateTunneler( SpawnPointRight , Right , 0 , pDM->GetMaxAgeT(babyGeneration) , babyGeneration , Right , sL , tW , sDSP , tDSP , cDP , mRRP , mRLP , jP );
	}

      //now spawning to the left:
      if( doSpawnRoom && ( diceRoll >= 50 ) )
	{
	  int dW = 2*tunnelWidth;
	  if(dW < 1)
	    dW = 1;
	  int rG = roomieGeneration;
	  if(builtAnteRoom)
	    rG = generation + (roomieGeneration - generation)/(pDM->GetGenSpeeUpOnAnteRoom());
	  pDM->CreateRoomie( SpawnPointLeft , Left , 0 , 2 , rG , dW , szB , 0 );
	}
      else
	{
	  int tW = tunnelWidth;
	  int sL = stepLength;
	  if(sizeUpTunnel)
	    {
	      tW++;
	      sL = sL + 2;   ////////////////TODO: make better stepLength changes
	    }
	  else if(sizeDownTunnel)
	    {
	      tW--;
	      if(tW < 0)
		tW = 0;
	      sL = sL - 2;
	      if(sL < 3)
		sL = 3;
	    }
	  pDM -> CreateTunneler( SpawnPointLeft , Left , 0 ,  pDM->GetMaxAgeT(babyGeneration) , babyGeneration , Left , sL , tW , sDSP , tDSP , cDP , mRRP , mRLP , jP );
	}
    }//end we go straight section
    
  return( true); // to indicate success
}

bool alifegames::Tunneler::Join( int frontFree )
{
  return(false);
}

bool alifegames::Tunneler::BuildAnteRoom(int length , int width)
{
  if( (length < 3) || ( width < 1 ) )
    {
      cout << "AnteRoom must be at least 3x3" << endl;
      return(false);
    }
  int lF = width + 1;
  int rF = width + 1;
  int frontFree = FrontFree(Location , Forward , lF , rF);

  //frontFree must be >= length + 1 in order to proceed
  if(frontFree <= length )
    return(false);

  //we proceed to build the anteroom
  //assign the "Right" direction based on Forward
  IntCoordinate Right , Curr;
  if( Forward.ShowX( ) == 0 )
    {
      IntCoordinate Temp( Forward.ShowY() , 0 );
      Right = Temp;
    }
  else if( Forward.ShowY( ) == 0 )
    {
      IntCoordinate Temp(0 , - Forward.ShowX() );
      Right = Temp;
    }

  int fwd , side;
  for(fwd = 1; fwd <= length; fwd++)
    for(side = -width; side <= width; side++)
      {
	Curr = Location + fwd*Forward + side*Right;
	pDM -> SetMap(Curr , IA_OPEN);
      }

  //if width >=3 and length >=7 (anteroom 7x7 or larger) we place columns in the corners
  if( (width >=3) && (length >=7) && pDM->WeWantColumnsInTunnels() )
    {
      fwd = 2;  
      side = -width + 1;   //-(width-1) , one before the last opened square
      Curr = Location + fwd*Forward + side*Right;
      pDM -> SetMap(Curr , COLUMN);
      side = width - 1;   //(width-1) , one before the last opened square
      Curr = Location + fwd*Forward + side*Right;
      pDM -> SetMap(Curr , COLUMN);

      fwd = length-1;
      side = -width + 1;   //-(width-1) , one before the last opened square
      Curr = Location + fwd*Forward + side*Right;
      pDM -> SetMap(Curr , COLUMN);
      side = width - 1;   //(width-1) , one before the last opened square
      Curr = Location + fwd*Forward + side*Right;
      pDM -> SetMap(Curr , COLUMN);
    }

  return(true);
}

bool alifegames::Tunneler::BuildAnteRoom(IntCoordinate lB , IntCoordinate rT)
{
  int xL = rT.ShowX() - lB.ShowX();
  int xLength , xIncr;
  if(xL >= 0)
    {
      xLength = xL;
      xIncr = 1;
    }
  else
    {
      xLength = -xL;
      xIncr = -1;
    }

  int yL = rT.ShowY() - lB.ShowY();
  int yLength , yIncr;
  if(yL >= 0)
    {
      yLength = yL;
      yIncr = 1;
    }
  else
    {
      yLength = -yL;
      yIncr = -1;
    }

  if( ( xLength < 3 ) || ( yLength < 3 ) )
    return(false);  //rectangle too small to tango

  IntCoordinate xDir(1 , 0);
  IntCoordinate yDir(0 , 1);
  IntCoordinate Curr;
  SquareData datAtTest;
  int x , y;
  //test whether we have a closed space to build the anteroom in
  //we do not test the outer perimeter of the room, e.g. whether we have NJ_OPEN here - the calling function must check that
  for(x = 0; x <= xLength; x++)
    for(y = 0; y <= yLength; y++)
      {
	Curr = Location + (x*xIncr) * xDir + (y*yIncr) * yDir;
	datAtTest = pDM -> GetMap( Curr );
	//now check whether this is CLOSED so we can tunnel here
	if( (datAtTest != CLOSED) &&  (datAtTest != NJ_CLOSED) )   //we are blocked
	  return(false);
      }

  //things worked out, so now we build the anteroom
  for(x = 0; x <= xLength; x++)
    for(y = 0; y <= yLength; y++)
      {
	Curr = Location + (x*xIncr) * xDir + (y*yIncr) * yDir;
	pDM -> SetMap(Curr , IA_OPEN);
      }

  // we place columns in the corners, but not the entrance and exit corners (known by the fact that they determine the input params)
  if( (xLength >=5) && (yLength >=5) && pDM->WeWantColumnsInTunnels() )
    {
      x = xLength - 1;
      y = 1;
      Curr = Location + (x*xIncr) * xDir + (y*yIncr) * yDir;
      pDM -> SetMap(Curr , COLUMN);

      x = 1;
      y = yLength - 1;
      Curr = Location + (x*xIncr) * xDir + (y*yIncr) * yDir;
      pDM -> SetMap(Curr , COLUMN);    
    }

  return(true);
}     

bool alifegames::Tunneler::BuildTunnel(int length , int width)
{
  if( (length < 1) || ( width < 0 ) )
    {
      cout << "Trying to build zero size tunnel with length = " << length << "; width =  " << width << endl;
      return(false);
    }
  int lF = width + 1;
  int rF = width + 1;
  int frontFree = FrontFree(Location , Forward , lF , rF);

  //frontFree must be >= length  in order to proceed
  if(frontFree < length )
    return(false);

  //we proceed to build the tunnel
  //assign the "Right" direction based on Forward
  IntCoordinate Right , Curr;
  if( Forward.ShowX( ) == 0 )
    {
      IntCoordinate Temp( Forward.ShowY() , 0 );
      Right = Temp;
    }
  else if( Forward.ShowY( ) == 0 )
    {
      IntCoordinate Temp(0 , - Forward.ShowX() );
      Right = Temp;
    }

  int fwd , side;
  for(fwd = 1; fwd <= length; fwd++)
    for(side = -width; side <= width; side++)
      {
	Curr = Location + fwd*Forward + side*Right;
	pDM -> SetMap(Curr , IT_OPEN);
      }

  //if width >=3 and length >=7 (anteroom 7x7 or larger) we place columns
  if( (width >=3) && (length >=7) && pDM->WeWantColumnsInTunnels() )
    {
      int numCols = (length-1)/6;   //=1 for length >= 7; =2 for length >= 13; =3 for length >= 19;
      assert(numCols > 0);
      for(int i = 0; i < numCols; i++)
	{

	  fwd = 2 + i*3;  //2 , 5 , 8 , 
	  side = -width + 1;   //-(width-1) , one before the last opened square
	  Curr = Location + fwd*Forward + side*Right;
	  pDM -> SetMap(Curr , COLUMN);
	  side = width - 1;   //(width-1) , one before the last opened square
	  Curr = Location + fwd*Forward + side*Right;
	  pDM -> SetMap(Curr , COLUMN);

	  fwd = length-1 - i*3;
	  side = -width + 1;   //-(width-1) , one before the last opened square
	  Curr = Location + fwd*Forward + side*Right;
	  pDM -> SetMap(Curr , COLUMN);
	  side = width - 1;   //(width-1) , one before the last opened square
	  Curr = Location + fwd*Forward + side*Right;
	  pDM -> SetMap(Curr , COLUMN);
	}
    }
  return(true);
}

/////////////////////////////////////end of Tunneler////////////////////////////

///////////////////////////////////Roomie methods/////////////////////////////

alifegames::Roomie::Roomie( DungeonMaker* pdm , IntCoordinate loc , IntCoordinate fwd , int a , int mA , int g , int dW , RoomSize s , int cat)
  : alifegames::Builder::Builder( pdm , loc , fwd , a , mA , g) ,
                         defaultWidth(dW) , size(s) , category(cat)
{}

alifegames::Roomie::~Roomie()
{}


int alifegames::Roomie::FrontFree( IntCoordinate Position , IntCoordinate Heading , int& leftFree , int& rightFree )
{
  assert( (leftFree >= 1 ) &&  (rightFree >= 1 ) );
  //must hold, make sure no smaller parameters are ever passed

  //returns the number of rows free in front of Position, looking towards Heading
  //make sure the input is legal:
  int dX =  pDM -> GetDimX();   //we need that often later on
  int dY =  pDM -> GetDimY();
  assert( ( Position.ShowX() >= 0 ) && ( Position.ShowY() >= 0 ) &&
	  ( Position.ShowX() < dX ) && ( Position.ShowY() < dY ) );

  assert( ( ( Heading.ShowX() == 0 ) && ( ( Heading.ShowY() == 1 ) || ( Heading.ShowY() == -1 ) ) )
	  || ( ( Heading.ShowY() == 0 ) && ( ( Heading.ShowX() == 1 ) || ( Heading.ShowX() == -1 ) ) ) );

  int frontFree = -1;    //impossible value indicates parameter not found yet

  IntCoordinate Right;
  IntCoordinate Test;

    //assign the "Right" direction based on Heading

  if( Heading.ShowX( ) == 0 )
    {
      IntCoordinate Temp( Heading.ShowY() , 0 );
      Right = Temp;
    }
  else if( Heading.ShowY( ) == 0 )
    {
      IntCoordinate Temp(0 , - Heading.ShowX() );
      Right = Temp;
    }
    //check in the direction of Heading in front of Position whether we encounter a non-CLOSED tile
    //we check with a width of (leftFree + 1 + rightFree) - leftFree and rightFree must be at elast corrWidth
  int checkDist = 0;     //zero is the line of Position - we start one line ahead of that
  SquareData datAtTest;
  while( -1 == frontFree )
    {//the extension of the box has not been found yet - we do that now
      ++checkDist;  // = 1 when we first enter here
      for(int i = -leftFree; i <= rightFree; ++i)
 	{
	  Test = Position + i * Right + checkDist * Heading;
 	    //first check whether we are in legal territory
	  if( ( Test.ShowX() < 0 ) || ( Test.ShowY() < 0 ) || ( Test.ShowX() >= dX ) || ( Test.ShowY() >= dY ) )
 	    {//we are outside the map and must not try to access map data - consider the place blocked
	      frontFree = checkDist - 1;
	      break;  //stop the for loop
 	    }
	  else 
	    datAtTest = pDM -> GetMap( Test );
	  //now check whether this is CLOSED and can be tunneled through
	  if( (datAtTest != CLOSED) &&  (datAtTest != NJ_CLOSED) )   //we are blocked
	    {
	      frontFree = checkDist - 1;
	      break;  //stop the for loop
	    }
 	}
     }//frontFree is the number of rows that are free in front of the row that contains the Builder head
      //which is always situated on a wall tile
  assert(frontFree >= 0);   //must have been changed in while loop

  //now check to the sides to see which updated values for leftFree and rightFree can be returned
  if(frontFree > 0)
    {//code not valid for frontFree == 0
      checkDist = leftFree;
      bool done = false;
      while(!done)  //checking towards the left
	{
	  ++checkDist;   // = leftFree+1 when we first enter here
	  for(int i = 1; i <= frontFree; i++)
	    {
	      Test = Position - checkDist * Right + i * Heading;  //we now check parallel to our line of sight, going further out to the left
	      if( ( Test.ShowX() < 0 ) || ( Test.ShowY() < 0 ) || ( Test.ShowX() >= dX ) || ( Test.ShowY() >= dY ) )
		{//we are outside the map and must not try to access map data - consider the place blocked
		  leftFree = checkDist - 1;
		  done = true;
		  break;  //stop the for loop
		}
	      else 
		datAtTest = pDM -> GetMap( Test.ShowX() , Test.ShowY() );
	      //now check whether this is CLOSED and can be tunneled through
	      if( (datAtTest != CLOSED) &&  (datAtTest != NJ_CLOSED) )   //we are blocked
		{
		  leftFree = checkDist - 1;
		  done = true;
		  break;  //stop the for loop
		}
	    }
	}  //while !done

      checkDist = rightFree;
      done = false;
      while(!done)  //checking towards the right
	{
	  ++checkDist;   // = rightFree+1 when we first enter here
	  for(int i = 1; i <= frontFree; i++)
	    {
	      Test = Position + checkDist * Right + i * Heading;  //we now check parallel to our line of sight, going further out to the right
	      if( ( Test.ShowX() < 0 ) || ( Test.ShowY() < 0 ) || ( Test.ShowX() >= dX ) || ( Test.ShowY() >= dY ) )
		{//we are outside the map and must not try to access map data - consider the place blocked
		  rightFree = checkDist - 1;
		  done = true;
		  break;  //stop the for loop
		}
	      else 
		datAtTest = pDM -> GetMap( Test.ShowX() , Test.ShowY() );
	      //now check whether this is CLOSED and can be tunneled through
	      if( (datAtTest != CLOSED) &&  (datAtTest != NJ_CLOSED) )   //we are blocked
		{
		  rightFree = checkDist - 1;
		  done = true;
		  break;  //stop the for loop
		}
	    }
	}  //while !done
    }

  return(frontFree);
}

bool alifegames::Roomie::StepAhead( void )
{
  if(!pDM -> WantsMoreRoomsD( size ) )
    return(false);

  if(generation != pDM -> GetActiveGeneration() )
    {
      return( true );  //nothing's done with Builders of different generations
      assert(generation > pDM->GetActiveGeneration());  //make sure all old ones are actually deleted
    }
  ++age;
  if( age >= maxAge )
    return( false );
  else if( age < 0 )
    return( true );
  //if age >= maxAge, the Builder returns false and will be deleted
  //if age < 0 the builder returns true so as not to be deleted, but does not perform a step - it is dormant

  IntCoordinate Right;
  //assign the "Right" direction based on Forward (which is a member of Builder)
  if( Forward.ShowX( ) == 0 )
    {
      IntCoordinate Temp( Forward.ShowY() , 0 );
      Right = Temp;
    }
  else if( Forward.ShowY( ) == 0 )
    {
      IntCoordinate Temp(0 , - Forward.ShowX() );
      Right = Temp;
    }
  else
    assert(false);  //illegal value of Forward, member of Builder - not a direction
  
  int dW = defaultWidth;
  double aR = pDM -> GetRoomAspectRatio();
  int minSz = pDM -> GetMinRoomSize(size);
  int maxSz = pDM -> GetMaxRoomSize(size);
  int leftFree , rightFree , frontFree;

  do
    {
      leftFree = dW + 1;
      rightFree = dW + 1;
      frontFree = FrontFree( Location , Forward , leftFree , rightFree );
      //we can build a room with dimensions frontFree-2 = length; width = leftFree+rightFree-1;
      //or inside that square - is this OK?
      if(frontFree < 4)
	break;  //this won't work, length at most 2
      int length = frontFree - 2;
      double l = (double)length;
      int width = leftFree + rightFree - 1;
      double w = (double)width;
      if( w/l < aR )
	{//room aspect is not acceptabel, length too large
	  length = (int)(w/aR);
	  l = (double)length;
	  if(w/l < aR)
	    cout << "length = " << length << ", width = " << width << ", but width/length should be >= " << aR << endl; 
	}
      if(l/w < aR)
	{//width too large
	  width = (int)(l/aR);
	  w = (double)width;
	  if(l/w < aR)
	    cout << "length = " << length << ", width = " << width << ", but length/width should be >= " << aR << endl; 
	}
      if( w/l < aR )
	{//this shouldn't happen
	  cout << "The Emperor suggests you make your roomAspectRatio in the design file smaller..." << endl;
	  return(false);   //we abort this room
	}
      //the aspect ratio is now acceptable, but is the room the right size?
      while( length*width > maxSz )
	{//too big, we reduce the larger dimension
	  if(length > width)
	    length--;
	  else if(width > length)
	    width--;
	  else if( (rand()%100) < 50 )
	    length--;
	  else
	    width--;
	}
      //no need to retest aspectRatio because we have only been reducing the larger dimension
      assert(length*width <= maxSz);
      if(length*width >= minSz)
	{//we can build the room, HEUREKA!
	  Room newRoom;
	  if(leftFree <= rightFree)
	    {//we be mindful of the left edge of the open area
	      if( (2*leftFree - 1) > width )
		{//we can build the room on center
		  for(int fwd = 1; fwd <= length; fwd++)
		    for(int sd = width/2; sd >= width/2-width+1; sd--)
		      {
			pDM -> SetMap(Location + (fwd+1)*Forward + sd*Right , IR_OPEN);
			newRoom.AddSquare(Location + (fwd+1)*Forward + sd*Right);
		      }
		}
	      else
		{//attach room to the left side
		  for(int fwd = 1; fwd <= length; fwd++)
		    for(int sd = -leftFree+1; sd <= -leftFree+width; sd++)
		      {
			pDM -> SetMap(Location + (fwd+1)*Forward + sd*Right , IR_OPEN);
			newRoom.AddSquare(Location + (fwd+1)*Forward + sd*Right);
		      }
		}
		  //set door here :
	      if( 0 == Forward.ShowX() )
		pDM -> SetMap(Location + Forward , V_DOOR);
	      else
		{
		  assert(0 == Forward.ShowY() );
		  pDM -> SetMap(Location + Forward , H_DOOR);
		}
	    }//leftFree <= rightFree
	  else   //rightFree < leftFree
	    {//we be mindful of the right edge of the open area
	      if( (2*rightFree - 1) > width )
		{//we can build the room on center
		  for(int fwd = 1; fwd <= length; fwd++)
		    for(int sd = -width/2; sd <= -width/2+width-1; sd++)
		      {
			pDM -> SetMap(Location + (fwd+1)*Forward + sd*Right , IR_OPEN);
			newRoom.AddSquare(Location + (fwd+1)*Forward + sd*Right);
		      }
		}
	      else
		{//attach room to the right side
		  for(int fwd = 1; fwd <= length; fwd++)
		    for(int sd = rightFree-1; sd >= rightFree-width; sd--)
		      {
			pDM -> SetMap(Location + (fwd+1)*Forward + sd*Right , IR_OPEN);
			newRoom.AddSquare(Location + (fwd+1)*Forward + sd*Right);
		      }
		}
	  //set door here :
	      if( 0 == Forward.ShowX() )
		pDM -> SetMap(Location + Forward , V_DOOR);
	      else
		{
		  assert(0 == Forward.ShowY() );
		  pDM -> SetMap(Location + Forward , H_DOOR);
		}
	    }//rightFree < leftFree
	  pDM -> BuiltRoomD(size);  //for counting
	  newRoom.SetInDungeon(true);  //this room's in the dungeon part
	  pDM -> AddRoom(newRoom);
	  return(false);
	}//build the room Heureka;-)
      else
	dW++; //repeat with wider sweep, shorter length
      
    }while((double)(frontFree-2) >= ( (2*(double)dW + 1) * aR ) );
    //we look forward with a wider and wider sweep until frontFree becomes too short to get an acceptable room aspect ratio
    //when that happens, we know we have not enough room to build the Room we want, so we bail out

  return(false);   //it has built its room or failed to do so and must be deleted now
}

///////////////////////////////end of Roomie methods//////////////////////////////

//////////////////DungeonMaker methods
//alifegames::DungeonMaker::DungeonMaker() : activeGeneration(0) , currSmallRoomsL(0) , currMediumRoomsL(0) , currLargeRoomsL(0) , currSmallRoomsD(0) , currMediumRoomsD(0) , currLargeRoomsD(0) {}

void alifegames::DungeonMaker::Init_fromConfig(const alifegames::Config& config, unsigned int seed) {

//   if(useDefaultSeed)
//     {
//       srand( config.randSeed );   ///set random seed
//       cout << "using default random seed from design file, close SDL-window if you've seen it before" << endl;
//     }
//   else
//     {
//       unsigned int seed = (unsigned) time( NULL );
//       srand( seed );
//       cout << "using system time random seed = " << seed << endl;
//     }
  srand(seed);

  dimX = config.dX;
  dimY = config.dY;
  background = config.bg;
  openings = config.op;
  design = config.des;
  StepLengths = config.SL;
  CorrWidths = config.CW;
  MaxAgesC = config.MAC;
  MaxAgesT = config.MAT;

  minRoomSz = config.minRS;
  medRoomSz = config.medRS; 
  larRoomSz = config.larRS; 
  maxRoomSz = config.maxRS; 

  numSmallRoomsL = config.numSmallL; 
  numMediumRoomsL = config.numMedL; 
  numLargeRoomsL = config.numLarL;  
  numSmallRoomsD = config.numSmallD; 
  numMediumRoomsD = config.numMedD; 
  numLargeRoomsD = config.numLarD;  

  BabyDelayProbsForGenerationT = config.BDPFGT; 
  BabyDelayProbsForGenerationC = config.BDPFGC; 
  BabyDelayProbsForGenerationR = config.BDPFGR; 

  RoomSizeProbS = config.RSPS;
  RoomSizeProbB = config.RSPB;
 
  assert( BabyDelayProbsForGenerationC.size() == 11);  // we made it so
  assert( BabyDelayProbsForGenerationR.size() == 11);  // we made it so
  mutator = config.mut;
  noHeadingProb = config.nHP;
  joinDist = config.jD;

  //MOBs and treasure
  MOBsInLabRooms = config.MLR;         
  MOBsInLabOpen = config.MLO;             
  MOBsInDunRooms  = config.MDR;                 
  MOBsInDunOpen  = config.MDO;               
  TreasInLab  = config.TIL;                 
  TreasInDun  = config.TID;                
  groupSizeMOBLR  = config.gSMOBLR;        
  //  groupSizeMOBLO  = config.gSMOBLO;         
  groupSizeMOBDR  = config.gSMOBDR;        
  //  groupSizeMOBDO  = config.gSMOBDO;         
  groupSizeTreasL  = config.gSTreasL;        
  groupSizeTreasD  = config.gSTreasD;        
  gSVarMOBLR  = config.gSVMOBLR;        
  //  gSVarMOBLO  = config.gSVMOBLO;         
  gSVarMOBDR  = config.gSVMOBDR;        
  //  gSVarMOBDO  = config.gSVMOBDO;        
  gSVarTreasL  = config.gSVTreasL;        
  gSVarTreasD  = config.gSVTreasD;      
  inAnteRoomProb = config.iARP;  

  tunnelCrawlerGeneration = config.tCG;
  tunnelCrawlerClosedProb = config.tCCP;

  lastChanceTunneler = config.lCT;
  genDelayLastChance = config.gDLC;

  //Tunnelers:
  joinPref = config.jP;
  sizeUpP = config.sUpP;
  sizeDownP = config.sDownP;
  patience = config.pat;
  tunnelJoinDist = config.tJD;
  sizeUpGenDelay = config.sUGD;
  columnsInTunnels = config.cIT;
  roomAspectRatio = config.rAR;
  if( (roomAspectRatio >= 1) || (roomAspectRatio <= 0) ) 
    {
      cout << "roomAspectRatio must be a double between 0 and 1, reset to 0.6" << endl;
      roomAspectRatio = 0.6;
    }
  anteRoomProb = config.aRP;
  genSpeedUpOnAnteRoom  = config.gSUOAR;
  if (genSpeedUpOnAnteRoom <= 0)   //we divide by this param
    {
      cout << "Please use genSpeedUpOnAnteRoom >= 1; parameter reset to 1" << endl;
      genSpeedUpOnAnteRoom = 1;
    }
  crawlersInTunnels = config.crIT;
  crawlersInAnterooms = config.crIA;
  if(crawlersInAnterooms)
    {
      if(!crawlersInTunnels)
	{
	  cout << "When you allow Crawlers in Anterooms, you must also allow them in Tunnels (overriding design file data)" << endl;
	}
    }
  seedCrawlersInTunnels = config.sCIT;
  showMovie = config.showM; 
  storeMovie = config.storeM;
  TunnelCrawlerStats = config.TCS;

  Map.reserve(dimX * dimY);
  Map.assign(dimX * dimY , background);

  MapFlagsDirs.reserve(dimX*dimY);
  MapFlagsDirs.assign(dimX*dimY , 0);

  assert(MapFlagsDirs.size() == (unsigned int)(dimX*dimY) );
  assert(MapFlagsDirs[0].checked == 0);    

  //   vector<FlagDirs> MapFlagDirs;

  BuilderPointerVector.reserve(4);
  BuilderPointerVector.assign(4 , (Builder*)NULL);  

  //set the border
  SetRect(0 , 0 , dimX-1 , 0 , G_CLOSED);
  SetRect(0 , 0 , 0 , dimY-1 , G_CLOSED);
  SetRect(dimX-1 , 0 , dimX-1 , dimY-1  , G_CLOSED);
  SetRect(0 , dimY-1 , dimX-1 , dimY-1 , G_CLOSED);

  //implement design
  vector<alifegames::RectFill>::iterator desIt;
  for(desIt = design.begin(); desIt != design.end(); desIt++)
    SetRect(*desIt);

  //set openings
  alifegames::Direction entry;
  vector<alifegames::Direction>::iterator dirIt;
  for(dirIt = openings.begin(); dirIt != openings.end(); dirIt++)
    {
      entry = *dirIt;
      if(NO == entry)
	SetRect( 0 , dimY/2 - 1 , 2 , dimY/2 + 1 , G_OPEN);   //a 3x3 block is guaranteed-open
      else if(WE == entry)
	SetRect( dimX/2 - 1 , 0 , dimX/2 + 1 , 2 , G_OPEN);  
      else if(EA == entry)
	SetRect( dimX/2 - 1 , dimY - 3 , dimX/2 + 1 , dimY - 1 , G_OPEN);  
      else if(SO == entry)
	SetRect( dimX - 3 , dimY/2 - 1 , dimX - 1 , dimY/2 + 1 , G_OPEN); 
      else if(NW == entry)
	{
	  SetRect(0 , 0 , 2 , 2 , G_OPEN);
	} 
      else if(NE == entry)
	{
	  SetRect(0 , dimY-3 , 2 , dimY-1 , G_OPEN);
	} 
      else if(SW == entry)
	{
	  SetRect(dimX-3 , 0 , dimX-1 , 2 , G_OPEN);
	} 
      else if(SE == entry)
	{
	  SetRect(dimX-3 , dimY-3 , dimX-1 , dimY-1 , G_OPEN);
	} 
      else
	assert(false); //no such case
      //end set entry
    }

  //implement RandCrawler
  for(unsigned int gen = 0; gen < config.rCPG.size(); gen++)
    {
      int crawlersPer1000Squares = config.rCPG[gen];
      if( crawlersPer1000Squares > 0 )
	{//otherwise nothing to do
	  int crawlersPerTopBottomWall = (dimY * crawlersPer1000Squares) / 1000;
	  if( crawlersPerTopBottomWall == 0 )
	    {//there's less than one Crawler on the wall, use probabilities
	      if( rand()%1000 < (dimY * crawlersPer1000Squares) )
		crawlersPerTopBottomWall = 1;
	    }
	  int yIndex = 0;
	  for(int ind = 0; ind < crawlersPerTopBottomWall; ind++)
	    {//create Crawlers at the top and borrom walls, heading inwards
	      yIndex = 2 + rand()%( dimY - 4 );
	      IntCoordinate locNorth(0 , yIndex);
	      IntCoordinate fwdNorth(1 , 0);   //going South
	      IntCoordinate intFwd = fwdNorth;      //intended direction = start direction
	      CreateCrawler( locNorth , fwdNorth , 0 , GetMaxAgeC(gen) , gen , intFwd , GetStepLength(gen) , 1 , GetCorrWidth(gen) , Mutate2(config.rC_sSSP) , Mutate2(config.rC_sDSP) , Mutate2(config.rC_tSSP) , Mutate2(config.rC_tDSP) , Mutate2(config.rC_cDP) );
	      //now for the South wall
	      yIndex = 2 + rand()%( dimY - 4 );
	      IntCoordinate locSouth(dimX-1 , yIndex);
	      IntCoordinate fwdSouth(-1 , 0);   //going North
	      intFwd = fwdSouth;      //intended direction = start direction
	      CreateCrawler( locSouth , fwdSouth , 0 , GetMaxAgeC(gen) , gen , intFwd , GetStepLength(gen) , 1 , GetCorrWidth(gen) , Mutate2(config.rC_sSSP) , Mutate2(config.rC_sDSP) , Mutate2(config.rC_tSSP) , Mutate2(config.rC_tDSP) , Mutate2(config.rC_cDP) );
	    }//end North and South walls

	  //now do the east and West walls
	  int crawlersPerLeftRightWall = (dimX * crawlersPer1000Squares) / 1000;
	  if( crawlersPerLeftRightWall == 0 )
	    {//there's less than one Crawler on the wall, use probabilities
	      if( rand()%1000 < (dimX * crawlersPer1000Squares) )
		crawlersPerLeftRightWall = 1;
	    }
	  int xIndex = 0;
	  for(int ind = 0; ind < crawlersPerLeftRightWall; ind++)
	    {//create Crawlers at the left and right walls, heading inwards
	      xIndex = 2 + rand()%( dimX - 4 );
	      IntCoordinate locWest(xIndex , 0);
	      IntCoordinate fwdWest(0 , 1);   //going East
	      IntCoordinate intFwd = fwdWest;      //intended direction = start direction
	      CreateCrawler( locWest , fwdWest , 0 , GetMaxAgeC(gen) , gen , intFwd , GetStepLength(gen) , 1 , GetCorrWidth(gen) , Mutate2(config.rC_sSSP) , Mutate2(config.rC_sDSP) , Mutate2(config.rC_tSSP) , Mutate2(config.rC_tDSP) , Mutate2(config.rC_cDP) );
	      //now for the East wall
	      xIndex = 2 + rand()%( dimX - 4 );
	      IntCoordinate locEast(xIndex , dimY-1);
	      IntCoordinate fwdEast(0 , -1);   //going West
	      intFwd = fwdWest;      //intended direction = start direction
	      CreateCrawler( locEast , fwdEast , 0 , GetMaxAgeC(gen) , gen , intFwd , GetStepLength(gen) , 1 , GetCorrWidth(gen) , Mutate2(config.rC_sSSP) , Mutate2(config.rC_sDSP) , Mutate2(config.rC_tSSP) , Mutate2(config.rC_tDSP) , Mutate2(config.rC_cDP) );
	    }//end East and West walls
	}//end creating Crawlers for this generation
    }//end of going through generations

  //implement design crawlers
  alifegames::CrawlerData cd;
  vector<alifegames::CrawlerData>::const_iterator cIt;
  for(cIt = config.Crawlers.begin(); cIt != config.Crawlers.end(); cIt++)
    {
      cd = *cIt;
      CreateCrawler( cd.loc , cd.dir , -cd.age , cd.maxAge , cd.gen , cd.intDir , cd.sL , cd.op , cd.cW , cd.sSSP , cd.sDSP , cd.tSSP , cd.tDSP , cd.cDP );
    }

  //implement design Crawler pairs from  vector<pair<CrawlerData , CrawlerData> > CrawlerPairs
  vector<pair<alifegames::CrawlerData , alifegames::CrawlerData> >::const_iterator pIt;
  for(pIt = config.CrawlerPairs.begin(); pIt != config.CrawlerPairs.end(); pIt++)
    {
      bool firstIsOpen = true;
      if( 0 == (rand()%2) )
	firstIsOpen = false;
      cd = (*pIt).first;
      if(firstIsOpen)
	cd.op = 1;
      else
	cd.op = 0;
      CreateCrawler( cd.loc , cd.dir , -cd.age , cd.maxAge , cd.gen , cd.intDir , cd.sL , cd.op , cd.cW , cd.sSSP , cd.sDSP , cd.tSSP , cd.tDSP , cd.cDP );
      //also close the square where the Crawlers start:
      SetMap(cd.loc.ShowX() , cd.loc.ShowY() , CLOSED);

      //now the second one:
      cd = (*pIt).second;
      if(firstIsOpen)
	cd.op = 0;    //then the second one is closed
      else
	cd.op = 1;    //and vice versa
      CreateCrawler( cd.loc , cd.dir , -cd.age , cd.maxAge , cd.gen , cd.intDir , cd.sL , cd.op , cd.cW , cd.sSSP , cd.sDSP , cd.tSSP , cd.tDSP , cd.cDP );
      //also close the square where the Crawlers start:
      SetMap(cd.loc.ShowX() , cd.loc.ShowY() , CLOSED);   //could be two diffrent starting locations, so be sure
    }

 //implement design Tunnelers
  alifegames::TunnelerData td;
  vector<alifegames::TunnelerData>::const_iterator tIt;
  for(tIt = config.Tunnelers.begin(); tIt != config.Tunnelers.end(); tIt++)
    {
      td = *tIt;
      CreateTunneler( td.loc , td.dir , -td.age , td.maxAge , td.gen , td.intDir , td.sL , td.tW , td.sDSP , td.tDSP , td.cDP , td.mRRP , td.mRLP , td.jP );
    }

  //store movie start frame
  if(storeMovie)
    {
      vector< SquareInfo > StartingMap;
      for(int x = 0; x < dimX; x++)
	for(int y = 0; y < dimY; y++)
	  { 
	    SquareInfo info( x , y , GetMap(x , y));
	    StartingMap.push_back( info );
	  }
      Movie.push_back(StartingMap);
    }

}

void alifegames::DungeonMaker::Init_fromFile(const char* filename, unsigned int seed) {
	alifegames::Config config;
	if(!config.ReadDesign(filename)) {
		std::cerr << "Could not read design file, aborting" << std::endl;
		exit(1);
	}
	if (seed == NULL) {
		seed = (unsigned) time( NULL );
	}
	Init_fromConfig(config , seed);
}

void alifegames::DungeonMaker::Init_fromText(const char* designText, unsigned int seed) {
	alifegames::Config config;
	if(!config.AcceptDesign(designText)) {
		std::cerr << "Could not read design file, aborting" << std::endl;
		exit(1);
	}
	if (seed == NULL) {
		seed = (unsigned) time( NULL );
	}
	Init_fromConfig(config , seed);
}

void alifegames::DungeonMaker::SetRect(int startX , int startY , int endX , int endY ,  alifegames::SquareData dat)
{
  if( ( endX < startX ) || ( endY < startY ) ) 
    {
      cout << "Refuse to set incorrectly specified rectangle; sX = " << startX << "; sY = " << startY << "; eX = " << endX << "; eY = " << endY << endl;
      return;
    }
  else
    {
      for(int indX = startX; indX <= endX; indX++)
	for(int indY = startY; indY <= endY; indY++)
	  SetMap( indX , indY , dat );
    }
}

void alifegames::DungeonMaker::SetRect( RectFill rectDat)
{
  if( ( rectDat.endX < rectDat.startX ) || ( rectDat.endY < rectDat.startY ) ) 
    {
      cout << "Refuse to set incorrectly specified rectangle; sX = " << rectDat.startX << "; sY = " << rectDat.startY << "; eX = " << rectDat.endX << "; eY = " << rectDat.endY << endl;
      return;
    }
  else
    {
      for(int indX = rectDat.startX; indX <= rectDat.endX; indX++)
	for(int indY = rectDat.startY; indY <= rectDat.endY; indY++)
	  SetMap( indX , indY , rectDat.type );
    }
}

void alifegames::DungeonMaker::CreateCrawler( IntCoordinate loc , IntCoordinate fwd , int a , int mA , int g , IntCoordinate intDir , int sL ,  int o, int cW , int sSSP , int sDSP , int tSSP , int tDSP , int cDP )
{
  WallCrawler* pNewCrawler = new WallCrawler( this , loc , fwd , a , mA , g , intDir , sL , o , cW , sSSP , sDSP , tSSP , tDSP , cDP );

  vector<Builder*>::iterator it;
  for(it = BuilderPointerVector.begin(); it != BuilderPointerVector.end(); it++)
    {
      if( NULL == *it )   //we have found an empty slot in the vector
	break;
    }
 
  if(it != BuilderPointerVector.end() )   //points to an empty slot in the vector
    *it = pNewCrawler;
  else
    BuilderPointerVector.push_back(pNewCrawler);
}

void alifegames::DungeonMaker::CreateTunneler( IntCoordinate loc , IntCoordinate fwd , int a , int mA , int g , IntCoordinate intDir , int sL , int tW , int sDSP , int tDSP , int cDP , int mRRP , int mRLP , int jP )
{
  Tunneler* pNewTunneler = new Tunneler( this , loc , fwd , a , mA , g , intDir , sL , tW , sDSP , tDSP , cDP , mRRP , mRLP , jP );

  vector<Builder*>::iterator it;
  for(it = BuilderPointerVector.begin(); it != BuilderPointerVector.end(); it++)
    {
      if( NULL == *it )   //we have found an empty slot in the vector
	break;
    }
 
  if(it != BuilderPointerVector.end() )   //points to an empty slot in the vector
    *it = pNewTunneler;
  else
    BuilderPointerVector.push_back(pNewTunneler);
}

void alifegames::DungeonMaker::CreateRoomie( IntCoordinate loc , IntCoordinate fwd , int a , int mA , int g , int dW , RoomSize s , int cat )
  //:Roomie( DungeonMaker* pdm , IntCoordinate loc , IntCoordinate fwd , int a , int mA , int g , int dW , RoomSize s , int cat)
{
  Roomie* pNewRoomie = new Roomie( this , loc , fwd , a , mA , g , dW , s , cat );

  vector<Builder*>::iterator it;
  for(it = BuilderPointerVector.begin(); it != BuilderPointerVector.end(); it++)
    {
      if( NULL == *it )   //we have found an empty slot in the vector
	break;
    }
 
  if(it != BuilderPointerVector.end() )   //points to an empty slot in the vector
    *it = pNewRoomie;
  else
    BuilderPointerVector.push_back(pNewRoomie);
}

int alifegames::DungeonMaker::Mutate(int input)
{
  int output = input - mutator + ( rand()% (2*mutator+1) ); 
  if(output < 0)
    return(0);
  else
    return(output);
}

int alifegames::DungeonMaker::Mutate2(int input)
{
  if(input <= 50) 
    {
      if(input < 0)
	return(0);
      else
	return( rand()%( 2*input + 1 ) ); 
    }
 else 
   {
     if(input > 100)
       return(100);
     else
       return( 2*input - 100 +  rand()%( 200 - 2*input + 1 ) );
   }
}

int alifegames::DungeonMaker::GetRoomSizeProbS(unsigned int tW , RoomSize sz)
{
  if(tW >= RoomSizeProbS.size() )
    {
      if(LARGE == sz)   return(100);
      else              return(0);
    }
  else if(LARGE == sz)
    return(RoomSizeProbS[tW].lg);
  else if(MEDIUM == sz)
    return(RoomSizeProbS[tW].md);
  else
    {
      assert(SMALL == sz);
    return(RoomSizeProbS[tW].sm);
    }
}
 
int alifegames::DungeonMaker::GetRoomSizeProbB(unsigned int tW , RoomSize sz)
{
  if(tW >= RoomSizeProbB.size() )
    {
      if(LARGE == sz)   return(100);
      else              return(0);
    }
  else if(LARGE == sz)
    return(RoomSizeProbB[tW].lg);
  else if(MEDIUM == sz)
    return(RoomSizeProbB[tW].md);
  else
    {
      assert(SMALL == sz);
      return(RoomSizeProbB[tW].sm);
    }
}

void alifegames::DungeonMaker::SeedCrawlersInTunnels()
{   //this method creates "number=seedCrawlersInTunnels" Crawlers in the middle of tunnels
  int numberFound = 0;
  int tries = 0;
  //we need a Crawler to be able to look around on the map, the DungeonMaker itself cannot do this
  WallCrawler* pWC = new WallCrawler(this , IntCoordinate(2 , 2) , IntCoordinate(1 , 0) , 0 , 1 , 0 , IntCoordinate(1 , 0) , 1 , 0 , 1 , 0 , 0 , 0 , 0 , 0 );

  if(showMovie || storeMovie)
    ChangedThisIteration.clear();  //make the vector ready to accept SquareInfo that changes while placing Crawlers

  while( (numberFound < seedCrawlersInTunnels) && (tries < dimX*dimY) )
    {
      tries++;   //no I will NOT put this in the conditional above!
      int startX = 1 + rand()%(dimX-4);     // [1 , ... , dimX-2]
      int startY = 1 + rand()%(dimY-4);     // [1 , ... , dimY-2]
      IntCoordinate Test(startX , startY);

      //now make a starting direction
      if( (rand()%100) < 50 )
	startX = 0;
      else
	startY = 0;
      if(0 == startX)
	{
	  if( (rand()%100) < 50 )
	    startY = -1;
	  else
	    startY = 1;
	}
      else
	{
	  assert(0 == startY);
	  if( (rand()%100) < 50 )
	    startX = -1;
	  else
	    startX = 1;
	}
      IntCoordinate Dir(startX , startY);
      IntCoordinate Orth;   //orthogonal to Dir
      if( Dir.ShowX( ) == 0 )
	{
	  IntCoordinate Temp( Dir.ShowY() , 0 );
	  Orth = Temp;
	}
      else if( Dir.ShowY( ) == 0 )
	{
	  IntCoordinate Temp(0 , - Dir.ShowX() );
	  Orth = Temp;
	}


      //now search through the dungeon for a tunnel with width at least 3 (tunnelWidth=1) so we can run a Crawler down the middle
      //start at Start and go towards Dir until we find a suitable place or reach the end of the map
      bool notFound = true;
      while(notFound)
	{
	  Test = Test + Dir;
	  if( (Test.ShowX() < 2) || (Test.ShowY() < 2) || (Test.ShowX() > dimX - 3) || (Test.ShowY() > dimY - 3) )
	    break;   //end the loop, we're running off the map

	  if(GetMap(Test) != IT_OPEN)
	    continue;   //not in a tunnel
	  //now test the 8 adjacent points, which must all be inside a tunnel for this to work
	  if( (GetMap(Test + Dir) != IT_OPEN) || (GetMap(Test - Dir) != IT_OPEN) || (GetMap(Test + Orth) != IT_OPEN) || (GetMap(Test - Orth) != IT_OPEN) || (GetMap(Test + Dir + Orth) != IT_OPEN) || (GetMap(Test - Dir + Orth) != IT_OPEN) || (GetMap(Test + Dir - Orth) != IT_OPEN) || (GetMap(Test - Dir - Orth) != IT_OPEN) )
	    continue;   //no space to run Crawler

	  SetMap(Test , CLOSED);  //closed square for the Crawler to sit on 
	  //create 4 Crawlers looking in all 4 directions
	  CreateCrawler(Test , Dir , 0 , TunnelCrawlerStats.maxAge , activeGeneration + 1 , Dir , TunnelCrawlerStats.sL , 1 , 1 , TunnelCrawlerStats.sSSP , TunnelCrawlerStats.sDSP , TunnelCrawlerStats.tSSP , TunnelCrawlerStats.tDSP , TunnelCrawlerStats.cDP);
	  CreateCrawler(Test , Orth , 0 , TunnelCrawlerStats.maxAge , activeGeneration + 1 , Dir , TunnelCrawlerStats.sL , 1 , 1 , TunnelCrawlerStats.sSSP , TunnelCrawlerStats.sDSP , TunnelCrawlerStats.tSSP , TunnelCrawlerStats.tDSP , TunnelCrawlerStats.cDP);
	  CreateCrawler(Test , - Orth , 0 , TunnelCrawlerStats.maxAge , activeGeneration + 1 , Dir , TunnelCrawlerStats.sL , 1 , 1 , TunnelCrawlerStats.sSSP , TunnelCrawlerStats.sDSP , TunnelCrawlerStats.tSSP , TunnelCrawlerStats.tDSP , TunnelCrawlerStats.cDP);
	  //if we want a closed Crawler in here, we let it look back to where it camne from, because it can close there fast and reliably
	  if( (rand()%100) < tunnelCrawlerClosedProb )
	    CreateCrawler(Test , - Dir , 0 , TunnelCrawlerStats.maxAge , activeGeneration + 1 , Dir , TunnelCrawlerStats.sL , 0 , 1 , TunnelCrawlerStats.sSSP , TunnelCrawlerStats.sDSP , TunnelCrawlerStats.tSSP , TunnelCrawlerStats.tDSP , TunnelCrawlerStats.cDP);
	  else
	    CreateCrawler(Test , - Dir , 0 , TunnelCrawlerStats.maxAge , activeGeneration + 1 , Dir , TunnelCrawlerStats.sL , 1 , 1 , TunnelCrawlerStats.sSSP , TunnelCrawlerStats.sDSP , TunnelCrawlerStats.tSSP , TunnelCrawlerStats.tDSP , TunnelCrawlerStats.cDP);

	  notFound = false;
	  numberFound++;

	}//while loop notFound

    }//while loop mumberFound, tries

  if(storeMovie)
    Movie.push_back(ChangedThisIteration);

  delete pWC;
}


bool alifegames::DungeonMaker::MakeIteration()
{
  if(showMovie || storeMovie)
    {
      ChangedThisIteration.clear();  //make the vector ready to accept SquareInfo that changes this iteration
      assert(ChangedThisIteration.size() == 0 );
    }

  for(unsigned int i = 0; i < BuilderPointerVector.size(); i++)
    {
      if(NULL != BuilderPointerVector[i])
	{
	  if(!BuilderPointerVector[i] -> StepAhead() )   //if the Builder cannot do anything any more
	    {
	      delete BuilderPointerVector[i];
	      BuilderPointerVector[i] = NULL;
	    }
	}
    } 

  if(ChangedThisIteration.size() != 0)   //we made changes to the map
    {
      //we are at the end of this iteration, so if want we store the changes
      if(storeMovie)
	Movie.push_back(ChangedThisIteration);
      return(true);
    }
  else
    return(false);
}

bool alifegames::DungeonMaker::AdvanceGeneration()
{
  bool thereAreBuilders = false;
  int highestNegativeAge = 0;  //used to advance the ages of all Builders of this generation if they are all dormant
  for(unsigned int i = 0; i < BuilderPointerVector.size(); i++)
    {
      if(NULL != BuilderPointerVector[i])
	{
	  thereAreBuilders = true;
	  if(BuilderPointerVector[i] -> GetGeneration() == activeGeneration )   //if the Builder is of the current generation
	    {
	      int a = BuilderPointerVector[i] -> GetAge();
	      if( a >= 0 )
		return( true );  //this Builder is still active, we cannot advance generation
	      else if( ( 0 == highestNegativeAge ) || ( a > highestNegativeAge ) )
		highestNegativeAge = a;
	    }
	}
    } 
  //if we get here, there are either no active Builders left in the current activeGeneration
  //or they are all dormant
  if(0 == highestNegativeAge)   //no active Builders left
    {
    activeGeneration++;
    return(thereAreBuilders);
    }
  else //we have dormany Builders
    {
      assert(highestNegativeAge < 0);
      for(unsigned int i = 0; i < BuilderPointerVector.size(); i++)
	{
	  if(NULL != BuilderPointerVector[i])
	    {
	      if(BuilderPointerVector[i] -> GetGeneration() == activeGeneration )   //if the Builder is of the current generation
		BuilderPointerVector[i] -> AdvanceAge( -highestNegativeAge );
	    }
	} 
      return(thereAreBuilders);
    }
}

bool alifegames::DungeonMaker::IsChecked(IntCoordinate pos , vector<IntCoordinate> Checked)
{
  for(unsigned int i = 0; i != Checked.size(); i++)
    {
      if( ( pos.first == Checked[i].first ) && ( pos.second == Checked[i].second ) )
	return(true);
    }
  return(false);
}

bool alifegames::DungeonMaker::IsActive(IntCoordinate pos , list<IntCoordinate> Active)
{
  for(list<IntCoordinate>::iterator i = Active.begin(); i != Active.end(); i++)
    {
      if( ( pos.first == (*i).first ) && ( pos.second == (*i).second ) )
	return(true);
    }
  return(false);
}

int alifegames::DungeonMaker::GetMinRoomSize(RoomSize sz)
{
  if(SMALL == sz) 
    return(minRoomSz);
  else if(MEDIUM == sz) 
    return(medRoomSz);
  else  
    {
      assert(LARGE == sz);
      return(larRoomSz);
    }
}
int alifegames::DungeonMaker::GetMaxRoomSize(RoomSize sz)
{
  if(SMALL == sz) 
    return(medRoomSz - 1);
  else if(MEDIUM == sz) 
    return(larRoomSz - 1);
  else  
    {
      assert(LARGE == sz);
      return(maxRoomSz - 1);
    }
}

void alifegames::DungeonMaker::SortRooms()
{
  sort(Rooms.begin() , Rooms.end() , RoomComp() );
}

void alifegames::DungeonMaker::PlonkDownStuff()
{
  int numRooms = NumberOfRooms();
  if(numRooms > 0)
    SortRooms();   //sorted by size now
  int numMOBsDR = 0;    //MOBs in dungeon rooms
  int numMOBsDO = 0;    //                open
  int numMOBsLR = 0;    //        labyrinth rooms
  int numMOBsLO = 0;    //                  open
  int numTreasD = 0;    //treasure in dungeon
  int numTreasL = 0;    //            labyrinth
  int numLabRooms = 0;
  int numDunRooms = 0;
  //now count'em:
  unsigned int i;
  unsigned int dimMOBsDR = MOBsInDunRooms.size();
  for (i = 0; i < dimMOBsDR; i++)
    numMOBsDR += MOBsInDunRooms[i];
  unsigned int dimMOBsDO = MOBsInDunOpen.size();
  for (i = 0; i < dimMOBsDO; i++)
    numMOBsDO += MOBsInDunOpen[i];
  unsigned int dimMOBsLR = MOBsInLabRooms.size();
  for (i = 0; i < dimMOBsLR; i++)
    numMOBsLR += MOBsInLabRooms[i];
  unsigned int dimMOBsLO = MOBsInLabOpen.size();
  for (i = 0; i < dimMOBsLO; i++)
    numMOBsLO += MOBsInLabOpen[i];
  unsigned int dimTreasD = TreasInDun.size();
  for (i = 0; i < dimTreasD; i++)
    numTreasD += TreasInDun[i];
  unsigned int dimTreasL = TreasInLab.size();
  for (i = 0; i < dimTreasL; i++)
    numTreasL += TreasInLab[i];
  for (i = 0; i < Rooms.size(); i++)
    {
      if( Rooms[i].GetInDungeon() )  //if true the room is inside the dungeon part, otherwise in the labyrinth
	numDunRooms++;
      else
	numLabRooms++;
    }
  assert(numRooms == numLabRooms+numDunRooms);

  //estimate how many groups we will have to plonk down
  int numGroupsMOBsDR;
  if(groupSizeMOBDR > 1)
    numGroupsMOBsDR = numMOBsDR/groupSizeMOBDR; 
  else
    numGroupsMOBsDR = numMOBsDR;
  //  int numGroupsMOBsDO = numMOBsDO/groupSizeMOBDO;
  int numGroupsMOBsLR;
  if(groupSizeMOBLR > 1)
    numGroupsMOBsLR = numMOBsLR/groupSizeMOBLR;
  else
    numGroupsMOBsLR = numMOBsLR;
  //  int numGroupsMOBsLO = numMOBsLO/groupSizeMOBLO;
  int numGroupsTreasD;
  if(groupSizeTreasD)
    numGroupsTreasD = numTreasD/groupSizeTreasD;
  else
    numGroupsTreasD = numTreasD;
  int numGroupsTreasL;
  if(groupSizeTreasL > 1)
    numGroupsTreasL = numTreasL/groupSizeTreasL;
  else
    numGroupsTreasL = numTreasL;

  //bail out if things don't look right:
  if(numGroupsMOBsDR > numDunRooms)
    {
      cout << "Design file demands more groups of MOBs in dungeon rooms than we have such rooms. Aborting plunking." << endl;
      return;
    }
  if(numGroupsMOBsLR > numLabRooms)
    {
      cout << "Design file demands more groups of MOBs in labyrinth rooms than we have such rooms. Aborting plunking." << endl;
      return;
    }
  if(numGroupsTreasD > numDunRooms)
    {
      cout << "Design file demands more groups of treasure in dungeon rooms than we have such rooms. Aborting plunking." << endl;
      return;
    }
  if(numGroupsTreasL > numLabRooms)
    {
      cout << "Design file demands more groups of treasure in labyrinth rooms than we have such rooms. Aborting plunking." << endl;
      return;
    }

  //well, it's time to start plunking in earnest
  //start with dungeon rooms
  Room currRoom;
  int currIndex = 0;
  bool firstRoom = true;
  int gSizeM , gSizeT;
  while( ( numMOBsDR > 0 ) || ( numTreasD > 0 ) )   //in dungeon rooms
    {
      vector<int> MOBtype , treasType;   //what types of MOBs and treasure to put into this room
      vector<IntCoordinate> Locations;   //where to put it
      //get the next room to plonk in to
      bool notFound = true;
      while( (notFound) && (currIndex < numRooms) )
	{
	  currRoom = Rooms[currIndex++];
	  if(currRoom.GetInDungeon() )  //if currentRoom is a dungeon room
	    notFound = false;
	}

      //now plonk down some stuff in currRoom
      if(firstRoom)
	{//make a big group
	  gSizeM = groupSizeMOBDR + gSVarMOBDR;
	  gSizeT = groupSizeTreasD + gSVarTreasD;
	}
      else
	{//make a random size group
	  gSizeM = groupSizeMOBDR - gSVarMOBDR + rand()%( 2*gSVarMOBDR + 1 );
	  if(gSizeM < 1)
	    gSizeM = 1;
	  gSizeT = groupSizeTreasD - gSVarTreasD + rand()%( 2*gSVarTreasD + 1 );
	  if(gSizeT < 1)
	    gSizeT = 1;
	}

      //get MOBtype
      if( numMOBsDR > 0 )
	{
	  assert(dimMOBsDR > 0);   //otherwise the for loop starts at -1
	  if(firstRoom)
	    {
	      for(i = dimMOBsDR-1; i >= 0; i--)
		if(MOBsInDunRooms[i] > 0)
		  {//we actually want a MOB of type i
		    MOBtype.push_back(i);  //hold it to insert in room later
		    MOBsInDunRooms[i]--;   //one less of this type to insert
		    numMOBsDR--;
		    gSizeM--;              //one less to find
		    break;                 //we get the biggest MOB for the largest room, but only this once we use special case treatment
		  }
	    }
	  while(gSizeM > 0)   //we need more monster types for our group
	    {
	      i = rand()%dimMOBsDR;
	      if(MOBsInDunRooms[i] > 0)
		{//we actually want a MOB of type i
		  MOBtype.push_back(i);  //hold it to insert in room later
		  MOBsInDunRooms[i]--;   //one less of this type to insert
		  numMOBsDR--;
		  gSizeM--;              //one less to find
		}
	      if(numMOBsDR == 0)
		break;   //none left to place
	    }
	}

      //get treasType 
      if(numTreasD > 0)
	{
	  assert(dimTreasD > 0);   //otherwise the for loop starts at -1
	  if(firstRoom)
	    {
	      for(i = dimTreasD-1; i >= 0; i--)
		if(TreasInDun[i] > 0)
		  {//we actually want a treasure of type i
		    treasType.push_back(i);  //hold it to insert in room later
		    TreasInDun[i]--;         //one less of this type to insert
		    numTreasD--;
		    gSizeT--;              //one less to find
		    break;              //we get the biggest treasure for the largest room, but only this once we use special case treatment
		  }
	      firstRoom = false;           
	    }
	  while(gSizeT > 0)   //we want more treasure types for our group
	    {
	      i = rand()%dimTreasD;
	      if(TreasInDun[i] > 0)
		{//we actually want a treasure of type i
		  treasType.push_back(i);  //hold it to insert in room later
		  TreasInDun[i]--;         //one less of this type to insert
		  numTreasD--;
		  gSizeT--;              //one less to find
		}
	      if(numTreasD == 0)
		break;   //we've run out of treasure
	    }
	}

      //get Locations to insert MOBs and treasure
      unsigned int count = MOBtype.size() + treasType.size();   //number of squares in the room we need
      if(count >= currRoom.GetSize() )
	{
	  cout << "Too much treasure and MOBs for the size of the room, bailing out from plonking." << endl;
	  return;
	}
      while(count > 0)
	{
	  IntCoordinate square = currRoom.GetRandomSquare();
	  bool isUnique = true;
	  for(i = 0; i < Locations.size(); i++)
	    if(square == Locations[i])
	      {
		isUnique = false;
		break;
	      }
	  if(isUnique) //we haven't found this square before
	    {
	      Locations.push_back(square);
	      count--;   //we need one less
	    }
	}//count > 0                   

      //now we have everything assembled, MOBtypes, treasureTypes, and Locations, and we can simply assign:
      assert( (MOBtype.size() + treasType.size() ) == Locations.size() );  
      for(i = 0; i < MOBtype.size(); i++)
	{
	  SpawnInfo spawn( Locations[i].first , Locations[i].second , MOBtype[i] );
	  MOBInfo.push_back(spawn);
	}
      for(i = 0; i < treasType.size() ; i++)
	{
	  SpawnInfo spawn( Locations[MOBtype.size() + i].first , Locations[MOBtype.size() + i].second , treasType[i] );
	  TreasInfo.push_back(spawn);
	}

      if(currIndex == numRooms)
	{
	  cout << "Ran out of rooms while plonking in dungeon, aborting plunking..." << endl;
	  return;
	}
    }//  while( ( numMOBsDR > 0 ) || ( numTreasD > 0 ) )

  //now do the same thing for the labyrinth
  currIndex = 0;   //start again at Rooms[0]
  firstRoom = true;
  while( ( numMOBsLR > 0 ) || ( numTreasL > 0 ) )   //in labyrinth rooms
    {
      vector<int> MOBtype , treasType;   //what types of MOBs and treasure to put into this room
      vector<IntCoordinate> Locations;   //where to put it
      //get the next room to plonk in to
      bool notFound = true;
      while( (notFound) && (currIndex < numRooms) )
	{
	  currRoom = Rooms[currIndex++];
	  if(!currRoom.GetInDungeon() )  //if currentRoom is not a dungeon room it's a labyrinth room!
	    notFound = false;
	}

      //now plonk down some stuff in currRoom
      if(firstRoom)
	{//make a big group
	  gSizeM = groupSizeMOBLR + gSVarMOBLR;
	  gSizeT = groupSizeTreasL + gSVarTreasL;
	}
      else
	{//make a random size group
	  gSizeM = groupSizeMOBLR - gSVarMOBLR + rand()%( 2*gSVarMOBLR + 1 );
	  if(gSizeM < 1)
	    gSizeM = 1;
	  gSizeT = groupSizeTreasL - gSVarTreasL + rand()%( 2*gSVarTreasL + 1 );
	  if(gSizeT < 1)
	    gSizeT = 1;
	}

      //get MOBtype
      if(numMOBsLR > 0)
	{
	  assert(dimMOBsLR > 0);   //otherwise the for loop starts at -1
	  if(firstRoom)
	    {
	      for(i = dimMOBsLR-1; i >= 0; i--)
		if(MOBsInLabRooms[i] > 0)
		  {//we actually want a MOB of type i
		    MOBtype.push_back(i);  //hold it to insert in room later
		    MOBsInLabRooms[i]--;   //one less of this type to insert
		    numMOBsLR--;
		    gSizeM--;              //one less to find
		    break;                 //we get the biggest MOB for the largest room, but only this once we use special case treatment
		  }
	    }
	  while(gSizeM > 0)   //we need more monster types for our group
	    {
	      i = rand()%dimMOBsLR;
	      if(MOBsInLabRooms[i] > 0)
		{//we actually want a MOB of type i
		  MOBtype.push_back(i);  //hold it to insert in room later
		  MOBsInLabRooms[i]--;   //one less of this type to insert
		  numMOBsLR--;
		  gSizeM--;              //one less to find
		}
	      if(numMOBsLR == 0)
		break;   //none left to place
	    }
	}

      //get treasType 
      if(numTreasL > 0)
	{
	  assert(dimTreasL > 0);   //otherwise the for loop starts at -1
	  if(firstRoom)
	    {
	      for(i = dimTreasL-1; i >= 0; i--)
		if(TreasInLab[i] > 0)
		  {//we actually want a treasure of type i
		    treasType.push_back(i);  //hold it to insert in room later
		    TreasInLab[i]--;         //one less of this type to insert
		    numTreasL--;
		    gSizeT--;              //one less to find
		    break;                 //we get the biggest treasure for the largest room, but only this once we use special case treatment
		  }
	      firstRoom = false;           
	    }
	  while(gSizeT > 0)   //we want more treasure types for our group
	    {
	      i = rand()%dimTreasL;
	      if(TreasInLab[i] > 0)
		{//we actually want a treasure of type i
		  treasType.push_back(i);  //hold it to insert in room later
		  TreasInLab[i]--;         //one less of this type to insert
		  numTreasL--;
		  gSizeT--;              //one less to find
		}
	      if(numTreasL == 0)
		break;   //we've run out of treasure
	    }
	}

      //get Locations to insert MOBs and treasure
      unsigned int count = MOBtype.size() + treasType.size();   //number of squares in the room we need
      if(count >= currRoom.GetSize() )
	{
	  cout << "Too much treasure and MOBs for the size of the labyrinth room, bailing out from plonking." << endl;
	  return;
	}
      while(count > 0)
	{
	  IntCoordinate square = currRoom.GetRandomSquare();
	  bool isUnique = true;
	  for(i = 0; i < Locations.size(); i++)
	    if(square == Locations[i])
	      {
		isUnique = false;
		break;
	      }
	  if(isUnique) //we haven't found this square before
	    {
	      Locations.push_back(square);
	      count--;   //we need one less
	    }
	}//count > 0                   

      //now we have everything assembled, MOBtypes, treasureTypes, and Locations, and we can simply assign:
      assert( (MOBtype.size() + treasType.size() ) == Locations.size() );  
      for(i = 0; i < MOBtype.size(); i++)
	{
	  SpawnInfo spawn( Locations[i].first , Locations[i].second , MOBtype[i] );
	  MOBInfo.push_back(spawn);
	}
      for(i = 0; i < treasType.size() ; i++)
	{
	  SpawnInfo spawn( Locations[MOBtype.size() + i].first , Locations[MOBtype.size() + i].second , treasType[i] );
	  TreasInfo.push_back(spawn);
	}

      if(currIndex == numRooms)
	{
	  cout << "Ran out of rooms while plonking in labyrinth, aborting plunking..." << endl;
	  return;
	}
    }//  while( ( numMOBsLR > 0 ) || ( numTreasL > 0 ) )  

  //we finished placing stuff in rooms, now do it in the open:
  //first for labyrinth
  vector<int> MOBtype;   //what types of MOBs and treasure to plonk
  vector<IntCoordinate> Locations;   //where to plonk it
  int tries = 0;
  while( (numMOBsLO > 0) && (tries < dimX*dimY) )
    {
      tries++;
      //get candidate starting point
      IntCoordinate Test( 1 + ( rand()%(dimX-3) ) , 1 + ( rand()%(dimY-3) ) );
      //now make a starting direction
      int startX , startY;
      if( (rand()%100) < 50 )
	startX = 0;
      else
	startY = 0;
      if(0 == startX)
	{
	  if( (rand()%100) < 50 )
	    startY = -1;
	  else
	    startY = 1;
	}
      else
	{
	  assert(0 == startY);
	  if( (rand()%100) < 50 )
	    startX = -1;
	  else
	    startX = 1;
	}
      IntCoordinate Dir(startX , startY);

      //now search through the dungeon for an OPEN square, which must be inside the labyrinth part
      //start at Start and go towards Dir until we find a suitable place or reach the end of the map
      bool notFound = true;
      while(notFound)
	{
	  Test = Test + Dir;
	  if( (Test.ShowX() < 2) || (Test.ShowY() < 2) || (Test.ShowX() > dimX - 3) || (Test.ShowY() > dimY - 3) )
	    break;   //end the loop, we're running off the map

	  if(GetMap(Test) != OPEN)
	    continue;   //not in a tunnel

	  bool isUnique = true;
	  for(i = 0; i < Locations.size(); i++)
	    if(Test == Locations[i])
	      {
		isUnique = false;
		break;
	      }
	  if(isUnique) //we haven't found this square before
	    Locations.push_back(Test);
	  else
	    continue;;  //find another test spot

	  notFound = false;
	 
	  for(i = 0; i < dimMOBsLO; i++)
	    if(MOBsInLabOpen[i] > 0)
	      {//we actually want a MOB of type i
		MOBsInLabOpen[i]--;   //one less of this type to insert
		MOBtype.push_back(i);
		numMOBsLO--;
		break;
	      }
	  //now they're put into MOBtype and Locations instead to avoid duplication
// 	  SpawnInfo spawn( Test.first , Test.second , i );
// 	  MOBInfo.push_back(spawn);

	}//while notFound
    }// while(numMOBsLO > 0)

  //now for dungeon, in the open
  tries = 0;
  while( (numMOBsDO > 0) && (tries < dimX*dimY) )
    {
      tries++;
      //get candidate starting point
      IntCoordinate Test( 1 + ( rand()%(dimX-3) ) , 1 + ( rand()%(dimY-3) ) );
      //now make a starting direction
      int startX , startY;
      if( (rand()%100) < 50 )
	startX = 0;
      else
	startY = 0;
      if(0 == startX)
	{
	  if( (rand()%100) < 50 )
	    startY = -1;
	  else
	    startY = 1;
	}
      else
	{
	  assert(0 == startY);
	  if( (rand()%100) < 50 )
	    startX = -1;
	  else
	    startX = 1;
	}
      IntCoordinate Dir(startX , startY);

      //what are we looking for, tunnel or anteroom?
      SquareData target;
      if( (rand()%100) < inAnteRoomProb )
	target = IA_OPEN;
      else
	target = IT_OPEN;

      //now search through the dungeon for a target square, which must be inside the dungeon part
      //start at Start and go towards Dir until we find a suitable place or reach the end of the map
      bool notFound = true;
      while(notFound)
	{
	  Test = Test + Dir;
	  if( (Test.ShowX() < 2) || (Test.ShowY() < 2) || (Test.ShowX() > dimX - 3) || (Test.ShowY() > dimY - 3) )
	    break;   //end the loop, we're running off the map

	  if(GetMap(Test) != target)
	    continue;   //not on target
	  if( (GetMap(Test+Dir) == target) && (GetMap(Test+Dir+Dir) == target) )
	    continue;   //otherwise all MOBs stand next to a wall

	  bool isUnique = true;
	  for(i = 0; i < Locations.size(); i++)
	    if(Test == Locations[i])
	      {
		isUnique = false;
		break;
	      }
	  if(isUnique) //we haven't found this square before
	    Locations.push_back(Test);
	  else
	    continue; //find another test spot

	  notFound = false;  //we must'a found it!
	 
	  for(i = 0; i < dimMOBsDO; i++)
	    if(MOBsInDunOpen[i] > 0)
	      {//we actually want a MOB of type i
		MOBsInDunOpen[i]--;   //one less of this type to insert
		MOBtype.push_back(i);
		numMOBsDO--;
		break;
	      }

// 	  SpawnInfo spawn( Test.first , Test.second , i );
// 	  MOBInfo.push_back(spawn);

	}//while notFound
    }// while(numMOBsDO > 0)

  assert( MOBtype.size() == Locations.size() );  
  for(i = 0; i < MOBtype.size(); i++)
    {
      SpawnInfo spawn( Locations[i].first , Locations[i].second , MOBtype[i] );
      MOBInfo.push_back(spawn);
    }

}//end of PlonkDownStuff

void alifegames::DungeonMaker::PutPlonkOnMap()
{//this is provisional and will just show in 3 different colors for different types 
  int PROV1 = 2;   int PROV2 = 4;    //PROVISIONAL VALUES, USERS MUST CHANGE THIS
  unsigned int i;

  if(showMovie || storeMovie)
    ChangedThisIteration.clear();  //make the vector ready to accept SquareInfo that changes while building the room

  for(i = 0; i < MOBInfo.size(); i++)
    {
      if(MOBInfo[i].type < PROV1)
	SetMap(MOBInfo[i].xCoord , MOBInfo[i].yCoord , MOB1 );
      else if(MOBInfo[i].type < PROV2)
	SetMap(MOBInfo[i].xCoord , MOBInfo[i].yCoord , MOB2 );
      else 
	SetMap(MOBInfo[i].xCoord , MOBInfo[i].yCoord , MOB3 );
    }

  for(i = 0; i < TreasInfo.size(); i++)
    {
      assert( IR_OPEN == GetMap(TreasInfo[i].xCoord , TreasInfo[i].yCoord) );
      if(TreasInfo[i].type < PROV1)
	SetMap(TreasInfo[i].xCoord , TreasInfo[i].yCoord , TREAS1 );
      else if(TreasInfo[i].type < PROV2)
	SetMap(TreasInfo[i].xCoord , TreasInfo[i].yCoord , TREAS2 );
      else 
	SetMap(TreasInfo[i].xCoord , TreasInfo[i].yCoord , TREAS3 );
    }

  if(storeMovie)
    Movie.push_back(ChangedThisIteration);
}


bool alifegames::DungeonMaker::CreateRoom(RectFill rect)
{//we randomly pick a spot in the dungeon, and check whether it can be made into a room by placing a single door tile
  if( ( dimX < 10 ) || ( dimY < 10 ) )
    return(false);   //avoid triggering assertions in ridiculously small dungeons

  if( (rect.endX - rect.startX) <= 5 )
    return(false);
  if( (rect.endY - rect.startY) <= 5 )
    return(false);   //too small to mess with, see next lines

  int startX = rect.startX + 1 + rand()%(rect.endX - rect.startX - 3);     // [startX + 1 , ... , endX - 1]
  int startY = rect.startY + 1 + rand()%(rect.endY - rect.startY - 3);     // [startY + 1 ,     , endY - 1]
  IntCoordinate Start(startX , startY);

  if( !IsOpen(Start) )
    return(false);   //bad choice of start position
  if( IsChecked(Start) )
    return(false);   //this position has been checked before and found wanting (it might still yield a room, though)

  unsigned int maxRS = maxRoomSz;
  if(!WantsMoreRoomsL(LARGE) )
    maxRS = larRoomSz;
  if(!WantsMoreRoomsL(LARGE) && !WantsMoreRoomsL(MEDIUM) )
    maxRS = medRoomSz;
 if(!WantsMoreRoomsL() )
   return(false);

//   N = x--;  E = y++;   S = x++;   W = y--;
//   NE = x-- , y++;  SE = x++ , y++;   SW = x++ , y--;   NW = x-- , y--;
  IntCoordinate N(-1 , 0);
  IntCoordinate S(1 , 0);
  IntCoordinate W(0 , -1);
  IntCoordinate E(0 , 1);
  IntCoordinate NE(-1 , 1);
  IntCoordinate SE(1 , 1);
  IntCoordinate SW(1 , -1);
  IntCoordinate NW(-1 , -1);

  bool stillFindingMultiples = true;
  vector<IntCoordinate> RoomSquaresChecked;
  list<IntCoordinate> RoomSquaresActive;
  list<IntCoordinate> ActiveFoundThisTurn;
  list<IntCoordinate>::iterator actIt;
  RoomSquaresActive.push_back(Start);

  int numberFound;
  IntCoordinate Curr;
  while(stillFindingMultiples)
    {//we expand our chacked area, but not into areas where we find just one open square - these are door candidates
      stillFindingMultiples = false;
      for(actIt = RoomSquaresActive.begin(); actIt != RoomSquaresActive.end(); /*increment inside loop*/  )
	{
	  Curr = *actIt;;
	  numberFound = 0;
	  //check the entire neighborhood of our square for open squares:
	  if( IsOpen( Curr + N )  && !IsChecked(Curr+N , RoomSquaresChecked) && !IsActive(Curr+N , RoomSquaresActive) && !IsActive(Curr+N , ActiveFoundThisTurn) )      
	    numberFound++;
	  if( IsOpen( Curr + S )  && !IsChecked(Curr+S , RoomSquaresChecked) && !IsActive(Curr+S , RoomSquaresActive) && !IsActive(Curr+S , ActiveFoundThisTurn) )     
	    numberFound++;
	  if( IsOpen( Curr + E )  && !IsChecked(Curr+E , RoomSquaresChecked) && !IsActive(Curr+E , RoomSquaresActive) && !IsActive(Curr+E , ActiveFoundThisTurn) )      
	    numberFound++;
	  if( IsOpen( Curr + W )  && !IsChecked(Curr+W , RoomSquaresChecked) && !IsActive(Curr+W , RoomSquaresActive) && !IsActive(Curr+W , ActiveFoundThisTurn) )     
	    numberFound++;
	  if( IsOpen( Curr + NE )  && !IsChecked(Curr+NE , RoomSquaresChecked) && !IsActive(Curr+NE , RoomSquaresActive) && !IsActive(Curr+NE , ActiveFoundThisTurn) )   
	    numberFound++;
	  if( IsOpen( Curr + NW )  && !IsChecked(Curr+NW , RoomSquaresChecked) && !IsActive(Curr+NW , RoomSquaresActive) && !IsActive(Curr+NW , ActiveFoundThisTurn) )    
	    numberFound++;
	  if( IsOpen( Curr + SE )  && !IsChecked(Curr+SE , RoomSquaresChecked) && !IsActive(Curr+SE , RoomSquaresActive) && !IsActive(Curr+SE , ActiveFoundThisTurn) )    
	    numberFound++;
	  if( IsOpen( Curr + SW )  && !IsChecked(Curr+SW , RoomSquaresChecked) && !IsActive(Curr+SW , RoomSquaresActive) && !IsActive(Curr+SW , ActiveFoundThisTurn) )    
	    numberFound++;

	  if(numberFound > 2)
	    {
	      stillFindingMultiples = true;
	      //process this square
	      if( IsOpen( Curr + N )  && !IsChecked(Curr+N , RoomSquaresChecked) && !IsActive(Curr+N , RoomSquaresActive) && !IsActive(Curr+N , ActiveFoundThisTurn) )    
		ActiveFoundThisTurn.push_back( Curr + N );
	      if( IsOpen( Curr + S )  && !IsChecked(Curr+S , RoomSquaresChecked) && !IsActive(Curr+S , RoomSquaresActive) && !IsActive(Curr+S , ActiveFoundThisTurn) )     
		ActiveFoundThisTurn.push_back( Curr + S );
	      if( IsOpen( Curr + E )  && !IsChecked(Curr+E , RoomSquaresChecked) && !IsActive(Curr+E , RoomSquaresActive) && !IsActive(Curr+E , ActiveFoundThisTurn) )   
		ActiveFoundThisTurn.push_back( Curr + E );
	      if( IsOpen( Curr + W )  && !IsChecked(Curr+W , RoomSquaresChecked) && !IsActive(Curr+W , RoomSquaresActive) && !IsActive(Curr+W , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + W );
	      if( IsOpen( Curr + NE )  && !IsChecked(Curr+NE , RoomSquaresChecked) && !IsActive(Curr+NE , RoomSquaresActive) && !IsActive(Curr+NE , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + NE );
	      if( IsOpen( Curr + NW )  && !IsChecked(Curr+NW , RoomSquaresChecked) && !IsActive(Curr+NW , RoomSquaresActive) && !IsActive(Curr+NW , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + NW );
	      if( IsOpen( Curr + SE )  && !IsChecked(Curr+SE , RoomSquaresChecked) && !IsActive(Curr+SE , RoomSquaresActive) && !IsActive(Curr+SE , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + SE );
	      if( IsOpen( Curr + SW )  && !IsChecked(Curr+SW , RoomSquaresChecked) && !IsActive(Curr+SW , RoomSquaresActive) && !IsActive(Curr+SW , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + SW );

	      if(!IsChecked(Curr , RoomSquaresChecked) )
		{
		  RoomSquaresChecked.push_back( Curr );   
		  SetChecked(Curr);
		}

	      RoomSquaresActive.erase(actIt++);   //erase Curr from the active list and increment iterator
	    }
	  else if(numberFound == 2)
	    {//special treatment to prevent a common occurrence of going through perfectly good door locations in two steps,
	      // each time seeing two open squares
	      int found = 0;
	      if( IsOpen( Curr + N )  && !IsChecked(Curr+N , RoomSquaresChecked) && !IsActive(Curr+N , RoomSquaresActive) && !IsActive(Curr+N , ActiveFoundThisTurn) )
		{    
		  ActiveFoundThisTurn.push_back( Curr + N );
		  found++;
		}
	      if( IsOpen( Curr + S )  && !IsChecked(Curr+S , RoomSquaresChecked) && !IsActive(Curr+S , RoomSquaresActive) && !IsActive(Curr+S , ActiveFoundThisTurn) )     
		{
		  ActiveFoundThisTurn.push_back( Curr + S );
		  found++;
		}
	      if( IsOpen( Curr + E )  && !IsChecked(Curr+E , RoomSquaresChecked) && !IsActive(Curr+E , RoomSquaresActive) && !IsActive(Curr+E , ActiveFoundThisTurn) )   
		{
		  ActiveFoundThisTurn.push_back( Curr + E );
		  found++;
		}
	      if( IsOpen( Curr + W )  && !IsChecked(Curr+W , RoomSquaresChecked) && !IsActive(Curr+W , RoomSquaresActive) && !IsActive(Curr+W , ActiveFoundThisTurn) )
		{
		  ActiveFoundThisTurn.push_back( Curr + W );
		  found++;
		}
	      if(found == 1)
		{//good chance we catch the door if we bail out now
		  actIt++;
		  continue;
		}
	      if( IsOpen( Curr + NE )  && !IsChecked(Curr+NE , RoomSquaresChecked) && !IsActive(Curr+NE , RoomSquaresActive) && !IsActive(Curr+NE , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + NE );
	      if( IsOpen( Curr + NW )  && !IsChecked(Curr+NW , RoomSquaresChecked) && !IsActive(Curr+NW , RoomSquaresActive) && !IsActive(Curr+NW , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + NW );
	      if( IsOpen( Curr + SE )  && !IsChecked(Curr+SE , RoomSquaresChecked) && !IsActive(Curr+SE , RoomSquaresActive) && !IsActive(Curr+SE , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + SE );
	      if( IsOpen( Curr + SW )  && !IsChecked(Curr+SW , RoomSquaresChecked) && !IsActive(Curr+SW , RoomSquaresActive) && !IsActive(Curr+SW , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + SW );

	      if(!IsChecked(Curr , RoomSquaresChecked) )
		{
		  RoomSquaresChecked.push_back( Curr );   
		  SetChecked(Curr);
		}

	      RoomSquaresActive.erase(actIt++);   //erase Curr from the active list and increment iterator
	    }
	  else if(numberFound == 1)
	    {//this one is a door candidate and so is held back and processed again when we don't find multiples any more
	      actIt++;
	    }
	  else
	    {
	      assert(numberFound == 0);    //overly cautious, right?
	      if(!IsChecked(Curr , RoomSquaresChecked) )
		{
		  RoomSquaresChecked.push_back( Curr );   
		  SetChecked(Curr);
		}

	      RoomSquaresActive.erase(actIt++);   //erase Curr from the active list and increment iterator
	    }

	  if(RoomSquaresChecked.size() > maxRS)
	    return(false);
	}//end for loop

      //merge newly found actives into list
      for(actIt = ActiveFoundThisTurn.begin(); actIt != ActiveFoundThisTurn.end(); actIt++)
	{
	  Curr = *actIt;
	  if( (GetMap(Curr) == G_OPEN) || (GetMap(Curr) == NJ_G_OPEN) )
	    return(false);   //to prevent us from building rooms that enclose exits... exits always have G_OPEN squares!!!
	  if(  !IsChecked(Curr , RoomSquaresChecked) && !IsActive(Curr , RoomSquaresActive) )
		RoomSquaresActive.push_back(Curr);
	}
      ActiveFoundThisTurn.clear();		
    }//end stillFinding Multiples

  //now our tactic changes, and we pursue each of our active suares until it either runs out (into a dead end) or find multiples again
  //if we end up with only ONE active square that finds multiples, we build a door and make a room
  bool proceeding = true;
  int squaresFindingMultiples;
  while(proceeding)  //through 1 square wide tunnels
    {
      squaresFindingMultiples = 0;
      proceeding = false;
      for(actIt = RoomSquaresActive.begin(); actIt != RoomSquaresActive.end(); /*increment inside loop*/  )
	{
	  Curr = *actIt;
	  numberFound = 0;
	  //check the entire neighborhood of our square for open squares:
	  if( IsOpen( Curr + N )   && !IsChecked(Curr+N , RoomSquaresChecked) && !IsActive(Curr+N , RoomSquaresActive) && !IsActive(Curr+N , ActiveFoundThisTurn) )
	    numberFound++;
	  if( IsOpen( Curr + S )   && !IsChecked(Curr+S , RoomSquaresChecked) && !IsActive(Curr+S , RoomSquaresActive) && !IsActive(Curr+S , ActiveFoundThisTurn) )
	    numberFound++;
	  if( IsOpen( Curr + E )   && !IsChecked(Curr+E , RoomSquaresChecked) && !IsActive(Curr+E , RoomSquaresActive) && !IsActive(Curr+E , ActiveFoundThisTurn) )
	    numberFound++;
	  if( IsOpen( Curr + W )   && !IsChecked(Curr+W , RoomSquaresChecked) && !IsActive(Curr+W , RoomSquaresActive) && !IsActive(Curr+W , ActiveFoundThisTurn) )
	    numberFound++;
	  if( IsOpen( Curr + NE )   && !IsChecked(Curr+NE , RoomSquaresChecked) && !IsActive(Curr+NE , RoomSquaresActive) && !IsActive(Curr+NE , ActiveFoundThisTurn) )
	    numberFound++;
	  if( IsOpen( Curr + NW )   && !IsChecked(Curr+NW , RoomSquaresChecked) && !IsActive(Curr+NW , RoomSquaresActive) && !IsActive(Curr+NW , ActiveFoundThisTurn) )
	    numberFound++;
	  if( IsOpen( Curr + SE )   && !IsChecked(Curr+SE , RoomSquaresChecked) && !IsActive(Curr+SE , RoomSquaresActive) && !IsActive(Curr+SE , ActiveFoundThisTurn) )
	    numberFound++;
	  if( IsOpen( Curr + SW )   && !IsChecked(Curr+SW , RoomSquaresChecked) && !IsActive(Curr+SW , RoomSquaresActive) && !IsActive(Curr+SW , ActiveFoundThisTurn) )
	    numberFound++;

	  if(numberFound > 1)
	    {
	      squaresFindingMultiples++;;
	      actIt++;   //we leave Curr for later processing, IF it's the only one
	    }
	  else if(numberFound == 1)
	    {//apparently we're in a corridor one square wide
	      proceeding = true;
	      if( IsOpen( Curr + N )   && !IsChecked(Curr+N , RoomSquaresChecked) && !IsActive(Curr+N , RoomSquaresActive) && !IsActive(Curr+N , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + N );
	      if( IsOpen( Curr + S )   && !IsChecked(Curr+S , RoomSquaresChecked) && !IsActive(Curr+S , RoomSquaresActive) && !IsActive(Curr+S , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + S );
	      if( IsOpen( Curr + E )   && !IsChecked(Curr+E , RoomSquaresChecked) && !IsActive(Curr+E , RoomSquaresActive) && !IsActive(Curr+E , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + E );
	      if( IsOpen( Curr + W )   && !IsChecked(Curr+W , RoomSquaresChecked) && !IsActive(Curr+W , RoomSquaresActive) && !IsActive(Curr+W , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + W );
	      if( IsOpen( Curr + NE )   && !IsChecked(Curr+NE , RoomSquaresChecked) && !IsActive(Curr+NE , RoomSquaresActive) && !IsActive(Curr+NE , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + NE );
	      if( IsOpen( Curr + NW )   && !IsChecked(Curr+NW , RoomSquaresChecked) && !IsActive(Curr+NW , RoomSquaresActive) && !IsActive(Curr+NW , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + NW );
	      if( IsOpen( Curr + SE )   && !IsChecked(Curr+SE , RoomSquaresChecked) && !IsActive(Curr+SE , RoomSquaresActive) && !IsActive(Curr+SE , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + SE );
	      if( IsOpen( Curr + SW )   && !IsChecked(Curr+SW , RoomSquaresChecked) && !IsActive(Curr+SW , RoomSquaresActive) && !IsActive(Curr+SW , ActiveFoundThisTurn) )
		ActiveFoundThisTurn.push_back( Curr + SW );

	      if(!IsChecked(Curr , RoomSquaresChecked) )
		{
		  RoomSquaresChecked.push_back( Curr );   
		  SetChecked(Curr);
		}

	      RoomSquaresActive.erase(actIt++);   //erase Curr from the active list and increment iterator
	    }
	  else
	    {
	      assert(numberFound == 0);    //overly cautious, for sure

	      if(!IsChecked(Curr , RoomSquaresChecked) )
		{
		  RoomSquaresChecked.push_back( Curr );   
		  SetChecked(Curr);
		}

	      RoomSquaresActive.erase(actIt++);   //erase Curr from the active list and increment iterator
	    }
	}
  //merge newly found actives into list
      for(actIt = ActiveFoundThisTurn.begin(); actIt != ActiveFoundThisTurn.end(); actIt++)
	{
	  Curr = *actIt;
	  if( (GetMap(Curr) == G_OPEN) || (GetMap(Curr) == NJ_G_OPEN) )
	    return(false);   //to prevent us from building rooms that enclose exits... exits always have G_OPEN squares!!!
	  if(  !IsChecked(Curr , RoomSquaresChecked) &&  !IsActive(Curr , RoomSquaresActive) )
	    RoomSquaresActive.push_back(Curr);
	}
      ActiveFoundThisTurn.clear();
    }//proceeding

  if( squaresFindingMultiples > 1 )
    return(false);   //this has several openings, and may thus be not a room, but a passage
  else if ( squaresFindingMultiples == 0)
    {//this can happen when two Crawlers that are seeded into tunnels close on each other, a closed room is created - fill it!
      assert( RoomSquaresChecked.size() > 0 );  //make sure of this if violated
      cout << "FILLING CLOSED ROOM" << endl; 
      if(showMovie || storeMovie)
	ChangedThisIteration.clear();  //make the vector ready to accept SquareInfo that changes while building the room

      for(unsigned int i = 0; i != RoomSquaresChecked.size(); i++)
	{
	  assert( ( GetMap( RoomSquaresChecked[i] ) == OPEN ) || ( GetMap( RoomSquaresChecked[i] ) == NJ_OPEN ) || ( GetMap( RoomSquaresChecked[i] ) == IT_OPEN ) || ( GetMap( RoomSquaresChecked[i] ) == IA_OPEN ) );
	  SetMap( RoomSquaresChecked[i] , CLOSED );
	}

      if(storeMovie)
	Movie.push_back(ChangedThisIteration);

    }
  else
    {//build a room
      assert( squaresFindingMultiples == 1 );
      //there's just one square left on the active list, and it's in a place where we want to build a door
      //normally, anyway ...
      if(RoomSquaresChecked.size() < (unsigned int) minRoomSz)
	return(false);  //we want no doors in front of too small rooms

      //check that we do not turn a corridor into a room, that looks bad
      bool diffX = false;
      bool diffY = false;
      int sX = RoomSquaresChecked[0].ShowX();
      int sY = RoomSquaresChecked[0].ShowY();
      for(unsigned int i = 0; i != RoomSquaresChecked.size(); i++)
	{
	  if( RoomSquaresChecked[i].ShowX() != sX )
	    diffX = true;
	  if( RoomSquaresChecked[i].ShowY() != sY )
	    diffY = true;
	}
      if( !diffX  || !diffY )//we have a corridor, all squares along one line
	return(false);

      if( (V_DOOR == GetMap(Curr + W) ) || (V_DOOR == GetMap(Curr + E) ) || (H_DOOR == GetMap(Curr + W) ) || (H_DOOR == GetMap(Curr + E) )         || (V_DOOR == GetMap(Curr + N) ) || (V_DOOR == GetMap(Curr + S) ) || (H_DOOR == GetMap(Curr + N) ) || (H_DOOR == GetMap(Curr + S) ) )
	    return(false);

      if(RoomSquaresChecked.size() < (unsigned int) medRoomSz)
	if(!WantsMoreRoomsL(SMALL) )
	  return(false);
	else
	  currSmallRoomsL++;
      else  if(RoomSquaresChecked.size() < (unsigned int) larRoomSz)
	if(!WantsMoreRoomsL(MEDIUM) )
	  return(false);
	else
	  currMediumRoomsL++;
      else  if(RoomSquaresChecked.size() < (unsigned int) maxRoomSz)
	if(!WantsMoreRoomsL(LARGE) )
	  return(false);
	else
	  currLargeRoomsL++;
      else
	return(false);  //room too big, we don't want it

      if(showMovie || storeMovie)
	ChangedThisIteration.clear();  //make the vector ready to accept SquareInfo that changes while building the room

      assert(RoomSquaresActive.size() == 1);
      Curr = *RoomSquaresActive.begin();
      if( IsOpen( Curr + N ) )
	{
	  assert( IsOpen( Curr + S ) );
	  SetMap( Curr , H_DOOR );
	}
      else if( IsOpen( Curr + W ) )
	{
	  assert( IsOpen( Curr + E ) );
	  SetMap( Curr , V_DOOR );
	}

      Room newRoom;

      for(unsigned int i = 0; i != RoomSquaresChecked.size(); i++)
	{
	  assert( ( GetMap( RoomSquaresChecked[i] ) == OPEN ) || ( GetMap( RoomSquaresChecked[i] ) == NJ_OPEN ) || ( GetMap( RoomSquaresChecked[i] ) == IT_OPEN ) || ( GetMap( RoomSquaresChecked[i] ) == IA_OPEN ) );
	  SetMap( RoomSquaresChecked[i] , IR_OPEN );
	  newRoom.AddSquare( RoomSquaresChecked[i] );
	}

      newRoom.SetInDungeon(false);  //this room is not in the dungeon, but in the labyrinth
      Rooms.push_back(newRoom);

      assert( ( !ShowMovie() && !StoreMovie() ) || (ChangedThisIteration.size() != 0) );   //we made changes to the map

      if(storeMovie)
	Movie.push_back(ChangedThisIteration);
    }

  return(true);
}  

void alifegames::DungeonMaker::generate() {
	//create the dungeon
	while(true) {
		if( GetActiveGeneration() == GetTunnelCrawlerGeneration() )
			SeedCrawlersInTunnels();

		while(MakeIteration())
			{ /*stops when no more change on map*/ }
		if( ! AdvanceGeneration() )  //! there are Builders left
			break;
	}
	//normal dungeon is now done

	//now treat extra features, first Crawlers seeded in Tunnels after the normal run is finished
	//run through the dungeon creation process again with newly seeded Crawlers in Tunnels:
	if( (GetTunnelCrawlerGeneration() < 0) || ( GetActiveGeneration() < GetTunnelCrawlerGeneration() ) ) {
		SeedCrawlersInTunnels();
		while(true) {
			while(MakeIteration())
				{ /* stops when no change on map */ }
			if( ! AdvanceGeneration() )  //! there are Builders left
				break;
		}
	}//end seeding Crawlers in Tunnels after normal run is finished

	//now create rooms in labyrinth part
	//first do this for the entire map if bg=OPEN
	int counter , number;
	if(OPEN == GetBackground() ) {
		alifegames::RectFill rect(0 , 0 , GetDimX() , GetDimY() , GetBackground() );
		counter = 0;
		number = GetDimX() * GetDimY();   //size of the square
		while(WantsMoreRoomsL() ) {
			if( CreateRoom(rect) )
				{/*we have been successful*/}
			else 
				counter++;
			if(counter > number)
				break;
		}
	}

	//now create rooms inside OPEN squares that were placed in the design:
	vector<alifegames::RectFill> des;
	vector<alifegames::RectFill>::iterator desIt;
	des = GetDesign();
	for(desIt = des.begin(); desIt !=  des.end(); desIt++) {
		alifegames::RectFill rect = *desIt;
		if(rect.type != OPEN)
			continue;   //we onlt make rooms in the labyrinth part

		counter = 0;
		number = (rect.endX - rect.startX) * (rect.endY - rect.startY);   //size of the square
		while(WantsMoreRoomsL() ) {
			if( CreateRoom(rect) )
				{ /*we have been successful*/ }
			else 
				counter++;
			if(counter > number)
				break;
		}
	}

	///////////////////////////////////////////////////////////////////////////
	//PlonkDownStuff is included for demo purposes to show how to access rooms and tunnels
	//you should write your own version of this fucntion
	//PlonkDownStuff();
	/////////////////////////////////HERE ATTENTION !!
	//PutPlonkOnMap();
	//////////////////////////////////////////////////
	///* ATTENTION: In this version, the method DungeonMaker:: PutPlonkOnMap() puts MOBs and treasure on the map literally, by changing the SquareData of the Map square where the stuff goes. This is just for demonstration purposes to make it easier to show stuff without having an engine for rendering objects. If you use the DungeonMaker in your own program, you must refrain from calling this function, and instead write your own function that puts stuff on the map as objects and leaves the MapData as it is.
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
}

///////////////end DungeonMaker methods


