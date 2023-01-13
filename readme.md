# Studio Logic SL88 Grand Sysex Utility
This project is the result of reverse engineering the Studio Logic SL88's sysex messages by observing the communication between the SL Editor and the device.
The utility is actually a Bitwig studio controller script, and probably won't be helpful to anyone who is not familiar with Bitwig and Typescript.

In the hope of providing value to anyone else on this planet who wants to integrate the SL88 with their vafourite DAW or midi device, below is what I've understood the sysex messages to be.

# SYSEX SEQUENCES
There are a variety of communication sequences which can occur between the SL88 and it's Midi host, and those which have been observed are detailed as follows:

## Configuration Dump
The configuration dump occurs when the SL Editor software connects to the SL88 and needs to know the current state of the SL88. This interaction occurs immediately when the SL Editor connects to the SL 88.
Included in the dump are:
* The Names of each of the 250 programes.
* Full details of the active program.
* Full details of all 9 velocity Curves (3 factory, 6 User).
* The low-to-high key velocity scaling.
* The white-black key velocity balance.
* The current global settings for transpose, common midi channel and pedal mode.

The sequnce is:
| App / Host          |      SL 88                                   |
|---------------------|----------------------------------------------|
| Request Config Dump |                                              |
|                     |  program Name 0                                |
|                     |  program Name 1                                |
|                     |  program Name 2                                |
|                     |  ... (programes 3-249)                         |
|                     |  program Name 249                              |
|                     |  program Dump (active program)                   |
|                     |  Recall program (tells _which_ program is active)|
|                     |  White Black Balance                         |
|                     |  Velocity Curve 0 (Normal)                   |
|                     |  Velocity Curve 1 (Soft)                     |
|                     |  Velocity Curve 2 (Hard)                     |
|                     |  ... (Curves 3-7)                            |
|                     |  Velocity Curve 8 (User 6)                   |
|                     |  Velocity Scale                              |
|                     |  Global Transpose                            |
|                     |  Global Pedal Mode                           |
|                     |  Global Common Channel                       |
|                     |  End Of Config Dump                          |


## Program Dump
The SL Editor's program organizer allows you to "Sync In" or "Sync Out" all of the program and group configuration data.
Both the sync in and sync out sequences are identical, with the only difference being whether it is the app or the sl88 which provides the details of the programs and groups. The Sync In sequence is:
| App / Host           |      SL 88               |
|----------------------|--------------------------|
| Request Program Dump |                          |
|                      |  program 0               |
|                      |  program 1               |
|                      |  program 2               |
|                      |  ... (programs 3-249)    |
|                      |  program 249             |
|                      |  group 0                 |
|                      |  group 1                 |
|                      |  group 2                 |
|                      |  ... groups (3-6)        |
|                      |  group 7                 |
|                      |  group order             |
|                      |  End Of Program Dump     |

The Sync Out sequence is:
| App / Host                 |      SL 88          |
|----------------------------|---------------------|
| program 0                  |    -                |
| program 1                  |    -                |
| program 2                  |    -                |
| ... (programes 3-249)      |    -                |
| program 249                |    -                |
| group order                |    -                |
| group 0                    |    -                |
| group 1                    |    -                |
| group 2                    |    -                |
| ... groups (3-6)           |    -                |
| group 7                    |    -                |
| End Of Program Dump        |    -                |

When the App transmits an end of program dump message, the SL88 responds by re-transmitting all program names.

# SYSEX MESSAGE REFERENCE
## Preamble

All sysex sequences listed in this document are provided in hexadecimal format. 
Any spaces appearing between hex characters are for legibility and formatting purposes only and can be safely ignored.

All SL88 sysex messages take the form:
```hex
F0 00201a00 [MESSAGE] F7
```
...where 00201a00 is the manufacturer and device preamble. The remainder of this document describes hex sequences which appear in place of _MESSAGE_ shown above.


## Encodings

Several common variable value encodings exist, and are denoted in the sysex messages as follows:
| Type    | Transmitted as                                                                                       |
|---------|------------------------------------------------------------------------------------------------------|
| Byte    | 1 byte:  (as-is) in the range 0 to 127  (x0-x7F)                                                     |
| Word    | 2 bytes: 7-bit LSB MSB form:  0 = 0000, 1 = 0100, 127 = 7F00,  128 = 0001, 255 = 7F01                |
| Array   | A sequence of words, such that 1,2,127,255 = 0100 0200 7f00 7f01                                     |
| ASCII   | A sequence of Byte representing a null-terminated ASCII string, null padded to their full length     |

Notes: 
- It is common for the value 255 to mean "Off" for values that would ordinarily fit into the 0-127 range, for example the SL88 zone's Volume, Program Change, LSB and MSB setting.

The following table shows the messages and their corresponding hex sequences. The hex sequences are decomposed vertically for legibility, and represent a contiguous sequence of bytes, with hexadecimal values being literal. 

| Message            |  HEX SEQUENCE                     | Variables                                                                                  |
|--------------------|-----------------------------------|-----------------------------------------------------------------------------------------------------|
| White Black Balance |  0800<br>WWWW<br>LLLL                    |(literal)<br>Word, white key balance<br>Word, black key balance.                                 |
| Key Scale Velocity  |  0801<br>KK<br>NN<br>LLLL LLLL... LLLL   |(literal)<br>Byte, first key to map (0-87)<br>Byte, number of keys (size of array)<br>Array, elements scale velocity for each keys.  |
| Velocity Curve      |  0700<br>VV<br>TT<br>NN00 NN00 NN00 NN00 NN00 NN00 NN00 NN00 NN00 0000<br>0000 or 0300<br>XXXXYYYY...XXXXYYYY<br>0000<br>VVVV...VVVV<br>NN (received only)|(literal)<br>Byte. Velocity Curve Number (0-8)<br>Type (Factory=0000, User=5500)<br>Curve Name, Unicode(10)<br>Oddity: Literal 0300 for curve 8, 0000 for all others.<br>Array of 16 (X,Y) control points, with 255,255 (7f017f01) representing "no control point"<br>(literal)<br>Array of 127 velocity values mapping input pressure to output velovity<br>Checksum received from SL88, but never transmitted to it.|
| Global Transpose | 0501<br>TT | (literal)<br>Byte - transpose amount (-12 to +12 as 0..24),  12 = no transpose |
| Global Pedal Mode | 0502<br>TT | (literal)<br>Byte |
| Global Common Channel | 0503<br>TT | (literal)<br>Byte: Common Midi Channel Number |
| Group | 03<br>GG<br>5500<br>NN00 NN00 ... NN00 0000<br>IIII ... IIII<br><br><br>0200 or 0000<br>0000<br>QQ (optional checksum, receive only)|(literal)<br>Byte: Group Number (0-7)<br>(literal)<br>Group Name, Unicode(15)<br>Array (30) of word pairs:<br> word 1) Index of program at this position in group<br> word 2) 0000 if slot is active, else 7f01 to hide.<br>0200 is group active, else 0000<br>(literal)<br>Byte checksum, never transmitted.|
| Group Ordering | 0455000000<br>IIII ... IIII<br>17 (receive only)| (literal)<br>Index of group<br>Checksum? Receive only, never transmitted|
| Begin Session? | 05 ||
| Initiate Connection |000500 ||
| Initiate Connection Reply | 05001100 ||
| Is Editor Attached? | 007f ||
| Confirm Editor Attached |7f ||
| Begin Full Dump  |0011 ||
| End Of Full Dump |11 ||
| Request Config Dump| 0010 ||
| End Of Config Dump| 10 ||
| End Of Dump| 000a ||
| Recall program #     |  06<br>PPPP (Word)                             |(literal)<br>program Number 0-249                                                                      |
| Store To program #   |  09 <br>PPPP (Word)                             |(literal)<br>program Number 0-249                                                                     |
| program Name         |  0A<br>PPPP (Word)<br>NNNNNNNNNNNNNNNNNNNNNNNNNNNNNN                             |(literal)<br>program Number 0-249       <br>A15 (15 byte ASCII) Name of program                                |
| program Data from SL88         |  01<br>AA<br>0002<br>program_DATA<br>MM (Checksum?)       | (literal)<br>program Number (0-249)<br>(literal)<br>program Data (see notes below)<br>Byte: Checksum value?                               |
| program Data to SL88         |  01<br>AA<br>program_DATA                                   | (literal)<br>program Number (0-249)<br>program Data (see notes below)                               |
| Alter Live program  | 02<br>NNNN<br>SS<br>PPPP .... PPPP    | (literal)<br>program Nmber (0-249)<br>Byte Offset of Values to Alter<br>Array of Word: Values to alter.  |


# program Data
To Be completed.
Until this document has been completed, please refer to sl88syx.ts for details on structures and enumerations used. 


```ts

    
    program {
            unicode("instrument", 0x18, 0xc);
            unicode("sound", 0x48, 0xb);
            choiceOf("enabled", 0x74, ZoneModeMap);
            word("midiChannel", 0x7c);
            choiceOf("midiPort", 0x78, ZoneMidiPortMap);
            wordOrOff("volume", 0x80);
            wordOrOff("programChange", 0x84);
            wordOrOff("MSB", 0x88);
            wordOrOff("LSB", 0x8c);
            word("lowKey", 0x90);
            word("highKey", 0x94);
            word("lowVel", 0x9c);
            word("highVel", 0xa0);
            word("octave", 0xa4, 3, -3, 3);
            word("transpose", 0xa8, 12, -12, 12);
            word("afterTouch", 0xac);
            choiceOf("stick1X", 0xb4, StickAssign);
            choiceOf("stick1Y", 0xb8, StickAssign);
            choiceOf("stick2X", 0xbc, StickAssign);
            choiceOf("stick2Y", 0xc0, StickAssign);
            choiceOf("stick3X", 0xc4, StickAssign);
            choiceOf("stick3Y", 0xc8, StickAssign);
            choiceOf("pedal1", 0xd0, PedalAssign);
            choiceOf("pedal2", 0xd4, PedalAssign);
            choiceOf("pedal3", 0xd8, PedalAssign);
            choiceOf("pedal4", 0xdc, PedalAssign);
            // choiceOf("curveType", 0x98, ZoneCurveType2);
            word("fixedVelocity", 0xb0);

            define("curveType", 0x98, 1,
                vals => {
                    var v = vals[0];
                    if (v & 0x80) v &= 0x80;
                    else if (v & 0x40) v &= 0x5c;
                    else v &= 3;
                    return choiceKey(ZoneCurveType2, v);
                },
                x => [ZoneCurveType2[x]]);
        }
        getter: DataGetter;
        name!: string;
        zones: Zone[];

    }

    export class Zone {
        sound!: string;
        instrument!: string;
        enabled!: keyof typeof ZoneModeMap;
        midiPort!: keyof typeof ZoneMidiPortMap;
        volume!: number;
        midiChannel!: number;
        programChange!: number;
        MSB!: number;
        LSB!: number;
        lowKey!: number;
        highKey!: number;
        lowVel!: number;
        highVel!: number;
        octave!: number;
        transpose!: number;
        afterTouch!: number;
        stick1X!: keyof typeof StickAssign;
        stick1Y!: keyof typeof StickAssign;
        stick2X!: keyof typeof StickAssign;
        stick2Y!: keyof typeof StickAssign;
        stick3X!: keyof typeof StickAssign;
        stick3Y!: keyof typeof StickAssign;
        pedal1!: keyof typeof PedalAssign;
        pedal2!: keyof typeof PedalAssign;
        pedal3!: keyof typeof PedalAssign;
        pedal4!: keyof typeof PedalAssign;
        curveType!: keyof typeof ZoneCurveType2;
        fixedVelocity!: number;
    };


```