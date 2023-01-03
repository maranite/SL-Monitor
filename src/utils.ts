
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
      delete this[index];
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
   * Registers a listener at the start of the listened chain.
   * @param listener a SysexListener which should return true if it handles the message.
   * @returns a function which, when called, removed the listener.
   */
  abstract registerListener(listener: SysexListener): Remover;

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
    const rx = new RegExp(expect, "gi");
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

  async requestObjectAsync<T>(hex: string, decode: (hex: string) => T) {
    return new Promise<T>((resolve, reject) => {
      const fulfill = this.registerListener((data: string) => {
        var result = decode(data);
        if (result && fulfill()) {
          resolve(result);
          return true;
        }
        return false;
      });
      this.send(hex);
      host.scheduleTask(() => { fulfill() && reject("Timed out after sending " + hex); }, 500);
    })
  }
}


/**
 * Pairs Midi In and Out ports to enable promise based communication with a Midi device/
 */
class MidiPair extends SysexBase {
  /**
   * A chain of callbacks which listen for Sysex messages.
   * The first listener to return True is regarded as having consumed the message, and subsequent listeners are not called.
   */
  sysexListeners: ((hexString: string) => boolean)[] = [];
  onAllSysex(hexString: string) { }

  constructor(public name: string, public midiIn: API.MidiIn, public midiOut: API.MidiOut) {
    super();
    midiIn.setSysexCallback((hexString: string) => {
      var handled = false;

      this.onAllSysex(hexString);

      for (let listener of this.sysexListeners) {
        handled ||= listener(hexString);
        if (handled) break;
      }

      if (!handled)
        println("Unhandled sysex: " + hexString);
    });
  }

  /**
   * Registers a listener at the start of the listened chain.
   * @param listener a SysexListener which should return true if it handles the message.
   * @returns a function which, when called, removed the listener.
   */
  registerListener(listener: SysexListener): Remover {
    return this.sysexListeners.unshiftWithRemover(listener);
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
  sysexListeners: ((hexString: string) => boolean)[] = [];

  constructor(public midi: MidiPair, prefix: string = '', suffix: string = '') {
    super();
    this.prefix = 'f0' + prefix;
    this.suffix = suffix + 'f7';
    var deviceMatch = new RegExp(prefix + "([0-9a-f]+)" + suffix, "gi");
    midi.registerListener(hex => {
      const matched = hex.match(deviceMatch);
      if (matched)
        for (let listener of this.sysexListeners) {
          if (listener(matched[1]))
            return true;
        }
      return false;
    });
  }

  send(hex: string): void {
    println('sending ' + hex);
    this.midi.send(this.prefix + hex + this.suffix);
  }

  /**
   * Registers a listener at the start of the listened chain.
   * @param listener a SysexListener which should return true if it handles the message.
   * @returns a function which, when called, removed the listener.
   */
  registerListener(listener: SysexListener): Remover {
    var deviceMatch = new RegExp(this.prefix + "([0-9a-f]+)" + this.suffix, "gi");
    return this.midi.registerListener(
      hex => {
        const matched = hex.match(deviceMatch);
        if (!matched)
          return false;
        return listener(matched[1]);
      });
  }
}
