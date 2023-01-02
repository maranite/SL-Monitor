// function printMidi(status, data1, data2)
// {
//    println("MIDI: " + status + ", " + data1 + ", " + data2
//       + " [" + uint8ToHex(status) + uint7ToHex(data1) + uint7ToHex(data2) + "]");
// }

/* Utility functions for reading MIDI message data. */

// Message types



function isNoteOff(status : number, data2: number) : boolean { return ((status & 0xF0) == 0x80) || ((status & 0xF0) == 0x90 && data2 == 0) }; 
function isNoteOn(status: number) { return (status & 0xF0) == 0x90; }
function isKeyPressure(status: number) { return (status & 0xF0) == 0xA0; }
function isChannelController(status: number) { return (status & 0xF0) == 0xB0; }
function isProgramChange(status: number) { return (status & 0xF0) == 0xC0; }
function isChannelPressure(status: number) { return (status & 0xF0) == 0xD0; }
function isPitchBend(status: number) { return (status & 0xF0) == 0xE0; }
function isMTCQuarterFrame(status: number) { return (status == 0xF1); }
function isSongPositionPointer(status: number) { return (status == 0xF2); }
function isSongSelect(status: number) { return (status == 0xF3); }
function isTuneRequest(status: number) { return (status == 0xF6); }
function isTimingClock(status: number) { return (status == 0xF8); }
function isMIDIStart(status: number) { return (status == 0xFA); }
function isMIDIContinue(status: number) { return (status == 0xFB); }
function isMIDIStop(status: number){ return (status == 0xFC); }
function isActiveSensing(status: number) { return (status == 0xFE); }
function isSystemReset(status: number) { return (status == 0xFF); }

// Message data

function MIDIChannel(status: number)
{
   return status & 0xF;
}

function pitchBendValue(data1: number, data2: number)
{
   return (data2 << 7) | data1;
}

/* Utility functions for sending MIDI data to the default port (0) */

/**
 * Send a short midi-message to midi out port 0 of the control surface.
 * @param {String} data
 */
function sendMidi(status: number, data1: number, data2: number)
{
   host.getMidiOutPort(0).sendMidi(status, data1, data2);
}

/**
* Send a SystemExclusive midi-message to midi out port 0 of the control surface.
   * @param {String} data
*/
function sendSysex(data: number)
{
   host.getMidiOutPort(0).sendSysex(data);
}

function sendNoteOn(channel: number, key: number, velocity: number)
{
   host.getMidiOutPort(0).sendMidi(0x90 | channel, key, velocity);
}

function sendNoteOff(channel: number, key: number, velocity: number)
{
   host.getMidiOutPort(0).sendMidi(0x80 | channel, key, velocity);
}

function sendKeyPressure(channel: number, key: number, pressure: number)
{
   host.getMidiOutPort(0).sendMidi(0xA0 | channel, key, pressure);
}

function sendChannelController(channel: number, controller: number, value: number)
{
   host.getMidiOutPort(0).sendMidi(0xB0 | channel, controller, value);
}

function sendProgramChange(channel: number, program: number)
{
   host.getMidiOutPort(0).sendMidi(0xC0 | channel, program, 0);
}

function sendChannelPressure(channel: number, pressure: number)
{
   host.getMidiOutPort(0).sendMidi(0xD0 | channel, pressure, 0);
}

function sendPitchBend(channel: number, value: number)
{
   host.getMidiOutPort(0).sendMidi(0xE0 | channel, value & 0x7F, (value >> 7) & 0x7F);
}