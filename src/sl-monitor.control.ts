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

      // if (r instanceof SL.ProgramIn
      //   || r instanceof SL.ProgramOut
      //   || r instanceof SL.ProgramName)
      //   return true;

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

// TODO: Create 30 Track Select programs, along with a group
// TODO: Experiment with getting Bitwig's presets (and loading them) without a visible popupbrowser
// TODO: Experiment with loading Omnisphere ratings and re-writting the default.omni
// TODO: Experiment with using Java to "watch" files for changes.
/*
final Path path = FileSystems.getDefault().getPath(System.getProperty("user.home"), "Desktop");
System.out.println(path);
try (final WatchService watchService = FileSystems.getDefault().newWatchService()) {
    final WatchKey watchKey = path.register(watchService, StandardWatchEventKinds.ENTRY_MODIFY);
    while (true) {
        final WatchKey wk = watchService.take();
        for (WatchEvent<?> event : wk.pollEvents()) {
            //we only register "ENTRY_MODIFY" so the context is always a Path.
            final Path changed = (Path) event.context();
            System.out.println(changed);
            if (changed.endsWith("myFile.txt")) {
                System.out.println("My file has changed");
            }
        }
        // reset the key
        boolean valid = wk.reset();
        if (!valid) {
            System.out.println("Key has been unregisterede");
        }
    }
}
*/


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