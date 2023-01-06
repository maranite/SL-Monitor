
///--------------

function hex2byte(hex: string): number {
  return parseInt(hex.substring(0, 2), 16);
}

function byte2hex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function hex2word(hex: string): number {
  return (parseInt(hex.substring(2, 4), 16) << 7) + parseInt(hex.substring(0, 2), 16);
}

function word2hex(value: number): string {
  return byte2hex(value & 0x7F) + byte2hex((value >> 7) & 0x7F);
}

function ascii2hex(ascii: string, maxlen?: number) {
  maxlen = maxlen || ascii.length;
  var str = "";
  for (let i = 0; i < maxlen; i++)
    str += (i < ascii.length && i < maxlen - 1) ? byte2hex(ascii.charCodeAt(i)) : "00";
  return str;
}

function hex2ascii(hex: string) {
  var str = '';
  for (var i = 0; (i < hex.length && hex.substring(i, i + 2) !== '00'); i += 2)
    str += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
  return str;
}

function unicode2hex(str: string, maxlen?: number) {
  maxlen = maxlen || str.length;
  var str = "";
  for (let i = 0; i < maxlen; i++)
    str += (i < str.length && i < maxlen - 1) ? word2hex(str.charCodeAt(i)) : "0000";
  return str;
}

function hex2unicode(hex: string) {
  var str = '';
  for (var i = 0; i < hex.length; i += 4) {
    const val = hex2word(hex.substring(i, i + 4));
    if (val == 0)
      break;
    str += String.fromCharCode(val);
  }
  return str;
}

function array2hex(values: number[], forceLen?: number) {
  var result = values.map(word2hex).join("");
  if (forceLen && values.length < forceLen)
    result.padEnd(forceLen - values.length, "0000");
  return result;
}

function hex2array(hex: string): number[] {
  return hex.match(/([0-9a-fA-F]{4})/g)?.map(hex2word) || [];
}


function printSysex(data: string) {
  println("Sysex: " + prettyHex(data));
}

// function convertASCIItoHex(asciiVal: string) {
//   let asciiCode = asciiVal.charCodeAt(0);
//   let hexValue = asciiCode.toString(16);
//   println("0x" + hexValue);
// }

/**
 * Clean-up hex for printing (groups bytes as pairs, upper case).
 * @return {string}
 */
function prettyHex(hex: string) {
  //  hex = hex.replace(" ", "", "g"); // remove spaces
  hex = hex.replace(" ", ""); // remove spaces

  var result = "";
  var first = true;
  for (let i = 0; i < hex.length; i += 2) {
    if (!first)
      result += " ";

    result += hex.substring(i, 2);
    first = false;
  }

  return result.toUpperCase();
}



function string2unicodes(str: string, maxlen?: number): number[] {
  maxlen = maxlen || str.length;
  var r: number[] = Array(maxlen);
  for (let i = 0; i < maxlen; i++)
    r[i] = (i < str.length && i < maxlen - 1) ? str.charCodeAt(i) : 0;
  return r;
}

function unicodes2string(atoms: number[]) {
  var result = "";
  for (let charCode of atoms) {
    if (charCode == 0) break;
    result += String.fromCharCode(charCode);
  }
  return result;
}

const toTitleCase = (str: string) => {
  return str.toLowerCase().split(' ').map(function (word) {
    return word.replace(word[0], word[0].toUpperCase());
  }).join(' ');
}

///---------------------------------------
/** A callback which removes an element from an array */
type Remover = () => boolean;

interface Array<T> {
  /** Returns a callback which removes element from the array */
  getRemover(element: T): Remover;
  pushWithRemover(element: T): Remover
  unshiftWithRemover(element: T): Remover
}

Array.prototype.getRemover = function (this: Array<any>, element: any) {
  return () => {
    var index = this.indexOf(element);
    if (index > -1)
      this.splice(index, 1);
    return index > -1;
  };
}

Array.prototype.pushWithRemover = function (this: Array<any>, element: any) {
  this.push(element);
  return this.getRemover(element);
}

Array.prototype.unshiftWithRemover = function (this: Array<any>, element: any) {
  this.unshift(element);
  return this.getRemover(element);
}


///---------------------------------------

/** A callback which processes a sysex message. Returns true if the message was handled by the callback, else false. */
type SysexListener = (hex: string) => boolean;


abstract class SysexBase {
  /**
   * A chain of callbacks which listen for Sysex messages.
   * The first listener to return True is regarded as having consumed the message, and subsequent listeners are not called.
   */
  sysexListeners: ((hexString: string) => boolean)[] = [];

  /** The last sysex message to have been received */
  mostRecentlyReceived: string = "";

  /**
   * Registers a listener at the start of the listened chain.
   * @param listener a SysexListener which should return true if it handles the message.
   * @returns a function which, when called, removed the listener.
   */
  registerListener(listener: SysexListener): Remover {
    return this.sysexListeners.unshiftWithRemover(listener);
  }

  /** Sends a sysex message immediately. */
  abstract send(hex: string): void;

  /** Sends a sysex message and waits a while for the device to process it. */
  async sendAsync(hex: string) {
    return new Promise<void>((resolve, reject) => {
      this.send(hex);
      host.scheduleTask(resolve, 100);
    })
  }

  /**
   * Sends a sysex message and waits for a response.
   * @param hex string of hex data to send
   * @param expect optional regular expression denoting what response to expect.
   * @returns a promise which resolves to the regex match result.
   */
  async requestAsync(hex: string, expect: string = "f0(\w+)f7") {
    const rx = new RegExp(expect, "i");
    return new Promise<RegExpMatchArray>((resolve, reject) => {
      const fulfill = this.registerListener((data: string) => {
        var match = data.match(rx);
        if (match) {
          if (fulfill()) {
            resolve(match);
            return true;
          }
        }
        return false;
      });
      this.send(hex);
      host.scheduleTask(() => { fulfill() && reject(); }, 500);
    })
  }

  async awaitReply<T>(decode: (hex: string) => T) {
    return new Promise<T>((resolve, reject) => {
      const fulfill = this.registerListener((data: string) => {
        var result = decode(data);
        if (result && fulfill()) {
          resolve(result);
          return true;
        }
        return false;
      });
      host.scheduleTask(() => { fulfill() && reject("Timed out"); }, 500);
    })
  }


  async requestObjectAsync<T>(hex: string, decode: (hex: string) => T) {
    this.send(hex);
    return this.awaitReply(decode);
    // return new Promise<T>((resolve, reject) => {
    //   const fulfill = this.registerListener((data: string) => {
    //     var result = decode(data);
    //     if (result && fulfill()) {
    //       resolve(result);
    //       return true;
    //     }
    //     return false;
    //   });
    //   this.send(hex);
    //   host.scheduleTask(() => { fulfill() && reject("Timed out after sending " + hex); }, 500);
    // })
  }


  async echoMostRecentReceived<T>(decode: (hex: string) => T) {
    return this.requestObjectAsync(this.mostRecentlyReceived, decode);
  }
}


/**
 * Pairs Midi In and Out ports to enable promise based communication with a Midi device/
 */
class MidiPair extends SysexBase {

  onAllSysex(hex: string) { }
  onUnhandledSysex(hex: string) { println("Unhandled sysex: " + hex); }

  constructor(public name: string, public midiIn: API.MidiIn, public midiOut: API.MidiOut) {
    super();
    midiIn.setSysexCallback((hex: string) => {
      this.mostRecentlyReceived = hex;
      var handled = false;

      this.onAllSysex(hex);

      for (let listener of this.sysexListeners) {
        if (listener(hex))
          return;
      }

      if (!handled)
        this.onUnhandledSysex(hex);
    });
  }

  /** Sends a sysex message immediately. */
  send(hex: string) {
    this.midiOut.sendSysex(hex);
  }
}


/** A shim which interprets sysex messages which are specific to a device - typically having a fixed preamble */
class DeviceSysex extends SysexBase {

  public prefix: string;
  public suffix: string;
  public mostRecentlyReceived: string = "";

  constructor(public midi: MidiPair, prefix: string = '', suffix: string = '') {
    super();
    this.prefix = 'f0' + prefix;
    this.suffix = suffix + 'f7';
    var deviceMatch = new RegExp(this.prefix + "([0-9a-f]+)" + this.suffix, "i");
    midi.registerListener(hex => {
      const matched = hex.match(deviceMatch);
      if (matched && matched.length == 2) {
        this.mostRecentlyReceived = matched[1];
        for (let listener of this.sysexListeners) {
          if (listener(matched[1]))
            return true;
        }
      }
      return false;
    });
  }


  send(hex: string): void {
    // println('sending ' + hex);
    this.midi.send(this.prefix + hex + this.suffix);
  }
}





namespace SL {

  type codec = [rx: string, decode: (hex: string) => any, encode: (data: any) => string];
  const byte: codec = [`([0-9a-f]{2})`, hex2byte, byte2hex];
  const word: codec = [`([0-9a-f]{4})`, hex2word, word2hex];
  const ascii = (length: number): codec => [`([0-9a-f]{${2 * length}})`, hex2ascii, s => ascii2hex(s, length)];
  const unicode = (length: number): codec => [`([0-9a-f]{${2 * length}})`, hex2unicode, s => ascii2hex(s, length)];
  const words = (length: number = 0): codec => length ?
    [`([0-9a-f]{${4 * length}})`, hex2array, s => array2hex(s, length)] :
    [`(([0-9a-f]{4})*)`, hex2array, array2hex];

  type AnyConstructor = (new (...args: any[]) => any);

  type StaticMembers = {
    regex: RegExp;
    decode: (hex: string) => any;
  }

  type Retype<T extends new (...args: any[]) => any>
    = T extends new (...args: infer A) => infer X ? {
      new(...args: A): X & {
        toHex(): string
        toString(): string
      }
    }
    & StaticMembers
    & { encode(...args: A): string }
    : never

  function getArgs(func: Function) {
    return func.toString().match(/function [^(]+\(([^)]*)\)/)![1].split(", ");
  }

  /** Monkey patches a POJO class to have static members like decode, encode, regex as well as instance members toHex and toString */
  function syx<T extends new (...args: any[]) => any>(target: T, ...args: (string | codec)[]): Retype<T> {
    const ctor = target as any as Retype<T>;
    const regx = ctor.regex = new RegExp(args.map(a => typeof a === 'string' ? a : a[0]).join(""), "i");
    const pnames = getArgs(target);
    const codecs: codec[] = args.filter(a => typeof a !== 'string') as codec[];
    all_classes.push(ctor);

    ctor.decode = (hex: string) => {
      var match = hex.match(regx);
      if (match) {
        const rest = match.slice(1).map((r, i) => codecs[i][1](r));
        //println(JSON.stringify(rest));
        return new ctor(...rest);
      }
    };
    ctor.encode = (...args2: any[]) => {
      return args.map(a => typeof a === 'string' ? a : a[2](args2.shift())).join("");
    };
    ctor.prototype.toHex = function (this: any) {
      const r = pnames.slice(0);
      return args.map((a, i) => typeof a === 'string' ? a : a[2](this[r.shift()!])).join("");
    }
    ctor.prototype.toString = function (this: any) {
      return `${ctor.name} ` + pnames.map(p => `${p}=${this[p]}`).join(", ");
    }
    return target as any;
  }

  /** List of all SYSEX handler class which try_decode() could return */
  export const all_classes: (StaticMembers & AnyConstructor)[] = [];

  /** Attempts to decode a sysex message and return an instance of the corresponding SYSEX class */
  export function try_decode(hex: string) {
    for (let ctor of all_classes) {
      var result = ctor.decode(hex);
      if (result)
        return result;
    }
  }

  export const PatchIn = syx(class PatchIn { constructor(public patchNo: number, public patchData: number[], public checksum: number) { } }, "01", word, "0002", words(256), byte);
  export const PatchOut = syx(class PatchOut { constructor(public patchNo: number, public patchData: number[]) { } }, "01", word, words(256));
  export const PatchParam = syx(class PatchParam { constructor(public offset: number, public length: number, public data: number[]) { } }, "02", word, byte, words());
  export const RecallPatch = syx(class RecallPatch { constructor(public patchNo: number) { } }, "06", word);
  export const StorePatch = syx(class StorePatch { constructor(public patchNo: number) { } }, "09", word);
  export const PatchName = syx(class PatchName { constructor(public patchNo: number, public name: string) { } }, "0a", word, ascii(15));
  export const SetMode = syx(class SetMode { constructor(public param: number, public value1: number) { } }, "08", byte, byte);
  export const SetMode2 = syx(class SetMode2 { constructor(public param: number, public value1: number, public value2: number) { } }, "08", byte, word, word);
  export const SetMode3 = syx(class SetMode3 { constructor(public data: number[]) { } }, "08010058", words(256));
  export const SetGlobalTranspose = syx(class SetGlobalTranspose { constructor(public value: number) { } }, "0501", byte);
  export const SetGlobalPedalMode = syx(class SetGlobalPedalMode { constructor(public value: number) { } }, "0502", byte);
  export const SetGlobalCommonChannel = syx(class SetGlobalCommonChannel { constructor(public value: number) { } }, "0503", byte);
  export const InitiateConnection = syx(class InitiateConnection { constructor() { } }, "000500");
  export const InitiateConnectionReply = syx(class InitiateConnectionReply { constructor() { } }, "05001100");
  export const CheckAttached = syx(class CheckAttached { constructor() { } }, "007f");
  export const ConfirmAttached = syx(class ConfirmAttached { constructor() { } }, "7f");
  export const EndOfDump = syx(class EndOfDump { constructor() { } }, "000a");
  export const RequestPatchNameDump = syx(class RequestPatchNameDump { constructor() { } }, "0010");
  export const EndOfPatchNameDump = syx(class EndOfPatchNameDump { constructor() { } }, "10");
  export const BeginDumpIn = syx(class BeginDumpIn { constructor() { } }, "0011");
  export const EndOfDumpIn = syx(class EndOfDumpIn { constructor() { } }, "11");
  export const SetGlobal = syx(class SetGlobal { constructor(public param: number, public value: number) { } }, "05", byte, byte);
  export const MaybeSessionPreamble = syx(class MaybeSessionPreamble { constructor(public someValue: number) { } }, "05", word);
  export const GroupOrderIn = syx(class GroupOrderIn { constructor(public groupIndices: number[]) { } }, "0455000000", words(12), "17");
  export const GroupOrderOut = syx(class GroupOrderOut { constructor(public groupIndices: number[]) { } }, "0455000000", words(12));
  export const GroupDumpIn = syx(class GroupDumpIn { constructor(public groupNo: number, public data: number[], public checksum: number) { } }, "03", byte, "5500", words(76), byte);
  export const GetVelocityCurve = syx(class GetVelocityCurve { constructor(curveNo: number, type: VelocityCurveType, name: string, unk: number, points: number[], velocities: number[], trailer: number) { } }, "0700", byte, word, unicode(17), "000000000100", word, words(30), "0000", words(127), byte);
  export const SetVelocityCurve = syx(class SetVelocityCurve { constructor(curveNo: number, type: VelocityCurveType, name: string, unk: number, points: number[], velocities: number[]) { } }, "0701", byte, word, unicode(17), "000000000100", word, words(30), "0000", words(127));
  export const Curve = syx(class Curve { constructor(public data: number[]) { } }, "0700", words(173));
  // export const Curve2 { constructor((curveNo: number, type: VelocityCurveType, name: string, unk: number, points: number[], velocities: number[], trailer: number)) {} }("0700-x173")
  // 0700(CURVE#)(0000=FACTORY,5500=USER)(UNICODE NAME)0000000001000100(30 x little endian maybe curve values 0 usually x7f01/255)0000(127 x little endian velocity values)(two digits)

  export type PatchIn = InstanceType<typeof PatchIn>;
  export type PatchOut = InstanceType<typeof PatchOut>;
  export type PatchParam = InstanceType<typeof PatchParam>;
  export type RecallPatch = InstanceType<typeof RecallPatch>;
  export type StorePatch = InstanceType<typeof StorePatch>;
  export type PatchName = InstanceType<typeof PatchName>;
  export type SetMode = InstanceType<typeof SetMode>;
  export type SetMode2 = InstanceType<typeof SetMode2>;
  export type SetMode3 = InstanceType<typeof SetMode3>;
  export type SetGlobalTranspose = InstanceType<typeof SetGlobalTranspose>;
  export type SetGlobalPedalMode = InstanceType<typeof SetGlobalPedalMode>;
  export type SetGlobalCommonChannel = InstanceType<typeof SetGlobalCommonChannel>;
  export type InitiateConnection = InstanceType<typeof InitiateConnection>;
  export type InitiateConnectionReply = InstanceType<typeof InitiateConnectionReply>;
  export type CheckAttached = InstanceType<typeof CheckAttached>;
  export type ConfirmAttached = InstanceType<typeof ConfirmAttached>;
  export type EndOfDump = InstanceType<typeof EndOfDump>;
  export type RequestPatchNameDump = InstanceType<typeof RequestPatchNameDump>;
  export type EndOfPatchNameDump = InstanceType<typeof EndOfPatchNameDump>;
  export type BeginDumpIn = InstanceType<typeof BeginDumpIn>;
  export type EndOfDumpIn = InstanceType<typeof EndOfDumpIn>;
  export type SetGlobal = InstanceType<typeof SetGlobal>;
  export type MaybeSessionPreamble = InstanceType<typeof MaybeSessionPreamble>;
  export type GroupOrderIn = InstanceType<typeof GroupOrderIn>;
  export type GroupOrderOut = InstanceType<typeof GroupOrderOut>;
  export type GroupDumpIn = InstanceType<typeof GroupDumpIn>;
  export type GetVelocityCurve = InstanceType<typeof GetVelocityCurve>;
  export type SetVelocityCurve = InstanceType<typeof SetVelocityCurve>;
  export type Curve = InstanceType<typeof Curve>;

  export function isPatchIn(a : any) : a is PatchIn { return a instanceof PatchIn; }
  export function isPatchOut(a : any) : a is PatchOut { return a instanceof PatchOut; }
  export function isPatchParam(a : any) : a is PatchParam { return a instanceof PatchParam; }
  export function isRecallPatch(a : any) : a is RecallPatch { return a instanceof RecallPatch; }
  export function isStorePatch(a : any) : a is StorePatch { return a instanceof StorePatch; }
  export function isPatchName(a : any) : a is PatchName { return a instanceof PatchName; }
  export function isSetMode(a : any) : a is SetMode { return a instanceof SetMode; }
  export function isSetMode2(a : any) : a is SetMode2 { return a instanceof SetMode2; }
  export function isSetMode3(a : any) : a is SetMode3 { return a instanceof SetMode3; }
  export function isSetGlobalTranspose(a : any) : a is SetGlobalTranspose { return a instanceof SetGlobalTranspose; }
  export function isSetGlobalPedalMode(a : any) : a is SetGlobalPedalMode { return a instanceof SetGlobalPedalMode; }
  export function isSetGlobalCommonChannel(a : any) : a is SetGlobalCommonChannel { return a instanceof SetGlobalCommonChannel; }
  export function isInitiateConnection(a : any) : a is InitiateConnection { return a instanceof InitiateConnection; }
  export function isInitiateConnectionReply(a : any) : a is InitiateConnectionReply { return a instanceof InitiateConnectionReply; }
  export function isCheckAttached(a : any) : a is CheckAttached { return a instanceof CheckAttached; }
  export function isConfirmAttached(a : any) : a is ConfirmAttached { return a instanceof ConfirmAttached; }
  export function isEndOfDump(a : any) : a is EndOfDump { return a instanceof EndOfDump; }
  export function isRequestPatchNameDump(a : any) : a is RequestPatchNameDump { return a instanceof RequestPatchNameDump; }
  export function isEndOfPatchNameDump(a : any) : a is EndOfPatchNameDump { return a instanceof EndOfPatchNameDump; }
  export function isBeginDumpIn(a : any) : a is BeginDumpIn { return a instanceof BeginDumpIn; }
  export function isEndOfDumpIn(a : any) : a is EndOfDumpIn { return a instanceof EndOfDumpIn; }
  export function isSetGlobal(a : any) : a is SetGlobal { return a instanceof SetGlobal; }
  export function isMaybeSessionPreamble(a : any) : a is MaybeSessionPreamble { return a instanceof MaybeSessionPreamble; }
  export function isGroupOrderIn(a : any) : a is GroupOrderIn { return a instanceof GroupOrderIn; }
  export function isGroupOrderOut(a : any) : a is GroupOrderOut { return a instanceof GroupOrderOut; }
  export function isGroupDumpIn(a : any) : a is GroupDumpIn { return a instanceof GroupDumpIn; }
  export function isGetVelocityCurve(a : any) : a is GetVelocityCurve { return a instanceof GetVelocityCurve; }
  export function isSetVelocityCurve(a : any) : a is SetVelocityCurve { return a instanceof SetVelocityCurve; }
  export function isCurve(a : any) : a is Curve { return a instanceof Curve; }


}


// const tyt = new SL.PatchName(99, "POCKEY");

// println(tyt.toString());

// const str = tyt.toHex();
// println(str);

// var t = SL.try_decode(str);
// if (t instanceof SL.PatchName) {
//   println(t.toHex() == str ? "Decode works" : "shit!")
// }

// const ui : SL.PatchName = null as any;


// var qwq = SL.PatchName.encode(99, "POCKEY");
// println(qwq == str ? "encode works" : "encode is shit!")

