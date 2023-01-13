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
|                     |  [program name](#program-name) 0             |
|                     |  [program name](#program-name) 1             |
|                     |  [program name](#program-name) 2             |
|                     |  ... (programs 3-249)                        |
|                     |  [program name](#program-name) 249           |
|                     |  [program dump (active program)](#program-dump) |
|                     |  [recall program (says _which_ program is active)](#recall-program)|
|                     |  [White Black Balance](#white-black-balance) |
|                     |  [Velocity Curve 0 (Normal)](#velocity-curve)|
|                     |  [Velocity Curve 1 (Soft)](#velocity-curve)  |
|                     |  [Velocity Curve 2 (Hard)](#velocity-curve)  |
|                     |  ... (curves 3-7)                            |
|                     |  [Velocity Curve 8 (User 6)](#velocity-curve)|
|                     |  [Velocity Scale](#key-scale-velocity)       |
|                     |  [Global Transpose](#global-transpose)       |
|                     |  [Global Pedal Mode](#global-pedal-mode)     |
|                     |  [Global Common Channel](#global-common-channel)                       |
|                     |  [End Of Config Dump](#end-of-config-dump)   |


## Program Dump
The SL Editor's program organizer allows you to "Sync In" or "Sync Out" all of the program and group configuration data.
Both the sync in and sync out sequences are identical, with the only difference being whether it is the app or the sl88 which provides the details of the programs and groups. The Sync In sequence is:
| App / Host                                  |      SL 88                                   |
|---------------------------------------------|----------------------------------------------|
| [Begin Full Dump](#begin-full-dump) |                                              |
|                                             |  [program 0](#program-dump)                  |
|                                             |  [program 1](#program-dump)                  |
|                                             |  [program 2](#program-dump)                  |
|                                             |  ... (programs 3-249)                        |
|                                             |  [program 249](#program-dump)                |
|                                             |  [group 0](#group-data)                      |
|                                             |  [group 1](#group-data)                      |
|                                             |  [group 2](#group-data)                      |
|                                             |  ... groups (3-6)                            |
|                                             |  [group 7](#group-data)                      |
|                                             |  [group order](#group-order)                 |
|                                             |  [End Of Full Dump](#end-of-full-dump)   |

The Sync Out sequence is:
| App / Host                 |      SL 88                           |
|----------------------------|--------------------------------------|
| [program 0](#program-data) |    -                                 |
| [program 1](#program-data) |    -                                 |
| [program 2](#program-data) |    -                                 |
| ... (programes 3-249)      |    -                                 |
| [program 249](#program-data) |    -                                |
| [group order](#group-order)|    -                                 |
| [group 0](#group-data)     |    -                                 |
| [group 1](#group-data)     |    -                                 |
| [group 2](#group-data)     |    -                                 |
| ... groups (3-6)           |    -                                 |
| [group 7](#group-data)     |    -                                 |
| [End Of Full Dump](#end-of-full-dump)|    -                                 |
|                            |  [program name](#program-name) 0     |
|                            |  [program name](#program-name) 1     |
|                            |  [program name](#program-name) 2     |
|                            |  ... (programes 3-249)               |
|                            |  [program name](#program-name) 249   |

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

# Known Messages
## Request Config Dump
Send by the host, this message requests a [configuration dump](#configuration-dump) from the SL88.

| Sysex (hex) &darr;                |
|-----------------------------------|
| 0010                              |

## End of Config Dump
Send by the SL88 or host once all messages in a [configuration dump](#configuration-dump) have been sent.

| Sysex (hex) &darr;                |
|-----------------------------------|
| 10                                |

## Program Name
The program name message is only ever sent from the SL88 to the host in respont to a config dump request.
Each message describes the name of a single program.
| Sysex (hex) &darr;                | Type               | Notes                                                              |
|-----------------------------------|--------------------|--------------------------------------------------------------------|
| 0A                                | literal            |                                                                    |
| PPPP                              | word               | program number 0-249                                               |
| AAAAAAAAAAAAAAA                   | ascii - 15 bytes   | name of program                                                    |


## Program Data
This message contains all data related to a singe program.

| Sysex (hex) &darr;                | Type               | Notes                                                              |
|-----------------------------------|--------------------|--------------------------------------------------------------------|
| 01                                | literal            |                                                                    |
| PPPP                              | word               | program number 0-249                                               |
| 0002                              | literal            |                                                                    |
| ...                               | array(256)         | [program payload](#program-payload-layout)                         |
| XX                                | byte               | Checksum?  How this is calculated has not been determined          |

### Program Payload Layout
Each program payload consists of a name and 4 zones, all encoded as an array of 256 word values.
Many array elements in the payload _appear_ to be unused, and are not described here. All unused elements should have a value of 0 (zero).

The program name is the only non zone-specific value, appearing at offset 1:

| Element               | Offset    | Length  |   Notes                                                                              | 
|-----------------------|-----------|---------|--------------------------------------------------------------------------------------|
| Program Name          | 1         | 0xe     |                                                                                      |

After this, the zoned values are inter-woven such that for any one setting, the values for all 4 zones are contiguous in the payload.
The table below details each per-zone setting, the offset of that setting within the overall program payload (i.e. the array index), and the number of elements (length) used for the setting.
The headings Z1-4 denote the offset for each respective zone.

| Element               | Z1  |  Z2 |  Z3 |  Z4 | Length|   Notes                                                        | 
|-----------------------|-----|-----|-----|-----|-------|----------------------------------------------------------------|
| instrument            |  24 |  36 |  48 |  60 | 12    | character codes of null terminated string: zone instrument name|
| sound                 |  72 |  83 |  94 | 105 | 11    | character codes of null terminated string: zone sound name     |
| enabled               | 116 | 117 | 118 | 119 | 1     | 0=Disabled, 1=Off, 2=On                                        |
| midi channel          | 124 | 125 | 126 | 127 | 1     | 0-15 zone midi transmit channel                                |
| midi port             | 120 | 121 | 122 | 123 | 1     | 0=USB, 1=Midi1, 2=Midi2, 3=Bluetooth                           |
| volume                | 128 | 129 | 130 | 131 | 1     | 0-127=midi volume value (CC 7)<br>255=Off                      |
| program change        | 132 | 133 | 134 | 135 | 1     | 0-127=program change<br>255=Off                                |
| Bank MSB              | 136 | 137 | 138 | 139 | 1     | 0-127=Bank MSB (CC 00)<br>255=Off                              |
| Bank LSB              | 140 | 141 | 142 | 143 | 1     | 0-127=Bank LSB (CC 32)<br>255=Off                              |
| lowKey                | 144 | 145 | 146 | 147 | 1     | 0-127=lowest key to transmit for zone                          |
| highKey               | 148 | 149 | 150 | 151 | 1     | 0-127=highest key to transmit for zone                         |
| curve type            | 152 | 153 | 154 | 155 | 1     | See [curve type](#curve-type)                                  |
| lowVel                | 156 | 157 | 158 | 159 | 1     | 0-127=lowest velocity to transmit for zone                     |
| highVel               | 160 | 161 | 162 | 163 | 1     | 0-127=highest velocity to transmit for zone                    |
| octave                | 164 | 165 | 166 | 167 | 1     | 0-7=Zone octave offset +3<br>Calculated as: octave=n-3         |
| transpose             | 168 | 169 | 170 | 171 | 1     | 0-24=Zone transpose<br>Calculated as: transpose=n-12           |
| aftertouch            | 172 | 173 | 174 | 175 | 1     | 1=on, 0=off                                                    |
| fixed velocity        | 176 | 177 | 178 | 179 | 1     | Fixed velocity value of zone if curve type & 0x80 > 1          |
| stick 1 X             | 180 | 181 | 182 | 183 | 1     | 0=Off, 1=Pitch Bend, 2=Aftertouch, <br> else midi CC=N-2       |
| stick 1 Y             | 184 | 185 | 186 | 187 | 1     | 0=Off, 1=Pitch Bend, 2=Aftertouch, <br> else midi CC=N-2       |
| stick 2 X             | 188 | 189 | 190 | 191 | 1     | 0=Off, 1=Pitch Bend, 2=Aftertouch, <br> else midi CC=N-2       |
| stick 2 Y             | 192 | 193 | 194 | 195 | 1     | 0=Off, 1=Pitch Bend, 2=Aftertouch, <br> else midi CC=N-2       |
| stick 3 X             | 196 | 197 | 198 | 199 | 1     | 0=Off, 1=Pitch Bend, 2=Aftertouch, <br> else midi CC=N-2       |
| stick 3 Y             | 200 | 201 | 202 | 203 | 1     | 0=Off, 1=Pitch Bend, 2=Aftertouch, <br> else midi CC=N-2       |
| pedal 1               | 208 | 209 | 210 | 211 | 1     | 0=Off, 1=Aftertouch, else midi CC=N-1                          |
| pedal 2               | 212 | 213 | 214 | 215 | 1     | 0=Off, 1=Aftertouch, else midi CC=N-1                          |
| pedal 3               | 216 | 217 | 218 | 219 | 1     | 0=Off, 1=Aftertouch, else midi CC=N-1                          |
| pedal 4               | 220 | 221 | 222 | 223 | 1     | 0=Off, 1=Aftertouch, else midi CC=N-1                          |

### Curve Type
Each zone can use a different velocity curve, and which velocity curve type is active is defined by a 1-byte bit-array of flags:
| Bits  | Meaning                                                             |
|-------|---------------------------------------------------------------------|
| 0-1   | 2-bit value N - Selected factory curve: 0=Linear, 1=Hill, 2=Ramp    |
| 2-4   | 3-bit value N - selected user curve 1-6 as curve=N-1                |
|   5   | 0=Use selected factory curve, 1=Use selected user cruve             |
|   6   | 1=Ignore curve and use fixed velocity value, 0=use curve            |


## Send Program to SL88
The message for sending program data to the SL88 is _almost_ identical to receiving it:
| Sysex (hex) &darr;                | Type               | Notes                                                              |
|-----------------------------------|--------------------|--------------------------------------------------------------------|
| 01                                | literal            |                                                                    |
| PPPP                              | word               | program number 0-249                                               |
| ...                               | array(256)         | [program payload](#program-payload-layout)                         |
| XX                                | byte               | Checksum?  How this is calculated has not been determined          |

Note that both the checksum and the literal 0002 are absent when transmitting a program.
This message _writes_ a program in persisted storage.

## Recall Program
Stored programs can be activated (loaded into RAM) using the recall program message:
| Sysex (hex) &darr;                | Type               | Notes                                                              |
|-----------------------------------|--------------------|--------------------------------------------------------------------|
| 06                                | literal            |                                                                    |
| PPPP                              | word               | program number 0-249                                               |

## Alter Active Program
Individual parts of the active program can be altered on the fly using this message, with change reflected on the SL88 immediately.
The message effectively writes to an offset in RAM, and thus a clear understanding of the [program layout](#program-payload-layout) is important because the offsets listed in the [program layout](#program-payload-layout) are the same offsets used in this message to alter part of the active program.
| Sysex (hex) &darr;                | Type               | Notes                                                              |
|-----------------------------------|--------------------|--------------------------------------------------------------------|
| 02                                | literal            |                                                                    |
| TT                                | word               | offset into RAM at which to write array                            |
| SS                                | byte               | length of array (number of elements) to write                      |
| YYYY,YYYY...YYYY                  | array              | array of word values to write to RAM                               |

#### Examples:
1. Alter the program name to "PROGRAM 1":
```hex
02 01 0e 5000 5200 4F00 4700 5200 4100 4D00 2000 3100 0000
         P    R    O    G    R    A    M         1    null
```
2. Enabling Zone 2:  
Sets a single value at offset 0x75 (117) to '2' (enabled)
```hex
02 75 01 0200
```

## Store Program
The currently active program can be stored to a program slot using this message:
| Sysex (hex) &darr;                | Type               | Notes                                                              |
|-----------------------------------|--------------------|--------------------------------------------------------------------|
| 09                                | literal            |                                                                    |
| PPPP                              | word               | program number 0-249                                               |


## Group Data
The SL88 allows programs to be organized into groups, so that during performances those programs can be easily selected.
Each Group is effectively just a group name and a series of program indices. 

| Sysex (hex) &darr;                | Type               | Notes                                                              |
|-----------------------------------|--------------------|--------------------------------------------------------------------|
| 03                                | literal            |                                                                    |   
| GG                                | byte               | Group number 0-7                                                   |
| 5500                              | literal            |                                                                    |
| NN00 NN00 ... NN00 0000           | unicode(15)        | Group Name as null terminated unicode string                       |     
| IIII,XXXX ... IIII,XXXX           | array(60)          | 30 Pairs of values:<br>IIII: Index of program<br>XXXX: 0=Active, 255=Not used | 
| TTTT                              | word               | 2=active, 0=not configured                                         |  
| 0000                              | literal            |                                                                    | 
| QQ                                | byte               | Checksum? Received only, never sent to SL88                        |

To clarity the indices:
- There are 30 program slots per group.
- Each program slot is configured by two words (shown above as IIII and XXXX):
   - Even words (IIII) are program indexes. 
   - Odd words (XXXX) indicate whether the slot is in use.
- When a slot is used (program IIII should appear in that slot),  (XXXX) should be 0 (zero).
- When a slot is unused (no program should appear), the is active flag (XXXX) should be 0 (zero).

## Group Order
This message describes / configures the order of the 8 program groups within in the list of all groups:
| Sysex (hex) &darr;                | Type               | Notes                                                              |
|-----------------------------------|--------------------|--------------------------------------------------------------------|
| 0455000000                        | literal            |                                                                    |
| GGGG GGGG GGGG ... GGGG           | array(8)           | List of group indices                                              |
| 17                                | literal            | Checksum? Receive only, never transmitted                          |


## Velocity Curve
| Sysex (hex) &darr;                                  | Type                | Notes                                             |
|-----------------------------------------------------|---------------------|---------------------------------------------------|
| 0700                                                | literal             |                                                   |
| VV                                                  | Byte                | Velocity Curve Number (0-8)                       |
| TT                                                  | Word                | Type (Factory=0000, User=5500)                    | 
| NN00 NN00 NN00 NN00 NN00 NN00 NN00 NN00 NN00 0000   | Unicode(10)         | Curve Name                                        |
| 0000 or 0300                                        | literal             | Oddity: 0300 for curve 8, 0000 for all others     |
| XXXX YYYY XXXX YYYY... XXXX YYYY                    | array(32)           | 16 X,Y  curve control points.  255,255 is "off"   |
| 0000                                                | literal             | (forces velocity 0 to be key off. See below)      | 
| VVVV VVVV VVVV ... VVVV                             | array(127)          | velocity translation table                        |
| NN (received only)                                  | literal             | Checksum? Receive only, never transmitted         |
  
The control-point array seems to be solely for the SL editor's benefit and is not observed by the SL88. 
The velocity translation table is used to translate physical velocities into reported velocities. 
The velocity (1-127) is used as an indexer to lookup the value to report from the velocity translation table array.
Velocity value 0 is _always_ 0/off, hence the arry size of 127 instead of 128.


## White Black Balance
Configures the balancing of reported velocity between back keys and white keys.
Not much is understood about the eact values being used here:
| Sysex (hex) &darr;  | Type    | Notes                                             |
|---------------------|---------|---------------------------------------------------|
| 0800                | literal |                                                   |
| WWWW                | word    | White key balance. 867 (+30%) to 5326 (-30%)      |
| LLLL                | word    | black key balance. 867 (+30%) to 5326 (-30%)      |                   


## Key Scale Velocity
| Sysex (hex) &darr;  | Type    | Notes                                                                        |
|---------------------|---------|------------------------------------------------------------------------------|
| 0801                | literal |                                                                              |
| KK                  | byte    | first key to map (0-87)                                                      |
| NN                  | byte    | 1 - 88 - size of array / number of keys                                      |
| LLLL LLLL... LLLL   | array   | values scale key velocity for each keys from left to right. <br>Values in range 2867 (+30%) to 5326 (-30%)         |


## Global Transpose 
| Sysex (hex) &darr;  | Type    | Notes                                                                        |
|---------------------|---------|------------------------------------------------------------------------------|
| 0501                | literal | |
| TT                  | byte    | 0-24 - Transpose amount calculates as N-12                                   |

## Global Pedal Mode
| Sysex (hex) &darr;  | Type    | Notes                                                                        |
|---------------------|---------|------------------------------------------------------------------------------|
| 0502                | literal |                                                                              |
| TT                  | byte    |                                                                              |

## Global Common Channel
| Sysex (hex) &darr;  | Type    | Notes                                                                        |
|---------------------|---------|------------------------------------------------------------------------------|
| 0503                | literal |                                                                              |
| TT                  | byte    | 0-15 -  Common Midi Channel Number |


## Initiate Connection
Not sure about this message, but the SL editor sends this message to the SL88 upon connection.
| Sysex (hex) &darr;  |
|---------------------|
| 000500              |

## Initiate Connection Reply 
Not sure about this message, but the SL88 replies to the editor with this message in repsonse to [initiate connection](#initiate-connection)
| Sysex (hex) &darr;  |
|---------------------|
| 05001100 |

## Editor Attached
This message is sent every 2 seconds by the App, and this causes the SL88 to show "use editor" when the control knob is turned.
| Sysex (hex) &darr;  |
|---------------------|
| 007f                |

## Confirm Editor Attached 
This message is sent by the SL88 in response to the [editor attached](#editor-attached) message.
| Sysex (hex) &darr;  |
|---------------------|
| 7f                  |

## Begin Full Dump  
This message triggers a [full dump](#program-dump) of all program, group and veocity data from the SL88.
| Sysex (hex) &darr;  |
|---------------------|
| 0011                |

## End Of Full Dump 
This message indicates the conclusion of a [full dump](#program-dump)
| Sysex (hex) &darr;  |
|---------------------|
| 11 |

## End Of Dump
Note sure about this one, but has been seen in the wild.
| Sysex (hex) &darr;  |
|---------------------|
| 000a                |

## Begin Session
Note sure about this one, but has been seen in the wild.
| Sysex (hex) &darr;  |
|---------------------|
| 05                  |