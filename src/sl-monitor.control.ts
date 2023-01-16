loadAPI(17);
load('utils.js');
load('sl88syx.js');

host.setShouldFailOnDeprecatedUse(true);
host.defineMidiPorts(2, 2);
host.defineController(
  "StudioLogic",
  "SL88Monitor",
  "0.2",
  "6f47d215-8945-4361-9403-aaaaaaaaaaaa",
  "Mark White"
);

switch (host.getPlatformType()) {
  case com.bitwig.extension.api.PlatformType.WINDOWS:
    host.addDeviceNameBasedDiscoveryPair(["MIDIIN2 (SL GRAND)", "SL Editor Out"], ["MIDIOUT2 (SL GRAND)", "SL Editor In"]);
    break;
}


function makeListener(name: string) {
  return (data: string) => {
    var r = SL.try_decode(data);
    if (r) {
      if (r instanceof SL.CheckAttached || r instanceof SL.ConfirmAttached)
        return true;

      if (r instanceof SL.Program
       || r instanceof SL.ProgramName)
        return true;

      println(`${name}: ` + r.toString());
      return true;
    }
    return false;
  }
}

var slapi: SL88API;
var slDevice: SL.SLDevice

function init() {
  var sl88 = new MidiPair("SL88", host.getMidiInPort(0), host.getMidiOutPort(0));
  slDevice = new SL.SLDevice(sl88);
  slDevice.registerListener(makeListener('SL88'));
  slDevice.onUnhandledSysex = hex => println('sl88 unhandled: ' + hex);
  slapi = new SL88API(slDevice);

  var app = new MidiPair("App", host.getMidiInPort(1), host.getMidiOutPort(1));
  var appDevice = new SL.SLDevice(app);
  appDevice.registerListener(makeListener(' APP'));
  appDevice.onUnhandledSysex = hex => println('app unhandled: ' + hex);

  sl88.onAllSysex = hex => app.send(hex);
  app.onAllSysex = hex => sl88.send(hex);
}

function exit() { }

function flush() { }

async function createTrackPrograms(firstSlot: number = 0, groupSlot: number = 0) {
  const device = slDevice;
  const prog = SL.Program.newDefault();
  const indices = [];
  for (var i = 0; i < 30; i++) {
    prog.name = `Track ${1 + i}`;

    prog.zones[0].instrument = `Track ${1 + i}`;
    prog.zones[0].sound = 'Keys (ch1)';
    prog.zones[0].enabled = 'On';
    prog.zones[0].midiChannel = 0;
    prog.zones[0].stick1X = "pitchbend";
    prog.zones[0].stick1Y = "modulation";
    prog.zones[0].pedal1 = 'damperPedal';
    prog.zones[0].pedal3 = 'aftertouch';

    prog.zones[2].instrument = 'Stick 1 X';
    prog.zones[2].sound = 'Pitchbend';
    prog.zones[2].enabled = 'On';
    prog.zones[2].midiChannel = 14;
    prog.zones[2].stick1X = "pitchbend";

    prog.zones[3].instrument = 'Stick 1 Y';
    prog.zones[3].sound = 'Pitchbend';
    prog.zones[3].enabled = 'On';
    prog.zones[3].midiChannel = 15;
    prog.zones[3].programChange = i;
    prog.zones[3].LSB = 1;  // track mode
    prog.zones[3].MSB = i;  // track number
    prog.zones[3].stick1Y = "pitchbend";

    var programNo = firstSlot + i;
    indices.push(programNo);
    println(`Creating ${prog.name}`);
    await device.sendAsync(new SL.ProgramDump(programNo, prog).toHex());
  }
  await device.sendAsync(new SL.GroupDump(groupSlot, 'TRACKS', indices, true).toHex());
}


function createProgramTemplate() {
  const prog = new SL.Program(SL.Program.template);
  prog.name = `INIT PROGRAM`;
  for (let zone of prog.zones) {
    zone.instrument = '';
    zone.sound = '';
    zone.enabled = 'Disabled';
    zone.midiChannel = 0;
    zone.midiPort = "USB";
    zone.volume = 'Off';
    zone.programChange = 'Off';
    zone.LSB = 'Off';
    zone.MSB = 'Off';
    zone.stick1X = "Off";
    zone.stick1Y = 'Off';
    zone.stick2X = 'Off';
    zone.stick2Y = 'Off';
    zone.stick3X = 'Off';
    zone.stick3Y = 'Off';
    zone.pedal1 = 'Off';
    zone.pedal2 = 'Off';
    zone.pedal3 = 'Off';
    zone.pedal4 = 'Off';
    zone.afterTouch = true;
    zone.curveType = 'Linear';
    zone.octave = 0;
    zone.transpose = 0;
    zone.lowVel = 0;
    zone.highVel = 127;
    zone.lowKey = 21;
    zone.highKey = 108;
  }


  prog.zones[0].enabled = 'On';
  prog.zones[0].stick2X = 'pitchbend';
  prog.zones[0].stick2Y = 'modulation';
  prog.zones[0].stick3X = 'sound1';
  prog.zones[0].stick3Y = 'sound4';
  prog.zones[0].pedal1 = 'damperPedal';
  prog.zones[0].pedal3 = 'aftertouch';
  prog.zones[0].curveType = 'User1';
  println('[' + prog.data.map(x => x || 0).join(",") + '];')
}










//TODO: experiment to figure out whether we can read the loaded / current program
/*
    // what other commands exists in 00xx?
    000a : EndOfDump
    0010 : RequestProgramNameDump
    0011 : BeginDumpIn
    007f : CheckAttached
    000500 : InitiateConnection
    
    01 : ProgramIn, ProgramOut
    02 : ProgramParam    // so... no "get" param?  ... how do we get the current program
    03 : GroupDumpIn, SetGroup
    04 : GroupOrderIn, GroupOrder
    05 : SetSessionMode
    0500 : ConfirmConnection
    0501 : GlobalTranspose
    0502 : GlobalPedalMode
    0503 : GlobalCommonChannel
    06 : RecallProgram
    0700 : GetVelocityCurve
    0701 : SetVelocityCurve
    08 : SetMode2
    0800 : SetWhiteBlackBalance
    0801 : SetKeyBalance, SetKeyBalances
    09 : StoreProgram
    0a : ProgramName
    10 : EndOfProgramNameDump
    11 : EndProgramDump
    7f : ConfirmAttached
*/