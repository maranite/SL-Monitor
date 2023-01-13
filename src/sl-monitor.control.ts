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

      if (r instanceof SL.ProgramIn
        || r instanceof SL.ProgramOut
        || r instanceof SL.ProgramName)
        return true;

      println(`${name}: ` + r.toString());
      return true;
    }
    return false;
  }
}

var slapi: SL88API;

function init() {
  var sl88 = new MidiPair("SL88", host.getMidiInPort(0), host.getMidiOutPort(0));
  var slDevice = new SL.SLDevice(sl88);
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