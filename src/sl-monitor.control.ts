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
    host.addDeviceNameBasedDiscoveryPair(["MIDIIN2 (SL GRAND)", "loopMIDI Port"], ["MIDIOUT2 (SL GRAND)", "loopMIDI Port"]);
    break;
}





///---------------------------------------

function buildSysex(preamble: string = '00201a00') {

  var basicMatcher = new RegExp(`^f0${preamble}([0-9a-fA-F]+)f7$`);

  function newClass(this: any, logger?: (message: string) => void) {
    logger && (this.log = logger);
  }

  newClass.prototype.tryMatch = function (sysex: string) {
    var m = sysex.match(basicMatcher);
    if (!m) return false;

    for (let handler of this.handlers) {
      if (handler.call(this, sysex))
        return true;
    }
    this.log("Unrecognized: " + m[1]);
    return false;
  }
  newClass.prototype.log = function (message: string) { }
  newClass.prototype.send = function (sysex: string) { this.log(prettyHex(sysex)); }
  newClass.prototype.handlers = new Array<(data: string) => boolean>();

  interface codec { 'match': string, 'parse': (data: string) => any, 'format': (data: any) => string, 'captures': boolean }

  function getCodec(symbol: string): codec {
    var rest = symbol.slice(1);
    var len = rest.length > 0 ? parseInt(rest) : 1;
    const command = symbol[0].toLowerCase();
    const capture = (command === symbol[0]);
    switch (command) {
      case 'w': return { match: '(\\w{4})', parse: hex2word, format: word2hex, captures: capture };
      case 'n': return { match: '(\\w{2})', parse: hex2byte, format: byte2hex, captures: capture };
      case 's': return { match: `(\\w{${2 * len}})`, parse: hex2ascii, format: s => ascii2hex(s, len), captures: capture };
      case 'u': return { match: `(\\w{${4 * len}})`, parse: hex2unicode, format: s => unicode2hex(s, len), captures: capture };
      case 'l': return { match: `(\\w{${2 * len}})`, parse: _ => _, format: s => s, captures: capture };
      case 'x': return { match: `(\\w{${4 * len}})`, parse: hex2array, format: s => array2hex(s, len), captures: capture };
      case '#': return { match: '(\\w+)', parse: hex2array, format: s => array2hex(s), captures: true };
      case '*': return { match: '(\\w+)', parse: _ => _, format: _ => symbol, captures: true };
      default: return { match: symbol, parse: _ => _, format: _ => symbol, captures: false };
    }
  }

  class builder<T> {
    add<Name extends string, Func extends (...args: any) => void>(name: Name, hex: string, handler: Func, ...enumMappers: any):
      builder<T
        & { [P in Name as `tryMatch${P}`]: (data: string) => boolean }
        & { [P in Name as `on${P}`]: Func extends (...args: infer P) => void ? Func : string }
        & { [P in Name as `send${P}`]: Func extends (...args: infer P) => void ? Func : never }
      > {

      var maybeParts = hex.match(/([0-9a-f]+)|([usxl]\d+)|([wn#*])/ig);
      if (!maybeParts)
        throw "bad parts";

      var enumIndex = 0;
      const codecs = maybeParts!!.map((part) => {
        var codec = getCodec(part);
        if (codec.captures) {
          var mapper = enumMappers[enumIndex++];
          if (mapper) {
            const keys = Object.keys(mapper);
            var oldParse = codec.parse;
            const oldFormat = codec.format;
            codec.parse = (v) => {
              const value = oldParse(v);
              for (let key of keys)
                if (mapper[key] == value)
                  return key;
              return value;
            }
            codec.format = (v) => mapper[oldFormat(v)];
            codec.match = "(" + keys.map(k => mapper[k]).filter(v => typeof v === 'number').map(oldFormat).join("|") + ")";
          }
        }
        return codec;
      });

      var handlerName = "on" + name;
      newClass.prototype[handlerName] = function (...args: any) {
        if (name.endsWith("_")) return;
        if (args) {
          this.log(`${name}: ${args.map((a: any) => typeof a === "number" ? a.toString(16).padStart(2, "00") : a).join(" ")}`);
        }
      };

      const matchString = codecs.map(c => c.match).join("");
      const hexMatcher = new RegExp("^f0" + preamble + matchString + "f7$");

      var r = newClass.prototype["tryMatch" + name] = function (data: string) {
        const match = data.match(hexMatcher);
        if (match) {
          var argz = codecs
            .filter(c => c.captures)
            .map((c, i) => c.parse(match[i + 1]));
          this[handlerName]?.apply(this, argz);
          return true;
        }
        return false;
      };

      newClass.prototype.handlers.push(r);

      // encode
      newClass.prototype["send" + name] = function (...args: any) {
        var data = "f0" + preamble + codecs.map((p, i) => p.format(args[i + 1])).join("") + "f7";
        this.send(data);
      };
      return this as any;
    };

    build() {
      return newClass as any as new () => T;
    }
  }

  return new builder<{
    tryMatch: (sysex: string) => boolean;
    send: (sysex: string) => void;
    log: (message: string) => void;
  }>();
}

///---------------------------------------



type ZoneKey = 'Zone1' | 'Zone2' | 'Zone3' | 'Zone4';
type ZoneMap = { [K in ZoneKey]: number };

function ZoneMap(first: number, step: number = 1): ZoneMap {
  return {
    'Zone1': first,
    'Zone2': first + step,
    'Zone3': first + step + step,
    'Zone4': first + step + step + step
  } as any
}



/*
Globals:

0x98: Midi Merge Source   (00 = Off, 1 = Midi In, 2 = USB In )
0x10: Midi Merge Destination  (0 = USB, 0x10 = Midi1, 0x20 = Midi2, 0x30-0x60 = Zone1/2/3/4)
0x11: Sysex Filter & Channel   ( 00FCCCCC    = C=0 All channels.   F=0 filter off)
0x12: Mixface program   (0=Off)
*/


var sl88SysexHandler = buildSysex("00201a00")
  .add("InitiateConnection", "00-05-00", () => { })
  .add("InitiateConnectionReply", "05-001100", () => { })

  .add("CheckAttached_", "007f", () => { })
  .add("ConfirmAttached_", "7f", () => { })
  .add("EndOfDump", "000a", () => { })

  //.add("CurrentPatchName", "0a0000-s15", (name: string) => { })
  .add("RequestPatchNameDump", "0010", () => { })
  .add("PatchName", "0a-w-s15", (patch: number, name: string) => { })
  .add("SetPatchParam", "02-w-n-#", (offset: number, length: number, data: number[]) => { })

  .add("SetGlobalTranspose", "05-01-n", (value: number) => { })
  .add("SetGlobalPedalMode", "05-02-n", (value: number) => { })
  .add("SetGlobalCommonChannel", "05-03-n", (value: number) => { })

  .add("SetGlobal", "05-n-n", (param: number, value: number) => { })
  .add("MaybeSessionPreamble", "05-w", (someValue: number) => { }) // 010c-0200-0300
  .add("SelectPatch", "06-w", (patch: number) => { })
  .add("SetMode2", "08-n-w-w", (param: number, val1: number, val2: number) => { })
  .add("SetMode", "08-n-n", (param: number, value: number) => { })
  .add("SetMode3", "08-01-00-58-x85", () => { })
  .add("HandShake", "10", () => { })
  // 0700(CURVE#)(0000=FACTORY,5500=USER)(UNICODE NAME)0000000001000100(30 x little endian maybe curve values 0 usually x7f01/255)0000(127 x little endian velocity values)(two digits)
  .add("Curve_", "0700-x173", (curveNo: number, type: VelocityCurveType, name: string, unk: number, points: number[], velocities: number[], trailer: number) => { })
  .add("GetVelocityCurve_", "0700-n-w-u17-0000-0000-0100-w-x30-0000-x127-n", (curveNo: number, type: VelocityCurveType, name: string, unk: number, points: number[], velocities: number[], trailer: number) => { })
  .add("SetVelocityCurve_", "0701-n-w-u17-0000-0000-0100-w-x30-0000-x127", (curveNo: number, type: VelocityCurveType, name: string, unk: number, points: number[], velocities: number[]) => { })
  .add("SaveToLocation", "09-w", (patch: number) => { })

  .add("BeginDumpIn", "0011", () => { })
  .add("PatchDumpIn", "01-w-0002-x256-n", (patch: number, patchData: number[], checksum: number) => { })
  .add("PatchDumpOut", "01-w-x256", (patch: number, patchData: number[]) => { })
  .add("GroupDumpIn", "03-n-5500-x76-*", (groupNo: number, data: number[]) => { })
  .add("EndOfDumpIn", "11", () => { })

  .add("GroupOrderIn", "04-5500-0000-x12-17", (groupIndices: number[]) => { })
  .add("GroupOrderOut", "04-5500-0000-x12", (groupIndices: number[]) => { })

  .build();

//-----------------------------------------------------------

var sl88: MidiPair;
var app: MidiPair;
function logApp(text: string) { println("APP : " + text); }
function logSL88(text: string) { println("SL88: " + text); }

sl88SysexHandler.prototype.onSetPatchParam = (offset: number, length: number, data: number[]) => {
  var prop = PatchData.propertyMap[offset];
  println(`onSetPatchParam... ${prop ?? 'unknown'} : ${word2hex(offset)}-${byte2hex(length)}-${data.map(byte2hex).join("")}`);
};

sl88SysexHandler.prototype.onGroupDumpIn = (groupNo: number, data: number[]) => {
  const dc = buildArrayDataGetter(data);
  var r = new GroupData(dc);
  println(`Group ${groupNo}: ${r.name}`);
  if (r.active) {
    println("is Active");
    println(r.presets.join(" | "));
  }
}

var lastPatch: number[] = [];

sl88SysexHandler.prototype.onPatchDumpIn = (patchNo: number, data: number[], checksum: number) => {
  lastPatch = data;
  const dc = buildArrayDataGetter(data);
  const patch = new PatchData(dc);
  println(`Patch ${patchNo} In: Name: ${patch.name}`);
}

sl88SysexHandler.prototype.onPatchDumpOut = (patchNo: number, data: number[]) => {
  const dc = buildArrayDataGetter(data);
  const patch = new PatchData(dc);
  println(`Patch ${patchNo} Out Name: ${patch.name}`);
}

var appSysex = new sl88SysexHandler();
var sl88Sysex = new sl88SysexHandler();
const sl88Preamble = "00201a00";

var lastSL88Sysex: string = "";

function onSysexFromSL88(data: string) {
  app.send(data);
  lastSL88Sysex = data;
  try {
    sl88Sysex.tryMatch(data);
  } catch (e) {
    println(String(e));
  }
  return true;
}

function onSysexFromApp(data: string) {
  sl88.send(data);
  if (data !== lastSL88Sysex) {
    try {
      appSysex.tryMatch(data)
    } catch (e) {
      println(String(e));
    }
  }
  return true;
}


function init() {
  sl88 = new MidiPair("SL88", host.getMidiInPort(0), host.getMidiOutPort(0));
  sl88.registerListener(onSysexFromSL88);
  sl88Sysex.log = logSL88;
  sl88Sysex.send = hex => sl88.send(hex);

  app = new MidiPair("App", host.getMidiInPort(1), host.getMidiOutPort(1));
  app.registerListener(onSysexFromApp);
  appSysex.log = logApp;
  appSysex.send = hex => app.send(hex);
}

function exit() { }

function flush() { }